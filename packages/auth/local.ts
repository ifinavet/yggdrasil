export const isLocalDevelopment =
	process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_DEV === "true";

export const localUser = {
	id: "local-developer",
	firstName: "Local",
	lastName: "Developer",
	fullName: "Local Developer",
	username: "local-developer",
	imageUrl: "",
	emailAddresses: [{ emailAddress: "developer@example.test" }],
	primaryEmailAddress: { emailAddress: "developer@example.test" },
};
