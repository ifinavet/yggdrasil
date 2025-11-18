"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import type { ORGANIZER_ROLE } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@workspace/ui/components/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createColumns } from "./columns";
import OrganizersTable from "./data-table";

type OrganizerField = {
	name: string;
	state: {
		value: Array<{
			userId: Id<"users">;
			role: ORGANIZER_ROLE;
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
			role: ORGANIZER_ROLE;
		}>,
	) => void;
	handleBlur: () => void;
};

export default function Organizers({
	field,
}: Readonly<{
	field: OrganizerField;
}>) {
	const internalMembers = useQuery(api.internals.getAll);

	const [openMembers, setOpenMembers] = useState(false);
	const selectedMember = useRef("");

	const [selectedOrganizerType, setSelectedOrganizerType] =
		useState<ORGANIZER_ROLE>("medhjelper");

	const selectedOrganizers = useMemo(() => {
		if (!internalMembers) return [];

		return field.state.value.map((organizer) => ({
			id: organizer.userId,
			name:
				internalMembers.find((member) => member.userId === organizer.userId)
					?.fullName || "Ukjent",
			role: organizer.role,
		}));
	}, [internalMembers, field.state.value]);

	if (!internalMembers) return <div>Loading members...</div>;

	const handleRoleChange = (userId: Id<"users">, newRole: ORGANIZER_ROLE) => {
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
			<FieldLabel>Ansvarlige</FieldLabel>
			<div className="flex flex-col gap-4">
				<div className="flex gap-4">
					<Popover open={openMembers} onOpenChange={setOpenMembers}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								aria-expanded={openMembers}
								className="w-[200px] justify-between"
							>
								{selectedMember.current
									? internalMembers.find(
											(internalMember) =>
												internalMember.fullName === selectedMember.current,
										)?.fullName
									: "Velg et medlem..."}
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[200px] p-0">
							<Command>
								<CommandInput placeholder="Søk etter en ansvarlig..." />
								<CommandList>
									<CommandEmpty>Fant ingen ansvarlige(er).</CommandEmpty>
									<CommandGroup>
										{internalMembers.map((internalMember) => (
											<CommandItem
												key={internalMember.userId}
												value={internalMember.fullName ?? "Ukjent"}
												onSelect={(currentValue) => {
													selectedMember.current =
														currentValue === selectedMember.current
															? ""
															: currentValue;
													setOpenMembers(false);
												}}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														selectedMember.current === internalMember.fullName
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												{internalMember.fullName}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<Select
						onValueChange={(value: string) => {
							setSelectedOrganizerType(value as ORGANIZER_ROLE);
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
							if (!selectedMember.current) return;

							const organizerToAdd = internalMembers.find(
								(internalMember) =>
									internalMember.fullName === selectedMember.current,
							);

							if (organizerToAdd) {
								// Check if organizer is already added
								const currentOrganizers = field.state.value;
								const isAlreadyAdded = currentOrganizers.some(
									(organizer) => organizer.userId === organizerToAdd.userId,
								);

								if (!isAlreadyAdded) {
									field.handleChange([
										...currentOrganizers,
										{
											userId: organizerToAdd.userId,
											role: selectedOrganizerType || "medhjelper",
										},
									]);
								}

								selectedMember.current = "";
								setSelectedOrganizerType("medhjelper");
							}
						}}
					>
						Legg til ansvarlig
					</Button>
				</div>
				<OrganizersTable columns={columns} data={selectedOrganizers} />
			</div>
			<FieldDescription>
				Velg hvem som er ansvarlig for og skal organisere/planlegge
				arrangementet.
			</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
