"use client";

import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
	BanknoteIcon,
	BookOpenIcon,
	BriefcaseIcon,
	BuildingIcon,
	CalendarIcon,
	ClipboardListIcon,
	FileIcon,
	GitForkIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProductsEnabled } from "@/components/products/use-products-enabled";

const paths = {
	superAdmin: [{ title: "Skjemaer", icon: ClipboardListIcon, path: "/feedback-forms" }],
	main: [
		{
			title: "Arrangementer",
			icon: CalendarIcon,
			path: "/events",
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
			path: "/products",
			requiresProducts: true,
		},
	],
};

export function SidebarContentGroup({
	title,
	items,
	extraItems,
}: Readonly<{
	title: string;
	items: keyof typeof paths;
	extraItems?: keyof typeof paths;
}>) {
	const rootPathSegment = usePathname().split("/")[1];
	const productsEnabled = useProductsEnabled();
	const visibleItems = [...paths[items], ...(extraItems ? paths[extraItems] : [])].filter(
		(item) => productsEnabled || !("requiresProducts" in item),
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
