import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { parseHelper } from "langium/test";
import type { Planification } from "planning-spec-language";
import { createPlanningSpecServices, isPlanification } from "planning-spec-language";

let services: ReturnType<typeof createPlanningSpecServices>;
let parse: ReturnType<typeof parseHelper<Planification>>;
let document: LangiumDocument<Planification> | undefined;

beforeAll(async () => {
    services = createPlanningSpecServices(EmptyFileSystem);
    parse = parseHelper<Planification>(services.PlanningSpec);
});

describe('Parsing tests', () => {

    test('parse simple Planification', async () => {
        document = await parse(`
            time:
                days: ["01/01/2026", "02/01/2026"]
                slotsPerDay: 8
            activities: {}
            resources: {}
            roles: {}
            constraints: []
            preferences: []
        `);

        // Vérifie qu'il n'y a pas d'erreurs de parsing
        expect(document.parseResult.parserErrors).toHaveLength(0);

        // Vérifie que le root AST est bien un Planification
        expect(isPlanification(document.parseResult.value)).toBe(true);

        // Vérifie le contenu minimal du temps
        expect(document.parseResult.value?.time.slotsPerDay).toBe(8);
        expect(document.parseResult.value?.time.days.days).toEqual(["01/01/2026", "02/01/2026"]);
    });
});