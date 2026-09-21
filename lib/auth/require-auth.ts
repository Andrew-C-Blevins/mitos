import 'server-only';
import { getAdmin } from '@/lib/data/admin/firebase';
import type { Viewer } from '@/lib/types';

export class AuthError extends Error {
  constructor(
    message = 'Not authorized',
    public status = 401,
  ) {
    super(message);
  }
}
export function bearer(request: Request): string {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ') || value.length > 10000) throw new AuthError();
  return value.slice(7);
}
export async function requireIdentity(request: Request) {
  const { auth } = getAdmin();
  const identity = await auth.verifyIdToken(bearer(request), true).catch(() => {
    throw new AuthError();
  });
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    !identity.email ||
    !identity.email_verified ||
    !allowed.includes(identity.email.toLowerCase())
  )
    throw new AuthError('This account is not on the Mitos allowlist.', 403);
  return identity;
}
export async function requireAuth(request: Request): Promise<Viewer> {
  const identity = await requireIdentity(request);
  const { db } = getAdmin();
  const profile = (await db.doc(`users/${identity.uid}`).get()).data();
  if (!profile) throw new AuthError('Sign in to finish account setup.', 403);
  // Never trust only the server-set user envelope: household membership is authoritative.
  const households = await Promise.all(
    (profile.householdIds as string[]).map((id) => db.doc(`households/${id}`).get()),
  );
  const householdIds = households
    .filter((doc) => doc.data()?.memberUids.includes(identity.uid))
    .map((doc) => doc.id);
  if (!householdIds.length) throw new AuthError('No household membership.', 403);
  return { uid: identity.uid, personId: profile.personId, householdIds };
}
