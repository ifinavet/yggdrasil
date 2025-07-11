interface EmailTemplateProps {
	firstName: string;
}

export function EmailTemplate({ firstName }: EmailTemplateProps) {
	return (
		<div>
			<h1>Hei, {firstName}!</h1>
			<h2>Dette er en test epost</h2>
		</div>
	);
}
