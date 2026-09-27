import type { Id } from "@workspace/backend/convex/dataModel";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { TableCell } from "@workspace/ui/components/table";
import { LIST_CELL } from "@/components/common/table-classes";

export function EventCell({
	event,
	onSelect,
}: Readonly<{
	event: {
		_id: Id<"events">;
		title: string;
		companyName: string;
		companyLogoUrl: string | null;
	};
	onSelect: (eventId: Id<"events">) => void;
}>) {
	return (
		<TableCell className={LIST_CELL}>
			<div className="flex min-w-0 items-center gap-3">
				<CompanyLogo name={event.companyName} url={event.companyLogoUrl} />
				<div>
					<button
						type="button"
						onClick={() => onSelect(event._id)}
						className="block text-left font-medium after:absolute after:inset-0"
					>
						{event.title}
					</button>
					<span className="block text-muted-foreground text-xs">{event.companyName}</span>
				</div>
			</div>
		</TableCell>
	);
}
