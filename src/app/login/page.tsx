import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect('/billing');
    }

    return <LoginForm />;
  } catch (err: any) {
    if (err && typeof err === 'object' && 'digest' in err && typeof err.digest === 'string' && err.digest.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h2>SSR Error on /login</h2>
        <pre>{err.message || String(err)}</pre>
        <pre>{err.stack}</pre>
        <LoginForm />
      </div>
    );
  }
}
