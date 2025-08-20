"use client";

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
import { useRef } from "react";
import { accessRights } from "@/constants/types";

export default function UpsertInternalRole({
	role,
	setSelectedRoleAction,
}: {
	role?: string;
	setSelectedRoleAction: (role: string) => void;
}) {
	const selectedRole = useRef<string>("");

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant='secondary'>{role ?? "Sett rolle"}</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Velg tilgangsrolle</DialogTitle>
					<DialogDescription>
						Velg en tilgangsrolle for denne intern medlemmet. Dette vil bestemme hvilke ressurser og
						funksjoner de har tilgang til.
					</DialogDescription>
				</DialogHeader>

				<div>
					<Select
						value={role}
						onValueChange={(value: string) => {
							selectedRole.current = value;
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder='Velg tilgangsrolle' />
						</SelectTrigger>
						<SelectContent>
							{accessRights.map(accessRight => <SelectItem value='admin'>Admin</SelectItem>)}
							<SelectItem value='super-admin'>Super-admin</SelectItem>
							<SelectItem value='editor'>Editor</SelectItem>
							<SelectItem value='internal'>Internal</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<div className='flex w-full justify-start gap-4'>
						<DialogClose asChild>
							<Button type='submit' onClick={() => setSelectedRoleAction(selectedRole.current)}>
								Lagre rolle
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button type='submit' variant='secondary'>
								Avbryt
							</Button>
						</DialogClose>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
