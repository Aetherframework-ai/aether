import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkflowGraph } from './components/workflow/WorkflowGraph';
import { Activity, Server, Settings } from 'lucide-react';

const queryClient = new QueryClient();

interface WorkflowInfo {
  workflowId: string;
  workflowType: string;
  currentStep: string | null;
}

function Dashboard() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);

  // 模拟获取 workflow 列表
  useEffect(() => {
    // TODO: 实现真实的 API 调用
    const mockWorkflows: WorkflowInfo[] = [
      { workflowId: 'wf-1', workflowType: 'order-processing', currentStep: 'process-payment' },
      { workflowId: 'wf-2', workflowType: 'user-registration', currentStep: null },
    ];
    setWorkflows(mockWorkflows);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Aether Dashboard
          </h1>
        </div>

        <nav className="flex-1 p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Active Workflows</h2>
          <ul className="space-y-2">
            {workflows.map((workflow) => (
              <li key={workflow.workflowId}>
                <button
                  onClick={() => setSelectedWorkflowId(workflow.workflowId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedWorkflowId === workflow.workflowId
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{workflow.workflowType}</div>
                  <div className="text-xs text-gray-500">
                    {workflow.currentStep || 'Waiting'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Server className="w-4 h-4" />
            <span>Server: localhost:7233</span>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedWorkflowId ? `Workflow: ${selectedWorkflowId}` : 'Select a workflow'}
            </h2>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-6">
          {selectedWorkflowId ? (
            <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ReactFlowProvider>
                <WorkflowGraph workflowId={selectedWorkflowId} />
              </ReactFlowProvider>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a workflow from the sidebar to view details</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
