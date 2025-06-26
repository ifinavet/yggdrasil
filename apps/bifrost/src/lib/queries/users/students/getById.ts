"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function getStudentById(id: string) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: student, error } = await supabase.from("students").select("*").eq("user_id", id).single();

  if (!student || error) throw new Error("Student not found", { cause: error });

  const user = await clerk.users.getUser(id)

  return {
    user_id: student.user_id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.primaryEmailAddress?.emailAddress,
    semester: student.semester,
    degree: student.degree,
    studyProgram: student.study_program,
  }
}
