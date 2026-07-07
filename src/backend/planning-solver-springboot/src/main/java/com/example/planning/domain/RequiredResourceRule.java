package com.example.planning.domain;

public class RequiredResourceRule {
    private String activityInstanceId;
    private String resourceId;

    public RequiredResourceRule() {
    }

    public RequiredResourceRule(String activityInstanceId, String resourceId) {
        this.activityInstanceId = activityInstanceId;
        this.resourceId = resourceId;
    }

    public String getActivityInstanceId() { return activityInstanceId; }
    public void setActivityInstanceId(String activityInstanceId) { this.activityInstanceId = activityInstanceId; }
    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
}
