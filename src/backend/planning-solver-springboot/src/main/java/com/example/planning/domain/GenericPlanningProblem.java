package com.example.planning.domain;

import org.optaplanner.core.api.domain.solution.PlanningEntityCollectionProperty;
import org.optaplanner.core.api.domain.solution.PlanningScore;
import org.optaplanner.core.api.domain.solution.PlanningSolution;
import org.optaplanner.core.api.domain.solution.ProblemFactCollectionProperty;
import org.optaplanner.core.api.domain.valuerange.ValueRangeProvider;
import org.optaplanner.core.api.score.buildin.hardsoft.HardSoftScore;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@PlanningSolution
public class GenericPlanningProblem {
    private String sourceName;
    private List<String> dayList = new ArrayList<>();
    private int slotsPerDay;

    @ProblemFactCollectionProperty
    @ValueRangeProvider(id = "timeslotRange")
    private List<Timeslot> timeslotList = new ArrayList<>();

    @ProblemFactCollectionProperty
    @ValueRangeProvider(id = "resourceRange")
    private List<Resource> resourceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ActivityDefinition> activityDefinitionList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<RoleDefinition> roleDefinitionList = new ArrayList<>();

    @PlanningEntityCollectionProperty
    private List<ActivityInstance> activityInstanceList = new ArrayList<>();

    @PlanningEntityCollectionProperty
    private List<RoleAssignment> roleAssignmentList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<FixedAssignmentRule> fixedAssignmentRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ForbiddenAssignmentRule> forbiddenAssignmentRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<RequiredResourceRule> requiredResourceRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ResourceExclusivityRule> resourceExclusivityRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ResourceRequiredDayRule> resourceRequiredDayRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<ResourceSingleDayRule> resourceSingleDayRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<InstancePrecedenceRule> instancePrecedenceRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<TemporalPrecedenceRule> temporalPrecedenceRuleList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<AvoidParticipationPreference> avoidParticipationPreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<PreferResourceOnDatePreference> preferResourceOnDatePreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<PreferResourceSingleDayPreference> preferResourceSingleDayPreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<PreferredResourcePreference> preferredResourcePreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<MaxPerScopePreference> maxPerScopePreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<RoomStabilityPreference> roomStabilityPreferenceList = new ArrayList<>();

    @ProblemFactCollectionProperty
    private List<CompactSchedulePreference> compactSchedulePreferenceList = new ArrayList<>();

    @PlanningScore
    private HardSoftScore score;

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public List<String> getDayList() { return dayList; }
    public void setDayList(List<String> dayList) { this.dayList = dayList; }
    public int getSlotsPerDay() { return slotsPerDay; }
    public void setSlotsPerDay(int slotsPerDay) { this.slotsPerDay = slotsPerDay; }
    public List<Timeslot> getTimeslotList() { return timeslotList; }
    public void setTimeslotList(List<Timeslot> timeslotList) { this.timeslotList = timeslotList; }
    public List<Resource> getResourceList() { return resourceList; }
    public void setResourceList(List<Resource> resourceList) { this.resourceList = resourceList; }
    public List<ActivityDefinition> getActivityDefinitionList() { return activityDefinitionList; }
    public void setActivityDefinitionList(List<ActivityDefinition> activityDefinitionList) { this.activityDefinitionList = activityDefinitionList; }
    public List<RoleDefinition> getRoleDefinitionList() { return roleDefinitionList; }
    public void setRoleDefinitionList(List<RoleDefinition> roleDefinitionList) { this.roleDefinitionList = roleDefinitionList; }
    public List<ActivityInstance> getActivityInstanceList() { return activityInstanceList; }
    public void setActivityInstanceList(List<ActivityInstance> activityInstanceList) { this.activityInstanceList = activityInstanceList; }
    public List<RoleAssignment> getRoleAssignmentList() { return roleAssignmentList; }
    public void setRoleAssignmentList(List<RoleAssignment> roleAssignmentList) { this.roleAssignmentList = roleAssignmentList; }
    public List<FixedAssignmentRule> getFixedAssignmentRuleList() { return fixedAssignmentRuleList; }
    public void setFixedAssignmentRuleList(List<FixedAssignmentRule> fixedAssignmentRuleList) { this.fixedAssignmentRuleList = fixedAssignmentRuleList; }
    public List<ForbiddenAssignmentRule> getForbiddenAssignmentRuleList() { return forbiddenAssignmentRuleList; }
    public void setForbiddenAssignmentRuleList(List<ForbiddenAssignmentRule> forbiddenAssignmentRuleList) { this.forbiddenAssignmentRuleList = forbiddenAssignmentRuleList; }
    public List<RequiredResourceRule> getRequiredResourceRuleList() { return requiredResourceRuleList; }
    public void setRequiredResourceRuleList(List<RequiredResourceRule> requiredResourceRuleList) { this.requiredResourceRuleList = requiredResourceRuleList; }
    public List<ResourceExclusivityRule> getResourceExclusivityRuleList() { return resourceExclusivityRuleList; }
    public void setResourceExclusivityRuleList(List<ResourceExclusivityRule> resourceExclusivityRuleList) { this.resourceExclusivityRuleList = resourceExclusivityRuleList; }
    public List<ResourceRequiredDayRule> getResourceRequiredDayRuleList() { return resourceRequiredDayRuleList; }
    public void setResourceRequiredDayRuleList(List<ResourceRequiredDayRule> resourceRequiredDayRuleList) { this.resourceRequiredDayRuleList = resourceRequiredDayRuleList; }
    public List<ResourceSingleDayRule> getResourceSingleDayRuleList() { return resourceSingleDayRuleList; }
    public void setResourceSingleDayRuleList(List<ResourceSingleDayRule> resourceSingleDayRuleList) { this.resourceSingleDayRuleList = resourceSingleDayRuleList; }
    public List<InstancePrecedenceRule> getInstancePrecedenceRuleList() { return instancePrecedenceRuleList; }
    public void setInstancePrecedenceRuleList(List<InstancePrecedenceRule> instancePrecedenceRuleList) { this.instancePrecedenceRuleList = instancePrecedenceRuleList; }
    public List<TemporalPrecedenceRule> getTemporalPrecedenceRuleList() { return temporalPrecedenceRuleList; }
    public void setTemporalPrecedenceRuleList(List<TemporalPrecedenceRule> temporalPrecedenceRuleList) { this.temporalPrecedenceRuleList = temporalPrecedenceRuleList; }
    public List<AvoidParticipationPreference> getAvoidParticipationPreferenceList() { return avoidParticipationPreferenceList; }
    public void setAvoidParticipationPreferenceList(List<AvoidParticipationPreference> avoidParticipationPreferenceList) { this.avoidParticipationPreferenceList = avoidParticipationPreferenceList; }
    public List<PreferResourceOnDatePreference> getPreferResourceOnDatePreferenceList() { return preferResourceOnDatePreferenceList; }
    public void setPreferResourceOnDatePreferenceList(List<PreferResourceOnDatePreference> preferResourceOnDatePreferenceList) { this.preferResourceOnDatePreferenceList = preferResourceOnDatePreferenceList; }
    public List<PreferResourceSingleDayPreference> getPreferResourceSingleDayPreferenceList() { return preferResourceSingleDayPreferenceList; }
    public void setPreferResourceSingleDayPreferenceList(List<PreferResourceSingleDayPreference> preferResourceSingleDayPreferenceList) { this.preferResourceSingleDayPreferenceList = preferResourceSingleDayPreferenceList; }
    public List<PreferredResourcePreference> getPreferredResourcePreferenceList() { return preferredResourcePreferenceList; }
    public void setPreferredResourcePreferenceList(List<PreferredResourcePreference> preferredResourcePreferenceList) { this.preferredResourcePreferenceList = preferredResourcePreferenceList; }
    public List<MaxPerScopePreference> getMaxPerScopePreferenceList() { return maxPerScopePreferenceList; }
    public void setMaxPerScopePreferenceList(List<MaxPerScopePreference> maxPerScopePreferenceList) { this.maxPerScopePreferenceList = maxPerScopePreferenceList; }
    public List<RoomStabilityPreference> getRoomStabilityPreferenceList() { return roomStabilityPreferenceList; }
    public void setRoomStabilityPreferenceList(List<RoomStabilityPreference> roomStabilityPreferenceList) { this.roomStabilityPreferenceList = roomStabilityPreferenceList; }
    public List<CompactSchedulePreference> getCompactSchedulePreferenceList() { return compactSchedulePreferenceList; }
    public void setCompactSchedulePreferenceList(List<CompactSchedulePreference> compactSchedulePreferenceList) { this.compactSchedulePreferenceList = compactSchedulePreferenceList; }
    public HardSoftScore getScore() { return score; }
    public void setScore(HardSoftScore score) { this.score = score; }

    public Map<String, ActivityInstance> activityById() {
        Map<String, ActivityInstance> map = new LinkedHashMap<>();
        for (ActivityInstance activityInstance : activityInstanceList) {
            map.put(activityInstance.getId(), activityInstance);
        }
        return map;
    }
}
