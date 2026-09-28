import { Img, Link, Text } from "react-email";
import { NAVET_LOGO_URL } from "../constants.js";

export type Signature = Readonly<{ name: string; position?: string; email: string }>;

export function EmailSignature({ name, position, email }: Signature) {
	return (
		<>
			<Text style={{ margin: "32px 0 0" }}>Med vennlig hilsen,</Text>
			<Text style={{ margin: "16px 0 0" }}>
				{name}
				{position && (
					<>
						<br />
						{position} | Navet
					</>
				)}
				<br />
				<Link href={`mailto:${email}`}>{email}</Link>
			</Text>
			<Img src={NAVET_LOGO_URL} alt="Navet" height="32" style={{ marginTop: "16px" }} />
		</>
	);
}
