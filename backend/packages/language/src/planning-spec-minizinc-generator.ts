// planning-spec-minizinc-generator.ts

import { LangiumCoreServices, LangiumDocument } from 'langium';
import {
  ActivityEntry,
  Planification,
  ResourceEntry,
} from './generated/ast.js';
import { join, dirname, isAbsolute } from 'path';
import { writeFileSync } from 'fs';
import * as fs from 'fs';

type ActInst = { enumName: string; original: string; duration: number };

export class PlanningSpecMiniZincGenerator {
  protected readonly services: LangiumCoreServices;

  constructor(services: LangiumCoreServices) {
    this.services = services;
  }

  // Langium STRING => enlever guillemets
  private s(str: string): string {
    return str.replace(/"/g, '');
  }

  // Normaliser en identifiant MiniZinc
  private id(str: string): string {
    return this.s(str).trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_');
  }

  private mznSetOfEnum(values: string[]): string {
    if (values.length === 0) return '{}';
    return `{ ${values.join(', ')} }`;
  }

  generateToMiniZinc(document: LangiumDocument): string {
    const model = document.parseResult.value as Planification;

    let code = '% ===============================================\n';
    code += '% Generated MiniZinc Model from PlanningSpec\n';
    code += '% ===============================================\n\n';

    // ------------------------------------------------
    // 1) TIME
    // ------------------------------------------------
    const days = model.time.days.days.map(d => this.s(d));
    const numDays = days.length;
    const slotsPerDay = model.time.slotsPerDay;
    code += `int: NUM_DAYS = ${numDays};\n`;
    code += `int: SLOTS_PER_DAY = ${slotsPerDay};\n`;
    code += `int: TOTAL_SLOTS = NUM_DAYS * SLOTS_PER_DAY;\n\n`;

    // Helper MiniZinc : dayOf(slot)
    code += `% Helpers\n`;
    code += `function var int: dayOf(var int: t) = ((t-1) div SLOTS_PER_DAY) + 1;\n`;
    code += `function int: dayStart(int: d) = (d-1)*SLOTS_PER_DAY + 1;\n`;
    code += `function int: dayEnd(int: d) = d*SLOTS_PER_DAY;\n\n`;

    // ------------------------------------------------
    // 2) RESOURCES (typed)
    // ------------------------------------------------
    const resourceTypeToInstances = new Map<string, string[]>(); // "Teacher" -> ["Prof_1", ...]
    const allResourceInstances: string[] = [];

    model.resources.resources.forEach((r: ResourceEntry) => {
      const rt = this.s(r.name);
      const insts = r.instances.map(inst => this.id(inst.name));
      resourceTypeToInstances.set(rt, insts);
      insts.forEach(x => allResourceInstances.push(x));
    });

    code += `enum RESOURCE = { ${allResourceInstances.join(', ')} };\n`;

    // Create typed sets: set of RESOURCE: RES_Teacher = {...};
    code += `% Resource type sets\n`;
    for (const [rt, insts] of resourceTypeToInstances.entries()) {
      code += `set of RESOURCE: RES_${this.id(rt)} = ${this.mznSetOfEnum(insts)};\n`;
    }
    code += '\n';

    // ------------------------------------------------
    // 3) ACTIVITIES: types + instances
    // ------------------------------------------------
    const activityTypes = model.activities.activities.map(a => this.s(a.name));
    code += `enum ACT_TYPE = { ${activityTypes.map(a => this.id(a)).join(', ')} };\n`;

    const activityInstances: ActInst[] = [];
    model.activities.activities.forEach((a: ActivityEntry) => {
      const count = a.count;
      const duration = a.duration ?? 1;
      const original = this.s(a.name);
      for (let i = 1; i <= count; i++) {
        activityInstances.push({
          enumName: `${this.id(original)}_${i}`,
          original,
          duration
        });
      }
    });

    code += `enum ACT_INST = { ${activityInstances.map(a => a.enumName).join(', ')} };\n`;
    code += `array[ACT_INST] of int: duration = [${activityInstances.map(a => a.duration).join(', ')}];\n`;

    // Map each instance to its activity type (ACT_TYPE)
    code += `array[ACT_INST] of ACT_TYPE: act_type = [${activityInstances
      .map(a => this.id(a.original))
      .join(', ')}];\n\n`;

    // ------------------------------------------------
    // 4) ROLES (collect all roles + mapping role->resourceType per activity)
    // ------------------------------------------------
    // rolesPerAct: "Soutenance" -> Map("President"->"Teacher", ...)
    const rolesPerAct = new Map<string, Map<string, string>>();
    const allRolesSet = new Set<string>();

    model.roles.roles.forEach(re => {
      const actName = this.s(re.name);
      const m = new Map<string, string>();
      re.assignments.forEach(asg => {
        const roleName = this.s(asg.roleName);       // (mieux: roleName)
        const resType = this.s(asg.resourceRef);   // (mieux: resourceType)
        m.set(roleName, resType);
        allRolesSet.add(roleName);
      });
      rolesPerAct.set(actName, m);
    });

    const allRoles = Array.from(allRolesSet);
    const hasRoles = allRoles.length > 0;

    if (hasRoles) {
      code += `enum ROLE = { ${allRoles.map(r => this.id(r)).join(', ')} };\n`;

      // role_applicable[a, role]
      code += `array[ACT_INST, ROLE] of bool: role_applicable = array2d(ACT_INST, ROLE, [\n`;
      for (let ai = 0; ai < activityInstances.length; ai++) {
        const actOriginal = activityInstances[ai].original;
        const roleMap = rolesPerAct.get(actOriginal);
        const row = allRoles.map(r => (roleMap?.has(r) ? 'true' : 'false')).join(', ');
        code += `  ${row}${ai < activityInstances.length - 1 ? ',' : ''}\n`;
      }
      code += `]);\n\n`;
    }

    // ------------------------------------------------
    // 5) DECISION VARIABLES
    // ------------------------------------------------
    code += `% Decision variables\n`;
    code += `array[ACT_INST] of var 1..TOTAL_SLOTS: start_time;\n`;
    code += `array[ACT_INST, RESOURCE] of var bool: assignment;\n`;
    if (hasRoles) {
      code += `array[ACT_INST, ROLE, RESOURCE] of var bool: role_assignment;\n`;
    }
    code += '\n';

    // ------------------------------------------------
    // 6) BASE TIME CONSTRAINT (no cross-day)
    // ------------------------------------------------
    code += `% No cross-day overrun\n`;
    code += `constraint forall(i in ACT_INST) (\n`;
    code += `  ((start_time[i] - 1) mod SLOTS_PER_DAY) + duration[i] <= SLOTS_PER_DAY\n`;
    code += `);\n\n`;

    // ------------------------------------------------
    // 7) GENERIC NON-OVERLAP PER RESOURCE INSTANCE
    // (Strong: a resource instance cannot overlap in time)
    // ------------------------------------------------
    code += `% A resource instance cannot overlap between two activities (global non-overlap)\n`;
    code += `constraint forall(r in RESOURCE) (\n`;
    code += `  forall(i, j in ACT_INST where i < j) (\n`;
    code += `    (assignment[i, r] /\\ assignment[j, r]) ->\n`;
    code += `      (start_time[i] + duration[i] <= start_time[j] \\/ start_time[j] + duration[j] <= start_time[i])\n`;
    code += `  )\n`;
    code += `);\n\n`;

    // ------------------------------------------------
    // 8) LINK roles -> assignment (when role applicable)
    // A resource assigned to a role must be compatible with that role's resource type
    // and also counted as participating in the activity.
    // ------------------------------------------------
    if (hasRoles) {
      code += `% Non-applicable roles cannot receive any resource\n`;
      code += `constraint forall(a in ACT_INST, ro in ROLE, r in RESOURCE) (\n`;
      code += `  if not role_applicable[a, ro] then role_assignment[a, ro, r] = false else true endif\n`;
      code += `);\n\n`;

      code += `% Applicable roles only use compatible resource types and imply assignment\n`;
      for (const act of activityTypes) {
        const rm = rolesPerAct.get(act);
        if (!rm) {
          continue;
        }

        for (const role of allRoles) {
          const rt = rm.get(role);
          if (!rt) {
            continue;
          }

          code += `constraint forall(a in ACT_INST where act_type[a] == ${this.id(act)}, r in RESOURCE where not (r in RES_${this.id(rt)})) (\n`;
          code += `  role_assignment[a, ${this.id(role)}, r] = false\n`;
          code += `);\n`;

          code += `constraint forall(a in ACT_INST where act_type[a] == ${this.id(act)}, r in RES_${this.id(rt)}) (\n`;
          code += `  role_assignment[a, ${this.id(role)}, r] -> assignment[a, r]\n`;
          code += `);\n`;
        }
      }
      code += `\n`;

      code += `% A concrete resource cannot carry two different roles in the same activity instance\n`;
      code += `constraint forall(a in ACT_INST, r in RESOURCE) (\n`;
      code += `  sum(ro in ROLE where role_applicable[a, ro]) (bool2int(role_assignment[a, ro, r])) <= 1\n`;
      code += `);\n\n`;
    }

    // ------------------------------------------------
    // 9) DSL CONSTRAINTS TRANSLATION
    // ------------------------------------------------
    code += `% --- DSL Constraints ---\n`;

    // Helper: set of ACT_INST for a given activity type
    const actInstSetLiteral = (actName: string): string => {
      const list = activityInstances
        .filter(ai => ai.original === actName)
        .map(ai => ai.enumName);
      return this.mznSetOfEnum(list);
    };

    model.constraints.constraints.forEach((c: any) => {
      // ---------------------------
      // CardinalityPerActivity
      // ---------------------------
      if (c.$type === 'CardinalityPerActivity') {
        const actName = this.s(c.activity);
        const actSet = actInstSetLiteral(actName);

        // case: target = "slot"
        if (c.target && this.s(c.target) === 'slot') {
          // In this model, each activity instance has exactly 1 start_time.
          // So "slot cardinality" is always 1. We enforce that 1 is within [min,max].
          code += `% Cardinality(slot) for ${actName} => model has exactly 1 start_time per instance\n`;
          code += `constraint ${c.min} <= 1 /\\ 1 <= ${c.max};\n\n`;
        }

        // case: target = ResourceType
        if (c.target && this.s(c.target) !== 'slot') {
          const targetType = this.s(c.target);
          code += `% Cardinality(target=${targetType}) for activity ${actName}\n`;
          code += `constraint forall(a in ACT_INST where a in ${actSet}) (\n`;
          code += `  sum(r in RES_${this.id(targetType)}) (bool2int(assignment[a,r])) >= ${c.min} /\\\n`;
          code += `  sum(r in RES_${this.id(targetType)}) (bool2int(assignment[a,r])) <= ${c.max}\n`;
          code += `);\n\n`;
        }

        // case: role cardinality
        if (c.role) {
          const roleName = this.s(c.role);
          const rm = rolesPerAct.get(actName);
          const rt = rm?.get(roleName);

          code += `% Cardinality(role=${roleName}) for activity ${actName}\n`;

          if (!rt) {
            code += `% WARNING: role ${roleName} not defined for activity ${actName}\n\n`;
          } else {
            code += `constraint forall(a in ACT_INST where a in ${actSet}) (\n`;
            code += `  sum(r in RES_${this.id(rt)}) (bool2int(role_assignment[a, ${this.id(roleName)}, r])) >= ${c.min} /\\\n`;
            code += `  sum(r in RES_${this.id(rt)}) (bool2int(role_assignment[a, ${this.id(roleName)}, r])) <= ${c.max}\n`;
            code += `);\n`;
            code += `\n`;
          }
        }
      }

      // ---------------------------
      // FixedAssignment
      // ---------------------------
      if (c.$type === 'FixedAssignment') {
        const ai = this.id(c.activityInstance);
        const roleName = this.s(c.role);
        const res = this.id(c.resource);

        code += `% FixedAssignment: ${ai} role ${roleName} -> ${res}\n`;
        code += `constraint assignment[${ai}, ${res}] = true;\n`;
        if (hasRoles) {
          code += `constraint role_assignment[${ai}, ${this.id(roleName)}, ${res}] = true;\n`;
        }
        code += `\n`;
      }

      // ---------------------------
      // ForbiddenAssignment
      // ---------------------------
      if (c.$type === 'ForbiddenAssignment') {
        const ai = this.id(c.activityInstance);
        const roleName = this.s(c.role);
        const res = this.id(c.resource);

        code += `% ForbiddenAssignment: ${ai} role ${roleName} != ${res}\n`;
        if (hasRoles) {
          code += `constraint role_assignment[${ai}, ${this.id(roleName)}, ${res}] = false;\n`;
        }
        code += `\n`;
      }

      // ---------------------------
      // ResourceExclusivity (general, supports max > 1)
      // ---------------------------
      if (c.$type === 'ResourceExclusivity') {
        const rt = this.s(c.resourceType);
        const actName = this.s(c.activity);
        const scope = this.s(c.scope);
        const max = c.max;

        code += `% ResourceExclusivity: type=${rt}, activity=${actName}, scope=${scope}, max=${max}\n`;

        const actFilter = `act_type[a] == ${this.id(actName)}`;

        if (scope === 'slot') {
          code += `constraint forall(r in RES_${this.id(rt)}, t in 1..TOTAL_SLOTS) (\n`;
          code += `  sum(a in ACT_INST where ${actFilter}) (\n`;
          code += `    bool2int(assignment[a,r] /\\ start_time[a] <= t /\\ t < start_time[a] + duration[a])\n`;
          code += `  ) <= ${max}\n`;
          code += `);\n\n`;
        } else if (scope === 'day') {
          code += `constraint forall(r in RES_${this.id(rt)}, d in 1..NUM_DAYS) (\n`;
          code += `  sum(a in ACT_INST where ${actFilter}) (\n`;
          code += `    bool2int(assignment[a,r] /\\ dayOf(start_time[a]) == d)\n`;
          code += `  ) <= ${max}\n`;
          code += `);\n\n`;
        } else {
          code += `% NOTE: scope=${scope} not implemented (supported: slot, day)\n\n`;
        }
      }
      // ---------------------------
      // TemporalPrecedence
      // ---------------------------
      if (c.$type === 'TemporalPrecedence') {
        const actBeforeList = activityInstances.filter(ai => ai.original === this.s(c.beforeActivity)).map(ai => ai.enumName);
        const actAfterList = activityInstances.filter(ai => ai.original === this.s(c.afterActivity)).map(ai => ai.enumName);
        
        code += `% TemporalPrecedence: ${this.s(c.beforeActivity)} MUST END BEFORE ${this.s(c.afterActivity)}\n`;
        // Exiger que TOUTES les instances de before finissent avant que N'IMPORTE QUELLE instance de after ne commence
        // Ou que la première instance de after commence après la dernière de before
        code += `constraint forall(b in ${this.mznSetOfEnum(actBeforeList)}, a in ${this.mznSetOfEnum(actAfterList)}) (\n`;
        code += `  start_time[b] + duration[b] <= start_time[a]\n`;
        code += `);\n\n`;
      }

      // ---------------------------
      // TimeWindow
      // ---------------------------
      if (c.$type === 'TimeWindow') {
        const ai = this.id(c.activityInstance);
        const minSlot = c.minSlot;
        const maxSlot = c.maxSlot;
        
        code += `% TimeWindow for ${ai}: [${minSlot}, ${maxSlot}]\n`;
        code += `constraint start_time[${ai}] >= ${minSlot};\n`;
        code += `constraint start_time[${ai}] + duration[${ai}] - 1 <= ${maxSlot};\n\n`;
      }

      // ---------------------------
      // MandatoryRoles
      // ---------------------------
      if (c.$type === 'MandatoryRoles') {
        if (hasRoles) {
          const actName = this.id(c.activity);
          code += `% MandatoryRoles for activity ${actName}\n`;
          code += `constraint forall(a in ACT_INST where act_type[a] == ${actName}, ro in ROLE where role_applicable[a, ro]) (\n`;
          code += `  sum(r in RESOURCE) (bool2int(role_assignment[a, ro, r])) >= 1\n`;
          code += `);\n\n`;
        }
      }

      // ---------------------------
      // InstancePrecedence
      // ---------------------------
      if (c.$type === 'InstancePrecedence') {
        const beforeInst = this.id(c.beforeActivityInstance);
        const afterInst = this.id(c.afterActivityInstance);

        code += `% InstancePrecedence: ${beforeInst} before ${afterInst}\n`;
        code += `constraint start_time[${beforeInst}] + duration[${beforeInst}] <= start_time[${afterInst}];\n\n`;
      }

      // ---------------------------
      // RequiredResource
      // ---------------------------
      if (c.$type === 'RequiredResource') {
        const ai = this.id(c.activityInstance);
        const res = this.id(c.resource);

        code += `% RequiredResource: ${ai} requires ${res}\n`;
        code += `constraint assignment[${ai}, ${res}] = true;\n\n`;
      }
    });

    // ------------------------------------------------
    // 10) PREFERENCES -> penalty
    // ------------------------------------------------
    code += `% --- Preferences / Soft constraints ---\n`;
    const penaltyTerms: string[] = [];

    model.preferences.preferences.forEach((p: any) => {
      // AvoidParticipationOnDate
      if (p.$type === 'AvoidParticipationOnDate') {
        const res = this.id(p.resource);
        const dateStr = this.s(p.date);  // should match a day label
        const weight = p.weight;

        const dayIndex = days.findIndex(d => d === dateStr) + 1; // 1-based
        if (dayIndex <= 0) {
          code += `% WARNING: date "${dateStr}" not found in days list -> ignored\n`;
        } else {
          // penalize if resource is assigned to any activity whose start_time is on that day (flat penalty)
          penaltyTerms.push(
            `${weight} * bool2int(sum(a in ACT_INST) (bool2int(assignment[a, ${res}] /\\ dayOf(start_time[a]) == ${dayIndex})) > 0)`
          );
        }
      }

      // MaxPerScope (soft cap on number of overlapping activities of a type in a scope)
      if (p.$type === 'MaxPerScope') {
        const rt = this.s(p.resourceType);
        const actName = this.s(p.activity);
        const scope = this.s(p.scope);
        const max = p.max;
        const weight = p.weight;

        const actFilter = `act_type[a] == ${this.id(actName)}`;

        if (scope === 'slot') {
          // count overlaps per slot per resource, penalize excess
          penaltyTerms.push(
            `sum(r in RES_${this.id(rt)}, t in 1..TOTAL_SLOTS) ( ${weight} * max(0, (sum(a in ACT_INST where ${actFilter}) (bool2int(assignment[a, r] /\\ start_time[a] <= t /\\ t < start_time[a] + duration[a]))) - ${max}) )`
          );
        } else if (scope === 'day') {
          penaltyTerms.push(
            `sum(r in RES_${this.id(rt)}, d in 1..NUM_DAYS) ( ${weight} * max(0, (sum(a in ACT_INST where ${actFilter}) (bool2int(assignment[a, r] /\\ dayOf(start_time[a]) == d))) - ${max}) )`
          );
        } else {
          code += `% NOTE: MaxPerScope scope=${scope} not implemented (supported: slot, day)\n`;
        }
      }

      // PreferredResource (soft assignment)
      if (p.$type === 'PreferredResource') {
        const ai = this.id(p.activityInstance);
        const role = this.s(p.role);
        const res = this.id(p.resource);
        const weight = p.weight;
        if (hasRoles) {
          penaltyTerms.push(`${weight} * bool2int(not role_assignment[${ai}, ${this.id(role)}, ${res}])`);
        } else {
          penaltyTerms.push(`${weight} * bool2int(not assignment[${ai}, ${res}])`);
        }
      }
    });

    if (penaltyTerms.length === 0) {
      code += `var int: penalty = 0;\n`;
    } else {
      code += `var int: penalty =\n  ${penaltyTerms.join('\n  + ')};\n`;
    }

    // code += `var int: makespan;\n`;
    // code += `constraint makespan = max(i in ACT_INST)(start_time[i] + duration[i] - 1);\n`;
    // code += `var int: objective = penalty * (TOTAL_SLOTS + 1) + makespan;\n`;
    // code += `var int: objective = penalty * (TOTAL_SLOTS + 1);\n`;

    // code += `\nsolve minimize objective;\n\n`;

    // Solve: minimize soft-constraint violations (preferences), or just satisfy if none.
    // The makespan (latest end time) is intentionally NOT included in the objective:
    // adding max() over all activities multiplies solver complexity exponentially
    // without adding correctness value for scheduling feasibility.
    if (penaltyTerms.length > 0) {
      code += `\nsolve :: int_search([start_time[i] | i in ACT_INST], first_fail, indomain_min, complete) minimize penalty;\n\n`;
    } else {
      code += `\nsolve :: int_search([start_time[i] | i in ACT_INST], first_fail, indomain_min, complete) satisfy;\n\n`;
    }

    // ------------------------------------------------
    // 11) OUTPUT — format structuré parseable par le module de rapport
    // Chaque ligne suit un préfixe : ACTIVITY | ASSIGNMENT | ROLE
    // ------------------------------------------------
    code += `output\n`;
    code += `  [ "ACTIVITY: " ++ show(i) ++ " slot=" ++ show(start_time[i]) ++ " day=" ++ show(dayOf(start_time[i])) ++ "\\n" | i in ACT_INST ] ++\n`;
    code += `  [ if fix(assignment[i, r]) then "ASSIGNMENT: " ++ show(i) ++ " resource=" ++ show(r) ++ "\\n" else "" endif\n`;
    code += `    | i in ACT_INST, r in RESOURCE ] ++\n`;
    if (hasRoles) {
      code += `  [ if fix(role_assignment[i, ro, r]) then "ROLE: " ++ show(i) ++ " role=" ++ show(ro) ++ " resource=" ++ show(r) ++ "\\n" else "" endif\n`;
      code += `    | i in ACT_INST, ro in ROLE, r in RESOURCE where role_applicable[i, ro] ];\n`;
    } else {
      code += `  [];\n`;
    }

    return code;
  }

  generateToFile(document: LangiumDocument, outDir: string = 'out'): string {
    const code = this.generateToMiniZinc(document);
    const uri = document.uri;
    const baseName = uri.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'plan';
    const outPath = isAbsolute(outDir)
      ? join(outDir, `${baseName}.mzn`)
      : join(process.cwd(), outDir, `${baseName}.mzn`);

    const dir = dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outPath, code, 'utf-8');
    console.log(`MiniZinc file generated: ${outPath}`);
    return outPath;
  }
}
