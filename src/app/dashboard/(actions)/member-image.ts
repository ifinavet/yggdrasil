"use server";

import {createClient} from "@/utils/supabase/server";
import {cookies} from "next/headers";

export async function getInternalMemberImage(image_id: string) {
    const cookieStore = await cookies();
    let profileImageUrl = cookieStore.get("profileImageUrl")?.value;

    if (profileImageUrl) {
        return profileImageUrl;
    }

    const supabase = await createClient();
    const { data: image } = await supabase
        .from("member_images")
        .select("bucket_id, name")
        .eq("id", image_id)
        .single();

    if (image) {
        const { data } = await supabase.storage
            .from(image.bucket_id)
            .createSignedUrl(image.name, 3600);
        profileImageUrl = data?.signedUrl ?? "";
    }

    return profileImageUrl ?? "";
}
