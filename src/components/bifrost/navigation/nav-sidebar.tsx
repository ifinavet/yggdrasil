import type { User } from "@/app/(bifrost)/bifrost/layout";
import LogoBlue from "@/assets/simple_logo_blaa.webp";
import { NavUser } from "@/components/bifrost/navigation/nav-user";
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
} from "@/components/ui/sidebar";
import { BriefcaseIcon, BuildingIcon, CalendarIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const paths = {
    main: [
        {
            title: "Arrangementer",
            url: "/bifrost/events",
            icon: CalendarIcon,
        },
        {
            title: "Stillingsannonser",
            url: "/bifrost/job-listings",
            icon: BriefcaseIcon,
        },
    ],
    secondary: [
        {
            title: "Studenter",
            url: "/bifrost/students",
            icon: UsersIcon,
        },
        {
            title: "Bedrifter",
            url: "/bifrost/companies",
            icon: BuildingIcon,
        },
    ],
};

interface NavSidebarProps {
    user: User;
}

export function NavSidebar({ user }: NavSidebarProps) {
    return (
        <Sidebar collapsible='icon' variant='inset'>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className='px-8 py-4 max-h-md'>
                        <Link href='/bifrost'>
                            <Image
                                src={LogoBlue}
                                alt='Ifi-navet Logo'
                                className='dark:grayscale dark:invert dark:brightness-0'
                                priority
                            />
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Produkter</SidebarGroupLabel>
                    <SidebarMenu>
                        {paths.main.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    tooltip={item.title}
                                    asChild
                                    className='hover:bg-navet-500 hover:text-white'
                                >
                                    <Link href={item.url}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Brukere og bedrifter</SidebarGroupLabel>
                    <SidebarMenu>
                        {paths.secondary.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    tooltip={item.title}
                                    asChild
                                    className='hover:bg-navet-500 hover:text-white'
                                >
                                    <Link href={item.url}>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <NavUser user={user} />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
