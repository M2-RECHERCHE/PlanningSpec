import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFile(): void {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(currentDir, '..', '.env');

    if (!existsSync(envPath)) {
        return;
    }

    const content = readFileSync(envPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function readInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
}

loadEnvFile();

export const env = {
    port: readInt(process.env.PORT, 4000),
    solver: process.env.MINIZINC_SOLVER ?? 'Highs',
    solverTimeoutMs: readInt(process.env.MINIZINC_TIMEOUT_MS, 3_600_000),
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
    mysql: {
        host: process.env.MYSQL_HOST ?? '127.0.0.1',
        port: readInt(process.env.MYSQL_PORT, 3306),
        user: process.env.MYSQL_USER ?? 'root',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'planning_spec',
        connectionLimit: readInt(process.env.MYSQL_CONNECTION_LIMIT, 10)
    },
    auth: {
        sessionTtlDays: readInt(process.env.AUTH_SESSION_TTL_DAYS, 30),
        tokenBytes: readInt(process.env.AUTH_TOKEN_BYTES, 32)
    }
} as const;

export type ServerEnv = typeof env;
