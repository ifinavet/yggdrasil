"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import type { OrganizerRole } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useQuery } from "convex/react";
import { useId, useMemo, useState } from "react";
import InternalMemberSelect from "@/components/common/forms/internal-member-select";
import { createColumns } from "./columns";
import OrganizersTable from "./data-table";

type OrganizerField = {
	name: string;
	state: {
		value: Array<{
			userId: Id<"users">;
			role: OrganizerRole;
		}>;
		meta: {
			isTouched: boolean;
			isValid: boolean;
			errors: Array<{ message?: string } | undefined>;
		};
	};
	handleChange: (
		value: Array<{
			userId: Id<"users">;
			role: OrganizerRole;
		}>,
	) => void;
	handleBlur: () => void;
};

export default function Organizers({
	field,
}: Readonly<{
	field: OrganizerField;
}>) {
	const internalMembers = useQuery(api.users.organization.queries.getAll);

	const labelId = useId();
	const [pendingMemberId, setPendingMemberId] = useState<Id<"users"> | null>(null);

	const [selectedOrganizerType, setSelectedOrganizerType] = useState<OrganizerRole>("medhjelper");

	const selectedOrganizers = useMemo(() => {
		if (!internalMembers) return [];

		return field.state.value.map((organizer) => ({
			id: organizer.userId,
			name:
				internalMembers.find((member) => member.userId === organizer.userId)?.fullName || "Ukjent",
			role: organizer.role,
		}));
	}, [internalMembers, field.state.value]);

	if (!internalMembers) return <div>Loading members...</div>;

	const handleRoleChange = (userId: Id<"users">, newRole: OrganizerRole) => {
		const currentOrganizers = field.state.value;
		const updatedOrganizers = currentOrganizers.map((organizer) =>
			organizer.userId === userId ? { ...organizer, role: newRole } : organizer,
		);
		field.handleChange(updatedOrganizers);
	};

	const handleDeleteOrganizer = (organizerId: string) => {
		const currentOrganizers = field.state.value;
		const updatedOrganizers = currentOrganizers.filter(
			(organizer) => organizer.userId !== organizerId,
		);
		field.handleChange(updatedOrganizers);
	};

	const columns = createColumns(handleRoleChange, handleDeleteOrganizer);

	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field className="flex flex-col">
			<FieldLabel id={labelId}>Ansvarlige</FieldLabel>
			<div className="flex flex-col gap-4">
				<div className="flex gap-4">
					<InternalMemberSelect
						labelId={labelId}
						value={pendingMemberId}
						onChange={setPendingMemberId}
					/>
					<Select
						onValueChange={(value: string) => {
							setSelectedOrganizerType(value as OrganizerRole);
						}}
						value={selectedOrganizerType}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Ansvarlig type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="medhjelper">Medhjelper</SelectItem>
							<SelectItem value="hovedansvarlig">Hovedansvarlig</SelectItem>
						</SelectContent>
					</Select>
					<Button
						type="button"
						onClick={() => {
							if (!pendingMemberId) return;

							const isAlreadyAdded = field.state.value.some(
								(organizer) => organizer.userId === pendingMemberId,
							);
							if (!isAlreadyAdded) {
								field.handleChange([
									...field.state.value,
									{ userId: pendingMemberId, role: selectedOrganizerType },
								]);
							}

							setPendingMemberId(null);
							setSelectedOrganizerType("medhjelper");
						}}
					>
						Legg til ansvarlig
					</Button>
				</div>
				<OrganizersTable columns={columns} data={selectedOrganizers} />
			</div>
			<FieldDescription>
				Velg hvem som er ansvarlig for og skal organisere/planlegge arrangementet.
			</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
