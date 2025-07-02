"use server";

import { clerkClient } from "@clerk/nextjs/server";

export default async function getAllInternalMembers(orgId: string) {
	const client = await clerkClient();
	const { data } = await client.users.getUserList({
		orderBy: "last_name",
		organizationId: [orgId],
		limit: 100,
	});

	return data.map((user) => {
		return {
			id: user.id,
			fullname: user.fullName,
		};
	});
}
