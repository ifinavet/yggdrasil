import { Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import getCompanies from "@/lib/queries/bifrost/company/getCompanies";

export default async function CompaniesGrid() {
  const companies = await getCompanies();

  return (
    <div className="grid grid-cols-3 gap-4">
      {companies.map((company) => (
        <Card key={company.company_id}>
          <CardHeader>
            <CardTitle>{company.company_name}</CardTitle>
            <CardAction>
              <Button variant="outline" size="icon" asChild>
                <Link href={`/bifrost/companies/${company.company_id}`}>
                  <Pencil />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div
              className="h-24 *:text-ellipsis overflow-ellipsis overflow-hidden prose dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: company.description }}
            />
          </CardContent>
          <CardFooter>
            <p>Org. nr: {company.org_number ?? "N/A"}</p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
