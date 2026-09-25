import type { ReactNode } from "react";
import { Body, Button, Container, Head, Html, Img, Link, Preview, Text } from "react-email";
import { NAVET_LOGO_URL } from "../constants.js";

export const ORDER_CONTACT_EMAIL = "annonse@ifinavet.no";

export function OrderLayout({
	preview,
	children,
}: Readonly<{ preview: string; children: ReactNode }>) {
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
					<Text style={{ margin: "32px 0 0" }}>Med vennlig hilsen,</Text>
					<Text style={{ margin: "8px 0 0" }}>
						Navet
						<br />
						<Link href={`mailto:${ORDER_CONTACT_EMAIL}`}>{ORDER_CONTACT_EMAIL}</Link>
					</Text>
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
		<table
			cellPadding={0}
			cellSpacing={0}
			style={{ width: "100%", borderTop: "1px solid #dde3ea", margin: "16px 0" }}
		>
			<tbody>
				{rows.map(([label, value]) => (
					<tr key={label}>
						<td style={{ padding: "8px 0", borderBottom: "1px solid #dde3ea", color: "#5b6b7f" }}>
							{label}
						</td>
						<td
							style={{
								padding: "8px 0",
								borderBottom: "1px solid #dde3ea",
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
