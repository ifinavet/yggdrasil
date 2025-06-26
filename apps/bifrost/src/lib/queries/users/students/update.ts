"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function updateStudent(
  user_id: string,
  fields: {
    firstName?: string;
    lastName?: string;
    studyProgram?: string;
    semester?: number;
    degree?: string;
  },
) {
  try {
    const supabase = createServerClient();
    const clerk = await clerkClient();

    const updatedUser = await clerk.users.updateUser(user_id, {
      firstName: fields.firstName,
      lastName: fields.lastName,
    });

    const { error } = await supabase.from("students").update({
      study_program: fields.studyProgram,
      semester: fields.semester,
      degree: fields.degree,
    }).eq("user_id", user_id);

    if (error) {
      throw new Error(error.message);
    }

    return updatedUser;
  } catch (error) {
    console.error(error);
    throw new Error((error as Error).message);
  }
}
