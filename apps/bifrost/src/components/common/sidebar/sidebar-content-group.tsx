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
  BookOpenIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const paths = {
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
  ],
  resources: [
    {
      title: "Resurser",
      icon: BookOpenIcon,
      path: "/resources",
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
  ],
};

export function SidebarContentGroup({
  title,
  items,
}: {
  title: string;
  items: keyof typeof paths;
}) {
  const rootPathSegment = usePathname().split("/")[1];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {paths[items].map((item: (typeof paths)[typeof items][number]) => (
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
