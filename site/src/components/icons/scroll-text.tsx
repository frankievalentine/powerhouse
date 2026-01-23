"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface ScrollTextIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface ScrollTextIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number;
}

const PATH_VARIANTS: Variants = {
	normal: {
		y: 0,
		transition: {
			duration: 0.4,
			ease: "easeInOut",
		},
	},
	animate: {
		y: [0, -3, 0],
		transition: {
			duration: 0.4,
			ease: "easeInOut",
		},
	},
};

const ScrollTextIcon = forwardRef<ScrollTextIconHandle, ScrollTextIconProps>(
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
					fill="none"
					height={size}
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
					viewBox="0 0 24 24"
					width={size}
					xmlns="http://www.w3.org/2000/svg"
					animate={controls}
					variants={PATH_VARIANTS}
				>
					<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
					<path d="M19 17V5a2 2 0 0 0-2-2H4" />
					<path d="M15 8h-5" />
					<path d="M15 12h-5" />
				</motion.svg>
			</div>
		);
	},
);

ScrollTextIcon.displayName = "ScrollTextIcon";

export { ScrollTextIcon };
