package com.example.planning.domain;

public class PreferResourceSingleDayPreference {
    private String resourceId;
    private int weight;

    public PreferResourceSingleDayPreference() {
    }

    public PreferResourceSingleDayPreference(String resourceId, int weight) {
        this.resourceId = resourceId;
        this.weight = weight;
    }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
