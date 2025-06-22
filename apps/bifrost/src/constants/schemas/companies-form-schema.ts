import z from "zod/v4";

export const formSchema = z.object({
  company_name: z.string().min(2),
  org_number: z.string().min(9),
  description: z.string().min(10),
  company_image: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type CompanyFormValues = z.infer<typeof formSchema>;
