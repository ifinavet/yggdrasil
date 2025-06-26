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
import { getAllCompanies } from "@/lib/queries/companies";

export default async function CompaniesGrid() {
  const companies = await getAllCompanies();

  return (
    <div className='grid grid-cols-3 gap-4 max-w-7xl'>
      {companies.map((company) => (
        <Link key={company.company_id} href={`/companies/${company.company_id}`}>
          <Card>
            <CardHeader>
              <CardTitle>{company.company_name}</CardTitle>
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
              <p>Org. nr: {company.org_number ?? "N/A"}</p>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
