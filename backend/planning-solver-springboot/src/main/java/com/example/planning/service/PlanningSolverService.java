package com.example.planning.service;

import com.example.planning.domain.ActivityInstance;
import com.example.planning.domain.GenericPlanningProblem;
import com.example.planning.domain.RoleAssignment;
import com.example.planning.dto.AsyncSolveStartResponse;
import com.example.planning.dto.AsyncSolveStatus;
import com.example.planning.dto.SolveResult;
import com.example.planning.io.PlanningFileParser;
import com.example.planning.solver.GenericScoreCalculator;
import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.EnvironmentMode;
import org.optaplanner.core.config.solver.SolverConfig;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class PlanningSolverService {
    private static final long JOB_RETENTION_MILLIS = Duration.ofHours(12).toMillis();
    private static final String STATUS_QUEUED = "QUEUED";
    private static final String STATUS_SOLVING = "SOLVING";
    private static final String STATUS_STOP_REQUESTED = "STOP_REQUESTED";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_TERMINATED_EARLY = "TERMINATED_EARLY";
    private static final String STATUS_FAILED = "FAILED";

    private final PlanningFileParser parser;
    private final ResultMapper resultMapper;
    private final ExecutorService solveExecutor;
    private final Map<String, AsyncSolveJob> asyncJobs;

    public PlanningSolverService(PlanningFileParser parser, ResultMapper resultMapper) {
        this.parser = parser;
        this.resultMapper = resultMapper;
        this.solveExecutor = Executors.newCachedThreadPool();
        this.asyncJobs = new ConcurrentHashMap<>();
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

    public AsyncSolveStartResponse startSolveAsync(byte[] content, String sourceName, SolveOptions options) {
        cleanupFinishedJobs();
        GenericPlanningProblem problem = parser.parse(content, sourceName);

        String jobId = UUID.randomUUID().toString();
        AsyncSolveJob job = new AsyncSolveJob(jobId, sourceName, options.getTimeLimitSeconds());
        asyncJobs.put(jobId, job);

        Future<?> future = solveExecutor.submit(() -> runSolveJob(job, problem, options));
        job.future = future;

        AsyncSolveStartResponse response = new AsyncSolveStartResponse();
        response.setJobId(jobId);
        response.setStatus(job.status);
        response.setTimeLimitSeconds(job.timeLimitSeconds);
        response.setSourceName(sourceName);
        response.setCreatedAtMillis(job.createdAtMillis);
        return response;
    }

    public AsyncSolveStatus getAsyncStatus(String jobId) {
        cleanupFinishedJobs();
        AsyncSolveJob job = asyncJobs.get(jobId);
        if (job == null) {
            return null;
        }
        return snapshot(job);
    }

    public AsyncSolveStatus stopAsyncSolve(String jobId) {
        cleanupFinishedJobs();
        AsyncSolveJob job = asyncJobs.get(jobId);
        if (job == null) {
            return null;
        }

        job.stopRequested = true;
        if (!isTerminal(job.status)) {
            job.status = STATUS_STOP_REQUESTED;
        }

        Solver<GenericPlanningProblem> solver = job.runningSolver;
        if (solver != null) {
            solver.terminateEarly();
        }

        return snapshot(job);
    }

    private void runSolveJob(AsyncSolveJob job, GenericPlanningProblem problem, SolveOptions options) {
        job.status = STATUS_SOLVING;
        job.startedAtMillis = System.currentTimeMillis();

        try {
            SolverFactory<GenericPlanningProblem> solverFactory = SolverFactory.create(solverConfig(options));
            Solver<GenericPlanningProblem> solver = solverFactory.buildSolver();
            job.runningSolver = solver;

            solver.addEventListener(event -> {
                GenericPlanningProblem best = event.getNewBestSolution();
                if (best == null) {
                    return;
                }
                long elapsed = Math.max(0, System.currentTimeMillis() - job.startedAtMillis);
                SolveResult interim = resultMapper.toDto(best, elapsed);
                interim.setStatus(STATUS_SOLVING);
                if (interim.getHardScore() == 0) {
                    job.bestSolutionCount.incrementAndGet();
                    job.feasibleSolutionSnapshots.add(interim);
                }
                job.bestScore = interim.getScore();
                job.bestResult = interim;
            });

            GenericPlanningProblem finalSolution = solver.solve(problem);
            long elapsed = Math.max(0, System.currentTimeMillis() - job.startedAtMillis);
            SolveResult finalResult = resultMapper.toDto(finalSolution, elapsed);
            if (finalResult.getHardScore() == 0) {
                boolean appendFinal = true;
                int size = job.feasibleSolutionSnapshots.size();
                if (size > 0) {
                    SolveResult last = job.feasibleSolutionSnapshots.get(size - 1);
                    appendFinal = last == null
                            || last.getElapsedMillis() != finalResult.getElapsedMillis()
                            || (last.getScore() == null ? finalResult.getScore() != null : !last.getScore().equals(finalResult.getScore()));
                }
                if (appendFinal) {
                    job.feasibleSolutionSnapshots.add(finalResult);
                }
                if (job.bestSolutionCount.get() == 0) {
                    job.bestSolutionCount.set(1);
                }
            }

            if (job.stopRequested) {
                finalResult.setStatus(STATUS_TERMINATED_EARLY);
                finalResult.getNotes().add(
                        "Arrêt anticipé demandé: la meilleure solution trouvée avant l'arrêt est retournée."
                );
                job.status = STATUS_TERMINATED_EARLY;
            } else {
                job.status = STATUS_COMPLETED;
            }

            job.bestScore = finalResult.getScore();
            job.bestResult = finalResult;
            job.finalResult = finalResult;
        } catch (Exception exception) {
            job.status = STATUS_FAILED;
            job.errorMessage = exception.getMessage() == null
                    ? "Erreur de résolution inconnue."
                    : exception.getMessage();
        } finally {
            job.runningSolver = null;
            job.finishedAtMillis = System.currentTimeMillis();
        }
    }

    private AsyncSolveStatus snapshot(AsyncSolveJob job) {
        AsyncSolveStatus status = new AsyncSolveStatus();
        status.setJobId(job.id);
        status.setSourceName(job.sourceName);
        status.setTimeLimitSeconds(job.timeLimitSeconds);
        status.setStatus(job.status);
        status.setStopRequested(job.stopRequested);
        status.setTerminal(isTerminal(job.status));
        status.setCreatedAtMillis(job.createdAtMillis);
        status.setStartedAtMillis(job.startedAtMillis);
        status.setFinishedAtMillis(job.finishedAtMillis);
        status.setBestSolutionCount(job.feasibleSolutionSnapshots.size());
        status.setBestScore(job.bestScore);
        status.setResult(job.finalResult != null ? job.finalResult : job.bestResult);
        status.setFeasibleSolutions(new ArrayList<>(job.feasibleSolutionSnapshots));
        status.setErrorMessage(job.errorMessage);
        return status;
    }

    private void cleanupFinishedJobs() {
        long now = Instant.now().toEpochMilli();
        asyncJobs.entrySet().removeIf(entry -> {
            AsyncSolveJob job = entry.getValue();
            if (!isTerminal(job.status)) {
                return false;
            }
            if (job.finishedAtMillis <= 0) {
                return false;
            }
            return (now - job.finishedAtMillis) > JOB_RETENTION_MILLIS;
        });
    }

    private boolean isTerminal(String status) {
        return STATUS_COMPLETED.equals(status)
                || STATUS_TERMINATED_EARLY.equals(status)
                || STATUS_FAILED.equals(status);
    }

    private SolverConfig solverConfig(SolveOptions options) {
        return new SolverConfig()
                .withSolutionClass(GenericPlanningProblem.class)
                .withEntityClasses(ActivityInstance.class, RoleAssignment.class)
                .withEasyScoreCalculatorClass(GenericScoreCalculator.class)
                .withEnvironmentMode(EnvironmentMode.REPRODUCIBLE)
                .withTerminationSpentLimit(Duration.ofSeconds(options.getTimeLimitSeconds()));
    }

    private static final class AsyncSolveJob {
        private final String id;
        private final String sourceName;
        private final long timeLimitSeconds;
        private final long createdAtMillis;
        private final AtomicInteger bestSolutionCount;
        private final List<SolveResult> feasibleSolutionSnapshots;

        private volatile String status;
        private volatile boolean stopRequested;
        private volatile long startedAtMillis;
        private volatile long finishedAtMillis;
        private volatile String bestScore;
        private volatile String errorMessage;

        private volatile SolveResult bestResult;
        private volatile SolveResult finalResult;
        private volatile Solver<GenericPlanningProblem> runningSolver;
        private volatile Future<?> future;

        private AsyncSolveJob(String id, String sourceName, long timeLimitSeconds) {
            this.id = id;
            this.sourceName = sourceName;
            this.timeLimitSeconds = timeLimitSeconds;
            this.createdAtMillis = System.currentTimeMillis();
            this.bestSolutionCount = new AtomicInteger(0);
            this.feasibleSolutionSnapshots = Collections.synchronizedList(new ArrayList<>());
            this.status = STATUS_QUEUED;
            this.stopRequested = false;
            this.startedAtMillis = 0L;
            this.finishedAtMillis = 0L;
            this.bestScore = null;
            this.errorMessage = null;
            this.bestResult = null;
            this.finalResult = null;
            this.runningSolver = null;
            this.future = null;
        }
    }
}
