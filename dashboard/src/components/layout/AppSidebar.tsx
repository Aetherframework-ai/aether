import { motion, AnimatePresence } from 'motion/react';
import { Activity, Server, RefreshCw } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowInfoDto } from '@/lib/types';
import {
  staggerContainerVariants,
  staggerItemVariants,
  cardHoverVariants,
  getTransition,
  springConfig,
} from '@/lib/motion';

interface AppSidebarProps {
  workflows: WorkflowInfoDto[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isConnected: boolean;
}

export function AppSidebar({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onRefresh,
  isLoading,
  isConnected,
}: AppSidebarProps) {
  return (
    <Sidebar
      collapsible="none"
      className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border-r border-black/10 dark:border-white/10"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Aether</h1>
            <p className="text-xs text-muted-foreground">Workflow Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-2">
            <SidebarGroupLabel className="px-0 text-xs uppercase tracking-wider">
              Active Workflows
            </SidebarGroupLabel>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="h-7 w-7 cursor-pointer"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', isLoading && 'animate-spin')}
                    />
                    <span className="sr-only">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh workflows</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && workflows.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                </div>
              ) : workflows.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground opacity-50" />
                    <span className="text-sm text-muted-foreground">No active workflows</span>
                  </div>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainerVariants}
                  initial="initial"
                  animate="animate"
                >
                  <AnimatePresence mode="popLayout">
                    {workflows.map((workflow) => (
                      <motion.div
                        key={workflow.workflow_id}
                        variants={staggerItemVariants}
                        layout
                      >
                        <SidebarMenuItem>
                          <motion.div
                            variants={cardHoverVariants}
                            initial="initial"
                            whileHover="hover"
                            whileTap="tap"
                            transition={getTransition(springConfig.snappy)}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SidebarMenuButton
                                    isActive={selectedWorkflowId === workflow.workflow_id}
                                    onClick={() => onSelectWorkflow(workflow.workflow_id)}
                                    className="cursor-pointer h-auto py-3 px-3"
                                  >
                                    <div className="flex flex-col gap-1 min-w-0">
                                      <span className="font-medium truncate">
                                        {workflow.workflow_type}
                                      </span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {workflow.current_step || 'Waiting'}
                                      </span>
                                    </div>
                                  </SidebarMenuButton>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[300px]">
                                  <p className="font-mono text-xs break-all">
                                    {workflow.workflow_id}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </motion.div>
                        </SidebarMenuItem>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span className="font-mono text-xs">localhost:7233</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <motion.span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )}
            animate={
              isConnected
                ? {
                    boxShadow: [
                      '0 0 0 0 rgba(34, 197, 94, 0)',
                      '0 0 0 4px rgba(34, 197, 94, 0.3)',
                      '0 0 0 0 rgba(34, 197, 94, 0)',
                    ],
                  }
                : {}
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <span className="text-muted-foreground text-xs">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
