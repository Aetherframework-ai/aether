import React from 'react';

interface WorkflowInfo {
  workflowId: string;
  workflowType: string;
  state: string;
  startedAt: string;
  completedAt?: string;
}

interface Props {
  workflows: WorkflowInfo[];
  onSelect: (id: string) => void;
  selectedWorkflow: string | null;
}

const WorkflowList: React.FC<Props> = ({ workflows, onSelect, selectedWorkflow }) => {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-2">
      {workflows.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          No workflows found
        </div>
      ) : (
        workflows.map((workflow) => (
          <button
            key={workflow.workflowId}
            type="button"
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedWorkflow === workflow.workflowId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onSelect(workflow.workflowId)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-sm">{workflow.workflowType}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(workflow.startedAt)}
                </p>
                {workflow.completedAt && (
                  <p className="text-xs text-gray-400">
                    Completed: {formatDate(workflow.completedAt)}
                  </p>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(workflow.state)}`}>
                {workflow.state}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  );
};

export default WorkflowList;
