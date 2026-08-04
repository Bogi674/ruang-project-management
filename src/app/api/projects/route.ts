import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  try {
    const { session, db } = await requireAuth();

    const { data, error } = await db
      .from("project_members")
      .select(`
        role,
        project:projects (
          id, public_id, name, description, color, created_by, created_at, updated_at
        )
      `)
      .eq("user_id", session.user.id);

    if (error) throw error;

    const projects = (data || []).map((m) => ({
      ...(m.project as object),
      member_role: m.role,
    }));

    return NextResponse.json(projects);
  } catch {
    return unauthorized();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const body = await req.json();
    const { name, description, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("projects")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#6366f1",
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as owner so they can access and edit the project.
    // Role must be "owner" | "editor" | "viewer" — checkProjectAccess in
    // api-helpers.ts uses indexOf() on that array, so any other string
    // (e.g. "admin") would silently block all permission checks.
    const { error: memberError } = await db
      .from("project_members")
      .insert({
        project_id: data.id,
        user_id: session.user.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    return NextResponse.json(data, { status: 201 });
  } catch {
    return unauthorized();
  }
}
