import {TitleProvider} from "@/app/contexts/TitleContext";
import Header from "@/components/dashboard/header";
import {NavSidebar} from "@/components/dashboard/navigation/nav-sidebar";
import {ThemeProvider} from "@/components/theme-provider";
import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar";
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

    const { data: internal_member, error } = await supabase
        .from("internal_member")
        .select("id, user (id, firstname, lastname)")
        .single()
        .overrideTypes<{
            id: string;
            user: { id: string; firstname: string; lastname: string };
        }>();

    if (!user && !internal_member) {
        return redirect("/sign-in");
    }

    console.log(internal_member);

    const currentUser: User = {
        id: user?.id ?? "",
        email: user?.email ?? "",
        firstname: internal_member?.user.firstname ?? "",
        lastname: internal_member?.user.lastname ?? "",
        name: `${internal_member?.user.firstname ?? ""} ${internal_member?.user.lastname ?? ""}`,
        initials: `${internal_member?.user.firstname[0] ?? ""}${internal_member?.user.lastname[0] ?? ""}`,
        avatar_url:
            "https://kafxocampazsiggitdvg.supabase.co/storage/v1/object/sign/member-pictures/christoffer_hennie.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5X2Y2OTE5YzQwLTlhNmUtNDdiNC04NTEyLTdkM2E2M2JiOGViOSJ9.eyJ1cmwiOiJtZW1iZXItcGljdHVyZXMvY2hyaXN0b2ZmZXJfaGVubmllLmpwZyIsImlhdCI6MTc0NDk3MzEzMywiZXhwIjoxNzQ1NTc3OTMzfQ.eojTP9Y2KdRPkLg_FWOe7VYDuf7BlImZhXimVq37GaY",
    };

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <TitleProvider>
                <SidebarProvider>
                    <NavSidebar user={currentUser} />
                    <SidebarInset>
                        <Header />
                        <main className="p-4">{children}</main>
                    </SidebarInset>
                </SidebarProvider>
            </TitleProvider>
        </ThemeProvider>
    );
}
