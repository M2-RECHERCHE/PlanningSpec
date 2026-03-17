import cors from 'cors';
import express from 'express';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createPlanningSpecServices } from 'planning-spec-language';

const execFileAsync = promisify(execFile);

const port = Number(process.env.PORT ?? 4000);
const solver = process.env.MINIZINC_SOLVER ?? 'Highs';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
}));
app.use(express.json({ limit: '1mb' }));

const { shared, PlanningSpec } = createPlanningSpecServices({
    fileSystemProvider: NodeFileSystem.fileSystemProvider
});
const generator = PlanningSpec.generator.Generator;

function normalizeSource(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    if (value && typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return null;
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

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'planning-spec-server', port, solver });
});

app.post('/api/solve', async (req, res) => {
    const source = normalizeSource(req.body?.source ?? req.body);

    if (!source) {
        return res.status(400).json({
            ok: false,
            error: 'No source payload provided. Send either { "source": "..." } or a JSON body matching the PlanningSpec grammar.'
        });
    }

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
            return res.status(422).json({ ok: false, error: 'Validation failed', details: issues });
        }

        const mznPath = generator.generateToFile(document, tmpDir);
        const { stdout, stderr } = await execFileAsync('minizinc', ['--solver', solver, mznPath]);

        return res.json({ ok: true, output: stdout.trim(), warnings: stderr.trim() || undefined });
    } catch (error) {
        const maybeError = error as Error & { stderr?: string; stdout?: string };
        return res.status(500).json({
            ok: false,
            error: maybeError.message,
            details: maybeError.stderr?.trim() || undefined,
            output: maybeError.stdout?.trim() || undefined
        });
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
});

app.get('/', (_req, res) => {
    res.send('🚀 Planning Spec server is running.');
});

app.listen(port, () => {
    console.log(`Planning Spec server listening on http://localhost:${port}`);
});
