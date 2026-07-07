package com.example.planning.service;

public class SolveOptions {
    private Long timeLimitSeconds;

    public SolveOptions() {
    }

    public SolveOptions(Long timeLimitSeconds) {
        setTimeLimitSeconds(timeLimitSeconds);
    }

    public Long getTimeLimitSeconds() { return timeLimitSeconds; }

    public void setTimeLimitSeconds(Long timeLimitSeconds) {
        this.timeLimitSeconds = timeLimitSeconds == null || timeLimitSeconds <= 0
                ? null
                : Math.max(1L, timeLimitSeconds);
    }

    public boolean hasTimeLimit() {
        return timeLimitSeconds != null && timeLimitSeconds > 0;
    }
}
