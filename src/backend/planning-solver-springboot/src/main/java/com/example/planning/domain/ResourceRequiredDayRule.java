package com.example.planning.domain;

public class ResourceRequiredDayRule {
    private String resourceId;
    private String day;

    public ResourceRequiredDayRule() {
    }

    public ResourceRequiredDayRule(String resourceId, String day) {
        this.resourceId = resourceId;
        this.day = day;
    }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
    public String getDay() { return day; }
    public void setDay(String day) { this.day = day; }
}
