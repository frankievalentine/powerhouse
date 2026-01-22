import { GithubIcon, ZapIcon } from "@/components/icons";
import Link from "next/link";

export const Header = () => {
	return (
		<header className="fixed top-4 left-4 right-4 z-50 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
			<div className="mx-auto max-w-6xl px-6 py-3">
				<nav
					className="flex items-center justify-between"
					aria-label="Main navigation"
				>
					<Link
						href="/"
						className="flex items-center gap-2 transition-opacity hover:opacity-70"
						aria-label="Powerhouse home"
					>
						<ZapIcon size={24} className="text-[var(--foreground)]" />
						<span className="text-xl font-bold font-mono">Powerhouse</span>
					</Link>

					<div className="flex items-center gap-6">
						<Link
							href="#features"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
							tabIndex={0}
						>
							Features
						</Link>
						<Link
							href="#agents"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
							tabIndex={0}
						>
							Agents
						</Link>
						<Link
							href="#install"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
							tabIndex={0}
						>
							Install
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80 cursor-pointer"
							aria-label="View Powerhouse on GitHub"
							tabIndex={0}
						>
							<GithubIcon size={16} />
							GitHub
						</Link>
					</div>
				</nav>
			</div>
		</header>
	);
};
