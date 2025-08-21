import z from "zod/v4";
import { accessRights } from "../types";

export const formSchema = z.object({
	internalId: z.string(),
	userId: z.string(),
	role: z.string().min(2).max(100),
	group: z.string().min(2).max(100),
	positionEmail: z.optional(z.email()),
	accessRole: z.literal(accessRights).optional(),
});

export type boardMemberSchema = z.infer<typeof formSchema>;
