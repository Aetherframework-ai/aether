import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import WorkflowList from './components/WorkflowList';
import WorkflowDetail from './components/WorkflowDetail';

interface WorkflowInfo {
  workflowId: string;
  workflowType: string;
  state: string;
  startedAt: string;
  completedAt?: string;
}

function App() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  
  const { data: workflows, refetch } = useQuery<WorkflowInfo[]>(
    'workflows',
    async () => {
      const response = await axios.get('/api/workflows');
      return response.data;
    },
    {
      refetchInterval: 5000,
    }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Aether Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Active Workflows</h2>
              <button
                type="button"
                onClick={() => refetch()}
                className="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Refresh
              </button>
              <WorkflowList
                workflows={workflows || []}
                onSelect={setSelectedWorkflow}
                selectedWorkflow={selectedWorkflow}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              {selectedWorkflow ? (
                <WorkflowDetail workflowId={selectedWorkflow} />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Select a workflow to view details
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
