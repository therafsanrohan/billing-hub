/**
 * Common form utility helpers shared across billing pages.
 * Centralises repeated validation and numeric parsing patterns.
 */

/**
 * Safely parse a numeric string from a form input.
 * Returns `fallback` (default 0) when the value is empty, NaN, or non-numeric.
 *
 * @example
 * onChange={(e) => setValue(parseNumericInput(e.target.value))}
 */
export function parseNumericInput(value: string, fallback = 0): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse a positive numeric string.
 * Returns `fallback` when the parsed value is NaN or <= 0.
 */
export function parsePositiveInput(value: string, fallback = 0): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

/**
 * Validate that a required string field is non-empty.
 * Returns true if valid.
 */
export function isRequiredString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a numeric value is a finite positive number (> 0).
 */
export function isPositiveNumber(value: number): boolean {
  return isFinite(value) && value > 0;
}

/**
 * Validate that a numeric value is a finite non-negative number (>= 0).
 */
export function isNonNegativeNumber(value: number): boolean {
  return isFinite(value) && value >= 0;
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
