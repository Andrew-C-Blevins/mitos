import { requireAuth, AuthError } from '@/lib/auth/require-auth';
import { deleteItem } from '@/lib/data/admin/delete-item';
import { getItem } from '@/lib/data/admin/items';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireAuth(request);
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) throw new AuthError('Invalid item.', 400);
    return Response.json(
      { item: await getItem(id, viewer) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : 'Could not open this to-do. Please try again.',
      },
      {
        status: error instanceof AuthError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireAuth(request);
    const { id } = await context.params;
    if (!/^[\w-]{1,128}$/.test(id)) throw new AuthError('Invalid item.', 400);
    const raw = await request.text();
    if (raw.length > 100) throw new AuthError('Request is too large.', 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AuthError('Invalid confirmation.', 400);
    }
    if (
      !body ||
      Object.keys(body).length !== 1 ||
      !Number.isSafeInteger(body.version) ||
      body.version < 1
    )
      throw new AuthError('Invalid confirmation.', 400);
    await deleteItem(id, body.version, viewer);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { error: error instanceof AuthError ? error.message : 'Could not delete. Please try again.' },
      {
        status: error instanceof AuthError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
