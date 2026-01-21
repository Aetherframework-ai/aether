import { motion } from "motion/react";
import { RefreshCw, Settings, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "./ThemeToggle";
import { scaleFadeVariants } from "@/lib/motion";
import { formatDistanceToNow } from "date-fns";

interface HeaderProps {
	workflowId: string | null;
	workflowType?: string;
	startedAt?: number;
	onRefresh?: () => void;
	isRefreshing?: boolean;
}

export function Header({
	workflowId,
	workflowType,
	startedAt,
	onRefresh,
	isRefreshing,
}: HeaderProps) {
	const formattedTime = startedAt
		? formatDistanceToNow(new Date(startedAt), { addSuffix: true })
		: null;

	return (
		<motion.header
			variants={scaleFadeVariants}
			initial="initial"
			animate="animate"
			className="mx-4 mt-4 rounded-2xl bg-card/80 backdrop-blur-xl border border-border shadow-lg"
		>
			<div className="flex items-center justify-between px-6 py-4">
				<div className="flex-1 min-w-0">
					{workflowId ? (
						<div>
							<h2 className="text-lg font-semibold text-foreground truncate">
								{workflowType || "Workflow"}: {workflowId}
							</h2>
							{formattedTime && (
								<div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
									<Clock className="h-3.5 w-3.5" />
									<span>Started {formattedTime}</span>
								</div>
							)}
						</div>
					) : (
						<h2 className="text-lg font-semibold text-muted-foreground">
							Select a workflow
						</h2>
					)}
				</div>

				<div className="flex items-center gap-2">
					<TooltipProvider>
						{onRefresh && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={onRefresh}
										disabled={isRefreshing}
										className="h-9 w-9 cursor-pointer"
									>
										<RefreshCw
											className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
										/>
										<span className="sr-only">Refresh</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Refresh workflows</p>
								</TooltipContent>
							</Tooltip>
						)}

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-9 w-9 cursor-pointer"
								>
									<Settings className="h-5 w-5" />
									<span className="sr-only">Settings</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Settings</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<ThemeToggle />
				</div>
			</div>
		</motion.header>
	);
}
