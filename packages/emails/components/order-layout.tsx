import { JOB_LISTING_ORDER_EMAIL } from "@workspace/shared/constants/contact";
import type { ReactNode } from "react";
import { Body, Button, Container, Head, Html, Img, Preview } from "react-email";
import { NAVET_LOGO_URL } from "../constants.js";
import { EmailSignature } from "./email-signature.js";

export function OrderLayout({
	preview,
	contactEmail = JOB_LISTING_ORDER_EMAIL,
	showSignature = true,
	children,
}: Readonly<{
	preview: string;
	contactEmail?: string;
	showSignature?: boolean;
	children: ReactNode;
}>) {
	return (
		<Html lang="no">
			<Head />
			<Preview>{preview}</Preview>
			<Body
				style={{
					backgroundColor: "#f6f7f9",
					fontFamily: "Helvetica, Arial, sans-serif",
					color: "#17395c",
				}}
			>
				<Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "560px" }}>
					<Img src={NAVET_LOGO_URL} alt="Navet" height="40" />
					{children}
					{showSignature && <EmailSignature name="Navet" email={contactEmail} />}
				</Container>
			</Body>
		</Html>
	);
}

export function OrderButton({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
	return (
		<Button
			href={href}
			style={{
				backgroundColor: "#17395c",
				color: "#ffffff",
				padding: "16px 28px",
				borderRadius: "6px",
				fontSize: "17px",
				fontWeight: 600,
			}}
		>
			{children}
		</Button>
	);
}

export function OrderSummary({
	rows,
}: Readonly<{ rows: ReadonlyArray<readonly [label: string, value: string]> }>) {
	return (
		<table cellPadding={0} cellSpacing={0} style={{ width: "100%", margin: "16px 0" }}>
			<tbody>
				{rows.map(([label, value]) => (
					<tr key={label}>
						<td style={{ padding: "8px 0", color: "#5b6b7f" }}>{label}</td>
						<td
							style={{
								padding: "8px 0",
								textAlign: "right",
								fontWeight: 600,
							}}
						>
							{value}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
