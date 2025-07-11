"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import { createBoardmember } from "@/lib/queries/organization";
import BoardMemberForm from "./board-member-form";

export default function AddBoardMember({ className }: { className?: string }) {
	const defaultValues = {
		userID: "",
		role: "",
		group: "",
	};

	const [openDialog, setOpenDialog] = useState(false);

	const queryClient = useQueryClient();

	const { mutate } = useMutation({
		mutationKey: ["addBoardMember"],
		mutationFn: (data: boardMemberSchema) => createBoardmember(data),
		onSuccess: () => {
			toast.success("Styremedlemmet ble lagt til!");
			queryClient.invalidateQueries({ queryKey: ["boardMembers"] });
			setOpenDialog(false);
		},
		onError: (error) => {
			console.error(error);
			toast.error("Hmm... Det skjedde en feil. Prøv igjen senere.");
		},
	});

	const onSubmit = (data: boardMemberSchema) => {
		mutate(data);
	};

	return (
		<BoardMemberForm
			defaultValues={defaultValues}
			onSubmit={onSubmit}
			title='Legg til et nytt styremedlem'
			description='Velg et medlem som skal være det nye styremedlemet, og hva rollen skal være, samt hva gruppen deres heter.'
			openDialog={openDialog}
			setOpenDialog={setOpenDialog}
			button={
				<>
					<Plus /> Legg til nytt styremedlem
				</>
			}
			className={className}
		/>
	);
}
