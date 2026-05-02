package com.example.planning.dto;

public class AsyncSolveStartResponse {
    private String jobId;
    private String status;
    private long timeLimitSeconds;
    private String sourceName;
    private long createdAtMillis;

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public long getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(long timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public long getCreatedAtMillis() { return createdAtMillis; }
    public void setCreatedAtMillis(long createdAtMillis) { this.createdAtMillis = createdAtMillis; }
}
