import { requireAuth, AuthError } from '@/lib/auth/require-auth';
import { changePerson } from '@/lib/data/admin/people';
import { personChangeSchema } from '@/lib/domain/people';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireAuth(request),
      { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) throw new AuthError('Invalid person.', 400);
    const raw = await request.text();
    if (raw.length > 1000) throw new AuthError('Request is too large.', 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new AuthError('Invalid request.', 400);
    }
    const parsed = personChangeSchema.safeParse(input);
    if (!parsed.success) throw new AuthError('Choose a valid profile change.', 400);
    await changePerson(id, parsed.data, viewer);
    return Response.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { error: error instanceof AuthError ? error.message : 'Could not save. Please try again.' },
      {
        status: error instanceof AuthError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
