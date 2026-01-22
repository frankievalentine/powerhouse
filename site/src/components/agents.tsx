import {
	BotIcon,
	Brain,
	FileEdit,
	GithubIcon,
	RefreshCw,
	SparklesIcon,
	ZapIcon,
} from "@/components/icons";
import type { ReactNode } from "react";

interface Agent {
	name: string;
	status: string;
	config: string;
	context: string;
	icon: ReactNode;
}

const agents: Agent[] = [
	{
		name: "Claude Code",
		status: "Native",
		config: ".claude/",
		context: "CLAUDE.md",
		icon: <BotIcon size={24} className="text-[var(--accent)]" />,
	},
	{
		name: "OpenCode",
		status: "Native",
		config: ".opencode/",
		context: "OPENCODE.md",
		icon: <ZapIcon size={24} className="text-[var(--accent)]" />,
	},
	{
		name: "Gemini CLI",
		status: "Native",
		config: ".gemini/",
		context: "GEMINI.md",
		icon: <SparklesIcon size={24} className="text-[var(--accent)]" />,
	},
	{
		name: "OpenAI Codex",
		status: "Native",
		config: ".codex/",
		context: "AGENTS.md",
		icon: <Brain className="h-6 w-6 text-[var(--accent)]" />,
	},
	{
		name: "Continue.dev",
		status: "Config",
		config: ".continue/",
		context: "config.yaml",
		icon: <RefreshCw className="h-6 w-6 text-[var(--accent)]" />,
	},
	{
		name: "GitHub Copilot",
		status: "Instructions",
		config: ".github/",
		context: "copilot-instructions.md",
		icon: <GithubIcon size={24} className="text-[var(--accent)]" />,
	},
	{
		name: "Cursor",
		status: "Rules",
		config: ".cursor/",
		context: "rules/*.mdc",
		icon: <FileEdit className="h-6 w-6 text-[var(--accent)]" />,
	},
];

export const Agents = () => {
	return (
		<section id="agents" className="bg-[var(--secondary)] py-20">
			<div className="mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<h2 className="mb-4 text-3xl font-bold md:text-4xl">
						One Repository, Many Assistants
					</h2>
					<p className="mx-auto max-w-2xl text-[var(--muted)]">
						Powerhouse provides native skill support for 4 agents and converted
						configurations for 3 more. Use the same skills across all your
						favorite AI coding assistants.
					</p>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-[var(--border)] text-left">
								<th className="pb-4 pr-4 font-semibold">Assistant</th>
								<th className="pb-4 pr-4 font-semibold">Format</th>
								<th className="pb-4 pr-4 font-semibold">Config Directory</th>
								<th className="pb-4 font-semibold">Context File</th>
							</tr>
						</thead>
						<tbody>
							{agents.map((agent) => (
								<tr
									key={agent.name}
									className="border-b border-[var(--border)]"
								>
									<td className="py-4 pr-4">
										<div className="flex items-center gap-3">
											{agent.icon}
											<span className="font-medium">{agent.name}</span>
										</div>
									</td>
									<td className="py-4 pr-4">
										<span
											className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
												agent.status === "Native"
													? "bg-green-500/20 text-green-400"
													: "bg-blue-500/20 text-blue-400"
											}`}
										>
											{agent.status}
										</span>
									</td>
									<td className="py-4 pr-4 text-sm text-[var(--muted)]">
										{agent.config}
									</td>
									<td className="py-4 text-sm text-[var(--muted)]">
										{agent.context}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
};
