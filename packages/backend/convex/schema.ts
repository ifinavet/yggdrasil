import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    orgNumber: v.number(),
    name: v.string(),
    description: v.string(),
    mainSponsor: v.boolean(),
    logo: v.id("companyLogos"),
  }),

  companyLogos: defineTable({
    name: v.string(),
    image: v.id("_storage"),
  }),

  resources: defineTable({
    title: v.string(),
    content: v.string(),
    excerpt: v.string(),
    tag: v.optional(v.string()),
    published: v.boolean(),
    updatedAt: v.number(),
  }),

  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    image: v.string(),
    externalId: v.string(),
    locked: v.boolean(),
  }).index("by_ExternalId", ["externalId"]),

  students: defineTable({
    userId: v.id("users"),
    name: v.string(),
    studyProgram: v.string(),
    email: v.optional(v.string()),
    semester: v.number(),
    degree: v.union(v.literal("bachelor"), v.literal("master"), v.literal("phd")),
  }).index("by_studyProgram", ["studyProgram"])
    .index("by_userId", ["userId"]),

  points: defineTable({
    studentId: v.id("students"),
    reason: v.string(),
    severity: v.number(),
  }).index("by_studentId", ["studentId"]),

  internals: defineTable({
    userId: v.id("users"),
    position: v.string(),
    group: v.string(),
    positionEmail: v.optional(v.string()),
  }).index("by_position", ["position"]),

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
    userId: v.id("users"),
    status: v.union(v.literal("registered"), v.literal("pending"), v.literal("waitlist")),
    note: v.optional(v.string()),
    registrationTime: v.number(),
    attendanceStatus: v.optional(v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show"))),
    attendanceTime: v.optional(v.number()),
  }).index("by_eventId", ["eventId"])
    .index("by_userId", ["userId"]),

  externalPages: defineTable({
    title: v.string(),
    content: v.string(),
    published: v.boolean(),
    updatedAt: v.number(),
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
  }).index("by_deadline", ["deadline"])
    .index("by_deadlineAndType", ["type", "deadline"]),

  jobListingContacts: defineTable({
    listingId: v.id("jobListings"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }).index("by_listingId", ["listingId"])
});
