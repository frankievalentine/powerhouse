"use client";

import {
    AccessibilityIcon,
    BlocksIcon,
    Component,
    FileTextIcon,
    GaugeIcon,
    GitBranchIcon,
    PaletteIcon,
    RocketIcon,
    SearchIcon,
    TestTube,
} from "@/components/icons";
import { useRef, type ReactNode } from "react";

interface Skill {
	name: string;
	description: string;
	icon: ReactNode;
	iconRef?: React.RefObject<{ startAnimation: () => void; stopAnimation: () => void } | null>;
}

const SkillCard = ({ skill }: { skill: Skill }) => {
	const handleMouseEnter = () => {
		skill.iconRef?.current?.startAnimation();
	};

	const handleMouseLeave = () => {
		skill.iconRef?.current?.stopAnimation();
	};

	return (
		<div
			className="card-hover rounded-xl border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-sm p-6"
			tabIndex={0}
			role="article"
			aria-label={`${skill.name} skill`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<div className="mb-4">{skill.icon}</div>
			<h3 className="mb-2 text-lg font-semibold text-[var(--foreground)] font-mono">
				{skill.name}
			</h3>
			<p className="text-sm text-[var(--muted)]">{skill.description}</p>
		</div>
	);
};

export const Features = () => {
	const typescriptRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const nextjsRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const shadcnRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const perfRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const githubRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const a11yRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

	const skills: Skill[] = [
		{
			name: "typescript-expert",
			description:
				"Strict TypeScript configuration, type patterns, and modern ES2022+ features",
			icon: <FileTextIcon ref={typescriptRef} size={40} className="text-[var(--muted)]" />,
			iconRef: typescriptRef,
		},
		{
			name: "nextjs-app-router",
			description:
				"Server Components, Server Actions, data fetching, and App Router patterns",
			icon: <BlocksIcon ref={nextjsRef} size={40} className="text-[var(--muted)]" />,
			iconRef: nextjsRef,
		},
		{
			name: "shadcn-ui",
			description:
				"Component library usage, theming, forms, and accessibility patterns",
			icon: <PaletteIcon ref={shadcnRef} size={40} className="text-[var(--muted)]" />,
			iconRef: shadcnRef,
		},
		{
			name: "web-performance",
			description:
				"Core Web Vitals optimization, bundle size, caching strategies",
			icon: <GaugeIcon ref={perfRef} size={40} className="text-[var(--muted)]" />,
			iconRef: perfRef,
		},
		{
			name: "github-workflow",
			description: "PR management, commit conventions, GitHub CLI automation",
			icon: <GitBranchIcon ref={githubRef} size={40} className="text-[var(--muted)]" />,
			iconRef: githubRef,
		},
		{
			name: "accessibility",
			description: "ARIA patterns, semantic HTML, keyboard navigation, WCAG",
			icon: <AccessibilityIcon ref={a11yRef} size={40} className="text-[var(--muted)]" />,
			iconRef: a11yRef,
		},
	];

	const workflows = [
		{
			name: "pr-review",
			description: "Comprehensive PR review process",
			icon: <SearchIcon size={24} className="text-[var(--muted)]" />,
		},
		{
			name: "component-create",
			description: "Create components with tests",
			icon: <Component className="h-6 w-6 text-[var(--muted)]" />,
		},
		{
			name: "test-coverage",
			description: "Analyze and improve coverage",
			icon: <TestTube className="h-6 w-6 text-[var(--muted)]" />,
		},
		{
			name: "deploy-preview",
			description: "Setup preview deployments",
			icon: <RocketIcon size={24} className="text-[var(--muted)]" />,
		},
	];

	return (
		<section id="features" className="relative py-24">
			<div className="relative mx-auto max-w-6xl px-6">
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
						<SkillCard key={skill.name} skill={skill} />
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
								className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/80 backdrop-blur-sm p-4 text-center transition-colors hover:border-[var(--muted)] cursor-pointer"
								tabIndex={0}
								role="article"
								aria-label={`${workflow.name} workflow`}
							>
								<div className="mx-auto mb-2 flex justify-center">
									{workflow.icon}
								</div>
								<div className="text-sm font-semibold text-[var(--foreground)] font-mono">
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
