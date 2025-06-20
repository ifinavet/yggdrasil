import { SignOutButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  BadgeCheck,
  BookOpenIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChevronsUpDown,
  DatabaseIcon,
  ExternalLink,
  LogOut,
  ServerCogIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LogoNBlue from "@/assets/navet/logo_n_blaa.webp";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";
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
  SidebarGroupContent,
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
  resources: [
    {
      title: "Resurser",
      icon: BookOpenIcon,
      path: "/bifrost/resources",
    },
  ],
  admin: [
    {
      title: "Studenter",
      icon: UsersIcon,
      path: "/bifrost/students",
    },
    {
      title: "Bedrifter",
      icon: BuildingIcon,
      path: "/bifrost/companies",
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
          <SidebarMenuItem className="px-8 py-4 max-h-md group-data-[collapsible=icon]:px-2">
            <Link href="/bifrost">
              <Image
                src={LogoBlue}
                alt="Ifi-navet Logo"
                className="dark:grayscale dark:invert dark:brightness-0 group-data-[collapsible=icon]:hidden"
                priority
              />
              <Image
                src={LogoNBlue}
                alt="Ifi-navet Logo"
                className="dark:grayscale dark:invert dark:brightness-0 hidden group-data-[collapsible=icon]:block h-8 object-contain"
                priority
              />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tjenester</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Resurser</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {paths.resources.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title} asChild>
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
        {orgRole === "org:admin" && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarGroupLabel>Administrator sider</SidebarGroupLabel>
                  {paths.admin.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton tooltip={item.title} asChild>
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
            <SidebarGroup>
              <SidebarGroupLabel>
                Eksterne tjenester <ExternalLink className="ml-1" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {paths.external.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton tooltip={item.title} asChild>
                        <a
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
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
