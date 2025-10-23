import { v } from "convex/values";
import { action } from "./_generated/server";
import { currentUser } from "./auth";
import { components } from "./_generated/api";

// Config flags
const forcePreserveClerkIdInUserIdField = false; // store Clerk's id into user.userId
const respectClerkVerifiedFlags = true;
// Only set to true if your account model expects plaintext and hashes internally.
// Most setups should leave this false and do a password reset flow post-migration.
const writeCredentialPasswords = true;

// Parse CSV to JSON
function getCSVData(csv: string) {
	const lines = csv.split("\n").filter((line) => line.trim());
	const headers = lines[0]?.split(",").map((h) => h.trim()) || [];
	const jsonData = lines.slice(1).map((line) => {
		const values = line.split(",").map((v) => v.trim());
		return headers.reduce(
			(obj, header, idx) => {
				obj[header] = values[idx] || "";
				return obj;
			},
			{} as Record<string, string>,
		);
	});

	return jsonData as Array<{
		id: string;
		first_name: string;
		last_name: string;
		username: string;
		primary_email_address: string;
		primary_phone_number: string;
		verified_email_addresses: string;
		unverified_email_addresses: string;
		verified_phone_numbers: string;
		unverified_phone_numbers: string;
		totp_secret: string;
		password_digest: string;
		password_hasher: string;
	}>;
}

function parseCsvList(val: string): string[] {
	return (val || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function safeDateToMillis(timestamp?: number): number {
	if (!timestamp) return Date.now();
	const d = new Date(timestamp * 1000);
	if (isNaN(d.getTime())) return Date.now();
	const y = d.getFullYear();
	if (y < 2000 || y > 2100) return Date.now();
	return d.getTime();
}

// If Clerk gives "lockout_expires_in_seconds" (seconds from now), convert to ms epoch
function mapBanExpires(seconds?: number): number | null {
	if (!seconds || seconds <= 0) return null;
	return Date.now() + seconds * 1000;
}

function requiredName(first?: string, last?: string): string {
	const name = `${first ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
	return name || first || last || ""; // ensure non-empty string
}

async function fetchClerkUsers(totalUsers: number, clerkSecretKey: string) {
	const out: Array<{
		id: string;
		image_url: string;
		two_factor_enabled: boolean;
		banned: boolean;
		lockout_expires_in_seconds: number;
		created_at: number;
		updated_at: number;
		external_accounts: Array<{
			id: string;
			provider: string; // "credential" or "oauth_*"
			provider_user_id: string;
			approved_scopes: string;
			created_at: number;
			updated_at: number;
		}>;
	}> = [];

	for (let i = 0; i < totalUsers; i += 500) {
		const res = await fetch(
			`https://api.clerk.com/v1/users?offset=${i}&limit=500`,
			{ headers: { Authorization: `Bearer ${clerkSecretKey}` } },
		);
		if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
		const batch = (await res.json()) as any[];
		out.push(
			...batch.map((u) => ({
				id: u.id,
				image_url: u.image_url,
				two_factor_enabled: !!u.two_factor_enabled,
				banned: !!u.banned,
				lockout_expires_in_seconds: u.lockout_expires_in_seconds ?? 0,
				created_at: u.created_at,
				updated_at: u.updated_at,
				external_accounts: (u.external_accounts ?? []).map((a: any) => ({
					id: a.id,
					provider: a.provider,
					provider_user_id: a.provider_user_id,
					approved_scopes: a.approved_scopes,
					created_at: a.created_at,
					updated_at: a.updated_at,
				})),
			})),
		);
	}
	return out;
}

export const migrateFromClerk = action({
	args: {
		csvData: v.string(),
		// Prefer reading the Clerk key from server env; but allowing arg keeps it flexible.
		// If you don't want it from the client, remove this arg and use process.env in handler.
		clerkSecretKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Require a signed-in admin
		const me = await currentUser(ctx);
		if (!me) throw new Error("Unauthenticated — please sign in.");
		if (me.role !== "admin") {
			throw new Error("You must be an admin to run this migration.");
		}

		const csvRows = getCSVData(args.csvData);
		const clerkKey = args.clerkSecretKey || process.env.CLERK_SECRET_KEY || "";
		if (!clerkKey) {
			throw new Error(
				"Clerk secret key missing. Pass clerkSecretKey or set CLERK_SECRET_KEY env.",
			);
		}

		// Fetch Clerk API data for metadata/enrichment
		const clerkUsers = await fetchClerkUsers(csvRows.length, clerkKey);

		// Helpers using generated internal adapter endpoints
		async function findUserByEmail(email: string) {
			try {
				return await ctx.runQuery(components.betterAuth.adapter.findOne, {
					model: "user",
					where: [{ field: "email", value: email.toLowerCase() }],
				});
			} catch {
				return null;
			}
		}
		async function findUserByUserId(userId: string) {
			try {
				return await ctx.runQuery(components.betterAuth.adapter.findOne, {
					model: "user",
					where: [{ field: "userId", value: userId }],
				});
			} catch {
				return null;
			}
		}

		let migrated = 0;
		let skippedExisting = 0;
		let failed = 0;

		for (const row of csvRows) {
			const {
				id,
				first_name,
				last_name,
				username, // not used in your user model validator; skipping
				primary_email_address,
				// primary_phone_number, // not in your user model validator; skipping
				verified_email_addresses,
				// verified_phone_numbers, // not in your user model validator; skipping
			} = row;

			const email = (primary_email_address || "").toLowerCase();
			if (!email) {
				console.warn(`Skipping row without email. Clerk ID: ${id}`);
				failed++;
				continue;
			}

			// De-dupe by userId or email
			const existsByUserId = forcePreserveClerkIdInUserIdField
				? await findUserByUserId(id)
				: null;
			const existsByEmail = await findUserByEmail(email);
			if (existsByUserId || existsByEmail) {
				skippedExisting++;
				continue;
			}

			const clerkUser = clerkUsers.find((u) => u.id === id);
			const verifiedEmails = parseCsvList(verified_email_addresses);
			const emailVerified =
				respectClerkVerifiedFlags &&
				verifiedEmails.includes(primary_email_address);

			const name = requiredName(first_name, last_name);

			try {
				// Build user data according to your validator:
				// fields allowed: createdAt, updatedAt, email, emailVerified, name, image?,
				// role?, banned?, banReason?, banExpires?, degree?, program?, semester?, userId?
				const userData: Record<string, any> = {
					email,
					emailVerified: !!emailVerified,
					name, // string required
					image: clerkUser?.image_url ?? null,
					createdAt: safeDateToMillis(clerkUser?.created_at),
					updatedAt: safeDateToMillis(clerkUser?.updated_at),
				};

				if (forcePreserveClerkIdInUserIdField) {
					userData.userId = id;
				}

				// Admin-related fields if you want to preserve them
				userData.banned = !!clerkUser?.banned;
				userData.banExpires = mapBanExpires(
					clerkUser?.lockout_expires_in_seconds,
				);

				// Optionally set role:
				userData.role = "user";

				// Create user via internal adapter
				const createdUser = await ctx
					.runMutation(components.betterAuth.adapter.create, {
						input: {
							model: "user",
							data: userData,
						},
					})
					.catch(async (e) => {
						// Fallback lookup
						const fallbackByUserId = forcePreserveClerkIdInUserIdField
							? await findUserByUserId(id)
							: null;
						const fallbackByEmail = await findUserByEmail(email);
						if (!fallbackByUserId && !fallbackByEmail) throw e;
						return (fallbackByUserId || fallbackByEmail) as { id: string };
					});

				// External accounts
				const externalAccounts = clerkUser?.external_accounts || [];
				for (const acc of externalAccounts) {
					const {
						provider,
						provider_user_id,
						approved_scopes,
						created_at,
						updated_at,
					} = acc;

					if (provider === "credential") {
						if (writeCredentialPasswords) {
							// WARNING: Only if your adapter expects plaintext and will hash internally.
							await ctx.runMutation(components.betterAuth.adapter.create, {
								input: {
									model: "account",
									data: {
										providerId: "credential",
										accountId: provider_user_id,
										scope: approved_scopes || null,
										userId: (createdUser as any).id,
										createdAt: safeDateToMillis(created_at),
										updatedAt: safeDateToMillis(updated_at),
										// temp password; advise reset later
										password: generateStrongTempPassword(),
									},
								},
							});
						} else {
							// Skipping credential account to avoid incorrect password storage.
							// Plan a password reset flow for these users.
						}
					} else {
						await ctx.runMutation(components.betterAuth.adapter.create, {
							input: {
								model: "account",
								data: {
									providerId: provider.replace("oauth_", ""),
									accountId: provider_user_id,
									scope: approved_scopes || null,
									userId: (createdUser as any).id,
									createdAt: safeDateToMillis(created_at),
									updatedAt: safeDateToMillis(updated_at),
								},
							},
						});
					}
				}

				migrated++;
			} catch (e) {
				console.error(`Failed migrating ${id} (${email}):`, e);
				failed++;
			}
		}

		return {
			success: true,
			migrated,
			skippedExisting,
			failed,
			total: csvRows.length,
		};
	},
});

function generateStrongTempPassword() {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%^&*()-_=+";
	let out = "";
	for (let i = 0; i < 20; i++) {
		out += chars[Math.floor(Math.random() * chars.length)];
	}
	return out;
}
