"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface ComponentIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface ComponentIconProps extends HTMLAttributes<HTMLDivElement> {
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
		rotate: [0, 90, 90, 0],
		transition: {
			duration: 0.6,
			ease: "easeInOut",
		},
	},
};

const ComponentIcon = forwardRef<ComponentIconHandle, ComponentIconProps>(
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
					style={{ transformOrigin: "center" }}
				>
					<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z" />
					<path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z" />
					<path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z" />
					<path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z" />
				</motion.svg>
			</div>
		);
	},
);

ComponentIcon.displayName = "ComponentIcon";

export { ComponentIcon };
