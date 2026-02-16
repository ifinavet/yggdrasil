"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
}: Readonly<{
	readonly error: Error & { digest?: string };
}>) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		// biome-ignore lint: This is a valid html attribute
		<html lang="nb">
			<body
				style={{
					margin: 0,
					fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
					backgroundColor: "#fafafa",
					color: "#1a1a1a",
					display: "grid",
					placeContent: "center",
					minHeight: "100vh",
					padding: "1rem",
				}}
			>
				<div
					style={{
						maxWidth: "28rem",
						width: "100%",
						textAlign: "center",
						border: "1px solid #e5e5e5",
						borderRadius: "0.75rem",
						padding: "2.5rem 2rem",
						backgroundColor: "#ffffff",
						boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
					}}
				>
					<div
						style={{
							width: "3.5rem",
							height: "3.5rem",
							margin: "0 auto 1.25rem",
							borderRadius: "50%",
							backgroundColor: "#fef2f2",
							display: "grid",
							placeContent: "center",
							fontSize: "1.5rem",
						}}
					>
						!
					</div>
					<h1
						style={{
							fontSize: "1.5rem",
							fontWeight: 700,
							margin: "0 0 0.5rem",
						}}
					>
						Noe gikk galt
					</h1>
					<p
						style={{
							color: "#6b7280",
							margin: "0 0 1.5rem",
							lineHeight: 1.5,
						}}
					>
						En kritisk feil oppstod. Vi beklager ulempene.
					</p>
					{error.digest && (
						<p
							style={{
								color: "#9ca3af",
								fontSize: "0.75rem",
								margin: "0 0 1.5rem",
							}}
						>
							Feil-ID:{" "}
							<code
								style={{
									backgroundColor: "#f3f4f6",
									padding: "0.125rem 0.375rem",
									borderRadius: "0.25rem",
								}}
							>
								{error.digest}
							</code>
						</p>
					)}
					<div
						style={{
							display: "flex",
							gap: "0.75rem",
							justifyContent: "center",
							flexWrap: "wrap",
						}}
					>
						<button
							onClick={() => window.location.reload()}
							type="button"
							style={{
								padding: "0.625rem 1.25rem",
								backgroundColor: "#1a1a1a",
								color: "#ffffff",
								border: "none",
								borderRadius: "0.5rem",
								cursor: "pointer",
								fontSize: "0.875rem",
								fontWeight: 500,
							}}
						>
							Prøv igjen
						</button>
						<a
							href="https://ifinavet.no"
							style={{
								padding: "0.625rem 1.25rem",
								backgroundColor: "transparent",
								color: "#1a1a1a",
								border: "1px solid #e5e5e5",
								borderRadius: "0.5rem",
								cursor: "pointer",
								fontSize: "0.875rem",
								fontWeight: 500,
								textDecoration: "none",
							}}
						>
							Gå til ifinavet.no
						</a>
					</div>
				</div>
			</body>
		</html>
	);
}
