import cors from 'cors';
import express from 'express';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { promisify } from 'node:util';

import {
    createPlanning,
    createPlanningSolutionVersion,
    createProject,
    createSession,
    createTagDefinition,
    createUser,
    deletePlanningSolutionVersion,
    deleteExpiredSessions,
    deletePlanning,
    deleteProject,
    deleteSessionByTokenHash,
    deleteTagDefinition,
    getAuthUserByEmail,
    getPlanningById,
    getLatestPlanningExecution,
    getPlanningExecutionById,
    getPlanningSolutionVersionById,
    getProjectById,
    getSessionByTokenHash,
    initializeDatabase,
    listPlanningExecutionLogs,
    listPlanningExecutions,
    listPlanningSolutionVersions,
    listPlanningSolutions,
    listPlannings,
    listProjects,
    listTagDefinitions,
    markOrphanedPlanningExecutionsUnknown,
    pingDatabase,
    refreshSessionExpiryByTokenHash,
    updatePlanning,
    updatePlanningSolutionVersionStatus,
    updateProject,
    updateUser,
    type AuthSessionRecord,
    type Badge,
    type PlanStatus,
    type PlanningInput,
    type PlanningRecord,
    type PlanningSolutionVersionRecord,
    type PlanningUpdateInput,
    type ProjectInput,
    type ProjectStatus,
    type ProjectUpdateInput,
    type TagDefinitionInput,
    type UserRecord,
    type UserUpdateInput
} from './db.js';
import { createSessionToken, hashPassword, hashSessionToken, normalizeEmail, verifyPassword } from './auth.js';
import { env } from './env.js';
import { MiniZincExecutionService, type MiniZincExecutionEvent } from './minizinc-execution-service.js';
import { buildPlanningReport, buildPlanningReportFromOutput, generateMarkdown, generatePrintHTML, type PlanningReport } from './report.js';
import { solvePlanningSource, validatePlanningSource } from './solver.js';

// ---------------------------------------------------------------------------
// Détection des solveurs MiniZinc disponibles
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);
const OPTAPLANNER_SOLVER_ID = 'OptaPlanner';
const OPTAPLANNER_SOLVER_LABEL = 'OptaPlanner';

export interface AvailableSolver {
    id: string;       // identifiant technique exact MiniZinc (ex: "HiGHS" ou "Chuffed")
    label: string;    // nom lisible (ex: "HiGHS (défaut)")
    isDefault: boolean;
    key?: string;     // identifiant normalisé côté API (ex: "highs")
    aliases?: string[];
}

interface KnownMiniZincSolver {
    key: string;
    label: string;
    preferredId: string;
    patterns: string[];
    aliases: string[];
}

// Solveurs connus adaptés à la planification. Les ids réels peuvent varier
// selon MiniZinc; le backend garde l'id exact détecté puis accepte ces alias.
const KNOWN_MINIZINC_SOLVERS: KnownMiniZincSolver[] = [
    { key: "highs", label: "HiGHS", preferredId: "HiGHS", patterns: ["highs", "high"], aliases: ["highs", "high", "HiGHS", "Highs"] },
    { key: "gecode", label: "Gecode", preferredId: "Gecode", patterns: ["gecode"], aliases: ["gecode", "Gecode"] },
    { key: "chuffed", label: "Chuffed", preferredId: "Chuffed", patterns: ["chuffed"], aliases: ["chuffed", "Chuffed"] },
    { key: "cplex", label: "CPLEX", preferredId: "CPLEX", patterns: ["cplex"], aliases: ["cplex", "CPLEX"] },
    { key: "ortools", label: "OR-Tools", preferredId: "OR-Tools", patterns: ["or tools", "ortools", "cp-sat", "cpsat"], aliases: ["or-tools", "ortools", "cp-sat", "cpsat", "OR-Tools"] },
    { key: "coinbc", label: "COIN-BC", preferredId: "COIN-BC", patterns: ["coinbc", "coin-bc", "cbc"], aliases: ["coinbc", "coin-bc", "cbc", "COIN-BC"] },
    { key: "sat4j", label: "SAT4J", preferredId: "SAT4J", patterns: ["sat4j"], aliases: ["sat4j", "SAT4J"] }
];

let cachedSolvers: AvailableSolver[] = [
    { id: env.solver, label: `${env.solver} (défaut)`, isDefault: true, key: normalizeSolverKey(env.solver), aliases: [env.solver] }
];

function compactSolverToken(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findKnownMiniZincSolver(value: string): KnownMiniZincSolver | null {
    const lower = value.trim().toLowerCase();
    const compact = compactSolverToken(value);

    return KNOWN_MINIZINC_SOLVERS.find(solver =>
        solver.aliases.some(alias => compactSolverToken(alias) === compact)
        || solver.patterns.some(pattern =>
            lower.includes(pattern)
            || compact.includes(compactSolverToken(pattern))
        )
    ) ?? null;
}

function normalizeSolverKey(value: string): string {
    const known = findKnownMiniZincSolver(value);
    return known?.key ?? compactSolverToken(value);
}

function isOptaPlannerSolverRequest(value: string): boolean {
    return compactSolverToken(value) === compactSolverToken(OPTAPLANNER_SOLVER_ID)
        || compactSolverToken(value) === 'opta'
        || compactSolverToken(value) === 'optaplanner';
}

function miniZincSolverOptions(): AvailableSolver[] {
    return cachedSolvers.filter(solver => !isOptaPlannerSolverRequest(solver.id));
}

function resolveMiniZincSolverOption(requested?: string): AvailableSolver | null {
    const raw = (requested && requested.trim().length > 0) ? requested.trim() : env.solver;
    const requestedCompact = compactSolverToken(raw);
    const requestedKey = normalizeSolverKey(raw);

    return miniZincSolverOptions().find(solver =>
        compactSolverToken(solver.id) === requestedCompact
        || normalizeSolverKey(solver.id) === requestedKey
        || (solver.key ? solver.key === requestedKey : false)
        || (solver.aliases ?? []).some(alias => compactSolverToken(alias) === requestedCompact || normalizeSolverKey(alias) === requestedKey)
    ) ?? null;
}

function resolveAnySolverOption(requested?: string): AvailableSolver | null {
    const raw = requested?.trim();
    if (raw && isOptaPlannerSolverRequest(raw)) {
        return cachedSolvers.find(solver => solver.id === OPTAPLANNER_SOLVER_ID) ?? null;
    }

    return resolveMiniZincSolverOption(raw);
}

function availableMiniZincSolverDetails(): Array<{ id: string; key: string; label: string; isDefault: boolean; aliases: string[] }> {
    return miniZincSolverOptions().map(solver => ({
        id: solver.id,
        key: solver.key ?? normalizeSolverKey(solver.id),
        label: solver.label.replace(/\s+\(défaut\)$/u, ''),
        isDefault: solver.isDefault,
        aliases: solver.aliases ?? [solver.id]
    }));
}

function unavailableSolverDetails(): string[] {
    return [
        `Solveurs MiniZinc disponibles: ${miniZincSolverOptions().map(s => `${s.id}${s.key ? ` (${s.key})` : ''}`).join(', ') || 'aucun'}`,
        `Solveurs applicatifs disponibles: ${cachedSolvers.map(s => s.id).join(', ') || 'aucun'}`
    ];
}

interface OptaPlannerHealthState {
    isUp: boolean;
    lastCheckedAt: string | null;
    url: string;
    message: string;
}

let optaPlannerHealth: OptaPlannerHealthState = {
    isUp: false,
    lastCheckedAt: null,
    url: env.optaPlannerUrl,
    message: 'Non vérifié'
};

interface SpringSolveAssignment {
    activityInstance?: string;
    day?: string;
    slotInDay?: number;
    globalSlot?: number;
    roles?: Record<string, unknown>;
}

interface SpringSolveResult {
    status?: string;
    sourceName?: string;
    score?: string;
    hardScore?: number;
    softScore?: number;
    penalty?: number;
    objectiveValue?: number;
    hardPenalty?: number;
    softPenalty?: number;
    constraintsSatisfied?: boolean;
    preferencesSatisfied?: boolean;
    objectiveLine?: string;
    solvingTimeMillis?: number;
    elapsedMillis?: number;
    solveTimeMs?: number;
    elapsedMs?: number;
    assignments?: SpringSolveAssignment[];
    hardViolations?: Array<{ message?: string }>;
    softViolations?: Array<{ message?: string }>;
    warnings?: string[];
    notes?: string[];
}

interface SpringAsyncSolveStatus {
    jobId?: string;
    sourceName?: string;
    timeLimitSeconds?: number | null;
    status?: string;
    stopRequested?: boolean;
    terminal?: boolean;
    createdAtMillis?: number;
    startedAtMillis?: number;
    finishedAtMillis?: number;
    bestSolutionCount?: number;
    bestScore?: string;
    bestPenalty?: number | null;
    bestHardPenalty?: number | null;
    bestSoftPenalty?: number | null;
    constraintsSatisfied?: boolean | null;
    preferencesSatisfied?: boolean | null;
    result?: SpringSolveResult;
    feasibleSolutions?: SpringSolveResult[];
    errorMessage?: string;
}

interface OptaPlannerAsyncSession {
    jobId: string;
    planningId: string;
    userId: string;
    solver: string;
    source: string;
    daysForOutput: string[];
    capacityWarnings: string[];
    createdAt: number;
    savedSolutionCount: number;
    savedSolutionBySignature: Map<string, PlanningSolutionVersionRecord>;
    finalized: boolean;
    finalizing: boolean;
    finalStatus: 'done' | 'error' | null;
    finalPayload?: {
        planning: PlanningRecord;
        output: string;
        warnings: string[];
        solveTimeMs: number;
    };
    finalError?: ApiErrorPayload;
}

interface HttpRequestResult {
    statusCode: number;
    body: string;
}

const optaPlannerAsyncSessions = new Map<string, OptaPlannerAsyncSession>();
const OPTAPLANNER_NON_OPTIMAL_WARNING =
    'OptaPlanner retourne la meilleure solution trouvée; l’optimalité globale n’est pas prouvée.';

interface OptaLivePreview {
    output: string;
    warnings: string[];
    solveTimeMs: number;
    feasible: boolean;
    hardScore: number | null;
    objectiveValue?: number;
    penalty?: number;
    hardPenalty?: number;
    softPenalty?: number;
    constraintsSatisfied?: boolean;
    preferencesSatisfied?: boolean;
}

function ensureOptaPlannerSolverOption(): void {
    const alreadyPresent = cachedSolvers.some(s => s.id === OPTAPLANNER_SOLVER_ID);
    if (optaPlannerHealth.isUp && !alreadyPresent) {
        cachedSolvers.push({
            id: OPTAPLANNER_SOLVER_ID,
            label: OPTAPLANNER_SOLVER_LABEL,
            isDefault: false,
            key: 'optaplanner',
            aliases: ['opta', 'optaplanner', OPTAPLANNER_SOLVER_ID]
        });
    }
    if (!optaPlannerHealth.isUp && alreadyPresent) {
        cachedSolvers = cachedSolvers.filter(s => s.id !== OPTAPLANNER_SOLVER_ID);
    }
}

function requestHttpJson(
    method: 'GET' | 'POST',
    urlString: string,
    timeoutMs?: number,
    body?: string,
    contentType = 'application/json'
): Promise<HttpRequestResult> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(urlString);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;

        const req = transport.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
            path: `${parsed.pathname}${parsed.search}`,
            method,
            headers: {
                Accept: 'application/json',
                ...(body ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) } : {})
            }
        }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode ?? 500,
                    body: data
                });
            });
        });

        req.on('error', reject);
        if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
            const safeTimeoutMs = Math.floor(timeoutMs);
            req.setTimeout(safeTimeoutMs, () => {
                req.destroy(new Error(`Timeout after ${safeTimeoutMs} ms`));
            });
        }

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function detectAvailableSolvers(): Promise<void> {
    try {
        const { stdout } = await execFileAsync(env.minizinc.path, ["--solvers-json"], { timeout: 10_000 });
        const raw: Array<{ id?: string; name?: string; version?: string }> = JSON.parse(stdout);

        const detected: AvailableSolver[] = [];
        const defaultKey = normalizeSolverKey(env.solver);
        const defaultCompact = compactSolverToken(env.solver);

        for (const entry of raw) {
            const exactId = (entry.id ?? entry.name ?? '').trim();
            if (!exactId) {
                continue;
            }

            const searchStr = `${entry.id ?? ''} ${entry.name ?? ''}`;
            const known = findKnownMiniZincSolver(searchStr);
            const key = known?.key ?? normalizeSolverKey(exactId);
            const label = known?.label ?? entry.name ?? exactId;
            const aliases = known
                ? Array.from(new Set([known.preferredId, ...known.aliases, exactId, entry.name ?? exactId]))
                : Array.from(new Set([exactId, entry.name ?? exactId, key]));

            const alreadyAdded = detected.some(solver =>
                solver.key === key
                || compactSolverToken(solver.id) === compactSolverToken(exactId)
            );
            if (alreadyAdded) {
                continue;
            }

            detected.push({
                id: exactId,
                key,
                aliases,
                label,
                isDefault: false
            });
        }

        if (detected.length > 0) {
            let defaultFound = false;
            cachedSolvers = detected.map(solver => {
                const isDefault = !defaultFound && (
                    solver.key === defaultKey
                    || compactSolverToken(solver.id) === defaultCompact
                    || (solver.aliases ?? []).some(alias =>
                        normalizeSolverKey(alias) === defaultKey
                        || compactSolverToken(alias) === defaultCompact
                    )
                );
                if (isDefault) {
                    defaultFound = true;
                }
                return {
                    ...solver,
                    isDefault,
                    label: isDefault ? `${solver.label} (défaut)` : solver.label
                };
            });

            if (!defaultFound) {
                console.warn(`Le solveur MiniZinc par défaut "${env.solver}" n'a pas été détecté.`);
            }
        }

        console.log(`Solveurs détectés : ${cachedSolvers.map(s => s.label).join(', ')}`);
    } catch {
        console.warn('Impossible de détecter les solveurs MiniZinc — utilisation du solveur par défaut.');
    }
}

async function detectOptaPlannerHealthAtStartup(): Promise<void> {
    const healthUrl = `${env.optaPlannerUrl.replace(/\/$/, '')}/api/planning/health`;
    try {
        const response = await requestHttpJson('GET', healthUrl, 5_000);
        if (response.statusCode >= 200 && response.statusCode < 300) {
            const body = JSON.parse(response.body) as { status?: string; service?: string };
            const isUp = body.status === 'UP';
            optaPlannerHealth = {
                isUp,
                lastCheckedAt: new Date().toISOString(),
                url: env.optaPlannerUrl,
                message: isUp
                    ? `Service détecté: ${body.service ?? 'planning-solver'}`
                    : `Réponse inattendue: status=${body.status ?? 'unknown'}`
            };
        } else {
            optaPlannerHealth = {
                isUp: false,
                lastCheckedAt: new Date().toISOString(),
                url: env.optaPlannerUrl,
                message: `HTTP ${response.statusCode}`
            };
        }
    } catch (error) {
        optaPlannerHealth = {
            isUp: false,
            lastCheckedAt: new Date().toISOString(),
            url: env.optaPlannerUrl,
            message: error instanceof Error ? error.message : 'Erreur de connexion'
        };
    } finally {
        ensureOptaPlannerSolverOption();
        if (optaPlannerHealth.isUp) {
            console.log(`OptaPlanner UP (${optaPlannerHealth.url})`);
        } else {
            console.warn(`OptaPlanner indisponible (${optaPlannerHealth.url}): ${optaPlannerHealth.message}`);
        }
    }
}

type ApiErrorCode =
    | 'AUTH_REQUIRED'
    | 'BAD_REQUEST'
    | 'CONFLICT'
    | 'DATABASE_ERROR'
    | 'FORBIDDEN'
    | 'INTERNAL_ERROR'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_SESSION'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR';

type FieldErrors = Record<string, string>;

interface ApiErrorPayload {
    code: ApiErrorCode | string;
    message: string;
    details?: string[];
    fieldErrors?: FieldErrors;
    hint?: string;
}

interface SolveReadyData {
    [key: string]: unknown;
    editorState?: Record<string, unknown>;
    time: {
        days: string[];
        slotsPerDay: number;
    };
    activities: Record<string, { count: number; duration: number }>;
    resources: Record<string, string[]>;
    roles: Record<string, Record<string, string>>;
    constraints: Array<Record<string, unknown>>;
    preferences: Array<Record<string, unknown>>;
}

interface PersistedPlanningData extends Record<string, unknown> {
    editorState?: Record<string, unknown>;
    dslSource?: string;
}

type SupportedConstraintType =
    | 'cardinality_per_activity'
    | 'resource_exclusivity'
    | 'fixed_assignment'
    | 'forbidden_assignment'
    | 'temporal_precedence'
    | 'time_window'
    | 'mandatory_roles'
    | 'instance_precedence'
    | 'required_resource'
    | 'resource_required_day'
    | 'resource_single_day';

type SupportedPreferenceType =
    | 'avoid_participation_on_date'
    | 'prefer_resource_on_date'
    | 'prefer_resource_single_day'
    | 'max_per_scope'
    | 'preferred_resource'
    | 'room_stability_for_role'
    | 'compact_schedule_for_role';

interface SessionPayload {
    token: string;
    expiresAt: string;
}

type AuthenticatedRequest = express.Request & {
    auth?: AuthSessionRecord;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMySqlDuplicateError(error: unknown): boolean {
    return isRecord(error) && error.code === "ER_DUP_ENTRY";
}

function sendSuccess<T>(res: express.Response, data: T, message?: string, status = 200): express.Response {
    return res.status(status).json({
        ok: true,
        message,
        data
    });
}

function sendError(res: express.Response, status: number, error: ApiErrorPayload): express.Response {
    return res.status(status).json({
        ok: false,
        error
    });
}

function normalizeSource(value: unknown): string | null {
    if (typeof value === "string" && value.trim().length > 0) {
        return value;
    }

    if (isRecord(value)) {
        return JSON.stringify(value, null, 2);
    }

    return null;
}

function parseSolverTimeLimitSecondsFromBody(body: unknown): number | undefined {
    if (!isRecord(body)) {
        return undefined;
    }
    const raw = body.solverTimeLimitSeconds;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return undefined;
    }
    return Math.max(1, Math.floor(raw));
}

function createEmptyPlanningData(): SolveReadyData {
    return {
        editorState: {
            description: '',
            priority: "medium",
            days: [],
            slotsPerDay: 4,
            startTime: "08:00",
            endTime: "18:00",
            slotDuration: 60,
            activities: [],
            resourceGroups: [],
            roles: [],
            constraints: [],
            preferences: []
        },
        time: { days: [], slotsPerDay: 0 },
        activities: {},
        resources: {},
        roles: {},
        constraints: [],
        preferences: []
    };
}

function getPersistedPlanningData(value: unknown): PersistedPlanningData {
    if (isRecord(value)) {
        return value as PersistedPlanningData;
    }

    return {};
}

function stripJsonComments(src: string): string {
    let out = '';
    let i = 0;
    while (i < src.length) {
        if (src[i] === '"') {
            out += src[i++];
            while (i < src.length) {
                if (src[i] === '\\') { out += src[i++]; if (i < src.length) out += src[i++]; continue; }
                if (src[i] === '"') { out += src[i++]; break; }
                out += src[i++];
            }
            continue;
        }
        if (src[i] === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }
        if (src[i] === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += src[i++];
    }
    return out;
}

function canonicalizePlanningSource(source: string): string {
    try {
        const parsed = JSON.parse(stripJsonComments(source));
        const validation = validatePlanningDataForSolve(parsed);
        if (validation.value) {
            return serializeSolveModelToDsl(validation.value);
        }
    } catch {
        // Keep original source when it is not valid JSON yet.
    }

    return source;
}

function stringifyDslValue(value: unknown): string {
    return JSON.stringify(value);
}

function stringifyDslObject(entries: Array<[string, string]>, indent = 0): string {
    const padding = " ".repeat(indent);
    const childPadding = " ".repeat(indent + 2);
    if (entries.length === 0) {
        return '{}';
    }

    return `{\n${entries.map(([key, val]) => `${childPadding}${stringifyDslValue(key)}: ${val}`).join(',\n')}\n${padding}}`;
}

function stringifyDslArray(values: string[], indent = 0): string {
    const padding = " ".repeat(indent);
    const childPadding = " ".repeat(indent + 2);
    if (values.length === 0) {
        return '[]';
    }

    return `[\n${values.map(value => `${childPadding}${value}`).join(',\n')}\n${padding}]`;
}

function serializeConstraintToDsl(constraint: Record<string, unknown>): string {
    const type = typeof constraint.type === "string" ? constraint.type : '';

    if (type === "cardinality_per_activity") {
        const entries: Array<[string, string]> = [
            ["type", stringifyDslValue(type)],
            ["activity", stringifyDslValue(constraint.activity)]
        ];

        if (typeof constraint.role === "string" && constraint.role.trim()) {
            entries.push(["role", stringifyDslValue(constraint.role)]);
        } else {
            entries.push(["target", stringifyDslValue(constraint.target)]);
        }

        entries.push(["min", String(constraint.min)]);
        entries.push(["max", String(constraint.max)]);
        return stringifyDslObject(entries, 4);
    }

    if (type === "resource_exclusivity") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resourceType", stringifyDslValue(constraint.resourceType)],
            ["activity", stringifyDslValue(constraint.activity)],
            ["scope", stringifyDslValue(constraint.scope)],
            ["max", String(constraint.max)]
        ], 4);
    }

    if (type === "fixed_assignment" || type === "forbidden_assignment") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activityInstance", stringifyDslValue(constraint.activityInstance)],
            ["role", stringifyDslValue(constraint.role)],
            ["resource", stringifyDslValue(constraint.resource)]
        ], 4);
    }

    if (type === "temporal_precedence") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["beforeActivity", stringifyDslValue(constraint.beforeActivity)],
            ["afterActivity", stringifyDslValue(constraint.afterActivity)]
        ], 4);
    }

    if (type === "time_window") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activityInstance", stringifyDslValue(constraint.activityInstance)],
            ["minSlot", String(constraint.minSlot)],
            ["maxSlot", String(constraint.maxSlot)]
        ], 4);
    }

    if (type === "mandatory_roles") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activity", stringifyDslValue(constraint.activity)]
        ], 4);
    }

    if (type === "instance_precedence") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["beforeActivityInstance", stringifyDslValue(constraint.beforeActivityInstance)],
            ["afterActivityInstance", stringifyDslValue(constraint.afterActivityInstance)]
        ], 4);
    }

    if (type === "required_resource") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activityInstance", stringifyDslValue(constraint.activityInstance)],
            ["resource", stringifyDslValue(constraint.resource)]
        ], 4);
    }

    if (type === "resource_required_day") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resource", stringifyDslValue(constraint.resource)],
            ["date", stringifyDslValue(constraint.date)]
        ], 4);
    }

    if (type === "resource_single_day") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resource", stringifyDslValue(constraint.resource)]
        ], 4);
    }

    const fallbackEntries = Object.entries(constraint)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, typeof value === "number" ? String(value) : stringifyDslValue(value)] as [string, string]);
    return stringifyDslObject(fallbackEntries, 4);
}

function serializePreferenceToDsl(preference: Record<string, unknown>): string {
    const type = typeof preference.type === "string" ? preference.type : '';

    if (type === "avoid_participation_on_date") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resource", stringifyDslValue(preference.resource)],
            ["date", stringifyDslValue(preference.date)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "prefer_resource_on_date") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resource", stringifyDslValue(preference.resource)],
            ["date", stringifyDslValue(preference.date)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "prefer_resource_single_day") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resource", stringifyDslValue(preference.resource)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "max_per_scope") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["resourceType", stringifyDslValue(preference.resourceType)],
            ["activity", stringifyDslValue(preference.activity)],
            ["scope", stringifyDslValue(preference.scope)],
            ["max", String(preference.max)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "preferred_resource") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activityInstance", stringifyDslValue(preference.activityInstance)],
            ["role", stringifyDslValue(preference.role)],
            ["resource", stringifyDslValue(preference.resource)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "room_stability_for_role") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activity", stringifyDslValue(preference.activity)],
            ["role", stringifyDslValue(preference.role)],
            ["roomResourceType", stringifyDslValue(preference.roomResourceType)],
            ["scope", stringifyDslValue(preference.scope)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    if (type === "compact_schedule_for_role") {
        return stringifyDslObject([
            ["type", stringifyDslValue(type)],
            ["activity", stringifyDslValue(preference.activity)],
            ["role", stringifyDslValue(preference.role)],
            ["scope", stringifyDslValue(preference.scope)],
            ["weight", String(preference.weight)]
        ], 4);
    }

    const fallbackEntries = Object.entries(preference)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, typeof value === "number" ? String(value) : stringifyDslValue(value)] as [string, string]);
    return stringifyDslObject(fallbackEntries, 4);
}

function serializeSolveModelToDsl(model: SolveReadyData): string {
    const timeBlock = stringifyDslObject([
        ["days", stringifyDslArray(model.time.days.map(day => stringifyDslValue(day)), 4)],
        ["slotsPerDay", String(model.time.slotsPerDay)]
    ], 2);

    const activitiesBlock = stringifyDslObject(
        Object.entries(model.activities).map(([activityName, config]) => ([
            activityName,
            stringifyDslObject([
                ["count", String(config.count)],
                ["duration", String(config.duration)]
            ], 4)
        ])),
        2
    );

    const resourcesBlock = stringifyDslObject(
        Object.entries(model.resources).map(([resourceType, instances]) => ([
            resourceType,
            stringifyDslArray(instances.map(instance => stringifyDslValue(instance)), 4)
        ])),
        2
    );

    const rolesBlock = stringifyDslObject(
        Object.entries(model.roles).map(([activityName, roleMap]) => ([
            activityName,
            stringifyDslObject(
                Object.entries(roleMap).map(([roleName, resourceType]) => [roleName, stringifyDslValue(resourceType)]),
                4
            )
        ])),
        2
    );

    const constraintsBlock = stringifyDslArray(model.constraints.map(constraint => serializeConstraintToDsl(constraint)), 2);
    const preferencesBlock = stringifyDslArray(model.preferences.map(preference => serializePreferenceToDsl(preference)), 2);

    return stringifyDslObject([
        ["time", timeBlock],
        ["activities", activitiesBlock],
        ["resources", resourcesBlock],
        ["roles", rolesBlock],
        ["constraints", constraintsBlock],
        ["preferences", preferencesBlock]
    ], 0);
}

function sanitizeProjectInput(body: unknown, partial = false): { value?: ProjectInput | ProjectUpdateInput; error?: ApiErrorPayload } {
    if (!isRecord(body)) {
        return {
            error: {
                code: "BAD_REQUEST",
                message: "Le corps de la requête projet est invalide.",
                details: ["Le backend attend un objet JSON contenant au moins le nom du projet."]
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const value: ProjectUpdateInput = {};

    if (!partial || body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : '';
        if (!name) {
            fieldErrors.name = "Le nom du projet est requis.";
        } else {
            value.name = name;
        }
    }

    if (!partial || body.description !== undefined) {
        value.description = typeof body.description === "string" ? body.description.trim() : '';
    }

    if (!partial || body.color !== undefined) {
        const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : "#38bdf8";
        value.color = color;
    }

    if (body.status !== undefined) {
        if (body.status === "active" || body.status === "archived" || body.status === "completed") {
            value.status = body.status as ProjectStatus;
        } else {
            fieldErrors.status = "Le statut du projet est invalide.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "Le projet contient des informations invalides.",
                fieldErrors,
                details: Object.values(fieldErrors),
                hint: "Corrige les champs signalés puis soumets à nouveau."
            }
        };
    }

    return {
        value: partial ? value : {
            name: value.name ?? '',
            description: value.description ?? '',
            color: value.color ?? '#38bdf8',
            status: value.status
        }
    };
}

function sanitizePlanningInput(body: unknown, partial = false): { value?: PlanningInput | PlanningUpdateInput; error?: ApiErrorPayload } {
    if (!isRecord(body)) {
        return {
            error: {
                code: "BAD_REQUEST",
                message: "Le corps de la requête planification est invalide.",
                details: ["Le backend attend un objet JSON contenant le titre et les données de l'éditeur."]
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const value: PlanningUpdateInput & { projectId?: string } = {};

    if (!partial || body.title !== undefined) {
        const title = typeof body.title === "string" ? body.title.trim() : '';
        if (!title) {
            fieldErrors.title = "Le titre de la planification est requis.";
        } else {
            value.title = title;
        }
    }

    // projectId is optional — plannings are standalone
    if (body.projectId !== undefined) {
        const projectId = typeof body.projectId === "string" ? body.projectId.trim() : '';
        if (projectId) {
            value.projectId = projectId;
        }
    }

    if (body.status !== undefined) {
        if (body.status === "draft" || body.status === "active" || body.status === "paused" || body.status === "done" || body.status === "error") {
            value.status = body.status as PlanStatus;
        } else {
            fieldErrors.status = "Le statut de la planification est invalide.";
        }
    }

    if (body.currentStep !== undefined) {
        const currentStep = Number(body.currentStep);
        if (!Number.isInteger(currentStep) || currentStep < 1) {
            fieldErrors.currentStep = "L'étape courante doit être un entier positif.";
        } else {
            value.currentStep = currentStep;
        }
    }

    if (body.totalSteps !== undefined) {
        const totalSteps = Number(body.totalSteps);
        if (!Number.isInteger(totalSteps) || totalSteps < 1) {
            fieldErrors.totalSteps = "Le nombre total d'étapes doit être un entier positif.";
        } else {
            value.totalSteps = totalSteps;
        }
    }

    if (body.progress !== undefined) {
        const progress = Number(body.progress);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
            fieldErrors.progress = "La progression doit être comprise entre 0 et 100.";
        } else {
            value.progress = progress;
        }
    }

    if (body.data !== undefined) {
        if (!isRecord(body.data)) {
            fieldErrors.data = "Les données de planification doivent être un objet JSON.";
        } else {
            value.data = body.data;
        }
    }

    if (body.badges !== undefined) {
        if (Array.isArray(body.badges)) {
            const badges: Badge[] = body.badges
                .filter((b): b is Record<string, unknown> => isRecord(b))
                .map(b => ({
                    id: typeof b.id === "string" ? b.id : randomUUID(),
                    name: typeof b.name === "string" ? b.name.trim() : '',
                    color: typeof b.color === "string" ? b.color : "#38bdf8",
                }))
                .filter(b => b.name.length > 0);
            value.badges = badges;
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "La planification contient des informations invalides.",
                fieldErrors,
                details: Object.values(fieldErrors),
                hint: "Corrige les champs signalés puis soumets à nouveau."
            }
        };
    }

    return {
        value: partial ? value : {
            title: value.title ?? '',
            projectId: value.projectId,
            status: value.status,
            currentStep: value.currentStep,
            totalSteps: value.totalSteps,
            progress: value.progress,
            data: value.data,
            badges: value.badges,
        }
    };
}

function sanitizeRegistrationInput(body: unknown): { value?: { name: string; email: string; password: string }; error?: ApiErrorPayload } {
    if (!isRecord(body)) {
        return {
            error: {
                code: "BAD_REQUEST",
                message: "Les informations de création de compte sont invalides."
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const name = typeof body.name === "string" ? body.name.trim() : '';
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : '';
    const password = typeof body.password === "string" ? body.password : '';

    if (!name) {
        fieldErrors.name = "Le nom complet est requis.";
    }
    if (!email || !email.includes('@')) {
        fieldErrors.email = "Une adresse email valide est requise.";
    }
    if (password.length < 8) {
        fieldErrors.password = "Le mot de passe doit contenir au moins 8 caractères.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "Impossible de créer le compte avec ces informations.",
                fieldErrors,
                details: Object.values(fieldErrors),
                hint: "Corrige les champs indiqués puis réessaie."
            }
        };
    }

    return {
        value: { name, email, password }
    };
}

function sanitizeLoginInput(body: unknown): { value?: { email: string; password: string }; error?: ApiErrorPayload } {
    if (!isRecord(body)) {
        return {
            error: {
                code: "BAD_REQUEST",
                message: "Les informations de connexion sont invalides."
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : '';
    const password = typeof body.password === "string" ? body.password : '';

    if (!email || !email.includes('@')) {
        fieldErrors.email = "Renseigne une adresse email valide.";
    }
    if (!password) {
        fieldErrors.password = "Le mot de passe est requis.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "Impossible de lancer la connexion.",
                fieldErrors,
                details: Object.values(fieldErrors)
            }
        };
    }

    return {
        value: { email, password }
    };
}

function sanitizeProfileInput(body: unknown): { value?: UserUpdateInput; error?: ApiErrorPayload } {
    if (!isRecord(body)) {
        return {
            error: {
                code: "BAD_REQUEST",
                message: "Les informations de profil sont invalides."
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const value: UserUpdateInput = {};

    if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : '';
        if (!name) {
            fieldErrors.name = "Le nom complet est requis.";
        } else {
            value.name = name;
        }
    }

    if (body.email !== undefined) {
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : '';
        if (!email || !email.includes('@')) {
            fieldErrors.email = "Une adresse email valide est requise.";
        } else {
            value.email = email;
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "Le profil contient des informations invalides.",
                fieldErrors,
                details: Object.values(fieldErrors)
            }
        };
    }

    return { value };
}

function validatePlanningDataForSolve(data: unknown): { value?: SolveReadyData; error?: ApiErrorPayload } {
    if (!isRecord(data)) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "Les données de planification sont absentes ou invalides.",
                details: ["Le Planning Editor doit fournir un objet JSON complet avant de lancer la résolution."],
                hint: "Complète les étapes de l'éditeur puis relance la résolution."
            }
        };
    }

    const fieldErrors: FieldErrors = {};
    const details: string[] = [];
    const safeData = data as Record<string, unknown>;
    const editorState = isRecord(safeData.editorState) ? safeData.editorState : null;

    const time = safeData.time;
    let slotsPerDayValue: number | null = null;
    if (!isRecord(time)) {
        fieldErrors.time = "La section temps est requise.";
        details.push('Ajoute au moins un jour et un nombre de créneaux par jour.');
    } else {
        const days = Array.isArray(time.days) ? time.days.filter(day => typeof day === "string" && day.trim()) : [];
        const slotsPerDay = Number(time.slotsPerDay);
        if (days.length === 0) {
            fieldErrors["time.days"] = "Au moins un jour doit être renseigné.";
            details.push('La section Temps doit contenir au moins un jour.');
        }
        if (!Number.isInteger(slotsPerDay) || slotsPerDay <= 0) {
            fieldErrors["time.slotsPerDay"] = "Le nombre de créneaux doit être un entier strictement positif.";
            details.push('La section Temps doit contenir un nombre de créneaux valide.');
        } else {
            slotsPerDayValue = slotsPerDay;
        }
    }

    const activities = safeData.activities;
    const activityNames = isRecord(activities) ? Object.keys(activities) : [];
    if (!isRecord(activities) || activityNames.length === 0) {
        fieldErrors.activities = "Au moins une activité est requise.";
        details.push('Ajoute au moins une activité avant de résoudre.');
    } else {
        for (const [activityName, activityValue] of Object.entries(activities)) {
            if (!isRecord(activityValue)) {
                fieldErrors[`activities.${activityName}`] = `L'activité "${activityName}" est invalide.`;
                continue;
            }

            const count = Number(activityValue.count);
            const duration = Number(activityValue.duration);
            if (!Number.isInteger(count) || count <= 0) {
                fieldErrors[`activities.${activityName}.count`] = `Le nombre d'occurrences pour "${activityName}" doit être > 0.`;
            }
            if (!Number.isInteger(duration) || duration <= 0) {
                fieldErrors[`activities.${activityName}.duration`] = `La durée pour "${activityName}" doit être > 0.`;
            } else if (slotsPerDayValue !== null && duration > slotsPerDayValue) {
                fieldErrors[`activities.${activityName}.duration`] = `La durée de "${activityName}" (${duration} créneau(x)) dépasse les ${slotsPerDayValue} créneaux disponibles par jour.`;
                const slotDuration = editorState && typeof editorState.slotDuration === "number"
                    ? editorState.slotDuration
                    : editorState && typeof editorState.slotDuration === "string"
                        ? Number(editorState.slotDuration)
                        : null;

                if (slotDuration && Number.isFinite(slotDuration) && slotDuration > 0) {
                    details.push(`L'activité "${activityName}" semble avoir été envoyée en minutes (${duration}) au lieu d'être convertie en créneaux de ${slotDuration} minute(s).`);
                } else {
                    details.push(`L'activité "${activityName}" dépasse la capacité journalière du modèle (${slotsPerDayValue} créneau(x) maximum par jour).`);
                }
            }
        }
    }

    const resources = safeData.resources;
    const resourceTypes = isRecord(resources) ? Object.keys(resources) : [];
    if (!isRecord(resources) || resourceTypes.length === 0) {
        fieldErrors.resources = "Au moins un type de ressource est requis.";
        details.push('Ajoute au moins une ressource avant de résoudre.');
    } else {
        for (const [resourceType, resourceValues] of Object.entries(resources)) {
            if (!Array.isArray(resourceValues) || resourceValues.filter(value => typeof value === "string" && value.trim()).length === 0) {
                fieldErrors[`resources.${resourceType}`] = `Le type de ressource "${resourceType}" doit contenir au moins un élément.`;
            }
        }
    }

    const roles = safeData.roles;
    const roleActivities = isRecord(roles) ? Object.keys(roles) : [];
    if (!isRecord(roles) || roleActivities.length === 0) {
        fieldErrors.roles = "Au moins un rôle doit être défini.";
        details.push('Définis les rôles nécessaires pour chaque activité.');
    } else {
        for (const [activityName, roleMap] of Object.entries(roles)) {
            if (!activityNames.includes(activityName)) {
                fieldErrors[`roles.${activityName}`] = `L'activité "${activityName}" utilisée pour les rôles n'existe pas.`;
                continue;
            }

            if (!isRecord(roleMap) || Object.keys(roleMap).length === 0) {
                fieldErrors[`roles.${activityName}`] = `Aucun rôle valide n'a été trouvé pour "${activityName}".`;
                continue;
            }

            for (const [roleName, resourceType] of Object.entries(roleMap)) {
                if (!roleName.trim()) {
                    fieldErrors[`roles.${activityName}`] = `Un rôle vide a été détecté pour "${activityName}".`;
                }
                if (typeof resourceType !== "string" || !resourceTypes.includes(resourceType)) {
                    fieldErrors[`roles.${activityName}.${roleName}`] = `Le type de ressource du rôle "${roleName}" est invalide.`;
                }
            }
        }
    }

    const activityMap = activities as Record<string, unknown>;
    const timeDays = isRecord(time) && Array.isArray(time.days) ? time.days.filter((day): day is string => typeof day === "string") : [];

    const activityInstanceSet = new Set<string>();
    activityNames.forEach((activityName) => {
        const activityValue = activityMap[activityName];
        const count = isRecord(activityValue) ? Number(activityValue.count) : 0;
        if (!Number.isInteger(count) || count <= 0) {
            return;
        }

        for (let index = 1; index <= count; index += 1) {
            activityInstanceSet.add(`${activityName.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_')}_${index}`);
        }
    });

    const resourceInstanceSet = new Set<string>();
    Object.values(resources as Record<string, unknown>).forEach((resourceValues) => {
        if (!Array.isArray(resourceValues)) {
            return;
        }
        resourceValues.forEach((value) => {
            if (typeof value === "string" && value.trim()) {
                resourceInstanceSet.add(value);
            }
        });
    });

    const roleNamesByActivity = new Map<string, Set<string>>();
    if (isRecord(roles)) {
        Object.entries(roles).forEach(([activityName, roleMap]) => {
            if (!isRecord(roleMap)) {
                return;
            }
            roleNamesByActivity.set(activityName, new Set(Object.keys(roleMap).filter((roleName) => roleName.trim())));
        });
    }

    const activityNameByInstance = new Map<string, string>();
    activityNames.forEach((activityName) => {
        const activityValue = activityMap[activityName];
        const count = isRecord(activityValue) ? Number(activityValue.count) : 0;
        if (!Number.isInteger(count) || count <= 0) {
            return;
        }

        for (let index = 1; index <= count; index += 1) {
            const instanceName = `${activityName.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_')}_${index}`;
            activityNameByInstance.set(instanceName, activityName);
        }
    });

    const totalSlots = slotsPerDayValue !== null && isRecord(time)
        ? ((time.days as string[])?.length ?? 0) * slotsPerDayValue
        : null;

    const constraints = safeData.constraints;
    if (!Array.isArray(constraints) || constraints.length === 0) {
        fieldErrors.constraints = "Au moins une contrainte est requise.";
        details.push('Ajoute ou génère au moins une contrainte avant de résoudre.');
    } else {
        constraints.forEach((constraint, index) => {
            if (!isRecord(constraint) || typeof constraint.type !== "string" || !constraint.type.trim()) {
                fieldErrors[`constraints.${index}`] = `La contrainte n°${index + 1} est invalide.`;
                return;
            }

            const constraintType = constraint.type as SupportedConstraintType;
            if (!["cardinality_per_activity", "resource_exclusivity", "fixed_assignment", "forbidden_assignment", "temporal_precedence", "time_window", "mandatory_roles", "instance_precedence", "required_resource", "resource_required_day", "resource_single_day"].includes(constraintType)) {
                fieldErrors[`constraints.${index}.type`] = `Le type de contrainte "${constraint.type}" n'est pas supporté.`;
                return;
            }

            if (constraintType === "cardinality_per_activity") {
                const activity = typeof constraint.activity === "string" ? constraint.activity : '';
                if (!activityNames.includes(activity)) {
                    fieldErrors[`constraints.${index}.activity`] = "La contrainte de cardinalité doit cibler une activité existante.";
                }
                if (typeof constraint.role !== "string" && typeof constraint.target !== "string") {
                    fieldErrors[`constraints.${index}.role`] = "La contrainte de cardinalité doit cibler soit un rôle, soit une cible.";
                }
                if (constraint.role !== undefined) {
                    if (typeof constraint.role !== "string" || !constraint.role.trim()) {
                        fieldErrors[`constraints.${index}.role`] = "Le rôle de cardinalité est invalide.";
                    } else if (activity && !roleNamesByActivity.get(activity)?.has(constraint.role.trim())) {
                        fieldErrors[`constraints.${index}.role`] = "Le rôle ciblé n'existe pas pour cette activité.";
                    }
                }
                if (constraint.target !== undefined) {
                    if (typeof constraint.target !== "string" || !constraint.target.trim()) {
                        fieldErrors[`constraints.${index}.target`] = "La cible de cardinalité est invalide.";
                    } else if (constraint.target !== "slot" && !resourceTypes.includes(constraint.target)) {
                        fieldErrors[`constraints.${index}.target`] = "La cible de cardinalité doit être \"slot\" ou un type de ressource existant.";
                    }
                }
                const min = Number(constraint.min);
                const max = Number(constraint.max);
                if (!Number.isInteger(min) || min < 0) {
                    fieldErrors[`constraints.${index}.min`] = "Le minimum de cardinalité doit être un entier positif ou nul.";
                }
                if (!Number.isInteger(max) || max < min) {
                    fieldErrors[`constraints.${index}.max`] = "Le maximum de cardinalité doit être supérieur ou égal au minimum.";
                }
            }

            if (constraintType === "resource_exclusivity") {
                if (typeof constraint.resourceType !== "string" || !resourceTypes.includes(constraint.resourceType)) {
                    fieldErrors[`constraints.${index}.resourceType`] = "Le type de ressource de l'exclusivité est invalide.";
                }
                if (typeof constraint.activity !== "string" || !activityNames.includes(constraint.activity)) {
                    fieldErrors[`constraints.${index}.activity`] = "L'activité de l'exclusivité doit exister.";
                }
                if (typeof constraint.scope !== "string" || !["slot", "day"].includes(constraint.scope)) {
                    fieldErrors[`constraints.${index}.scope`] = "Le scope de l'exclusivité doit être \"slot\" ou \"day\".";
                }
                const max = Number(constraint.max);
                if (!Number.isInteger(max) || max < 0) {
                    fieldErrors[`constraints.${index}.max`] = "Le maximum d'exclusivité doit être un entier positif ou nul.";
                }
            }

            if (constraintType === "fixed_assignment" || constraintType === "forbidden_assignment") {
                const activityInstance = typeof constraint.activityInstance === "string" ? constraint.activityInstance : '';
                const role = typeof constraint.role === "string" ? constraint.role : '';
                const resource = typeof constraint.resource === "string" ? constraint.resource : '';
                if (!activityInstance.trim()) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité est requise.";
                } else if (!activityInstanceSet.has(activityInstance)) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité ciblée n'existe pas.";
                }
                if (!role.trim()) {
                    fieldErrors[`constraints.${index}.role`] = "Le rôle est requis.";
                } else {
                    const activityName = activityNameByInstance.get(activityInstance);
                    if (activityName && !roleNamesByActivity.get(activityName)?.has(role)) {
                        fieldErrors[`constraints.${index}.role`] = "Le rôle ciblé n'existe pas pour cette instance d'activité.";
                    }
                }
                if (!resource.trim()) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource est requise.";
                } else if (!resourceInstanceSet.has(resource)) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
            }

            if (constraintType === "temporal_precedence") {
                if (typeof constraint.beforeActivity !== "string" || !activityNames.includes(constraint.beforeActivity)) {
                    fieldErrors[`constraints.${index}.beforeActivity`] = "L'activité source de la précédence doit exister.";
                }
                if (typeof constraint.afterActivity !== "string" || !activityNames.includes(constraint.afterActivity)) {
                    fieldErrors[`constraints.${index}.afterActivity`] = "L'activité cible de la précédence doit exister.";
                }
                if (constraint.beforeActivity === constraint.afterActivity && typeof constraint.beforeActivity === "string") {
                    fieldErrors[`constraints.${index}.afterActivity`] = "Une activité ne peut pas être en précédence avec elle-même.";
                }
            }

            if (constraintType === "time_window") {
                const activityInstance = typeof constraint.activityInstance === "string" ? constraint.activityInstance : '';
                const minSlot = Number(constraint.minSlot);
                const maxSlot = Number(constraint.maxSlot);
                if (!activityInstance.trim()) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité est requise.";
                } else if (!activityInstanceSet.has(activityInstance)) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité ciblée n'existe pas.";
                }
                if (!Number.isInteger(minSlot) || minSlot < 1) {
                    fieldErrors[`constraints.${index}.minSlot`] = "Le slot minimal doit être un entier supérieur ou égal à 1.";
                }
                if (!Number.isInteger(maxSlot) || maxSlot < minSlot) {
                    fieldErrors[`constraints.${index}.maxSlot`] = "Le slot maximal doit être un entier supérieur ou égal au slot minimal.";
                } else if (totalSlots !== null && maxSlot > totalSlots) {
                    fieldErrors[`constraints.${index}.maxSlot`] = `Le slot maximal dépasse l'horizon temporel disponible (${totalSlots}).`;
                }
            }

            if (constraintType === "mandatory_roles") {
                if (typeof constraint.activity !== "string" || !activityNames.includes(constraint.activity)) {
                    fieldErrors[`constraints.${index}.activity`] = "L'activité de mandatory_roles doit exister.";
                } else if (!roleNamesByActivity.get(constraint.activity)?.size) {
                    fieldErrors[`constraints.${index}.activity`] = "mandatory_roles exige une activité ayant au moins un rôle déclaré.";
                }
            }

            if (constraintType === "instance_precedence") {
                const beforeActivityInstance = typeof constraint.beforeActivityInstance === "string" ? constraint.beforeActivityInstance : '';
                const afterActivityInstance = typeof constraint.afterActivityInstance === "string" ? constraint.afterActivityInstance : '';
                if (!beforeActivityInstance.trim()) {
                    fieldErrors[`constraints.${index}.beforeActivityInstance`] = "L'instance source est requise.";
                } else if (!activityInstanceSet.has(beforeActivityInstance)) {
                    fieldErrors[`constraints.${index}.beforeActivityInstance`] = "L'instance source n'existe pas.";
                }
                if (!afterActivityInstance.trim()) {
                    fieldErrors[`constraints.${index}.afterActivityInstance`] = "L'instance cible est requise.";
                } else if (!activityInstanceSet.has(afterActivityInstance)) {
                    fieldErrors[`constraints.${index}.afterActivityInstance`] = "L'instance cible n'existe pas.";
                }
                if (beforeActivityInstance && beforeActivityInstance === afterActivityInstance) {
                    fieldErrors[`constraints.${index}.afterActivityInstance`] = "Les deux instances doivent être différentes.";
                }
            }

            if (constraintType === "required_resource") {
                const activityInstance = typeof constraint.activityInstance === "string" ? constraint.activityInstance : '';
                const resource = typeof constraint.resource === "string" ? constraint.resource : '';
                if (!activityInstance.trim()) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité est requise.";
                } else if (!activityInstanceSet.has(activityInstance)) {
                    fieldErrors[`constraints.${index}.activityInstance`] = "L'instance d'activité ciblée n'existe pas.";
                }
                if (!resource.trim()) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource est requise.";
                } else if (!resourceInstanceSet.has(resource)) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
            }

            if (constraintType === "resource_required_day") {
                const resource = typeof constraint.resource === "string" ? constraint.resource : '';
                const date = typeof constraint.date === "string" ? constraint.date : '';
                if (!resource.trim()) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource est requise.";
                } else if (!resourceInstanceSet.has(resource)) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
                if (!date.trim()) {
                    fieldErrors[`constraints.${index}.date`] = "Le jour est requis.";
                } else if (!timeDays.includes(date)) {
                    fieldErrors[`constraints.${index}.date`] = "La date ciblée doit faire partie des jours définis.";
                }
            }

            if (constraintType === "resource_single_day") {
                const resource = typeof constraint.resource === "string" ? constraint.resource : '';
                if (!resource.trim()) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource est requise.";
                } else if (!resourceInstanceSet.has(resource)) {
                    fieldErrors[`constraints.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
            }
        });
    }

    if (safeData.preferences !== undefined && !Array.isArray(safeData.preferences)) {
        fieldErrors.preferences = "Les préférences doivent être un tableau.";
    } else if (Array.isArray(safeData.preferences)) {
        safeData.preferences.forEach((preference, index) => {
            if (!isRecord(preference) || typeof preference.type !== "string" || !preference.type.trim()) {
                fieldErrors[`preferences.${index}`] = `La préférence n°${index + 1} est invalide.`;
                return;
            }

            const preferenceType = preference.type as SupportedPreferenceType;
            if (!["avoid_participation_on_date", "prefer_resource_on_date", "prefer_resource_single_day", "max_per_scope", "preferred_resource", "room_stability_for_role", "compact_schedule_for_role"].includes(preferenceType)) {
                fieldErrors[`preferences.${index}.type`] = `Le type de préférence "${preference.type}" n'est pas supporté.`;
                return;
            }

            if (preferenceType === "avoid_participation_on_date" || preferenceType === "prefer_resource_on_date") {
                if (typeof preference.resource !== "string" || !resourceInstanceSet.has(preference.resource)) {
                    fieldErrors[`preferences.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
                if (typeof preference.date !== "string" || !timeDays.includes(preference.date)) {
                    fieldErrors[`preferences.${index}.date`] = "La date ciblée doit faire partie des jours définis.";
                }
                const weight = Number(preference.weight);
                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }

            if (preferenceType === "prefer_resource_single_day") {
                if (typeof preference.resource !== "string" || !resourceInstanceSet.has(preference.resource)) {
                    fieldErrors[`preferences.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
                const weight = Number(preference.weight);
                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }

            if (preferenceType === "max_per_scope") {
                if (typeof preference.resourceType !== "string" || !resourceTypes.includes(preference.resourceType)) {
                    fieldErrors[`preferences.${index}.resourceType`] = "Le type de ressource ciblé n'existe pas.";
                }
                if (typeof preference.activity !== "string" || !activityNames.includes(preference.activity)) {
                    fieldErrors[`preferences.${index}.activity`] = "L'activité ciblée n'existe pas.";
                }
                if (typeof preference.scope !== "string" || !["slot", "day"].includes(preference.scope)) {
                    fieldErrors[`preferences.${index}.scope`] = "Le scope doit être \"slot\" ou \"day\".";
                }
                const max = Number(preference.max);
                const weight = Number(preference.weight);
                if (!Number.isInteger(max) || max < 1) {
                    fieldErrors[`preferences.${index}.max`] = "Le maximum doit être un entier strictement positif.";
                }
                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }

            if (preferenceType === "preferred_resource") {
                const activityInstance = typeof preference.activityInstance === "string" ? preference.activityInstance : '';
                const role = typeof preference.role === "string" ? preference.role : '';
                const resource = typeof preference.resource === "string" ? preference.resource : '';
                if (!activityInstance.trim()) {
                    fieldErrors[`preferences.${index}.activityInstance`] = "L'instance d'activité est requise.";
                } else if (!activityInstanceSet.has(activityInstance)) {
                    fieldErrors[`preferences.${index}.activityInstance`] = "L'instance d'activité ciblée n'existe pas.";
                }
                if (!role.trim()) {
                    fieldErrors[`preferences.${index}.role`] = "Le rôle est requis.";
                } else {
                    const activityName = activityNameByInstance.get(activityInstance);
                    if (activityName && !roleNamesByActivity.get(activityName)?.has(role)) {
                        fieldErrors[`preferences.${index}.role`] = "Le rôle ciblé n'existe pas pour cette instance d'activité.";
                    }
                }
                if (!resource.trim()) {
                    fieldErrors[`preferences.${index}.resource`] = "La ressource est requise.";
                } else if (!resourceInstanceSet.has(resource)) {
                    fieldErrors[`preferences.${index}.resource`] = "La ressource ciblée n'existe pas.";
                }
                const weight = Number(preference.weight);
                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }

            if (preferenceType === "room_stability_for_role") {
                const activity = typeof preference.activity === "string" ? preference.activity : '';
                const role = typeof preference.role === "string" ? preference.role : '';
                const roomResourceType = typeof preference.roomResourceType === "string" ? preference.roomResourceType : '';
                const scope = typeof preference.scope === "string" ? preference.scope : '';
                const weight = Number(preference.weight);

                if (!activity.trim()) {
                    fieldErrors[`preferences.${index}.activity`] = "L'activité est requise.";
                } else if (!activityNames.includes(activity)) {
                    fieldErrors[`preferences.${index}.activity`] = "L'activité ciblée n'existe pas.";
                }

                if (!role.trim()) {
                    fieldErrors[`preferences.${index}.role`] = "Le rôle est requis.";
                } else if (activity.trim() && !roleNamesByActivity.get(activity)?.has(role)) {
                    fieldErrors[`preferences.${index}.role`] = "Le rôle ciblé n'existe pas pour cette activité.";
                }

                if (!roomResourceType.trim()) {
                    fieldErrors[`preferences.${index}.roomResourceType`] = "Le type de ressource salle est requis.";
                } else if (!resourceTypes.includes(roomResourceType)) {
                    fieldErrors[`preferences.${index}.roomResourceType`] = "Le type de ressource salle ciblé n'existe pas.";
                }

                if (!scope.trim() || !["day", "global"].includes(scope)) {
                    fieldErrors[`preferences.${index}.scope`] = "Le scope doit être \"day\" ou \"global\".";
                }

                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }

            if (preferenceType === "compact_schedule_for_role") {
                const activity = typeof preference.activity === "string" ? preference.activity : '';
                const role = typeof preference.role === "string" ? preference.role : '';
                const scope = typeof preference.scope === "string" ? preference.scope : '';
                const weight = Number(preference.weight);

                if (!activity.trim()) {
                    fieldErrors[`preferences.${index}.activity`] = "L'activité est requise.";
                } else if (!activityNames.includes(activity)) {
                    fieldErrors[`preferences.${index}.activity`] = "L'activité ciblée n'existe pas.";
                }

                if (!role.trim()) {
                    fieldErrors[`preferences.${index}.role`] = "Le rôle est requis.";
                } else if (activity.trim() && !roleNamesByActivity.get(activity)?.has(role)) {
                    fieldErrors[`preferences.${index}.role`] = "Le rôle ciblé n'existe pas pour cette activité.";
                }

                if (!scope.trim() || !["day", "global"].includes(scope)) {
                    fieldErrors[`preferences.${index}.scope`] = "Le scope doit être \"day\" ou \"global\".";
                }

                if (!Number.isInteger(weight) || weight < 1) {
                    fieldErrors[`preferences.${index}.weight`] = "Le poids doit être un entier strictement positif.";
                }
            }
        });
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            error: {
                code: "VALIDATION_ERROR",
                message: "La planification est incomplète ou incohérente.",
                fieldErrors,
                details: details.length > 0 ? details : Object.values(fieldErrors),
                hint: "Vérifie notamment que les durées envoyées au solveur sont exprimées en créneaux et non en minutes, puis soumets à nouveau."
            }
        };
    }

    return {
        value: {
            ...safeData,
            time: {
                days: (time as Record<string, unknown>).days as string[],
                slotsPerDay: Number((time as Record<string, unknown>).slotsPerDay)
            },
            activities: activities as SolveReadyData["activities"],
            resources: resources as SolveReadyData["resources"],
            roles: roles as SolveReadyData["roles"],
            constraints: constraints as SolveReadyData["constraints"],
            preferences: Array.isArray(safeData.preferences) ? safeData.preferences as SolveReadyData["preferences"] : []
        }
    };
}

function analyzePotentialCapacityRisks(data: SolveReadyData): string[] {
    const warnings: string[] = [];

    data.constraints.forEach(rawConstraint => {
        if (!isRecord(rawConstraint) || typeof rawConstraint.type !== "string") {
            return;
        }

        if (rawConstraint.type === "cardinality_per_activity") {
            if (typeof rawConstraint.role === "string" && typeof rawConstraint.activity === "string") {
                const resourceType = data.roles[rawConstraint.activity]?.[rawConstraint.role];
                if (!resourceType) {
                    warnings.push(
                        `Le rôle "${rawConstraint.role}" n'est associé à aucun type de ressource pour l'activité "${rawConstraint.activity}".`
                    );
                } else if (!Array.isArray(data.resources[resourceType]) || data.resources[resourceType].length === 0) {
                    warnings.push(
                        `Le rôle "${rawConstraint.role}" de l'activité "${rawConstraint.activity}" dépend du type "${resourceType}", mais aucune ressource de ce type n'est disponible.`
                    );
                }
            }

            if (typeof rawConstraint.target === "string" && rawConstraint.target !== "slot") {
                if (!Array.isArray(data.resources[rawConstraint.target]) || data.resources[rawConstraint.target].length === 0) {
                    warnings.push(
                        `La contrainte cible "${rawConstraint.target}" est requise mais aucune ressource correspondante n'est disponible.`
                    );
                }
            }
        }

        if (rawConstraint.type === "resource_exclusivity" && typeof rawConstraint.resourceType === "string") {
            if (!Array.isArray(data.resources[rawConstraint.resourceType]) || data.resources[rawConstraint.resourceType].length === 0) {
                warnings.push(
                    `L'exclusivité porte sur le type "${rawConstraint.resourceType}", mais aucune ressource de ce type n'est disponible.`
                );
            }
        }

        if (rawConstraint.type === "mandatory_roles" && typeof rawConstraint.activity === "string") {
            if (!data.roles[rawConstraint.activity] || Object.keys(data.roles[rawConstraint.activity]).length === 0) {
                warnings.push(
                    `mandatory_roles a été demandé pour "${rawConstraint.activity}", mais aucun rôle n'est défini pour cette activité.`
                );
            }
        }

        if (rawConstraint.type === "required_resource" && typeof rawConstraint.resource === "string") {
            const requiredResource = rawConstraint.resource;
            const resourceExists = Object.values(data.resources).some((instances) => Array.isArray(instances) && instances.includes(requiredResource));
            if (!resourceExists) {
                warnings.push(
                    `required_resource cible la ressource "${requiredResource}", mais elle n'existe pas dans le modèle.`
                );
            }
        }
    });

    data.preferences.forEach((rawPreference) => {
        if (!isRecord(rawPreference) || typeof rawPreference.type !== "string") {
            return;
        }

        if (rawPreference.type === "max_per_scope" && typeof rawPreference.resourceType === "string") {
            if (!Array.isArray(data.resources[rawPreference.resourceType]) || data.resources[rawPreference.resourceType].length === 0) {
                warnings.push(
                    `La préférence max_per_scope cible le type "${rawPreference.resourceType}", mais aucune ressource de ce type n'est disponible.`
                );
            }
        }

        if (rawPreference.type === "preferred_resource" && typeof rawPreference.resource === "string") {
            const preferredResource = rawPreference.resource;
            const resourceExists = Object.values(data.resources).some((instances) => Array.isArray(instances) && instances.includes(preferredResource));
            if (!resourceExists) {
                warnings.push(
                    `La préférence preferred_resource cible la ressource "${rawPreference.resource}", mais elle n'existe pas dans le modèle.`
                );
            }
        }

        if (rawPreference.type === "room_stability_for_role") {
            const activity = typeof rawPreference.activity === "string" ? rawPreference.activity : '';
            const role = typeof rawPreference.role === "string" ? rawPreference.role : '';
            const roomResourceType = typeof rawPreference.roomResourceType === "string" ? rawPreference.roomResourceType : '';

            if (activity && role) {
                const actorResourceType = data.roles[activity]?.[role];
                if (!actorResourceType) {
                    warnings.push(
                        `La préférence room_stability_for_role référence le rôle "${role}" pour "${activity}", mais ce rôle n'est pas défini.`
                    );
                } else if (!Array.isArray(data.resources[actorResourceType]) || data.resources[actorResourceType].length === 0) {
                    warnings.push(
                        `La préférence room_stability_for_role vise le rôle "${role}" (${actorResourceType}) pour "${activity}", mais aucune ressource de ce type n'est disponible.`
                    );
                }
            }

            if (roomResourceType) {
                if (!Array.isArray(data.resources[roomResourceType]) || data.resources[roomResourceType].length === 0) {
                    warnings.push(
                        `La préférence room_stability_for_role cible le type de salle "${roomResourceType}", mais aucune ressource de ce type n'est disponible.`
                    );
                }
            }
        }

        if (rawPreference.type === "compact_schedule_for_role") {
            const activity = typeof rawPreference.activity === "string" ? rawPreference.activity : '';
            const role = typeof rawPreference.role === "string" ? rawPreference.role : '';
            if (activity && role) {
                const actorResourceType = data.roles[activity]?.[role];
                if (!actorResourceType) {
                    warnings.push(
                        `La préférence compact_schedule_for_role référence le rôle "${role}" pour "${activity}", mais ce rôle n'est pas défini.`
                    );
                } else if (!Array.isArray(data.resources[actorResourceType]) || data.resources[actorResourceType].length === 0) {
                    warnings.push(
                        `La préférence compact_schedule_for_role vise le rôle "${role}" (${actorResourceType}) pour "${activity}", mais aucune ressource de ce type n'est disponible.`
                    );
                }
            }
        }
    });

    return Array.from(new Set(warnings));
}

function extractBearerToken(req: express.Request): string | null {
    const authorization = req.header('authorization');
    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== "bearer" || !token) {
        return null;
    }

    return token.trim() || null;
}

function getSingleParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getOptionalQueryParam(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    if (Array.isArray(value)) {
        const first = value.find(entry => typeof entry === 'string' && entry.trim());
        if (typeof first === 'string') {
            return first.trim();
        }
    }

    return undefined;
}

async function authenticateRequest(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<void> {
    const token = extractBearerToken(req);
    if (!token) {
        sendError(res, 401, {
            code: "AUTH_REQUIRED",
            message: "Authentification requise.",
            details: ["Connecte-toi pour accéder à cette ressource."]
        });
        return;
    }

    try {
        await deleteExpiredSessions();
        const session = await getSessionByTokenHash(hashSessionToken(token));
        if (!session) {
            sendError(res, 401, {
                code: "INVALID_SESSION",
                message: "Votre session est invalide ou a expiré.",
                hint: "Reconnecte-toi puis réessaie."
            });
            return;
        }

        if (new Date(session.session.expiresAt).getTime() <= Date.now()) {
            await deleteSessionByTokenHash(session.session.tokenHash);
            sendError(res, 401, {
                code: "INVALID_SESSION",
                message: "Votre session a expiré.",
                hint: "Reconnecte-toi pour continuer."
            });
            return;
        }

        req.auth = session;
        next();
    } catch (error) {
        sendError(res, 500, {
            code: "INTERNAL_ERROR",
            message: "Impossible de vérifier votre session.",
            details: [error instanceof Error ? error.message : "Unknown authentication error"]
        });
    }
}

function requireAuth(req: AuthenticatedRequest): AuthSessionRecord {
    if (!req.auth) {
        throw new Error('Authentication middleware was not applied.');
    }

    return req.auth;
}

async function createUserSession(user: UserRecord): Promise<SessionPayload> {
    const token = createSessionToken(env.auth.tokenBytes);
    const expiresAt = new Date(Date.now() + env.auth.sessionTtlDays * 24 * 60 * 60 * 1000);
    await createSession(user.id, hashSessionToken(token), expiresAt);
    return {
        token,
        expiresAt: expiresAt.toISOString()
    };
}

async function refreshUserSession(session: AuthSessionRecord): Promise<{ expiresAt: string }> {
    const expiresAt = new Date(Date.now() + env.auth.sessionTtlDays * 24 * 60 * 60 * 1000);
    await refreshSessionExpiryByTokenHash(session.session.tokenHash, expiresAt);
    return {
        expiresAt: expiresAt.toISOString()
    };
}

function convertOptaAssignmentsToOutput(assignments: SpringSolveAssignment[], days: string[], objectiveValue?: number): string {
    const dayToIndex = new Map<string, number>();
    days.forEach((day, index) => dayToIndex.set(day, index + 1));

    const assignmentLines: string[] = [];
    const sortedAssignments = [...assignments].sort((a, b) => (a.globalSlot ?? 0) - (b.globalSlot ?? 0));
    for (const assignment of sortedAssignments) {
        const instance = assignment.activityInstance ?? 'Unknown_1';
        const globalSlot = assignment.globalSlot ?? 0;
        const dayLabel = assignment.day ?? '';
        const dayIndex = dayToIndex.get(dayLabel) ?? 1;
        assignmentLines.push(`ACTIVITY: ${instance} slot=${globalSlot} day=${dayIndex}`);
        const roles = assignment.roles ?? {};
        for (const [role, rawResource] of Object.entries(roles)) {
            const resources = Array.isArray(rawResource)
                ? rawResource.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                : (typeof rawResource === 'string' && rawResource.trim().length > 0 ? [rawResource] : []);
            for (const resource of resources) {
                assignmentLines.push(`ROLE: ${instance} role=${role} resource=${resource}`);
            }
        }
    }
    if (assignmentLines.length === 0) {
        return '';
    }

    const lines = typeof objectiveValue === 'number' && Number.isFinite(objectiveValue)
        ? [`OBJECTIVE: penalty=${objectiveValue}`, ...assignmentLines]
        : assignmentLines;
    return lines.join('\n');
}

function extractSolveTimeMsFromOptaPayload(result: SpringSolveResult): number | null {
    const candidates = [
        result.solvingTimeMillis,
        result.elapsedMillis,
        result.solveTimeMs,
        result.elapsedMs
    ];
    for (const value of candidates) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            return Math.floor(value);
        }
    }
    return null;
}

function extractOptaObjectiveValue(result: SpringSolveResult): number | undefined {
    const directCandidates = [
        result.objectiveValue,
        result.penalty,
        result.softPenalty
    ];
    for (const value of directCandidates) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(0, Math.trunc(value));
        }
    }

    if (typeof result.softScore === 'number' && Number.isFinite(result.softScore)) {
        return Math.max(0, -Math.trunc(result.softScore));
    }

    if (typeof result.score === 'string') {
        const match = result.score.match(/(-?\d+)\s*soft/i);
        if (match) {
            return Math.max(0, -Number.parseInt(match[1], 10));
        }
    }

    return undefined;
}

function extractOptaHardPenalty(result: SpringSolveResult): number | undefined {
    if (typeof result.hardPenalty === 'number' && Number.isFinite(result.hardPenalty)) {
        return Math.max(0, Math.trunc(result.hardPenalty));
    }
    if (typeof result.hardScore === 'number' && Number.isFinite(result.hardScore)) {
        return Math.max(0, -Math.trunc(result.hardScore));
    }
    return undefined;
}

function extractOptaSoftPenalty(result: SpringSolveResult): number | undefined {
    if (typeof result.softPenalty === 'number' && Number.isFinite(result.softPenalty)) {
        return Math.max(0, Math.trunc(result.softPenalty));
    }
    if (typeof result.penalty === 'number' && Number.isFinite(result.penalty)) {
        return Math.max(0, Math.trunc(result.penalty));
    }
    if (typeof result.softScore === 'number' && Number.isFinite(result.softScore)) {
        return Math.max(0, -Math.trunc(result.softScore));
    }
    return undefined;
}

function areOptaConstraintsSatisfied(result: SpringSolveResult): boolean | undefined {
    if (typeof result.constraintsSatisfied === 'boolean') {
        return result.constraintsSatisfied;
    }
    const hardPenalty = extractOptaHardPenalty(result);
    return hardPenalty === undefined ? undefined : hardPenalty === 0;
}

function areOptaPreferencesSatisfied(result: SpringSolveResult): boolean | undefined {
    if (typeof result.preferencesSatisfied === 'boolean') {
        return result.preferencesSatisfied;
    }
    const softPenalty = extractOptaSoftPenalty(result);
    return softPenalty === undefined ? undefined : softPenalty === 0;
}

function mapSpringSolvePayloadToInternal(
    result: SpringSolveResult,
    days: string[],
    measuredElapsedMs: number
): { ok: true; output: string; warnings: string[]; solveTimeMs: number } | { ok: false; error: { status: number; code: string; message: string; details: string[]; hint?: string } } {
    const status = (result.status ?? '').toUpperCase();
    const warnings = [
        ...(result.warnings ?? []),
        ...(result.notes ?? [])
    ];
    const hardDetails = (result.hardViolations ?? [])
        .map(v => v.message)
        .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0);

    if (status.includes('INFEASIBLE') || status.includes('UNSAT')) {
        return {
            ok: false,
            error: {
                status: 422,
                code: 'UNSATISFIABLE',
                message: 'Aucune solution réalisable n’a été trouvée par OptaPlanner.',
                details: hardDetails.length > 0 ? hardDetails : ['Le solveur OptaPlanner a retourné un état infaisable.'],
                hint: 'Réduis les contraintes fortes ou augmente les ressources disponibles.'
            }
        };
    }

    const assignments = Array.isArray(result.assignments) ? result.assignments : [];
    const objectiveValue = extractOptaObjectiveValue(result);
    const output = convertOptaAssignmentsToOutput(assignments, days, objectiveValue) || JSON.stringify(result, null, 2);
    const extractedSolveTime = extractSolveTimeMsFromOptaPayload(result);
    const solveTimeMs = extractedSolveTime ?? measuredElapsedMs;
    return {
        ok: true,
        output,
        warnings,
        solveTimeMs
    };
}

function buildOptaPlannerSolutionSignature(result: SpringSolveResult, output: string): string {
    return [
        `score=${result.score ?? ''}`,
        `hard=${result.hardScore ?? ''}`,
        `soft=${result.softScore ?? ''}`,
        `penalty=${extractOptaObjectiveValue(result) ?? ''}`,
        output
    ].join('\n');
}

function mergeOptaPlannerWarnings(mappedWarnings: string[], capacityWarnings: string[]): string[] {
    return Array.from(new Set([
        ...mappedWarnings,
        ...capacityWarnings,
        OPTAPLANNER_NON_OPTIMAL_WARNING
    ]));
}

function measuredOptaPlannerElapsedMs(session: OptaPlannerAsyncSession, springStatus: SpringAsyncSolveStatus): number {
    if (
        typeof springStatus.startedAtMillis === 'number'
        && typeof springStatus.finishedAtMillis === 'number'
        && springStatus.finishedAtMillis >= springStatus.startedAtMillis
    ) {
        return springStatus.finishedAtMillis - springStatus.startedAtMillis;
    }
    if (typeof springStatus.startedAtMillis === 'number' && springStatus.startedAtMillis > 0) {
        return Math.max(0, Date.now() - springStatus.startedAtMillis);
    }
    return Math.max(0, Date.now() - session.createdAt);
}

async function persistOptaPlannerSolutionVersion(
    session: OptaPlannerAsyncSession,
    planning: PlanningRecord,
    result: SpringSolveResult,
    springStatus: SpringAsyncSolveStatus,
    status: 'INTERMEDIATE' | 'FINAL' | 'STOPPED',
    solutionKind: 'intermediate' | 'final' | 'stopped'
): Promise<PlanningSolutionVersionRecord | null> {
    if (extractOptaHardPenalty(result) !== 0) {
        return null;
    }

    const measuredElapsedMs = measuredOptaPlannerElapsedMs(session, springStatus);
    const mapped = mapSpringSolvePayloadToInternal(result, session.daysForOutput, measuredElapsedMs);
    if (!mapped.ok) {
        return null;
    }

    const signature = buildOptaPlannerSolutionSignature(result, mapped.output);
    const existing = session.savedSolutionBySignature.get(signature);
    if (existing) {
        if (status === 'FINAL' || status === 'STOPPED') {
            const updated = await updatePlanningSolutionVersionStatus(
                existing.id,
                session.planningId,
                session.userId,
                status,
                solutionKind
            );
            const version = updated ?? existing;
            session.savedSolutionBySignature.set(signature, version);
            return version;
        }
        return existing;
    }

    session.savedSolutionCount += 1;
    const mergedWarnings = mergeOptaPlannerWarnings(mapped.warnings, session.capacityWarnings);
    const reportJson = buildPlanningReportFromOutput(planning, mapped.output, mergedWarnings, mapped.solveTimeMs);
    const solution = await createPlanningSolutionVersion(session.userId, {
        planningId: session.planningId,
        versionNumber: session.savedSolutionCount,
        solutionKind,
        status,
        objectiveValue: extractOptaObjectiveValue(result),
        solver: session.solver,
        sourceSnapshot: session.source,
        solutionOutput: mapped.output,
        solutionWarnings: mergedWarnings,
        rawOutput: JSON.stringify(result, null, 2),
        decodedSolutionJson: {
            score: result.score,
            hardScore: result.hardScore,
            softScore: result.softScore,
            penalty: extractOptaObjectiveValue(result),
            objectiveValue: extractOptaObjectiveValue(result),
            hardPenalty: extractOptaHardPenalty(result),
            softPenalty: extractOptaSoftPenalty(result),
            constraintsSatisfied: areOptaConstraintsSatisfied(result),
            preferencesSatisfied: areOptaPreferencesSatisfied(result),
            objectiveLine: result.objectiveLine ?? `OBJECTIVE: penalty=${extractOptaObjectiveValue(result) ?? 0}`,
            assignments: Array.isArray(result.assignments) ? result.assignments : []
        },
        reportJson,
        solveTimeMs: mapped.solveTimeMs
    });
    session.savedSolutionBySignature.set(signature, solution);
    return solution;
}

async function persistOptaPlannerFeasibleSolutions(
    session: OptaPlannerAsyncSession,
    springStatus: SpringAsyncSolveStatus
): Promise<PlanningSolutionVersionRecord[]> {
    const feasibleSolutions = Array.isArray(springStatus.feasibleSolutions)
        ? springStatus.feasibleSolutions
        : [];
    if (feasibleSolutions.length === 0) {
        return [];
    }

    const planning = await getPlanningById(session.planningId, session.userId);
    if (!planning) {
        return [];
    }

    const saved: PlanningSolutionVersionRecord[] = [];
    for (const solution of feasibleSolutions) {
        const version = await persistOptaPlannerSolutionVersion(
            session,
            planning,
            solution,
            springStatus,
            'INTERMEDIATE',
            'intermediate'
        );
        if (version) {
            saved.push(version);
        }
    }

    return saved;
}

function mapSpringSolvePayloadToLivePreview(
    result: SpringSolveResult,
    days: string[],
    measuredElapsedMs: number
): OptaLivePreview {
    const warnings = [
        ...(result.warnings ?? []),
        ...(result.notes ?? [])
    ];
    const assignments = Array.isArray(result.assignments) ? result.assignments : [];
    const objectiveValue = extractOptaObjectiveValue(result);
    const output = convertOptaAssignmentsToOutput(assignments, days, objectiveValue) || JSON.stringify(result, null, 2);
    const extractedSolveTime = extractSolveTimeMsFromOptaPayload(result);
    const solveTimeMs = extractedSolveTime ?? measuredElapsedMs;
    const hardScore = typeof result.hardScore === 'number' && Number.isFinite(result.hardScore)
        ? Math.trunc(result.hardScore)
        : null;
    return {
        output,
        warnings,
        solveTimeMs,
        feasible: hardScore === 0,
        hardScore,
        objectiveValue,
        penalty: objectiveValue,
        hardPenalty: extractOptaHardPenalty(result),
        softPenalty: extractOptaSoftPenalty(result),
        constraintsSatisfied: areOptaConstraintsSatisfied(result),
        preferencesSatisfied: areOptaPreferencesSatisfied(result)
    };
}

async function solvePlanningSourceWithOptaPlanner(
    source: string,
    days: string[],
    requestedTimeLimitSeconds?: number
): Promise<{ ok: true; result: { output: string; warnings: string[]; solveTimeMs: number } } | { ok: false; error: { status: number; code: string; message: string; details: string[]; hint?: string } }> {
    const safeTimeLimitSeconds = typeof requestedTimeLimitSeconds === 'number' && Number.isFinite(requestedTimeLimitSeconds)
        ? Math.max(1, Math.floor(requestedTimeLimitSeconds))
        : undefined;
    const requestTimeoutMs = safeTimeLimitSeconds !== undefined
        ? safeTimeLimitSeconds * 1000 + 10_000
        : env.optaPlannerTimeoutMs;

    const baseUrl = env.optaPlannerUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/planning/solve-json${safeTimeLimitSeconds !== undefined ? `?timeLimitSeconds=${safeTimeLimitSeconds}` : ''}`;
    try {
        const startedAt = Date.now();
        const response = await requestHttpJson('POST', url, requestTimeoutMs, source, 'application/json');
        const measuredElapsedMs = Date.now() - startedAt;
        let payload: SpringSolveResult | { message?: string } | null = null;
        try {
            payload = JSON.parse(response.body);
        } catch {
            payload = null;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
            const message = (payload && 'message' in payload && typeof payload.message === 'string')
                ? payload.message
                : 'Le backend OptaPlanner a renvoyé une erreur.';
            return {
                ok: false,
                error: {
                    status: 502,
                    code: 'OPTAPLANNER_ERROR',
                    message,
                    details: [
                        `URL: ${url}`,
                        `HTTP status: ${response.statusCode}`,
                        response.body.slice(0, 1_500)
                    ],
                    hint: 'Vérifie les logs du service Spring Boot OptaPlanner sur le port 8084.'
                }
            };
        }

        const result = payload as SpringSolveResult;
        const mapped = mapSpringSolvePayloadToInternal(result, days, measuredElapsedMs);
        if (!mapped.ok) {
            return {
                ok: false,
                error: mapped.error
            };
        }
        return {
            ok: true,
            result: {
                output: mapped.output,
                warnings: mapped.warnings.includes(OPTAPLANNER_NON_OPTIMAL_WARNING)
                    ? mapped.warnings
                    : [...mapped.warnings, OPTAPLANNER_NON_OPTIMAL_WARNING],
                solveTimeMs: mapped.solveTimeMs
            }
        };
    } catch (error) {
        return {
            ok: false,
            error: {
                status: 502,
                code: 'OPTAPLANNER_UNAVAILABLE',
                message: 'Le service OptaPlanner est indisponible.',
                details: [error instanceof Error ? error.message : 'Erreur de communication avec OptaPlanner.'],
                hint: `Démarre le backend Spring Boot et vérifie ${env.optaPlannerUrl}/api/planning/health`
            }
        };
    }
}

async function startOptaPlannerAsyncSolve(
    source: string,
    requestedTimeLimitSeconds?: number
): Promise<{ ok: true; jobId: string; status: string } | { ok: false; error: { status: number; code: string; message: string; details: string[]; hint?: string } }> {
    const safeTimeLimitSeconds = typeof requestedTimeLimitSeconds === 'number' && Number.isFinite(requestedTimeLimitSeconds)
        ? Math.max(1, Math.floor(requestedTimeLimitSeconds))
        : undefined;

    const requestTimeoutMs = 20_000;
    const baseUrl = env.optaPlannerUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/planning/solve-json/async/start${safeTimeLimitSeconds !== undefined ? `?timeLimitSeconds=${safeTimeLimitSeconds}` : ''}`;
    try {
        const response = await requestHttpJson('POST', url, requestTimeoutMs, source, 'application/json');
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return {
                ok: false,
                error: {
                    status: 502,
                    code: 'OPTAPLANNER_ERROR',
                    message: 'Le backend OptaPlanner n’a pas pu démarrer le job asynchrone.',
                    details: [
                        `URL: ${url}`,
                        `HTTP status: ${response.statusCode}`,
                        response.body.slice(0, 1_500)
                    ],
                    hint: 'Vérifie les logs du service Spring Boot OptaPlanner sur le port 8084.'
                }
            };
        }

        const payload = JSON.parse(response.body) as { jobId?: string; status?: string };
        if (typeof payload.jobId !== 'string' || payload.jobId.trim().length === 0) {
            return {
                ok: false,
                error: {
                    status: 502,
                    code: 'OPTAPLANNER_BAD_PAYLOAD',
                    message: 'Le backend OptaPlanner a répondu sans identifiant de job.',
                    details: [response.body.slice(0, 1_500)]
                }
            };
        }
        return {
            ok: true,
            jobId: payload.jobId,
            status: typeof payload.status === 'string' ? payload.status : 'QUEUED'
        };
    } catch (error) {
        return {
            ok: false,
            error: {
                status: 502,
                code: 'OPTAPLANNER_UNAVAILABLE',
                message: 'Le service OptaPlanner est indisponible.',
                details: [error instanceof Error ? error.message : 'Erreur de communication avec OptaPlanner.'],
                hint: `Démarre le backend Spring Boot et vérifie ${env.optaPlannerUrl}/api/planning/health`
            }
        };
    }
}

async function getOptaPlannerAsyncStatus(jobId: string): Promise<{ ok: true; payload: SpringAsyncSolveStatus } | { ok: false; error: { status: number; code: string; message: string; details: string[]; hint?: string } }> {
    const baseUrl = env.optaPlannerUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/planning/solve-json/async/${encodeURIComponent(jobId)}`;
    try {
        const response = await requestHttpJson('GET', url, 20_000);
        if (response.statusCode === 404) {
            return {
                ok: false,
                error: {
                    status: 404,
                    code: 'OPTAPLANNER_JOB_NOT_FOUND',
                    message: 'Le job OptaPlanner est introuvable.',
                    details: [`jobId=${jobId}`]
                }
            };
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return {
                ok: false,
                error: {
                    status: 502,
                    code: 'OPTAPLANNER_ERROR',
                    message: 'Le backend OptaPlanner a renvoyé une erreur pendant la lecture du statut.',
                    details: [`HTTP status: ${response.statusCode}`, response.body.slice(0, 1_500)]
                }
            };
        }
        const payload = JSON.parse(response.body) as SpringAsyncSolveStatus;
        return { ok: true, payload };
    } catch (error) {
        return {
            ok: false,
            error: {
                status: 502,
                code: 'OPTAPLANNER_UNAVAILABLE',
                message: 'Le service OptaPlanner est indisponible.',
                details: [error instanceof Error ? error.message : 'Erreur de communication avec OptaPlanner.'],
                hint: `Démarre le backend Spring Boot et vérifie ${env.optaPlannerUrl}/api/planning/health`
            }
        };
    }
}

async function stopOptaPlannerAsyncJob(jobId: string): Promise<{ ok: true; payload: SpringAsyncSolveStatus } | { ok: false; error: { status: number; code: string; message: string; details: string[]; hint?: string } }> {
    const baseUrl = env.optaPlannerUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/planning/solve-json/async/${encodeURIComponent(jobId)}/stop`;
    try {
        const response = await requestHttpJson('POST', url, 20_000);
        if (response.statusCode === 404) {
            return {
                ok: false,
                error: {
                    status: 404,
                    code: 'OPTAPLANNER_JOB_NOT_FOUND',
                    message: 'Le job OptaPlanner est introuvable.',
                    details: [`jobId=${jobId}`]
                }
            };
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return {
                ok: false,
                error: {
                    status: 502,
                    code: 'OPTAPLANNER_ERROR',
                    message: 'Le backend OptaPlanner a renvoyé une erreur pendant la demande d’arrêt.',
                    details: [`HTTP status: ${response.statusCode}`, response.body.slice(0, 1_500)]
                }
            };
        }
        const payload = JSON.parse(response.body) as SpringAsyncSolveStatus;
        return { ok: true, payload };
    } catch (error) {
        return {
            ok: false,
            error: {
                status: 502,
                code: 'OPTAPLANNER_UNAVAILABLE',
                message: 'Le service OptaPlanner est indisponible.',
                details: [error instanceof Error ? error.message : 'Erreur de communication avec OptaPlanner.'],
                hint: `Démarre le backend Spring Boot et vérifie ${env.optaPlannerUrl}/api/planning/health`
            }
        };
    }
}

function isOptaPlannerAsyncStatusTerminal(status: SpringAsyncSolveStatus): boolean {
    if (status.terminal === true) {
        return true;
    }
    const value = (status.status ?? '').toUpperCase();
    return value === 'COMPLETED' || value === 'TERMINATED_EARLY' || value === 'FAILED';
}

async function finalizeOptaPlannerAsyncSessionIfNeeded(
    session: OptaPlannerAsyncSession,
    springStatus: SpringAsyncSolveStatus
): Promise<PlanningSolutionVersionRecord | null> {
    if (!isOptaPlannerAsyncStatusTerminal(springStatus)) {
        return null;
    }
    if (session.finalized || session.finalizing) {
        return null;
    }

    session.finalizing = true;
    try {
        const statusUpper = (springStatus.status ?? '').toUpperCase();
        const planning = await getPlanningById(session.planningId, session.userId);
        if (!planning) {
            session.finalized = true;
            session.finalStatus = 'error';
            session.finalError = {
                code: 'NOT_FOUND',
                message: 'Planification introuvable pour finaliser la résolution OptaPlanner.',
                details: [`planningId=${session.planningId}`]
            };
            return null;
        }

        if (statusUpper === 'FAILED' || !springStatus.result) {
            const details: string[] = [];
            if (springStatus.errorMessage) {
                details.push(springStatus.errorMessage);
            }
            if (session.capacityWarnings.length > 0) {
                details.push(...session.capacityWarnings);
            }

            const payload: ApiErrorPayload = {
                code: 'OPTAPLANNER_ERROR',
                message: 'La résolution OptaPlanner a échoué.',
                details: details.length > 0 ? details : ['Le solveur a terminé en erreur sans détail supplémentaire.'],
                hint: 'Vérifie les contraintes fortes et les logs OptaPlanner.'
            };

            await updatePlanning(session.planningId, session.userId, {
                status: 'error',
                solutionOutput: null,
                solutionWarnings: null,
                solutionSolveTimeMs: null,
                lastError: {
                    message: payload.message,
                    details: payload.details,
                    hint: payload.hint
                }
            });

            session.finalized = true;
            session.finalStatus = 'error';
            session.finalError = payload;
            return null;
        }

        const measuredElapsedMs = (() => {
            if (typeof springStatus.startedAtMillis === 'number' && typeof springStatus.finishedAtMillis === 'number' && springStatus.finishedAtMillis >= springStatus.startedAtMillis) {
                return springStatus.finishedAtMillis - springStatus.startedAtMillis;
            }
            return Math.max(0, Date.now() - session.createdAt);
        })();

        const mapped = mapSpringSolvePayloadToInternal(
            springStatus.result,
            session.daysForOutput,
            measuredElapsedMs
        );

        if (!mapped.ok) {
            const details = mapped.error.code === 'UNSATISFIABLE'
                ? [...mapped.error.details, ...session.capacityWarnings]
                : mapped.error.details;

            await updatePlanning(session.planningId, session.userId, {
                status: 'error',
                solutionOutput: null,
                solutionWarnings: null,
                solutionSolveTimeMs: null,
                lastError: {
                    message: mapped.error.message,
                    details,
                    hint: mapped.error.hint
                }
            });

            session.finalized = true;
            session.finalStatus = 'error';
            session.finalError = {
                code: mapped.error.code,
                message: mapped.error.message,
                details,
                hint: mapped.error.hint
            };
            return null;
        }

        const mergedWarnings = [...mapped.warnings, ...session.capacityWarnings];
        if (!mergedWarnings.includes(OPTAPLANNER_NON_OPTIMAL_WARNING)) {
            mergedWarnings.push(OPTAPLANNER_NON_OPTIMAL_WARNING);
        }
        const updatedPlanning = await updatePlanning(session.planningId, session.userId, {
            status: 'done',
            currentStep: planning.totalSteps,
            progress: 100,
            solutionOutput: mapped.output,
            solutionWarnings: mergedWarnings,
            solutionSolveTimeMs: mapped.solveTimeMs,
            lastError: null
        });

        if (!updatedPlanning) {
            session.finalized = true;
            session.finalStatus = 'error';
            session.finalError = {
                code: 'INTERNAL_ERROR',
                message: 'La résolution a réussi, mais la planification n’a pas pu être rechargée.'
            };
            return null;
        }

        const finalSolutionStatus = statusUpper === 'TERMINATED_EARLY' || springStatus.stopRequested === true
            ? 'STOPPED'
            : 'FINAL';
        const finalSolutionKind = finalSolutionStatus === 'STOPPED' ? 'stopped' : 'final';
        const finalVersion = await persistOptaPlannerSolutionVersion(
            session,
            planning,
            springStatus.result,
            springStatus,
            finalSolutionStatus,
            finalSolutionKind
        );

        session.finalized = true;
        session.finalStatus = 'done';
        session.finalPayload = {
            planning: updatedPlanning,
            output: mapped.output,
            warnings: mergedWarnings,
            solveTimeMs: mapped.solveTimeMs
        };
        return finalVersion;
    } catch (error) {
        session.finalized = true;
        session.finalStatus = 'error';
        session.finalError = {
            code: 'DATABASE_ERROR',
            message: 'La finalisation OptaPlanner a échoué.',
            details: [error instanceof Error ? error.message : 'Unknown finalization error']
        };
        return null;
    } finally {
        session.finalizing = false;
    }
}

async function prepareMiniZincExecutionFromRequest(
    req: AuthenticatedRequest,
    planning: PlanningRecord,
    userId: string
): Promise<
    | { ok: true; planning: PlanningRecord; source: string; solver: string; warnings: string[]; solverTimeLimitSeconds?: number }
    | { ok: false; status: number; error: ApiErrorPayload }
> {
    const requestedSolver = isRecord(req.body) && typeof req.body.solver === 'string'
        ? req.body.solver
        : undefined;
    if (requestedSolver && isOptaPlannerSolverRequest(requestedSolver)) {
        return {
            ok: false,
            status: 400,
            error: {
                code: 'BAD_REQUEST',
                message: 'Utilise les routes OptaPlanner dédiées pour ce solveur.'
            }
        };
    }

    const resolvedSolver = resolveMiniZincSolverOption(requestedSolver);
    if (!resolvedSolver) {
        return {
            ok: false,
            status: 400,
            error: {
                code: 'BAD_REQUEST',
                message: `Le solveur demandé "${requestedSolver ?? env.solver}" n'est pas disponible.`,
                details: unavailableSolverDetails(),
                hint: 'Vérifie `docker compose exec backend minizinc --solvers` ou `/api/solvers/minizinc`.'
            }
        };
    }
    const solverTimeLimitSeconds = parseSolverTimeLimitSecondsFromBody(req.body);

    const persistedData = getPersistedPlanningData(planning.data);
    const sourceOverride = isRecord(req.body) && typeof req.body.source === 'string' && req.body.source.trim().length > 0
        ? canonicalizePlanningSource(req.body.source)
        : undefined;

    const nextData = isRecord(req.body) && isRecord(req.body.data)
        ? {
            ...persistedData,
            ...req.body.data,
            ...(sourceOverride ? { dslSource: sourceOverride } : {})
        }
        : sourceOverride
            ? {
                ...persistedData,
                dslSource: sourceOverride
            }
            : undefined;

    const persistedPlanning = nextData
        ? await updatePlanning(planning.id, userId, {
            data: nextData,
            currentStep: planning.currentStep,
            totalSteps: planning.totalSteps,
            progress: planning.progress,
            status: planning.status === 'draft' ? 'active' : planning.status
        })
        : planning;
    const solveTarget = persistedPlanning ?? planning;

    if (typeof sourceOverride === 'string' && sourceOverride.trim().length > 0) {
        return {
            ok: true,
            planning: solveTarget,
            source: sourceOverride,
            solver: resolvedSolver.id,
            warnings: [],
            solverTimeLimitSeconds
        };
    }

    const validation = validatePlanningDataForSolve(solveTarget.data);
    if (!validation.value) {
        await updatePlanning(planning.id, userId, {
            status: 'error',
            solutionOutput: null,
            solutionWarnings: null,
            solutionSolveTimeMs: null,
            lastError: {
                message: validation.error?.message ?? 'La planification est invalide.',
                details: validation.error?.details,
                hint: validation.error?.hint
            }
        });

        return {
            ok: false,
            status: 422,
            error: {
                ...validation.error!,
                details: validation.error?.details,
                fieldErrors: validation.error?.fieldErrors,
                hint: validation.error?.hint
            }
        };
    }

    return {
        ok: true,
        planning: solveTarget,
        source: serializeSolveModelToDsl(validation.value),
        solver: resolvedSolver.id,
        warnings: analyzePotentialCapacityRisks(validation.value),
        solverTimeLimitSeconds
    };
}

async function startMiniZincExecutionForRequest(req: AuthenticatedRequest, res: express.Response): Promise<express.Response> {
    const auth = requireAuth(req);
    const planningId = getSingleParam(req.params.id ?? req.params.planningId);
    const planning = await getPlanningById(planningId, auth.user.id);
    if (!planning) {
        return sendError(res, 404, {
            code: 'NOT_FOUND',
            message: 'Planification introuvable.'
        });
    }

    const prepared = await prepareMiniZincExecutionFromRequest(req, planning, auth.user.id);
    if (!prepared.ok) {
        return sendError(res, prepared.status, prepared.error);
    }

    const started = await miniZincExecutionService.start({
        userId: auth.user.id,
        planning: prepared.planning,
        source: prepared.source,
        solver: prepared.solver,
        requestedTimeLimitSeconds: prepared.solverTimeLimitSeconds,
        warnings: prepared.warnings
    });

    if (!started.ok) {
        return sendError(res, started.status, {
            code: started.code,
            message: started.message,
            details: started.activeExecutionId ? [`executionId=${started.activeExecutionId}`] : undefined
        });
    }

    return sendSuccess(res, {
        executionId: started.execution.id,
        status: 'RUNNING',
        message: 'Execution started',
        execution: started.execution
    }, 'Execution started', 202);
}

function writeSseEvent(res: express.Response, event: string, data: unknown, id?: string | number): void {
    if (id !== undefined) {
        res.write(`id: ${id}\n`);
    }
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeMiniZincExecutionEvent(res: express.Response, event: MiniZincExecutionEvent): void {
    if (event.type === 'log') {
        writeSseEvent(res, 'log', event.log, event.log.sequence);
        return;
    }
    if (event.type === 'solution') {
        writeSseEvent(res, 'solution', event.solution);
        return;
    }
    if (event.type === 'execution') {
        writeSseEvent(res, 'execution', event.execution);
        return;
    }
    writeSseEvent(res, 'done', {
        execution: event.execution,
        bestSolution: event.bestSolution ?? null
    });
}

const app = express();
const miniZincExecutionService = new MiniZincExecutionService();

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
}));
app.use(express.json({ limit: "1mb" }));

app.get('/api/health', async (_req, res) => {
    const database = await pingDatabase();
    return sendSuccess(res, {
        service: "planning-spec-server",
        port: env.port,
        solver: env.solver,
        optaPlanner: optaPlannerHealth,
        database
    });
});

app.post('/api/auth/register', async (req, res) => {
    const parsed = sanitizeRegistrationInput(req.body);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    try {
        const existingUser = await getAuthUserByEmail(parsed.value.email);
        if (existingUser) {
            return sendError(res, 409, {
                code: "CONFLICT",
                message: "Un compte existe déjà avec cette adresse email.",
                fieldErrors: {
                    email: "Cette adresse email est déjà utilisée."
                },
                hint: "Connecte-toi ou utilise une autre adresse email."
            });
        }

        const user = await createUser({
            name: parsed.value.name,
            email: parsed.value.email,
            passwordHash: await hashPassword(parsed.value.password)
        });
        const session = await createUserSession(user);

        return sendSuccess(res, {
            user,
            session
        }, "Compte créé avec succès.", 201);
    } catch (error) {
        return sendError(res, isMySqlDuplicateError(error) ? 409 : 500, {
            code: isMySqlDuplicateError(error) ? 'CONFLICT' : "DATABASE_ERROR",
            message: isMySqlDuplicateError(error)
                ? 'Un compte existe déjà avec cette adresse email.'
                : "Impossible de créer le compte.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const parsed = sanitizeLoginInput(req.body);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    try {
        const user = await getAuthUserByEmail(parsed.value.email);
        if (!user || !(await verifyPassword(parsed.value.password, user.passwordHash))) {
            return sendError(res, 401, {
                code: "INVALID_CREDENTIALS",
                message: "Email ou mot de passe incorrect.",
                hint: "Vérifie tes identifiants puis réessaie."
            });
        }

        const session = await createUserSession(user);
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return sendSuccess(res, {
            user: publicUser,
            session
        }, "Connexion réussie.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de te connecter pour le moment.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/auth/me', authenticateRequest, async (req, res) => {
    const auth = requireAuth(req);
    return sendSuccess(res, { user: auth.user });
});

app.post('/api/auth/refresh', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const session = await refreshUserSession(auth);
        return sendSuccess(res, { session }, 'Session renouvelée.');
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de renouveler la session.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.patch('/api/auth/me', authenticateRequest, async (req, res) => {
    const parsed = sanitizeProfileInput(req.body);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    try {
        const auth = requireAuth(req);
        const user = await updateUser(auth.user.id, parsed.value);
        if (!user) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Utilisateur introuvable."
            });
        }

        return sendSuccess(res, { user }, "Profil mis à jour.");
    } catch (error) {
        return sendError(res, isMySqlDuplicateError(error) ? 409 : 500, {
            code: isMySqlDuplicateError(error) ? 'CONFLICT' : "DATABASE_ERROR",
            message: isMySqlDuplicateError(error)
                ? 'Cette adresse email est déjà utilisée par un autre compte.'
                : "Impossible de mettre à jour le profil.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/auth/logout', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        await deleteSessionByTokenHash(auth.session.tokenHash);
        return sendSuccess(res, { loggedOut: true }, "Déconnexion réussie.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de terminer la session.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/projects', authenticateRequest, async (req, res) => {
    try {
        const projects = await listProjects(requireAuth(req).user.id);
        return sendSuccess(res, { projects });
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de charger les projets.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/projects/:id', authenticateRequest, async (req, res) => {
    try {
        const projectId = getSingleParam(req.params.id);
        const project = await getProjectById(projectId, requireAuth(req).user.id);
        if (!project) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Projet introuvable."
            });
        }

        return sendSuccess(res, { project });
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de charger ce projet.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/projects', authenticateRequest, async (req, res) => {
    const parsed = sanitizeProjectInput(req.body);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    try {
        const project = await createProject(requireAuth(req).user.id, parsed.value as ProjectInput);
        return sendSuccess(res, { project }, "Projet créé avec succès.", 201);
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de créer le projet.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.patch('/api/projects/:id', authenticateRequest, async (req, res) => {
    const parsed = sanitizeProjectInput(req.body, true);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    try {
        const projectId = getSingleParam(req.params.id);
        const project = await updateProject(projectId, requireAuth(req).user.id, parsed.value as ProjectUpdateInput);
        if (!project) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Projet introuvable."
            });
        }

        return sendSuccess(res, { project }, "Projet mis à jour.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de mettre à jour le projet.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.delete('/api/projects/:id', authenticateRequest, async (req, res) => {
    try {
        const projectId = getSingleParam(req.params.id);
        const deleted = await deleteProject(projectId, requireAuth(req).user.id);
        if (!deleted) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Projet introuvable."
            });
        }

        return sendSuccess(res, { deleted: true }, "Projet supprimé.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de supprimer le projet.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/plannings', authenticateRequest, async (req, res) => {
    try {
        const plannings = await listPlannings(requireAuth(req).user.id);
        return sendSuccess(res, { plannings });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger les planifications.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.get('/api/plannings/:id', authenticateRequest, async (req, res) => {
    try {
        const planningId = getSingleParam(req.params.id);
        const planning = await getPlanningById(planningId, requireAuth(req).user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Planification introuvable."
            });
        }

        return sendSuccess(res, { planning });
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de charger cette planification.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/plannings/:id/versions', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Planification introuvable."
            });
        }

        const versions = await listPlanningSolutionVersions(planningId, auth.user.id);
        return sendSuccess(res, { versions });
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de charger l'historique des versions.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/plannings/:id/execute', authenticateRequest, async (req, res) => {
    try {
        return await startMiniZincExecutionForRequest(req, res);
    } catch (error) {
        return sendError(res, 500, {
            code: 'INTERNAL_ERROR',
            message: 'Impossible de démarrer l’exécution MiniZinc.',
            details: [error instanceof Error ? error.message : 'Unknown internal error']
        });
    }
});

app.get('/api/plannings/:id/executions', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Planification introuvable.'
            });
        }

        const activeOrLatest = req.query.activeOrLatest === '1' || req.query.activeOrLatest === 'true';
        if (activeOrLatest) {
            const active = await listPlanningExecutions(planningId, auth.user.id, { activeOnly: true, limit: 1 });
            const latest = active[0] ? active[0] : await getLatestPlanningExecution(planningId, auth.user.id);
            return sendSuccess(res, { executions: latest ? [latest] : [] });
        }

        const executions = await listPlanningExecutions(planningId, auth.user.id);
        return sendSuccess(res, { executions });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger les exécutions.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.get('/api/plannings/:id/executions/:executionId', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const executionId = getSingleParam(req.params.executionId);
        const execution = await getPlanningExecutionById(executionId, auth.user.id);
        if (!execution || execution.planningId !== planningId) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Exécution introuvable.'
            });
        }

        return sendSuccess(res, { execution });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger cette exécution.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.get('/api/plannings/:id/executions/:executionId/logs', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const executionId = getSingleParam(req.params.executionId);
        const afterSequence = typeof req.query.afterSequence === 'string'
            ? Number(req.query.afterSequence)
            : undefined;
        const logs = await listPlanningExecutionLogs(planningId, executionId, auth.user.id, {
            afterSequence: Number.isFinite(afterSequence) ? afterSequence : undefined
        });
        return sendSuccess(res, { logs });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger les logs.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.get('/api/plannings/:id/executions/:executionId/events', authenticateRequest, async (req, res) => {
    const auth = requireAuth(req);
    const planningId = getSingleParam(req.params.id);
    const executionId = getSingleParam(req.params.executionId);
    const execution = await getPlanningExecutionById(executionId, auth.user.id);
    if (!execution || execution.planningId !== planningId) {
        return sendError(res, 404, {
            code: 'NOT_FOUND',
            message: 'Exécution introuvable.'
        });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const lastEventId = typeof req.query.lastEventId === 'string'
        ? Number(req.query.lastEventId)
        : typeof req.header('last-event-id') === 'string'
            ? Number(req.header('last-event-id'))
            : 0;

    writeSseEvent(res, 'execution', execution);
    const solutions = await listPlanningSolutions(planningId, auth.user.id, { executionId });
    solutions.reverse().forEach(solution => writeSseEvent(res, 'solution', solution));
    const logs = await listPlanningExecutionLogs(planningId, executionId, auth.user.id, {
        afterSequence: Number.isFinite(lastEventId) ? lastEventId : 0
    });
    logs.forEach(log => writeSseEvent(res, 'log', log, log.sequence));

    const unsubscribe = miniZincExecutionService.subscribe(executionId, event => {
        writeMiniZincExecutionEvent(res, event);
    });
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, env.sseHeartbeatIntervalMs);

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
    });
    return;
});

app.post('/api/plannings/:id/executions/:executionId/stop', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const executionId = getSingleParam(req.params.executionId);
        const execution = await getPlanningExecutionById(executionId, auth.user.id);
        if (!execution || execution.planningId !== planningId) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Exécution introuvable.'
            });
        }

        const stopped = await miniZincExecutionService.stop(executionId, auth.user.id);
        if (!stopped.ok) {
            return sendError(res, stopped.status, {
                code: stopped.code,
                message: stopped.message
            });
        }

        return sendSuccess(res, {
            execution: stopped.execution
        }, 'Demande d’arrêt envoyée.');
    } catch (error) {
        return sendError(res, 500, {
            code: 'INTERNAL_ERROR',
            message: 'Impossible de demander l’arrêt MiniZinc.',
            details: [error instanceof Error ? error.message : 'Unknown internal error']
        });
    }
});

app.get('/api/plannings/:id/solutions', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Planification introuvable.'
            });
        }

        const executionId = getOptionalQueryParam(req.query.executionId);
        const solutions = await listPlanningSolutions(planningId, auth.user.id, { executionId });
        return sendSuccess(res, { solutions });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger les solutions.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

app.get('/api/plannings/:id/solutions/:solutionId', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const solutionId = getSingleParam(req.params.solutionId);
        const solution = await getPlanningSolutionVersionById(solutionId, planningId, auth.user.id);
        if (!solution) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Solution introuvable.'
            });
        }

        return sendSuccess(res, { solution });
    } catch (error) {
        return sendError(res, 500, {
            code: 'DATABASE_ERROR',
            message: 'Impossible de charger cette solution.',
            details: [error instanceof Error ? error.message : 'Unknown database error']
        });
    }
});

type PlanningReportResolution =
    | { ok: true; report: PlanningReport }
    | { ok: false; status: number; code: string; message: string; details?: string[] };

function resolveReportFromSolutionVersion(
    planning: PlanningRecord,
    solution: PlanningSolutionVersionRecord
): PlanningReportResolution {
    if (solution.decodeError) {
        return {
            ok: false,
            status: 422,
            code: 'SOLUTION_NOT_DECODABLE',
            message: 'Cette solution intermédiaire n’est pas décodable.',
            details: [solution.decodeError]
        };
    }

    const report = solution.reportJson && typeof solution.reportJson === 'object'
        ? solution.reportJson as PlanningReport
        : buildPlanningReportFromOutput(planning, solution.solutionOutput, solution.solutionWarnings, solution.solveTimeMs);

    if (!report.activities || report.activities.length === 0) {
        return {
            ok: false,
            status: 422,
            code: 'SOLUTION_NOT_DECODABLE',
            message: 'Cette solution ne contient aucune activité exploitable.'
        };
    }

    return { ok: true, report };
}

app.get('/api/plannings/:id/solutions/:solutionId/report', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const solutionId = getSingleParam(req.params.solutionId);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Planification introuvable.'
            });
        }
        const solution = await getPlanningSolutionVersionById(solutionId, planningId, auth.user.id);
        if (!solution) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Solution introuvable.'
            });
        }

        const resolution = resolveReportFromSolutionVersion(planning, solution);
        if (!resolution.ok) {
            return sendError(res, resolution.status, {
                code: resolution.code,
                message: resolution.message,
                details: resolution.details
            });
        }

        return sendSuccess(res, resolution.report);
    } catch (error) {
        return sendError(res, 500, {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Erreur serveur.'
        });
    }
});

app.post('/api/plannings', authenticateRequest, async (req, res) => {
    const parsed = sanitizePlanningInput(req.body);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    const auth = requireAuth(req);
    const planningInput = parsed.value as PlanningInput;

    try {
        const planning = await createPlanning(auth.user.id, {
            ...planningInput,
            data: planningInput.data ?? createEmptyPlanningData()
        });
        return sendSuccess(res, { planning }, "Planification créée avec succès.", 201);
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de créer la planification.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.patch('/api/plannings/:id', authenticateRequest, async (req, res) => {
    const parsed = sanitizePlanningInput(req.body, true);
    if (!parsed.value) {
        return sendError(res, 422, parsed.error!);
    }

    const auth = requireAuth(req);
    const planningInput = parsed.value as PlanningUpdateInput;
    if (planningInput.projectId) {
        const project = await getProjectById(planningInput.projectId, auth.user.id);
        if (!project) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Le projet de destination est introuvable.",
                fieldErrors: {
                    projectId: "Le projet sélectionné n'existe pas ou ne t'appartient pas."
                }
            });
        }
    }

    try {
        const planningId = getSingleParam(req.params.id);
        const planning = await updatePlanning(planningId, auth.user.id, planningInput);
        if (!planning) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Planification introuvable."
            });
        }

        return sendSuccess(res, { planning }, "Planification mise à jour.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de mettre à jour la planification.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.delete('/api/plannings/:id/versions/:versionId', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const versionId = getSingleParam(req.params.versionId);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Planification introuvable."
            });
        }

        const deleted = await deletePlanningSolutionVersion(versionId, planningId, auth.user.id);
        if (!deleted) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Version introuvable."
            });
        }

        return sendSuccess(res, { deleted: true }, "Version supprimée.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de supprimer cette version.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.delete('/api/plannings/:id', authenticateRequest, async (req, res) => {
    try {
        const planningId = getSingleParam(req.params.id);
        const deleted = await deletePlanning(planningId, requireAuth(req).user.id);
        if (!deleted) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Planification introuvable."
            });
        }

        return sendSuccess(res, { deleted: true }, "Planification supprimée.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de supprimer la planification.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/plannings/:id/solve/async/start', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const planning = await getPlanningById(planningId, auth.user.id);
        if (!planning) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Planification introuvable.'
            });
        }

        const requestedSolver = isRecord(req.body) && typeof req.body.solver === 'string'
            ? req.body.solver
            : OPTAPLANNER_SOLVER_ID;
        if (!isOptaPlannerSolverRequest(requestedSolver)) {
            return sendError(res, 400, {
                code: 'BAD_REQUEST',
                message: 'La résolution asynchrone est disponible uniquement pour le solveur OptaPlanner.'
            });
        }

        const resolvedSolver = cachedSolvers.find(s => s.id === OPTAPLANNER_SOLVER_ID);
        if (!resolvedSolver) {
            return sendError(res, 400, {
                code: 'BAD_REQUEST',
                message: 'Le backend OptaPlanner n’est pas disponible.',
                details: [`URL configurée: ${env.optaPlannerUrl}`],
                hint: 'Démarre OptaPlanner avec `./run.sh start optaplanner` ou toute la plateforme avec `./run.sh start all dev --with-optaplanner`.'
            });
        }

        const solverTimeLimitSeconds = parseSolverTimeLimitSecondsFromBody(req.body);
        const persistedData = getPersistedPlanningData(planning.data);
        const sourceOverride = isRecord(req.body) && typeof req.body.source === 'string' && req.body.source.trim().length > 0
            ? canonicalizePlanningSource(req.body.source)
            : undefined;

        const nextData = isRecord(req.body) && isRecord(req.body.data)
            ? {
                ...persistedData,
                ...req.body.data,
                ...(sourceOverride ? { dslSource: sourceOverride } : {})
            }
            : sourceOverride
                ? {
                    ...persistedData,
                    dslSource: sourceOverride
                }
                : undefined;

        const persistedPlanning = nextData
            ? await updatePlanning(planning.id, auth.user.id, {
                data: nextData,
                currentStep: planning.currentStep,
                totalSteps: planning.totalSteps,
                progress: planning.progress,
                status: planning.status === 'draft' ? 'active' : planning.status
            })
            : planning;

        const solveTarget = persistedPlanning ?? planning;

        let source: string;
        let capacityWarnings: string[] = [];
        let daysForOutput: string[] = [];
        if (typeof sourceOverride === 'string' && sourceOverride.trim().length > 0) {
            source = sourceOverride;
            const persisted = getPersistedPlanningData(solveTarget.data);
            const persistedTime = isRecord(persisted.time) ? persisted.time : {};
            daysForOutput = Array.isArray(persistedTime.days)
                ? persistedTime.days.filter((day): day is string => typeof day === 'string' && day.trim().length > 0)
                : [];
        } else {
            const validation = validatePlanningDataForSolve(solveTarget.data);
            if (!validation.value) {
                await updatePlanning(planning.id, auth.user.id, {
                    status: 'error',
                    solutionOutput: null,
                    solutionWarnings: null,
                    solutionSolveTimeMs: null,
                    lastError: {
                        message: validation.error?.message ?? 'La planification est invalide.',
                        details: validation.error?.details,
                        hint: validation.error?.hint
                    }
                });

                return sendError(res, 422, {
                    ...validation.error!,
                    details: validation.error?.details,
                    fieldErrors: validation.error?.fieldErrors,
                    hint: validation.error?.hint
                });
            }

            capacityWarnings = analyzePotentialCapacityRisks(validation.value);
            daysForOutput = validation.value.time.days;
            source = serializeSolveModelToDsl(validation.value);
        }

        const startResult = await startOptaPlannerAsyncSolve(source, solverTimeLimitSeconds);
        if (!startResult.ok) {
            return sendError(res, startResult.error.status, {
                code: startResult.error.code,
                message: startResult.error.message,
                details: startResult.error.details,
                hint: startResult.error.hint
            });
        }

        const session: OptaPlannerAsyncSession = {
            jobId: startResult.jobId,
            planningId: planning.id,
            userId: auth.user.id,
            solver: resolvedSolver.id,
            source,
            daysForOutput,
            capacityWarnings,
            createdAt: Date.now(),
            savedSolutionCount: 0,
            savedSolutionBySignature: new Map(),
            finalized: false,
            finalizing: false,
            finalStatus: null
        };
        optaPlannerAsyncSessions.set(startResult.jobId, session);

        return sendSuccess(res, {
            jobId: startResult.jobId,
            status: startResult.status,
            planning: solveTarget
        }, 'Résolution asynchrone OptaPlanner démarrée.');
    } catch (error) {
        return sendError(res, 500, {
            code: 'INTERNAL_ERROR',
            message: 'Une erreur inattendue est survenue pendant le démarrage asynchrone.',
            details: [error instanceof Error ? error.message : 'Unknown internal error']
        });
    }
});

app.get('/api/plannings/:id/solve/async/:jobId', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const jobId = getSingleParam(req.params.jobId);
        const session = optaPlannerAsyncSessions.get(jobId);

        if (!session || session.planningId !== planningId || session.userId !== auth.user.id) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Job asynchrone introuvable pour cette planification.'
            });
        }

        const statusResult = await getOptaPlannerAsyncStatus(jobId);
        if (!statusResult.ok) {
            return sendError(res, statusResult.error.status, {
                code: statusResult.error.code,
                message: statusResult.error.message,
                details: statusResult.error.details,
                hint: statusResult.error.hint
            });
        }

        const springStatus = statusResult.payload;
        const liveSolveTimeMs = (() => {
            if (typeof springStatus.startedAtMillis === 'number' && springStatus.startedAtMillis > 0) {
                return Math.max(0, Date.now() - springStatus.startedAtMillis);
            }
            return Math.max(0, Date.now() - session.createdAt);
        })();
        const feasibleSolutions = Array.isArray(springStatus.feasibleSolutions)
            ? springStatus.feasibleSolutions
            : [];
        const liveSolutions: OptaLivePreview[] = feasibleSolutions
            .map((solution): OptaLivePreview | null => {
                if (extractOptaHardPenalty(solution) !== 0) {
                    return null;
                }
                return mapSpringSolvePayloadToLivePreview(solution, session.daysForOutput, liveSolveTimeMs);
            })
            .filter((item): item is OptaLivePreview => Boolean(item));
        const liveMapped = springStatus.result
            ? mapSpringSolvePayloadToLivePreview(springStatus.result, session.daysForOutput, liveSolveTimeMs)
            : null;
        const liveResult = liveMapped
            ? liveMapped
            : (liveSolutions.length > 0 ? liveSolutions[liveSolutions.length - 1] : null);

        const savedVersions = await persistOptaPlannerFeasibleSolutions(session, springStatus);
        const finalizedVersion = await finalizeOptaPlannerAsyncSessionIfNeeded(session, springStatus);
        const savedSolutions = finalizedVersion
            ? [finalizedVersion, ...savedVersions.filter(version => version.id !== finalizedVersion.id)]
            : savedVersions;

        return sendSuccess(res, {
            jobId,
            status: springStatus.status ?? 'UNKNOWN',
            terminal: isOptaPlannerAsyncStatusTerminal(springStatus),
            stopRequested: springStatus.stopRequested ?? false,
            bestSolutionCount: liveSolutions.length > 0 ? liveSolutions.length : (springStatus.bestSolutionCount ?? 0),
            bestScore: springStatus.bestScore ?? null,
            bestPenalty: springStatus.bestPenalty ?? liveResult?.objectiveValue ?? null,
            bestHardPenalty: springStatus.bestHardPenalty ?? liveResult?.hardPenalty ?? null,
            bestSoftPenalty: springStatus.bestSoftPenalty ?? liveResult?.softPenalty ?? null,
            constraintsSatisfied: springStatus.constraintsSatisfied ?? liveResult?.constraintsSatisfied ?? null,
            preferencesSatisfied: springStatus.preferencesSatisfied ?? liveResult?.preferencesSatisfied ?? null,
            liveResult,
            liveSolutions,
            savedSolutions,
            finalized: session.finalized,
            planning: session.finalPayload?.planning,
            result: session.finalPayload
                ? {
                    output: session.finalPayload.output,
                    warnings: session.finalPayload.warnings,
                    solveTimeMs: session.finalPayload.solveTimeMs
                }
                : null,
            error: session.finalError ?? null
        });
    } catch (error) {
        return sendError(res, 500, {
            code: 'INTERNAL_ERROR',
            message: 'Impossible de lire le statut du job OptaPlanner.',
            details: [error instanceof Error ? error.message : 'Unknown internal error']
        });
    }
});

app.post('/api/plannings/:id/solve/async/:jobId/stop', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planningId = getSingleParam(req.params.id);
        const jobId = getSingleParam(req.params.jobId);
        const session = optaPlannerAsyncSessions.get(jobId);

        if (!session || session.planningId !== planningId || session.userId !== auth.user.id) {
            return sendError(res, 404, {
                code: 'NOT_FOUND',
                message: 'Job asynchrone introuvable pour cette planification.'
            });
        }

        const stopResult = await stopOptaPlannerAsyncJob(jobId);
        if (!stopResult.ok) {
            return sendError(res, stopResult.error.status, {
                code: stopResult.error.code,
                message: stopResult.error.message,
                details: stopResult.error.details,
                hint: stopResult.error.hint
            });
        }

        const springStatus = stopResult.payload;
        const savedVersions = await persistOptaPlannerFeasibleSolutions(session, springStatus);
        const finalizedVersion = await finalizeOptaPlannerAsyncSessionIfNeeded(session, springStatus);
        const savedSolutions = finalizedVersion
            ? [finalizedVersion, ...savedVersions.filter(version => version.id !== finalizedVersion.id)]
            : savedVersions;

        return sendSuccess(res, {
            jobId,
            status: springStatus.status ?? 'UNKNOWN',
            terminal: isOptaPlannerAsyncStatusTerminal(springStatus),
            stopRequested: springStatus.stopRequested ?? true,
            bestPenalty: springStatus.bestPenalty ?? null,
            bestHardPenalty: springStatus.bestHardPenalty ?? null,
            bestSoftPenalty: springStatus.bestSoftPenalty ?? null,
            constraintsSatisfied: springStatus.constraintsSatisfied ?? null,
            preferencesSatisfied: springStatus.preferencesSatisfied ?? null,
            savedSolutions,
            finalized: session.finalized,
            planning: session.finalPayload?.planning,
            result: session.finalPayload
                ? {
                    output: session.finalPayload.output,
                    warnings: session.finalPayload.warnings,
                    solveTimeMs: session.finalPayload.solveTimeMs
                }
                : null,
            error: session.finalError ?? null
        }, 'Demande d’arrêt envoyée à OptaPlanner.');
    } catch (error) {
        return sendError(res, 500, {
            code: 'INTERNAL_ERROR',
            message: 'Impossible de demander l’arrêt du job OptaPlanner.',
            details: [error instanceof Error ? error.message : 'Unknown internal error']
        });
    }
});

app.post('/api/plannings/:id/solve', authenticateRequest, async (req, res) => {
    try {
        return await startMiniZincExecutionForRequest(req, res);
    } catch (error) {
        return sendError(res, 500, {
            code: "INTERNAL_ERROR",
            message: "Une erreur inattendue est survenue pendant le démarrage de la résolution.",
            details: [error instanceof Error ? error.message : "Unknown internal error"]
        });
    }
});

app.post('/api/validate-source', authenticateRequest, async (req, res) => {
    const source = typeof req.body?.source === "string" ? canonicalizePlanningSource(req.body.source) : '';

    if (!source.trim()) {
        return sendError(res, 400, {
            code: "BAD_REQUEST",
            message: "Aucune source de planification n'a été fournie."
        });
    }

    const validation = await validatePlanningSource(source);
    if (!validation.ok) {
        return sendError(res, validation.error.status, {
            code: validation.error.code,
            message: validation.error.message,
            details: validation.error.details,
            hint: validation.error.hint
        });
    }

    return sendSuccess(res, {
        issues: validation.issues
    });
});

app.post('/api/solve', authenticateRequest, async (req, res) => {
    const raw = req.body?.source ?? req.body;
    const source = typeof raw === "string"
        ? canonicalizePlanningSource(raw)
        : normalizeSource(raw);

    if (!source) {
        return sendError(res, 400, {
            code: "BAD_REQUEST",
            message: "Aucune source de planification n'a été fournie.",
            details: ['Envoie soit { "source": "..." }, soit directement un objet JSON conforme au DSL.']
        });
    }

    const requestedSolver = isRecord(req.body) && typeof req.body.solver === "string"
        ? req.body.solver
        : undefined;
    const resolvedSolver = resolveAnySolverOption(requestedSolver);
    if (!resolvedSolver) {
        return sendError(res, 400, {
            code: "BAD_REQUEST",
            message: `Le solveur demandé "${requestedSolver ?? env.solver}" n'est pas disponible.`,
            details: unavailableSolverDetails(),
            hint: 'Vérifie `docker compose exec backend minizinc --solvers`; pour OptaPlanner, démarre le service avec le profile optaplanner.'
        });
    }
    const solverTimeLimitSeconds = parseSolverTimeLimitSecondsFromBody(req.body);

    let daysForOutput: string[] = [];
    try {
        const parsedSource = JSON.parse(source) as { time?: { days?: unknown } };
        if (Array.isArray(parsedSource?.time?.days)) {
            daysForOutput = parsedSource.time.days.filter((day): day is string => typeof day === 'string' && day.trim().length > 0);
        }
    } catch {
        // Source may not be raw JSON. Days mapping stays empty.
    }

    const solveResult = resolvedSolver.id === OPTAPLANNER_SOLVER_ID
        ? await solvePlanningSourceWithOptaPlanner(source, daysForOutput, solverTimeLimitSeconds)
        : await solvePlanningSource(source, resolvedSolver.id);
    if (!solveResult.ok) {
        return sendError(res, solveResult.error.status, {
            code: solveResult.error.code,
            message: solveResult.error.message,
            details: solveResult.error.details,
            hint: solveResult.error.hint
        });
    }

    return sendSuccess(res, {
        output: solveResult.result.output,
        warnings: solveResult.result.warnings
    }, "Résolution terminée avec succès.");
});

// ---------------------------------------------------------------------------
// Tag definitions (badges réutilisables)
// ---------------------------------------------------------------------------

app.get('/api/tags', authenticateRequest, async (req, res) => {
    try {
        const tags = await listTagDefinitions(requireAuth(req).user.id);
        return sendSuccess(res, { tags });
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de récupérer les badges.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.post('/api/tags', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        if (!isRecord(req.body) || typeof req.body.name !== "string" || !req.body.name.trim()) {
            return sendError(res, 400, {
                code: "BAD_REQUEST",
                message: "Le nom du badge est requis."
            });
        }
        const color = typeof req.body.color === "string" && req.body.color.trim()
            ? req.body.color.trim()
            : "#6366f1";
        const input: TagDefinitionInput = {
            name: req.body.name.trim(),
            color
        };
        const tag = await createTagDefinition(auth.user.id, input);
        return sendSuccess(res, { tag }, "Badge créé avec succès.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de créer le badge.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.delete('/api/tags/:id', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const tagId = getSingleParam(req.params.id);
        const deleted = await deleteTagDefinition(tagId, auth.user.id);
        if (!deleted) {
            return sendError(res, 404, {
                code: "NOT_FOUND",
                message: "Badge introuvable."
            });
        }
        return sendSuccess(res, { deleted: true }, "Badge supprimé.");
    } catch (error) {
        return sendError(res, 500, {
            code: "DATABASE_ERROR",
            message: "Impossible de supprimer le badge.",
            details: [error instanceof Error ? error.message : "Unknown database error"]
        });
    }
});

app.get('/api/solvers/minizinc', (_req, res) => {
    const solvers = availableMiniZincSolverDetails();
    const defaultSolver = resolveMiniZincSolverOption();

    return sendSuccess(res, {
        availableSolvers: solvers.map(solver => solver.key),
        solvers,
        defaultSolver: defaultSolver?.key ?? normalizeSolverKey(env.solver),
        defaultSolverId: defaultSolver?.id ?? env.solver,
        minizincPath: env.minizinc.path
    });
});

app.get('/api/solvers', (_req, res) => {
    return sendSuccess(res, {
        solvers: cachedSolvers,
        optaPlanner: optaPlannerHealth,
        minizinc: {
            availableSolvers: availableMiniZincSolverDetails().map(solver => solver.key),
            defaultSolver: resolveMiniZincSolverOption()?.key ?? normalizeSolverKey(env.solver)
        }
    });
});

async function resolvePlanningReportForVersion(
    planning: PlanningRecord,
    userId: string,
    versionId?: string
): Promise<PlanningReportResolution> {
    if (versionId) {
        const version = await getPlanningSolutionVersionById(versionId, planning.id, userId);
        if (!version) {
            return {
                ok: false,
                status: 404,
                code: 'NOT_FOUND',
                message: 'Version de solution introuvable.'
            };
        }

        return resolveReportFromSolutionVersion(planning, version);
    }

    const report = buildPlanningReport(planning);
    if (!report) {
        return {
            ok: false,
            status: 422,
            code: 'NO_SOLUTION',
            message: 'Cette planification n\'a pas encore été résolue.'
        };
    }

    if (!report.activities || report.activities.length === 0) {
        return {
            ok: false,
            status: 422,
            code: 'SOLUTION_NOT_DECODABLE',
            message: 'Cette planification ne contient aucune activité exploitable.'
        };
    }

    return { ok: true, report };
}

// ---------------------------------------------------------------------------
// Report routes
// ---------------------------------------------------------------------------

app.get('/api/plannings/:id/report', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planning = await getPlanningById(getSingleParam(req.params.id), auth.user.id);
        if (!planning) {
            return sendError(res, 404, { code: 'NOT_FOUND', message: 'Planification introuvable.' });
        }
        const versionId = getOptionalQueryParam(req.query?.versionId);
        const resolution = await resolvePlanningReportForVersion(planning, auth.user.id, versionId);
        if (!resolution.ok) {
            return sendError(res, resolution.status, {
                code: resolution.code,
                message: resolution.message,
                details: resolution.details
            });
        }
        return sendSuccess(res, resolution.report);
    } catch (error) {
        return sendError(res, 500, { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : 'Erreur serveur.' });
    }
});

app.get('/api/plannings/:id/report/markdown', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planning = await getPlanningById(getSingleParam(req.params.id), auth.user.id);
        if (!planning) {
            return sendError(res, 404, { code: 'NOT_FOUND', message: 'Planification introuvable.' });
        }
        const versionId = getOptionalQueryParam(req.query?.versionId);
        const resolution = await resolvePlanningReportForVersion(planning, auth.user.id, versionId);
        if (!resolution.ok) {
            return sendError(res, resolution.status, {
                code: resolution.code,
                message: resolution.message,
                details: resolution.details
            });
        }
        const md = generateMarkdown(resolution.report);
        const versionSuffix = versionId ? `-version-${versionId.slice(0, 8)}` : '';
        const filename = `rapport-${planning.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${versionSuffix}.md`;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(md);
    } catch (error) {
        return sendError(res, 500, { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : 'Erreur serveur.' });
    }
});

app.get('/api/plannings/:id/report/print', authenticateRequest, async (req, res) => {
    try {
        const auth = requireAuth(req);
        const planning = await getPlanningById(getSingleParam(req.params.id), auth.user.id);
        if (!planning) {
            return sendError(res, 404, { code: 'NOT_FOUND', message: 'Planification introuvable.' });
        }
        const versionId = getOptionalQueryParam(req.query?.versionId);
        const resolution = await resolvePlanningReportForVersion(planning, auth.user.id, versionId);
        if (!resolution.ok) {
            return sendError(res, resolution.status, {
                code: resolution.code,
                message: resolution.message,
                details: resolution.details
            });
        }
        const html = generatePrintHTML(resolution.report);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (error) {
        return sendError(res, 500, { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : 'Erreur serveur.' });
    }
});

app.get('/', (_req, res) => {
    res.send('Planning Spec server is running.');
});

await initializeDatabase();
const orphanedExecutions = await markOrphanedPlanningExecutionsUnknown();
if (orphanedExecutions > 0) {
    console.warn(`${orphanedExecutions} exécution(s) MiniZinc active(s) ont été marquées UNKNOWN après redémarrage.`);
}
await detectAvailableSolvers();
await detectOptaPlannerHealthAtStartup();

app.listen(env.port, () => {
    console.log(`Planning Spec server listening on http://localhost:${env.port}`);
});
