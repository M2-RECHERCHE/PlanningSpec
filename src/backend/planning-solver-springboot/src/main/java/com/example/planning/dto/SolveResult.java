package com.example.planning.dto;

import java.util.ArrayList;
import java.util.List;

public class SolveResult {
    private String sourceName;
    private String status;
    private String score;
    private int hardScore;
    private int softScore;
    private int penalty;
    private int objectiveValue;
    private int hardPenalty;
    private int softPenalty;
    private boolean constraintsSatisfied;
    private boolean preferencesSatisfied;
    private String objectiveLine;
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
    public int getPenalty() { return penalty; }
    public void setPenalty(int penalty) { this.penalty = penalty; }
    public int getObjectiveValue() { return objectiveValue; }
    public void setObjectiveValue(int objectiveValue) { this.objectiveValue = objectiveValue; }
    public int getHardPenalty() { return hardPenalty; }
    public void setHardPenalty(int hardPenalty) { this.hardPenalty = hardPenalty; }
    public int getSoftPenalty() { return softPenalty; }
    public void setSoftPenalty(int softPenalty) { this.softPenalty = softPenalty; }
    public boolean isConstraintsSatisfied() { return constraintsSatisfied; }
    public void setConstraintsSatisfied(boolean constraintsSatisfied) { this.constraintsSatisfied = constraintsSatisfied; }
    public boolean isPreferencesSatisfied() { return preferencesSatisfied; }
    public void setPreferencesSatisfied(boolean preferencesSatisfied) { this.preferencesSatisfied = preferencesSatisfied; }
    public String getObjectiveLine() { return objectiveLine; }
    public void setObjectiveLine(String objectiveLine) { this.objectiveLine = objectiveLine; }
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
