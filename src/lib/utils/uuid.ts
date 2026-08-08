/**
 * Strict UUID Validation and Sanitization Utilities
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a valid standard UUID v4/v1.
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Converts empty strings, whitespace, or invalid non-UUID strings to explicit null.
 * Use for optional foreign key columns (e.g. account_manager_id, vendor_id, bank_account_id).
 */
export function nullifyEmptyUUID(id: string | null | undefined): string | null {
  if (!id || typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (trimmed === '' || !isValidUUID(trimmed)) return null;
  return trimmed;
}

/**
 * Ensures a required foreign key parameter is a valid UUID, throwing a clear error if invalid.
 */
export function requireValidUUID(id: string | null | undefined, fieldName: string): string {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid foreign key parameter for '${fieldName}': expected valid UUID, received '${id}'`);
  }
  return id!.trim();
}
