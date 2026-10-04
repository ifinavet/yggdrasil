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
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { SearchField } from "@workspace/ui/components/search-field";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { matchesAny } from "@/lib/search";

export default function CompaniesGrid() {
	const [search, setSearch] = useState("");
	const {
		results: companies,
		isLoading,
		status,
		loadMore,
	} = usePaginatedQuery(
		api.companies.queries.getAllPaged,
		{},
		{
			initialNumItems: 25,
		},
	);
	const matchingSource = useQuery(
		api.companies.queries.getAllWithLogoUrl,
		search.trim() ? {} : "skip",
	);
	const source = search.trim() ? (matchingSource ?? []) : companies;
	const visibleCompanies = useMemo(
		() => source.filter((company) => matchesAny([company.name, String(company.orgNumber)], search)),
		[source, search],
	);

	return (
		<div className="space-y-6">
			<SearchField
				value={search}
				onChange={setSearch}
				placeholder="Bedrift eller org. nr."
				className="sm:w-96"
			/>
			<div className="grid max-w-7xl grid-cols-3 gap-4">
				{visibleCompanies.map((company) => (
					<Link key={company._id} href={`/companies/${company._id}`}>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-3">
									<CompanyLogo name={company.name} url={company.logoUrl} size="lg" />
									{company.name}
								</CardTitle>
								<CardAction>
									<Button variant="outline" size="icon">
										<Pencil />
									</Button>
								</CardAction>
							</CardHeader>
							<CardContent className="line-clamp-3 h-24">
								{company.description && (
									<SafeHtml
										html={company.description}
										className="prose dark:prose-invert overflow-clip"
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

			{search.trim() && matchingSource && visibleCompanies.length === 0 ? (
				<p className="text-muted-foreground">Ingen bedrifter samsvarer med søket.</p>
			) : null}
			{!search.trim() && status === "CanLoadMore" ? (
				<Button onClick={() => loadMore(25)} disabled={isLoading}>
					{isLoading ? "Laster..." : "Last inn flere bedrifter"}
				</Button>
			) : null}
		</div>
	);
}
