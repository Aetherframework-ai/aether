import { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  Panel,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'motion/react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { StepNode, type StepNodeData } from './StepNode';
import { useWorkflowEvents } from '@/lib/websocket';
import { useTheme } from '@/hooks/useTheme';
import type { WorkflowDetailResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { scaleFadeVariants } from '@/lib/motion';

const nodeTypes = {
  step: StepNode,
} as const;

interface WorkflowGraphProps {
  workflowId: string;
  initialData?: WorkflowDetailResponse;
}

type StepNodeType = Node<StepNodeData, 'step'>;

// Edge styles based on status
const getEdgeStyle = (sourceStatus: string, targetStatus: string, isDark: boolean) => {
  const baseStyle = {
    strokeWidth: 2,
  };

  // If source is completed and target is running or completed
  if (sourceStatus === 'completed') {
    return {
      ...baseStyle,
      stroke: isDark ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.6)',
      animated: false,
    };
  }

  // If source is running
  if (sourceStatus === 'running') {
    return {
      ...baseStyle,
      stroke: isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.8)',
      animated: true,
    };
  }

  // Default pending state
  return {
    ...baseStyle,
    stroke: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.5)',
    animated: false,
  };
};

export function WorkflowGraph({ workflowId, initialData }: WorkflowGraphProps) {
  const { isConnected, lastEvent } = useWorkflowEvents(workflowId);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Initialize nodes and edges from initial data
  useEffect(() => {
    if (initialData) {
      const initialNodes: StepNodeType[] = initialData.step_executions.map((step, index) => ({
        id: step.step_name,
        type: 'step',
        position: { x: 250, y: 50 + index * 120 },
        data: {
          stepName: step.step_name,
          status: step.status,
        },
      }));

      const initialEdges: Edge[] = initialData.step_executions
        .slice(0, -1)
        .map((step, index) => {
          const targetStep = initialData.step_executions[index + 1];
          const style = getEdgeStyle(step.status, targetStep.status, isDark);
          return {
            id: `${step.step_name}-${targetStep.step_name}`,
            source: step.step_name,
            target: targetStep.step_name,
            type: 'smoothstep',
            animated: style.animated,
            style: {
              stroke: style.stroke,
              strokeWidth: style.strokeWidth,
            },
          };
        });

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialData, setNodes, setEdges, isDark]);

  // Handle real-time event updates
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
      <motion.div
        variants={scaleFadeVariants}
        initial="initial"
        animate="animate"
        className="flex items-center justify-center h-full"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-card/80 backdrop-blur-sm border border-border">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </motion.div>
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
        className={cn(
          'transition-colors duration-300',
          isDark ? 'bg-background' : 'bg-slate-50'
        )}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.3)'}
        />
        <Controls
          className={cn(
            'rounded-xl overflow-hidden border',
            'bg-card/80 backdrop-blur-sm border-border',
            '[&>button]:bg-transparent [&>button]:border-border [&>button]:text-foreground',
            '[&>button:hover]:bg-accent [&>button:hover]:text-accent-foreground'
          )}
        />
        <MiniMap
          className={cn(
            'rounded-xl overflow-hidden border',
            'bg-card/60 backdrop-blur-sm border-border'
          )}
          nodeColor={(node) => {
            const status = (node.data as StepNodeData)?.status;
            switch (status) {
              case 'completed':
                return 'rgba(34, 197, 94, 0.8)';
              case 'running':
                return 'rgba(59, 130, 246, 0.8)';
              case 'failed':
                return 'rgba(239, 68, 68, 0.8)';
              default:
                return 'rgba(148, 163, 184, 0.5)';
            }
          }}
          maskColor={isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)'}
        />

        {/* Connection status panel */}
        <Panel position="top-right">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl',
              'bg-card/80 backdrop-blur-sm border border-border shadow-lg'
            )}
          >
            {isConnected ? (
              <>
                <motion.div
                  className="relative"
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Wifi className="w-4 h-4 text-green-500" />
                </motion.div>
                <span className="text-sm text-foreground font-medium">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Disconnected</span>
              </>
            )}
          </motion.div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function mapEventTypeToStatus(eventType: string): string {
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
  return [...edges, { ...params, id: `${params.source}-${params.target}` } as Edge];
}
