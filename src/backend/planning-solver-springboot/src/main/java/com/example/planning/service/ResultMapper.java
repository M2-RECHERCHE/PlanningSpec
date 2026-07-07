package com.example.planning.service;

import com.example.planning.domain.*;
import com.example.planning.dto.AssignmentDto;
import com.example.planning.dto.SolveResult;
import org.optaplanner.core.api.score.buildin.hardsoft.HardSoftScore;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class ResultMapper {
    public SolveResult toDto(GenericPlanningProblem solution, long elapsedMillis) {
        SolveResult result = new SolveResult();
        HardSoftScore score = solution.getScore();
        int hardScore = score == null ? 0 : score.getHardScore();
        int softScore = score == null ? 0 : score.getSoftScore();
        int hardPenalty = Math.max(0, -hardScore);
        int softPenalty = Math.max(0, -softScore);
        result.setSourceName(solution.getSourceName());
        result.setScore(score == null ? null : score.toString());
        result.setHardScore(hardScore);
        result.setSoftScore(softScore);
        result.setHardPenalty(hardPenalty);
        result.setSoftPenalty(softPenalty);
        result.setPenalty(softPenalty);
        result.setObjectiveValue(softPenalty);
        result.setConstraintsSatisfied(hardPenalty == 0);
        result.setPreferencesSatisfied(softPenalty == 0);
        result.setObjectiveLine("OBJECTIVE: penalty=" + softPenalty);
        result.setStatus(score != null && hardScore == 0 ? "FEASIBLE" : "INFEASIBLE_OR_NOT_FULLY_SOLVED");
        result.setElapsedMillis(elapsedMillis);
        result.setActivityCount(solution.getActivityInstanceList().size());
        result.setRoleAssignmentCount(solution.getRoleAssignmentList().size());
        result.setAssignments(mapAssignments(solution));
        result.getNotes().add("Pénalité pondérée = -softScore. Une pénalité de 0 signifie que toutes les préférences connues sont satisfaites.");
        result.getNotes().add("Contraintes fortes satisfaites si hardPenalty = 0; préférences satisfaites si softPenalty = 0.");
        result.getNotes().add("Cette version générique supporte les rôles à cardinalité min/max via des slots d'affectation optionnels.");
        return result;
    }

    private List<AssignmentDto> mapAssignments(GenericPlanningProblem solution) {
        Map<String, List<RoleAssignment>> rolesByActivity = solution.getRoleAssignmentList().stream()
                .filter(r -> r.getResource() != null)
                .collect(Collectors.groupingBy(r -> r.getActivityInstance().getId(), LinkedHashMap::new, Collectors.toList()));

        List<AssignmentDto> dtoList = new ArrayList<>();
        for (ActivityInstance activity : solution.getActivityInstanceList()) {
            AssignmentDto dto = new AssignmentDto();
            dto.setActivityInstance(activity.getId());
            dto.setActivity(activity.getActivityType());
            dto.setDuration(activity.getDuration());
            dto.setDay(activity.getDay());
            dto.setSlotInDay(activity.getSlotInDay());
            dto.setGlobalSlot(activity.getStartIndex());

            Map<String, List<String>> roles = new LinkedHashMap<>();
            for (RoleAssignment assignment : rolesByActivity.getOrDefault(activity.getId(), List.of())) {
                roles.computeIfAbsent(assignment.getRole(), k -> new ArrayList<>()).add(assignment.getResource().getId());
            }
            dto.setRoles(roles);
            dtoList.add(dto);
        }
        return dtoList;
    }
}
