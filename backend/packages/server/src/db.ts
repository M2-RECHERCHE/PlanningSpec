import { randomUUID } from 'node:crypto';

import mysql, { type Connection, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

import { env } from './env.js';

export type ProjectStatus = 'active' | 'archived' | 'completed';
export type PlanStatus = 'draft' | 'active' | 'paused' | 'done' | 'error';
export type PlanningExecutionStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'SOLUTION_FOUND'
    | 'OPTIMIZING'
    | 'COMPLETED'
    | 'OPTIMAL'
    | 'UNSATISFIABLE'
    | 'FAILED'
    | 'STOP_REQUESTED'
    | 'STOPPING'
    | 'STOPPED'
    | 'UNKNOWN';
export type PlanningExecutionLogLevel = 'info' | 'stdout' | 'stderr' | 'warning' | 'error' | 'solution';
export type PlanningSolutionStatus = 'INTERMEDIATE' | 'BEST_CURRENT' | 'FINAL' | 'OPTIMAL' | 'STOPPED' | 'DECODE_FAILED';
export type PlanningSolutionKind = 'intermediate' | 'best_current' | 'final' | 'optimal' | 'stopped';

export interface Badge {
    id: string;
    name: string;
    color: string;
}

export interface UserRecord {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuthUserRecord extends UserRecord {
    passwordHash: string;
}

export interface SessionRecord {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    createdAt: string;
}

export interface AuthSessionRecord {
    session: SessionRecord;
    user: UserRecord;
}

export interface ProjectRecord {
    id: string;
    userId: string;
    name: string;
    description: string;
    status: ProjectStatus;
    color: string;
    planCount: number;
    updatedAt: string;
    createdAt: string;
}

export interface TagDefinitionRecord {
    id: string;
    userId: string;
    name: string;
    color: string;
    createdAt: string;
}

export interface PlanningRecord {
    id: string;
    userId: string;
    title: string;
    projectId?: string;
    projectName?: string;
    status: PlanStatus;
    currentStep: number;
    totalSteps: number;
    progress: number;
    createdAt: string;
    updatedAt: string;
    data: Record<string, unknown>;
    badges: Badge[];
    solutionOutput?: string;
    solutionWarnings?: string[];
    solutionSolveTimeMs?: number;
    lastErrorMessage?: string;
    errorDetails?: string[];
    errorHint?: string;
}

export interface PlanningSolutionVersionRecord {
    id: string;
    planningId: string;
    userId: string;
    executionId?: string;
    versionNumber?: number;
    solutionKind?: PlanningSolutionKind;
    status?: PlanningSolutionStatus;
    objectiveValue?: number;
    solver: string;
    sourceSnapshot?: string;
    solutionOutput: string;
    solutionWarnings: string[];
    rawOutput?: string;
    decodedSolutionJson?: unknown;
    reportJson?: unknown;
    decodeError?: string;
    solveTimeMs?: number;
    createdAt: string;
}

export interface PlanningExecutionRecord {
    id: string;
    planningId: string;
    userId: string;
    status: PlanningExecutionStatus;
    solver: string;
    sourceSnapshot?: string;
    startedAt?: string;
    endedAt?: string;
    stoppedAt?: string;
    stopRequestedAt?: string;
    exitCode?: number;
    errorMessage?: string;
    bestSolutionId?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface PlanningExecutionLogRecord {
    id: string;
    executionId: string;
    sequence: number;
    level: PlanningExecutionLogLevel;
    stream?: string;
    message: string;
    executionStatus?: PlanningExecutionStatus;
    createdAt: string;
}

interface UserRow extends RowDataPacket {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    created_at: string | Date;
    updated_at: string | Date;
}

interface SessionRow extends RowDataPacket {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string | Date;
    created_at: string | Date;
    user_name: string;
    user_email: string;
    user_created_at: string | Date;
    user_updated_at: string | Date;
}

interface ProjectRow extends RowDataPacket {
    id: string;
    user_id: string;
    name: string;
    description: string;
    status: ProjectStatus;
    color: string;
    planCount: number | string;
    updated_at: string | Date;
    created_at: string | Date;
}

interface TagDefinitionRow extends RowDataPacket {
    id: string;
    user_id: string;
    name: string;
    color: string;
    created_at: string | Date;
}

interface PlanningRow extends RowDataPacket {
    id: string;
    user_id: string | null;
    title: string;
    project_id: string | null;
    project_name: string | null;
    status: PlanStatus;
    current_step: number;
    total_steps: number;
    progress: number;
    created_at: string | Date;
    updated_at: string | Date;
    wizard_data: unknown;
    badges: unknown;
    solution_output: string | null;
    solution_warnings: unknown;
    solution_solve_time_ms: number | null;
    last_error: unknown;
}

interface PlanningSolutionVersionRow extends RowDataPacket {
    id: string;
    planning_id: string;
    user_id: string;
    execution_id: string | null;
    version_number: number | null;
    solution_kind: PlanningSolutionKind | null;
    status: PlanningSolutionStatus | null;
    objective_value: number | string | null;
    solver: string;
    source_snapshot: string | null;
    solution_output: string;
    solution_warnings: unknown;
    raw_output: string | null;
    decoded_solution_json: unknown;
    report_json: unknown;
    decode_error: string | null;
    solve_time_ms: number | null;
    created_at: string | Date;
}

interface PlanningExecutionRow extends RowDataPacket {
    id: string;
    planning_id: string;
    user_id: string;
    status: PlanningExecutionStatus;
    solver: string;
    source_snapshot: string | null;
    started_at: string | Date | null;
    ended_at: string | Date | null;
    stopped_at: string | Date | null;
    stop_requested_at: string | Date | null;
    exit_code: number | null;
    error_message: string | null;
    best_solution_id: string | null;
    created_by: string;
    created_at: string | Date;
    updated_at: string | Date;
}

interface PlanningExecutionLogRow extends RowDataPacket {
    id: string;
    execution_id: string;
    sequence: number;
    level: PlanningExecutionLogLevel;
    stream: string | null;
    message: string;
    execution_status: PlanningExecutionStatus | null;
    created_at: string | Date;
}

interface ExistsRow extends RowDataPacket {
    count: number;
}

interface IsNullableRow extends RowDataPacket {
    IS_NULLABLE: string;
}

export interface UserInput {
    name: string;
    email: string;
    passwordHash: string;
}

export interface UserUpdateInput {
    name?: string;
    email?: string;
}

export interface ProjectInput {
    name: string;
    description: string;
    color: string;
    status?: ProjectStatus;
}

export interface ProjectUpdateInput {
    name?: string;
    description?: string;
    color?: string;
    status?: ProjectStatus;
}

export interface TagDefinitionInput {
    name: string;
    color: string;
}

export interface PlanningInput {
    title: string;
    projectId?: string;
    status?: PlanStatus;
    currentStep?: number;
    totalSteps?: number;
    progress?: number;
    data?: Record<string, unknown>;
    badges?: Badge[];
}

export interface PlanningUpdateInput {
    title?: string;
    projectId?: string;
    status?: PlanStatus;
    currentStep?: number;
    totalSteps?: number;
    progress?: number;
    data?: Record<string, unknown>;
    badges?: Badge[];
    solutionOutput?: string | null;
    solutionWarnings?: string[] | null;
    solutionSolveTimeMs?: number | null;
    lastError?: { message: string; details?: string[]; hint?: string } | null;
}

export interface PlanningSolutionVersionInput {
    planningId: string;
    executionId?: string | null;
    versionNumber?: number | null;
    solutionKind?: PlanningSolutionKind | null;
    status?: PlanningSolutionStatus | null;
    objectiveValue?: number | null;
    solver: string;
    sourceSnapshot?: string | null;
    solutionOutput: string;
    solutionWarnings?: string[] | null;
    rawOutput?: string | null;
    decodedSolutionJson?: unknown;
    reportJson?: unknown;
    decodeError?: string | null;
    solveTimeMs?: number | null;
}

export interface PlanningExecutionInput {
    planningId: string;
    solver: string;
    sourceSnapshot?: string | null;
    createdBy: string;
}

export interface PlanningExecutionUpdateInput {
    status?: PlanningExecutionStatus;
    startedAt?: Date | null;
    endedAt?: Date | null;
    stoppedAt?: Date | null;
    stopRequestedAt?: Date | null;
    exitCode?: number | null;
    errorMessage?: string | null;
    bestSolutionId?: string | null;
}

export interface PlanningExecutionLogInput {
    executionId: string;
    level: PlanningExecutionLogLevel;
    stream?: string | null;
    message: string;
    executionStatus?: PlanningExecutionStatus | null;
}

let pool: Pool | null = null;

function getPool(): Pool {
    if (!pool) {
        throw new Error('Database pool has not been initialized yet.');
    }
    return pool;
}

function toIsoDate(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }

    return value as T;
}

function mapUserRow(row: UserRow): UserRecord {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: toIsoDate(row.created_at),
        updatedAt: toIsoDate(row.updated_at)
    };
}

function mapAuthUserRow(row: UserRow): AuthUserRecord {
    return {
        ...mapUserRow(row),
        passwordHash: row.password_hash
    };
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        status: row.status,
        color: row.color,
        planCount: Number(row.planCount ?? 0),
        updatedAt: toIsoDate(row.updated_at),
        createdAt: toIsoDate(row.created_at)
    };
}

function mapTagDefinitionRow(row: TagDefinitionRow): TagDefinitionRecord {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        color: row.color,
        createdAt: toIsoDate(row.created_at)
    };
}

function mapPlanningRow(row: PlanningRow): PlanningRecord {
    const lastError = parseJson<{ message?: string; details?: string[]; hint?: string } | null>(row.last_error, null);
    const badges = parseJson<Badge[]>(row.badges, []);

    return {
        id: row.id,
        userId: row.user_id ?? '',
        title: row.title,
        projectId: row.project_id ?? undefined,
        projectName: row.project_name ?? undefined,
        status: row.status,
        currentStep: row.current_step,
        totalSteps: row.total_steps,
        progress: row.progress,
        createdAt: toIsoDate(row.created_at),
        updatedAt: toIsoDate(row.updated_at),
        data: parseJson<Record<string, unknown>>(row.wizard_data, {}),
        badges,
        solutionOutput: row.solution_output ?? undefined,
        solutionWarnings: parseJson<string[]>(row.solution_warnings, []),
        solutionSolveTimeMs: row.solution_solve_time_ms ?? undefined,
        lastErrorMessage: lastError?.message,
        errorDetails: lastError?.details ?? [],
        errorHint: lastError?.hint
    };
}

function mapSessionRow(row: SessionRow): AuthSessionRecord {
    return {
        session: {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            expiresAt: toIsoDate(row.expires_at),
            createdAt: toIsoDate(row.created_at)
        },
        user: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            createdAt: toIsoDate(row.user_created_at),
            updatedAt: toIsoDate(row.user_updated_at)
        }
    };
}

function mapPlanningSolutionVersionRow(row: PlanningSolutionVersionRow): PlanningSolutionVersionRecord {
    return {
        id: row.id,
        planningId: row.planning_id,
        userId: row.user_id,
        executionId: row.execution_id ?? undefined,
        versionNumber: row.version_number ?? undefined,
        solutionKind: row.solution_kind ?? undefined,
        status: row.status ?? undefined,
        objectiveValue: row.objective_value === null || row.objective_value === undefined ? undefined : Number(row.objective_value),
        solver: row.solver,
        sourceSnapshot: row.source_snapshot ?? undefined,
        solutionOutput: row.solution_output,
        solutionWarnings: parseJson<string[]>(row.solution_warnings, []),
        rawOutput: row.raw_output ?? undefined,
        decodedSolutionJson: parseJson<unknown | undefined>(row.decoded_solution_json, undefined),
        reportJson: parseJson<unknown | undefined>(row.report_json, undefined),
        decodeError: row.decode_error ?? undefined,
        solveTimeMs: row.solve_time_ms ?? undefined,
        createdAt: toIsoDate(row.created_at)
    };
}

function mapPlanningExecutionRow(row: PlanningExecutionRow): PlanningExecutionRecord {
    return {
        id: row.id,
        planningId: row.planning_id,
        userId: row.user_id,
        status: row.status,
        solver: row.solver,
        sourceSnapshot: row.source_snapshot ?? undefined,
        startedAt: row.started_at ? toIsoDate(row.started_at) : undefined,
        endedAt: row.ended_at ? toIsoDate(row.ended_at) : undefined,
        stoppedAt: row.stopped_at ? toIsoDate(row.stopped_at) : undefined,
        stopRequestedAt: row.stop_requested_at ? toIsoDate(row.stop_requested_at) : undefined,
        exitCode: row.exit_code ?? undefined,
        errorMessage: row.error_message ?? undefined,
        bestSolutionId: row.best_solution_id ?? undefined,
        createdBy: row.created_by,
        createdAt: toIsoDate(row.created_at),
        updatedAt: toIsoDate(row.updated_at)
    };
}

function mapPlanningExecutionLogRow(row: PlanningExecutionLogRow): PlanningExecutionLogRecord {
    return {
        id: row.id,
        executionId: row.execution_id,
        sequence: Number(row.sequence),
        level: row.level,
        stream: row.stream ?? undefined,
        message: row.message,
        executionStatus: row.execution_status ?? undefined,
        createdAt: toIsoDate(row.created_at)
    };
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const database = getPool();
    const [rows] = await database.execute<ExistsRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = ?
          AND column_name = ?
    `, [env.mysql.database, tableName, columnName]);

    return Number(rows[0]?.count ?? 0) > 0;
}

async function isColumnNullable(tableName: string, columnName: string): Promise<boolean> {
    const database = getPool();
    const [rows] = await database.execute<IsNullableRow[]>(`
        SELECT IS_NULLABLE
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
    `, [env.mysql.database, tableName, columnName]);

    return rows[0]?.IS_NULLABLE === 'YES';
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
    const database = getPool();
    const [rows] = await database.execute<ExistsRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.statistics
        WHERE table_schema = ?
          AND table_name = ?
          AND index_name = ?
    `, [env.mysql.database, tableName, indexName]);

    return Number(rows[0]?.count ?? 0) > 0;
}

async function foreignKeyExists(tableName: string, constraintName: string): Promise<boolean> {
    const database = getPool();
    const [rows] = await database.execute<ExistsRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.table_constraints
        WHERE table_schema = ?
          AND table_name = ?
          AND constraint_name = ?
          AND constraint_type = 'FOREIGN KEY'
    `, [env.mysql.database, tableName, constraintName]);

    return Number(rows[0]?.count ?? 0) > 0;
}

async function tableExists(tableName: string): Promise<boolean> {
    const database = getPool();
    const [rows] = await database.execute<ExistsRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name = ?
    `, [env.mysql.database, tableName]);

    return Number(rows[0]?.count ?? 0) > 0;
}

async function ensureSchema(): Promise<void> {
    let adminConnection: Connection | null = null;
    try {
        adminConnection = await mysql.createConnection({
            host: env.mysql.host,
            port: env.mysql.port,
            user: env.mysql.user,
            password: env.mysql.password
        });

        await adminConnection.query(
            `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(env.mysql.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } catch (error) {
        console.warn(
            `Impossible de créer automatiquement la base "${env.mysql.database}". ` +
            'La base doit déjà exister si l’utilisateur MySQL n’a pas le droit CREATE.',
            error instanceof Error ? error.message : error
        );
    } finally {
        await adminConnection?.end();
    }

    pool = mysql.createPool({
        host: env.mysql.host,
        port: env.mysql.port,
        user: env.mysql.user,
        password: env.mysql.password,
        database: env.mysql.database,
        connectionLimit: env.mysql.connectionLimit,
        waitForConnections: true
    });

    const database = getPool();

    await database.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            email VARCHAR(191) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await database.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_sessions_user_id (user_id),
            INDEX idx_sessions_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await database.query(`
        CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NULL,
            name VARCHAR(191) NOT NULL,
            description TEXT NOT NULL,
            color VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_projects_user_id (user_id),
            INDEX idx_projects_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create plannings table with user_id (new schema)
    await database.query(`
        CREATE TABLE IF NOT EXISTS plannings (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NULL,
            project_id VARCHAR(36) NULL,
            title VARCHAR(191) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            current_step INT NOT NULL DEFAULT 1,
            total_steps INT NOT NULL DEFAULT 8,
            progress INT NOT NULL DEFAULT 0,
            wizard_data JSON NULL,
            badges JSON NULL,
            solution_output LONGTEXT NULL,
            solution_warnings JSON NULL,
            solution_solve_time_ms INT NULL,
            last_error JSON NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_plannings_user_id (user_id),
            INDEX idx_plannings_project_id (project_id),
            INDEX idx_plannings_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await database.query(`
        CREATE TABLE IF NOT EXISTS planning_executions (
            id VARCHAR(36) PRIMARY KEY,
            planning_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
            solver VARCHAR(191) NOT NULL,
            source_snapshot LONGTEXT NULL,
            started_at DATETIME NULL,
            ended_at DATETIME NULL,
            stopped_at DATETIME NULL,
            stop_requested_at DATETIME NULL,
            exit_code INT NULL,
            error_message TEXT NULL,
            best_solution_id VARCHAR(36) NULL,
            created_by VARCHAR(36) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_planning_executions_planning FOREIGN KEY (planning_id) REFERENCES plannings(id) ON DELETE CASCADE,
            CONSTRAINT fk_planning_executions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_planning_executions_planning_status (planning_id, status),
            INDEX idx_planning_executions_user_started (user_id, started_at),
            INDEX idx_planning_executions_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await database.query(`
        CREATE TABLE IF NOT EXISTS planning_solution_versions (
            id VARCHAR(36) PRIMARY KEY,
            planning_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            execution_id VARCHAR(36) NULL,
            version_number INT NULL,
            solution_kind VARCHAR(32) NULL,
            status VARCHAR(32) NULL,
            objective_value DOUBLE NULL,
            solver VARCHAR(191) NOT NULL,
            source_snapshot LONGTEXT NULL,
            solution_output LONGTEXT NOT NULL,
            solution_warnings JSON NULL,
            raw_output LONGTEXT NULL,
            decoded_solution_json JSON NULL,
            report_json JSON NULL,
            decode_error TEXT NULL,
            solve_time_ms INT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_solution_versions_planning FOREIGN KEY (planning_id) REFERENCES plannings(id) ON DELETE CASCADE,
            CONSTRAINT fk_solution_versions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_solution_versions_execution FOREIGN KEY (execution_id) REFERENCES planning_executions(id) ON DELETE SET NULL,
            INDEX idx_solution_versions_planning_id (planning_id),
            INDEX idx_solution_versions_user_id (user_id),
            INDEX idx_solution_versions_created_at (created_at),
            INDEX idx_solution_versions_execution_version (execution_id, version_number),
            INDEX idx_solution_versions_execution_status (execution_id, status),
            INDEX idx_solution_versions_planning_execution (planning_id, execution_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await database.query(`
        CREATE TABLE IF NOT EXISTS planning_execution_logs (
            id VARCHAR(36) PRIMARY KEY,
            execution_id VARCHAR(36) NOT NULL,
            sequence INT NOT NULL,
            level VARCHAR(32) NOT NULL,
            stream VARCHAR(32) NULL,
            message LONGTEXT NOT NULL,
            execution_status VARCHAR(32) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_execution_logs_execution FOREIGN KEY (execution_id) REFERENCES planning_executions(id) ON DELETE CASCADE,
            INDEX idx_execution_logs_execution_sequence (execution_id, sequence),
            INDEX idx_execution_logs_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Badge definitions table
    if (!(await tableExists('tag_definitions'))) {
        await database.query(`
            CREATE TABLE tag_definitions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                name VARCHAR(191) NOT NULL,
                color VARCHAR(32) NOT NULL DEFAULT '#38bdf8',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_tag_definitions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_tag_definitions_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    // --- Migrations for existing projects table ---
    if (!(await columnExists('projects', 'user_id'))) {
        await database.query('ALTER TABLE projects ADD COLUMN user_id VARCHAR(36) NULL AFTER id');
    }
    if (!(await indexExists('projects', 'idx_projects_user_id'))) {
        await database.query('ALTER TABLE projects ADD INDEX idx_projects_user_id (user_id)');
    }
    if (!(await indexExists('projects', 'idx_projects_updated_at'))) {
        await database.query('ALTER TABLE projects ADD INDEX idx_projects_updated_at (updated_at)');
    }
    if (!(await foreignKeyExists('projects', 'fk_projects_user'))) {
        await database.query('ALTER TABLE projects ADD CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    }

    // --- Migrations for plannings table ---
    if (!(await columnExists('plannings', 'user_id'))) {
        await database.query('ALTER TABLE plannings ADD COLUMN user_id VARCHAR(36) NULL AFTER id');
        // Backfill user_id from project ownership
        await database.query(`
            UPDATE plannings
            INNER JOIN projects ON projects.id = plannings.project_id
            SET plannings.user_id = projects.user_id
            WHERE plannings.user_id IS NULL AND projects.user_id IS NOT NULL
        `);
    }
    if (!(await indexExists('plannings', 'idx_plannings_user_id'))) {
        await database.query('ALTER TABLE plannings ADD INDEX idx_plannings_user_id (user_id)');
    }
    if (!(await columnExists('plannings', 'badges'))) {
        await database.query('ALTER TABLE plannings ADD COLUMN badges JSON NULL AFTER wizard_data');
    }
    if (!(await columnExists('plannings', 'solution_solve_time_ms'))) {
        await database.query('ALTER TABLE plannings ADD COLUMN solution_solve_time_ms INT NULL AFTER solution_warnings');
    }
    // Make project_id nullable if it isn't already
    if (await columnExists('plannings', 'project_id') && !(await isColumnNullable('plannings', 'project_id'))) {
        // Drop FK first if it exists, then alter column
        if (await foreignKeyExists('plannings', 'fk_plannings_project')) {
            await database.query('ALTER TABLE plannings DROP FOREIGN KEY fk_plannings_project');
        }
        await database.query('ALTER TABLE plannings MODIFY project_id VARCHAR(36) NULL');
    }
    if (!(await columnExists('plannings', 'badges'))) {
        await database.query('ALTER TABLE plannings ADD COLUMN badges JSON NULL AFTER wizard_data');
    }

    // --- Migrations for execution tracking tables ---
    if (!(await columnExists('planning_solution_versions', 'execution_id'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN execution_id VARCHAR(36) NULL AFTER user_id');
    }
    if (!(await columnExists('planning_solution_versions', 'version_number'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN version_number INT NULL AFTER execution_id');
    }
    if (!(await columnExists('planning_solution_versions', 'solution_kind'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN solution_kind VARCHAR(32) NULL AFTER version_number');
    }
    if (!(await columnExists('planning_solution_versions', 'status'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN status VARCHAR(32) NULL AFTER solution_kind');
    }
    if (!(await columnExists('planning_solution_versions', 'objective_value'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN objective_value DOUBLE NULL AFTER status');
    }
    if (!(await columnExists('planning_solution_versions', 'raw_output'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN raw_output LONGTEXT NULL AFTER solution_warnings');
    }
    if (!(await columnExists('planning_solution_versions', 'decoded_solution_json'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN decoded_solution_json JSON NULL AFTER raw_output');
    }
    if (!(await columnExists('planning_solution_versions', 'report_json'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN report_json JSON NULL AFTER decoded_solution_json');
    }
    if (!(await columnExists('planning_solution_versions', 'decode_error'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD COLUMN decode_error TEXT NULL AFTER report_json');
    }
    if (!(await indexExists('planning_executions', 'idx_planning_executions_planning_status'))) {
        await database.query('ALTER TABLE planning_executions ADD INDEX idx_planning_executions_planning_status (planning_id, status)');
    }
    if (!(await indexExists('planning_executions', 'idx_planning_executions_user_started'))) {
        await database.query('ALTER TABLE planning_executions ADD INDEX idx_planning_executions_user_started (user_id, started_at)');
    }
    if (!(await indexExists('planning_execution_logs', 'idx_execution_logs_execution_sequence'))) {
        await database.query('ALTER TABLE planning_execution_logs ADD INDEX idx_execution_logs_execution_sequence (execution_id, sequence)');
    }
    if (!(await indexExists('planning_solution_versions', 'idx_solution_versions_execution_version'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD INDEX idx_solution_versions_execution_version (execution_id, version_number)');
    }
    if (!(await indexExists('planning_solution_versions', 'idx_solution_versions_execution_status'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD INDEX idx_solution_versions_execution_status (execution_id, status)');
    }
    if (!(await indexExists('planning_solution_versions', 'idx_solution_versions_planning_execution'))) {
        await database.query('ALTER TABLE planning_solution_versions ADD INDEX idx_solution_versions_planning_execution (planning_id, execution_id)');
    }
}

export async function initializeDatabase(): Promise<void> {
    if (pool) {
        return;
    }

    await ensureSchema();
}

export async function pingDatabase(): Promise<boolean> {
    try {
        const database = getPool();
        await database.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

export async function createUser(input: UserInput): Promise<UserRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO users (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
    `, [id, input.name, input.email, input.passwordHash]);

    const user = await getUserById(id);
    if (!user) {
        throw new Error('The user was created but could not be reloaded.');
    }

    return user;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<UserRow[]>(`
        SELECT id, name, email, password_hash, created_at, updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
    `, [id]);

    return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function getAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<UserRow[]>(`
        SELECT id, name, email, password_hash, created_at, updated_at
        FROM users
        WHERE email = ?
        LIMIT 1
    `, [email]);

    return rows[0] ? mapAuthUserRow(rows[0]) : null;
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<UserRecord | null> {
    const fields: string[] = [];
    const params: string[] = [];

    if (input.name !== undefined) {
        fields.push('name = ?');
        params.push(input.name);
    }
    if (input.email !== undefined) {
        fields.push('email = ?');
        params.push(input.email);
    }

    if (fields.length === 0) {
        return getUserById(id);
    }

    const database = getPool();
    params.push(id);
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE users
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, params);

    if (result.affectedRows === 0) {
        return null;
    }

    return getUserById(id);
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO sessions (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
    `, [id, userId, tokenHash, expiresAt]);

    return {
        id,
        userId,
        tokenHash,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
    };
}

export async function getSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<SessionRow[]>(`
        SELECT
            sessions.id,
            sessions.user_id,
            sessions.token_hash,
            sessions.expires_at,
            sessions.created_at,
            users.name AS user_name,
            users.email AS user_email,
            users.created_at AS user_created_at,
            users.updated_at AS user_updated_at
        FROM sessions
        INNER JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        LIMIT 1
    `, [tokenHash]);

    return rows[0] ? mapSessionRow(rows[0]) : null;
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return result.affectedRows > 0;
}

export async function refreshSessionExpiryByTokenHash(tokenHash: string, expiresAt: Date): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE sessions
        SET expires_at = ?
        WHERE token_hash = ?
    `, [expiresAt, tokenHash]);
    return result.affectedRows > 0;
}

export async function deleteExpiredSessions(): Promise<void> {
    const database = getPool();
    await database.execute<ResultSetHeader>('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
}

export async function listProjects(userId: string): Promise<ProjectRecord[]> {
    const database = getPool();
    const [rows] = await database.execute<ProjectRow[]>(`
        SELECT
            projects.id,
            projects.user_id,
            projects.name,
            projects.description,
            projects.status,
            projects.color,
            COUNT(plannings.id) AS planCount,
            projects.created_at,
            projects.updated_at
        FROM projects
        LEFT JOIN plannings ON plannings.project_id = projects.id
        WHERE projects.user_id = ?
        GROUP BY projects.id, projects.user_id, projects.name, projects.description, projects.status, projects.color, projects.created_at, projects.updated_at
        ORDER BY projects.updated_at DESC
    `, [userId]);

    return rows.map(mapProjectRow);
}

export async function getProjectById(id: string, userId: string): Promise<ProjectRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<ProjectRow[]>(`
        SELECT
            projects.id,
            projects.user_id,
            projects.name,
            projects.description,
            projects.status,
            projects.color,
            COUNT(plannings.id) AS planCount,
            projects.created_at,
            projects.updated_at
        FROM projects
        LEFT JOIN plannings ON plannings.project_id = projects.id
        WHERE projects.id = ?
          AND projects.user_id = ?
        GROUP BY projects.id, projects.user_id, projects.name, projects.description, projects.status, projects.color, projects.created_at, projects.updated_at
        LIMIT 1
    `, [id, userId]);

    return rows[0] ? mapProjectRow(rows[0]) : null;
}

export async function createProject(userId: string, input: ProjectInput): Promise<ProjectRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO projects (id, user_id, name, description, color, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, input.name, input.description, input.color, input.status ?? 'active']);

    const project = await getProjectById(id, userId);
    if (!project) {
        throw new Error('The project was created but could not be reloaded.');
    }

    return project;
}

export async function updateProject(id: string, userId: string, input: ProjectUpdateInput): Promise<ProjectRecord | null> {
    const fields: string[] = [];
    const params: string[] = [];

    if (input.name !== undefined) {
        fields.push('name = ?');
        params.push(input.name);
    }
    if (input.description !== undefined) {
        fields.push('description = ?');
        params.push(input.description);
    }
    if (input.color !== undefined) {
        fields.push('color = ?');
        params.push(input.color);
    }
    if (input.status !== undefined) {
        fields.push('status = ?');
        params.push(input.status);
    }

    if (fields.length === 0) {
        return getProjectById(id, userId);
    }

    const database = getPool();
    params.push(id, userId);
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE projects
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
    `, params);

    if (result.affectedRows === 0) {
        return null;
    }

    return getProjectById(id, userId);
}

export async function deleteProject(id: string, userId: string): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>(
        'DELETE FROM projects WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    return result.affectedRows > 0;
}

// ─── Tag Definitions ──────────────────────────────────────────────────────────

export async function listTagDefinitions(userId: string): Promise<TagDefinitionRecord[]> {
    const database = getPool();
    const [rows] = await database.execute<TagDefinitionRow[]>(`
        SELECT id, user_id, name, color, created_at
        FROM tag_definitions
        WHERE user_id = ?
        ORDER BY name ASC
    `, [userId]);

    return rows.map(mapTagDefinitionRow);
}

export async function createTagDefinition(userId: string, input: TagDefinitionInput): Promise<TagDefinitionRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO tag_definitions (id, user_id, name, color)
        VALUES (?, ?, ?, ?)
    `, [id, userId, input.name.trim(), input.color]);

    const tag = await getTagDefinitionById(id, userId);
    if (!tag) {
        throw new Error('The tag was created but could not be reloaded.');
    }

    return tag;
}

export async function getTagDefinitionById(id: string, userId: string): Promise<TagDefinitionRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<TagDefinitionRow[]>(`
        SELECT id, user_id, name, color, created_at
        FROM tag_definitions
        WHERE id = ? AND user_id = ?
        LIMIT 1
    `, [id, userId]);

    return rows[0] ? mapTagDefinitionRow(rows[0]) : null;
}

export async function deleteTagDefinition(id: string, userId: string): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>(
        'DELETE FROM tag_definitions WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    return result.affectedRows > 0;
}

// ─── Plannings ────────────────────────────────────────────────────────────────

const PLANNING_SELECT = `
    plannings.id,
    plannings.user_id,
    plannings.title,
    plannings.project_id,
    NULL AS project_name,
    plannings.status,
    plannings.current_step,
    plannings.total_steps,
    plannings.progress,
    plannings.created_at,
    plannings.updated_at,
    plannings.wizard_data,
    plannings.badges,
    plannings.solution_output,
    plannings.solution_warnings,
    plannings.solution_solve_time_ms,
    plannings.last_error
`;

const EXECUTION_ACTIVE_STATUSES: PlanningExecutionStatus[] = [
    'PENDING',
    'RUNNING',
    'SOLUTION_FOUND',
    'OPTIMIZING',
    'STOP_REQUESTED',
    'STOPPING'
];

const EXECUTION_SELECT = `
    id,
    planning_id,
    user_id,
    status,
    solver,
    source_snapshot,
    started_at,
    ended_at,
    stopped_at,
    stop_requested_at,
    exit_code,
    error_message,
    best_solution_id,
    created_by,
    created_at,
    updated_at
`;

const SOLUTION_VERSION_SELECT = `
    id,
    planning_id,
    user_id,
    execution_id,
    version_number,
    solution_kind,
    status,
    objective_value,
    solver,
    source_snapshot,
    solution_output,
    solution_warnings,
    raw_output,
    decoded_solution_json,
    report_json,
    decode_error,
    solve_time_ms,
    created_at
`;

type DatabaseExecutor = Pool | PoolConnection;

export async function listPlannings(userId: string): Promise<PlanningRecord[]> {
    const database = getPool();
    const [rows] = await database.execute<PlanningRow[]>(`
        SELECT ${PLANNING_SELECT}
        FROM plannings
        WHERE plannings.user_id = ?
        ORDER BY plannings.updated_at DESC
    `, [userId]);

    return rows.map(mapPlanningRow);
}

export async function getPlanningById(id: string, userId: string): Promise<PlanningRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<PlanningRow[]>(`
        SELECT ${PLANNING_SELECT}
        FROM plannings
        WHERE plannings.id = ?
          AND plannings.user_id = ?
        LIMIT 1
    `, [id, userId]);

    return rows[0] ? mapPlanningRow(rows[0]) : null;
}

export async function createPlanning(userId: string, input: PlanningInput): Promise<PlanningRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO plannings (
            id,
            user_id,
            project_id,
            title,
            status,
            current_step,
            total_steps,
            progress,
            wizard_data,
            badges
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        userId,
        input.projectId ?? null,
        input.title,
        input.status ?? 'draft',
        input.currentStep ?? 1,
        input.totalSteps ?? 8,
        input.progress ?? 0,
        JSON.stringify(input.data ?? null),
        JSON.stringify(input.badges ?? [])
    ]);

    const planning = await getPlanningById(id, userId);
    if (!planning) {
        throw new Error('The planning was created but could not be reloaded.');
    }

    return planning;
}

export async function updatePlanning(id: string, userId: string, input: PlanningUpdateInput): Promise<PlanningRecord | null> {
    const fields: string[] = [];
    const params: Array<number | string | null> = [];

    if (input.title !== undefined) {
        fields.push('plannings.title = ?');
        params.push(input.title);
    }
    if (input.projectId !== undefined) {
        fields.push('plannings.project_id = ?');
        params.push(input.projectId);
    }
    if (input.status !== undefined) {
        fields.push('plannings.status = ?');
        params.push(input.status);
    }
    if (input.currentStep !== undefined) {
        fields.push('plannings.current_step = ?');
        params.push(input.currentStep);
    }
    if (input.totalSteps !== undefined) {
        fields.push('plannings.total_steps = ?');
        params.push(input.totalSteps);
    }
    if (input.progress !== undefined) {
        fields.push('plannings.progress = ?');
        params.push(input.progress);
    }
    if (input.data !== undefined) {
        fields.push('plannings.wizard_data = ?');
        params.push(JSON.stringify(input.data));
    }
    if (input.badges !== undefined) {
        fields.push('plannings.badges = ?');
        params.push(JSON.stringify(input.badges));
    }
    if (input.solutionOutput !== undefined) {
        fields.push('plannings.solution_output = ?');
        params.push(input.solutionOutput);
    }
    if (input.solutionWarnings !== undefined) {
        fields.push('plannings.solution_warnings = ?');
        params.push(input.solutionWarnings ? JSON.stringify(input.solutionWarnings) : null);
    }
    if (input.solutionSolveTimeMs !== undefined) {
        fields.push('plannings.solution_solve_time_ms = ?');
        params.push(input.solutionSolveTimeMs ?? null);
    }
    if (input.lastError !== undefined) {
        fields.push('plannings.last_error = ?');
        params.push(input.lastError ? JSON.stringify(input.lastError) : null);
    }

    if (fields.length === 0) {
        return getPlanningById(id, userId);
    }

    const database = getPool();
    params.push(id, userId);
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE plannings
        SET ${fields.join(', ')}, plannings.updated_at = CURRENT_TIMESTAMP
        WHERE plannings.id = ?
          AND plannings.user_id = ?
    `, params);

    if (result.affectedRows === 0) {
        return null;
    }

    return getPlanningById(id, userId);
}

export async function deletePlanning(id: string, userId: string): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>(
        'DELETE FROM plannings WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    return result.affectedRows > 0;
}

async function getPlanningExecutionByIdUsing(
    database: DatabaseExecutor,
    id: string,
    userId: string
): Promise<PlanningExecutionRecord | null> {
    const [rows] = await database.execute<PlanningExecutionRow[]>(`
        SELECT ${EXECUTION_SELECT}
        FROM planning_executions
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    `, [id, userId]);

    return rows[0] ? mapPlanningExecutionRow(rows[0]) : null;
}

async function getPlanningSolutionVersionByIdUsing(
    database: DatabaseExecutor,
    id: string,
    userId: string
): Promise<PlanningSolutionVersionRecord | null> {
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT ${SOLUTION_VERSION_SELECT}
        FROM planning_solution_versions
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    `, [id, userId]);

    return rows[0] ? mapPlanningSolutionVersionRow(rows[0]) : null;
}

export async function createPlanningExecutionLocked(
    userId: string,
    input: PlanningExecutionInput
): Promise<
    | { ok: true; execution: PlanningExecutionRecord }
    | { ok: false; reason: 'NOT_FOUND' | 'ACTIVE_EXISTS'; activeExecutionId?: string }
> {
    const database = getPool();
    const connection = await database.getConnection();
    const id = randomUUID();

    try {
        await connection.beginTransaction();

        const [planningRows] = await connection.execute<RowDataPacket[]>(`
            SELECT id
            FROM plannings
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
            FOR UPDATE
        `, [input.planningId, userId]);

        if (!planningRows[0]) {
            await connection.rollback();
            return { ok: false, reason: 'NOT_FOUND' };
        }

        const activePlaceholders = EXECUTION_ACTIVE_STATUSES.map(() => '?').join(', ');
        const [activeRows] = await connection.execute<RowDataPacket[]>(`
            SELECT id
            FROM planning_executions
            WHERE planning_id = ?
              AND user_id = ?
              AND status IN (${activePlaceholders})
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
        `, [input.planningId, userId, ...EXECUTION_ACTIVE_STATUSES]);

        if (activeRows[0]) {
            await connection.rollback();
            return {
                ok: false,
                reason: 'ACTIVE_EXISTS',
                activeExecutionId: String(activeRows[0].id)
            };
        }

        await connection.execute<ResultSetHeader>(`
            INSERT INTO planning_executions (
                id,
                planning_id,
                user_id,
                status,
                solver,
                source_snapshot,
                created_by
            )
            VALUES (?, ?, ?, 'PENDING', ?, ?, ?)
        `, [
            id,
            input.planningId,
            userId,
            input.solver,
            input.sourceSnapshot ?? null,
            input.createdBy
        ]);

        const execution = await getPlanningExecutionByIdUsing(connection, id, userId);
        if (!execution) {
            throw new Error('The execution was created but could not be reloaded.');
        }

        await connection.commit();
        return { ok: true, execution };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function updatePlanningExecution(
    id: string,
    userId: string,
    input: PlanningExecutionUpdateInput
): Promise<PlanningExecutionRecord | null> {
    const fields: string[] = [];
    const params: Array<string | number | Date | null> = [];

    if (input.status !== undefined) {
        fields.push('status = ?');
        params.push(input.status);
    }
    if (input.startedAt !== undefined) {
        fields.push('started_at = ?');
        params.push(input.startedAt);
    }
    if (input.endedAt !== undefined) {
        fields.push('ended_at = ?');
        params.push(input.endedAt);
    }
    if (input.stoppedAt !== undefined) {
        fields.push('stopped_at = ?');
        params.push(input.stoppedAt);
    }
    if (input.stopRequestedAt !== undefined) {
        fields.push('stop_requested_at = ?');
        params.push(input.stopRequestedAt);
    }
    if (input.exitCode !== undefined) {
        fields.push('exit_code = ?');
        params.push(input.exitCode);
    }
    if (input.errorMessage !== undefined) {
        fields.push('error_message = ?');
        params.push(input.errorMessage);
    }
    if (input.bestSolutionId !== undefined) {
        fields.push('best_solution_id = ?');
        params.push(input.bestSolutionId);
    }

    if (fields.length === 0) {
        return getPlanningExecutionById(id, userId);
    }

    const database = getPool();
    params.push(id, userId);
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE planning_executions
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
    `, params);

    if (result.affectedRows === 0) {
        return null;
    }

    return getPlanningExecutionById(id, userId);
}

export async function getPlanningExecutionById(
    id: string,
    userId: string
): Promise<PlanningExecutionRecord | null> {
    return getPlanningExecutionByIdUsing(getPool(), id, userId);
}

export async function listPlanningExecutions(
    planningId: string,
    userId: string,
    options?: { activeOnly?: boolean; limit?: number }
): Promise<PlanningExecutionRecord[]> {
    const database = getPool();
    const params: Array<string | number> = [planningId, userId];
    const activeClause = options?.activeOnly
        ? `AND status IN (${EXECUTION_ACTIVE_STATUSES.map(() => '?').join(', ')})`
        : '';
    if (options?.activeOnly) {
        params.push(...EXECUTION_ACTIVE_STATUSES);
    }
    const limit = Math.max(1, Math.min(100, Math.floor(options?.limit ?? 25)));

    const [rows] = await database.execute<PlanningExecutionRow[]>(`
        SELECT ${EXECUTION_SELECT}
        FROM planning_executions
        WHERE planning_id = ?
          AND user_id = ?
          ${activeClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
    `, params);

    return rows.map(mapPlanningExecutionRow);
}

export async function getLatestPlanningExecution(
    planningId: string,
    userId: string
): Promise<PlanningExecutionRecord | null> {
    const executions = await listPlanningExecutions(planningId, userId, { limit: 1 });
    return executions[0] ?? null;
}

export async function appendPlanningExecutionLog(input: PlanningExecutionLogInput): Promise<PlanningExecutionLogRecord> {
    const database = getPool();
    const connection = await database.getConnection();
    const id = randomUUID();

    try {
        await connection.beginTransaction();
        await connection.execute<RowDataPacket[]>(`
            SELECT id
            FROM planning_executions
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        `, [input.executionId]);

        const [sequenceRows] = await connection.execute<ExistsRow[]>(`
            SELECT COALESCE(MAX(sequence), 0) + 1 AS count
            FROM planning_execution_logs
            WHERE execution_id = ?
        `, [input.executionId]);
        const sequence = Number(sequenceRows[0]?.count ?? 1);

        await connection.execute<ResultSetHeader>(`
            INSERT INTO planning_execution_logs (
                id,
                execution_id,
                sequence,
                level,
                stream,
                message,
                execution_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            input.executionId,
            sequence,
            input.level,
            input.stream ?? null,
            input.message,
            input.executionStatus ?? null
        ]);

        const [rows] = await connection.execute<PlanningExecutionLogRow[]>(`
            SELECT id, execution_id, sequence, level, stream, message, execution_status, created_at
            FROM planning_execution_logs
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (!rows[0]) {
            throw new Error('The execution log was created but could not be reloaded.');
        }

        await connection.commit();
        return mapPlanningExecutionLogRow(rows[0]);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function listPlanningExecutionLogs(
    planningId: string,
    executionId: string,
    userId: string,
    options?: { afterSequence?: number; limit?: number }
): Promise<PlanningExecutionLogRecord[]> {
    const database = getPool();
    const params: Array<string | number> = [executionId, planningId, userId];
    const afterClause = typeof options?.afterSequence === 'number' && Number.isFinite(options.afterSequence)
        ? 'AND planning_execution_logs.sequence > ?'
        : '';
    if (afterClause) {
        params.push(Math.max(0, Math.floor(options!.afterSequence!)));
    }
    const limit = Math.max(1, Math.min(5_000, Math.floor(options?.limit ?? 1_000)));

    const [rows] = await database.execute<PlanningExecutionLogRow[]>(`
        SELECT
            planning_execution_logs.id,
            planning_execution_logs.execution_id,
            planning_execution_logs.sequence,
            planning_execution_logs.level,
            planning_execution_logs.stream,
            planning_execution_logs.message,
            planning_execution_logs.execution_status,
            planning_execution_logs.created_at
        FROM planning_execution_logs
        INNER JOIN planning_executions ON planning_executions.id = planning_execution_logs.execution_id
        WHERE planning_execution_logs.execution_id = ?
          AND planning_executions.planning_id = ?
          AND planning_executions.user_id = ?
          ${afterClause}
        ORDER BY planning_execution_logs.sequence ASC
        LIMIT ${limit}
    `, params);

    return rows.map(mapPlanningExecutionLogRow);
}

export async function markOrphanedPlanningExecutionsUnknown(): Promise<number> {
    const database = getPool();
    const placeholders = EXECUTION_ACTIVE_STATUSES.map(() => '?').join(', ');
    const [result] = await database.execute<ResultSetHeader>(`
        UPDATE planning_executions
        SET status = 'UNKNOWN',
            ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
            error_message = COALESCE(error_message, 'Le serveur a redémarré pendant cette exécution. Le processus MiniZinc n’est plus attaché.')
        WHERE status IN (${placeholders})
    `, EXECUTION_ACTIVE_STATUSES);
    return result.affectedRows;
}

export async function createPlanningSolutionVersion(
    userId: string,
    input: PlanningSolutionVersionInput
): Promise<PlanningSolutionVersionRecord> {
    const database = getPool();
    const connection = input.executionId ? await database.getConnection() : null;
    const executor = connection ?? database;
    const id = randomUUID();

    try {
        if (connection) {
            await connection.beginTransaction();
        }

        let versionNumber = input.versionNumber ?? null;
        if (!versionNumber && input.executionId) {
            const [versionRows] = await executor.execute<ExistsRow[]>(`
                SELECT COALESCE(MAX(version_number), 0) + 1 AS count
                FROM planning_solution_versions
                WHERE execution_id = ?
            `, [input.executionId]);
            versionNumber = Number(versionRows[0]?.count ?? 1);
        }

        const initialStatus = input.status
            ?? (input.decodeError ? 'DECODE_FAILED' : 'INTERMEDIATE');
        const initialKind = input.solutionKind
            ?? (initialStatus === 'DECODE_FAILED' ? 'intermediate' : 'intermediate');

        await executor.execute<ResultSetHeader>(`
            INSERT INTO planning_solution_versions (
                id,
                planning_id,
                user_id,
                execution_id,
                version_number,
                solution_kind,
                status,
                objective_value,
                solver,
                source_snapshot,
                solution_output,
                solution_warnings,
                raw_output,
                decoded_solution_json,
                report_json,
                decode_error,
                solve_time_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            input.planningId,
            userId,
            input.executionId ?? null,
            versionNumber,
            initialKind,
            initialStatus,
            input.objectiveValue ?? null,
            input.solver,
            input.sourceSnapshot ?? null,
            input.solutionOutput,
            input.solutionWarnings ? JSON.stringify(input.solutionWarnings) : null,
            input.rawOutput ?? input.solutionOutput,
            input.decodedSolutionJson === undefined ? null : JSON.stringify(input.decodedSolutionJson),
            input.reportJson === undefined ? null : JSON.stringify(input.reportJson),
            input.decodeError ?? null,
            input.solveTimeMs ?? null
        ]);

        if (input.executionId && !input.decodeError) {
            const [executionRows] = await executor.execute<PlanningExecutionRow[]>(`
                SELECT ${EXECUTION_SELECT}
                FROM planning_executions
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
                FOR UPDATE
            `, [input.executionId, userId]);
            const execution = executionRows[0];
            let shouldPromote = !execution?.best_solution_id;

            if (execution?.best_solution_id) {
                const currentBest = await getPlanningSolutionVersionByIdUsing(executor, execution.best_solution_id, userId);
                const currentObjective = currentBest?.objectiveValue;
                const nextObjective = input.objectiveValue ?? null;
                if (nextObjective !== null && currentObjective !== undefined) {
                    shouldPromote = nextObjective < currentObjective;
                } else if (nextObjective !== null && currentObjective === undefined) {
                    shouldPromote = true;
                } else if (nextObjective === null && currentObjective === undefined) {
                    shouldPromote = true;
                }
            }

            if (shouldPromote) {
                if (execution?.best_solution_id) {
                    await executor.execute<ResultSetHeader>(`
                        UPDATE planning_solution_versions
                        SET status = 'INTERMEDIATE',
                            solution_kind = 'intermediate'
                        WHERE id = ?
                          AND status = 'BEST_CURRENT'
                    `, [execution.best_solution_id]);
                }

                await executor.execute<ResultSetHeader>(`
                    UPDATE planning_solution_versions
                    SET status = 'BEST_CURRENT',
                        solution_kind = 'best_current'
                    WHERE id = ?
                `, [id]);

                await executor.execute<ResultSetHeader>(`
                    UPDATE planning_executions
                    SET best_solution_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                      AND user_id = ?
                `, [id, input.executionId, userId]);
            }
        }

        const solution = await getPlanningSolutionVersionByIdUsing(executor, id, userId);
        if (!solution) {
            throw new Error('The planning solution version was created but could not be reloaded.');
        }

        if (connection) {
            await connection.commit();
        }

        return solution;
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error;
    } finally {
        connection?.release();
    }
}

export async function listPlanningSolutionVersions(
    planningId: string,
    userId: string
): Promise<PlanningSolutionVersionRecord[]> {
    const database = getPool();
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT ${SOLUTION_VERSION_SELECT}
        FROM planning_solution_versions
        WHERE planning_id = ?
          AND user_id = ?
        ORDER BY created_at DESC, COALESCE(version_number, 0) DESC
    `, [planningId, userId]);

    return rows.map(mapPlanningSolutionVersionRow);
}

export async function listPlanningSolutions(
    planningId: string,
    userId: string,
    options?: { executionId?: string }
): Promise<PlanningSolutionVersionRecord[]> {
    const database = getPool();
    const params = options?.executionId
        ? [planningId, userId, options.executionId]
        : [planningId, userId];
    const executionClause = options?.executionId ? 'AND execution_id = ?' : '';
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT ${SOLUTION_VERSION_SELECT}
        FROM planning_solution_versions
        WHERE planning_id = ?
          AND user_id = ?
          ${executionClause}
        ORDER BY COALESCE(version_number, 0) DESC, created_at DESC
    `, params);

    return rows.map(mapPlanningSolutionVersionRow);
}

export async function getPlanningSolutionVersionById(
    id: string,
    planningId: string,
    userId: string
): Promise<PlanningSolutionVersionRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT ${SOLUTION_VERSION_SELECT}
        FROM planning_solution_versions
        WHERE id = ?
          AND planning_id = ?
          AND user_id = ?
        LIMIT 1
    `, [id, planningId, userId]);

    return rows[0] ? mapPlanningSolutionVersionRow(rows[0]) : null;
}

export async function finalizePlanningExecutionSolutions(
    userId: string,
    executionId: string,
    finalStatus: PlanningExecutionStatus
): Promise<PlanningSolutionVersionRecord | null> {
    const database = getPool();
    const connection = await database.getConnection();

    try {
        await connection.beginTransaction();
        const [executionRows] = await connection.execute<PlanningExecutionRow[]>(`
            SELECT ${EXECUTION_SELECT}
            FROM planning_executions
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
            FOR UPDATE
        `, [executionId, userId]);
        const execution = executionRows[0];
        if (!execution?.best_solution_id) {
            await connection.commit();
            return null;
        }

        const finalSolutionStatus: PlanningSolutionStatus =
            finalStatus === 'OPTIMAL'
                ? 'OPTIMAL'
                : finalStatus === 'STOPPED'
                    ? 'STOPPED'
                    : 'FINAL';
        const finalSolutionKind: PlanningSolutionKind =
            finalStatus === 'OPTIMAL'
                ? 'optimal'
                : finalStatus === 'STOPPED'
                    ? 'stopped'
                    : 'final';

        await connection.execute<ResultSetHeader>(`
            UPDATE planning_solution_versions
            SET status = ?,
                solution_kind = ?
            WHERE id = ?
              AND user_id = ?
        `, [finalSolutionStatus, finalSolutionKind, execution.best_solution_id, userId]);

        const best = await getPlanningSolutionVersionByIdUsing(connection, execution.best_solution_id, userId);
        await connection.commit();
        return best;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function deletePlanningSolutionVersion(
    id: string,
    planningId: string,
    userId: string
): Promise<boolean> {
    const database = getPool();
    const [result] = await database.execute<ResultSetHeader>(`
        DELETE FROM planning_solution_versions
        WHERE id = ?
          AND planning_id = ?
          AND user_id = ?
    `, [id, planningId, userId]);

    return result.affectedRows > 0;
}
