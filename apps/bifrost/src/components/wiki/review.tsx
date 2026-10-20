"use client";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage, WikiLoading, wikiDate } from "./shared";
export function WikiReview() {
	const [status, setStatus] = useState<"published" | "draft" | "retired">("published");
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(timer);
	}, []);
	const articles = usePaginatedQuery(
		api.wiki.queries.reviewQueue,
		{ status, now },
		{ initialNumItems: 20 },
	);
	const reports = usePaginatedQuery(api.wiki.queries.reports, {}, { initialNumItems: 10 });
	const resolve = useMutation(api.wiki.mutations.resolveReport);
	const [busy, setBusy] = useState(false);
	const pending = articles.results.filter(
		(article) => status !== "published" || article.reasons.length || article.hasDraft,
	);
	return (
		<>
			<div>
				<h1 className="font-semibold text-3xl">Hold håndboken oppdatert</h1>
				<p className="mt-3 max-w-3xl text-muted-foreground leading-relaxed">
					Kontroller rutiner når funksjonene endres, og følg opp feil som blir meldt inn.
					Publisering og kontroll er separate handlinger. Levende fakta endrer ikke
					kontrolltidspunktet.
				</p>
			</div>
			<section>
				<h2 className="mb-4 font-semibold text-xl">Innmeldte feil</h2>
				{reports.status === "LoadingFirstPage" ? (
					<WikiLoading />
				) : reports.results.length === 0 ? (
					<p className="text-muted-foreground text-sm">Ingen åpne feilmeldinger.</p>
				) : (
					<div className="space-y-3">
						{reports.results.map((report) => (
							<article key={report._id} className="rounded-lg border p-5">
								<Link href={`/wiki/${report.slug}`} className="font-semibold underline">
									{report.title}
								</Link>
								<p className="mt-1 text-muted-foreground text-xs">
									Versjon {report.revision}, meldt {wikiDate(report._creationTime)}
								</p>
								<p className="my-4 whitespace-pre-wrap text-sm">{report.message}</p>
								<Button
									variant="outline"
									size="sm"
									disabled={busy}
									onClick={async () => {
										setBusy(true);
										try {
											await resolve({ reportId: report._id });
											toast.success("Feilmeldingen er lukket");
										} catch (error) {
											toast.error(errorMessage(error));
										} finally {
											setBusy(false);
										}
									}}
								>
									Marker som løst
								</Button>
							</article>
						))}
					</div>
				)}
				{reports.status === "CanLoadMore" && (
					<Button className="mt-3" variant="outline" onClick={() => reports.loadMore(10)}>
						Vis flere feilmeldinger
					</Button>
				)}
			</section>
			<section>
				<fieldset className="mb-5 flex flex-wrap gap-2" aria-label="Artikkelstatus">
					{(
						[
							["published", "Trenger gjennomgang"],
							["draft", "Utkast"],
							["retired", "Tatt ut av bruk"],
						] as const
					).map(([value, label]) => (
						<Button
							key={value}
							aria-pressed={status === value}
							variant={status === value ? "secondary" : "outline"}
							onClick={() => setStatus(value)}
						>
							{label}
						</Button>
					))}
				</fieldset>
				{articles.status === "LoadingFirstPage" ? (
					<WikiLoading />
				) : (
					<div className="space-y-3">
						{pending.map((article) => (
							<article
								key={article._id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5"
							>
								<div>
									<Link href={`/wiki/${article.slug}`} className="font-semibold hover:underline">
										{article.title}
									</Link>
									<p className="mt-1 text-muted-foreground text-sm">{article.owner}</p>
									<p className="mt-2 text-amber-700 text-xs dark:text-amber-300">
										{[...article.reasons, ...(article.hasDraft ? ["Har et utkast"] : [])].join(
											", ",
										)}
									</p>
								</div>
								<Button variant="outline" size="sm" asChild>
									<Link
										href={
											status === "retired" ? `/wiki/${article.slug}` : `/wiki/${article.slug}/edit`
										}
									>
										{status === "retired" ? "Vis historikk" : "Åpne"}
									</Link>
								</Button>
							</article>
						))}
						{pending.length === 0 && (
							<p className="text-muted-foreground text-sm">
								Ingen artikler i denne delen av oversikten.
							</p>
						)}
					</div>
				)}
				{articles.status === "CanLoadMore" && (
					<Button variant="outline" className="mt-4" onClick={() => articles.loadMore(20)}>
						Undersøk flere artikler
					</Button>
				)}
			</section>
		</>
	);
}
