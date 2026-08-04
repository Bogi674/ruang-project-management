import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();
    const role = await checkProjectAccess(db, params.id, session.user.id);
    if (!role) return notFound("Project not found");

    const { data, error } = await db
      .from("projects")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !data) return notFound("Project not found");
    return NextResponse.json({ ...data, member_role: role });
  } catch {
    return unauthorized();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();
    const role = await checkProjectAccess(db, params.id, session.user.id, "editor");
    if (!role) return notFound("Project not found");

    const body = await req.json();
    const allowed = ["name", "description", "color"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await db
      .from("projects")
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
    const role = await checkProjectAccess(db, params.id, session.user.id, "owner");
    if (!role) return notFound("Project not found");

    const { error } = await db.from("projects").delete().eq("id", params.id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch {
    return unauthorized();
  }
}
