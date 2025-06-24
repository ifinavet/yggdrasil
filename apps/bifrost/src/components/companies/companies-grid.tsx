import { getAllCompanies } from "@workspace/db/companies";
import { Button } from "@workspace/ui/components//button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components//card";
import { Pencil } from "lucide-react";
import Link from "next/link";
import SafeHtml from "@/components/common/sanitize-html";

export default async function CompaniesGrid() {
  const companies = await getAllCompanies();

  return (
    <div className='grid grid-cols-3 gap-4 max-w-7xl'>
      {companies.map((company) => (
        <Link key={company.companyId} href={`/companies/${company.companyId}`}>
          <Card>
            <CardHeader>
              <CardTitle>{company.companyName}</CardTitle>
              <CardAction>
                <Button variant='outline' size='icon'>
                  <Pencil />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {company.description && (
                <SafeHtml
                  html={company.description}
                  className='h-24 *:text-ellipsis overflow-ellipsis overflow-hidden prose dark:prose-invert'
                />
              )}
            </CardContent>
            <CardFooter>
              <p>Org. nr: {company.orgNumber ?? "N/A"}</p>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
