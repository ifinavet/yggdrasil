import { createServerClient } from "@/lib/supabase/server";

export default async function getCompanyImageById(company_id: number) {
  const supabase = createServerClient();

  const { data: image_name, error: image_name_error } = await supabase
    .from("company_images")
    .select("*")
    .eq("company_id", company_id)
    .single();

  if (image_name_error || image_name.name === null || image_name.id === null) {
    console.error("Error fetching company image:", image_name_error);
    return null;
  }

  const { data: image_url } = supabase.storage.from("companies").getPublicUrl(image_name.name);

  return {
    url: image_url.publicUrl,
    name: image_name.name,
    image_id: image_name.id
  };
}
