import { MAX_LISTINGS_PER_ORDER } from "@workspace/shared/job-listing-orders";
import { z } from "zod";

const listingValuesSchema = z.object({
	title: z.string(),
	teaser: z.string(),
	description: z.string(),
	applicationUrl: z.string(),
	deadline: z.string(),
	type: z.string(),
});

export const orderFormValuesSchema = z.object({
	company: z.object({
		kind: z.enum(["existing", "new"]),
		companyId: z.string(),
		orgNumber: z.string(),
		registryName: z.string(),
		displayName: z.string(),
		description: z.string(),
		logo: z.string(),
	}),
	companyCorrect: z.enum(["", "yes", "no"]),
	companyChanges: z.object({
		displayName: z.string(),
		description: z.string(),
		logo: z.string(),
	}),
	startup: z.boolean(),
	listings: z.array(listingValuesSchema).min(1).max(MAX_LISTINGS_PER_ORDER),
	contact: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
	changeBilling: z.boolean(),
	billing: z.object({ address: z.string(), email: z.string(), reference: z.string() }),
	note: z.string(),
	confirmAmount: z.boolean(),
	website: z.string(),
});

export type OrderFormValues = z.infer<typeof orderFormValuesSchema>;
export type ListingValues = z.infer<typeof listingValuesSchema>;
export type CompanyValues = OrderFormValues["company"];

export function emptyListing(): ListingValues {
	return { title: "", teaser: "", description: "", applicationUrl: "", deadline: "", type: "" };
}

export const emptyCompany: CompanyValues = {
	kind: "existing",
	companyId: "",
	orgNumber: "",
	registryName: "",
	displayName: "",
	description: "",
	logo: "",
};

export function emptyOrderForm(): OrderFormValues {
	return {
		company: emptyCompany,
		companyCorrect: "",
		companyChanges: { displayName: "", description: "", logo: "" },
		startup: false,
		listings: [emptyListing()],
		contact: { name: "", email: "", phone: "" },
		changeBilling: false,
		billing: { address: "", email: "", reference: "" },
		note: "",
		confirmAmount: false,
		website: "",
	};
}

export function resizeListings(listings: readonly ListingValues[], size: number): ListingValues[] {
	const target = Math.min(Math.max(size, 1), MAX_LISTINGS_PER_ORDER);
	if (target <= listings.length) return listings.slice(0, target);
	return [...listings, ...Array.from({ length: target - listings.length }, () => emptyListing())];
}
