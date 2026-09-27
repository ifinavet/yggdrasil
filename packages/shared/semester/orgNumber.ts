// Norwegian organization numbers, as Enhetsregisteret (Brønnøysund) issues them.

const CHECK_DIGIT_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

/** Removes spaces, so "924 773 189" and "924773189" are the same number. */
export function normalizeOrgNumber(value: string): string {
	return value.replace(/\s/g, "");
}

/**
 * Validates an organization number: 9 digits with the modulus 11 check digit that Brønnøysund uses.
 * Spaces are ignored.
 */
export function isValidOrgNumber(value: string): boolean {
	const digits = normalizeOrgNumber(value);
	if (!/^\d{9}$/.test(digits)) return false;

	const sum = CHECK_DIGIT_WEIGHTS.reduce(
		(total, weight, index) => total + weight * Number(digits[index]),
		0,
	);
	const remainder = sum % 11;
	// A remainder of 1 gives check digit 10, which no digit can match, so the number is invalid.
	const check = remainder === 0 ? 0 : 11 - remainder;

	return check === Number(digits[8]);
}

/** Company profiles store the organization number as a number. */
export function toCompanyProfileOrgNumber(orgNumber: string): number {
	return Number(normalizeOrgNumber(orgNumber));
}
