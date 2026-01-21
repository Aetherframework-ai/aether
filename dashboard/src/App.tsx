import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Settings, Sun, Moon } from 'lucide-react';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { useTheme } from '@/hooks/useTheme';
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { WorkflowGraph } from '@/components/workflow/WorkflowGraph';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { fadeVariants } from '@/lib/motion';
import type { WorkflowInfoDto, WorkflowDetailResponse, ApiResponse } from '@/lib/types';

const queryClient = new QueryClient();

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 cursor-pointer"
          >
            {resolvedTheme === 'dark' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Dashboard() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowInfoDto[]>([]);
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowDetailResponse | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const selectedWorkflow = workflows.find((w) => w.workflow_id === selectedWorkflowId);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('[Dashboard] WebSocket connected');
      setIsConnected(true);
      ws.send(JSON.stringify({ ListActiveWorkflows: null }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ApiResponse;
        console.log('[Dashboard] Received:', data);

        if ('WorkflowList' in data) {
          setWorkflows(data.WorkflowList.workflows);
          setIsLoading(false);
        } else if ('WorkflowDetail' in data) {
          setWorkflowDetail(data.WorkflowDetail.detail as unknown as WorkflowDetailResponse);
        } else if ('Error' in data) {
          console.error('[Dashboard] Error:', data.Error.message);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to parse message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[Dashboard] WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('[Dashboard] WebSocket error:', error);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (selectedWorkflowId && wsRef.current?.readyState === WebSocket.OPEN) {
      setWorkflowDetail(null);
      wsRef.current.send(JSON.stringify({ GetWorkflow: { workflow_id: selectedWorkflowId } }));
    }
  }, [selectedWorkflowId]);

  const refreshWorkflows = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsLoading(true);
      wsRef.current.send(JSON.stringify({ ListActiveWorkflows: null }));
    }
  };

  return (
    <SidebarProvider
      defaultOpen={true}
      className="h-screen"
      style={{
        '--sidebar-width': '16rem',
      } as React.CSSProperties}
    >
      <AppSidebar
        workflows={workflows}
        selectedWorkflowId={selectedWorkflowId}
        onSelectWorkflow={setSelectedWorkflowId}
        onRefresh={refreshWorkflows}
        isLoading={isLoading}
        isConnected={isConnected}
      />
      <SidebarInset className="bg-gradient-to-br from-slate-50 via-slate-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex h-full flex-col overflow-hidden">
          {/* Header */}
          <header className="flex-shrink-0 m-4 mb-0 px-6 py-4 rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedWorkflowId
                    ? `${selectedWorkflow?.workflow_type || 'Workflow'}: ${selectedWorkflowId.slice(0, 8)}...`
                    : 'Select a workflow'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
                        <Settings className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Settings</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 p-4 overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedWorkflowId ? (
                <motion.div
                  key={selectedWorkflowId}
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="h-full rounded-2xl overflow-hidden bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-black/10 dark:border-white/10"
                >
                  <ReactFlowProvider>
                    <WorkflowGraph
                      workflowId={selectedWorkflowId}
                      initialData={workflowDetail ?? undefined}
                    />
                  </ReactFlowProvider>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="h-full flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-black/10 dark:border-white/10">
                      <Activity className="h-10 w-10 text-muted-foreground opacity-50" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground">No workflow selected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select a workflow from the sidebar to view details
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <Dashboard />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
