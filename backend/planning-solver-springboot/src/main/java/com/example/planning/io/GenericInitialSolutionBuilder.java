package com.example.planning.io;

import com.example.planning.domain.*;

import java.util.*;

public class GenericInitialSolutionBuilder {
    public void initialize(GenericPlanningProblem problem) {
        initializeTimes(problem);
        initializeResources(problem);
    }

    private void initializeTimes(GenericPlanningProblem problem) {
        List<Timeslot> timeslots = problem.getTimeslotList();
        if (timeslots.isEmpty()) return;
        int index = 0;
        for (ActivityInstance activity : problem.getActivityInstanceList()) {
            Timeslot chosen = null;
            for (int i = 0; i < timeslots.size(); i++) {
                Timeslot candidate = timeslots.get((index + i) % timeslots.size());
                if (candidate.getGlobalIndex() >= activity.getMinSlot()
                        && candidate.getGlobalIndex() + activity.getDuration() - 1 <= activity.getMaxSlot()
                        && doesNotCrossDay(candidate, activity, problem.getSlotsPerDay())) {
                    chosen = candidate;
                    index = (index + i + 1) % timeslots.size();
                    break;
                }
            }
            activity.setStart(chosen == null ? timeslots.get(0) : chosen);
        }
    }

    private boolean doesNotCrossDay(Timeslot start, ActivityInstance activity, int slotsPerDay) {
        return start.getSlotInDay() + activity.getDuration() - 1 <= slotsPerDay;
    }

    private void initializeResources(GenericPlanningProblem problem) {
        Map<String, Resource> resourceById = new LinkedHashMap<>();
        Map<String, List<Resource>> resourcesByType = new LinkedHashMap<>();
        for (Resource resource : problem.getResourceList()) {
            resourceById.put(resource.getId(), resource);
            resourcesByType.computeIfAbsent(resource.getType(), k -> new ArrayList<>()).add(resource);
        }

        Set<String> initialized = new HashSet<>();
        for (FixedAssignmentRule fixed : problem.getFixedAssignmentRuleList()) {
            Resource resource = resourceById.get(fixed.getResourceId());
            if (resource == null) continue;
            for (RoleAssignment assignment : problem.getRoleAssignmentList()) {
                if (!initialized.contains(assignment.getId())
                        && assignment.getActivityInstance().getId().equals(fixed.getActivityInstanceId())
                        && assignment.getRole().equals(fixed.getRole())) {
                    assignment.setResource(resource);
                    initialized.add(assignment.getId());
                    break;
                }
            }
        }

        Map<String, Integer> nextIndexByType = new HashMap<>();
        for (RoleAssignment assignment : problem.getRoleAssignmentList()) {
            if (initialized.contains(assignment.getId())) continue;
            List<Resource> candidates = resourcesByType.getOrDefault(assignment.getResourceType(), List.of());
            if (assignment.isRequiredSlot() && !candidates.isEmpty()) {
                int next = nextIndexByType.getOrDefault(assignment.getResourceType(), 0);
                assignment.setResource(candidates.get(next % candidates.size()));
                nextIndexByType.put(assignment.getResourceType(), next + 1);
            } else {
                assignment.setResource(null);
            }
        }
    }
}
