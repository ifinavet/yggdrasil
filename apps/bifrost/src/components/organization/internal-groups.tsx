"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

type Group = Doc<"internalGroups">;

export function InternalGroups() {
	const groups = useQuery(api.users.organization.groups.list, {});
	const saveGroup = useMutation(api.users.organization.groups.save);
	const removeGroup = useMutation(api.users.organization.groups.remove);
	const [removing, setRemoving] = useState<Group | null>(null);
	const [editing, setEditing] = useState<Group | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const { pending: busy, error, run, clearError } = useAsyncAction();

	function open(group?: Group) {
		setEditing(group ?? null);
		setName(group?.name ?? "");
		setDescription(group?.description ?? "");
		clearError();
		setDialogOpen(true);
	}

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		return run(
			async () => {
				await saveGroup({
					groupId: editing?._id,
					name,
					description,
					leader: editing?.leader ?? null,
				});
				setDialogOpen(false);
			},
			undefined,
			"Kunne ikke lagre arbeidsgruppen.",
		);
	}

	return (
		<section className="grid gap-4" aria-labelledby="internal-groups-heading">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 id="internal-groups-heading" className="font-semibold text-2xl tracking-tight">
						Arbeidsgrupper
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">Gruppene vises i opptakssøknaden.</p>
				</div>
				<Button onClick={() => open()}>
					<Plus aria-hidden />
					Legg til arbeidsgruppe
				</Button>
			</div>
			{groups === undefined && <output>Laster arbeidsgrupper…</output>}
			{groups !== undefined && groups.length > 0 && (
				<ul className="grid gap-3 sm:grid-cols-2">
					{groups.map((group) => (
						<li
							key={group._id}
							className="flex items-start justify-between gap-4 rounded-lg border p-4"
						>
							<div className="min-w-0">
								<h3 className="font-medium">{group.name}</h3>
								{group.description && (
									<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm">
										{group.description}
									</p>
								)}
							</div>
							<div className="flex shrink-0 gap-2">
								<Button
									variant="outline"
									size="icon"
									aria-label={`Rediger ${group.name}`}
									onClick={() => open(group)}
								>
									<Pencil aria-hidden />
								</Button>
								<Button
									variant="outline"
									size="icon"
									aria-label={`Slett ${group.name}`}
									onClick={() => {
										clearError();
										setRemoving(group);
									}}
								>
									<Trash2 aria-hidden />
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
			{groups?.length === 0 && (
				<p className="text-muted-foreground text-sm">Ingen arbeidsgrupper er lagt til ennå.</p>
			)}
			<ConfirmDialog
				open={Boolean(removing)}
				onOpenChange={(open) => {
					if (!open) setRemoving(null);
				}}
				title={`Slette ${removing?.name}?`}
				description="En arbeidsgruppe som brukes av medlemmer eller søkere kan ikke slettes."
				confirmLabel="Slett arbeidsgruppe"
				destructive
				error={error}
				onConfirm={() =>
					removing
						? run(
								() => removeGroup({ groupId: removing._id }),
								undefined,
								"Kunne ikke slette arbeidsgruppen.",
							)
						: Promise.resolve(false)
				}
			/>
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) setEditing(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editing ? "Rediger arbeidsgruppe" : "Legg til arbeidsgruppe"}
						</DialogTitle>
					</DialogHeader>
					<form className="grid gap-4" onSubmit={(event) => void save(event)}>
						<div className="grid gap-2">
							<Label htmlFor="internal-group-name">Navn</Label>
							<Input
								id="internal-group-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={100}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="internal-group-description">Beskrivelse</Label>
							<Textarea
								id="internal-group-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								maxLength={2000}
							/>
						</div>
						{error && (
							<p role="alert" className="text-destructive text-sm">
								{error}
							</p>
						)}
						<Button type="submit" disabled={busy}>
							{editing ? "Lagre endringer" : "Opprett arbeidsgruppe"}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</section>
	);
}
