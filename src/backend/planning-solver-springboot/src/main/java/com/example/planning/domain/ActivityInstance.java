package com.example.planning.domain;

import org.optaplanner.core.api.domain.entity.PlanningEntity;
import org.optaplanner.core.api.domain.lookup.PlanningId;
import org.optaplanner.core.api.domain.variable.PlanningVariable;

@PlanningEntity
public class ActivityInstance {
    @PlanningId
    private String id;
    private String activityType;
    private int duration = 1;
    private int minSlot = 1;
    private int maxSlot = Integer.MAX_VALUE;

    @PlanningVariable(valueRangeProviderRefs = "timeslotRange")
    private Timeslot start;

    public ActivityInstance() {
    }

    public ActivityInstance(String id, String activityType, int duration) {
        this.id = id;
        this.activityType = activityType;
        this.duration = duration;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getActivityType() {
        return activityType;
    }

    public void setActivityType(String activityType) {
        this.activityType = activityType;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public int getMinSlot() {
        return minSlot;
    }

    public void setMinSlot(int minSlot) {
        this.minSlot = minSlot;
    }

    public int getMaxSlot() {
        return maxSlot;
    }

    public void setMaxSlot(int maxSlot) {
        this.maxSlot = maxSlot;
    }

    public Timeslot getStart() {
        return start;
    }

    public void setStart(Timeslot start) {
        this.start = start;
    }

    public int getStartIndex() {
        return start == null ? 0 : start.getGlobalIndex();
    }

    public int getEndExclusive() {
        return start == null ? 0 : start.getGlobalIndex() + duration;
    }

    public int getEndInclusive() {
        return start == null ? 0 : start.getGlobalIndex() + duration - 1;
    }

    public String getDay() {
        return start == null ? null : start.getDay();
    }

    public int getSlotInDay() {
        return start == null ? 0 : start.getSlotInDay();
    }

    @Override
    public String toString() {
        return id;
    }
}
