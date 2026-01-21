import React, { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StepNode } from './StepNode';
import { useWorkflowEvents } from '@/lib/websocket';
import type { WorkflowDetailResponse, StepExecutionStatus } from '@/lib/types';

const nodeTypes = {
  step: StepNode,
};

interface WorkflowGraphProps {
  workflowId: string;
  initialData?: WorkflowDetailResponse;
}

export function WorkflowGraph({ workflowId, initialData }: WorkflowGraphProps) {
  const { isConnected, lastEvent } = useWorkflowEvents(workflowId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 从初始数据初始化节点和边
  useEffect(() => {
    if (initialData) {
      const initialNodes: Node[] = initialData.stepExecutions.map((step, index) => ({
        id: step.stepName,
        type: 'step',
        position: { x: 250, y: 50 + index * 100 },
        data: {
          stepName: step.stepName,
          status: step.status,
        },
      }));

      const initialEdges: Edge[] = initialData.stepExecutions
        .slice(0, -1)
        .map((step, index) => ({
          id: `${step.stepName}-${initialData.stepExecutions[index + 1].stepName}`,
          source: step.stepName,
          target: initialData.stepExecutions[index + 1].stepName,
          type: 'smoothstep',
          animated: false,
        }));

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialData, setNodes, setEdges]);

  // 处理实时事件更新
  useEffect(() => {
    if (lastEvent) {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id === lastEvent.workflow_id) {
            return {
              ...node,
              data: {
                ...node.data,
                status: mapEventTypeToStatus(lastEvent.event_type),
              },
            };
          }
          return node;
        })
      );
    }
  }, [lastEvent, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (!initialData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
        <MiniMap />

        {/* 连接状态指示 */}
        <Panel position="top-right">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-md">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-500">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function mapEventTypeToStatus(eventType: string): StepExecutionStatus {
  switch (eventType) {
    case 'step:started':
      return 'running';
    case 'step:completed':
      return 'completed';
    case 'step:failed':
      return 'failed';
    case 'workflow:completed':
      return 'completed';
    case 'workflow:failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function addEdge(params: Connection, edges: Edge[]): Edge[] {
  return [...edges, { ...params, id: `${params.source}-${params.target}` }];
}
