import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from "@/components/ui/sidebar";
import {BriefcaseIcon, BuildingIcon, CalendarIcon, UsersIcon} from "lucide-react";
import {NavUser} from "@/components/dashboard/navigation/nav-user";
import {User} from "@/app/dashboard/layout";
import Image from "next/image";
import logoBlaa from '/assets/simple_logo_blaa.webp';
import Link from "next/link";

const paths = {
    main: [
        {
            title: "Arrangementer",
            url: "dashboard/events",
            icon: CalendarIcon
        },
        {
            title: "Stillingsannonser",
            url: "dashboard/listings",
            icon: BriefcaseIcon
        },
    ],
    secondary: [
        {
            title: "Studenter",
            url: "dashboard/students",
            icon: UsersIcon
        },
        {
            title: "Bedrifter",
            url: "dashboard/companies",
            icon: BuildingIcon
        },
    ]
}

interface NavSidebarProps {
    user: User
}

export function NavSidebar({user}: NavSidebarProps) {
    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className="px-8 py-4">
                        <Image src={logoBlaa} alt="IFI-Navet logo"/>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel>Produkter</SidebarGroupLabel>
                    <SidebarMenu>
                        {paths.main.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton tooltip={item.title} asChild>
                                    <Link href={item.url}>
                                        {item.icon && <item.icon/>}
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
                                <SidebarMenuButton tooltip={item.title} asChild>
                                    <Link href={item.url}>
                                        {item.icon && <item.icon/>}
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
                        <NavUser user={user}/>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}