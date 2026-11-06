import { api } from '@/lib/server/http';
import { sessionUser, profile, renewSession } from '@/lib/server/auth';
import { accessOf } from '@/lib/server/rbac';
export const dynamic = 'force-dynamic';
export const GET = api(async () => {
  const user = await sessionUser();
  if (user) await renewSession();   // a session in its last days gets a fresh week, up to 30 days after sign-in
  return { user: user ? { ...profile(user), ...await accessOf(user) } : null };
});
