import z from "zod/v4";

export const internalMemberFormSchema = z.object({
	internalId: z.string().optional(),
	userId: z.string(),
	group: z.string(),
})

export type InternalMemberFormValues = z.infer<typeof internalMemberFormSchema>;
