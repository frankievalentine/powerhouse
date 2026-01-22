"use client";

import {
	ArrowRight,
	CheckIcon,
	CopyIcon,
	LinkIcon,
	Package,
	ZapIcon,
} from "@/components/icons";
import { useState } from "react";

export const Installation = () => {
	const [copied, setCopied] = useState(false);

	const installCommand = `git clone https://github.com/frankievalentine/powerhouse.git
cd powerhouse
./install.sh`;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(installCommand);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<section id="install" className="bg-[var(--secondary)] py-20">
			<div className="mx-auto max-w-4xl px-6">
				<div className="gradient-border p-8 md:p-12">
					<div className="text-center">
						<h2 className="mb-4 text-3xl font-bold md:text-4xl">
							Get Started in Seconds
						</h2>
						<p className="mb-8 text-[var(--muted)]">
							Clone the repository and run the installer. Skills and commands
							will be automatically configured for all your AI assistants.
						</p>

						{/* Code block */}
						<div className="code-block relative mx-auto max-w-xl overflow-hidden text-left">
							<div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
								<span className="text-xs text-[var(--muted)]">Terminal</span>
								<button
									onClick={handleCopy}
									className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
									aria-label="Copy to clipboard"
								>
									{copied ? (
										<>
											<CheckIcon size={14} />
											Copied!
										</>
									) : (
										<>
											<CopyIcon size={14} />
											Copy
										</>
									)}
								</button>
							</div>
							<pre className="overflow-x-auto p-4 text-sm">
								<code>
									<span className="text-[var(--muted)]">$</span>{" "}
									<span className="text-[var(--accent)]">git clone</span>{" "}
									https://github.com/frankievalentine/powerhouse.git
									{"\n"}
									<span className="text-[var(--muted)]">$</span>{" "}
									<span className="text-[var(--accent)]">cd</span> powerhouse
									{"\n"}
									<span className="text-[var(--muted)]">$</span>{" "}
									<span className="text-[var(--accent)]">./install.sh</span>
								</code>
							</pre>
						</div>

						{/* What happens */}
						<div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left md:grid-cols-3">
							<div className="rounded-lg bg-[var(--background)]/50 p-4">
								<Package className="mb-2 h-6 w-6 text-[var(--accent)]" />
								<div className="text-sm font-medium">Skills Installed</div>
								<div className="mt-1 text-xs text-[var(--muted)]">
									To all agent skill directories
								</div>
							</div>
							<div className="rounded-lg bg-[var(--background)]/50 p-4">
								<ZapIcon size={24} className="mb-2 text-[var(--accent)]" />
								<div className="text-sm font-medium">Commands Ready</div>
								<div className="mt-1 text-xs text-[var(--muted)]">
									Slash commands for each agent
								</div>
							</div>
							<div className="rounded-lg bg-[var(--background)]/50 p-4">
								<LinkIcon className="mb-2 h-6 w-6 text-[var(--accent)]" />
								<div className="text-sm font-medium">Symlinked</div>
								<div className="mt-1 text-xs text-[var(--muted)]">
									Updates sync automatically
								</div>
							</div>
						</div>

						{/* CTA */}
						<div className="mt-10">
							<a
								href="https://github.com/frankievalentine/powerhouse"
								target="_blank"
								rel="noopener noreferrer"
								className="glow inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-8 py-4 text-lg font-semibold text-white transition-transform hover:scale-105"
							>
								View on GitHub
								<ArrowRight className="h-5 w-5" />
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
