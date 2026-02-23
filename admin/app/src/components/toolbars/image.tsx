"use client";

import { ImageIcon } from "lucide-react";
import React from "react";

import { useToolbar } from "@/components/toolbars/toolbar-provider";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ImageToolbar = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
	({ className, onClick, children, ...props }, ref) => {
		const { editor } = useToolbar();

		const openMediaLibrary = () => {
			if (typeof window === 'undefined' || !window.wp || !window.wp.media) {
				console.error('WordPress media library is not available');
				return;
			}

			const frame = window.wp.media({
				title: 'Select or Upload Image',
				button: {
					text: 'Use this image',
				},
				multiple: false,
			});

			frame.on('select', () => {
				if (!editor) return;

				const attachment = frame.state().get('selection').first().toJSON();
				editor.chain().focus().setImage({ src: attachment.url }).run();
			});

			frame.open();
		};

		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						type="button"
						className={cn("h-8 w-8", className)}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							openMediaLibrary();
							onClick?.(e);
						}}
						ref={ref}
						{...props}
					>
						{children || <ImageIcon className="h-4 w-4" />}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<span>Insert Image</span>
				</TooltipContent>
			</Tooltip>
		);
	},
);

ImageToolbar.displayName = "ImageToolbar";

export { ImageToolbar };

