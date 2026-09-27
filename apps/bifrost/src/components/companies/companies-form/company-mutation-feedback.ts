import { formatOsloToday } from "@workspace/shared/time";
import type { useRouter } from "next/navigation";
import { toast } from "sonner";

export function notifyCompanyMutation(
	mutation: Promise<unknown>,
	successMessage: string,
	successDescription: string,
	router: ReturnType<typeof useRouter>,
) {
	return mutation
		.then(() => {
			toast.success(successMessage, {
				description: `${successDescription}, ${formatOsloToday()}`,
			});
			router.push("/companies");
		})
		.catch((error) => {
			console.error("Noe gikk galt!", error);
			toast.error("Noe gikk galt!", {
				description: error.message,
			});
		});
}
