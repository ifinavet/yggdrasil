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
import getCompanies from "@/lib/queries/company/getCompanies";

export default async function CompaniesGrid() {
  const companies = await getCompanies();

  return (
    <div className='grid grid-cols-3 gap-4'>
      {companies.map((company) => (
        <Card key={company.company_id}>
          <CardHeader>
            <CardTitle>{company.company_name}</CardTitle>
            <CardAction>
              <Button variant='outline' size='icon' asChild>
                <Link href={`/companies/${company.company_id}`}>
                  <Pencil />
                </Link>
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
      ))}
    </div>
  );
}
