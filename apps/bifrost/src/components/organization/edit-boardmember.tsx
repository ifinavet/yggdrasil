"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useMutation, useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";
import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import BoardMemberForm from "./board-member-form";

export default function EditBoardMember({
	className,
	internalId,
}: {
	internalId: Id<"internals">;
	className?: string;
}) {
	const [openDialog, setOpenDialog] = useState(false);
	const posthog = usePostHog();

	const boardMember = useQuery(api.internals.getById, { id: internalId });

	const updateBoardMember = useMutation(api.internals.update);
	const onSubmit = (data: boardMemberSchema) => {
		updateBoardMember({
			id: internalId,
			externalId: data.userID,
			position: data.role,
			group: data.group,
			positionEmail: data.positionEmail,
		})
			.then(() => {
				toast.success("Styremedlemmet ble oppdatert!");
				setOpenDialog(false);
			})
			.catch((error) => {
				console.error(error);
				toast.error("Hmm... Det skjedde en feil. Prøv igjen senere.");

				posthog.captureException("bifrost-boardmember_update_error", {
					site: "bifrost",
					error,
				});
			});
	};

	if (!boardMember)
		return (
			<Button variant='outline' size='sm' className={className} disabled>
				<Pencil /> Rediger
			</Button>
		);

	return (
		<BoardMemberForm
			defaultValues={{
				userID: boardMember.externalId,
				role: boardMember.position,
				group: boardMember.group,
				positionEmail: boardMember.positionEmail,
			}}
			onSubmitAction={onSubmit}
			title='Rediger styremedlem'
			description='Gjør endringer på styremedlemet'
			openDialog={openDialog}
			setOpenDialogAction={setOpenDialog}
			button={
				<>
					<Pencil /> Rediger
				</>
			}
			className={className}
		/>
	);
}
