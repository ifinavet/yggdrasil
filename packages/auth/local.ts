export { type LocalUser, localUser } from "@workspace/shared/local";

export const isLocalDevelopment =
	process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_DEV === "true";
