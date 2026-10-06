import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { headers } from "next/headers";
import { EventPageGuide } from "@/components/events/event-guide-provider";
import { EventNav } from "@/components/events/event-nav";
import { EventGuideReplay } from "@/components/events/guide";

export default async function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	const path = (await headers()).get("x-pathname")?.split("/");
	if (!path) {
		throw new Error("Invalid path");
	}

	const event_id = path?.[2] ?? "";
	if (!event_id) {
		throw new Error("Invalid event ID");
	}

	return (
		<EventPageGuide identifier={event_id}>
			<div className="flex flex-wrap items-center justify-between gap-y-2">
				<div className="flex items-center gap-1">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink href="/events">Arrangementer</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>Administrer arrangementet</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<EventGuideReplay />
				</div>

				<EventNav identifier={event_id} />
			</div>

			{children}
		</EventPageGuide>
	);
}
