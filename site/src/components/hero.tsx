import {
    ArrowRight,
    BotIcon,
    FileTextIcon,
    TerminalIcon,
} from "@/components/icons";
import { Code2 } from "lucide-react";

export const Hero = () => {
	return (
		<section className="relative overflow-hidden pt-36 pb-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="flex flex-col items-center text-center">
					{/* Badge */}
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--secondary)]/80 backdrop-blur-sm px-4 py-1.5">
						<BotIcon size={16} className="text-[var(--muted)]" />
						<span className="text-sm text-[var(--muted)]">
							Now supporting 7 AI assistants
						</span>
					</div>

					{/* Title */}
					<h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
						Agent Skills for
						<br />
						<span className="gradient-text">AI Coding Assistants</span>
					</h1>

					{/* Subtitle */}
					<p className="mb-10 max-w-2xl text-lg text-[var(--muted)] md:text-xl">
						A comprehensive repository of skills, workflows, and configurations
						for Claude, OpenCode, Gemini CLI, Codex, Copilot, Cursor, and more.
						Focused on modern web development.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col items-center gap-4 sm:flex-row">
						<a
							href="#install"
							className="inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-6 py-3 text-lg font-semibold text-[var(--background)] transition-opacity hover:opacity-80 cursor-pointer"
							tabIndex={0}
							aria-label="Get started with Powerhouse"
						>
							Get Started
							<ArrowRight className="h-5 w-5" />
						</a>
						<a
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 backdrop-blur-sm px-6 py-3 text-lg font-semibold transition-colors hover:border-[var(--muted)] cursor-pointer"
							tabIndex={0}
							aria-label="View Powerhouse on GitHub"
						>
							View on GitHub
						</a>
					</div>

					{/* Stats */}
					<div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
						<StatItem
							value="7"
							label="AI Assistants"
							icon={<BotIcon size={20} />}
						/>
						<StatItem
							value="6"
							label="Global Skills"
							icon={<FileTextIcon size={20} />}
						/>
						<StatItem
							value="20+"
							label="Commands"
							icon={<TerminalIcon size={20} />}
						/>
						<StatItem
							value="4"
							label="Workflows"
							icon={<Code2 className="h-5 w-5" />}
						/>
					</div>
				</div>
			</div>
		</section>
	);
};

const StatItem = ({
	value,
	label,
	icon,
}: {
	value: string;
	label: string;
	icon: React.ReactNode;
}) => (
	<div className="text-center">
		<div className="mb-2 flex justify-center text-[var(--muted)]">{icon}</div>
		<div className="text-3xl font-bold text-[var(--foreground)] md:text-4xl font-mono">
			{value}
		</div>
		<div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
	</div>
);
