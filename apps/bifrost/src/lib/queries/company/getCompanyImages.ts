"use server";

import { createServerClient } from "@/utils/supabase/server";

interface FileObject {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

export default async function getCompanyImages(offset: number): Promise<FileObject[]> {
  const client = createServerClient();

  const { data: company_images, error: company_images_error } = await client.storage
    .from("companies")
    .list("company_images", {
      limit: 20,
      offset: offset || 0,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (company_images_error) {
    console.error("Error fetching company images:", company_images_error);
    return [];
  }

  return company_images;
}
