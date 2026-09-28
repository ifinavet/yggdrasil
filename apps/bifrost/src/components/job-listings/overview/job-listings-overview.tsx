"use client";

import { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { Fold } from "@workspace/ui/components/fold";
import { SearchField } from "@workspace/ui/components/search-field";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { PendingOrdersAlert } from "@/components/job-listing-orders/pending-orders-alert";
import { searchFolds } from "@/lib/search";
import { JobTypeLabel } from "../job-type-label";
import {
	deadlineIsSoon,
	type OverviewListing,
	publicListingUrl,
	splitIntoSections,
} from "./sections";

function PublishToggle({ listing }: Readonly<{ listing: OverviewListing }>) {
	const setPublished = useMutation(api.jobListings.mutations.setPublished);
	const [pending, setPending] = useState(false);

	const toggle = async () => {
		setPending(true);
		try {
			await setPublished({ id: listing._id, published: !listing.published });
		} catch (error) {
			toast.error(convexErrorMessage(error));
		} finally {
			setPending(false);
		}
	};

	return (
		<Button
			size="sm"
			variant={listing.published ? "outline" : "default"}
			disabled={pending}
			onClick={toggle}
		>
			{listing.published ? "Avpubliser" : "Publiser"}
		</Button>
	);
}

function ListingRow({
	listing,
	now,
	archived,
}: Readonly<{ listing: OverviewListing; now: number; archived: boolean }>) {
	const soon = !archived && listing.published && deadlineIsSoon(listing, now);

	return (
		<TableRow className="relative">
			<TableCell className={LIST_CELL}>
				<div className="flex min-w-0 items-center gap-3">
					<CompanyLogo name={listing.companyName} url={listing.companyLogo} />
					<div>
						<Link
							href={`/job-listings/${listing._id}`}
							className="block font-medium after:absolute after:inset-0"
						>
							{listing.title}
						</Link>
						<span className="block text-muted-foreground text-xs">{listing.companyName}</span>
					</div>
				</div>
			</TableCell>
			<TableCell className={cn(LIST_CELL, "hidden sm:table-cell")}>
				<span className="inline-flex items-center gap-2">
					<JobTypeLabel type={listing.type} />
				</span>
			</TableCell>
			<TableCell
				className={cn(
					LIST_CELL,
					"whitespace-nowrap tabular-nums",
					soon && "font-medium text-attention",
				)}
			>
				{formatOsloDate(listing.deadline, DATE_PATTERNS.shortDateWithYear)}
			</TableCell>
			{archived ? null : (
				<TableCell className={LIST_CELL}>
					<div className="relative z-10 flex justify-end gap-2">
						{listing.published ? (
							<Button asChild size="sm" variant="ghost">
								<a href={publicListingUrl(listing)} target="_blank" rel="noreferrer">
									Vis på nettsiden
								</a>
							</Button>
						) : null}
						<PublishToggle listing={listing} />
					</div>
				</TableCell>
			)}
		</TableRow>
	);
}

function GroupRow({ label, count }: Readonly<{ label: string; count: number }>) {
	return (
		<TableRow className="bg-sidebar hover:bg-sidebar">
			<TableCell colSpan={4} className="px-3 py-1.5 font-semibold text-muted-foreground text-xs">
				{label}, {count}
			</TableCell>
		</TableRow>
	);
}

function ListingsTable({
	groups,
	now,
	archived,
}: Readonly<{
	groups: { label?: string; listings: OverviewListing[] }[];
	now: number;
	archived: boolean;
}>) {
	return (
		<Table>
			{archived ? null : (
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className={LIST_HEAD}>Stilling</TableHead>
						<TableHead className={cn(LIST_HEAD, "hidden sm:table-cell")}>Type</TableHead>
						<TableHead className={LIST_HEAD}>Frist</TableHead>
						<TableHead className={LIST_HEAD} />
					</TableRow>
				</TableHeader>
			)}
			<TableBody className="text-sm">
				{groups.map((group) => (
					<Fragment key={group.label ?? "all"}>
						{group.label ? <GroupRow label={group.label} count={group.listings.length} /> : null}
						{group.listings.map((listing) => (
							<ListingRow key={listing._id} listing={listing} now={now} archived={archived} />
						))}
					</Fragment>
				))}
			</TableBody>
		</Table>
	);
}

export function JobListingsOverview({
	preloadedListings,
	now,
}: Readonly<{
	preloadedListings: Preloaded<typeof api.jobListings.queries.getAll>;
	now: number;
}>) {
	const listings = usePreloadedQuery(preloadedListings);
	const [search, setSearch] = useState("");

	const { unpublished, published, expired } = useMemo(
		() => splitIntoSections(listings, now, search),
		[listings, now, search],
	);
	const folds = searchFolds(search);
	const activeGroups = [
		{ label: "Upubliserte", listings: unpublished },
		{ label: "Publiserte", listings: published },
	].filter((group) => group.listings.length > 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="font-semibold text-2xl tracking-[-0.015em]">Stillingsannonser</h2>
				<span className="flex-1" />
				<SearchField
					value={search}
					onChange={setSearch}
					placeholder="Tittel, bedrift eller type"
					className="sm:w-96"
				/>
				<Button asChild>
					<Link href="/job-listings/new-listing">
						<Plus className="size-4" /> Opprett en ny stillingsannonse
					</Link>
				</Button>
			</div>

			<PendingOrdersAlert />

			{activeGroups.length > 0 ? (
				<div className="overflow-hidden rounded-lg border bg-card">
					<ListingsTable groups={activeGroups} now={now} archived={false} />
				</div>
			) : null}

			{expired.length > 0 ? (
				<Fold key={folds.key} title={`Utløpte, ${expired.length}`} open={folds.open}>
					<ListingsTable groups={[{ listings: expired }]} now={now} archived />
				</Fold>
			) : null}
		</div>
	);
}
