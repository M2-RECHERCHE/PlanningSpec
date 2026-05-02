package com.example.planning.domain;

public class CompactSchedulePreference {
    private String activityType;
    private String role;
    private String scope;
    private int weight;

    public CompactSchedulePreference() {
    }

    public CompactSchedulePreference(String activityType, String role, String scope, int weight) {
        this.activityType = activityType;
        this.role = role;
        this.scope = scope;
        this.weight = weight;
    }

    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
