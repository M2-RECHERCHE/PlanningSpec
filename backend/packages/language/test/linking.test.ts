import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { clearDocuments, parseHelper } from "langium/test";
import { createPlanningSpecServices } from "../src/planning-spec-module.js";
import { isPlanification, Planification } from "../src/index.js";

let services: ReturnType<typeof createPlanningSpecServices>;
let parse:    ReturnType<typeof parseHelper<Planification>>;
let document: LangiumDocument<Planification> | undefined;

beforeAll(async () => {
    services = createPlanningSpecServices(EmptyFileSystem);
    parse = parseHelper<Planification>(services.PlanningSpec);
});

afterEach(async () => {
    if (document) clearDocuments(services.shared, [ document ]);
});

describe('Parsing Planification', () => {

    test('parse minimal Planification', async () => {
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

        // vérifie qu'il n'y a pas d'erreurs de parsing
        expect(document.parseResult.parserErrors).toHaveLength(0);

        const root = document.parseResult.value;
        expect(root).toBeDefined();
        expect(isPlanification(root!)).toBe(true);

        // vérifie le contenu du temps
        expect(root!.time?.slotsPerDay).toBe(8);
        expect(root!.time?.days?.days).toEqual(["01/01/2026", "02/01/2026"]);
    });
});
