package com.example.planning.service;

import com.example.planning.dto.SolveResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

@Component
public class CommandLineSolveRunner implements CommandLineRunner {
    private final PlanningSolverService solverService;
    private final ObjectMapper objectMapper;

    public CommandLineSolveRunner(PlanningSolverService solverService, ObjectMapper objectMapper) {
        this.solverService = solverService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) throws Exception {
        Map<String, String> options = parseArgs(args);
        String input = options.get("input");
        if (input == null || input.isBlank()) {
            return;
        }
        String output = options.getOrDefault("output", "result.json");
        long timeLimit = Long.parseLong(options.getOrDefault("timeLimitSeconds", "10"));
        byte[] bytes = Files.readAllBytes(Path.of(input));
        SolveResult result = solverService.solve(bytes, Path.of(input).getFileName().toString(), new SolveOptions(timeLimit));
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(Path.of(output).toFile(), result);
        System.out.println("Résultat écrit dans: " + output);
        System.out.println("Score: " + result.getScore() + " ; status=" + result.getStatus());
    }

    private Map<String, String> parseArgs(String[] args) {
        Map<String, String> map = new HashMap<>();
        for (String arg : args) {
            if (!arg.startsWith("--") || !arg.contains("=")) continue;
            String[] parts = arg.substring(2).split("=", 2);
            map.put(parts[0], parts[1]);
        }
        return map;
    }
}
