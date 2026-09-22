import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { authenticate, change } = vi.hoisted(() => ({ authenticate: vi.fn(), change: vi.fn() }));
vi.mock('@/lib/auth/require-auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth/require-auth')>()),
  requireAuth: authenticate,
}));
vi.mock('@/lib/data/admin/people', () => ({ changePerson: change }));
import { PATCH } from '@/app/api/people/[id]/route';
import { AuthError } from '@/lib/auth/require-auth';
const viewer = { uid: 'karen-uid', personId: 'karen', householdIds: ['blevins'] };
const request = (body: unknown) =>
  new Request('http://localhost/api/people/andrew?uid=andrew-uid', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
const context = { params: Promise.resolve({ id: 'andrew' }) };
beforeEach(() => vi.resetAllMocks());
it('does not reach a mutation without authentication and current membership', async () => {
  for (const status of [401, 403]) {
    authenticate.mockRejectedValueOnce(new AuthError('Not authorized', status));
    expect((await PATCH(request({ action: 'role', value: 'admin' }), context)).status).toBe(status);
    expect(change).not.toHaveBeenCalled();
  }
});
it('uses the verified identity and reports permission failures without leaking internal errors', async () => {
  authenticate.mockResolvedValue(viewer);
  change.mockRejectedValueOnce(new AuthError('Only a household admin can manage people.', 403));
  const response = await PATCH(request({ action: 'role', value: 'admin' }), context);
  expect(response.status).toBe(403);
  expect(change).toHaveBeenCalledWith('andrew', { action: 'role', value: 'admin' }, viewer);
  expect(response.headers.get('cache-control')).toBe('no-store');
  change.mockRejectedValueOnce(new Error('private database detail'));
  expect(await (await PATCH(request({ action: 'delete' }), context)).json()).toEqual({
    error: 'Could not save. Please try again.',
  });
});
it('rejects forged identity fields, malformed input, oversized requests, and invalid paths', async () => {
  authenticate.mockResolvedValue(viewer);
  for (const input of [
    { action: 'role', value: 'admin', uid: 'andrew-uid' },
    { action: 'role', value: 'owner' },
  ]) {
    expect((await PATCH(request(input), context)).status).toBe(400);
  }
  expect(
    (await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{' }), context)).status,
  ).toBe(400);
  expect((await PATCH(request('x'.repeat(1001)), context)).status).toBe(413);
  expect(
    (await PATCH(request({ action: 'delete' }), { params: Promise.resolve({ id: '../andrew' }) }))
      .status,
  ).toBe(400);
  expect(change).not.toHaveBeenCalled();
});
