import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data, error } = await db
      .from("workstreams")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !data) return notFound("Workstream not found");

    const role = await checkProjectAccess(db, data.project_id, session.user.id);
    if (!role) return notFound("Workstream not found");

    return NextResponse.json(data);
  } catch {
    return unauthorized();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: ws } = await db.from("workstreams").select("project_id").eq("id", params.id).single();
    if (!ws) return notFound("Workstream not found");

    const role = await checkProjectAccess(db, ws.project_id, session.user.id, "editor");
    if (!role) return notFound("Workstream not found");

    const body = await req.json();
    const allowed = ["name", "description", "color", "sort_order"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await db
      .from("workstreams")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return unauthorized();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: ws } = await db.from("workstreams").select("project_id").eq("id", params.id).single();
    if (!ws) return notFound("Workstream not found");

    const role = await checkProjectAccess(db, ws.project_id, session.user.id, "editor");
    if (!role) return notFound("Workstream not found");

    await db.from("workstreams").delete().eq("id", params.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return unauthorized();
  }
}
