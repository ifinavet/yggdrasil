import z from "zod/v4";

export const eventResponseFromSchema = z.object({
	satisfaction: z.int().min(1, "Må velge et alternativ").max(5),
	impression: z.int().min(1, "Må velge et alternativ").max(5),
	expectation: z.int().min(1, "Må velge et alternativ").max(5),
	toughts: z.string().min(1, "Venligst fyll inn").max(1000, "Maks 1000 tegn"),
	improvements: z.string().min(1, "Venligst fyll inn").max(1000, "Maks 1000 tegn"),
	want_to_work: z.enum(["ja", "nei"], { error: "Huk av for et av alternativene" }),
	word_of_mouth: z.array(z.string()).min(1, "Må velge minst et alternativ"),
	other: z.string().max(1000, "Maks 1000 tegn"),
});
