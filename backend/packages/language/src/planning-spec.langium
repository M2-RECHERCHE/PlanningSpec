grammar PlanningSpec

entry Planification:
    '{'
        '"time"' ':' time=Time ','
        '"activities"' ':' activities=Activities ','
        '"resources"' ':' resources=Resources ','
        '"roles"' ':' roles=Roles ','
        '"constraints"' ':' constraints=Constraints ','
        '"preferences"' ':' preferences=Preferences
    '}';

Time:
    '{'
        '"days"' ':' days=DaysList ','
        '"slotsPerDay"' ':' slotsPerDay=INT
    '}';

DaysList:
    '[' days+=STRING (',' days+=STRING)* ']';

Activities:
    '{' (activities+=ActivityEntry (',' activities+=ActivityEntry)*)? '}';

ActivityEntry:
    name=STRING ':' '{'
        '"count"' ':' count=INT
        (',' '"duration"' ':' duration=INT)?
    '}';

Resources:
    '{' (resources+=ResourceEntry (',' resources+=ResourceEntry)*)? '}';

ResourceEntry:
    name=STRING ':' '[' (instances+=ResourceInstance (',' instances+=ResourceInstance)*)? ']';

ResourceInstance:
    name=STRING;

Roles:
    '{' (roles+=RoleEntry (',' roles+=RoleEntry)*)? '}';

RoleEntry:
    name=STRING ':' '{' assignments+=RoleAssignment (',' assignments+=RoleAssignment)* '}';

RoleAssignment:
    roleName=STRING ':' resourceRef=STRING;

Constraints:
    '[' (constraints+=Constraint (',' constraints+=Constraint)*)? ']';

Constraint:
    CardinalityPerActivity | ResourceExclusivity | FixedAssignment | ForbiddenAssignment;

CardinalityPerActivity:
    '{'
        '"type"' ':' '"cardinality_per_activity"' ','
        '"activity"' ':' activity=STRING ','
        (('"target"' ':' target=STRING) | ('"role"' ':' role=STRING)) ','
        '"min"' ':' min=INT ','
        '"max"' ':' max=INT
    '}';

ResourceExclusivity:
    '{'
        '"type"' ':' '"resource_exclusivity"' ','
        '"resourceType"' ':' resourceType=STRING ','
        '"activity"' ':' activity=STRING ','
        '"scope"' ':' scope=STRING ','
        '"max"' ':' max=INT
    '}';

FixedAssignment:
    '{'
        '"type"' ':' '"fixed_assignment"' ','
        '"activityInstance"' ':' activityInstance=STRING ','
        '"role"' ':' role=STRING ','
        '"resource"' ':' resource=STRING
    '}';

ForbiddenAssignment:
    '{'
        '"type"' ':' '"forbidden_assignment"' ','
        '"activityInstance"' ':' activityInstance=STRING ','
        '"role"' ':' role=STRING ','
        '"resource"' ':' resource=STRING
    '}';

Preferences:
    '[' (preferences+=Preference (',' preferences+=Preference)*)? ']';

Preference:
    AvoidParticipationOnDate | MaxPerScope;

AvoidParticipationOnDate:
    '{'
        '"type"' ':' '"avoid_participation_on_date"' ','
        '"resource"' ':' resource=STRING ','
        '"date"' ':' date=STRING ','
        '"weight"' ':' weight=INT
    '}';

MaxPerScope:
    '{'
        '"type"' ':' '"max_per_scope"' ','
        '"resourceType"' ':' resourceType=STRING ','
        '"activity"' ':' activity=STRING ','
        '"scope"' ':' scope=STRING ','
        '"max"' ':' max=INT ','
        '"weight"' ':' weight=INT
    '}';


terminal STRING: /"([^"\\]|\\.)*"/;

terminal INT returns number: /[0-9]+/;

hidden terminal WS: /\s+/;
