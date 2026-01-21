// Step 执行状态
export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Step 执行信息
export interface StepExecutionInfo {
  stepName: string;
  status: StepExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  attempt: number;
}

// Workflow 执行信息
export interface WorkflowExecutionInfo {
  workflowId: string;
  workflowType: string;
  currentStep: string | null;
  startedAt: number;
  completedAt: number | null;
  stepExecutions: StepExecutionInfo[];
}

// Workflow 事件类型
export type StepEventType =
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'workflow:completed'
  | 'workflow:failed';

// Workflow 事件
export interface WorkflowEvent {
  event_type: StepEventType;
  workflow_id: string;
  workflow_type: string;
  timestamp: number;
  payload: StepStartedPayload | StepCompletedPayload | StepFailedPayload | WorkflowCompletedPayload | WorkflowFailedPayload;
}

export interface StepStartedPayload {
  step_name: string;
  input: unknown;
}

export interface StepCompletedPayload {
  step_name: string;
  output: unknown;
}

export interface StepFailedPayload {
  step_name: string;
  error: string;
  attempt: number;
}

export interface WorkflowCompletedPayload {
  result: unknown;
}

export interface WorkflowFailedPayload {
  error: string;
}

// API 响应类型 (snake_case 匹配后端)
export interface WorkflowListResponse {
  workflows: WorkflowInfoDto[];
}

export interface WorkflowDetailResponse {
  workflow_id: string;
  workflow_type: string;
  current_step: string | null;
  step_executions: StepExecutionDto[];
  started_at: number;
  completed_at: number | null;
}

export interface StepExecutionDto {
  step_name: string;
  status: string;
  started_at: number | null;
  completed_at: number | null;
  attempt: number;
}

export interface WorkflowInfoDto {
  workflow_id: string;
  workflow_type: string;
  current_step: string | null;
  started_at: number;
  completed_at: number | null;
}

// Dashboard API 请求 (Rust enum 格式)
export type ApiRequest =
  | { ListActiveWorkflows: null }
  | { ListAllWorkflows: null }
  | { GetWorkflow: { workflow_id: string } }
  | { GetWorkflowHistory: { workflow_id: string } };

// Dashboard API 响应 (Rust enum 格式)
export type ApiResponse =
  | { WorkflowList: { workflows: WorkflowInfoDto[] } }
  | { WorkflowDetail: { detail: WorkflowDetailResponse } }
  | { WorkflowHistory: { history: StepHistoryDto[] } }
  | { Error: { message: string } };

export interface StepHistoryDto {
  step_name: string;
  status: string;
  timestamp: number;
  duration_ms: number | null;
}
