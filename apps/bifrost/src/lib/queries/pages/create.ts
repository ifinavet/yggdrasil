"use server";

import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function createPage(values: PageFormValues, published: boolean) {
  const supabase = createServerClient();

  const { error } = await supabase.from("pages").insert({
    title: values.title,
    content: values.content,
    published,
  });

  if (error) {
    throw new Error(error.message);
  }
}
