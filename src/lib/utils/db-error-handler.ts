/**
 * Centralized Supabase, Network & PostgreSQL Error Handler
 * Translates low-level network, configuration, and PostgreSQL database errors into clean, user-friendly messages.
 */

export interface FriendlyDatabaseError {
  userMessage: string;
  code?: string;
  details?: string;
  traceId?: string;
  isNetworkError?: boolean;
}

export function handleDatabaseError(error: any, operationName: string): FriendlyDatabaseError {
  const traceId = `tr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

  if (!error) {
    return {
      userMessage: 'An unknown cloud database error occurred.',
      traceId,
    };
  }

  const code = String(error.code || error.status || '');
  const message = String(error.message || error);
  const messageLower = message.toLowerCase();

  console.error(`[Cloud DB Error | Trace: ${traceId}] Operation '${operationName}' failed (${code}):`, message, error);

  // 1. Browser Extension Blocking
  if (messageLower.includes('err_blocked_by_client') || messageLower.includes('blocked by client')) {
    return {
      userMessage: 'A browser extension (such as an ad blocker or privacy shield) is blocking the secure database connection. Please try an Incognito window or disable the blocking extension.',
      code: 'ERR_BLOCKED_BY_CLIENT',
      details: message,
      traceId,
      isNetworkError: true,
    };
  }

  // 2. Network & Transport Errors (Failed to fetch)
  if (
    messageLower.includes('failed to fetch') ||
    messageLower.includes('networkerror') ||
    messageLower.includes('err_name_not_resolved') ||
    messageLower.includes('load failed') ||
    messageLower.includes('network request failed') ||
    messageLower.includes('aborterror') ||
    messageLower.includes('timeouterror') ||
    code === '0' ||
    code === '504'
  ) {
    return {
      userMessage: 'The application could not reach the cloud server. Check your internet connection and try again.',
      code: 'NETWORK_FAILURE',
      details: message,
      traceId,
      isNetworkError: true,
    };
  }

  // 3. Configuration Errors
  if (messageLower.includes('configuration is missing') || messageLower.includes('not configured')) {
    return {
      userMessage: 'Cloud database configuration is missing for this deployment. Please contact the system administrator.',
      code: 'CONFIG_MISSING',
      details: message,
      traceId,
    };
  }

  // 4. Supabase Project Paused / Platform Status (e.g. 540)
  if (code === '540' || messageLower.includes('paused') || messageLower.includes('project is dormant')) {
    return {
      userMessage: 'The cloud database is temporarily unavailable or paused. No data was saved. Please try again later.',
      code: 'PROJECT_PAUSED',
      details: message,
      traceId,
    };
  }

  // 5. PostgreSQL Constraint & RLS Mapping
  switch (code) {
    case '23503': // foreign_key_violation
      return {
        userMessage: 'A required parent record (Entity, Client, or Account Manager) is missing or no longer exists. Please refresh the page and select a valid record.',
        code,
        details: message,
        traceId,
      };
    case '23505': // unique_violation
      return {
        userMessage: 'A record with this serial number, code, or identifier already exists in the system.',
        code,
        details: message,
        traceId,
      };
    case '23502': // not_null_violation
      return {
        userMessage: 'One or more required fields were missing. Please complete all mandatory fields.',
        code,
        details: message,
        traceId,
      };
    case '23514': // check_violation
      return {
        userMessage: 'The submitted record value violates system policy rules or boundaries.',
        code,
        details: message,
        traceId,
      };
    case '22P02': // invalid_text_representation (invalid UUID syntax)
      return {
        userMessage: 'The submitted identifier format is invalid. Please select a valid record from the dropdown menu.',
        code,
        details: message,
        traceId,
      };
    case '42501': // insufficient_privilege / RLS policy violation
      return {
        userMessage: 'You do not have permission to perform this action or access this organization record.',
        code,
        details: message,
        traceId,
      };
    case 'PGRST116': // Single row result error
      return {
        userMessage: 'The requested record was not found.',
        code,
        details: message,
        traceId,
      };
    default:
      return {
        userMessage: message.includes('Cloud') ? message : `Cloud operation error (${traceId}): ${message}`,
        code,
        details: message,
        traceId,
      };
  }
}
