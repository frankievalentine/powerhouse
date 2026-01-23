interface Command {
	name: string;
	description: string;
	agents: string[];
}

const commands: Command[] = [
	{
		name: "/review-pr",
		description: "Review current PR with code quality checklist",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/create-component",
		description: "Create React component with TypeScript & tests",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/fix-tests",
		description: "Diagnose and fix failing tests",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/commit",
		description: "Create conventional commit message",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/add-shadcn",
		description: "Add shadcn/ui component to project",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/a11y-audit",
		description: "Audit accessibility issues in code",
		agents: ["Claude", "OpenCode", "Antigravity"],
	},
	{
		name: "/create-issue",
		description: "Create GitHub issue (bug/feature)",
		agents: ["Claude"],
	},
	{
		name: "/optimize-assets",
		description: "Optimize images for performance",
		agents: ["Antigravity"],
	},
];

export const Commands = () => {
	return (
		<section className="relative py-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<h2 className="mb-4 text-3xl font-bold text-pretty md:text-4xl">
						Slash Commands for Every Task
					</h2>
					<p className="mx-auto max-w-2xl text-(--muted)">
						Quick commands for common development tasks. Type a slash command
						and let your AI assistant handle the rest.
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					{commands.map((cmd) => (
						<div
							key={cmd.name}
							className="card-hover rounded-lg border border-(--border) bg-(--card)/80 backdrop-blur-sm p-4"
							tabIndex={0}
							role="article"
							aria-label={`${cmd.name} command`}
						>
							{/* Command name */}
							<div className="mb-3 inline-flex items-center rounded-md bg-(--secondary)/80 px-3 py-1.5">
								<span className="text-sm font-semibold text-foreground font-mono">
									{cmd.name}
								</span>
							</div>
							
							{/* Description */}
							<p className="text-sm text-(--muted) mb-3">
								{cmd.description}
							</p>
							
							{/* Agent tags */}
							<div className="flex flex-wrap gap-1.5">
								{cmd.agents.map((agent) => (
									<span
										key={agent}
										className="rounded-full bg-(--border) px-2.5 py-0.5 text-xs text-(--muted) font-mono"
									>
										{agent}
									</span>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
};
