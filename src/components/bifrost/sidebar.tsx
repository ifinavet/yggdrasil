import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";
import { SignOutButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  BadgeCheck,
  BriefcaseIcon,
  CalendarIcon,
  ChevronsUpDown,
  DatabaseIcon,
  LogOut,
  ServerCogIcon,
  UserCogIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

const paths = {
  main: [
    {
      title: "Arrangementer",
      icon: CalendarIcon,
      path: "/bifrost/events",
    },
    {
      title: "Stillingsannonser",
      icon: BriefcaseIcon,
      path: "/bifrost/job-listings",
    },
  ],
  external: [
    {
      title: "Clerk",
      icon: UserCogIcon,
      path: "https://dashboard.clerk.com/apps",
    },
    {
      title: "Supabase",
      icon: DatabaseIcon,
      path: "https://supabase.com/dashboard/project/lvhucihmyhwqrrwdiirf",
    },
    {
      title: "Vercel",
      icon: ServerCogIcon,
      path: "https://vercel.com/webansvarlig-ifi-navets-projects",
    },
  ],
};

export default async function BifrostSidebar() {
  const { userId, orgRole } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    throw new Error("User not found");
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="px-8 py-4 max-h-md">
            <Link href="/bifrost">
              <Image
                src={LogoBlue}
                alt="Ifi-navet Logo"
                className="dark:grayscale dark:invert dark:brightness-0"
                priority
              />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tjenester</SidebarGroupLabel>
          {paths.main.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <Link href={item.path}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarGroup>
        {orgRole === "org:admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Eksterne tjenester</SidebarGroupLabel>
            {paths.external.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} asChild>
                  <a href={item.path} target="_blank" rel="noopener noreferrer">
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
                    <AvatarImage
                      src={user.imageUrl}
                      alt={user.fullName ?? "Ukjent"}
                    />
                    <AvatarFallback className="rounded-lg">NA</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user.fullName ?? "Ukjent"}
                    </span>
                    <span className="truncate text-xs">
                      {user.emailAddresses[0].emailAddress}
                    </span>
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
                      <AvatarImage
                        src={user.imageUrl}
                        alt={user.fullName ?? "Ukjent"}
                      />
                      <AvatarFallback className="rounded-lg">NA</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.fullName ?? "Ukjent"}
                      </span>
                      <span className="truncate text-xs">
                        {user.emailAddresses[0].emailAddress}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <Link href="/bifrost/profile">
                    <DropdownMenuItem className="cursor-pointer flex gap-2">
                      <BadgeCheck size={18} />
                      Account
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <SignOutButton>
                  <DropdownMenuItem className="cursor-pointer flex gap-2">
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
