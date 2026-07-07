package com.example.planning;

import com.example.planning.domain.GenericPlanningProblem;
import com.example.planning.service.ResultMapper;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.buildin.hardsoft.HardSoftScore;

import static org.assertj.core.api.Assertions.assertThat;

class ResultMapperTest {
    @Test
    void exposesWeightedPenaltyAndSatisfactionFlagsFromHardSoftScore() {
        GenericPlanningProblem problem = new GenericPlanningProblem();
        problem.setSourceName("penalty-test.planning");
        problem.setScore(HardSoftScore.of(-2, -13));

        var result = new ResultMapper().toDto(problem, 123L);

        assertThat(result.getPenalty()).isEqualTo(13);
        assertThat(result.getObjectiveValue()).isEqualTo(13);
        assertThat(result.getHardPenalty()).isEqualTo(2);
        assertThat(result.getSoftPenalty()).isEqualTo(13);
        assertThat(result.isConstraintsSatisfied()).isFalse();
        assertThat(result.isPreferencesSatisfied()).isFalse();
        assertThat(result.getObjectiveLine()).isEqualTo("OBJECTIVE: penalty=13");
    }

    @Test
    void reportsZeroPenaltyWhenAllPreferencesAreSatisfied() {
        GenericPlanningProblem problem = new GenericPlanningProblem();
        problem.setSourceName("zero-penalty.planning");
        problem.setScore(HardSoftScore.of(0, 0));

        var result = new ResultMapper().toDto(problem, 50L);

        assertThat(result.getPenalty()).isZero();
        assertThat(result.getHardPenalty()).isZero();
        assertThat(result.getSoftPenalty()).isZero();
        assertThat(result.isConstraintsSatisfied()).isTrue();
        assertThat(result.isPreferencesSatisfied()).isTrue();
        assertThat(result.getStatus()).isEqualTo("FEASIBLE");
    }
}
