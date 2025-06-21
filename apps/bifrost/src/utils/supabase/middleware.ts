import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

	if (!supabaseUrl || !supabaseKey) {
		throw new Error("Missing required Supabase environment variables");
	}

	return createClient(supabaseUrl, supabaseKey, {
		async accessToken() {
			return (await auth()).getToken();
		},
	});
}
