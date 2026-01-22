import { BookOpen, GithubIcon, Scale, ZapIcon } from "@/components/icons";
import Link from "next/link";

export const Footer = () => {
	return (
		<footer className="border-t border-(--border) py-12">
			<div className="mx-auto max-w-6xl px-6">
				<div className="flex flex-col items-center justify-between gap-6 md:flex-row">
					<Link
						href="/"
						className="flex items-center gap-2 transition-opacity hover:opacity-70"
						aria-label="Powerhouse home"
					>
						<ZapIcon size={24} className="text-foreground" aria-hidden="true" />
						<span className="text-xl font-bold font-mono">Powerhouse</span>
					</Link>

					<div className="flex items-center gap-6">
						<Link
							href="https://github.com/frankievalentine/powerhouse"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-(--muted) transition-colors hover:text-foreground cursor-pointer"
							tabIndex={0}
							aria-label="View on GitHub"
						>
							<GithubIcon size={16} aria-hidden="true" />
							GitHub
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse/blob/main/CONTRIBUTING.md"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-(--muted) transition-colors hover:text-foreground cursor-pointer"
							tabIndex={0}
							aria-label="Contributing guide"
						>
							<BookOpen className="h-4 w-4" aria-hidden="true" />
							Contributing
						</Link>
						<Link
							href="https://github.com/frankievalentine/powerhouse/blob/main/LICENSE"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 text-sm text-(--muted) transition-colors hover:text-foreground cursor-pointer"
							tabIndex={0}
							aria-label="MIT License"
						>
							<Scale className="h-4 w-4" aria-hidden="true" />
							MIT License
						</Link>
					</div>
				</div>

				<div className="mt-8 text-center text-sm text-(--muted)">
					Skills for AI coding assistants focused on modern web development.
				</div>
			</div>
		</footer>
	);
};
