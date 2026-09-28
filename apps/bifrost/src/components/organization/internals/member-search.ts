import { filterSearchItems } from "@workspace/ui/lib/search-select";

type SearchableMember = {
	internalId: string;
	fullName: string;
	email: string;
	connections: { uioEmail?: string } | null;
};

export function filterMembers<TMember extends SearchableMember>(members: TMember[], query: string) {
	const items = members.map((member) => ({
		id: member.internalId,
		label: member.fullName,
		description: [member.email, member.connections?.uioEmail].filter(Boolean).join(" "),
	}));
	const matches = new Set(filterSearchItems(items, query).map((item) => item.id));
	return members.filter((member) => matches.has(member.internalId));
}
