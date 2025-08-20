"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";

export default function NewInternalSearch({
	selectedUser,
	setSelectedUserAction,
}: {
	selectedUser: Doc<"users"> | null;
	setSelectedUserAction: (user: Doc<"users">) => void;
}) {
	const [searchInput, setSearchInput] = useState<string>("");
	const users = usePaginatedQuery(
		api.users.searchAfterUsers,
		{ searchInput },
		{ initialNumItems: 10 },
	);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">
					{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "Velg bruker"}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Søk etter en bruker</DialogTitle>
					<DialogDescription>
						Søk etter etternavnet til en bruker for å velge vedkomende til å bli intern.
					</DialogDescription>
					<div className='space-y-6'>
						<Input
							placeholder='eks. Nordmann'
							type='text'
							onChange={(e) => {
								setSearchInput(e.target.value);
							}}
						/>
						<ScrollArea className='max-h-40'>
							{users.results.map((user) => (
								<DialogClose key={user._id} asChild>
									<Button
										type='button'
										variant='ghost'
										onClick={() => setSelectedUserAction(user)}
										className="mb-2 flex w-full justify-start"
									>
										{user.firstName} {user.lastName} - {user.email}
									</Button>
								</DialogClose>
							))}
						</ScrollArea>
						<Button disabled={users.status !== "CanLoadMore"}>{
							users.status === "LoadingFirstPage" || users.status === "LoadingMore"
								? "Laster..."
								: "Last inn flere"}</Button>
					</div>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}
