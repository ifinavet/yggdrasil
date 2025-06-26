import { clerkClient, currentUser, User } from "@clerk/nextjs/server";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import UpdateStudentForm from "../../../../components/students/update-student-form";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getStudentById } from "@/lib/queries/users/students";
import { Separator } from "@workspace/ui/components/separator";

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) {
    return <div>Not logged in</div>;
  }

  const clerk = await clerkClient();

  const user_id = await params.then(params => params.slug);

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['student', user_id],
    queryFn: () => getStudentById(user_id)
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

      <UpdateStudentForm user_id={user_id} />
    </HydrationBoundary>
  );
}
