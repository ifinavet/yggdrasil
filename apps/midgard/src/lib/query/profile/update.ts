"use server";

import { clerkClient } from "@clerk/nextjs/server";
import type { ProfileFormSchema } from "@/components/profile/update-profile-form";
import { createServerClient } from "@/lib/supabase/server";

export async function updateStudentProfile(userId: string, formData: ProfileFormSchema) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { error: updateStudentError } = await supabase.from("students").update({
    study_program: formData.studyProgram,
    semester: formData.semester,
    degree: formData.degree,
  }).eq("user_id", userId);

  if (updateStudentError) {
    console.error("Error updating student profile:", updateStudentError);
    throw new Error("Failed to update student profile");
  }

  try {
    await clerk.users.updateUser(userId, {
      firstName: formData.firstname,
      lastName: formData.lastname,
    });
  } catch (error) {
    console.error("Error updating user metadata:", error);
    throw new Error("Failed to update user metadata");
  }

  return
}
