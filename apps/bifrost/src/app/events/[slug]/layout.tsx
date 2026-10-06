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
			<div className="flex flex-wrap justify-between">
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

				<EventNav identifier={event_id} />
			</div>

			{children}
		</EventPageGuide>
	);
}
