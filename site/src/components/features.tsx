import {
	AccessibilityIcon,
	BlocksIcon,
	Component,
	FileTextIcon,
	GaugeIcon,
	GitBranchIcon,
	Palette,
	RocketIcon,
	SearchIcon,
	TestTube,
} from "@/components/icons";
import type { ReactNode } from "react";

interface Skill {
	name: string;
	description: string;
	icon: ReactNode;
}

const skills: Skill[] = [
	{
		name: "typescript-expert",
		description:
			"Strict TypeScript configuration, type patterns, and modern ES2022+ features",
		icon: <FileTextIcon size={40} className="text-[var(--accent)]" />,
	},
	{
		name: "nextjs-app-router",
		description:
			"Server Components, Server Actions, data fetching, and App Router patterns",
		icon: <BlocksIcon size={40} className="text-[var(--accent)]" />,
	},
	{
		name: "shadcn-ui",
		description:
			"Component library usage, theming, forms, and accessibility patterns",
		icon: <Palette className="h-10 w-10 text-[var(--accent)]" />,
	},
	{
		name: "web-performance",
		description:
			"Core Web Vitals optimization, bundle size, caching strategies",
		icon: <GaugeIcon size={40} className="text-[var(--accent)]" />,
	},
	{
		name: "github-workflow",
		description: "PR management, commit conventions, GitHub CLI automation",
		icon: <GitBranchIcon size={40} className="text-[var(--accent)]" />,
	},
	{
		name: "accessibility",
		description: "ARIA patterns, semantic HTML, keyboard navigation, WCAG",
		icon: <AccessibilityIcon size={40} className="text-[var(--accent)]" />,
	},
];

interface Workflow {
	name: string;
	description: string;
	icon: ReactNode;
}

const workflows: Workflow[] = [
	{
		name: "pr-review",
		description: "Comprehensive PR review process",
		icon: <SearchIcon size={24} className="text-[var(--accent)]" />,
	},
	{
		name: "component-create",
		description: "Create components with tests",
		icon: <Component className="h-6 w-6 text-[var(--accent)]" />,
	},
	{
		name: "test-coverage",
		description: "Analyze and improve coverage",
		icon: <TestTube className="h-6 w-6 text-[var(--accent)]" />,
	},
	{
		name: "deploy-preview",
		description: "Setup preview deployments",
		icon: <RocketIcon size={24} className="text-[var(--accent)]" />,
	},
];

export const Features = () => {
	return (
		<section id="features" className="py-20">
			<div className="mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<h2 className="mb-4 text-3xl font-bold md:text-4xl">
						Global Skills for Web Development
					</h2>
					<p className="mx-auto max-w-2xl text-[var(--muted)]">
						Pre-built expertise that your AI assistant can use to help you write
						better code faster. Each skill is carefully crafted with best
						practices and real-world patterns.
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{skills.map((skill) => (
						<div
							key={skill.name}
							className="card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
						>
							<div className="mb-4">{skill.icon}</div>
							<h3 className="mb-2 text-lg font-semibold text-[var(--accent)]">
								{skill.name}
							</h3>
							<p className="text-sm text-[var(--muted)]">{skill.description}</p>
						</div>
					))}
				</div>

				{/* Workflows */}
				<div className="mt-16">
					<h3 className="mb-6 text-center text-2xl font-bold">
						Reusable Workflows
					</h3>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{workflows.map((workflow) => (
							<div
								key={workflow.name}
								className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4 text-center"
							>
								<div className="mx-auto mb-2 flex justify-center">
									{workflow.icon}
								</div>
								<div className="text-sm font-semibold text-[var(--foreground)]">
									/workflow {workflow.name}
								</div>
								<div className="mt-1 text-xs text-[var(--muted)]">
									{workflow.description}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
