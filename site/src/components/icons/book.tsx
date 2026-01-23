"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface BookIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface BookIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number;
}

const PATH_VARIANTS: Variants = {
	normal: {
		rotateY: 0,
		transition: {
			duration: 0.5,
			ease: "easeInOut",
		},
	},
	animate: {
		rotateY: [0, -20, 0],
		transition: {
			duration: 0.5,
			ease: "easeInOut",
		},
	},
};

const BookIcon = forwardRef<BookIconHandle, BookIconProps>(
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
					style={{ transformOrigin: "left center" }}
				>
					<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
				</motion.svg>
			</div>
		);
	},
);

BookIcon.displayName = "BookIcon";

export { BookIcon };
