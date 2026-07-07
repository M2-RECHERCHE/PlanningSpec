import { describe, expect, test } from 'vitest';

import {
    buildMiniZincArgs,
    extractObjectiveValue,
    hasPlanningSolutionLines,
    MiniZincStderrParser,
    MiniZincStdoutParser
} from './minizinc-stream.js';
import { parseSolutionOutput } from './report.js';

describe('MiniZincStdoutParser', () => {
    test('keeps a persistent buffer for fragmented separators', () => {
        const parser = new MiniZincStdoutParser();

        expect(parser.push('OBJECTIVE: penalty=7\nACTIVITY: A_1 slot=1 day=1\n-----')).toEqual([]);
        const events = parser.push('-----\nOBJECTIVE: penalty=3\nACTIVITY: A_1 slot=2 day=1\n----------\n');

        expect(events).toHaveLength(2);
        expect(events[0]?.type).toBe('solution');
        expect(events[1]?.type).toBe('solution');
        if (events[0]?.type === 'solution' && events[1]?.type === 'solution') {
            expect(events[0].block.objectiveValue).toBe(7);
            expect(events[1].block.objectiveValue).toBe(3);
        }
    });

    test('detects optimal boundary separately from stopped/completed output', () => {
        const parser = new MiniZincStdoutParser();
        const events = parser.push('OBJECTIVE: penalty=0\nACTIVITY: A_1 slot=1 day=1\n==========\n');

        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe('solution');
        if (events[0]?.type === 'solution') {
            expect(events[0].block.marker).toBe('optimal');
        }
    });

    test('detects a standalone optimal boundary after a solution separator', () => {
        const parser = new MiniZincStdoutParser();
        const events = parser.push('OBJECTIVE: penalty=0\nACTIVITY: A_1 slot=1 day=1\n----------\n==========\n');

        expect(events).toHaveLength(2);
        expect(events[0]?.type).toBe('solution');
        expect(events[1]?.type).toBe('optimal');
    });

    test('detects unsatisfiable output', () => {
        const parser = new MiniZincStdoutParser();
        const events = parser.push('=====UNSATISFIABLE=====\n----------\n');

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'status',
            status: { status: 'UNSATISFIABLE' }
        });
    });
});

describe('planning solution output detection', () => {
    test('does not treat Chuffed progress comments as planning solutions', () => {
        expect(hasPlanningSolutionLines('% [penalty > -1]')).toBe(false);
    });

    test('detects generated ACTIVITY lines as planning solutions', () => {
        expect(hasPlanningSolutionLines('OBJECTIVE: penalty=0\nACTIVITY: A_1 slot=1 day=1')).toBe(true);
    });
});

describe('MiniZincStderrParser', () => {
    test('streams stderr by complete lines and classifies warnings', () => {
        const parser = new MiniZincStderrParser();

        expect(parser.push('Warning: partial')).toEqual([]);
        expect(parser.push(' line\nfatal error\n')).toEqual([
            { level: 'warning', message: 'Warning: partial line' },
            { level: 'error', message: 'fatal error' }
        ]);
    });
});

describe('MiniZinc command args', () => {
    test('does not add a time limit by default', () => {
        expect(buildMiniZincArgs({ solver: 'Highs', mznPath: '/tmp/model.mzn' })).toEqual([
            '--solver',
            'Highs',
            '--intermediate-solutions',
            '/tmp/model.mzn'
        ]);
    });

    test('adds a MiniZinc time limit only when explicit', () => {
        expect(buildMiniZincArgs({ solver: 'Highs', mznPath: '/tmp/model.mzn', timeLimitSeconds: 12 })).toContain('--time-limit');
        expect(buildMiniZincArgs({ solver: 'Highs', mznPath: '/tmp/model.mzn', timeLimitSeconds: 12 })).toContain('12000');
    });
});

describe('report parser compatibility', () => {
    test('ignores OBJECTIVE lines while decoding solution activities', () => {
        const activities = parseSolutionOutput(
            'OBJECTIVE: penalty=4\nACTIVITY: A_1 slot=2 day=1\nROLE: A_1 role=Teacher resource=T_1',
            ['Lundi'],
            4
        );

        expect(extractObjectiveValue('OBJECTIVE: penalty=4')).toBe(4);
        expect(activities).toHaveLength(1);
        expect(activities[0]?.instance).toBe('A_1');
    });
});
