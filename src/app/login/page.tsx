import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AuthForm } from './AuthForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/');
  return <AuthForm />;
}
