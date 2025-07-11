"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { getBoardMembers } from "@/lib/queries/organization";
import EditBoardMember from "./edit-boardmember";

export default function ListBoardMembers() {
	const { data: boardMembers, isLoading } = useQuery({
		queryKey: ["boardMembers"],
		queryFn: getBoardMembers,
	});

	if (isLoading) {
		return <div>Loading...</div>;
	}

	return (
		<div className='flex max-w-8xl flex-wrap gap-4'>
			{boardMembers?.map((member) => (
				<Card key={member.id} className='w-96'>
					<CardHeader>
						<CardTitle>{member.position}</CardTitle>
						<CardAction>
							<EditBoardMember organisationId={member.organizationId} />
						</CardAction>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between gap-4'>
							<Avatar className='h-16 w-16 rounded-lg'>
								<AvatarImage src={member.image} />
								<AvatarFallback>{member?.fullname?.slice(0, 1)}</AvatarFallback>
							</Avatar>
							<div>
								<p>{member.fullname}</p>
								<a href={`mailto:${member.email}`} className='text-balance text-muted-foreground'>
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
