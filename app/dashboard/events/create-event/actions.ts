import {createClient} from "@/utils/supabase/client";

export async function getCompanies() {
    const supabase = createClient();
    const { data: companies } = await supabase.from("company").select("id, name");
    return companies ?? [];
}
