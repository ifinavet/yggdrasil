import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/backend/convex/api";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { fetchQuery } from "convex/nextjs";
import CreateEventForm from "./create-event-form";

export default async function NewEvent() {
	const queryClient = new QueryClient();

	await queryClient.prefetchQuery({
		queryKey: ["companies"],
		queryFn: () => fetchQuery(api.companies.getAll, {}),
	});

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href='/events'>Arrangementer</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Opprett et arrangement</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<CreateEventForm />
		</HydrationBoundary>
	);
}
