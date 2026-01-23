"use client";

import { ArrowRight } from "@/components/icons";
import { Bot, Code2, FileText, Terminal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const TEXTS = [
	"Claude Code",
	"OpenCode",
	"Antigravity",
	"GitHub Copilot",
	"Cursor"
];

const Typewriter = () => {
	const [textIndex, setTextIndex] = useState(0);
	const [charIndex, setCharIndex] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isPaused, setIsPaused] = useState(false);

	const currentText = TEXTS[textIndex];
	const displayedText = currentText.slice(0, charIndex);

	const typeSpeed = isDeleting ? 50 : 100;
	const pauseDuration = 2000;

	const tick = useCallback(() => {
		if (isPaused) return;

		if (!isDeleting) {
			// Typing
			if (charIndex < currentText.length) {
				setCharIndex((prev) => prev + 1);
			} else {
				// Finished typing, pause before deleting
				setIsPaused(true);
				setTimeout(() => {
					setIsPaused(false);
					setIsDeleting(true);
				}, pauseDuration);
			}
		} else {
			// Deleting
			if (charIndex > 0) {
				setCharIndex((prev) => prev - 1);
			} else {
				// Finished deleting, move to next word
				setIsDeleting(false);
				setTextIndex((prev) => (prev + 1) % TEXTS.length);
			}
		}
	}, [charIndex, currentText.length, isDeleting, isPaused]);

	useEffect(() => {
		if (isPaused) return;

		const timer = setTimeout(tick, typeSpeed);
		return () => clearTimeout(timer);
	}, [tick, typeSpeed, isPaused]);

	return (
		<span className="gradient-text">
			{displayedText}
			<span
				className="inline-block w-[3px] h-[0.85em] bg-current ml-1 align-middle animate-blink"
				aria-hidden="true"
			/>
		</span>
	);
};

export const Hero = () => {
	return (
		<section className="relative overflow-hidden pt-36 pb-24">
			<div className="relative mx-auto max-w-6xl px-6">
				<div className="flex flex-col items-center text-center">
					{/* Badge */}
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--secondary)/80 backdrop-blur-sm px-4 py-1.5">
						<Bot size={16} className="text-(--muted)" aria-hidden="true" />
						<span className="text-sm text-(--muted)">
							Now supporting 7 AI assistants
						</span>
					</div>

					{/* Title */}
					<h1 className="mb-6 text-5xl font-bold tracking-tight text-pretty md:text-7xl">
						Expertly curated for
						<br />
						<Typewriter />
					</h1>

					{/* Subtitle */}
					<p className="mb-10 max-w-2xl text-lg text-(--muted) md:text-xl">
						A comprehensive repository of skills, workflows, and configurations
						for Claude, OpenCode, Antigravity, Codex, Copilot, Cursor, and more.
						Focused on modern web development.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col items-center gap-4 sm:flex-row">
						<a
							href="#install"
							className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-lg font-semibold text-background transition-opacity hover:opacity-80 cursor-pointer"
							tabIndex={0}
							aria-label="Get started with Powerhouse"
						>
							Get Started
							<ArrowRight className="h-5 w-5" aria-hidden="true" />
						</a>
						<a
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded-lg border border-(--border) bg-(--background)/50 backdrop-blur-sm px-6 py-3 text-lg font-semibold transition-colors hover:border-(--muted) cursor-pointer"
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
							icon={<Bot size={20} aria-hidden="true" />}
						/>
						<StatItem
							value="6"
							label="Global Skills"
							icon={<FileText size={20} aria-hidden="true" />}
						/>
						<StatItem
							value="20+"
							label="Commands"
							icon={<Terminal size={20} aria-hidden="true" />}
						/>
						<StatItem
							value="4"
							label="Workflows"
							icon={<Code2 className="h-5 w-5" aria-hidden="true" />}
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
		<div className="mb-2 flex justify-center text-(--muted)">{icon}</div>
		<div className="text-3xl font-bold text-foreground tabular-nums md:text-4xl font-mono">
			{value}
		</div>
		<div className="mt-1 text-sm text-(--muted)">{label}</div>
	</div>
);
