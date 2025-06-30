"use server";

import { createServerClient } from "@/lib/supabase/server";

export const getAllPages = async () => {
  const supabase = createServerClient();

  const { data: pages, error } = await supabase.from("pages").select("*");

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch pages");
  }

  return pages;
};
