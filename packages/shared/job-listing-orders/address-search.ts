import { z } from "zod";

export const ADDRESS_QUERY_MIN_LENGTH = 3;
export const ADDRESS_QUERY_MAX_LENGTH = 100;

export const addressQuerySchema = z
	.string()
	.trim()
	.min(ADDRESS_QUERY_MIN_LENGTH)
	.max(ADDRESS_QUERY_MAX_LENGTH);

export const addressSearchSessionSchema = z.uuid();

const geonorgeAddressSchema = z
	.object({
		adressetekst: z.string().trim().min(1),
		postnummer: z.string().trim().catch(""),
		poststed: z.string().trim().catch(""),
	})
	.transform(({ adressetekst, postnummer, poststed }) =>
		[adressetekst, [postnummer, poststed].filter(Boolean).join(" ")].filter(Boolean).join(", "),
	)
	.nullable()
	.catch(null);

export const geonorgeAddressesSchema = z
	.object({ adresser: z.array(geonorgeAddressSchema) })
	.transform(({ adresser }) => [
		...new Set(adresser.filter((address): address is string => address !== null)),
	]);
