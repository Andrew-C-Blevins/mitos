import { requireIdentity, AuthError } from '@/lib/auth/require-auth';
import { provisionUser } from '@/lib/auth/provision-user';
export async function POST(request: Request) {
  try {
    return Response.json(await provisionUser(await requireIdentity(request)));
  } catch (error) {
    return Response.json(
      { error: error instanceof AuthError ? error.message : 'Account setup failed.' },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
