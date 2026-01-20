import React from 'react';

interface WorkflowDetailProps {
  workflowId: string;
}

const WorkflowDetail: React.FC<WorkflowDetailProps> = ({ workflowId }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Workflow Details</h2>
      <div className="space-y-3">
        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-600">Workflow ID</span>
          <span className="font-mono text-sm">{workflowId}</span>
        </div>
        <div className="text-gray-500 text-center py-8">
          Workflow details will be displayed here
        </div>
      </div>
    </div>
  );
};

export default WorkflowDetail;
