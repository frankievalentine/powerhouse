"use client";

import { GithubIcon, ZapIcon } from "@/components/icons";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export const Header = () => {
	const [isScrolled, setIsScrolled] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleMobileMenuToggle = () => {
		setIsMobileMenuOpen(!isMobileMenuOpen);
	};

	const handleCloseMobileMenu = () => {
		setIsMobileMenuOpen(false);
	};

	const navLinks = [
		{ href: "#features", label: "Features" },
		{ href: "#agents", label: "Agents" },
		{ href: "#install", label: "Install" },
	];

	return (
		<header
			className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl rounded-2xl border border-(--border) backdrop-blur-md transition-all duration-300 ${
				isScrolled
					? "bg-(--background)/60 shadow-lg shadow-black/10"
					: "bg-(--background)/80"
			}`}
		>
			<div className="px-4 py-3 md:px-6">
				<nav
					className="flex items-center justify-between"
					aria-label="Main navigation"
				>
					{/* Logo */}
					<Link
						href="/"
						className="flex items-center gap-2 transition-opacity hover:opacity-70"
						aria-label="Powerhouse home"
					>
						<ZapIcon size={24} className="text-foreground" aria-hidden="true" />
						<span className="text-lg font-bold font-mono md:text-xl">Powerhouse</span>
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden items-center gap-6 md:flex">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="text-sm text-(--muted) transition-colors hover:text-foreground"
								tabIndex={0}
							>
								{link.label}
							</Link>
						))}
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 cursor-pointer"
							aria-label="View Powerhouse on GitHub"
							tabIndex={0}
						>
							<GithubIcon size={16} aria-hidden="true" />
							GitHub
						</Link>
					</div>

					{/* Mobile Menu Button */}
					<button
						type="button"
						onClick={handleMobileMenuToggle}
						className="flex items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-(--border) md:hidden"
						aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={isMobileMenuOpen}
					>
						{isMobileMenuOpen ? (
							<X size={24} aria-hidden="true" />
						) : (
							<Menu size={24} aria-hidden="true" />
						)}
					</button>
				</nav>

				{/* Mobile Navigation */}
				{isMobileMenuOpen && (
					<div className="mt-4 flex flex-col gap-3 border-t border-(--border) pt-4 md:hidden">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={handleCloseMobileMenu}
								className="rounded-lg px-3 py-2 text-sm text-(--muted) transition-colors hover:bg-(--border) hover:text-foreground"
								tabIndex={0}
							>
								{link.label}
							</Link>
						))}
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							onClick={handleCloseMobileMenu}
							className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 cursor-pointer"
							aria-label="View Powerhouse on GitHub"
							tabIndex={0}
						>
							<GithubIcon size={16} aria-hidden="true" />
							GitHub
						</Link>
					</div>
				)}
			</div>
		</header>
	);
};
