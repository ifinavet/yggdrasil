"use client";

import { useSemesterPlanningEnabled } from "@workspace/ui/components/semester-planning-gate";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
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

const paths = {
	superAdmin: [{ title: "Skjemaer", icon: ClipboardListIcon, path: "/feedback-forms" }],
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
	const semesterPlanning = useSemesterPlanningEnabled();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{title}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{[...paths[items], ...(extraItems ? paths[extraItems] : [])]
						.filter((item) => item.path !== "/semesterplan" || semesterPlanning)
						.map((item) => (
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
