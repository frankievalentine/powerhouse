import { GithubIcon, ZapIcon } from "@/components/icons";
import Link from "next/link";

export const Header = () => {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
			<div className="mx-auto max-w-6xl px-6 py-4">
				<nav className="flex items-center justify-between">
					<Link href="/" className="flex items-center gap-2">
						<ZapIcon size={24} className="text-[var(--accent)]" />
						<span className="text-xl font-bold">Powerhouse</span>
					</Link>

					<div className="flex items-center gap-6">
						<Link
							href="#features"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							Features
						</Link>
						<Link
							href="#agents"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							Agents
						</Link>
						<Link
							href="#install"
							className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							Install
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--border)]"
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
