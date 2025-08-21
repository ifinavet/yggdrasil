import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import type { Id } from "node_modules/convex/dist/esm-types/values/value";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";
import type { InternalMemberFormValues } from "@/constants/schemas/internal-member-form-shcema";
import InternalMemberForm from "./new-internal-form";

export function NewInternal() {
	const defaultValues: InternalMemberFormValues = {
		internalId: "",
		userId: "",
		group: "",
	};

	const [openDialog, setOpenDialog] = useState(false);

	const posthog = usePostHog();

	const createInernalMember = useMutation(api.internals.createInternal);
	const onSubmit = (data: InternalMemberFormValues) =>
		createInernalMember({
			userId: data.userId as Id<"users">,
			group: data.group,
		}).then(() => {
			setOpenDialog(false);
			toast.success("Intern medlem opprettet");
		}).catch((error) => {
			toast.error(`Kunne ikke opprette intern medlem`,
				{ description: "Denne hendelsen er logget. Skulle den vedvare ta kontakt med webansvarlig" }
			);

			posthog.capture("create-internal-member-error", {
				error: error,
				userId: data.userId,
				group: data.group,
			});
		});

	return (
		<InternalMemberForm
			defaultValues={defaultValues}
			onSubmitAction={onSubmit}
			description={
				"Velg en bruker som skal være det nye interne medlemmet, og hva gruppen deres heter."
			}
			title={"Legg til et nytt internt medlem"}
			openDialog={openDialog}
			setOpenDialogAction={setOpenDialog}
			button={
				<>
					<Plus /> Legg til ny intern
				</>
			}
		/>
	);
}
