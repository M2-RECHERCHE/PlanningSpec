package com.example.planning.domain;

public class ActivityDefinition {
    private String type;
    private int count;
    private int duration = 1;

    public ActivityDefinition() {
    }

    public ActivityDefinition(String type, int count, int duration) {
        this.type = type;
        this.count = count;
        this.duration = duration;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }
}
