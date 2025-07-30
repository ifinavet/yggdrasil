"use client";

import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components//button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components//card";
import { usePaginatedQuery } from "convex/react";
import { Pencil } from "lucide-react";
import Link from "next/link";
import SafeHtml from "@/components/common/sanitize-html";

export default function CompaniesGrid() {
  const { results: companies, isLoading, status, loadMore } = usePaginatedQuery(
    api.companies.getAllPaged,
    {},
    {
      initialNumItems: 25,
    },
  );

  return (
    <div className="space-y-6">
      <div className='grid max-w-7xl grid-cols-3 gap-4'>
        {companies.map((company) => (
          <Link key={company._id} href={`/companies/${company._id}`}>
            <Card>
              <CardHeader>
                <CardTitle>{company.name}</CardTitle>
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
                    className='prose dark:prose-invert h-24 overflow-hidden overflow-ellipsis *:text-ellipsis'
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

      <Button onClick={() => loadMore(25)} disabled={status !== "CanLoadMore" || isLoading}>{!isLoading ? "Last inn flere bedrifter" : "Laster..."}</Button>
    </div>
  );
}
