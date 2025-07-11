import { createServerClient } from "@/lib/supabase/server";

export function getCompanyImageByImageName(imageName: string) {
	const supabase = createServerClient();

	const { data: image_url } = supabase.storage.from("companies").getPublicUrl(imageName);

	return image_url.publicUrl;
}
