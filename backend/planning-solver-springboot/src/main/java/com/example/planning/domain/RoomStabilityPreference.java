package com.example.planning.domain;

public class RoomStabilityPreference {
    private String activityType;
    private String role;
    private String roomResourceType;
    private String scope;
    private int weight;

    public RoomStabilityPreference() {
    }

    public RoomStabilityPreference(String activityType, String role, String roomResourceType, String scope, int weight) {
        this.activityType = activityType;
        this.role = role;
        this.roomResourceType = roomResourceType;
        this.scope = scope;
        this.weight = weight;
    }

    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getRoomResourceType() { return roomResourceType; }
    public void setRoomResourceType(String roomResourceType) { this.roomResourceType = roomResourceType; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
