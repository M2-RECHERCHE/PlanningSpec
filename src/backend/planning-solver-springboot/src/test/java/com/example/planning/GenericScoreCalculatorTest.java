package com.example.planning;

import com.example.planning.domain.GenericPlanningProblem;
import com.example.planning.io.PlanningFileParser;
import com.example.planning.solver.GenericScoreCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class GenericScoreCalculatorTest {
    @Test
    void initialSolutionHasFiniteScore() throws Exception {
        PlanningFileParser parser = new PlanningFileParser(new ObjectMapper());
        byte[] bytes = Files.readAllBytes(Path.of("examples/soutenance-15.planning"));
        GenericPlanningProblem problem = parser.parse(bytes, "soutenance-15.planning");

        var score = new GenericScoreCalculator().calculateScore(problem);
        assertThat(score).isNotNull();
    }
}
