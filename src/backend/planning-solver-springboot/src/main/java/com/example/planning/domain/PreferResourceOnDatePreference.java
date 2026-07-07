package com.example.planning.domain;

public class PreferResourceOnDatePreference {
    private String resourceId;
    private String day;
    private int weight;

    public PreferResourceOnDatePreference() {
    }

    public PreferResourceOnDatePreference(String resourceId, String day, int weight) {
        this.resourceId = resourceId;
        this.day = day;
        this.weight = weight;
    }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }
    public String getDay() { return day; }
    public void setDay(String day) { this.day = day; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
