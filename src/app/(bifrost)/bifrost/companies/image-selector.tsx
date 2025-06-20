import Image from "next/image";
import { createServerClient } from "@/utils/supabase/server";

export default async function ImageSelector() {
  const client = createServerClient();

  const { data: company_images, error: company_images_error } =
    await client.storage.from("companies").list("company_images", {
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (company_images_error) {
    console.error("Error fetching company images:", company_images_error);
    return null;
  }

  if (!company_images) {
    console.error("No company images found");
    return null;
  }

  return (
    <div>
      {company_images.map((image) => {
        const { data: url } = client.storage
          .from("companies")
          .getPublicUrl(`company_images/${image.name}`);
        return (
          <div key={image.id}>
            <Image
              src={url.publicUrl}
              alt={image.name}
              height={200}
              width={200}
            />
          </div>
        );
      })}
    </div>
  );
}
