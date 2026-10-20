/** Runtime rules used by registration, notifications and the handbook. */
export const ATTENDANCE_POINTS = { confirmed: 0, late: 1, no_show: 2 } as const;
export const POINT_LOCKOUT_THRESHOLD = 3;
