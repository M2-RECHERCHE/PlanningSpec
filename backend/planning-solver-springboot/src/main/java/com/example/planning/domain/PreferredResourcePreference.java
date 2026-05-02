package com.example.planning.domain;

public class PreferredResourcePreference {
    private String activityInstanceId;
    private String role;
    private String resourceId;
    private int weight;

    public PreferredResourcePreference() {
    }

    public PreferredResourcePreference(String activityInstanceId, String role, String resourceId, int weight) {
        this.activityInstanceId = activityInstanceId;
        this.role = role;
        this.resourceId = resourceId;
        this.weight = weight;
    }

    public String getActivityInstanceId() { return activityInstanceId; }
    public void setActivityInstanceId(String activityInstanceId) { this.activityInstanceId = activityInstanceId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
