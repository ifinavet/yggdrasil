import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar";
import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";
import {NavSidebar} from "@/components/dashboard/navigation/nav-sidebar";
import Header from "@/components/dashboard/header";
import {TitleProvider} from "@/app/contexts/TitleContext";

export interface User {
    id: string,
    email: string,
    firstname: string,
    lastname: string,
    name: string,
    initials: string,
}

export default async function Layout({
                                         children,
                                     }: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: {user},
    } = await supabase.auth.getUser();


    let {data: internal_member, error} = await supabase
        .from('internal_member')
        .select('id, user (id, firstname, lastname)').single().overrideTypes<{
            id: string,
            user: { id: string, firstname: string, lastname: string }
        }>()

    if (!user && !internal_member) {
        return redirect('/sign-in');
    }

    const currentUser: User = {
        id: user?.id ?? "",
        email: user?.email ?? "",
        firstname: internal_member?.user.firstname ?? "",
        lastname: internal_member?.user.lastname ?? "",
        name: `${internal_member?.user.firstname ?? ''} ${internal_member?.user.lastname ?? ''}`,
        initials: `${internal_member?.user.firstname[0] ?? ''}${internal_member?.user.lastname[0] ?? ''}`,
    }

    return (
        <TitleProvider>
            <SidebarProvider>
                <NavSidebar user={currentUser}/>
                <SidebarInset>
                    <Header/>
                    <main className="p-4">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </TitleProvider>
    )
}
