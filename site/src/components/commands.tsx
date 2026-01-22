import {
    AccessibilityIcon,
    CirclePlus,
    Component,
    GitCommitIcon,
    Image,
    PaletteIcon,
    SearchIcon,
    TerminalIcon,
    TestTube,
} from "@/components/icons";
import type { ReactNode } from "react";

interface Command {
	name: string;
	description: string;
	agents: string[];
	icon: ReactNode;
}

const commands: Command[] = [
	{
		name: "/review-pr",
		description: "Review current PR with code quality checklist",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <SearchIcon size={16} className="text-(--muted)" />,
	},
	{
		name: "/create-component",
		description: "Create React component with TypeScript & tests",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <Component className="h-4 w-4 text-(--muted)" />,
	},
	{
		name: "/fix-tests",
		description: "Diagnose and fix failing tests",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <TestTube className="h-4 w-4 text-(--muted)" />,
	},
	{
		name: "/commit",
		description: "Create conventional commit message",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <GitCommitIcon size={16} className="text-(--muted)" />,
	},
	{
		name: "/add-shadcn",
		description: "Add shadcn/ui component to project",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <PaletteIcon size={16} className="text-(--muted)" />,
	},
	{
		name: "/a11y-audit",
		description: "Audit accessibility issues in code",
		agents: ["Claude", "OpenCode", "Gemini"],
		icon: <AccessibilityIcon size={16} className="text-(--muted)" />,
	},
	{
		name: "/create-issue",
		description: "Create GitHub issue (bug/feature)",
		agents: ["Claude"],
		icon: <CirclePlus className="h-4 w-4 text-(--muted)" />,
	},
	{
		name: "/optimize-assets",
		description: "Optimize images for performance",
		agents: ["Gemini"],
		icon: <Image className="h-4 w-4 text-(--muted)" aria-hidden="true" />,
	},
];

export const Commands = () => {
	return (
		<section className="relative py-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<TerminalIcon
						size={40}
						className="mx-auto mb-4 text-(--muted)"
						aria-hidden="true"
					/>
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
							className="card-hover flex items-start gap-4 rounded-lg border border-(--border) bg-(--card)/80 backdrop-blur-sm p-4"
							tabIndex={0}
							role="article"
							aria-label={`${cmd.name} command`}
						>
							<div className="flex shrink-0 items-center gap-3 rounded-md bg-(--secondary)/80 px-3 py-2">
								<span aria-hidden="true">{cmd.icon}</span>
								<span className="text-sm font-semibold text-foreground font-mono">
									{cmd.name}
								</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm text-foreground">
									{cmd.description}
								</p>
								<div className="mt-2 flex flex-wrap gap-1">
									{cmd.agents.map((agent) => (
										<span
											key={agent}
											className="rounded-full bg-(--secondary)/80 px-2 py-0.5 text-xs text-(--muted) font-mono"
										>
											{agent}
										</span>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
};
