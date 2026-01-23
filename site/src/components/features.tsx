"use client";

import {
	AccessibilityIcon,
	BlocksIcon,
	BookIcon,
	ComponentIcon,
	FileCodeIcon,
	FileTextIcon,
	GaugeIcon,
	GitBranchIcon,
	PaletteIcon,
	RocketIcon,
	ScrollTextIcon,
	SearchIcon,
	ShieldIcon,
	TestTubeIcon,
} from "@/components/icons";
import { useRef, type ReactNode } from "react";

type AnimationRef = React.RefObject<{ startAnimation: () => void; stopAnimation: () => void } | null>;

interface Skill {
	name: string;
	description: string;
	icon: ReactNode;
	iconRef?: AnimationRef;
}

interface WorkflowRuleItem {
	name: string;
	description: string;
	icon: ReactNode;
	type: "workflow" | "rule";
	iconRef?: AnimationRef;
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
			className="card-hover rounded-xl border border-(--border) bg-(--card)/80 backdrop-blur-sm p-6"
			tabIndex={0}
			role="article"
			aria-label={`${skill.name} skill`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<div className="mb-4" aria-hidden="true">{skill.icon}</div>
			<h3 className="mb-2 text-lg font-semibold text-foreground font-mono">
				{skill.name}
			</h3>
			<p className="text-sm text-(--muted)">{skill.description}</p>
		</div>
	);
};

const WorkflowRuleCard = ({ item }: { item: WorkflowRuleItem }) => {
	const handleMouseEnter = () => {
		item.iconRef?.current?.startAnimation();
	};

	const handleMouseLeave = () => {
		item.iconRef?.current?.stopAnimation();
	};

	return (
		<div
			className="rounded-lg border border-(--border) bg-(--secondary)/80 backdrop-blur-sm p-4 text-center transition-colors hover:border-(--muted) cursor-pointer"
			tabIndex={0}
			role="article"
			aria-label={`${item.name} ${item.type}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<div className="mx-auto mb-2 flex justify-center" aria-hidden="true">
				{item.icon}
			</div>
			<div className="text-sm font-semibold text-foreground font-mono">
				{item.type === "workflow" ? `/workflow ${item.name}` : item.name}
			</div>
			<div className="mt-1 text-xs text-(--muted)">
				{item.description}
			</div>
		</div>
	);
};

export const Features = () => {
	// Skills refs
	const typescriptRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const nextjsRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const shadcnRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const perfRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const githubRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const a11yRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

	// Workflows & Rules refs
	const prReviewRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const componentRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const testCoverageRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const deployRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const codeStyleRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const projectStructureRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const securityRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const docsRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

	const skills: Skill[] = [
		{
			name: "typescript-expert",
			description:
				"Strict TypeScript configuration, type patterns, and modern ES2022+ features",
			icon: <FileTextIcon ref={typescriptRef} size={40} className="text-(--muted)" />,
			iconRef: typescriptRef,
		},
		{
			name: "nextjs-app-router",
			description:
				"Server Components, Server Actions, data fetching, and App Router patterns",
			icon: <BlocksIcon ref={nextjsRef} size={40} className="text-(--muted)" />,
			iconRef: nextjsRef,
		},
		{
			name: "shadcn-ui",
			description:
				"Component library usage, theming, forms, and accessibility patterns",
			icon: <PaletteIcon ref={shadcnRef} size={40} className="text-(--muted)" />,
			iconRef: shadcnRef,
		},
		{
			name: "web-performance",
			description:
				"Core Web Vitals optimization, bundle size, caching strategies",
			icon: <GaugeIcon ref={perfRef} size={40} className="text-(--muted)" />,
			iconRef: perfRef,
		},
		{
			name: "github-workflow",
			description: "PR management, commit conventions, GitHub CLI automation",
			icon: <GitBranchIcon ref={githubRef} size={40} className="text-(--muted)" />,
			iconRef: githubRef,
		},
		{
			name: "accessibility",
			description: "ARIA patterns, semantic HTML, keyboard navigation, WCAG",
			icon: <AccessibilityIcon ref={a11yRef} size={40} className="text-(--muted)" />,
			iconRef: a11yRef,
		},
	];

	const workflowsAndRules: WorkflowRuleItem[] = [
		// Workflows
		{
			name: "pr-review",
			description: "Comprehensive PR review process",
			icon: <SearchIcon ref={prReviewRef} size={24} className="text-(--muted)" />,
			type: "workflow",
			iconRef: prReviewRef,
		},
		{
			name: "component-create",
			description: "Create components with tests",
			icon: <ComponentIcon ref={componentRef} size={24} className="text-(--muted)" />,
			type: "workflow",
			iconRef: componentRef,
		},
		{
			name: "test-coverage",
			description: "Analyze and improve coverage",
			icon: <TestTubeIcon ref={testCoverageRef} size={24} className="text-(--muted)" />,
			type: "workflow",
			iconRef: testCoverageRef,
		},
		{
			name: "deploy-preview",
			description: "Setup preview deployments",
			icon: <RocketIcon ref={deployRef} size={24} className="text-(--muted)" />,
			type: "workflow",
			iconRef: deployRef,
		},
		// Rules
		{
			name: "code-style",
			description: "ESLint, Prettier, and coding conventions",
			icon: <FileCodeIcon ref={codeStyleRef} size={24} className="text-(--muted)" />,
			type: "rule",
			iconRef: codeStyleRef,
		},
		{
			name: "project-structure",
			description: "Directory organization and file naming",
			icon: <BookIcon ref={projectStructureRef} size={24} className="text-(--muted)" />,
			type: "rule",
			iconRef: projectStructureRef,
		},
		{
			name: "security-best-practices",
			description: "Input validation, auth, and data protection",
			icon: <ShieldIcon ref={securityRef} size={24} className="text-(--muted)" />,
			type: "rule",
			iconRef: securityRef,
		},
		{
			name: "documentation-standards",
			description: "JSDoc, README templates, and API docs",
			icon: <ScrollTextIcon ref={docsRef} size={24} className="text-(--muted)" />,
			type: "rule",
			iconRef: docsRef,
		},
	];

	return (
		<section id="features" className="relative py-24 scroll-mt-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="mb-12 text-center">
					<h2 className="mb-4 text-3xl font-bold text-pretty md:text-4xl">
						Global Skills for Web Development
					</h2>
					<p className="mx-auto max-w-2xl text-(--muted)">
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

				{/* Workflows & Rules */}
				<div className="mt-16">
					<h3 className="mb-6 text-center text-2xl font-bold text-pretty">
						Workflows & Rules
					</h3>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{workflowsAndRules.map((item) => (
							<WorkflowRuleCard key={item.name} item={item} />
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
