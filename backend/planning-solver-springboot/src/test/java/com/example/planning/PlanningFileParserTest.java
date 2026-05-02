package com.example.planning;

import com.example.planning.domain.GenericPlanningProblem;
import com.example.planning.io.PlanningFileParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class PlanningFileParserTest {
    @Test
    void parsesGenericPlanningFile() throws Exception {
        PlanningFileParser parser = new PlanningFileParser(new ObjectMapper());
        byte[] bytes = Files.readAllBytes(Path.of("examples/soutenance-15.planning"));
        GenericPlanningProblem problem = parser.parse(bytes, "soutenance-15.planning");

        assertThat(problem.getActivityInstanceList()).isNotEmpty();
        assertThat(problem.getRoleAssignmentList()).isNotEmpty();
        assertThat(problem.getResourceList()).isNotEmpty();
    }
}
