"use client";

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
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_ROUTES } from "@/components/products/product-routes";

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
		},
		{
			title: "Stillingsannonser",
			icon: BriefcaseIcon,
			path: "/job-listings",
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
			requiresProducts: true,
		},
		{
			title: "Skjemaer",
			icon: ClipboardListIcon,
			path: "/feedback-forms",
		},
	],
};

export function SidebarContentGroup({
	title,
	items,
}: Readonly<{
	title: string;
	items: keyof typeof paths;
}>) {
	const rootPathSegment = usePathname().split("/")[1];
	const productsEnabled = useFeatureEnabled("products");
	const semesterPlanning = useFeatureEnabled("semesterPlanning");
	const visibleItems = paths[items].filter(
		(item) =>
			(productsEnabled || !("requiresProducts" in item)) &&
			(item.path !== "/semesterplan" || semesterPlanning),
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
