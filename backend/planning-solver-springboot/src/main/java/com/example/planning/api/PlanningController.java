package com.example.planning.api;

import com.example.planning.dto.AsyncSolveStartResponse;
import com.example.planning.dto.AsyncSolveStatus;
import com.example.planning.dto.SolveResult;
import com.example.planning.service.PlanningSolverService;
import com.example.planning.service.SolveOptions;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/planning")
public class PlanningController {
    private final PlanningSolverService solverService;

    public PlanningController(PlanningSolverService solverService) {
        this.solverService = solverService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("service", "planning-solver-generic-optaplanner", "status", "UP");
    }

    @PostMapping(value = "/solve", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SolveResult solveMultipart(@RequestParam("file") MultipartFile file,
                                      @RequestParam(defaultValue = "10") long timeLimitSeconds) throws IOException {
        return solverService.solve(file.getBytes(), file.getOriginalFilename(), new SolveOptions(timeLimitSeconds));
    }

    @PostMapping(value = "/solve-json", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SolveResult solveJson(@RequestBody byte[] content,
                                 @RequestParam(defaultValue = "10") long timeLimitSeconds) {
        return solverService.solve(content, "request-body.planning", new SolveOptions(timeLimitSeconds));
    }

    @PostMapping(value = "/solve-json/async/start", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AsyncSolveStartResponse startSolveJsonAsync(
            @RequestBody byte[] content,
            @RequestParam(defaultValue = "10") long timeLimitSeconds
    ) {
        return solverService.startSolveAsync(content, "request-body.planning", new SolveOptions(timeLimitSeconds));
    }

    @GetMapping(value = "/solve-json/async/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public AsyncSolveStatus getSolveJsonAsyncStatus(@PathVariable String jobId) {
        AsyncSolveStatus status = solverService.getAsyncStatus(jobId);
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found");
        }
        return status;
    }

    @PostMapping(value = "/solve-json/async/{jobId}/stop", produces = MediaType.APPLICATION_JSON_VALUE)
    public AsyncSolveStatus stopSolveJsonAsync(@PathVariable String jobId) {
        AsyncSolveStatus status = solverService.stopAsyncSolve(jobId);
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found");
        }
        return status;
    }
}
