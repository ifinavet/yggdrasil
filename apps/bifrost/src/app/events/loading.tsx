import { Button } from "@workspace/ui/components//button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@workspace/ui/components//card";
import { Skeleton } from "@workspace/ui/components//skeleton";
import { Plus, Users } from "lucide-react";

export default function EventsLoading() {
	return (
		<>
			<div className="flex justify-between">
				<Skeleton className="h-9 w-48" />
				<Button>
					<Plus className="size-4" /> Lag et nytt arrangement
				</Button>
			</div>

			<div className="grid gap-6">
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
					Publiserte arrangementer
				</h2>
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 6 }).map((_, index) => (
						<EventCardSkeleton key={`visible-skeleton-${index + 1}`} />
					))}
				</div>
				<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
					Skjulte/Påbegynte arrangementer
				</h2>
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 3 }).map((_, index) => (
						<EventCardSkeleton key={`hidden-skeleton-${index + 1}`} />
					))}
				</div>
			</div>
		</>
	);
}

function EventCardSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<div className="flex flex-row flex-wrap gap-2">
					<Skeleton className="h-4 w-32" />
				</div>
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-6 w-24 rounded-full" />
					<Skeleton className="h-6 w-20 rounded-full" />
				</div>
			</CardContent>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div className="line-clamp-1 flex gap-2 font-medium">
					<Users className="size-4" /> Ansvarlige
				</div>
				<div className="space-y-1 text-muted-foreground">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 w-36" />
				</div>
			</CardFooter>
		</Card>
	);
}
