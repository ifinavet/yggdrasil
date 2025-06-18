export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			companies: {
				Row: {
					company_id: number;
					company_name: string;
					created_at: string | null;
					org_number: string | null;
					updated_at: string | null;
				};
				Insert: {
					company_id?: number;
					company_name: string;
					created_at?: string | null;
					org_number?: string | null;
					updated_at?: string | null;
				};
				Update: {
					company_id?: number;
					company_name?: string;
					created_at?: string | null;
					org_number?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			event_organizers: {
				Row: {
					created_at: string | null;
					event_id: number;
					role: string;
					user_id: string;
				};
				Insert: {
					created_at?: string | null;
					event_id: number;
					role?: string;
					user_id: string;
				};
				Update: {
					created_at?: string | null;
					event_id?: number;
					role?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "fk_event_organizers_event";
						columns: ["event_id"];
						isOneToOne: false;
						referencedRelation: "events";
						referencedColumns: ["event_id"];
					},
					{
						foreignKeyName: "fk_event_organizers_user";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "internals";
						referencedColumns: ["user_id"];
					},
				];
			};
			events: {
				Row: {
					age_restrictions: string | null;
					company_id: number;
					created_at: string | null;
					description: string | null;
					event_id: number;
					event_start: string;
					external_url: string | null;
					food: string;
					language: string;
					location: string;
					participants_limit: number;
					registration_opens: string;
					teaser: string | null;
					title: string;
					updated_at: string | null;
					visible: boolean;
				};
				Insert: {
					age_restrictions?: string | null;
					company_id: number;
					created_at?: string | null;
					description?: string | null;
					event_id?: number;
					event_start: string;
					external_url?: string | null;
					food: string;
					language?: string;
					location: string;
					participants_limit: number;
					registration_opens: string;
					teaser?: string | null;
					title: string;
					updated_at?: string | null;
					visible?: boolean;
				};
				Update: {
					age_restrictions?: string | null;
					company_id?: number;
					created_at?: string | null;
					description?: string | null;
					event_id?: number;
					event_start?: string;
					external_url?: string | null;
					food?: string;
					language?: string;
					location?: string;
					participants_limit?: number;
					registration_opens?: string;
					teaser?: string | null;
					title?: string;
					updated_at?: string | null;
					visible?: boolean;
				};
				Relationships: [
					{
						foreignKeyName: "fk_events_company";
						columns: ["company_id"];
						isOneToOne: false;
						referencedRelation: "companies";
						referencedColumns: ["company_id"];
					},
				];
			};
			internal_groups: {
				Row: {
					created_at: string | null;
					description: string | null;
					group_id: number;
					group_name: string;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					description?: string | null;
					group_id?: number;
					group_name: string;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					description?: string | null;
					group_id?: number;
					group_name?: string;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			internals: {
				Row: {
					created_at: string | null;
					internal_email: string;
					internal_group_id: number;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					created_at?: string | null;
					internal_email: string;
					internal_group_id: number;
					updated_at?: string | null;
					user_id?: string;
				};
				Update: {
					created_at?: string | null;
					internal_email?: string;
					internal_group_id?: number;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "fk_internals_group";
						columns: ["internal_group_id"];
						isOneToOne: false;
						referencedRelation: "internal_groups";
						referencedColumns: ["group_id"];
					},
				];
			};
			points: {
				Row: {
					awarded_time: string | null;
					created_at: string | null;
					point_id: number;
					reason: string;
					severity: number;
					user_id: string;
				};
				Insert: {
					awarded_time?: string | null;
					created_at?: string | null;
					point_id?: number;
					reason: string;
					severity: number;
					user_id?: string;
				};
				Update: {
					awarded_time?: string | null;
					created_at?: string | null;
					point_id?: number;
					reason?: string;
					severity?: number;
					user_id?: string;
				};
				Relationships: [];
			};
			registrations: {
				Row: {
					attendance_status: string | null;
					attendance_time: string | null;
					created_at: string | null;
					event_id: number;
					registration_id: number;
					registration_time: string | null;
					status: string;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					attendance_status?: string | null;
					attendance_time?: string | null;
					created_at?: string | null;
					event_id: number;
					registration_id?: number;
					registration_time?: string | null;
					status?: string;
					updated_at?: string | null;
					user_id?: string;
				};
				Update: {
					attendance_status?: string | null;
					attendance_time?: string | null;
					created_at?: string | null;
					event_id?: number;
					registration_id?: number;
					registration_time?: string | null;
					status?: string;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "fk_registrations_event";
						columns: ["event_id"];
						isOneToOne: false;
						referencedRelation: "events";
						referencedColumns: ["event_id"];
					},
				];
			};
			students: {
				Row: {
					created_at: string | null;
					degree: string;
					semester: number;
					study_program: string;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					created_at?: string | null;
					degree: string;
					semester: number;
					study_program: string;
					updated_at?: string | null;
					user_id?: string;
				};
				Update: {
					created_at?: string | null;
					degree?: string;
					semester?: number;
					study_program?: string;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {},
	},
} as const;
