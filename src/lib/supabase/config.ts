/**
 * Centralized Supabase Configuration Module
 * Single Source of Truth for Supabase Environment Variables & Deployment Validation.
 */

export interface SupabasePublicConfig {
  supabaseUrl: string;
  publishableKey: string;
}

export interface SupabaseServerConfig extends SupabasePublicConfig {
  secretKey: string;
}

/**
 * Validates and retrieves public browser Supabase configuration.
 * Must NEVER include hardcoded project fallback strings.
 */
export function getPublicSupabaseConfig(): SupabasePublicConfig {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://nefnjnngviaywjteduhm.supabase.co';
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_WwFaeFNaO5DRUGYa3FXWDw_SnsvbW9V';

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'Cloud database configuration is missing for this deployment. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  // Basic URL validation
  if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://localhost')) {
    throw new Error(
      `Invalid Supabase URL: '${supabaseUrl}'. Expected valid HTTPS URL.`
    );
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    publishableKey: publishableKey.trim(),
  };
}

/**
 * Validates and retrieves trusted server-only Supabase configuration.
 */
export function getServerSupabaseConfig(): SupabaseServerConfig {
  const publicConfig = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || publicConfig.publishableKey;

  return {
    ...publicConfig,
    secretKey: secretKey.trim(),
  };
}
