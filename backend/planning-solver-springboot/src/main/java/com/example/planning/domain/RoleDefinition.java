package com.example.planning.domain;

public class RoleDefinition {
    private String activityType;
    private String role;
    private String resourceType;
    private int min = 0;
    private int max = 1;

    public RoleDefinition() {
    }

    public RoleDefinition(String activityType, String role, String resourceType) {
        this.activityType = activityType;
        this.role = role;
        this.resourceType = resourceType;
    }

    public String getActivityType() {
        return activityType;
    }

    public void setActivityType(String activityType) {
        this.activityType = activityType;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getResourceType() {
        return resourceType;
    }

    public void setResourceType(String resourceType) {
        this.resourceType = resourceType;
    }

    public int getMin() {
        return min;
    }

    public void setMin(int min) {
        this.min = min;
    }

    public int getMax() {
        return max;
    }

    public void setMax(int max) {
        this.max = max;
    }
}
