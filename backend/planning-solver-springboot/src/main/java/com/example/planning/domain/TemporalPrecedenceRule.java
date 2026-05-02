package com.example.planning.domain;

public class TemporalPrecedenceRule {
    private String beforeActivityType;
    private String afterActivityType;

    public TemporalPrecedenceRule() {
    }

    public TemporalPrecedenceRule(String beforeActivityType, String afterActivityType) {
        this.beforeActivityType = beforeActivityType;
        this.afterActivityType = afterActivityType;
    }

    public String getBeforeActivityType() { return beforeActivityType; }
    public void setBeforeActivityType(String beforeActivityType) { this.beforeActivityType = beforeActivityType; }
    public String getAfterActivityType() { return afterActivityType; }
    public void setAfterActivityType(String afterActivityType) { this.afterActivityType = afterActivityType; }
}
