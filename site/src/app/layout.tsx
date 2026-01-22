import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Powerhouse | Agent Skills for AI Coding Assistants",
	description:
		"A comprehensive repository of agent skills, workflows, and configurations for AI coding assistants. Support for Claude, OpenCode, Gemini CLI, Codex, and more.",
	keywords: [
		"AI",
		"coding assistant",
		"Claude",
		"Gemini",
		"OpenCode",
		"Codex",
		"skills",
		"workflows",
		"web development",
	],
	authors: [{ name: "Powerhouse Contributors" }],
	openGraph: {
		title: "Powerhouse | Agent Skills for AI Coding Assistants",
		description:
			"Skills, workflows, and configurations for Claude, OpenCode, Gemini CLI, Codex, and more.",
		type: "website",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
