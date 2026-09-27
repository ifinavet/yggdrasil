export function ShareBar({ share, color }: Readonly<{ share: number; color: string }>) {
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
		</div>
	);
}
