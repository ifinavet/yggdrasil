import type { formSchema } from "@/app/(bifrost)/bifrost/events/create-event/create-event-form";
import { createClient } from "@/utils/supabase/client";
import type { z } from "zod";

export async function getCompanies() {
    const supabase = createClient();
    const { data: companies } = await supabase.from("company").select("id, name");
    return companies ?? [];
}

export async function getInternalMembers() {
    const supabase = createClient();
    const { data: internal_members } = await supabase
        .from("internal_member")
        .select("id, user (id, firstname, lastname)")
        .overrideTypes<
            {
                id: string;
                user: { id: string; firstname: string; lastname: string };
            }[]
        >();

    const mappedMembers = internal_members?.map((member) => ({
        id: member.id,
        firstname: member.user.firstname,
        lastname: member.user.lastname,
        fullname: `${member.user.firstname} ${member.user.lastname}`,
    }));

    return mappedMembers ?? [];
}

export async function submitEvent(formValues: z.infer<typeof formSchema>): Promise<boolean> {
    const supabase = createClient();
    const { data: event_res, error: event_err_res } = await supabase
        .from("event")
        .insert({
            title: formValues.title,
            description: formValues.description,
            teaser: formValues.teaser,
            event_date: formValues.eventDate.toISOString(),
            registration_date: formValues.registrationDate.toISOString(),
            location: formValues.location,
            food: formValues.food,
            language: formValues.language,
            age_restriction: formValues.ageRestrictions,
            participation_limit: formValues.participantsLimit,
            event_type: formValues.eventType,
            hosting_company: formValues.hostingCompany.id,
            external_url: formValues.externalUrl,
        })
        .select("id")
        .single();

    if (event_res === null) {
        console.error("Error inserting event:", event_err_res);
        throw event_err_res;
    }

    const { data: organizers_res, error: organizers_err_res } = await supabase
        .from("event_organizers")
        .insert(
            formValues.organizers.map((organizer) => {
                return {
                    event: event_res.id,
                    navet_member: organizer.id,
                    type: organizer.role,
                };
            }),
        )
        .select();

    if (organizers_res === null) {
        console.error("Error inserting event organizers:", organizers_err_res);
        throw organizers_err_res;
    }

    return true;
}
