import { auth } from "@clerk/nextjs/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Separator } from "@workspace/ui/components//separator";
import Link from "next/link";
import SafeHtml from "@/components/common/sanitize-html";
import { fetchQuery } from "convex/nextjs";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";

export default async function ResourcePage({ params }: { params: Promise<{ slug: Id<"resources"> }> }) {
  const { orgRole } = await auth();

  const { slug: id } = await params;
  const resource = await fetchQuery(api.resources.getById, { id: id });

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/resources'>Ressurser</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{resource.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-col-reverse gap-4 md:flex-row'>
        <h1 className='flex-1 scroll-m-20 text-balance text-center font-extrabold text-4xl tracking-tight'>
          {resource.title}
        </h1>
        {(orgRole === "org:admin" || orgRole === "org:editor") && (
          <Button variant='outline' asChild className='w-fit self-end md:self-auto'>
            <Link href={`/resources/${resource._id}/edit`}>Rediger</Link>
          </Button>
        )}
      </div>
      <Separator className='my-4' />
      <SafeHtml
        className='prose dark:prose-invert mx-auto mt-8 max-w-[80ch] px-4'
        html={resource.content}
      />
    </>
  );
}
