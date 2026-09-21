import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { authenticate, readExport } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  readExport: vi.fn(),
}));
vi.mock('@/lib/auth/require-auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth/require-auth')>()),
  requireAuth: authenticate,
}));
vi.mock('@/lib/data/admin/export', () => ({ exportData: readExport }));
import { GET } from '@/app/api/export/route';
import { AuthError } from '@/lib/auth/require-auth';
beforeEach(() => vi.resetAllMocks());
it('never reads an export when authentication or membership fails', async () => {
  for (const status of [401, 403]) {
    authenticate.mockRejectedValueOnce(new AuthError('Not authorized', status));
    const response = await GET(new Request('http://localhost/api/export'));
    expect(response.status).toBe(status);
    expect(readExport).not.toHaveBeenCalled();
  }
});
it('uses the authenticated identity even when a different user is requested', async () => {
  const viewer = { uid: 'karen-uid', personId: 'karen', householdIds: ['blevins'] };
  authenticate.mockResolvedValue(viewer);
  readExport.mockResolvedValue({ formatVersion: 1, exportedAt: '2026-09-21T14:00:00Z', items: [] });
  const response = await GET(new Request('http://localhost/api/export?uid=andrew-uid'));
  expect(readExport).toHaveBeenCalledWith(viewer);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="mitos-2026-09-21.json"',
  );
  expect((await response.json()).items).toEqual([]);
});
