/** Start announcing the count only once the answer gets close to the limit. */
const ANNOUNCE_FROM_SHARE = 0.9;

/** «120 / 2000» under a text answer. Read out politely once the limit is near. */
export function CharacterCount({
	id,
	length,
	max,
}: Readonly<{ id: string; length: number; max: number }>) {
	return (
		<span
			id={id}
			role="status"
			aria-live={length >= max * ANNOUNCE_FROM_SHARE ? "polite" : "off"}
			className="mt-1.5 block text-right text-[12px] text-muted-foreground tabular-nums"
		>
			{length} / {max}
		</span>
	);
}
