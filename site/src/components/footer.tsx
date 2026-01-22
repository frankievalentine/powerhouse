import { BookOpen, GithubIcon, Scale, ZapIcon } from "@/components/icons";
import Link from "next/link";

export const Footer = () => {
	return (
		<footer className="border-t border-[var(--border)] py-12">
			<div className="mx-auto max-w-6xl px-6">
				<div className="flex flex-col items-center justify-between gap-6 md:flex-row">
					<div className="flex items-center gap-2">
						<ZapIcon size={24} className="text-[var(--accent)]" />
						<span className="text-xl font-bold">Powerhouse</span>
					</div>

					<div className="flex items-center gap-6">
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							<GithubIcon size={16} />
							GitHub
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse/blob/main/CONTRIBUTING.md"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							<BookOpen className="h-4 w-4" />
							Contributing
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse/blob/main/LICENSE"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
						>
							<Scale className="h-4 w-4" />
							MIT License
						</Link>
					</div>
				</div>

				<div className="mt-8 text-center text-sm text-[var(--muted)]">
					Skills for AI coding assistants focused on modern web development.
				</div>
			</div>
		</footer>
	);
};
