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

export type LocalUser = typeof localUser;

export const localIdentity = {
	subject: localUser.id,
	givenName: localUser.firstName,
	familyName: localUser.lastName,
	email: localUser.primaryEmailAddress.emailAddress,
	profileUrl: localUser.imageUrl,
};
