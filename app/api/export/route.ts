import { requireAuth, AuthError } from '@/lib/auth/require-auth';
import { exportData } from '@/lib/data/admin/export';

export async function GET(request: Request) {
  try {
    const data = await exportData(await requireAuth(request));
    return new Response(JSON.stringify(data, null, 2) + '\n', {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mitos-${data.exportedAt.slice(0, 10)}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof AuthError ? error.message : 'Export failed. Please try again.' },
      {
        status: error instanceof AuthError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
