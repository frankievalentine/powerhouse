"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface TestTubeIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface TestTubeIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number;
}

const PATH_VARIANTS: Variants = {
	normal: {
		rotate: 0,
		transition: {
			duration: 0.4,
			ease: "easeInOut",
		},
	},
	animate: {
		rotate: [0, -15, 15, -10, 10, 0],
		transition: {
			duration: 0.6,
			ease: "easeInOut",
		},
	},
};

const TestTubeIcon = forwardRef<TestTubeIconHandle, TestTubeIconProps>(
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
					style={{ transformOrigin: "bottom center" }}
				>
					<path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2" />
					<path d="M8.5 2h7" />
					<path d="M14.5 16h-5" />
				</motion.svg>
			</div>
		);
	},
);

TestTubeIcon.displayName = "TestTubeIcon";

export { TestTubeIcon };
