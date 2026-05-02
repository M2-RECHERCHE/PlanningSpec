package com.example.planning.service;

import com.example.planning.domain.ActivityInstance;
import com.example.planning.domain.GenericPlanningProblem;
import com.example.planning.domain.RoleAssignment;
import com.example.planning.dto.SolveResult;
import com.example.planning.io.PlanningFileParser;
import com.example.planning.solver.GenericScoreCalculator;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.EnvironmentMode;
import org.optaplanner.core.config.solver.SolverConfig;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class PlanningSolverService {
    private final PlanningFileParser parser;
    private final ResultMapper resultMapper;

    public PlanningSolverService(PlanningFileParser parser, ResultMapper resultMapper) {
        this.parser = parser;
        this.resultMapper = resultMapper;
    }

    public SolveResult solve(byte[] content, String sourceName, SolveOptions options) {
        GenericPlanningProblem problem = parser.parse(content, sourceName);
        SolverFactory<GenericPlanningProblem> solverFactory = SolverFactory.create(solverConfig(options));
        Solver<GenericPlanningProblem> solver = solverFactory.buildSolver();
        long start = System.currentTimeMillis();
        GenericPlanningProblem solution = solver.solve(problem);
        long elapsed = System.currentTimeMillis() - start;
        return resultMapper.toDto(solution, elapsed);
    }

    private SolverConfig solverConfig(SolveOptions options) {
        return new SolverConfig()
                .withSolutionClass(GenericPlanningProblem.class)
                .withEntityClasses(ActivityInstance.class, RoleAssignment.class)
                .withEasyScoreCalculatorClass(GenericScoreCalculator.class)
                .withEnvironmentMode(EnvironmentMode.REPRODUCIBLE)
                .withTerminationSpentLimit(Duration.ofSeconds(options.getTimeLimitSeconds()));
    }
}
