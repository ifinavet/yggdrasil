import { convexErrorMessage } from "@workspace/shared/utils";
import { toast } from "sonner";

export async function notifyProductMutation(
	mutation: Promise<unknown>,
	successMessage: string,
	fallbackError: string,
) {
	try {
		await mutation;
		toast.success(successMessage);
		return true;
	} catch (error) {
		toast.error(convexErrorMessage(error, fallbackError));
		return false;
	}
}
