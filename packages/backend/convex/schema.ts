import { defineSchema } from "convex/server";
import { accessSchema } from "./auth/schema";
import { companiesSchema } from "./companies/schema";
import { eventsSchema } from "./events/schema";
import { formsSchema } from "./forms/schema";
import { jobListingsSchema } from "./jobListings/schema";
import { pagesSchema } from "./pages/schema";
import { pointsSchema } from "./points/schema";
import { usersSchema } from "./users/clerk/schema";
import { organizationSchema } from "./users/organization/schema";
import { studentsSchema } from "./users/students/schema";


export default defineSchema({
	...companiesSchema,
	...eventsSchema,
	...jobListingsSchema,
	...pagesSchema,
	...usersSchema,
	...organizationSchema,
	...studentsSchema,
	...pointsSchema,
	...formsSchema,
	...accessSchema
});
