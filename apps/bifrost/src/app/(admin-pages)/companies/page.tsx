import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Plus } from "lucide-react";
import Link from "next/link";
import CompaniesGrid from "@/components/companies/companies-grid";

export default async function Companies() {

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bedrifter</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex justify-end'>
        <Button asChild>
          <Link href='/companies/create-company'>
            <Plus className='size-4' /> Legg til en ny bedrift
          </Link>
        </Button>
      </div>

      <CompaniesGrid />
    </div>
  );
}
