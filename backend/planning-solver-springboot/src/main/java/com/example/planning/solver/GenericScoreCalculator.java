package com.example.planning.solver;

import com.example.planning.domain.*;
import org.optaplanner.core.api.score.buildin.hardsoft.HardSoftScore;
import org.optaplanner.core.api.score.calculator.EasyScoreCalculator;

import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public class GenericScoreCalculator implements EasyScoreCalculator<GenericPlanningProblem, HardSoftScore> {
    @Override
    public HardSoftScore calculateScore(GenericPlanningProblem solution) {
        ScoreAccumulator score = new ScoreAccumulator();
        ScoreSupport support = new ScoreSupport(solution);

        hardBaseTime(solution, score);
        hardRoleCardinality(solution, score, support);
        hardResourceCompatibility(solution, score);
        hardUniqueResourcePerActivity(solution, score);
        hardFixedAndForbidden(solution, score, support);
        hardRequiredResource(solution, score, support);
        hardResourceExclusivity(solution, score, support);
        hardPrecedence(solution, score, support);

        softAvoidParticipation(solution, score, support);
        softPreferredResource(solution, score, support);
        softMaxPerScope(solution, score, support);
        softRoomStability(solution, score, support);
        softCompactSchedule(solution, score, support);

        return HardSoftScore.of(score.hard, score.soft);
    }

    private void hardBaseTime(GenericPlanningProblem solution, ScoreAccumulator score) {
        for (ActivityInstance activity : solution.getActivityInstanceList()) {
            if (activity.getStart() == null) {
                score.hard("activity_missing_start", 1);
                continue;
            }
            if (activity.getStartIndex() < activity.getMinSlot()) {
                score.hard("time_window_before", activity.getMinSlot() - activity.getStartIndex());
            }
            if (activity.getEndInclusive() > activity.getMaxSlot()) {
                score.hard("time_window_after", activity.getEndInclusive() - activity.getMaxSlot());
            }
            if (activity.getStart().getSlotInDay() + activity.getDuration() - 1 > solution.getSlotsPerDay()) {
                score.hard("activity_crosses_day", 1);
            }
        }
    }

    private void hardRoleCardinality(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (RoleDefinition role : solution.getRoleDefinitionList()) {
            for (ActivityInstance activity : solution.getActivityInstanceList()) {
                if (!activity.getActivityType().equals(role.getActivityType())) continue;
                List<RoleAssignment> assignments = support.assignmentsOf(activity.getId(), role.getRole());
                long count = assignments.stream().filter(RoleAssignment::hasResource).count();
                if (count < role.getMin()) {
                    score.hard("role_cardinality_min", (int) (role.getMin() - count));
                }
                if (count > role.getMax()) {
                    score.hard("role_cardinality_max", (int) (count - role.getMax()));
                }
            }
        }
    }

    private void hardResourceCompatibility(GenericPlanningProblem solution, ScoreAccumulator score) {
        for (RoleAssignment assignment : solution.getRoleAssignmentList()) {
            Resource resource = assignment.getResource();
            if (resource != null && !resource.getType().equals(assignment.getResourceType())) {
                score.hard("resource_type_mismatch", 1);
            }
        }
    }

    private void hardUniqueResourcePerActivity(GenericPlanningProblem solution, ScoreAccumulator score) {
        Map<String, Map<String, Integer>> activityResourceCounts = new HashMap<>();
        for (RoleAssignment assignment : solution.getRoleAssignmentList()) {
            if (assignment.getResource() == null) continue;
            activityResourceCounts
                    .computeIfAbsent(assignment.getActivityInstance().getId(), k -> new HashMap<>())
                    .merge(assignment.getResource().getId(), 1, Integer::sum);
        }
        for (Map<String, Integer> resourceCounts : activityResourceCounts.values()) {
            for (int count : resourceCounts.values()) {
                if (count > 1) {
                    score.hard("same_resource_multiple_roles_same_activity", count - 1);
                }
            }
        }
    }

    private void hardFixedAndForbidden(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (FixedAssignmentRule rule : solution.getFixedAssignmentRuleList()) {
            if (!support.hasRoleResource(rule.getActivityInstanceId(), rule.getRole(), rule.getResourceId())) {
                score.hard("fixed_assignment_missing", 1);
            }
        }
        for (ForbiddenAssignmentRule rule : solution.getForbiddenAssignmentRuleList()) {
            if (support.hasRoleResource(rule.getActivityInstanceId(), rule.getRole(), rule.getResourceId())) {
                score.hard("forbidden_assignment_used", 1);
            }
        }
    }

    private void hardRequiredResource(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (RequiredResourceRule rule : solution.getRequiredResourceRuleList()) {
            if (!support.activityUsesResource(rule.getActivityInstanceId(), rule.getResourceId())) {
                score.hard("required_resource_missing", 1);
            }
        }
    }

    private void hardResourceExclusivity(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (ResourceExclusivityRule rule : solution.getResourceExclusivityRuleList()) {
            int excess = support.excessUsage(rule.getResourceType(), rule.getActivityType(), rule.getScope(), rule.getMax());
            score.hard("resource_exclusivity_" + rule.getScope(), excess);
        }
    }

    private void hardPrecedence(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (InstancePrecedenceRule rule : solution.getInstancePrecedenceRuleList()) {
            ActivityInstance before = support.activity(rule.getBeforeActivityInstanceId());
            ActivityInstance after = support.activity(rule.getAfterActivityInstanceId());
            if (before != null && after != null && before.getEndExclusive() > after.getStartIndex()) {
                score.hard("instance_precedence", before.getEndExclusive() - after.getStartIndex());
            }
        }
        for (TemporalPrecedenceRule rule : solution.getTemporalPrecedenceRuleList()) {
            List<ActivityInstance> befores = support.activitiesOfType(rule.getBeforeActivityType());
            List<ActivityInstance> afters = support.activitiesOfType(rule.getAfterActivityType());
            for (ActivityInstance before : befores) {
                for (ActivityInstance after : afters) {
                    if (before.getEndExclusive() > after.getStartIndex()) {
                        score.hard("temporal_precedence", before.getEndExclusive() - after.getStartIndex());
                    }
                }
            }
        }
    }

    private void softAvoidParticipation(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (AvoidParticipationPreference preference : solution.getAvoidParticipationPreferenceList()) {
            boolean participates = solution.getActivityInstanceList().stream()
                    .filter(a -> preference.getDay().equals(a.getDay()))
                    .anyMatch(a -> support.activityUsesResource(a.getId(), preference.getResourceId()));
            if (participates) {
                score.soft("avoid_participation_on_date", preference.getWeight());
            }
        }
    }

    private void softPreferredResource(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (PreferredResourcePreference preference : solution.getPreferredResourcePreferenceList()) {
            if (!support.hasRoleResource(preference.getActivityInstanceId(), preference.getRole(), preference.getResourceId())) {
                score.soft("preferred_resource", preference.getWeight());
            }
        }
    }

    private void softMaxPerScope(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (MaxPerScopePreference preference : solution.getMaxPerScopePreferenceList()) {
            int excess = support.excessUsage(preference.getResourceType(), preference.getActivityType(), preference.getScope(), preference.getMax());
            score.soft("max_per_scope_" + preference.getScope(), excess * preference.getWeight());
        }
    }

    private void softRoomStability(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (RoomStabilityPreference preference : solution.getRoomStabilityPreferenceList()) {
            RoleDefinition actorRole = support.role(preference.getActivityType(), preference.getRole());
            if (actorRole == null) continue;
            List<Resource> actors = support.resourcesOfType(actorRole.getResourceType());
            for (Resource actor : actors) {
                if ("day".equals(preference.getScope())) {
                    for (String day : solution.getDayList()) {
                        int distinctRooms = support.distinctRoomsForActor(preference.getActivityType(), preference.getRole(), actor.getId(), preference.getRoomResourceType(), a -> day.equals(a.getDay()));
                        if (distinctRooms > 1) score.soft("room_stability_day", (distinctRooms - 1) * preference.getWeight());
                    }
                } else if ("global".equals(preference.getScope())) {
                    int distinctRooms = support.distinctRoomsForActor(preference.getActivityType(), preference.getRole(), actor.getId(), preference.getRoomResourceType(), a -> true);
                    if (distinctRooms > 1) score.soft("room_stability_global", (distinctRooms - 1) * preference.getWeight());
                }
            }
        }
    }

    private void softCompactSchedule(GenericPlanningProblem solution, ScoreAccumulator score, ScoreSupport support) {
        for (CompactSchedulePreference preference : solution.getCompactSchedulePreferenceList()) {
            RoleDefinition actorRole = support.role(preference.getActivityType(), preference.getRole());
            if (actorRole == null) continue;
            List<Resource> actors = support.resourcesOfType(actorRole.getResourceType());
            for (Resource actor : actors) {
                if ("day".equals(preference.getScope())) {
                    for (String day : solution.getDayList()) {
                        int gaps = support.compactnessGaps(preference.getActivityType(), preference.getRole(), actor.getId(), a -> day.equals(a.getDay()));
                        if (gaps > 0) score.soft("compact_schedule_day", gaps * preference.getWeight());
                    }
                } else if ("global".equals(preference.getScope())) {
                    int gaps = support.compactnessGaps(preference.getActivityType(), preference.getRole(), actor.getId(), a -> true);
                    if (gaps > 0) score.soft("compact_schedule_global", gaps * preference.getWeight());
                }
            }
        }
    }

    static final class ScoreAccumulator {
        int hard = 0;
        int soft = 0;
        void hard(String ignored, int penalty) { hard -= Math.max(0, penalty); }
        void soft(String ignored, int penalty) { soft -= Math.max(0, penalty); }
    }

    static final class ScoreSupport {
        private final GenericPlanningProblem problem;
        private final Map<String, ActivityInstance> activityById;
        private final Map<String, List<ActivityInstance>> activitiesByType;
        private final Map<String, List<RoleAssignment>> assignmentsByActivity;
        private final Map<String, List<RoleAssignment>> assignmentsByActivityRole;
        private final Map<String, Resource> resourceById;
        private final Map<String, List<Resource>> resourcesByType;
        private final Map<String, RoleDefinition> roleByActivityAndRole;

        ScoreSupport(GenericPlanningProblem problem) {
            this.problem = problem;
            this.activityById = problem.getActivityInstanceList().stream().collect(Collectors.toMap(ActivityInstance::getId, a -> a, (a, b) -> a, LinkedHashMap::new));
            this.activitiesByType = problem.getActivityInstanceList().stream().collect(Collectors.groupingBy(ActivityInstance::getActivityType, LinkedHashMap::new, Collectors.toList()));
            this.assignmentsByActivity = problem.getRoleAssignmentList().stream().collect(Collectors.groupingBy(a -> a.getActivityInstance().getId(), LinkedHashMap::new, Collectors.toList()));
            this.assignmentsByActivityRole = problem.getRoleAssignmentList().stream().collect(Collectors.groupingBy(a -> a.getActivityInstance().getId() + "::" + a.getRole(), LinkedHashMap::new, Collectors.toList()));
            this.resourceById = problem.getResourceList().stream().collect(Collectors.toMap(Resource::getId, r -> r, (a, b) -> a, LinkedHashMap::new));
            this.resourcesByType = problem.getResourceList().stream().collect(Collectors.groupingBy(Resource::getType, LinkedHashMap::new, Collectors.toList()));
            this.roleByActivityAndRole = problem.getRoleDefinitionList().stream().collect(Collectors.toMap(r -> r.getActivityType() + "::" + r.getRole(), r -> r, (a, b) -> a, LinkedHashMap::new));
        }

        ActivityInstance activity(String id) { return activityById.get(id); }
        List<ActivityInstance> activitiesOfType(String type) { return activitiesByType.getOrDefault(type, List.of()); }
        List<RoleAssignment> assignmentsOf(String activityId, String role) { return assignmentsByActivityRole.getOrDefault(activityId + "::" + role, List.of()); }
        RoleDefinition role(String activityType, String role) { return roleByActivityAndRole.get(activityType + "::" + role); }
        List<Resource> resourcesOfType(String type) { return resourcesByType.getOrDefault(type, List.of()); }

        boolean hasRoleResource(String activityId, String role, String resourceId) {
            return assignmentsOf(activityId, role).stream()
                    .anyMatch(a -> a.getResource() != null && a.getResource().getId().equals(resourceId));
        }

        boolean activityUsesResource(String activityId, String resourceId) {
            return assignmentsByActivity.getOrDefault(activityId, List.of()).stream()
                    .anyMatch(a -> a.getResource() != null && a.getResource().getId().equals(resourceId));
        }

        int excessUsage(String resourceType, String activityType, String scope, int max) {
            int excess = 0;
            for (Resource resource : resourcesOfType(resourceType)) {
                if ("slot".equals(scope)) {
                    for (Timeslot t : problem.getTimeslotList()) {
                        int count = 0;
                        for (ActivityInstance activity : activitiesOfType(activityType)) {
                            if (activityOverlapsSlot(activity, t.getGlobalIndex()) && activityUsesResource(activity.getId(), resource.getId())) {
                                count++;
                            }
                        }
                        if (count > max) excess += count - max;
                    }
                } else if ("day".equals(scope)) {
                    for (String day : problem.getDayList()) {
                        int count = 0;
                        for (ActivityInstance activity : activitiesOfType(activityType)) {
                            if (day.equals(activity.getDay()) && activityUsesResource(activity.getId(), resource.getId())) {
                                count++;
                            }
                        }
                        if (count > max) excess += count - max;
                    }
                }
            }
            return excess;
        }

        boolean activityOverlapsSlot(ActivityInstance activity, int globalSlot) {
            return activity.getStart() != null && activity.getStartIndex() <= globalSlot && globalSlot < activity.getEndExclusive();
        }

        int distinctRoomsForActor(String activityType, String role, String actorId, String roomResourceType, Predicate<ActivityInstance> filter) {
            Set<String> rooms = new HashSet<>();
            for (ActivityInstance activity : activitiesOfType(activityType)) {
                if (!filter.test(activity)) continue;
                if (!hasRoleResource(activity.getId(), role, actorId)) continue;
                for (RoleAssignment assignment : assignmentsByActivity.getOrDefault(activity.getId(), List.of())) {
                    Resource resource = assignment.getResource();
                    if (resource != null && roomResourceType.equals(resource.getType())) {
                        rooms.add(resource.getId());
                    }
                }
            }
            return rooms.size();
        }

        int compactnessGaps(String activityType, String role, String actorId, Predicate<ActivityInstance> filter) {
            int first = Integer.MAX_VALUE;
            int last = Integer.MIN_VALUE;
            int busy = 0;
            for (ActivityInstance activity : activitiesOfType(activityType)) {
                if (!filter.test(activity)) continue;
                if (!hasRoleResource(activity.getId(), role, actorId)) continue;
                if (activity.getStart() == null) continue;
                first = Math.min(first, activity.getStartIndex());
                last = Math.max(last, activity.getEndInclusive());
                busy += activity.getDuration();
            }
            if (busy == 0) return 0;
            return Math.max(0, (last - first + 1) - busy);
        }
    }
}
