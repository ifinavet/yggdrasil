"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

function getRange(page: number, limit: number) {
	const from = page * limit;
	const to = from + limit - 1;

	return {
		from,
		to,
	};
}

export async function getStudentsTableMetadata() {
	const supabase = createServerClient();

	const { count } = await supabase.from("students").select("*", { count: "estimated" });

	if (!count) {
		throw new Error("Failed to fetch students");
	}

	return count;
}

export async function getAllStudentsPaged({
	pageIndex,
	pageSize,
}: {
	pageIndex: number;
	pageSize: number;
}) {
	const supabase = createServerClient();
	const clerk = await clerkClient();

	const { from, to } = getRange(pageIndex, pageSize);

	const { data: students_data, error: students_error } = await supabase
		.from("students")
		.select("*")
		.range(from, to);

	if (students_error) {
		throw new Error("Failed to fetch students");
	}

	if (!students_data) {
		return [];
	}

	const userId = students_data.map((student) => student.user_id);
	const users = await clerk.users.getUserList({ userId });

	const students = students_data.map((student) => {
		const user = users.data.find((user) => user.id === student.user_id);
		return {
			...student,
			user: user,
		};
	});

	return students.map((student) => ({
		user_id: student.user_id,
		name: student.user?.fullName ?? "Ukjent",
		email: student.user?.primaryEmailAddress?.emailAddress ?? "Ukjent",
		status: student.user ? (student.user.locked ? "Låst" : "Aktiv") : "Ukjent",
		program: student.study_program,
		semester: student.semester,
	}));
}
