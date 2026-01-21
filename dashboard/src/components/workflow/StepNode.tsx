import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CheckCircle2, Circle, XCircle, Loader2, Clock } from 'lucide-react';
import type { StepExecutionStatus } from '@/lib/types';

export interface StepNodeData {
  stepName: string;
  status: StepExecutionStatus;
  duration?: string;
}

const statusIcons = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Circle,
};

const statusColors = {
  pending: 'border-gray-300 bg-white',
  running: 'border-blue-500 bg-blue-50',
  completed: 'border-green-500 bg-green-50',
  failed: 'border-red-500 bg-red-50',
  cancelled: 'border-gray-300 bg-gray-50',
};

export const StepNode = memo(({ data }: NodeProps<StepNodeData>) => {
  const Icon = statusIcons[data.status] || Circle;
  const colorClass = statusColors[data.status] || statusColors.pending;

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm ${colorClass} min-w-[120px] transition-all duration-200`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 ${data.status === 'running' ? 'animate-spin' : ''}`}
        />
        <span className="font-medium text-sm">{data.stepName}</span>
      </div>

      {data.duration && (
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{data.duration}</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

StepNode.displayName = 'StepNode';
