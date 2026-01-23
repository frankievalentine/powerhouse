"use client";

import {
	BotIcon,
	BrainIcon,
	FileEditIcon,
	GithubIcon,
	RefreshCwIcon,
	SparklesIcon,
	ZapIcon,
} from "@/components/icons";
import { useRef, type ReactNode } from "react";

interface Agent {
	name: string;
	status: string;
	config: string;
	context: string;
	icon: ReactNode;
	iconRef?: React.RefObject<{ startAnimation: () => void; stopAnimation: () => void } | null>;
}

export const Agents = () => {
	const claudeRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const opencodeRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const geminiRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const codexRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const continueRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const copilotRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const cursorRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

	const agents: Agent[] = [
		{
			name: "Claude Code",
			status: "Native",
			config: ".claude/",
			context: "skills/*.md",
			icon: <BotIcon ref={claudeRef} size={24} className="text-(--muted)" />,
			iconRef: claudeRef,
		},
		{
			name: "OpenCode",
			status: "Native",
			config: ".opencode/",
			context: "skills/*.md",
			icon: <ZapIcon ref={opencodeRef} size={24} className="text-(--muted)" />,
			iconRef: opencodeRef,
		},
		{
			name: "Antigravity",
			status: "Native",
			config: ".gemini/antigravity/",
			context: "skills/*.md",
			icon: <SparklesIcon ref={geminiRef} size={24} className="text-(--muted)" />,
			iconRef: geminiRef,
		},
		{
			name: "OpenAI Codex",
			status: "Native",
			config: ".codex/",
			context: "skills/*.md",
			icon: <BrainIcon ref={codexRef} size={24} className="text-(--muted)" />,
			iconRef: codexRef,
		},
		{
			name: "Continue.dev",
			status: "Native",
			config: ".continue/",
			context: "prompts/*.md",
			icon: <RefreshCwIcon ref={continueRef} size={24} className="text-(--muted)" />,
			iconRef: continueRef,
		},
		{
			name: "Copilot CLI",
			status: "Native",
			config: ".copilot/",
			context: "skills/*.md",
			icon: <GithubIcon ref={copilotRef} size={24} className="text-(--muted)" />,
			iconRef: copilotRef,
		},
		{
			name: "Cursor",
			status: "Rules",
			config: ".cursor/",
			context: "rules/*.mdc",
			icon: <FileEditIcon ref={cursorRef} size={24} className="text-(--muted)" />,
			iconRef: cursorRef,
		},
	];

	return (
		<section id="agents" className="relative py-24 scroll-mt-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<h2 className="mb-4 text-3xl font-bold text-pretty md:text-4xl">
						One Repository, Many Assistants
					</h2>
					<p className="mx-auto max-w-2xl text-(--muted)">
						Powerhouse provides native skill support for 4 agents and converted
						configurations for 3 more. Use the same skills across all your
						favorite AI coding assistants.
					</p>
				</div>

				<div className="rounded-2xl border border-(--border) bg-(--card)/80 backdrop-blur-sm overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-(--border) text-left">
									<th className="px-6 py-4 font-semibold font-mono text-sm">Assistant</th>
									<th className="px-6 py-4 font-semibold font-mono text-sm">Format</th>
									<th className="px-6 py-4 font-semibold font-mono text-sm">Config Directory</th>
									<th className="px-6 py-4 font-semibold font-mono text-sm">Context File</th>
								</tr>
							</thead>
							<tbody>
								{agents.map((agent) => (
									<tr
										key={agent.name}
										className="border-b border-(--border) last:border-b-0 transition-colors hover:bg-(--foreground)/5"
										onMouseEnter={() => agent.iconRef?.current?.startAnimation()}
										onMouseLeave={() => agent.iconRef?.current?.stopAnimation()}
									>
										<td className="px-6 py-4">
											<div className="flex items-center gap-3">
												<span aria-hidden="true">{agent.icon}</span>
												<span className="font-medium">{agent.name}</span>
											</div>
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-block rounded-full px-3 py-1 text-xs font-medium font-mono ${
													agent.status === "Native"
														? "bg-(--foreground)/10 text-foreground"
														: "bg-(--muted)/20 text-(--muted)"
												}`}
											>
												{agent.status}
											</span>
										</td>
										<td className="px-6 py-4 text-sm text-(--muted) font-mono">
											{agent.config}
										</td>
										<td className="px-6 py-4 text-sm text-(--muted) font-mono">
											{agent.context}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
};
