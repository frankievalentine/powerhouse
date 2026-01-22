"use client";

import {
	ArrowRight,
	CheckIcon,
	CopyIcon,
	LinkIcon,
	PackageIcon,
	ZapIcon,
} from "@/components/icons";
import { useRef, useState } from "react";

export const Installation = () => {
	const [copied, setCopied] = useState(false);
	const packageRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const zapRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
	const linkRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

	const installCommand = `git clone https://github.com/frankievalentine/powerhouse.git
cd powerhouse
./install.sh`;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(installCommand);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<section id="install" className="relative py-24 scroll-mt-24">
			<div className="relative mx-auto max-w-4xl px-6">
				<div className="rounded-2xl border border-(--border) bg-(--card)/80 backdrop-blur-sm p-8 md:p-12">
					<div className="text-center">
						<h2 className="mb-4 text-3xl font-bold text-pretty md:text-4xl">
							Get Started in Seconds
						</h2>
						<p className="mb-8 text-(--muted)">
							Clone the repository and run the installer. Skills and commands
							will be automatically configured for all your AI assistants.
						</p>

						{/* Code block */}
						<div className="code-block relative mx-auto max-w-xl overflow-hidden text-left">
							<div className="flex items-center justify-between border-b border-(--border) px-4 py-2">
								<span className="text-xs text-(--muted) font-mono">Terminal</span>
								<button
									type="button"
									onClick={handleCopy}
									className="flex items-center gap-1 rounded px-2 py-1 text-xs text-(--muted) transition-colors hover:bg-(--border) hover:text-foreground cursor-pointer"
									aria-label="Copy to clipboard"
									tabIndex={0}
								>
									{copied ? (
										<>
											<CheckIcon size={14} aria-hidden="true" />
											Copied!
										</>
									) : (
										<>
											<CopyIcon size={14} aria-hidden="true" />
											Copy
										</>
									)}
								</button>
							</div>
							<pre className="overflow-x-auto p-4 text-sm font-mono">
								<code>
									<span className="text-(--muted)">$</span>{" "}
									<span className="text-foreground">git clone</span>{" "}
									https://github.com/frankievalentine/powerhouse.git
									{"\n"}
									<span className="text-(--muted)">$</span>{" "}
									<span className="text-foreground">cd</span> powerhouse
									{"\n"}
									<span className="text-(--muted)">$</span>{" "}
									<span className="text-foreground">./install.sh</span>
								</code>
							</pre>
						</div>

						{/* What happens */}
						<div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left md:grid-cols-3">
							<div
								className="rounded-lg border border-(--border) bg-(--secondary)/80 backdrop-blur-sm p-4 cursor-pointer"
								onMouseEnter={() => packageRef.current?.startAnimation()}
								onMouseLeave={() => packageRef.current?.stopAnimation()}
							>
								<PackageIcon ref={packageRef} size={24} className="mb-2 text-(--muted)" aria-hidden="true" />
								<div className="text-sm font-medium font-mono">Skills Installed</div>
								<div className="mt-1 text-xs text-(--muted)">
									To all agent skill directories
								</div>
							</div>
							<div
								className="rounded-lg border border-(--border) bg-(--secondary)/80 backdrop-blur-sm p-4 cursor-pointer"
								onMouseEnter={() => zapRef.current?.startAnimation()}
								onMouseLeave={() => zapRef.current?.stopAnimation()}
							>
								<ZapIcon ref={zapRef} size={24} className="mb-2 text-(--muted)" aria-hidden="true" />
								<div className="text-sm font-medium font-mono">Commands Ready</div>
								<div className="mt-1 text-xs text-(--muted)">
									Slash commands for each agent
								</div>
							</div>
							<div
								className="rounded-lg border border-(--border) bg-(--secondary)/80 backdrop-blur-sm p-4 cursor-pointer"
								onMouseEnter={() => linkRef.current?.startAnimation()}
								onMouseLeave={() => linkRef.current?.stopAnimation()}
							>
								<LinkIcon ref={linkRef} size={24} className="mb-2 text-(--muted)" aria-hidden="true" />
								<div className="text-sm font-medium font-mono">Symlinked</div>
								<div className="mt-1 text-xs text-(--muted)">
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
								className="inline-flex items-center gap-2 rounded-lg bg-foreground px-8 py-4 text-lg font-semibold text-background transition-opacity hover:opacity-80 cursor-pointer"
								tabIndex={0}
								aria-label="View Powerhouse on GitHub"
							>
								View on GitHub
								<ArrowRight className="h-5 w-5" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
