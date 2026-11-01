"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { applicationFormSchema } from "@workspace/shared/semester/application";
import {
	APPLICATION_VENUES,
	ESCAPE_ANSWERS,
	ESCAPE_LABELS,
	EVENT_TYPE_LABELS,
	EVENT_TYPES,
	FOOD_PURCHASER_LABELS,
	FOOD_PURCHASERS,
	VENUE_LABELS,
} from "@workspace/shared/semester/labels";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { SearchSelect } from "@workspace/ui/components/search-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { Application } from "./model";

type Details = FunctionArgs<
	typeof api.semesterPlanning.applications.mutations.updateDetails
>["details"];

/** «Rediger» on a card, and the dialog that saves the changed details of the application. */
function EditDialog({
	title,
	application,
	toDetails,
	reset,
	children,
}: Readonly<{
	title: string;
	application: Application;
	toDetails: () => Details;
	/** Puts the saved values back in the form, so a cancelled edit is gone the next time. */
	reset: () => void;
	children: ReactNode;
}>) {
	const update = useMutation(api.semesterPlanning.applications.mutations.updateDetails);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	const save = async () => {
		setError(undefined);
		const details = toDetails();
		// The same rules as the Hugin form and the backend, on the application as it will be saved.
		const checked = applicationFormSchema.safeParse({ ...application, ...details, consent: true });
		if (!checked.success) return setError(checked.error.issues[0]?.message);
		setPending(true);
		try {
			await update({ applicationId: application._id, details });
			toast.success("Søknaden er lagret.");
			setOpen(false);
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke lagre søknaden."));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				setError(undefined);
			}}
		>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => {
					reset();
					setError(undefined);
					setOpen(true);
				}}
			>
				<Pencil /> Rediger
			</Button>
			<DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<form
					className="grid gap-3.5"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					{children}
					{error && <p className="text-destructive text-sm">{error}</p>}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Avbryt
						</Button>
						<Button type="submit" disabled={pending}>
							Lagre
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function Choice<T extends string>({
	id,
	label,
	value,
	options,
	labels,
	onChange,
}: Readonly<{
	id: string;
	label: string;
	value: T;
	options: readonly T[];
	labels: Record<T, string>;
	onChange: (value: T) => void;
}>) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Select value={value} onValueChange={(next) => onChange(next as T)}>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{labels[option]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

function TextField({
	id,
	label,
	value,
	onChange,
	multiline = false,
	type,
}: Readonly<{
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	type?: string;
}>) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea id={id} value={value} rows={4} onChange={(e) => onChange(e.target.value)} />
			) : (
				<Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
			)}
		</Field>
	);
}

/** «Rediger» on «Søknaden»: the event the company asked for. */
export function EditEventInfo({ application }: Readonly<{ application: Application }>) {
	const defaultValues = {
		eventType: application.eventType,
		minStudents: String(application.minStudents),
		maxStudents: String(application.maxStudents),
		venue: application.venue,
		wantsToUseEscape: application.wantsToUseEscape,
		foodAndDrinks: application.foodAndDrinks,
		foodPurchasedBy: application.foodPurchasedBy,
		targetDegrees: application.targetDegrees,
		targetStudyPrograms: application.targetStudyPrograms,
		description: application.description,
		additionalInfo: application.additionalInfo ?? "",
	};
	const form = useForm({ defaultValues });
	const toDetails = (): Details => {
		const value = form.state.values;
		return {
			...value,
			minStudents: Number(value.minStudents),
			maxStudents: Number(value.maxStudents),
			additionalInfo: value.additionalInfo.trim() || null,
		};
	};

	return (
		<EditDialog
			title="Rediger søknaden"
			application={application}
			toDetails={toDetails}
			reset={() => form.reset(defaultValues)}
		>
			<form.Field name="eventType">
				{(field) => (
					<Choice
						id="edit-event-type"
						label="Type"
						value={field.state.value}
						options={EVENT_TYPES}
						labels={EVENT_TYPE_LABELS}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="minStudents">
					{(field) => (
						<TextField
							id="edit-min-students"
							label="Minst studenter"
							type="number"
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
				<form.Field name="maxStudents">
					{(field) => (
						<TextField
							id="edit-max-students"
							label="Flest studenter"
							type="number"
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="venue">
					{(field) => (
						<Choice
							id="edit-venue"
							label="Sted"
							value={field.state.value}
							options={APPLICATION_VENUES}
							labels={VENUE_LABELS}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
				<form.Field name="wantsToUseEscape">
					{(field) => (
						<Choice
							id="edit-escape"
							label="Escape"
							value={field.state.value}
							options={ESCAPE_ANSWERS}
							labels={ESCAPE_LABELS}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
			</div>
			<div className="grid grid-cols-2 items-end gap-3">
				<form.Field name="foodAndDrinks">
					{(field) => (
						<Field orientation="horizontal">
							<Switch
								id="edit-food"
								checked={field.state.value}
								onCheckedChange={field.handleChange}
							/>
							<FieldLabel htmlFor="edit-food">Mat og drikke</FieldLabel>
						</Field>
					)}
				</form.Field>
				<form.Field name="foodPurchasedBy">
					{(field) => (
						<Choice
							id="edit-food-purchaser"
							label="Innkjøp"
							value={field.state.value}
							options={FOOD_PURCHASERS}
							labels={FOOD_PURCHASER_LABELS}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
			</div>
			<form.Field name="targetDegrees">
				{(field) => (
					<Field>
						<FieldLabel>Grader</FieldLabel>
						<SearchSelect
							multiple
							aria-label="Grader"
							className="w-full"
							placeholder="Alle"
							value={field.state.value}
							onChange={(ids) => field.handleChange(ids as typeof field.state.value)}
							items={DEGREE_TYPES.map((degree) => ({ id: degree, label: degree }))}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="targetStudyPrograms">
				{(field) => (
					<Field>
						<FieldLabel>Studieprogram</FieldLabel>
						<SearchSelect
							multiple
							aria-label="Studieprogram"
							className="w-full"
							placeholder="Alle"
							value={field.state.value}
							onChange={(ids) => field.handleChange(ids as typeof field.state.value)}
							items={STUDY_PROGRAMS.map((program) => ({ id: program, label: program }))}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<TextField
						id="edit-description"
						label="Beskrivelse"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<form.Field name="additionalInfo">
				{(field) => (
					<TextField
						id="edit-additional-info"
						label="Annet fra bedriften"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
		</EditDialog>
	);
}

/** «Rediger» on «Kontaktperson»: who gets the offer. */
export function EditContact({ application }: Readonly<{ application: Application }>) {
	const form = useForm({ defaultValues: application.contact });

	return (
		<EditDialog
			title="Rediger kontaktperson"
			application={application}
			toDetails={() => ({ contact: form.state.values })}
			reset={() => form.reset(application.contact)}
		>
			<form.Field name="name">
				{(field) => (
					<TextField
						id="edit-contact-name"
						label="Navn"
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<form.Field name="email">
				{(field) => (
					<TextField
						id="edit-contact-email"
						label="E-post"
						type="email"
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<form.Field name="phone">
				{(field) => (
					<TextField
						id="edit-contact-phone"
						label="Telefon"
						type="tel"
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
		</EditDialog>
	);
}

/** «Rediger» on «Faktura»: how the company wants the invoice. */
export function EditBilling({ application }: Readonly<{ application: Application }>) {
	const defaultValues = {
		email: application.billing.email ?? "",
		details: application.billing.details ?? "",
		ehfInvoice: application.billing.ehfInvoice ?? false,
	};
	const form = useForm({ defaultValues });
	const toDetails = (): Details => {
		const { email, details, ehfInvoice } = form.state.values;
		return {
			billing: {
				email: email.trim() || undefined,
				details: details.trim() || undefined,
				ehfInvoice,
			},
		};
	};

	return (
		<EditDialog
			title="Rediger faktura"
			application={application}
			toDetails={toDetails}
			reset={() => form.reset(defaultValues)}
		>
			<form.Field name="email">
				{(field) => (
					<TextField
						id="edit-billing-email"
						label="E-post"
						type="email"
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<form.Field name="details">
				{(field) => (
					<TextField
						id="edit-billing-details"
						label="Info"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
					/>
				)}
			</form.Field>
			<form.Field name="ehfInvoice">
				{(field) => (
					<Field orientation="horizontal">
						<Switch
							id="edit-billing-ehf"
							checked={field.state.value}
							onCheckedChange={field.handleChange}
						/>
						<FieldLabel htmlFor="edit-billing-ehf">EHF-faktura</FieldLabel>
					</Field>
				)}
			</form.Field>
		</EditDialog>
	);
}
