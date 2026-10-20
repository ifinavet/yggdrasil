"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, WikiLoading, wikiDate } from "./shared";

const DIALOG_COPY = {
	history: {
		title: "Versjonshistorikk",
		description:
			"Tidligere versjoner er historikk og kan inneholde utdaterte instrukser. Gjenoppretting lager et utkast.",
		submit: "",
	},
	report: {
		title: "Meld fra om feil",
		description: "Beskriv hva som er feil eller mangler. Meldingen vises i Oppfølging.",
		submit: "Send feilmelding",
	},
	retire: {
		title: "Ta artikkelen ut av bruk",
		description: "Artikkelen fjernes fra vanlig søk. Adressen og historikken bevares.",
		submit: "Ta ut av bruk",
	},
};
export function ArticleDialog({
	dialog,
	resourceId,
	editVersion,
	slug,
	onClose,
}: Readonly<{
	dialog: keyof typeof DIALOG_COPY;
	resourceId: Id<"resources">;
	editVersion: number;
	slug: string;
	onClose: () => void;
}>) {
	const report = useMutation(api.wiki.mutations.report);
	const retire = useMutation(api.wiki.mutations.retire);
	const [message, setMessage] = useState("");
	const [replacement, setReplacement] = useState("");
	const [busy, setBusy] = useState(false);
	const copy = DIALOG_COPY[dialog];
	const run = async (action: () => Promise<unknown>, success: string) => {
		setBusy(true);
		try {
			await action();
			toast.success(success);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				className={
					dialog === "history" ? "max-h-[85vh] overflow-y-auto sm:max-w-4xl" : "sm:max-w-lg"
				}
			>
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>
				{dialog === "history" ? (
					<WikiHistory
						resourceId={resourceId}
						editVersion={editVersion}
						slug={slug}
						onRestored={() => onClose()}
					/>
				) : (
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							void run(
								async () => {
									if (dialog === "report") await report({ resourceId: resourceId, message });
									else
										await retire({
											resourceId: resourceId,
											expectedVersion: editVersion,
											note: message,
											replacementSlug: replacement.trim() || undefined,
										});
									onClose();
								},
								dialog === "report" ? "Feilen er meldt inn" : "Artikkelen er tatt ut av bruk",
							);
						}}
					>
						<label htmlFor="wiki-report-message" className="block space-y-2 text-sm">
							<span>
								{dialog === "report" ? "Hva bør rettes?" : "Hvorfor tas artikkelen ut av bruk?"}
							</span>
							<Textarea
								id="wiki-report-message"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								required
								minLength={5}
								maxLength={dialog === "report" ? 2000 : 1000}
								rows={5}
							/>
						</label>
						{dialog === "retire" && (
							<label htmlFor="wiki-replacement" className="block space-y-2 text-sm">
								<span>Adresse til erstatningsartikkel (valgfritt)</span>
								<Input
									id="wiki-replacement"
									value={replacement}
									onChange={(event) => setReplacement(event.target.value)}
									placeholder="for-eksempel-holde-bedpress"
								/>
								<span className="text-muted-foreground text-xs">Skriv delen etter /wiki/.</span>
							</label>
						)}
						<Button disabled={busy} type="submit">
							{busy ? "Lagrer…" : copy.submit}
						</Button>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
function WikiHistory({
	resourceId,
	editVersion,
	slug,
	onRestored,
}: Readonly<{
	resourceId: Id<"resources">;
	editVersion: number;
	slug: string;
	onRestored: () => void;
}>) {
	const { results, status, loadMore } = usePaginatedQuery(
		api.wiki.queries.history,
		{ resourceId },
		{ initialNumItems: 5 },
	);
	const restore = useMutation(api.wiki.mutations.restore);
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	return (
		<div className="space-y-3">
			{status === "LoadingFirstPage" && <WikiLoading />}
			{results.map((revision) => (
				<details key={revision._id} className="rounded-lg border p-4">
					<summary className="cursor-pointer text-sm">
						Versjon {revision.number}: {revision.action}, {wikiDate(revision.createdAt)}
					</summary>
					<h3 className="mt-4 font-semibold">{revision.article.title}</h3>
					<SafeHtml
						html={revision.article.content}
						className="prose prose-sm dark:prose-invert my-4 max-w-none"
					/>
					<Button
						variant="outline"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							try {
								await restore({ revisionId: revision._id, expectedVersion: editVersion });
								toast.success("Versjonen er gjenopprettet som utkast");
								onRestored();
								router.push(`/wiki/${slug}/edit`);
							} catch (error) {
								toast.error(errorMessage(error));
							} finally {
								setBusy(false);
							}
						}}
					>
						Gjenopprett som utkast
					</Button>
				</details>
			))}
			{status === "CanLoadMore" && (
				<Button variant="outline" onClick={() => loadMore(5)}>
					Vis eldre versjoner
				</Button>
			)}
		</div>
	);
}
