export type MiniZincTerminalMarker = 'solution' | 'optimal';

export interface MiniZincSolutionBlock {
    rawOutput: string;
    marker: MiniZincTerminalMarker;
    objectiveValue: number | null;
}

export interface MiniZincStdoutStatus {
    status: 'UNSATISFIABLE' | 'UNKNOWN';
    rawOutput: string;
}

export type MiniZincStdoutEvent =
    | { type: 'solution'; block: MiniZincSolutionBlock }
    | { type: 'status'; status: MiniZincStdoutStatus }
    | { type: 'optimal' };

export interface MiniZincStderrLine {
    level: 'warning' | 'error';
    message: string;
}

const completeSeparatorPattern = /(^|\r?\n)[ \t]*(----------|==========)[ \t]*(\r?\n)/;

export function extractObjectiveValue(rawOutput: string): number | null {
    const match = /(?:^|\r?\n)\s*OBJECTIVE:\s*(?:penalty\s*=\s*)?(-?\d+(?:\.\d+)?)/i.exec(rawOutput);
    if (!match) {
        return null;
    }

    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

export function hasPlanningSolutionLines(rawOutput: string): boolean {
    return rawOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .some(line =>
            /^ACTIVITY:\s+\S+\s+slot=\d+\s+day=\d+/.test(line)
            || /^\S+\s+starts=\d+\s+day=\d+/.test(line)
        );
}

export function isUnsatisfiableMiniZincOutput(rawOutput: string): boolean {
    return /\bUNSATISFIABLE\b/i.test(rawOutput);
}

export function isUnknownMiniZincOutput(rawOutput: string): boolean {
    return /={5}UNKNOWN={5}|\bUNKNOWN\b/i.test(rawOutput);
}

function eventFromBlock(rawOutput: string, marker: MiniZincTerminalMarker): MiniZincStdoutEvent | null {
    const trimmed = rawOutput.trim();
    if (!trimmed) {
        if (marker === 'optimal') {
            return { type: 'optimal' };
        }
        return null;
    }

    if (isUnsatisfiableMiniZincOutput(trimmed)) {
        return {
            type: 'status',
            status: {
                status: 'UNSATISFIABLE',
                rawOutput: trimmed
            }
        };
    }

    if (isUnknownMiniZincOutput(trimmed)) {
        return {
            type: 'status',
            status: {
                status: 'UNKNOWN',
                rawOutput: trimmed
            }
        };
    }

    return {
        type: 'solution',
        block: {
            rawOutput: trimmed,
            marker,
            objectiveValue: extractObjectiveValue(trimmed)
        }
    };
}

export class MiniZincStdoutParser {
    private buffer = '';

    push(chunk: string): MiniZincStdoutEvent[] {
        this.buffer += chunk;
        return this.drainCompleteBlocks();
    }

    flush(): MiniZincStdoutEvent[] {
        const events = this.drainCompleteBlocks();
        const remaining = this.buffer.trim();
        this.buffer = '';

        if (remaining) {
            const event = eventFromBlock(remaining, 'solution');
            if (event) {
                events.push(event);
            }
        }

        return events;
    }

    private drainCompleteBlocks(): MiniZincStdoutEvent[] {
        const events: MiniZincStdoutEvent[] = [];

        while (true) {
            const match = completeSeparatorPattern.exec(this.buffer);
            if (!match || match.index === undefined) {
                break;
            }

            const separatorPrefix = match[1] ?? '';
            const separator = match[2];
            const blockEnd = match.index + separatorPrefix.length;
            const nextBufferStart = match.index + match[0].length;
            const rawBlock = this.buffer.slice(0, blockEnd);
            this.buffer = this.buffer.slice(nextBufferStart);

            const event = eventFromBlock(rawBlock, separator === '==========' ? 'optimal' : 'solution');
            if (event) {
                events.push(event);
            }
        }

        return events;
    }
}

export class MiniZincStderrParser {
    private buffer = '';

    push(chunk: string): MiniZincStderrLine[] {
        this.buffer += chunk;
        const lines: MiniZincStderrLine[] = [];

        while (true) {
            const newlineIndex = this.buffer.search(/\r?\n/);
            if (newlineIndex < 0) {
                break;
            }

            const line = this.buffer.slice(0, newlineIndex).trim();
            const match = /\r?\n/.exec(this.buffer.slice(newlineIndex));
            const separatorLength = match?.[0].length ?? 1;
            this.buffer = this.buffer.slice(newlineIndex + separatorLength);

            if (line) {
                lines.push(classifyMiniZincStderrLine(line));
            }
        }

        return lines;
    }

    flush(): MiniZincStderrLine[] {
        const line = this.buffer.trim();
        this.buffer = '';
        return line ? [classifyMiniZincStderrLine(line)] : [];
    }
}

export function classifyMiniZincStderrLine(message: string): MiniZincStderrLine {
    return {
        level: /warning|deprecated|notice/i.test(message) ? 'warning' : 'error',
        message
    };
}

export function buildMiniZincArgs(input: {
    solver: string;
    mznPath: string;
    timeLimitSeconds?: number;
}): string[] {
    const args = [
        '--solver',
        input.solver,
        '--intermediate-solutions'
    ];

    if (typeof input.timeLimitSeconds === 'number' && Number.isFinite(input.timeLimitSeconds)) {
        args.push('--time-limit', String(Math.max(1, Math.floor(input.timeLimitSeconds)) * 1000));
    }

    args.push(input.mznPath);
    return args;
}
