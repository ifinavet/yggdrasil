export const POINT_LIMIT = 3;

export function totalPoints(points: readonly { severity: number }[]) {
	return points.reduce((sum, { severity }) => sum + severity, 0);
}
