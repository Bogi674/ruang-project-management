import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

/**
 * Detach a file or note from a to-do.
 *
 * Only the link row goes. The file stays in R2 and the note stays in the
 * user's Ruang — "remove from this to-do" is not "delete", and the × on the
 * attachment row would be a very sharp edge if it were.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { error: dbError } = await db
    .from('todo_attachments')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId!);

  if (dbError) {
    console.error('[todos:attachments:DELETE]', dbError.message);
    return apiError('Could not remove that attachment', 500);
  }
  return new NextResponse(null, { status: 204 });
}
