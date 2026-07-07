package com.example.planning.dto;

import java.util.ArrayList;
import java.util.List;

public class AsyncSolveStatus {
    private String jobId;
    private String sourceName;
    private Long timeLimitSeconds;
    private String status;
    private boolean stopRequested;
    private boolean terminal;
    private long createdAtMillis;
    private long startedAtMillis;
    private long finishedAtMillis;
    private int bestSolutionCount;
    private String bestScore;
    private Integer bestPenalty;
    private Integer bestHardPenalty;
    private Integer bestSoftPenalty;
    private Boolean constraintsSatisfied;
    private Boolean preferencesSatisfied;
    private SolveResult result;
    private List<SolveResult> feasibleSolutions = new ArrayList<>();
    private String errorMessage;

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public Long getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(Long timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isStopRequested() { return stopRequested; }
    public void setStopRequested(boolean stopRequested) { this.stopRequested = stopRequested; }

    public boolean isTerminal() { return terminal; }
    public void setTerminal(boolean terminal) { this.terminal = terminal; }

    public long getCreatedAtMillis() { return createdAtMillis; }
    public void setCreatedAtMillis(long createdAtMillis) { this.createdAtMillis = createdAtMillis; }

    public long getStartedAtMillis() { return startedAtMillis; }
    public void setStartedAtMillis(long startedAtMillis) { this.startedAtMillis = startedAtMillis; }

    public long getFinishedAtMillis() { return finishedAtMillis; }
    public void setFinishedAtMillis(long finishedAtMillis) { this.finishedAtMillis = finishedAtMillis; }

    public int getBestSolutionCount() { return bestSolutionCount; }
    public void setBestSolutionCount(int bestSolutionCount) { this.bestSolutionCount = bestSolutionCount; }

    public String getBestScore() { return bestScore; }
    public void setBestScore(String bestScore) { this.bestScore = bestScore; }

    public Integer getBestPenalty() { return bestPenalty; }
    public void setBestPenalty(Integer bestPenalty) { this.bestPenalty = bestPenalty; }

    public Integer getBestHardPenalty() { return bestHardPenalty; }
    public void setBestHardPenalty(Integer bestHardPenalty) { this.bestHardPenalty = bestHardPenalty; }

    public Integer getBestSoftPenalty() { return bestSoftPenalty; }
    public void setBestSoftPenalty(Integer bestSoftPenalty) { this.bestSoftPenalty = bestSoftPenalty; }

    public Boolean getConstraintsSatisfied() { return constraintsSatisfied; }
    public void setConstraintsSatisfied(Boolean constraintsSatisfied) { this.constraintsSatisfied = constraintsSatisfied; }

    public Boolean getPreferencesSatisfied() { return preferencesSatisfied; }
    public void setPreferencesSatisfied(Boolean preferencesSatisfied) { this.preferencesSatisfied = preferencesSatisfied; }

    public SolveResult getResult() { return result; }
    public void setResult(SolveResult result) { this.result = result; }

    public List<SolveResult> getFeasibleSolutions() { return feasibleSolutions; }
    public void setFeasibleSolutions(List<SolveResult> feasibleSolutions) { this.feasibleSolutions = feasibleSolutions; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
