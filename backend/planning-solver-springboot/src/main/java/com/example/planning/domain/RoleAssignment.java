package com.example.planning.domain;

import org.optaplanner.core.api.domain.entity.PlanningEntity;
import org.optaplanner.core.api.domain.lookup.PlanningId;
import org.optaplanner.core.api.domain.variable.PlanningVariable;

import java.util.ArrayList;
import java.util.List;

@PlanningEntity
public class RoleAssignment {
    @PlanningId
    private String id;
    private ActivityInstance activityInstance;
    private String activityType;
    private String role;
    private String resourceType;
    private int slotIndex;
    private boolean requiredSlot;
    private List<String> forbiddenResourceIds = new ArrayList<>();

    @PlanningVariable(valueRangeProviderRefs = "resourceRange", nullable = true)
    private Resource resource;

    public RoleAssignment() {
    }

    public RoleAssignment(String id, ActivityInstance activityInstance, String role, String resourceType, int slotIndex, boolean requiredSlot) {
        this.id = id;
        this.activityInstance = activityInstance;
        this.activityType = activityInstance.getActivityType();
        this.role = role;
        this.resourceType = resourceType;
        this.slotIndex = slotIndex;
        this.requiredSlot = requiredSlot;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ActivityInstance getActivityInstance() {
        return activityInstance;
    }

    public void setActivityInstance(ActivityInstance activityInstance) {
        this.activityInstance = activityInstance;
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

    public int getSlotIndex() {
        return slotIndex;
    }

    public void setSlotIndex(int slotIndex) {
        this.slotIndex = slotIndex;
    }

    public boolean isRequiredSlot() {
        return requiredSlot;
    }

    public void setRequiredSlot(boolean requiredSlot) {
        this.requiredSlot = requiredSlot;
    }

    public Resource getResource() {
        return resource;
    }

    public void setResource(Resource resource) {
        this.resource = resource;
    }

    public List<String> getForbiddenResourceIds() {
        return forbiddenResourceIds;
    }

    public void setForbiddenResourceIds(List<String> forbiddenResourceIds) {
        this.forbiddenResourceIds = forbiddenResourceIds;
    }

    public boolean hasResource() {
        return resource != null;
    }

    @Override
    public String toString() {
        return id;
    }
}
