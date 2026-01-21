import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, XCircle, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  nodeVariants,
  pulseAnimation,
  pulseTransition,
  getTransition,
  springConfig,
} from '@/lib/motion';

export interface StepNodeData {
  stepName: string;
  status: string;
  duration?: string;
}

interface StepNodeProps {
  data: StepNodeData;
}

const statusIcons: Record<string, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Circle,
};

const statusStyles: Record<
  string,
  { border: string; bg: string; icon: string; glow?: string }
> = {
  pending: {
    border: 'border-slate-400/30 dark:border-slate-500/30',
    bg: 'bg-slate-500/5 dark:bg-slate-500/10',
    icon: 'text-slate-400 dark:text-slate-500',
  },
  running: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/5 dark:bg-blue-500/10',
    icon: 'text-blue-500',
    glow: 'shadow-blue-500/20',
  },
  completed: {
    border: 'border-green-500/50',
    bg: 'bg-green-500/5 dark:bg-green-500/10',
    icon: 'text-green-500',
  },
  failed: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/5 dark:bg-red-500/10',
    icon: 'text-red-500',
  },
  cancelled: {
    border: 'border-slate-400/30 dark:border-slate-500/30',
    bg: 'bg-slate-500/5 dark:bg-slate-500/10',
    icon: 'text-slate-400 dark:text-slate-500',
  },
};

export const StepNode = memo(({ data }: StepNodeProps) => {
  const Icon = statusIcons[data.status] || Circle;
  const style = statusStyles[data.status] || statusStyles.pending;
  const isRunning = data.status === 'running';

  return (
    <motion.div
      variants={nodeVariants}
      initial="initial"
      animate="animate"
      className="relative"
    >
      {/* Pulse effect for running state */}
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={pulseAnimation}
          transition={pulseTransition}
        />
      )}

      <motion.div
        className={cn(
          'relative px-4 py-3 rounded-xl border-2 min-w-[160px]',
          'bg-card/80 backdrop-blur-md',
          'shadow-lg',
          style.border,
          style.bg,
          isRunning && style.glow && `shadow-lg ${style.glow}`
        )}
        animate={{
          borderColor: undefined, // Let CSS handle this
          scale: isRunning ? [1, 1.02, 1] : 1,
        }}
        transition={
          isRunning
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : getTransition(springConfig.gentle)
        }
      >
        <Handle
          type="target"
          position={Position.Top}
          className={cn(
            'w-3 h-3 border-2',
            'bg-background border-border',
            'hover:bg-primary hover:border-primary',
            'transition-colors duration-200'
          )}
        />

        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg',
              style.bg
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5',
                style.icon,
                isRunning && 'animate-spin'
              )}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm text-foreground truncate">
              {data.stepName}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {data.status}
            </span>
          </div>
        </div>

        {data.duration && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono">
              {data.duration}
            </span>
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className={cn(
            'w-3 h-3 border-2',
            'bg-background border-border',
            'hover:bg-primary hover:border-primary',
            'transition-colors duration-200'
          )}
        />
      </motion.div>
    </motion.div>
  );
});

StepNode.displayName = 'StepNode';
