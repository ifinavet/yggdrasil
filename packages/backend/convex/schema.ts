import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    org_number: v.number(),
    name: v.string(),
    description: v.string(),
    mainSponsor: v.boolean(),
    logo: v.id("_storage"),
  }),

  resources: defineTable({
    title: v.string(),
    description: v.string(),
    content: v.string(),
    tag: v.string(),
    published: v.boolean(),
    updatedAt: v.number(),
  }),

  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),

  students: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    studyProgram: v.string(),
    semester: v.number(),
  }).index("by_studyProgram", ["studyProgram"]),

  points: defineTable({
    userId: v.string(),
    reason: v.string(),
    severity: v.number(),
  }),

  internals: defineTable({
    userId: v.string(),
    position: v.string(),
    group: v.string(),
  }),

  events: defineTable({
    title: v.string(),
    teaser: v.string(),
    description: v.string(),
    eventStart: v.number(),
    registrationOpens: v.number(),
    participationLimit: v.number(),
    location: v.string(),
    food: v.string(),
    language: v.string(),
    ageRestriction: v.string(),
    externalUrl: v.optional(v.string()),
    hostingCompany: v.id("companies"),
    published: v.boolean(),
  }).index("by_eventStart", ["eventStart"]),

  eventOrganizers: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    role: v.union(v.literal("hovedansvarlig"), v.literal("medhjelper"))
  }).index("by_eventId", ["eventId"]),

  registrations: defineTable({
    eventId: v.id("events"),
    userId: v.string(),
    status: v.union(v.literal("registered"), v.literal("pending"), v.literal("waitlist")),
    note: v.string(),
    registrationTime: v.number(),
    attendanceStatus: v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show")),
    attendanceTime: v.number(),
  }),

  externalPages: defineTable({
    title: v.string(),
    content: v.string(),
    published: v.boolean(),
  }),

  jobListings: defineTable({
    title: v.string(),
    type: v.string(),
    teaser: v.string(),
    description: v.string(),
    applicationUrl: v.string(),
    published: v.boolean(),
    company: v.id("companies"),
    deadline: v.number(),
  }).index("by_deadline", ["deadline"]),

  jobListingContacts: defineTable({
    listingId: v.id("jobListings"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }).index("by_listingId", ["listingId"])
});
