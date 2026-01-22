"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface BrainIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface BrainIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number;
}

const BrainIcon = forwardRef<BrainIconHandle, BrainIconProps>(
	({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
		const controls = useAnimation();
		const isControlledRef = useRef(false);

		useImperativeHandle(ref, () => {
			isControlledRef.current = true;

			return {
				startAnimation: () => controls.start("animate"),
				stopAnimation: () => controls.start("normal"),
			};
		});

		const handleMouseEnter = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (isControlledRef.current) {
					onMouseEnter?.(e);
				} else {
					controls.start("animate");
				}
			},
			[controls, onMouseEnter],
		);

		const handleMouseLeave = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (isControlledRef.current) {
					onMouseLeave?.(e);
				} else {
					controls.start("normal");
				}
			},
			[controls, onMouseLeave],
		);

		return (
			<div
				className={cn(className)}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				{...props}
			>
				<motion.svg
					animate={controls}
					initial="normal"
					variants={{
						normal: { scale: 1 },
						animate: {
							scale: [1, 1.05, 0.98, 1.02, 1],
							transition: {
								duration: 0.6,
								ease: "easeInOut",
							},
						},
					}}
					fill="none"
					height={size}
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
					viewBox="0 0 24 24"
					width={size}
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
					<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
					<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
					<path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
					<path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
					<path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
					<path d="M19.938 10.5a4 4 0 0 1 .585.396" />
					<path d="M6 18a4 4 0 0 1-1.967-.516" />
					<path d="M19.967 17.484A4 4 0 0 1 18 18" />
				</motion.svg>
			</div>
		);
	},
);

BrainIcon.displayName = "BrainIcon";

export { BrainIcon };
