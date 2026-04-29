import { randomUUID } from 'node:crypto';

import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

import { env } from './env.js';

export type ProjectStatus = 'active' | 'archived' | 'completed';
export type PlanStatus = 'draft' | 'active' | 'paused' | 'done' | 'error';

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
    solver: string;
    sourceSnapshot?: string;
    solutionOutput: string;
    solutionWarnings: string[];
    solveTimeMs?: number;
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
    solver: string;
    source_snapshot: string | null;
    solution_output: string;
    solution_warnings: unknown;
    solve_time_ms: number | null;
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
    solver: string;
    sourceSnapshot?: string | null;
    solutionOutput: string;
    solutionWarnings?: string[] | null;
    solveTimeMs?: number | null;
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
        solver: row.solver,
        sourceSnapshot: row.source_snapshot ?? undefined,
        solutionOutput: row.solution_output,
        solutionWarnings: parseJson<string[]>(row.solution_warnings, []),
        solveTimeMs: row.solve_time_ms ?? undefined,
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
    const adminConnection = await mysql.createConnection({
        host: env.mysql.host,
        port: env.mysql.port,
        user: env.mysql.user,
        password: env.mysql.password
    });

    await adminConnection.query(
        `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(env.mysql.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await adminConnection.end();

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
        CREATE TABLE IF NOT EXISTS planning_solution_versions (
            id VARCHAR(36) PRIMARY KEY,
            planning_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            solver VARCHAR(191) NOT NULL,
            source_snapshot LONGTEXT NULL,
            solution_output LONGTEXT NOT NULL,
            solution_warnings JSON NULL,
            solve_time_ms INT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_solution_versions_planning FOREIGN KEY (planning_id) REFERENCES plannings(id) ON DELETE CASCADE,
            CONSTRAINT fk_solution_versions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_solution_versions_planning_id (planning_id),
            INDEX idx_solution_versions_user_id (user_id),
            INDEX idx_solution_versions_created_at (created_at)
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

export async function createPlanningSolutionVersion(
    userId: string,
    input: PlanningSolutionVersionInput
): Promise<PlanningSolutionVersionRecord> {
    const database = getPool();
    const id = randomUUID();

    await database.execute<ResultSetHeader>(`
        INSERT INTO planning_solution_versions (
            id,
            planning_id,
            user_id,
            solver,
            source_snapshot,
            solution_output,
            solution_warnings,
            solve_time_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        input.planningId,
        userId,
        input.solver,
        input.sourceSnapshot ?? null,
        input.solutionOutput,
        input.solutionWarnings ? JSON.stringify(input.solutionWarnings) : null,
        input.solveTimeMs ?? null
    ]);

    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT
            id,
            planning_id,
            user_id,
            solver,
            source_snapshot,
            solution_output,
            solution_warnings,
            solve_time_ms,
            created_at
        FROM planning_solution_versions
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    `, [id, userId]);

    if (!rows[0]) {
        throw new Error('The planning solution version was created but could not be reloaded.');
    }

    return mapPlanningSolutionVersionRow(rows[0]);
}

export async function listPlanningSolutionVersions(
    planningId: string,
    userId: string
): Promise<PlanningSolutionVersionRecord[]> {
    const database = getPool();
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT
            id,
            planning_id,
            user_id,
            solver,
            source_snapshot,
            solution_output,
            solution_warnings,
            solve_time_ms,
            created_at
        FROM planning_solution_versions
        WHERE planning_id = ?
          AND user_id = ?
        ORDER BY created_at DESC
    `, [planningId, userId]);

    return rows.map(mapPlanningSolutionVersionRow);
}

export async function getPlanningSolutionVersionById(
    id: string,
    planningId: string,
    userId: string
): Promise<PlanningSolutionVersionRecord | null> {
    const database = getPool();
    const [rows] = await database.execute<PlanningSolutionVersionRow[]>(`
        SELECT
            id,
            planning_id,
            user_id,
            solver,
            source_snapshot,
            solution_output,
            solution_warnings,
            solve_time_ms,
            created_at
        FROM planning_solution_versions
        WHERE id = ?
          AND planning_id = ?
          AND user_id = ?
        LIMIT 1
    `, [id, planningId, userId]);

    return rows[0] ? mapPlanningSolutionVersionRow(rows[0]) : null;
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
