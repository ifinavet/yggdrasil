import z from "zod/v4";

export const eventResponseFromSchema = z.object({
	satisfaction: z.int().min(1, "Velg en verdi fra 1 til 5").max(5),
	impression: z.int().min(1, "Velg en verdi fra 1 til 5").max(5),
	expectation: z.int().min(1, "Velg en verdi fra 1 til 5").max(5),
	toughts: z.string().min(1, "Fyll inn et svar").max(1000, "Maks 1000 tegn"),
	improvements: z.string().min(1, "Fyll inn et svar").max(1000, "Maks 1000 tegn"),
	want_to_work: z.enum(["ja", "nei"], { error: "Velg ja eller nei" }),
	word_of_mouth: z.array(z.string()).min(1, "Velg minst ett alternativ"),
	other: z.string().max(1000, "Maks 1000 tegn"),
});
