import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createPlanningSpecServices } from 'planning-spec-language';
import { env } from './env.js';

const execFileAsync = promisify(execFile);

const { shared, PlanningSpec } = createPlanningSpecServices({
    fileSystemProvider: NodeFileSystem.fileSystemProvider
});

const generator = PlanningSpec.generator.Generator;

export interface SolveSuccess {
    output: string;
    warnings: string[];
    solveTimeMs: number;
}

export interface SourceIssue {
    severity: 'error' | 'warning';
    message: string;
    line?: number;
    column?: number;
}

export interface SolveFailure {
    status: number;
    code: string;
    message: string;
    details: string[];
    hint?: string;
}

function formatDiagnostics(diagnostics: Array<{ message: string; range?: { start: { line: number; character: number } } }> | undefined): string[] {
    return (diagnostics ?? []).map(diagnostic => {
        const line = diagnostic.range?.start.line;
        const column = diagnostic.range?.start.character;
        if (line === undefined || column === undefined) {
            return diagnostic.message;
        }
        return `L${line + 1}:C${column + 1} - ${diagnostic.message}`;
    });
}

function toWarnings(stderr: string | undefined): string[] {
    return (stderr ?? '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

function isUnsatisfiableOutput(stdout: string): boolean {
    const normalized = stdout.toUpperCase();
    return normalized.includes('UNSATISFIABLE');
}

async function analyzePlanningSource(source: string): Promise<{ ok: true; document: unknown; tmpDir: string } | { ok: false; error: SolveFailure; tmpDir: string }> {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'planning-spec-'));

    try {
        const srcPath = path.join(tmpDir, 'model.planning');
        writeFileSync(srcPath, source, 'utf-8');

        const uri = URI.file(srcPath);
        const document = await shared.workspace.LangiumDocumentFactory.fromString(source, uri);
        await shared.workspace.DocumentBuilder.build([document], { validation: true });

        const parserErrors = document.parseResult.parserErrors.map((error: { message: string }) => error.message);
        const diagnostics = formatDiagnostics(document.diagnostics as Array<{ message: string; range?: { start: { line: number; character: number } } }> | undefined);
        const issues = [...parserErrors, ...diagnostics];

        if (issues.length > 0) {
            return {
                ok: false,
                error: {
                    status: 422,
                    code: 'VALIDATION_ERROR',
                    message: 'Le modèle contient des erreurs de validation.',
                    details: issues,
                    hint: 'Corrige les champs signalés puis relance la résolution.'
                },
                tmpDir
            };
        }

        return {
            ok: true,
            document,
            tmpDir
        };
    } catch (error) {
        const maybeError = error as Error & { code?: string; stderr?: string; stdout?: string };
        const details = [
            maybeError.message,
            ...(maybeError.stderr ? toWarnings(maybeError.stderr) : []),
            ...(maybeError.stdout ? toWarnings(maybeError.stdout) : [])
        ].filter(Boolean);

        return {
            ok: false,
            error: {
                status: 422,
                code: 'SOLVER_ERROR',
                message: 'Le solveur n’a pas pu produire de résultat pour cette planification.',
                details,
                hint: 'Vérifie les contraintes, les rôles et les affectations, puis soumets à nouveau.'
            },
            tmpDir
        };
    }
}

function parseIssueLine(detail: string): { line?: number; column?: number; message: string } {
    const match = /^L(\d+):C(\d+)\s*-\s*(.+)$/.exec(detail);
    if (!match) {
        return { message: detail };
    }

    return {
        line: Number(match[1]),
        column: Number(match[2]),
        message: match[3]
    };
}

export async function validatePlanningSource(source: string): Promise<{ ok: true; issues: SourceIssue[] } | { ok: false; error: SolveFailure; issues: SourceIssue[] }> {
    const analysis = await analyzePlanningSource(source);

    if (!analysis.ok) {
        rmSync(analysis.tmpDir, { recursive: true, force: true });
        const issues = analysis.error.details.map(detail => {
            const parsed = parseIssueLine(detail);
            return {
                severity: 'error' as const,
                message: parsed.message,
                line: parsed.line,
                column: parsed.column
            };
        });

        return {
            ok: false,
            error: analysis.error,
            issues
        };
    }

    rmSync(analysis.tmpDir, { recursive: true, force: true });
    return {
        ok: true,
        issues: []
    };
}

export async function solvePlanningSource(source: string, solver: string): Promise<{ ok: true; result: SolveSuccess } | { ok: false; error: SolveFailure }> {
    const analysis = await analyzePlanningSource(source);

    if (!analysis.ok) {
        rmSync(analysis.tmpDir, { recursive: true, force: true });
        return {
            ok: false,
            error: analysis.error
        };
    }

    try {
        // Preferences add soft constraints that require minimisation — enforce a higher floor.
        const hasPreferences = /preferences\s*\[\s*\{/.test(source);
        const timeoutMs = hasPreferences
            ? Math.max(env.solverTimeoutMs, 600_000)   // at least 10 min with preferences
            : Math.max(env.solverTimeoutMs, 480_000);  // at least 8 min without

        const mznPath = generator.generateToFile(analysis.document as never, analysis.tmpDir);
        const t0 = Date.now();
        const { stdout, stderr } = await execFileAsync(
            'minizinc',
            ['--solver', solver, '--time-limit', String(timeoutMs), mznPath],
            { maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs + 5_000 }
        );
        const solveTimeMs = Date.now() - t0;

        const trimmedOutput = stdout.trim();
        const warnings = toWarnings(stderr);

        if (isUnsatisfiableOutput(trimmedOutput)) {
            return {
                ok: false,
                error: {
                    status: 422,
                    code: 'UNSATISFIABLE',
                    message: 'Aucune solution réalisable n’a été trouvée pour cette planification.',
                    details: [
                        'Le solveur MiniZinc a conclu que le modèle est insatisfiable.',
                        ...warnings
                    ],
                    hint: 'Vérifie les capacités disponibles, les cardinalités par rôle et les contraintes d’exclusivité.'
                }
            };
        }

        return {
            ok: true,
            result: {
                output: trimmedOutput,
                warnings,
                solveTimeMs
            }
        };
    } catch (error) {
        const maybeError = error as Error & { code?: string; stderr?: string; stdout?: string };
        if (maybeError.code === 'ENOENT') {
            return {
                ok: false,
                error: {
                    status: 500,
                    code: 'SOLVER_NOT_AVAILABLE',
                    message: 'MiniZinc est introuvable sur le serveur.',
                    details: ['L’exécutable `minizinc` n’a pas été trouvé dans le PATH du serveur.'],
                    hint: 'Installe MiniZinc sur le serveur avant de relancer la résolution.'
                }
            };
        }

        const details = [
            maybeError.message,
            ...(maybeError.stderr ? toWarnings(maybeError.stderr) : []),
            ...(maybeError.stdout ? toWarnings(maybeError.stdout) : [])
        ].filter(Boolean);

        return {
            ok: false,
            error: {
                status: 422,
                code: 'SOLVER_ERROR',
                message: 'Le solveur n’a pas pu produire de résultat pour cette planification.',
                details,
                hint: 'Vérifie les contraintes, les rôles et les affectations, puis soumets à nouveau.'
            }
        };
    } finally {
        // rmSync(analysis.tmpDir, { recursive: true, force: true });
    }
}
