import { ConvexError } from "convex/values";
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
		toast.error(error instanceof ConvexError ? String(error.data) : fallbackError);
		return false;
	}
}
