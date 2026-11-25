"use client";

import { Carousel } from "@workspace/ui/components/carousel";
import Autoplay from "embla-carousel-autoplay";
import type { ComponentProps } from "react";

export default function JobListingsCarousel(props: ComponentProps<typeof Carousel>) {
	return (
		<Carousel
			opts={{ loop: true, align: "start" }}
			plugins={[Autoplay({ delay: 4000 })]}
			{...props}
		/>
	);
}
