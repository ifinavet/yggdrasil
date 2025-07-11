import z from "zod/v4";

export const formSchema = z.object({
	userID: z.string(),
	role: z.string().min(2).max(100),
	group: z.string().min(2).max(100),
});

export type boardMemberSchema = z.infer<typeof formSchema>;
