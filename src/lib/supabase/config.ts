export function getPublicSupabaseConfig() {
  let supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();

  if (supabaseUrl && !supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  return { supabaseUrl, anonKey };
}
