import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getAdmin } from '@/lib/data/admin/firebase';
import { AuthError, bearer } from './require-auth';
import type { Viewer } from '@/lib/types';

async function requireToken(
  request: Request,
  field: 'captureTokenHash' | 'agentTokenHash',
): Promise<Viewer> {
  const token = bearer(request);
  if (token.length < 40 || token.length > 256) throw new AuthError();
  const hash = createHash('sha256').update(token).digest('hex');
  const { db, auth } = getAdmin();
  const matches = await db.collection('credentials').where(field, '==', hash).limit(1).get();
  const credential = matches.docs[0];
  if (!credential || !timingSafeEqual(Buffer.from(hash), Buffer.from(credential.data()[field])))
    throw new AuthError();
  const user = await auth.getUser(credential.id);
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase());
  if (
    user.disabled ||
    !user.emailVerified ||
    !user.email ||
    !allowed.includes(user.email.toLowerCase())
  )
    throw new AuthError();
  const profile = (await db.doc(`users/${user.uid}`).get()).data();
  if (!profile) throw new AuthError();
  const householdIds: string[] = [];
  for (const id of profile.householdIds as string[])
    if ((await db.doc(`households/${id}`).get()).data()?.memberUids.includes(user.uid))
      householdIds.push(id);
  if (!householdIds.length) throw new AuthError();
  return { uid: user.uid, personId: profile.personId, householdIds };
}
export const requireCaptureToken = (request: Request) => requireToken(request, 'captureTokenHash');
export const requireAgentToken = (request: Request) => requireToken(request, 'agentTokenHash');
