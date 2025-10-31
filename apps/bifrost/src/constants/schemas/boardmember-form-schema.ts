import { ACCESS_RIGHTS } from "@workspace/shared/constants";
import z from "zod/v4";

export const formSchema = z.object({
	internalId: z.string(),
	userId: z.string(),
	role: z.string().min(2).max(100),
	group: z.string().min(2).max(100),
	positionEmail: z.optional(z.email()),
	accessRole: z.enum(ACCESS_RIGHTS).optional(),
});

export type boardMemberSchema = z.infer<typeof formSchema>;
