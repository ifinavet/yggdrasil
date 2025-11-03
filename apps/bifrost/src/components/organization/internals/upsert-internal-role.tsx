"use client";

import { ACCESS_RIGHTS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function UpsertInternalRole({
	role,
	setSelectedRoleAction,
}: Readonly<{
	role?: string;
	setSelectedRoleAction: (role: string) => void;
}>) {
	const [selectedRole, setSelectedRole] = useState<string>(role ?? "");

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="secondary" className="capitalize">
					<LockKeyhole className="size-4" /> {role ?? "Sett rolle"}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Velg tilgangsrolle</DialogTitle>
					<DialogDescription>
						Velg en tilgangsrolle for denne intern medlemmet. Dette vil bestemme
						hvilke ressurser og funksjoner de har tilgang til.
					</DialogDescription>
				</DialogHeader>

				<div>
					<Select
						defaultValue={role}
						onValueChange={(value: string) => setSelectedRole(value)}
					>
						<SelectTrigger className="capitalize">
							<SelectValue placeholder="Velg tilgangsrolle" />
						</SelectTrigger>
						<SelectContent>
							{ACCESS_RIGHTS.map((accessRight) => (
								<SelectItem
									value={accessRight}
									key={accessRight}
									className="capitalize"
								>
									{accessRight}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<div className="flex w-full justify-start gap-4">
						<DialogClose asChild>
							<Button
								type="submit"
								onClick={() => setSelectedRoleAction(selectedRole)}
							>
								Lagre rolle
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button type="submit" variant="secondary">
								Avbryt
							</Button>
						</DialogClose>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
