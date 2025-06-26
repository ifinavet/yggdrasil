"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getAllEvents({ year, semester }: { year: number; semester: string }) {
  const client = createServerClient();

  if (!year || !semester) {
    throw new Error("Year and semester are required");
  }

  let range_start: Date;
  let range_end: Date;
  if (semester.toLowerCase() === "vår") {
    range_start = new Date(year, 0, 1);
    range_end = new Date(year, 6, 30);
  } else if (semester.toLowerCase() === "høst") {
    range_start = new Date(year, 7, 1);
    range_end = new Date(year, 11, 31);
  } else {
    throw new Error("Invalid semester");
  }

  const { data: events, error } = await client
    .from("events")
    .select(
      "event_id, title, event_start, published, external_url, companies (company_id, company_name)",
    )
    .gte("event_start", range_start.toISOString())
    .lte("event_start", range_end.toISOString());

  if (error) {
    console.error(error);
    throw new Error("No data found");
  }

  const published = events.filter((event) => event.published);
  const unpublished = events.filter((event) => !event.published);

  return { published, unpublished };
}

export async function getPossibleSemestes() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_start")
    .order("event_start", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("No data found");
  }

  const semesters = data.map((event_date) => {
    const date = new Date(event_date.event_start);
    const year = date.getFullYear();
    const month = date.getMonth();
    const semester = month < 6 ? "vår" : "høst";
    return { year, semester };
  });

  return semesters.filter(
    (sem, index, self) =>
      index === self.findIndex((s) => s.year === sem.year && s.semester === sem.semester),
  );
}
