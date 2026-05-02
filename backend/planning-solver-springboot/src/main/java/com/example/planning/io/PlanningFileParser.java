package com.example.planning.io;

import com.example.planning.domain.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class PlanningFileParser {
    private final ObjectMapper objectMapper;

    public PlanningFileParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public GenericPlanningProblem parse(byte[] content, String sourceName) {
        try {
            JsonNode root = objectMapper.readTree(new String(content, StandardCharsets.UTF_8));
            GenericPlanningProblem problem = new GenericPlanningProblem();
            problem.setSourceName(sourceName == null || sourceName.isBlank() ? "input.planning" : sourceName);

            parseTime(root, problem);
            Map<String, Resource> resourcesById = parseResources(root, problem);
            Set<String> activityTypes = parseActivities(root, problem);
            Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole = parseRoles(root, problem, activityTypes);
            Map<String, ActivityInstance> activitiesById = createActivityInstances(problem);

            parseConstraints(root, problem, resourcesById, activitiesById, rolesByActivityAndRole, activityTypes);
            createRoleAssignments(problem, rolesByActivityAndRole);
            parsePreferences(root, problem, resourcesById, activitiesById, rolesByActivityAndRole, activityTypes);
            validateReferences(problem, resourcesById, activitiesById, rolesByActivityAndRole, activityTypes);
            new GenericInitialSolutionBuilder().initialize(problem);
            return problem;
        } catch (IOException e) {
            throw new PlanningRequestException("Le fichier .planning n'est pas un JSON valide.", e);
        }
    }

    private void parseTime(JsonNode root, GenericPlanningProblem problem) {
        JsonNode time = required(root, "time");
        JsonNode daysNode = required(time, "days");
        if (!daysNode.isArray() || daysNode.isEmpty()) {
            throw new PlanningRequestException("time.days doit être un tableau non vide.");
        }
        int slotsPerDay = required(time, "slotsPerDay").asInt(-1);
        if (slotsPerDay <= 0) {
            throw new PlanningRequestException("time.slotsPerDay doit être strictement supérieur à 0.");
        }
        List<String> days = new ArrayList<>();
        List<Timeslot> timeslots = new ArrayList<>();
        int global = 1;
        for (JsonNode dayNode : daysNode) {
            String day = text(dayNode, "time.days[]");
            if (days.contains(day)) {
                throw new PlanningRequestException("Jour dupliqué: " + day);
            }
            days.add(day);
            for (int slot = 1; slot <= slotsPerDay; slot++) {
                timeslots.add(new Timeslot(day, slot, global++));
            }
        }
        problem.setDayList(days);
        problem.setSlotsPerDay(slotsPerDay);
        problem.setTimeslotList(timeslots);
    }

    private Map<String, Resource> parseResources(JsonNode root, GenericPlanningProblem problem) {
        JsonNode resourcesNode = required(root, "resources");
        if (!resourcesNode.isObject()) {
            throw new PlanningRequestException("resources doit être un objet.");
        }
        Map<String, Resource> byId = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = resourcesNode.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String resourceType = entry.getKey();
            JsonNode array = entry.getValue();
            if (!array.isArray()) {
                throw new PlanningRequestException("resources." + resourceType + " doit être un tableau.");
            }
            for (JsonNode node : array) {
                String id = text(node, "resources." + resourceType + "[]");
                if (byId.containsKey(id)) {
                    throw new PlanningRequestException("Ressource dupliquée: " + id);
                }
                byId.put(id, new Resource(id, resourceType));
            }
        }
        if (byId.isEmpty()) {
            throw new PlanningRequestException("resources doit contenir au moins une ressource.");
        }
        problem.setResourceList(new ArrayList<>(byId.values()));
        return byId;
    }

    private Set<String> parseActivities(JsonNode root, GenericPlanningProblem problem) {
        JsonNode activitiesNode = required(root, "activities");
        if (!activitiesNode.isObject() || activitiesNode.isEmpty()) {
            throw new PlanningRequestException("activities doit être un objet non vide.");
        }
        Set<String> activityTypes = new LinkedHashSet<>();
        List<ActivityDefinition> definitions = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> fields = activitiesNode.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String activityType = entry.getKey();
            JsonNode activityNode = entry.getValue();
            int count = required(activityNode, "count").asInt(-1);
            int duration = activityNode.has("duration") ? activityNode.path("duration").asInt(-1) : 1;
            if (count <= 0) {
                throw new PlanningRequestException("activities." + activityType + ".count doit être strictement supérieur à 0.");
            }
            if (duration <= 0) {
                throw new PlanningRequestException("activities." + activityType + ".duration doit être strictement supérieur à 0.");
            }
            definitions.add(new ActivityDefinition(activityType, count, duration));
            activityTypes.add(activityType);
        }
        problem.setActivityDefinitionList(definitions);
        return activityTypes;
    }

    private Map<String, Map<String, RoleDefinition>> parseRoles(JsonNode root, GenericPlanningProblem problem, Set<String> activityTypes) {
        JsonNode rolesNode = required(root, "roles");
        if (!rolesNode.isObject()) {
            throw new PlanningRequestException("roles doit être un objet.");
        }
        Map<String, Map<String, RoleDefinition>> result = new LinkedHashMap<>();
        List<RoleDefinition> roleDefinitions = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> activityFields = rolesNode.fields();
        while (activityFields.hasNext()) {
            Map.Entry<String, JsonNode> activityEntry = activityFields.next();
            String activityType = activityEntry.getKey();
            if (!activityTypes.contains(activityType)) {
                throw new PlanningRequestException("roles." + activityType + " référence une activité non déclarée.");
            }
            JsonNode roleNode = activityEntry.getValue();
            if (!roleNode.isObject()) {
                throw new PlanningRequestException("roles." + activityType + " doit être un objet.");
            }
            Map<String, RoleDefinition> roles = new LinkedHashMap<>();
            Iterator<Map.Entry<String, JsonNode>> roleFields = roleNode.fields();
            while (roleFields.hasNext()) {
                Map.Entry<String, JsonNode> roleEntry = roleFields.next();
                String role = roleEntry.getKey();
                String resourceType = text(roleEntry.getValue(), "roles." + activityType + "." + role);
                RoleDefinition def = new RoleDefinition(activityType, role, resourceType);
                roles.put(role, def);
                roleDefinitions.add(def);
            }
            result.put(activityType, roles);
        }
        problem.setRoleDefinitionList(roleDefinitions);
        return result;
    }

    private Map<String, ActivityInstance> createActivityInstances(GenericPlanningProblem problem) {
        Map<String, ActivityInstance> byId = new LinkedHashMap<>();
        List<ActivityInstance> instances = new ArrayList<>();
        int totalSlots = problem.getTimeslotList().size();
        for (ActivityDefinition definition : problem.getActivityDefinitionList()) {
            for (int i = 1; i <= definition.getCount(); i++) {
                String id = definition.getType() + "_" + i;
                ActivityInstance instance = new ActivityInstance(id, definition.getType(), definition.getDuration());
                instance.setMinSlot(1);
                instance.setMaxSlot(totalSlots);
                byId.put(id, instance);
                instances.add(instance);
            }
        }
        problem.setActivityInstanceList(instances);
        return byId;
    }

    private void parseConstraints(JsonNode root, GenericPlanningProblem problem, Map<String, Resource> resourcesById,
                                  Map<String, ActivityInstance> activitiesById,
                                  Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole,
                                  Set<String> activityTypes) {
        JsonNode constraints = required(root, "constraints");
        if (!constraints.isArray()) {
            throw new PlanningRequestException("constraints doit être un tableau.");
        }
        Set<String> mandatoryActivities = new HashSet<>();
        for (JsonNode c : constraints) {
            String type = requiredText(c, "type");
            switch (type) {
                case "mandatory_roles" -> mandatoryActivities.add(requiredText(c, "activity"));
                case "cardinality_per_activity" -> parseCardinality(c, rolesByActivityAndRole);
                case "resource_exclusivity" -> problem.getResourceExclusivityRuleList().add(new ResourceExclusivityRule(
                        requiredText(c, "resourceType"), requiredText(c, "activity"), requiredText(c, "scope"), required(c, "max").asInt(-1)));
                case "fixed_assignment" -> problem.getFixedAssignmentRuleList().add(new FixedAssignmentRule(
                        requiredText(c, "activityInstance"), requiredText(c, "role"), requiredText(c, "resource")));
                case "forbidden_assignment" -> problem.getForbiddenAssignmentRuleList().add(new ForbiddenAssignmentRule(
                        requiredText(c, "activityInstance"), requiredText(c, "role"), requiredText(c, "resource")));
                case "required_resource" -> problem.getRequiredResourceRuleList().add(new RequiredResourceRule(
                        requiredText(c, "activityInstance"), requiredText(c, "resource")));
                case "temporal_precedence" -> problem.getTemporalPrecedenceRuleList().add(new TemporalPrecedenceRule(
                        requiredText(c, "beforeActivity"), requiredText(c, "afterActivity")));
                case "instance_precedence" -> problem.getInstancePrecedenceRuleList().add(new InstancePrecedenceRule(
                        requiredText(c, "beforeActivityInstance"), requiredText(c, "afterActivityInstance")));
                case "time_window" -> applyTimeWindow(c, activitiesById, problem.getTimeslotList().size());
                default -> throw new PlanningRequestException("Contrainte non supportée: " + type);
            }
        }
        for (String activityType : mandatoryActivities) {
            Map<String, RoleDefinition> roleMap = rolesByActivityAndRole.get(activityType);
            if (roleMap == null) {
                throw new PlanningRequestException("mandatory_roles référence une activité sans rôles: " + activityType);
            }
            for (RoleDefinition def : roleMap.values()) {
                if (def.getMin() < 1) {
                    def.setMin(1);
                }
                if (def.getMax() < def.getMin()) {
                    def.setMax(def.getMin());
                }
            }
        }
    }

    private void parseCardinality(JsonNode c, Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole) {
        String activityType = requiredText(c, "activity");
        int min = required(c, "min").asInt(-1);
        int max = required(c, "max").asInt(-1);
        if (min < 0 || max < 0 || min > max) {
            throw new PlanningRequestException("cardinality_per_activity invalide pour " + activityType + ": min/max incorrects.");
        }
        if (c.has("role")) {
            String role = requiredText(c, "role");
            RoleDefinition definition = roleDefinition(rolesByActivityAndRole, activityType, role);
            definition.setMin(min);
            definition.setMax(max);
        } else if (c.has("target")) {
            // target=slot is implicit because each activity has exactly one start variable.
            // target=ResourceType is checked later by the score calculator using actual assignments.
        } else {
            throw new PlanningRequestException("cardinality_per_activity doit contenir role ou target.");
        }
    }

    private void createRoleAssignments(GenericPlanningProblem problem, Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole) {
        List<RoleAssignment> assignments = new ArrayList<>();
        for (ActivityInstance activity : problem.getActivityInstanceList()) {
            Map<String, RoleDefinition> roleMap = rolesByActivityAndRole.getOrDefault(activity.getActivityType(), Map.of());
            for (RoleDefinition def : roleMap.values()) {
                int max = Math.max(0, def.getMax());
                for (int slot = 1; slot <= max; slot++) {
                    String id = activity.getId() + "::" + def.getRole() + "::" + slot;
                    assignments.add(new RoleAssignment(id, activity, def.getRole(), def.getResourceType(), slot, slot <= def.getMin()));
                }
            }
        }
        problem.setRoleAssignmentList(assignments);
    }

    private void parsePreferences(JsonNode root, GenericPlanningProblem problem, Map<String, Resource> resourcesById,
                                  Map<String, ActivityInstance> activitiesById,
                                  Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole,
                                  Set<String> activityTypes) {
        JsonNode preferences = required(root, "preferences");
        if (!preferences.isArray()) {
            throw new PlanningRequestException("preferences doit être un tableau.");
        }
        for (JsonNode p : preferences) {
            String type = requiredText(p, "type");
            switch (type) {
                case "avoid_participation_on_date" -> problem.getAvoidParticipationPreferenceList().add(new AvoidParticipationPreference(
                        requiredText(p, "resource"), requiredText(p, "date"), required(p, "weight").asInt(0)));
                case "preferred_resource" -> problem.getPreferredResourcePreferenceList().add(new PreferredResourcePreference(
                        requiredText(p, "activityInstance"), requiredText(p, "role"), requiredText(p, "resource"), required(p, "weight").asInt(0)));
                case "max_per_scope" -> problem.getMaxPerScopePreferenceList().add(new MaxPerScopePreference(
                        requiredText(p, "resourceType"), requiredText(p, "activity"), requiredText(p, "scope"), required(p, "max").asInt(-1), required(p, "weight").asInt(0)));
                case "room_stability_for_role" -> problem.getRoomStabilityPreferenceList().add(new RoomStabilityPreference(
                        requiredText(p, "activity"), requiredText(p, "role"), requiredText(p, "roomResourceType"), requiredText(p, "scope"), required(p, "weight").asInt(0)));
                case "compact_schedule_for_role" -> problem.getCompactSchedulePreferenceList().add(new CompactSchedulePreference(
                        requiredText(p, "activity"), requiredText(p, "role"), requiredText(p, "scope"), required(p, "weight").asInt(0)));
                default -> throw new PlanningRequestException("Préférence non supportée: " + type);
            }
        }
    }

    private void applyTimeWindow(JsonNode c, Map<String, ActivityInstance> activitiesById, int totalSlots) {
        String id = requiredText(c, "activityInstance");
        ActivityInstance activity = activitiesById.get(id);
        if (activity == null) {
            throw new PlanningRequestException("time_window référence une activité inconnue: " + id);
        }
        int min = required(c, "minSlot").asInt(-1);
        int max = required(c, "maxSlot").asInt(-1);
        if (min <= 0 || max < min || max > totalSlots) {
            throw new PlanningRequestException("time_window invalide pour " + id + ": minSlot/maxSlot incorrects.");
        }
        activity.setMinSlot(min);
        activity.setMaxSlot(max);
    }

    private void validateReferences(GenericPlanningProblem problem, Map<String, Resource> resourcesById,
                                    Map<String, ActivityInstance> activitiesById,
                                    Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole,
                                    Set<String> activityTypes) {
        Set<String> resourceTypes = new HashSet<>();
        for (Resource resource : resourcesById.values()) {
            resourceTypes.add(resource.getType());
        }
        for (RoleDefinition def : problem.getRoleDefinitionList()) {
            if (!resourceTypes.contains(def.getResourceType())) {
                throw new PlanningRequestException("Le rôle " + def.getRole() + " de " + def.getActivityType() + " référence un type de ressource inconnu: " + def.getResourceType());
            }
        }
        for (ResourceExclusivityRule r : problem.getResourceExclusivityRuleList()) {
            requireResourceType(resourceTypes, r.getResourceType(), "resource_exclusivity.resourceType");
            requireActivityType(activityTypes, r.getActivityType(), "resource_exclusivity.activity");
            if (!Set.of("slot", "day").contains(r.getScope())) throw new PlanningRequestException("resource_exclusivity.scope supporté: slot ou day.");
            if (r.getMax() < 0) throw new PlanningRequestException("resource_exclusivity.max doit être >= 0.");
        }
        for (FixedAssignmentRule r : problem.getFixedAssignmentRuleList()) {
            requireActivity(activitiesById, r.getActivityInstanceId(), "fixed_assignment.activityInstance");
            requireRole(rolesByActivityAndRole, activitiesById.get(r.getActivityInstanceId()).getActivityType(), r.getRole(), "fixed_assignment.role");
            requireResource(resourcesById, r.getResourceId(), "fixed_assignment.resource");
        }
        for (ForbiddenAssignmentRule r : problem.getForbiddenAssignmentRuleList()) {
            requireActivity(activitiesById, r.getActivityInstanceId(), "forbidden_assignment.activityInstance");
            requireRole(rolesByActivityAndRole, activitiesById.get(r.getActivityInstanceId()).getActivityType(), r.getRole(), "forbidden_assignment.role");
            requireResource(resourcesById, r.getResourceId(), "forbidden_assignment.resource");
        }
        for (RequiredResourceRule r : problem.getRequiredResourceRuleList()) {
            requireActivity(activitiesById, r.getActivityInstanceId(), "required_resource.activityInstance");
            requireResource(resourcesById, r.getResourceId(), "required_resource.resource");
        }
        for (InstancePrecedenceRule r : problem.getInstancePrecedenceRuleList()) {
            requireActivity(activitiesById, r.getBeforeActivityInstanceId(), "instance_precedence.beforeActivityInstance");
            requireActivity(activitiesById, r.getAfterActivityInstanceId(), "instance_precedence.afterActivityInstance");
            if (r.getBeforeActivityInstanceId().equals(r.getAfterActivityInstanceId())) throw new PlanningRequestException("instance_precedence doit référencer deux instances différentes.");
        }
        for (TemporalPrecedenceRule r : problem.getTemporalPrecedenceRuleList()) {
            requireActivityType(activityTypes, r.getBeforeActivityType(), "temporal_precedence.beforeActivity");
            requireActivityType(activityTypes, r.getAfterActivityType(), "temporal_precedence.afterActivity");
        }
        for (AvoidParticipationPreference p : problem.getAvoidParticipationPreferenceList()) {
            requireResource(resourcesById, p.getResourceId(), "avoid_participation_on_date.resource");
            if (!problem.getDayList().contains(p.getDay())) throw new PlanningRequestException("avoid_participation_on_date.date inconnue: " + p.getDay());
        }
        for (PreferredResourcePreference p : problem.getPreferredResourcePreferenceList()) {
            requireActivity(activitiesById, p.getActivityInstanceId(), "preferred_resource.activityInstance");
            requireRole(rolesByActivityAndRole, activitiesById.get(p.getActivityInstanceId()).getActivityType(), p.getRole(), "preferred_resource.role");
            requireResource(resourcesById, p.getResourceId(), "preferred_resource.resource");
        }
        for (MaxPerScopePreference p : problem.getMaxPerScopePreferenceList()) {
            requireResourceType(resourceTypes, p.getResourceType(), "max_per_scope.resourceType");
            requireActivityType(activityTypes, p.getActivityType(), "max_per_scope.activity");
            if (!Set.of("slot", "day").contains(p.getScope())) throw new PlanningRequestException("max_per_scope.scope supporté: slot ou day.");
        }
        for (RoomStabilityPreference p : problem.getRoomStabilityPreferenceList()) {
            requireActivityType(activityTypes, p.getActivityType(), "room_stability_for_role.activity");
            requireRole(rolesByActivityAndRole, p.getActivityType(), p.getRole(), "room_stability_for_role.role");
            requireResourceType(resourceTypes, p.getRoomResourceType(), "room_stability_for_role.roomResourceType");
            if (!Set.of("day", "global").contains(p.getScope())) throw new PlanningRequestException("room_stability_for_role.scope supporté: day ou global.");
        }
        for (CompactSchedulePreference p : problem.getCompactSchedulePreferenceList()) {
            requireActivityType(activityTypes, p.getActivityType(), "compact_schedule_for_role.activity");
            requireRole(rolesByActivityAndRole, p.getActivityType(), p.getRole(), "compact_schedule_for_role.role");
            if (!Set.of("day", "global").contains(p.getScope())) throw new PlanningRequestException("compact_schedule_for_role.scope supporté: day ou global.");
        }
    }

    private RoleDefinition roleDefinition(Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole, String activityType, String role) {
        RoleDefinition definition = rolesByActivityAndRole.getOrDefault(activityType, Map.of()).get(role);
        if (definition == null) {
            throw new PlanningRequestException("Rôle inconnu " + role + " pour l'activité " + activityType + ".");
        }
        return definition;
    }

    private void requireResource(Map<String, Resource> resourcesById, String id, String field) {
        if (!resourcesById.containsKey(id)) throw new PlanningRequestException(field + " référence une ressource inconnue: " + id);
    }

    private void requireActivity(Map<String, ActivityInstance> activitiesById, String id, String field) {
        if (!activitiesById.containsKey(id)) throw new PlanningRequestException(field + " référence une activité inconnue: " + id);
    }

    private void requireActivityType(Set<String> activityTypes, String type, String field) {
        if (!activityTypes.contains(type)) throw new PlanningRequestException(field + " référence un type d'activité inconnu: " + type);
    }

    private void requireResourceType(Set<String> resourceTypes, String type, String field) {
        if (!resourceTypes.contains(type)) throw new PlanningRequestException(field + " référence un type de ressource inconnu: " + type);
    }

    private void requireRole(Map<String, Map<String, RoleDefinition>> rolesByActivityAndRole, String activityType, String role, String field) {
        if (!rolesByActivityAndRole.getOrDefault(activityType, Map.of()).containsKey(role)) {
            throw new PlanningRequestException(field + " référence un rôle inconnu: " + activityType + "." + role);
        }
    }

    private JsonNode required(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) throw new PlanningRequestException("Champ requis manquant: " + field);
        return value;
    }

    private String requiredText(JsonNode node, String field) {
        return text(required(node, field), field);
    }

    private String text(JsonNode node, String path) {
        if (!node.isTextual()) throw new PlanningRequestException(path + " doit être une chaîne.");
        String value = node.asText();
        if (value.isBlank()) throw new PlanningRequestException(path + " ne peut pas être vide.");
        return value;
    }
}
