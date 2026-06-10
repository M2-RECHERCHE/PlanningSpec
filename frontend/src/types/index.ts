export type PlanStatus = 'draft' | 'active' | 'paused' | 'done' | 'error';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type PlanningExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SOLUTION_FOUND'
  | 'OPTIMIZING'
  | 'COMPLETED'
  | 'OPTIMAL'
  | 'UNSATISFIABLE'
  | 'FAILED'
  | 'STOP_REQUESTED'
  | 'STOPPING'
  | 'STOPPED'
  | 'UNKNOWN';

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
  solutionSolveTimeMs?: number;
  lastErrorMessage?: string;
  errorDetails?: string[];
  errorHint?: string;
}

export interface PlanningSolutionVersion {
  id: string;
  planningId: string;
  userId: string;
  executionId?: string;
  versionNumber?: number;
  solutionKind?: 'intermediate' | 'best_current' | 'final' | 'optimal' | 'stopped';
  status?: 'INTERMEDIATE' | 'BEST_CURRENT' | 'FINAL' | 'OPTIMAL' | 'STOPPED' | 'DECODE_FAILED';
  objectiveValue?: number;
  solver: string;
  sourceSnapshot?: string;
  solutionOutput: string;
  solutionWarnings?: string[];
  rawOutput?: string;
  decodedSolutionJson?: unknown;
  reportJson?: unknown;
  decodeError?: string;
  solveTimeMs?: number;
  createdAt: string;
}

export interface PlanningExecution {
  id: string;
  planningId: string;
  userId: string;
  status: PlanningExecutionStatus;
  solver: string;
  sourceSnapshot?: string;
  startedAt?: string;
  endedAt?: string;
  stoppedAt?: string;
  stopRequestedAt?: string;
  exitCode?: number;
  errorMessage?: string;
  bestSolutionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningExecutionLog {
  id: string;
  executionId: string;
  sequence: number;
  level: 'info' | 'stdout' | 'stderr' | 'warning' | 'error' | 'solution';
  stream?: string;
  message: string;
  executionStatus?: PlanningExecutionStatus;
  createdAt: string;
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
  solveTimeMs: number;
  executionId?: string;
  status?: PlanningExecutionStatus;
}
