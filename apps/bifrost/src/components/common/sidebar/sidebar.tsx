import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { hasAdminRights, hasAllRights, hasEditRights } from "@workspace/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
	BadgeCheck,
	BugIcon,
	ChartScatterIcon,
	ChevronsUpDown,
	DatabaseIcon,
	ExternalLink,
	GitGraphIcon,
	LogOut,
	MailsIcon,
	ScrollTextIcon,
	ServerCogIcon,
	UserCogIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LogoNBlue from "@/assets/navet/logo_n_blaa.webp";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";
import { SidebarContentGroup } from "./sidebar-content-group";

const externalPaths = {
	external: [
		{
			title: "Clerk",
			icon: UserCogIcon,
			path: "https://dashboard.clerk.com/apps",
		},
		{
			title: "Convex",
			icon: DatabaseIcon,
			path: "https://dashboard.convex.dev/t/ifinavet",
		},
		{
			title: "Sentry",
			icon: BugIcon,
			path: "https://ifi-navet.sentry.io/",
		},
		{
			title: "Vercel",
			icon: ServerCogIcon,
			path: "https://vercel.com/webansvarlig-ifi-navets-projects",
		},
		{
			title: "PostHog",
			icon: ChartScatterIcon,
			path: "https://eu.posthog.com/project/54712",
		},
		{
			title: "Axiom",
			icon: ScrollTextIcon,
			path: "https://app.axiom.co/ifi-navet-admq/datasets/yggdrasil",
		},
		{
			title: "Resend",
			icon: MailsIcon,
			path: "https://resend.com/metrics",
		},
		{
			title: "GitHub",
			icon: GitGraphIcon,
			path: "https://github.com/ifinavet/project-yggdrasil",
		},
	],
};

export default async function BifrostSidebar() {
	const user = await currentUser();

	const adminRights = await hasAdminRights();
	const editRights = await hasEditRights();
	const superAdminRights = await hasAllRights();

	if (!user) {
		throw new Error("User not found");
	}

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem className="max-h-md px-8 py-4 group-data-[collapsible=icon]:px-2">
						<Link href="/">
							<Image
								src={LogoBlue}
								alt="Ifi-navet Logo"
								className="group-data-[collapsible=icon]:hidden dark:brightness-0 dark:grayscale dark:invert"
								priority
							/>
							<Image
								src={LogoNBlue}
								alt="Ifi-navet Logo"
								className="hidden h-8 object-contain group-data-[collapsible=icon]:block dark:brightness-0 dark:grayscale dark:invert"
								priority
							/>
						</Link>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarContentGroup title="Tjenester" items="main" />
				{editRights && <SidebarContentGroup title="Offentlige Sider" items="pages" />}

				{adminRights && <SidebarContentGroup title="Administrator sider" items="admin" />}

				{superAdminRights && (
					<SidebarGroup>
						<SidebarGroupLabel>
							Eksterne tjenester <ExternalLink className="ml-1" />
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{externalPaths.external.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton tooltip={item.title} asChild>
											<a href={item.path} target="_blank" rel="noopener noreferrer">
												{item.icon && <item.icon />}
												<span>{item.title}</span>
											</a>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0!"
								>
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage src={user.imageUrl} alt={user.fullName ?? "Ukjent"} />
										<AvatarFallback className="rounded-lg">NA</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">{user.fullName ?? "Ukjent"}</span>
										<span className="truncate text-xs">{user.emailAddresses[0]?.emailAddress}</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
								side="right"
								align="end"
								sideOffset={4}
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarImage src={user.imageUrl} alt={user.fullName ?? "Ukjent"} />
											<AvatarFallback className="rounded-lg">NA</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">{user.fullName ?? "Ukjent"}</span>
											<span className="truncate text-xs">
												{user.primaryEmailAddress?.emailAddress}
											</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<Link href="/profile">
										<DropdownMenuItem className="flex cursor-pointer gap-2">
											<BadgeCheck size={18} />
											Account
										</DropdownMenuItem>
									</Link>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<SignOutButton>
									<DropdownMenuItem className="flex cursor-pointer gap-2">
										<LogOut size={18} />
										Logg ut
									</DropdownMenuItem>
								</SignOutButton>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
