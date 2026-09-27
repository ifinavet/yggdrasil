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
import {
	BanknoteIcon,
	BookOpenIcon,
	BriefcaseIcon,
	BuildingIcon,
	CalendarIcon,
	CalendarRangeIcon,
	ClipboardListIcon,
	FileIcon,
	GitForkIcon,
	type LucideIcon,
	TrendingUpIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_ROUTES } from "@/components/products/product-routes";

type SidebarItem = {
	title: string;
	icon: LucideIcon;
	path: string;
	feature?: GatedFeature;
};

const paths = {
	main: [
		{
			title: "Arrangementer",
			icon: CalendarIcon,
			path: "/events",
		},
		{
			title: "Semesterplan",
			icon: CalendarRangeIcon,
			path: "/semesterplan",
			feature: "semesterPlanning",
		},
		{
			title: "Stillingsannonser",
			icon: BriefcaseIcon,
			path: "/job-listings",
		},
		{
			title: "Engasjement",
			icon: TrendingUpIcon,
			path: "/engasjement",
			feature: "engagement",
		},
		{
			title: "Resurser",
			icon: BookOpenIcon,
			path: "/resources",
		},
	],
	pages: [
		{
			title: "Sider",
			icon: FileIcon,
			path: "/pages",
		},
	],
	admin: [
		{
			title: "Studenter",
			icon: UsersIcon,
			path: "/students",
		},
		{
			title: "Bedrifter",
			icon: BuildingIcon,
			path: "/companies",
		},
		{
			title: "Organisasjon",
			icon: GitForkIcon,
			path: "/organization",
		},
		{
			title: "Produkter",
			icon: BanknoteIcon,
			path: PRODUCT_ROUTES.list,
			feature: "products",
		},
		{
			title: "Skjemaer",
			icon: ClipboardListIcon,
			path: "/feedback-forms",
		},
	],
} satisfies Record<string, SidebarItem[]>;

export function SidebarContentGroup({
	title,
	items,
}: Readonly<{
	title: string;
	items: keyof typeof paths;
}>) {
	const rootPathSegment = usePathname().split("/")[1];
	const enabled: Record<GatedFeature, boolean> = {
		huginFeedback: useFeatureEnabled("huginFeedback"),
		products: useFeatureEnabled("products"),
		jobListingOrders: useFeatureEnabled("jobListingOrders"),
		semesterPlanning: useFeatureEnabled("semesterPlanning"),
		engagement: useFeatureEnabled("engagement"),
	};
	const visibleItems = paths[items].filter(
		(item: SidebarItem) => item.feature === undefined || enabled[item.feature],
	);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{title}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{visibleItems.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								tooltip={item.title}
								asChild
								isActive={item.path === `/${rootPathSegment}`}
							>
								<Link href={item.path}>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
