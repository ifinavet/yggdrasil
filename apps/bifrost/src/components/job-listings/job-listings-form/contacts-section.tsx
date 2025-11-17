"use client";

import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import {
	createColumns,
	type JobListingContact,
} from "../job-listing-contacts-table/columns";
import { ContactsTable } from "../job-listing-contacts-table/contacts-table";

interface ContactsSectionProps {
	readonly field: {
		name: string;
		state: {
			value: JobListingFormValues["contacts"];
			meta: {
				isTouched: boolean;
				isValid: boolean;
				errors: Array<{ message?: string } | undefined>;
			};
		};
		handleChange: (value: JobListingFormValues["contacts"]) => void;
		handleBlur: () => void;
	};
}

export default function ContactsSection({
	field,
}: Readonly<ContactsSectionProps>) {
	const [contactName, setContactName] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [contactPhone, setContactPhone] = useState("");

	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	const contactsData: JobListingContact[] = useMemo(
		() =>
			field.state.value.map((contact) => ({
				name: contact.name,
				email: contact.email || "",
				phone: contact.phone || "",
			})),
		[field.state.value],
	);

	const addContact = () => {
		if (!contactName.trim()) {
			toast.error("Navn på kontaktpersonen er påkrevd");
			return;
		}

		if (!contactEmail.trim() && !contactPhone.trim()) {
			toast.error(
				"Enten e-post eller telefon til kontaktpersonen må fylles ut",
			);
			return;
		}

		const newContact = {
			name: contactName,
			email: contactEmail,
			phone: contactPhone,
		};

		field.handleChange([...field.state.value, newContact]);

		// Reset form fields
		setContactName("");
		setContactEmail("");
		setContactPhone("");
	};

	const deleteContact = useCallback(
		(index: number) => {
			const updatedContacts = field.state.value.filter((_, i) => i !== index);
			field.handleChange(updatedContacts);
		},
		[field],
	);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addContact();
		}
	};

	const columns = useMemo(() => createColumns(deleteContact), [deleteContact]);

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name}>Kontakter</FieldLabel>
			<div className="flex flex-col gap-4">
				<div className="flex gap-4">
					<Input
						placeholder="eks. Ole Hansen"
						value={contactName}
						onChange={(e) => setContactName(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<Input
						type="email"
						placeholder="eks. ole@hansen.no"
						value={contactEmail}
						onChange={(e) => setContactEmail(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<Input
						type="tel"
						placeholder="eks. +47 123 456 789"
						value={contactPhone}
						onChange={(e) => setContactPhone(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<Button type="button" onClick={addContact}>
						Legg til
					</Button>
				</div>
				<ContactsTable columns={columns} data={contactsData} />
			</div>
			<FieldDescription>
				Dette er en liste over kontakter for stillingsannonsen.
			</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
