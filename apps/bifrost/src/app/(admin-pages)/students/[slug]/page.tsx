import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import StudentPoints from "@/components/students/student-points";
import StudentPointsForm from "@/components/students/student-points-form";
import { getStudentById } from "@/lib/queries/users/students";
import UpdateStudentForm from "../../../../components/students/update-student-form";

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
	const user_id = await params.then((params) => params.slug);

	const queryClient = new QueryClient();

	await queryClient.prefetchQuery({
		queryKey: ["student", user_id],
		queryFn: () => getStudentById(user_id),
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
						<BreadcrumbLink href='/students'>Studenter</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Administer student</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>Administer student</h3>

			<UpdateStudentForm user_id={user_id} />

			<p className='text-muted-foreground text-sm'>
				NB! Dersom du trenger å låse opp studenten, eller endre noen andre ting som ikke er her gå
				til clerk dashboardet.
			</p>

			<h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>Prikker</h3>
			<div className='flex flex-col'>
				<Dialog>
					<DialogTrigger asChild>
						<Button className='self-end' variant='outline'>
							Gi prikk(er)
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Fyll ut infromasjonen for å gi studenten prikker</DialogTitle>
							<DialogDescription>
								Prikker skal kun gis manuelt dersom det har skjedd noe alvorlig eller ekstra
								ordinært hvor det å gi prikk er riktig staff. Under normale forhold så skal prikkene
								som gis automatisk være tilstrekelig.
							</DialogDescription>
						</DialogHeader>
						<StudentPointsForm user_id={user_id} />
					</DialogContent>
				</Dialog>

				<StudentPoints user_id={user_id} />
			</div>
		</HydrationBoundary>
	);
}
