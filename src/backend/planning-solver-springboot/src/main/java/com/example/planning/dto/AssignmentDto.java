package com.example.planning.dto;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class AssignmentDto {
    private String activityInstance;
    private String activity;
    private int duration;
    private String day;
    private int slotInDay;
    private int globalSlot;
    private Map<String, List<String>> roles = new LinkedHashMap<>();

    public String getActivityInstance() { return activityInstance; }
    public void setActivityInstance(String activityInstance) { this.activityInstance = activityInstance; }
    public String getActivity() { return activity; }
    public void setActivity(String activity) { this.activity = activity; }
    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }
    public String getDay() { return day; }
    public void setDay(String day) { this.day = day; }
    public int getSlotInDay() { return slotInDay; }
    public void setSlotInDay(int slotInDay) { this.slotInDay = slotInDay; }
    public int getGlobalSlot() { return globalSlot; }
    public void setGlobalSlot(int globalSlot) { this.globalSlot = globalSlot; }
    public Map<String, List<String>> getRoles() { return roles; }
    public void setRoles(Map<String, List<String>> roles) { this.roles = roles; }
}
