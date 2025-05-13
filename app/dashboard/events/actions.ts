import {createClient} from "@/utils/supabase/client";

export interface EventQuickView {
    id: number;
    title: string;
    teaser: string;
    event_date: Date;
    registration_date: Date;
    company: {
        name: string;
        description: string;
    };
    organizers: {
        id: number;
        firstname: string;
        lastname: string;
        type: string;
    }[];
}

export async function getEvents(semester?: string): Promise<EventQuickView[]> {
    const supabase = createClient();

    let query = supabase
        .from("event")
        .select(
            "id, title, teaser, registration_date, event_date, company (hosting_company:id, name, description)",
        );

    // Add date filtering based on semester if provided
    let year: number;
    let half: string;
    if (semester) {
        year = 2000 + Number.parseInt(semester.substring(1, 3));
        half = semester.substring(0, 1);

        const startDate = half === "V" ? `${year}-01-01` : `${year}-07-01`;

        const endDate = half === "V" ? `${year}-06-30` : `${year}-12-31`;

        query = query.gte("event_date", startDate).lte("event_date", endDate);
    } else {
        // Default to the current semester if no semester is provided
        const today = new Date();
        year = today.getFullYear();
        half = today.getMonth() < 6 ? "V" : "H";

        const startDate = half === "V" ? `${year}-01-01` : `${year}-07-01`;
        const endDate = half === "V" ? `${year}-06-30` : `${year}-12-31`;

        query = query.gte("event_date", startDate).lte("event_date", endDate);
    }

    // Execute query
    const { data: events, error } = await query
        .order("event_date", { ascending: false })
        .overrideTypes<
            {
                id: number;
                title: string;
                teaser: string;
                event_date: string;
                registration_date: string;
                company: { name: string; description: string };
            }[]
        >();

    if (error) {
        console.error("Error fetching events:", error);
        throw error;
    }

    // Process event data
    return await Promise.all(
        events?.map(async (event) => {
            const { data: organizers } = await supabase
                .from("event_organizers")
                .select(
                    "id, type, event, internal_member (navet_member:id, user (id, firstname, lastname))",
                )
                .eq("event", event.id)
                .overrideTypes<
                    {
                        id: number;
                        type: string;
                        event: bigint;
                        internal_member: {
                            navet_member: number;
                            user: { id: string; firstname: string; lastname: string };
                        };
                    }[]
                >();

            return {
                id: event.id,
                title: event.title,
                teaser: event.teaser,
                company: {
                    name: event.company.name,
                    description: event.company.description,
                },
                organizers:
                    organizers?.map((organizer) => ({
                        id: organizer.id,
                        type: organizer.type,
                        firstname: organizer.internal_member.user.firstname,
                        lastname: organizer.internal_member.user.lastname,
                    })) || [],
                event_date: new Date(event.event_date),
                registration_date: new Date(event.registration_date),
            };
        }) || [],
    );
}

export async function getPossibleSemesters() {
    const supabase = createClient();

    const { data: events, error } = await supabase
        .from("event")
        .select("id, event_date")
        .order("event_date", { ascending: false })
        .overrideTypes<{ id: string; event_date: Date }[]>();

    if (error) {
        console.error("Error fetching semesters:", error);
        throw error;
    }

    const semesters = events
        .filter((event) => event.event_date)
        .map((event) => {
            const date = new Date(event.event_date);
            if (Number.isNaN(date.getTime())) return null;
            return `${date.getMonth() < 6 ? "V" : "H"}${date.getFullYear().toString().substring(2, 4)}`;
        })
        .filter((semester): semester is string => semester !== null);

    return Array.from(new Set(semesters));
}
