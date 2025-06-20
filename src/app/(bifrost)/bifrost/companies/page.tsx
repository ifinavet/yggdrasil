import { auth } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import CompaniesGrid from "./companies-grid";

export default async function Companies() {
  const { orgRole } = await auth();

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost">Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bedrifter</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {orgRole === "org:admin" && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/bifrost/companies/create-company">
              <Plus className="size-4" /> Legg til en ny bedrift
            </Link>
          </Button>
        </div>
      )}

      <CompaniesGrid />
    </div>
  );
}
