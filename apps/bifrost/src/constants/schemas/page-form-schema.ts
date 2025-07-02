import z from "zod/v4";

export const pageSchema = z.object({
	title: z.string().min(2, "Gi siden et bra navn"),
	content: z.string().min(1, "Skulle vi kanskje hatt noe innhold?"),
});

export type PageFormValues = z.infer<typeof pageSchema>;
