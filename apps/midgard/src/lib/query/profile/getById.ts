"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function getRegistrationsById(userId: string) {
  const supabase = createServerClient();

  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("*, events (event_id, title, event_start)")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    return [];
  }

  if (!registrations) {
    return [];
  }

  console.log(typeof registrations);

  return registrations;
}

export async function getPointsById(userId: string) {
  const supabase = createServerClient();

  const { data: points, error } = await supabase.from("points").select("*").eq("user_id", userId);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch profile");
  }

  if (!points) {
    return [];
  }

  return points;
}

export async function getStudentById(userId: string) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch profile");
  }

  if (!student) {
    return null;
  }

  const user = await clerk.users.getUser(userId);

  return {
    user_id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    semester: student.semester,
    study_program: student.study_program,
    degree: student.degree,
  };
}
