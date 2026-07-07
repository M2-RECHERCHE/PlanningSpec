package com.example.planning.domain;

import org.optaplanner.core.api.domain.lookup.PlanningId;

import java.util.Objects;

public class Timeslot {
    @PlanningId
    private int globalIndex;
    private String day;
    private int slotInDay;

    public Timeslot() {
    }

    public Timeslot(String day, int slotInDay, int globalIndex) {
        this.day = day;
        this.slotInDay = slotInDay;
        this.globalIndex = globalIndex;
    }

    public int getGlobalIndex() {
        return globalIndex;
    }

    public void setGlobalIndex(int globalIndex) {
        this.globalIndex = globalIndex;
    }

    public String getDay() {
        return day;
    }

    public void setDay(String day) {
        this.day = day;
    }

    public int getSlotInDay() {
        return slotInDay;
    }

    public void setSlotInDay(int slotInDay) {
        this.slotInDay = slotInDay;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Timeslot timeslot)) return false;
        return globalIndex == timeslot.globalIndex;
    }

    @Override
    public int hashCode() {
        return Objects.hash(globalIndex);
    }

    @Override
    public String toString() {
        return day + ":" + slotInDay;
    }
}
