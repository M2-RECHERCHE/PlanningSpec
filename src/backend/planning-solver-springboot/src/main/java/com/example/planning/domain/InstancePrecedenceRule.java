package com.example.planning.domain;

public class InstancePrecedenceRule {
    private String beforeActivityInstanceId;
    private String afterActivityInstanceId;

    public InstancePrecedenceRule() {
    }

    public InstancePrecedenceRule(String beforeActivityInstanceId, String afterActivityInstanceId) {
        this.beforeActivityInstanceId = beforeActivityInstanceId;
        this.afterActivityInstanceId = afterActivityInstanceId;
    }

    public String getBeforeActivityInstanceId() { return beforeActivityInstanceId; }
    public void setBeforeActivityInstanceId(String beforeActivityInstanceId) { this.beforeActivityInstanceId = beforeActivityInstanceId; }
    public String getAfterActivityInstanceId() { return afterActivityInstanceId; }
    public void setAfterActivityInstanceId(String afterActivityInstanceId) { this.afterActivityInstanceId = afterActivityInstanceId; }
}
