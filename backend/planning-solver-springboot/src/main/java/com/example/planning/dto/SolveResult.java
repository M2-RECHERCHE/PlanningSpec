package com.example.planning.dto;

import java.util.ArrayList;
import java.util.List;

public class SolveResult {
    private String sourceName;
    private String status;
    private String score;
    private int hardScore;
    private int softScore;
    private long elapsedMillis;
    private int activityCount;
    private int roleAssignmentCount;
    private List<AssignmentDto> assignments = new ArrayList<>();
    private List<String> notes = new ArrayList<>();

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getScore() { return score; }
    public void setScore(String score) { this.score = score; }
    public int getHardScore() { return hardScore; }
    public void setHardScore(int hardScore) { this.hardScore = hardScore; }
    public int getSoftScore() { return softScore; }
    public void setSoftScore(int softScore) { this.softScore = softScore; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public int getActivityCount() { return activityCount; }
    public void setActivityCount(int activityCount) { this.activityCount = activityCount; }
    public int getRoleAssignmentCount() { return roleAssignmentCount; }
    public void setRoleAssignmentCount(int roleAssignmentCount) { this.roleAssignmentCount = roleAssignmentCount; }
    public List<AssignmentDto> getAssignments() { return assignments; }
    public void setAssignments(List<AssignmentDto> assignments) { this.assignments = assignments; }
    public List<String> getNotes() { return notes; }
    public void setNotes(List<String> notes) { this.notes = notes; }
}
