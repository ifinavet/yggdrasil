import z from "zod/v4";

export const resourceSchema = z.object({
  title: z.string().min(2).max(80),
  content: z.string().min(1),
  excerpt: z.string().min(10).max(200),
  tag: z.optional(z.string()),
});

export type ResourceFormValues = z.infer<typeof resourceSchema>;
