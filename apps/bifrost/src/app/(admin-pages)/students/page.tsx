import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import StudentsOverview from "@/components/students/students-overview";
import StudentsWithPointsOverview from "@/components/students/students-with-points-overview";

export default async function StudentsPage() {
	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Studenter</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<Tabs defaultValue="all">
				<TabsList>
					<TabsTrigger value="all">Alle studenter</TabsTrigger>
					<TabsTrigger value="points">Studenter som har prikker</TabsTrigger>
				</TabsList>
				<TabsContent value="all">
					<StudentsOverview />
				</TabsContent>
				<TabsContent value="points">
					<StudentsWithPointsOverview />
				</TabsContent>
			</Tabs>
		</>
	);
}
