import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { userByExternalId } from "./users";

export const getBoardMembers = query({
  handler: async (ctx) => {
    const members = await ctx.db.query("internals").filter(q => q.neq("position", "intern")).collect();
    const membersWithUserData = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        if (!user) {
          throw new Error(`User not found for member with ID: ${member._id}`);
        }
        return {
          ...member,
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          image: user.image
        };
      }),
    );

    return membersWithUserData;
  },
})

export const getById = query({
  args: {
    id: v.id("internals"),
  },
  handler: async (ctx, { id }) => {
    const internal = await ctx.db.get(id);
    if (!internal) {
      throw new Error(`Internal record not found for ID: ${id}`);
    }

    const user = await ctx.db.get(internal.userId);
    if (!user) {
      throw new Error(`User not found for internal record with ID: ${id}`);
    }

    return {
      ...internal,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      image: user.image,
      externalId: user.externalId,
    };
  },
})

export const update = mutation({
  args: {
    id: v.id("internals"),
    externalId: v.string(),
    position: v.string(),
    group: v.string(),
    postionEmail: v.optional(v.string()),
  }, handler: async (ctx, { id, externalId, position, group, postionEmail }) => {
    const user = await userByExternalId(ctx, externalId);
    if (!user) {
      throw new Error(`User not found for external ID: ${externalId}`);
    }

    await ctx.db.patch(id, {
      userId: user._id,
      position,
      group,
      postionEmail,
    })
  }
})

export const createBoardMember = mutation({
  args: {
    externalId: v.string(),
    position: v.string(),
    group: v.string(),
    postionEmail: v.optional(v.string()),
  },
  handler: async (ctx, { externalId, position, group, postionEmail }) => {
    const user = await userByExternalId(ctx, externalId)
    if (!user) {
      throw new Error(`User not found for external ID: ${externalId}`);
    }

    const newMember = {
      userId: user._id,
      position,
      group,
      postionEmail,
    };

    await ctx.db.insert("internals", newMember);
  },
})
