"use client";

import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Filter } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

function ResponsiveFilter({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<>
			<div className="hidden h-fit w-fit space-y-6 rounded-lg border px-4 py-6 shadow-xs md:inline-block">
				{children}
			</div>
			<div className="mx-6 inline-block w-fit md:hidden">
				<Sheet>
					<SheetTrigger asChild>
						<Button size="lg">
							Filter <Filter />
						</Button>
					</SheetTrigger>
					<SheetContent className="z-50">
						<SheetHeader>
							<SheetTitle>Filtrer stillingsannonsene</SheetTitle>
							{children}
						</SheetHeader>
					</SheetContent>
				</Sheet>
			</div>
		</>
	);
}

export default function FilterJobListings({
	companies,
}: Readonly<{
	companies: { id: Id<"companies">; name: string }[];
}>) {
	const router = useRouter();
	const path = usePathname();
	const searchParams = useSearchParams();

	const listingTypes = ["Fulltid", "Deltid", "Internship", "Sommerjobb"] as const;

	const setQueryParams = useCallback(
		(updates: Record<string, string | undefined>) => {
			const params = new URLSearchParams(searchParams);
			for (const [key, value] of Object.entries(updates)) {
				if (!value) {
					params.delete(key);
				} else {
					params.set(key, value);
				}
			}
			const qs = params.toString();
			router.push(qs ? `${path}?${qs}` : path);
		},
		[router, path, searchParams],
	);

	const currentSort = searchParams.get("sort") ?? "";
	const currentListingType = searchParams.get("listingType") ?? "";
	const currentCompany = searchParams.get("company") ?? "";

	const listingTypeKey = `listingType-${currentListingType || "none"}`;
	const companyKey = `company-${currentCompany || "none"}`;

	return (
		<ResponsiveFilter>
			<div className="space-y-2">
				<Select value={currentSort || undefined} onValueChange={(v) => setQueryParams({ sort: v })}>
					<SelectTrigger className="w-[220px]">
						<SelectValue placeholder="Sorter etter..." />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="title">Tittel</SelectItem>
						<SelectItem value="deadline_desc">Søknadsfrist (synkende)</SelectItem>
						<SelectItem value="deadline_asc">Søknadsfrist (stigende)</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<p className="text-muted-foreground text-sm">Stillings type</p>
				<RadioGroup
					key={listingTypeKey}
					{...(currentListingType ? { value: currentListingType } : {})}
					onValueChange={(v) => setQueryParams({ listingType: v })}
				>
					{listingTypes.map((listingType) => (
						<div className="flex items-center space-x-2" key={listingType}>
							<RadioGroupItem value={listingType} id={`lt-${listingType}`} />
							<Label htmlFor={`lt-${listingType}`}>{listingType}</Label>
						</div>
					))}
				</RadioGroup>
			</div>

			<div className="space-y-2">
				<p className="text-muted-foreground text-sm">Utlysende bedrift</p>
				<RadioGroup
					key={companyKey}
					{...(currentCompany ? { value: currentCompany } : {})}
					onValueChange={(v: string) => setQueryParams({ company: v })}
				>
					{companies.map((c) => (
						<div className="flex items-center space-x-2" key={c.id}>
							<RadioGroupItem value={c.id} id={`comp-${c.id}`} />
							<Label htmlFor={`comp-${c.id}`}>{c.name}</Label>
						</div>
					))}
				</RadioGroup>
			</div>

			<div className="pt-2">
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					disabled={!currentSort && !currentListingType && !currentCompany}
					asChild
				>
					<Link href={"/job-listings"}>Nullstill filter</Link>
				</Button>
			</div>
		</ResponsiveFilter>
	);
}
