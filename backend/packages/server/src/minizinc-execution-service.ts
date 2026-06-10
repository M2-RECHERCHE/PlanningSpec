import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { rmSync } from 'node:fs';

import {
    appendPlanningExecutionLog,
    createPlanningExecutionLocked,
    createPlanningSolutionVersion,
    finalizePlanningExecutionSolutions,
    getPlanningExecutionById,
    updatePlanning,
    updatePlanningExecution,
    type PlanningExecutionLogRecord,
    type PlanningExecutionRecord,
    type PlanningExecutionStatus,
    type PlanningRecord,
    type PlanningSolutionVersionRecord
} from './db.js';
import { buildPlanningReportFromOutput, parseSolutionOutput } from './report.js';
import { prepareMiniZincModel } from './solver.js';
import {
    buildMiniZincArgs,
    hasPlanningSolutionLines,
    MiniZincStderrParser,
    MiniZincStdoutParser,
    type MiniZincSolutionBlock,
    type MiniZincStdoutEvent
} from './minizinc-stream.js';

export type MiniZincExecutionEvent =
    | { type: 'execution'; execution: PlanningExecutionRecord }
    | { type: 'log'; log: PlanningExecutionLogRecord }
    | { type: 'solution'; solution: PlanningSolutionVersionRecord }
    | { type: 'done'; execution: PlanningExecutionRecord; bestSolution?: PlanningSolutionVersionRecord | null };

interface StartMiniZincExecutionInput {
    userId: string;
    planning: PlanningRecord;
    source: string;
    solver: string;
    requestedTimeLimitSeconds?: number;
    warnings?: string[];
}

interface RunningExecution {
    planning: PlanningRecord;
    userId: string;
    solver: string;
    source: string;
    warnings: string[];
    process?: ChildProcess;
    tmpDir?: string;
    stdoutParser: MiniZincStdoutParser;
    stderrParser: MiniZincStderrParser;
    stopRequested: boolean;
    sawOptimal: boolean;
    sawUnsat: boolean;
    sawUnknown: boolean;
    solutionCount: number;
    startedAt: number;
    currentStatus: PlanningExecutionStatus;
    killTimer?: ReturnType<typeof setTimeout>;
}

const ACTIVE_STATUSES = new Set<PlanningExecutionStatus>([
    'PENDING',
    'RUNNING',
    'SOLUTION_FOUND',
    'OPTIMIZING',
    'STOP_REQUESTED',
    'STOPPING'
]);

function isTerminalStatus(status: PlanningExecutionStatus): boolean {
    return !ACTIVE_STATUSES.has(status);
}

function isWarningLike(line: string): boolean {
    return /warning|deprecated|notice/i.test(line);
}

export class MiniZincExecutionService {
    private readonly emitter = new EventEmitter();
    private readonly running = new Map<string, RunningExecution>();

    async start(input: StartMiniZincExecutionInput): Promise<
        | { ok: true; execution: PlanningExecutionRecord }
        | { ok: false; status: number; code: string; message: string; activeExecutionId?: string }
    > {
        const created = await createPlanningExecutionLocked(input.userId, {
            planningId: input.planning.id,
            solver: input.solver,
            sourceSnapshot: input.source,
            createdBy: input.userId
        });

        if (!created.ok) {
            if (created.reason === 'ACTIVE_EXISTS') {
                return {
                    ok: false,
                    status: 409,
                    code: 'EXECUTION_ALREADY_RUNNING',
                    message: 'Une exécution MiniZinc est déjà active pour cette planification.',
                    activeExecutionId: created.activeExecutionId
                };
            }

            return {
                ok: false,
                status: 404,
                code: 'NOT_FOUND',
                message: 'Planification introuvable.'
            };
        }

        this.running.set(created.execution.id, {
            planning: input.planning,
            userId: input.userId,
            solver: input.solver,
            source: input.source,
            warnings: input.warnings ?? [],
            stdoutParser: new MiniZincStdoutParser(),
            stderrParser: new MiniZincStderrParser(),
            stopRequested: false,
            sawOptimal: false,
            sawUnsat: false,
            sawUnknown: false,
            solutionCount: 0,
            startedAt: Date.now(),
            currentStatus: created.execution.status
        });

        queueMicrotask(() => {
            void this.run(created.execution.id, input.requestedTimeLimitSeconds);
        });

        return { ok: true, execution: created.execution };
    }

    async stop(executionId: string, userId: string): Promise<
        | { ok: true; execution: PlanningExecutionRecord }
        | { ok: false; status: number; code: string; message: string }
    > {
        const execution = await getPlanningExecutionById(executionId, userId);
        if (!execution) {
            return {
                ok: false,
                status: 404,
                code: 'NOT_FOUND',
                message: 'Exécution introuvable.'
            };
        }

        if (isTerminalStatus(execution.status)) {
            return {
                ok: false,
                status: 409,
                code: 'EXECUTION_ALREADY_FINISHED',
                message: 'Cette exécution est déjà terminée.'
            };
        }

        const running = this.running.get(executionId);
        const updated = await updatePlanningExecution(executionId, userId, {
            status: 'STOP_REQUESTED',
            stopRequestedAt: new Date()
        });
        if (updated) {
            if (running) {
                running.currentStatus = updated.status;
            }
            this.emit({ type: 'execution', execution: updated });
            await this.log(executionId, 'info', 'system', 'Arrêt demandé par l’utilisateur.', 'STOP_REQUESTED');
        }

        if (!running?.process) {
            const stopped = await updatePlanningExecution(executionId, userId, {
                status: 'UNKNOWN',
                endedAt: new Date(),
                errorMessage: 'Le processus MiniZinc n’est plus attaché à ce serveur.'
            });
            if (stopped) {
                this.emit({ type: 'done', execution: stopped, bestSolution: null });
                return { ok: true, execution: stopped };
            }
            return { ok: true, execution };
        }

        running.stopRequested = true;
        running.process.kill('SIGTERM');
        running.killTimer = setTimeout(() => {
            const current = this.running.get(executionId);
            if (!current?.process || current.process.exitCode !== null) {
                return;
            }
            void updatePlanningExecution(executionId, userId, { status: 'STOPPING' })
                .then(next => {
                    if (next) {
                        const stillRunning = this.running.get(executionId);
                        if (stillRunning) {
                            stillRunning.currentStatus = next.status;
                        }
                        this.emit({ type: 'execution', execution: next });
                    }
                });
            void this.log(executionId, 'warning', 'system', 'MiniZinc ne s’est pas arrêté après SIGTERM; envoi de SIGKILL.', 'STOPPING');
            current.process.kill('SIGKILL');
        }, 5_000);

        return { ok: true, execution: updated ?? execution };
    }

    subscribe(executionId: string, listener: (event: MiniZincExecutionEvent) => void): () => void {
        const eventName = this.eventName(executionId);
        this.emitter.on(eventName, listener);
        return () => {
            this.emitter.off(eventName, listener);
        };
    }

    private async run(executionId: string, requestedTimeLimitSeconds?: number): Promise<void> {
        const running = this.running.get(executionId);
        if (!running) {
            return;
        }

        try {
            const started = await updatePlanningExecution(executionId, running.userId, {
                status: 'RUNNING',
                startedAt: new Date()
            });
            if (started) {
                running.currentStatus = started.status;
                this.emit({ type: 'execution', execution: started });
            }
            await this.log(executionId, 'info', 'system', `Démarrage MiniZinc avec le solveur ${running.solver}.`, 'RUNNING');

            const prepared = await prepareMiniZincModel(running.source);
            if (!prepared.ok) {
                await this.failBeforeSpawn(executionId, running, prepared.error.message, prepared.error.details);
                rmSync(prepared.tmpDir, { recursive: true, force: true });
                return;
            }

            running.tmpDir = prepared.tmpDir;
            const args = buildMiniZincArgs({
                solver: running.solver,
                mznPath: prepared.mznPath,
                timeLimitSeconds: requestedTimeLimitSeconds
            });
            await this.log(executionId, 'info', 'system', `Commande: minizinc ${args.join(' ')}`, 'RUNNING');

            const child = spawn('minizinc', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            running.process = child;

            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');

            child.stdout.on('data', (chunk: string) => {
                void this.handleStdout(executionId, chunk);
            });
            child.stderr.on('data', (chunk: string) => {
                void this.handleStderr(executionId, chunk);
            });
            child.on('error', error => {
                void this.log(executionId, 'error', 'process', error.message, 'FAILED');
            });
            child.on('close', (code, signal) => {
                void this.finish(executionId, code, signal);
            });
        } catch (error) {
            await this.finishWithFailure(
                executionId,
                error instanceof Error ? error.message : 'Erreur inattendue pendant l’exécution MiniZinc.'
            );
        }
    }

    private async failBeforeSpawn(executionId: string, running: RunningExecution, message: string, details: string[]): Promise<void> {
        await this.log(executionId, 'error', 'system', [message, ...details].join('\n'), 'FAILED');
        const failed = await updatePlanningExecution(executionId, running.userId, {
            status: 'FAILED',
            endedAt: new Date(),
            errorMessage: message
        });
        await updatePlanning(running.planning.id, running.userId, {
            status: 'error',
            lastError: {
                message,
                details
            }
        });
        if (failed) {
            this.emit({ type: 'done', execution: failed, bestSolution: null });
        }
        this.running.delete(executionId);
    }

    private async handleStdout(executionId: string, chunk: string): Promise<void> {
        const running = this.running.get(executionId);
        if (!running) {
            return;
        }

        await this.log(executionId, 'stdout', 'stdout', chunk, running.currentStatus);
        const events = running.stdoutParser.push(chunk);
        for (const event of events) {
            await this.handleStdoutEvent(executionId, running, event);
        }
    }

    private async handleStderr(executionId: string, chunk: string): Promise<void> {
        const running = this.running.get(executionId);
        if (!running) {
            return;
        }

        const lines = running.stderrParser.push(chunk);
        for (const line of lines) {
            const level = isWarningLike(line.message) ? 'warning' : line.level;
            await this.log(executionId, level, 'stderr', line.message, running.currentStatus);
            if (level === 'warning') {
                running.warnings.push(line.message);
            }
        }
    }

    private async handleStdoutEvent(executionId: string, running: RunningExecution, event: MiniZincStdoutEvent): Promise<void> {
        if (event.type === 'optimal') {
            running.sawOptimal = true;
            await this.log(executionId, 'info', 'stdout', 'Optimalité prouvée par MiniZinc.', running.currentStatus);
            return;
        }

        if (event.type === 'status') {
            if (event.status.status === 'UNSATISFIABLE') {
                running.sawUnsat = true;
                const execution = await updatePlanningExecution(executionId, running.userId, { status: 'UNSATISFIABLE' });
                if (execution) {
                    running.currentStatus = execution.status;
                    this.emit({ type: 'execution', execution });
                }
            } else {
                running.sawUnknown = true;
            }
            await this.log(executionId, 'info', 'stdout', event.status.rawOutput, event.status.status);
            return;
        }

        await this.saveSolutionBlock(executionId, running, event.block);
    }

    private async saveSolutionBlock(executionId: string, running: RunningExecution, block: MiniZincSolutionBlock): Promise<void> {
        if (block.marker === 'optimal') {
            running.sawOptimal = true;
        }

        if (!hasPlanningSolutionLines(block.rawOutput)) {
            await this.log(executionId, 'warning', 'decoder', 'Bloc stdout MiniZinc non décodable ignoré comme solution.', running.currentStatus);
            await this.log(executionId, 'stdout', 'stdout', block.rawOutput, running.currentStatus);
            return;
        }

        let decodedSolutionJson: unknown;
        let reportJson: unknown;
        try {
            const rawData = running.planning.data as Record<string, unknown> | undefined;
            const days: string[] = (rawData?.time as Record<string, unknown> | undefined)?.days as string[] ?? [];
            const slotsPerDay: number = (rawData?.time as Record<string, unknown> | undefined)?.slotsPerDay as number ?? 0;
            const activities = parseSolutionOutput(block.rawOutput, days, slotsPerDay);
            if (activities.length === 0) {
                throw new Error('Aucune ligne ACTIVITY exploitable dans cette solution.');
            }
            decodedSolutionJson = { activities };
            reportJson = buildPlanningReportFromOutput(running.planning, block.rawOutput, running.warnings);
        } catch (error) {
            const decodeError = error instanceof Error ? error.message : 'Décodage impossible.';
            await this.log(executionId, 'error', 'decoder', `Bloc MiniZinc non décodable ignoré: ${decodeError}`, running.currentStatus);
            await this.log(executionId, 'stdout', 'stdout', block.rawOutput, running.currentStatus);
            return;
        }

        running.solutionCount += 1;

        const nextStatus: PlanningExecutionStatus = running.solutionCount === 1 ? 'SOLUTION_FOUND' : 'OPTIMIZING';
        const execution = await updatePlanningExecution(executionId, running.userId, { status: nextStatus });
        if (execution) {
            running.currentStatus = execution.status;
            this.emit({ type: 'execution', execution });
        }

        const solution = await createPlanningSolutionVersion(running.userId, {
            planningId: running.planning.id,
            executionId,
            solver: running.solver,
            sourceSnapshot: running.source,
            solutionOutput: block.rawOutput,
            solutionWarnings: Array.from(new Set(running.warnings)),
            rawOutput: block.rawOutput,
            objectiveValue: block.objectiveValue,
            decodedSolutionJson,
            reportJson,
            solveTimeMs: Date.now() - running.startedAt
        });

        await this.log(executionId, 'solution', 'stdout', `Solution #${solution.versionNumber ?? running.solutionCount} sauvegardée.`, nextStatus);
        this.emit({ type: 'solution', solution });

        if (solution.status === 'BEST_CURRENT') {
            await updatePlanning(running.planning.id, running.userId, {
                status: 'active',
                solutionOutput: solution.solutionOutput,
                solutionWarnings: solution.solutionWarnings,
                solutionSolveTimeMs: solution.solveTimeMs ?? null,
                lastError: null
            });
        }
    }

    private async finish(executionId: string, code: number | null, signal: NodeJS.Signals | null): Promise<void> {
        const running = this.running.get(executionId);
        if (!running) {
            return;
        }

        if (running.killTimer) {
            clearTimeout(running.killTimer);
        }

        for (const line of running.stderrParser.flush()) {
            const level = isWarningLike(line.message) ? 'warning' : line.level;
            await this.log(executionId, level, 'stderr', line.message, running.currentStatus);
            if (level === 'warning') {
                running.warnings.push(line.message);
            }
        }

        for (const event of running.stdoutParser.flush()) {
            await this.handleStdoutEvent(executionId, running, event);
        }

        const status = this.computeFinalStatus(running, code);
        const errorMessage = status === 'FAILED'
            ? `MiniZinc a terminé avec le code ${code ?? 'n/a'}${signal ? ` (signal ${signal})` : ''}.`
            : status === 'UNKNOWN'
                ? 'MiniZinc a terminé sans statut exploitable.'
                : null;

        const bestSolution = await finalizePlanningExecutionSolutions(running.userId, executionId, status);
        const finished = await updatePlanningExecution(executionId, running.userId, {
            status,
            endedAt: new Date(),
            stoppedAt: status === 'STOPPED' ? new Date() : null,
            exitCode: code,
            errorMessage
        });

        if (bestSolution && (status === 'OPTIMAL' || status === 'COMPLETED' || status === 'STOPPED')) {
            await updatePlanning(running.planning.id, running.userId, {
                status: 'done',
                currentStep: running.planning.totalSteps,
                progress: 100,
                solutionOutput: bestSolution.solutionOutput,
                solutionWarnings: bestSolution.solutionWarnings,
                solutionSolveTimeMs: bestSolution.solveTimeMs ?? null,
                lastError: null
            });
        } else if (!bestSolution && (status === 'FAILED' || status === 'UNSATISFIABLE' || status === 'UNKNOWN')) {
            await updatePlanning(running.planning.id, running.userId, {
                status: 'error',
                lastError: {
                    message: errorMessage ?? (status === 'UNSATISFIABLE' ? 'Aucune solution réalisable n’a été trouvée.' : 'MiniZinc n’a pas produit de solution exploitable.'),
                    details: Array.from(new Set(running.warnings))
                }
            });
        }

        await this.log(executionId, status === 'FAILED' ? 'error' : 'info', 'system', `Exécution terminée: ${status}.`, status);

        if (finished) {
            this.emit({ type: 'done', execution: finished, bestSolution });
        }

        if (running.tmpDir) {
            rmSync(running.tmpDir, { recursive: true, force: true });
        }
        this.running.delete(executionId);
    }

    private async finishWithFailure(executionId: string, message: string): Promise<void> {
        const running = this.running.get(executionId);
        if (!running) {
            return;
        }

        await this.log(executionId, 'error', 'system', message, 'FAILED');
        const failed = await updatePlanningExecution(executionId, running.userId, {
            status: 'FAILED',
            endedAt: new Date(),
            errorMessage: message
        });
        if (failed) {
            this.emit({ type: 'done', execution: failed, bestSolution: null });
        }
        if (running.tmpDir) {
            rmSync(running.tmpDir, { recursive: true, force: true });
        }
        this.running.delete(executionId);
    }

    private computeFinalStatus(running: RunningExecution, code: number | null): PlanningExecutionStatus {
        if (running.stopRequested) {
            return 'STOPPED';
        }
        if (running.sawUnsat) {
            return 'UNSATISFIABLE';
        }
        if (code !== 0) {
            return 'FAILED';
        }
        if (running.sawOptimal && running.solutionCount > 0) {
            return 'OPTIMAL';
        }
        if (running.sawUnknown) {
            return 'UNKNOWN';
        }
        if (running.solutionCount > 0) {
            return 'COMPLETED';
        }
        return 'UNKNOWN';
    }

    private async log(
        executionId: string,
        level: PlanningExecutionLogRecord['level'],
        stream: string,
        message: string,
        executionStatus: PlanningExecutionStatus
    ): Promise<PlanningExecutionLogRecord | null> {
        try {
            const log = await appendPlanningExecutionLog({
                executionId,
                level,
                stream,
                message,
                executionStatus
            });
            this.emit({ type: 'log', log });
            return log;
        } catch (error) {
            console.error('Unable to persist MiniZinc log:', error);
            return null;
        }
    }

    private emit(event: MiniZincExecutionEvent): void {
        const executionId = event.type === 'solution'
            ? event.solution.executionId
            : event.type === 'log'
                ? event.log.executionId
                : event.execution.id;
        if (!executionId) {
            return;
        }
        this.emitter.emit(this.eventName(executionId), event);
    }

    private eventName(executionId: string): string {
        return `execution:${executionId}`;
    }
}
