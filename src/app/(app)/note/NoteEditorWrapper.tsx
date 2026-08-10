import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { NoteEditor } from './NoteEditor';

export async function NoteEditorWrapper({ noteId }: { noteId: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const db = createServerClient();
  const { data: note } = await db
    .from('notes')
    // File widgets need their `files` row up front, otherwise the attached
    // row renders as "No file uploaded" until the page is recreated.
    .select('*, space:spaces(*), widgets(*, file:files(*))')
    .eq('id', noteId)
    .eq('user_id', userId)
    .single();

  if (!note) redirect('/home');

  return <NoteEditor noteId={noteId} initialNote={note} />;
}
