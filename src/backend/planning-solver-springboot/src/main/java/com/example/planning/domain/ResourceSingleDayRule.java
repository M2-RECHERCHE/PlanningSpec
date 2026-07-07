package com.example.planning.domain;

public class ResourceSingleDayRule {
    private String resourceId;

    public ResourceSingleDayRule() {
    }

    public ResourceSingleDayRule(String resourceId) {
        this.resourceId = resourceId;
    }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
}
