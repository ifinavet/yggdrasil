"use client";

import type { api } from "@workspace/backend/convex/api";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import EditBoardMember from "./edit-boardmember";

export default function ListBoardMembers({
	preloadedBoardMembers,
}: {
	preloadedBoardMembers: Preloaded<typeof api.internals.getTheBoard>;
}) {
	const boardMembers = usePreloadedQuery(preloadedBoardMembers);

	if (!boardMembers) {
		return <div>Loading...</div>;
	}

	return (
		<div className='flex max-w-8xl flex-wrap gap-4'>
			{boardMembers?.map((member) => (
				<Card key={member._id} className='w-96'>
					<CardHeader>
						<CardTitle>{member.position}</CardTitle>
						<CardAction>
							<EditBoardMember internalId={member._id} />
						</CardAction>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between gap-4'>
							<Avatar className='h-16 w-16 rounded-lg'>
								<AvatarImage src={member.image} />
								<AvatarFallback>{member.fullName.slice(0, 1)}</AvatarFallback>
							</Avatar>
							<div>
								<p>{member.fullName}</p>
								<a
									href={`mailto:${member.positionEmail ?? member.email}`}
									className='text-balance text-muted-foreground'
								>
									{member.email}
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
