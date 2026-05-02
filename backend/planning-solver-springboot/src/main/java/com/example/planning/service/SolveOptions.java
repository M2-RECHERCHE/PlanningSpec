package com.example.planning.service;

public class SolveOptions {
    private long timeLimitSeconds = 10;

    public SolveOptions() {
    }

    public SolveOptions(long timeLimitSeconds) {
        this.timeLimitSeconds = Math.max(1, timeLimitSeconds);
    }

    public long getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(long timeLimitSeconds) { this.timeLimitSeconds = Math.max(1, timeLimitSeconds); }
}
