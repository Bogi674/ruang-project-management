import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, badRequest, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return badRequest("projectId required");

    const role = await checkProjectAccess(db, projectId, session.user.id);
    if (!role) return NextResponse.json([], { status: 200 });

    const { data, error } = await db
      .from("workstreams")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return unauthorized();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const body = await req.json();
    const { projectId, name, description, color } = body;

    if (!projectId || !name?.trim()) return badRequest("projectId and name required");

    const role = await checkProjectAccess(db, projectId, session.user.id, "editor");
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { count } = await db
      .from("workstreams")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    const { data, error } = await db
      .from("workstreams")
      .insert({
        project_id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#8b5cf6",
        sort_order: count || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch {
    return unauthorized();
  }
}
