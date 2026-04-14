export type PlanStatus = 'draft' | 'active' | 'paused' | 'done' | 'error';
export type ProjectStatus = 'active' | 'archived' | 'completed';

export interface Badge {
  id: string;
  name: string;
  color: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  planCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface Planning {
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  status: PlanStatus;
  currentStep: number;
  totalSteps: number;
  progress: number;
  badges?: Badge[];
  createdAt: string;
  updatedAt: string;
  data?: Record<string, any>;
  solutionOutput?: string;
  solutionWarnings?: string[];
  lastErrorMessage?: string;
  errorDetails?: string[];
  errorHint?: string;
}

export interface StepData {
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  data?: Record<string, any>;
}

export interface PlanningSolveResult {
  planning: Planning;
  output: string;
  warnings: string[];
}
