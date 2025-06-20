import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import getResource from "@/lib/queries/bifrost/resource/getResource";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function ResourcePage({
  params,
}: {
  params: { slug: number };
}) {
  const { orgRole } = await auth();
  const resource = await getResource(params.slug);

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost">Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost/resources">Ressurser</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{resource.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col-reverse gap-4 md:flex-row">
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance">
          {resource.title}
        </h1>
        {(orgRole === "org:admin" || orgRole === "org:editor") && (
          <Button
            variant="outline"
            asChild
            className="w-fit self-end md:self-auto"
          >
            <Link href={`/bifrost/resources/${resource.resource_id}/edit`}>
              Rediger
            </Link>
          </Button>
        )}
      </div>
      <Separator className="my-4" />
      <div
        className="prose dark:prose-invert mx-auto mt-8 px-4 max-w-[80ch]"
        dangerouslySetInnerHTML={{ __html: resource.content }}
      />
    </>
  );
}
