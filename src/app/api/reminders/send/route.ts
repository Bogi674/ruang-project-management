import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { sendReminderEmail } from '@/lib/resend';
import { ReminderContent } from '@/types';

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { widget_id } = body;
  if (!widget_id) return apiError('widget_id is required', 400);

  const db = createServerClient();

  // Load widget + linked note
  const { data: widget, error: wErr } = await db
    .from('widgets')
    .select('*, note:notes(id, title)')
    .eq('id', widget_id)
    .eq('user_id', userId!)
    .single();

  if (wErr || !widget) return apiError('Widget not found', 404);
  if (widget.type !== 'reminder') return apiError('Widget is not a reminder', 400);

  const rc = widget.content as ReminderContent;
  if (!rc.date) return apiError('Reminder has no date set', 400);

  // Fetch user email
  const { data: user } = await db.from('users').select('email').eq('id', userId!).single();
  if (!user?.email) return apiError('User email not found', 500);

  const noteTitle = (widget.note as { title?: string } | null)?.title ?? null;
  const noteId = (widget.note as { id?: string } | null)?.id ?? null;

  await sendReminderEmail({
    to: user.email,
    reminderTitle: rc.title || 'Reminder',
    reminderDate: rc.date,
    reminderTime: rc.time,
    noteTitle,
    noteId,
  });

  // Record delivery
  await db.from('reminder_deliveries').insert({
    widget_id,
    recipient_id: userId!,
    channel: 'email',
    status: 'sent',
    scheduled_at: rc.date,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
