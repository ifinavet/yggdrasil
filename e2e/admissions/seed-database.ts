import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { localIdentity } from "@workspace/shared/local";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id, TableNames } from "../../packages/backend/convex/_generated/dataModel";

export class LocalDatabase {
	private readonly adminKey: string;
	private readonly url: string;
	constructor(url: string) {
		const parsed = new URL(url);
		if (
			parsed.protocol !== "http:" ||
			!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
		)
			throw new Error("Seed database must be local");
		const config = JSON.parse(
			readFileSync("packages/backend/.convex/local/default/config.json", "utf8"),
		);
		if (Number(parsed.port) !== config.ports.cloud)
			throw new Error("Seed database port does not match local deployment");
		this.url = url;
		this.adminKey = config.adminKey;
	}
	async call(path: string, args: Record<string, unknown>, componentPath?: string) {
		let type = "function";
		if (path.startsWith("_system/cli/")) type = "query";
		if (path.startsWith("_system/frontend/")) type = "mutation";
		const response = await fetch(`${this.url}/api/${type}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Convex ${this.adminKey}` },
			body: JSON.stringify({
				path,
				args: type === "function" ? args : [args],
				format: "json",
				componentPath,
			}),
		});
		const result = await response.json();
		if (!response.ok || result.status !== "success")
			throw new Error(result.errorMessage ?? "Local database request failed");
		return result.value;
	}

	async all<T extends TableNames>(table: T, cursor: string | null = null): Promise<Doc<T>[]> {
		const page = await this.call("_system/cli/tableData", {
			table,
			order: "asc",
			paginationOpts: { numItems: 1000, cursor },
		});
		return page.isDone
			? page.page
			: [...page.page, ...(await this.all(table, page.continueCursor))];
	}

	async find<T extends TableNames, K extends keyof Doc<T>>(table: T, field: K, value: Doc<T>[K]) {
		return (await this.all(table)).find((row) => row[field] === value);
	}
	async insert<T extends TableNames>(
		table: T,
		document: WithoutSystemFields<Doc<T>>,
	): Promise<Id<T>> {
		const result = await this.call("_system/frontend/addDocument", {
			table,
			documents: [document],
		});
		if (!result.success) throw new Error(result.error);
		const matches = (await this.all(table)).filter((row) =>
			Object.entries(document).every(([key, value]) =>
				isDeepStrictEqual(Reflect.get(row, key), value),
			),
		);
		if (matches.length !== 1 || !matches[0])
			throw new Error(`Seed insert could not identify one ${table} document`);
		return matches[0]._id;
	}
	async patch<T extends TableNames>(
		table: T,
		id: Id<T>,
		fields: Partial<WithoutSystemFields<Doc<T>>>,
	) {
		const result = await this.call("_system/frontend/patchDocumentsFields", {
			table,
			ids: [id],
			fields,
		});
		if (!result.success) throw new Error(result.error);
	}
	async delete<T extends TableNames>(table: T, id: Id<T>) {
		const result = await this.call("_system/frontend/deleteDocuments", {
			toDelete: [{ id, tableName: table }],
		});
		if (!result.success) throw new Error(result.error);
	}
	async clear(table: TableNames) {
		const rows = await this.all(table);
		if (!rows.length) return;
		const result = await this.call("_system/frontend/deleteDocuments", {
			toDelete: rows.map(({ _id }) => ({ id: _id, tableName: table })),
		});
		if (!result.success) throw new Error(result.error);
	}
}

export async function localAdmin(db: LocalDatabase) {
	const existing = await db.find("users", "externalId", localIdentity.subject);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: localIdentity.profileUrl,
			locked: false,
		}));
	const rights = await db.find("accessRights", "userId", userId);
	if (!rights) await db.insert("accessRights", { userId, role: "super-admin" });
	return userId;
}
