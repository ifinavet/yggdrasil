import { placeholderKeys } from "@workspace/shared/utils";
import { Skeleton } from "@workspace/ui/components//skeleton";

export default function EventsLoading() {
	return (
		<div>
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-8 w-44" />
				<span className="flex-1" />
				<Skeleton className="h-9 w-80" />
				<Skeleton className="h-9 w-32" />
				<Skeleton className="h-9 w-52" />
			</div>

			<Skeleton className="mt-7 mb-3 h-6 w-40" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{placeholderKeys("my-event", 3).map((key) => (
					<Skeleton key={key} className="h-[110px] rounded-[12px]" />
				))}
			</div>

			<Skeleton className="mt-7 mb-3 h-6 w-28" />
			<div className="flex flex-col gap-px overflow-hidden rounded-lg border bg-card">
				{placeholderKeys("upcoming-event", 6).map((key) => (
					<Skeleton key={key} className="h-14 rounded-none" />
				))}
			</div>
		</div>
	);
}
