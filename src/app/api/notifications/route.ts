import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

    let query = db
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) query = query.eq("read", false);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return unauthorized();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const { markAllRead } = await req.json();

    if (markAllRead) {
      await db
        .from("notifications")
        .update({ read: true })
        .eq("user_id", session.user.id)
        .eq("read", false);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return unauthorized();
  }
}
