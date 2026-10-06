"use client";

import type { GatedFeature } from "@workspace/shared/feature-flags";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { useFeatureEnabled } from "@workspace/ui/hooks/use-feature-enabled";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type SidebarGroupKey, visibleSections } from "./sidebar-navigation";

export function SidebarContentGroup({
	title,
	items,
}: Readonly<{
	title: string;
	items: SidebarGroupKey;
}>) {
	const rootPathSegment = usePathname().split("/")[1];
	const enabled: Record<GatedFeature, boolean> = {
		semesterPlanning: useFeatureEnabled("semesterPlanning"),
		food: useFeatureEnabled("food"),
	};
	const sections = visibleSections(items, enabled);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{title}</SidebarGroupLabel>
			{sections.map((section) => (
				<SidebarGroupContent key={section.title ?? items}>
					{section.title && (
						<SidebarGroupLabel className="font-normal text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
							{section.title}
						</SidebarGroupLabel>
					)}
					<SidebarMenu>
						{section.items.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									tooltip={item.title}
									asChild
									isActive={item.path === `/${rootPathSegment}`}
								>
									<Link href={item.path}>
										<item.icon />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			))}
		</SidebarGroup>
	);
}
