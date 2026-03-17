export interface PlanningData {
  time: {
    days: string[];
    slotsPerDay: number;
  };
  activities: Record<string, {
    count: number;
    duration: number;
  }>;
  resources: Record<string, string[]>;
  roles: Record<string, Record<string, string>>;
  constraints: Array<{
    type: string;
    activity?: string;
    role?: string;
    resourceType?: string;
    target?: string;
    min?: number;
    max?: number;
    activityInstance?: string;
    resource?: string;
    scope?: string;
  }>;
  preferences: Array<{
    type: string;
    resource?: string;
    date?: string;
    resourceType?: string;
    activity?: string;
    scope?: string;
    max?: number;
    weight?: number;
  }>;
}
