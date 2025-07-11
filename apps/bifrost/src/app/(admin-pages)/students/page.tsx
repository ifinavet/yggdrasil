import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import StudentsOverview from "@/components/students/students-overview";
import { getAllStudentsPaged } from "@/lib/queries/students";

export default async function StudentsPage() {
	const queryClient = new QueryClient();

	await queryClient.prefetchQuery({
		queryKey: ["students", { pageIndex: 0, pageSize: 25 }],
		queryFn: () => getAllStudentsPaged({ pageIndex: 0, pageSize: 25 }),
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
						<BreadcrumbPage>Students</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<StudentsOverview />
		</HydrationBoundary>
	);
}
