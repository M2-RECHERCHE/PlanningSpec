import cors from 'cors';
import express from 'express';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import {
    createPlanning,
    createProject,
    createSession,
    createTagDefinition,
    createUser,
    deleteExpiredSessions,
    deletePlanning,
    deleteProject,
    deleteSessionByTokenHash,
    deleteTagDefinition,
    getAuthUserByEmail,
    getPlanningById,
    getProjectById,
    getSessionByTokenHash,
    initializeDatabase,
    listPlannings,
    listProjects,
    listTagDefinitions,
    pingDatabase,
    updatePlanning,
    updateProject,
    updateUser,
    type AuthSessionRecord,
    type Badge,
    type PlanStatus,
    type PlanningInput,
    type PlanningRecord,
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
import { solvePlanningSource, validatePlanningSource } from './solver.js';

// ---------------------------------------------------------------------------
// Détection des solveurs MiniZinc disponibles
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

export interface AvailableSolver {
    id: string;       // identifiant technique MiniZinc (ex: "Highs")
    label: string;    // nom lisible (ex: "Highs (défaut)")
    isDefault: boolean;
}

// Solveurs connus adaptés à la planification, avec leurs labels lisibles.
// La clé est un pattern (substring) matchant l'id ou le name MiniZinc.
const KNOWN_SOLVERS: Array<{ pattern: string; label: string; id: string }> = [
    { pattern: "highs",   label: "Highs",    id: "Highs"    },
    { pattern: "gecode",  label: "Gecode",   id: "Gecode"   },
    { pattern: "chuffed", label: "Chuffed",  id: "Chuffed"  },
    { pattern: "ortools", label: "OR-Tools", id: "org.sat4j.sat4j" },
    { pattern: "coinbc",  label: "Coin-BC",  id: "COIN-BC"  },
    { pattern: "cplex",   label: "CPLEX",    id: "CPLEX"    },
    { pattern: "sat4j",   label: "SAT4J",    id: "SAT4J"    },
];

let cachedSolvers: AvailableSolver[] = [
    { id: env.solver, label: `${env.solver} (défaut)`, isDefault: true }
];

async function detectAvailableSolvers(): Promise<void> {
    try {
        const { stdout } = await execFileAsync('minizinc', ["--solvers-json"], { timeout: 10_000 });
        const raw: Array<{ id?: string; name?: string; version?: string }> = JSON.parse(stdout);

        const found: AvailableSolver[] = [];
        for (const entry of raw) {
            const searchStr = `${(entry.id ?? '').toLowerCase()} ${(entry.name ?? '').toLowerCase()}`;
            for (const known of KNOWN_SOLVERS) {
                if (searchStr.includes(known.pattern)) {
                    const isDefault = known.id.toLowerCase() === env.solver.toLowerCase()
                        || (entry.id ?? '').toLowerCase().includes(known.pattern);
                    const alreadyAdded = found.some(s => s.id === known.id);
                    if (!alreadyAdded) {
                        found.push({
                            id: known.id,
                            label: isDefault ? `${known.label} (défaut)` : known.label,
                            isDefault
                        });
                    }
                    break;
                }
            }
        }

        if (found.length > 0) {
            // S'assurer que le solveur par défaut est toujours présent
            const hasDefault = found.some(s => s.isDefault);
            if (!hasDefault) {
                found.unshift({ id: env.solver, label: `${env.solver} (défaut)`, isDefault: true });
            }
            cachedSolvers = found;
        }

        console.log(`Solveurs détectés : ${cachedSolvers.map(s => s.label).join(', ')}`);
    } catch {
        console.warn('Impossible de détecter les solveurs MiniZinc — utilisation du solveur par défaut.');
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
    | 'required_resource';

type SupportedPreferenceType =
    | 'avoid_participation_on_date'
    | 'max_per_scope'
    | 'preferred_resource';

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

function canonicalizePlanningSource(source: string): string {
    try {
        const parsed = JSON.parse(source);
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
            if (!["cardinality_per_activity", "resource_exclusivity", "fixed_assignment", "forbidden_assignment", "temporal_precedence", "time_window", "mandatory_roles", "instance_precedence", "required_resource"].includes(constraintType)) {
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
            if (!["avoid_participation_on_date", "max_per_scope", "preferred_resource"].includes(preferenceType)) {
                fieldErrors[`preferences.${index}.type`] = `Le type de préférence "${preference.type}" n'est pas supporté.`;
                return;
            }

            if (preferenceType === "avoid_participation_on_date") {
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

async function solveAndPersistPlanning(
    userId: string,
    planning: PlanningRecord,
    sourceOverride?: string,
    solver: string = env.solver
): Promise<{ ok: true; planning: PlanningRecord; output: string; warnings: string[]; solveTimeMs: number } | { ok: false; status: number; error: ApiErrorPayload }> {
    let source: string;
    let capacityWarnings: string[] = [];

    if (typeof sourceOverride === "string" && sourceOverride.trim().length > 0) {
        source = sourceOverride;
    } else {
        const validation = validatePlanningDataForSolve(planning.data);
        if (!validation.value) {
            await updatePlanning(planning.id, userId, {
                status: "error",
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

        capacityWarnings = analyzePotentialCapacityRisks(validation.value);
        source = serializeSolveModelToDsl(validation.value);
    }

    const solveResult = await solvePlanningSource(source, solver);

    if (!solveResult.ok) {
        const combinedDetails = solveResult.error.code === "UNSATISFIABLE"
            ? [...solveResult.error.details, ...capacityWarnings]
            : solveResult.error.details;

        await updatePlanning(planning.id, userId, {
            status: "error",
            lastError: {
                message: solveResult.error.message,
                details: combinedDetails,
                hint: solveResult.error.hint
            }
        });

        return {
            ok: false,
            status: solveResult.error.status,
            error: {
                code: solveResult.error.code,
                message: solveResult.error.message,
                details: combinedDetails,
                hint: solveResult.error.hint
            }
        };
    }

    const updatedPlanning = await updatePlanning(planning.id, userId, {
        status: "done",
        currentStep: planning.totalSteps,
        progress: 100,
        solutionOutput: solveResult.result.output,
        solutionWarnings: solveResult.result.warnings,
        solutionSolveTimeMs: solveResult.result.solveTimeMs,
        lastError: null
    });

    if (!updatedPlanning) {
        return {
            ok: false,
            status: 500,
            error: {
                code: "INTERNAL_ERROR",
                message: "La résolution a réussi, mais la planification n'a pas pu être rechargée."
            }
        };
    }

    return {
        ok: true,
        planning: updatedPlanning,
        output: solveResult.result.output,
        warnings: solveResult.result.warnings,
        solveTimeMs: solveResult.result.solveTimeMs
    };
}

const app = express();

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

app.post('/api/plannings/:id/solve', authenticateRequest, async (req, res) => {
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

        const requestedSolver = isRecord(req.body) && typeof req.body.solver === "string"
            ? req.body.solver
            : env.solver;
        const resolvedSolver = cachedSolvers.some(s => s.id === requestedSolver)
            ? requestedSolver
            : env.solver;

        const persistedData = getPersistedPlanningData(planning.data);
        const sourceOverride = isRecord(req.body) && typeof req.body.source === "string" && req.body.source.trim().length > 0
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
                status: planning.status === "draft" ? 'active' : planning.status
            })
            : planning;

        const solveTarget = persistedPlanning ?? planning;
        const solveResult = await solveAndPersistPlanning(auth.user.id, solveTarget, sourceOverride, resolvedSolver);
        if (!solveResult.ok) {
            return sendError(res, solveResult.status, solveResult.error);
        }

        return sendSuccess(res, {
            planning: solveResult.planning,
            result: {
                output: solveResult.output,
                warnings: solveResult.warnings,
                solveTimeMs: solveResult.solveTimeMs
            }
        }, "Résolution terminée avec succès.");
    } catch (error) {
        return sendError(res, 500, {
            code: "INTERNAL_ERROR",
            message: "Une erreur inattendue est survenue pendant la résolution.",
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
        : env.solver;
    const resolvedSolver = cachedSolvers.some(s => s.id === requestedSolver)
        ? requestedSolver
        : env.solver;

    const solveResult = await solvePlanningSource(source, resolvedSolver);
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

app.get('/api/solvers', (_req, res) => {
    return sendSuccess(res, { solvers: cachedSolvers });
});

app.get('/', (_req, res) => {
    res.send('Planning Spec server is running.');
});

await initializeDatabase();
await detectAvailableSolvers();

app.listen(env.port, () => {
    console.log(`Planning Spec server listening on http://localhost:${env.port}`);
});
