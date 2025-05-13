import {getInternalMemberImage} from "@/app/(bifrost)/bifrost/(actions)/member-image";
import Header from "@/components/dashboard/header";
import {NavSidebar} from "@/components/dashboard/navigation/nav-sidebar";
import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar";
import {TitleProvider} from "@/contexts/TitleContext";
import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";

export interface User {
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    name: string;
    initials: string;
    avatar_url: string;
}

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        console.warn("User not found");
        return redirect("/sign-in");
    }

    const { data: internal_member, error } = await supabase
        .from("internal_member")
        .select("id, profile_image_id, user (id, firstname, lastname)")
        .eq("id", user?.id)
        .single()
        .overrideTypes<{
            id: string;
            profile_image_id: string;
            user: { id: string; firstname: string; lastname: string };
        }>();

    if (internal_member == null && error != null) {
        console.warn(`Error fetching internal member: ${error}`);
        return redirect("/sign-in");
    }

    const imageUrl = await getInternalMemberImage(internal_member?.profile_image_id ?? "");

    const currentUser: User = {
        id: user.id,
        email: user.email ?? "",
        firstname: internal_member.user.firstname,
        lastname: internal_member.user.lastname,
        name: `${internal_member.user.firstname} ${internal_member?.user.lastname}`,
        initials: `${internal_member.user.firstname?.[0] ?? ""}${internal_member.user.lastname?.[0]}`,
        avatar_url: imageUrl ?? "",
    };

    return (
        <TitleProvider>
            <SidebarProvider>
                <NavSidebar user={currentUser} />
                <SidebarInset>
                    <Header />
                    <main className='p-4'>{children}</main>
                </SidebarInset>
            </SidebarProvider>
        </TitleProvider>
    );
}
