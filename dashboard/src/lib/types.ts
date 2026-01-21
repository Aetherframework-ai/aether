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

// API 响应类型
export interface WorkflowListResponse {
  workflows: WorkflowInfoDto[];
}

export interface WorkflowDetailResponse {
  workflowId: string;
  workflowType: string;
  currentStep: string | null;
  stepExecutions: StepExecutionInfo[];
  startedAt: number;
  completedAt: number | null;
}

export interface WorkflowInfoDto {
  workflowId: string;
  workflowType: string;
  currentStep: string | null;
  startedAt: number;
}

// Dashboard API 请求
export type ApiRequest =
  | { type: 'list_active_workflows' }
  | { type: 'get_workflow'; workflowId: string }
  | { type: 'get_workflow_history'; workflowId: string };

// Dashboard API 响应
export type ApiResponse =
  | { type: 'workflow_list'; workflows: WorkflowInfoDto[] }
  | { type: 'workflow_detail'; detail: WorkflowDetailResponse }
  | { type: 'workflow_history'; history: StepHistoryDto[] }
  | { type: 'error'; message: string };

export interface StepHistoryDto {
  stepName: string;
  status: StepExecutionStatus;
  timestamp: number;
  durationMs: number | null;
}
