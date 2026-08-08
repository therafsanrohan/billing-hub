/**
 * Connectivity & Error Classification Test Suite
 * Validates centralized Supabase configuration, network error classification, trace IDs, and health checks.
 */

import { getPublicSupabaseConfig } from '../src/lib/supabase/config';
import { handleDatabaseError } from '../src/lib/utils/db-error-handler';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runConnectivityTests() {
  console.log('Running Connectivity & Error Classification Tests...');

  // 1. Centralized Config Test
  const config = getPublicSupabaseConfig();
  assert(typeof config.supabaseUrl === 'string' && config.supabaseUrl.startsWith('https://'), '1. getPublicSupabaseConfig returns valid HTTPS Supabase URL');
  assert(typeof config.publishableKey === 'string' && config.publishableKey.length > 0, '1b. getPublicSupabaseConfig returns valid publishable key');

  // 2. Failed to Fetch / Network Failure Classification
  const fetchError = new TypeError('Failed to fetch');
  const handledFetch = handleDatabaseError(fetchError, 'fetchClients');
  assert(handledFetch.isNetworkError === true, '2a. Correctly flags TypeError: Failed to fetch as network error');
  assert(handledFetch.userMessage.includes('could not reach the cloud server'), '2b. Displays distinct network reachability guidance instead of generic DB failure');

  // 3. Browser Extension Blocking Classification
  const blockedError = { message: 'net::ERR_BLOCKED_BY_CLIENT' };
  const handledBlocked = handleDatabaseError(blockedError, 'createInvoice');
  assert(handledBlocked.code === 'ERR_BLOCKED_BY_CLIENT', '3a. Identifies ERR_BLOCKED_BY_CLIENT browser extension blocking');
  assert(handledBlocked.userMessage.toLowerCase().includes('incognito'), '3b. Suggests Incognito window or disabling ad-blocker extension');

  // 4. Project Paused Status Classification (Code 540)
  const pausedError = { status: 540, message: 'Supabase project is dormant or paused' };
  const handledPaused = handleDatabaseError(pausedError, 'getExpenses');
  assert(handledPaused.code === '540' || handledPaused.code === 'PROJECT_PAUSED', '4a. Identifies platform status code 540');
  assert(handledPaused.userMessage.includes('temporarily unavailable or paused'), '4b. Informs user database is paused without infinite retries');

  // 5. Trace ID Generation
  assert(typeof handledFetch.traceId === 'string' && handledFetch.traceId.startsWith('tr-'), '5. Generates safe unique trace ID for error tracking');

  // 6. Non-Exposure of Secrets or Raw Technical Traces
  assert(!handledFetch.userMessage.includes('SUPABASE_SECRET_KEY'), '6a. Never exposes server secret keys in user messages');
  assert(!handledFetch.userMessage.includes('postgresql'), '6b. Hides raw PostgreSQL technical traces from user UI');

  console.log('All Connectivity & Error Classification Tests Passed Successfully!');
}

try {
  runConnectivityTests();
} catch (error: any) {
  console.error('❌ Connectivity test execution failed!');
  console.error(error.message);
  process.exit(1);
}
