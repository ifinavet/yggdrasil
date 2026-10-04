import type { GatedFeature } from "@workspace/shared/feature-flags";
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
	ReceiptIcon,
	TrendingUpIcon,
	TrophyIcon,
	UserPlusIcon,
	UsersIcon,
	UtensilsIcon,
} from "lucide-react";
import { PRODUCT_ROUTES } from "@/components/products/product-routes";

export type SidebarItem = {
	title: string;
	icon: LucideIcon;
	path: string;
	feature?: GatedFeature;
};

export type SidebarSection = {
	title?: string;
	items: SidebarItem[];
};

export const sidebarNavigation = {
	main: [
		{
			items: [
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
					title: "Innsikt",
					icon: TrendingUpIcon,
					path: "/insight",
					feature: "engagement",
				},
				{
					title: "Leaderboard",
					icon: TrophyIcon,
					path: "/leaderboard",
				},
				{
					title: "Resurser",
					icon: BookOpenIcon,
					path: "/resources",
				},
			],
		},
	],
	pages: [
		{
			items: [
				{
					title: "Sider",
					icon: FileIcon,
					path: "/pages",
				},
			],
		},
	],
	admin: [
		{
			title: "Personer",
			items: [
				{ title: "Opptak", icon: UserPlusIcon, path: "/admissions" },
				{
					title: "Studenter",
					icon: UsersIcon,
					path: "/students",
				},
				{
					title: "Organisasjon",
					icon: GitForkIcon,
					path: "/organization",
				},
			],
		},
		{
			title: "Bedrifter og økonomi",
			items: [
				{
					title: "Bedrifter",
					icon: BuildingIcon,
					path: "/companies",
				},
				{
					title: "Produkter",
					icon: BanknoteIcon,
					path: PRODUCT_ROUTES.list,
					feature: "products",
				},
				{
					title: "Fakturaer",
					icon: ReceiptIcon,
					path: "/invoicing",
					feature: "products",
				},
			],
		},
		{
			title: "Planlegging",
			items: [
				{
					title: "Semesterplan",
					icon: CalendarRangeIcon,
					path: "/semesterplan",
					feature: "semesterPlanning",
				},
				{
					title: "Mat",
					icon: UtensilsIcon,
					path: "/food",
				},
				{
					title: "Skjemaer",
					icon: ClipboardListIcon,
					path: "/feedback-forms",
				},
			],
		},
	],
} satisfies Record<string, SidebarSection[]>;

export type SidebarGroupKey = keyof typeof sidebarNavigation;

export function visibleSections(
	group: SidebarGroupKey,
	enabled: Record<GatedFeature, boolean>,
): SidebarSection[] {
	return sidebarNavigation[group]
		.map((section: SidebarSection) => ({
			...section,
			items: section.items.filter((item) => item.feature === undefined || enabled[item.feature]),
		}))
		.filter((section) => section.items.length > 0);
}
