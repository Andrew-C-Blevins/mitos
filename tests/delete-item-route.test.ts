import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), remove: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/auth/require-auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth/require-auth')>()),
  requireAuth: mocks.auth,
}));
vi.mock('@/lib/data/admin/delete-item', () => ({ deleteItem: mocks.remove }));
vi.mock('@/lib/data/admin/items', () => ({ getItem: mocks.get }));
import { DELETE, GET } from '@/app/api/items/[id]/route';
import { AuthError } from '@/lib/auth/require-auth';
const viewer = { uid: 'user', personId: 'andrew', householdIds: ['blevins'] };
const context = { params: Promise.resolve({ id: 'item' }) };
const request = (body: unknown = { version: 3 }) =>
  new Request('http://localhost/api/items/item', {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
beforeEach(() => vi.resetAllMocks());
it('authenticates item links, excludes caching and never exposes internal lookup errors', async () => {
  mocks.auth.mockRejectedValueOnce(new AuthError());
  expect((await GET(new Request('http://localhost'), context)).status).toBe(401);
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue(viewer);
  mocks.get.mockResolvedValue({ id: 'item' });
  const response = await GET(new Request('http://localhost'), context);
  expect(await response.json()).toEqual({ item: { id: 'item' } });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.get).toHaveBeenCalledWith('item', viewer);
  mocks.get.mockRejectedValueOnce(new Error('Private database details'));
  expect(await (await GET(new Request('http://localhost'), context)).json()).toEqual({
    error: 'Could not open this to-do. Please try again.',
  });
});
it('requires authentication before deletion and uses only the verified viewer', async () => {
  mocks.auth.mockRejectedValueOnce(new AuthError());
  expect((await DELETE(request(), context)).status).toBe(401);
  expect(mocks.remove).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue(viewer);
  expect((await DELETE(request(), context)).status).toBe(200);
  expect(mocks.remove).toHaveBeenCalledWith('item', 3, viewer);
});
it('rejects missing/stale confirmation input, identity injection, and invalid IDs', async () => {
  mocks.auth.mockResolvedValue(viewer);
  for (const body of [
    null,
    {},
    [],
    { version: -1 },
    { version: 1.5 },
    { version: '1' },
    { version: 1, uid: 'forged' },
  ])
    expect((await DELETE(request(body), context)).status).toBe(400);
  expect((await DELETE(request(), { params: Promise.resolve({ id: '../item' }) })).status).toBe(
    400,
  );
  expect((await DELETE(request('a'.repeat(101)), context)).status).toBe(413);
  expect(
    (await DELETE(new Request('http://localhost', { method: 'DELETE', body: '{' }), context))
      .status,
  ).toBe(400);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it('reports conflicts without exposing internal errors', async () => {
  mocks.auth.mockResolvedValue(viewer);
  mocks.remove.mockRejectedValueOnce(new AuthError('Item changed.', 409));
  const conflict = await DELETE(request(), context);
  expect(conflict.status).toBe(409);
  expect(conflict.headers.get('cache-control')).toBe('no-store');
  mocks.remove.mockRejectedValueOnce(new Error('private data'));
  const failed = await DELETE(request(), context);
  expect(failed.status).toBe(500);
  expect(await failed.json()).toEqual({ error: 'Could not delete. Please try again.' });
});
