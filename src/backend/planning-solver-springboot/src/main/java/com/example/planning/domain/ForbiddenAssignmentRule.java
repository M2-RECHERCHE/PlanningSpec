package com.example.planning.domain;

public class ForbiddenAssignmentRule {
    private String activityInstanceId;
    private String role;
    private String resourceId;

    public ForbiddenAssignmentRule() {
    }

    public ForbiddenAssignmentRule(String activityInstanceId, String role, String resourceId) {
        this.activityInstanceId = activityInstanceId;
        this.role = role;
        this.resourceId = resourceId;
    }

    public String getActivityInstanceId() { return activityInstanceId; }
    public void setActivityInstanceId(String activityInstanceId) { this.activityInstanceId = activityInstanceId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
}
