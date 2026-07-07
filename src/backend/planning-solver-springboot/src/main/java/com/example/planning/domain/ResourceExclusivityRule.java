package com.example.planning.domain;

public class ResourceExclusivityRule {
    private String resourceType;
    private String activityType;
    private String scope;
    private int max;

    public ResourceExclusivityRule() {
    }

    public ResourceExclusivityRule(String resourceType, String activityType, String scope, int max) {
        this.resourceType = resourceType;
        this.activityType = activityType;
        this.scope = scope;
        this.max = max;
    }

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public int getMax() { return max; }
    public void setMax(int max) { this.max = max; }
}
