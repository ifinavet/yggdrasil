import type { ReactNode } from "react";

/** Composed panel for the states where there is no questionnaire to fill in. */
export function FormStatePanel({
	icon,
	title,
	body,
	action,
	quiet,
}: Readonly<{
	icon?: ReactNode;
	title: string;
	body: string;
	action: ReactNode;
	quiet?: ReactNode;
}>) {
	return (
		<div className="pt-7">
			{icon && (
				<div className="mb-4 grid size-[46px] place-items-center rounded-xl bg-primary-light text-primary">
					{icon}
				</div>
			)}
			<h1 className="m-0 mb-2 font-bold text-[20px] text-primary leading-[1.22] tracking-[-0.015em]">
				{title}
			</h1>
			<p className="m-0 mb-5 text-[14.5px] text-foreground">{body}</p>
			{action}
			{quiet && (
				<span className="mt-4 block text-center text-[13.5px] text-muted-foreground">{quiet}</span>
			)}
		</div>
	);
}
