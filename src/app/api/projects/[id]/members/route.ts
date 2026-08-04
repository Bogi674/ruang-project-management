import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();
    const role = await checkProjectAccess(db, params.id, session.user.id);
    if (!role) return notFound("Project not found");

    const { data, error } = await db
      .from("project_members")
      .select(`
        id, role, created_at,
        user:users (id, public_id, name, email, avatar_url)
      `)
      .eq("project_id", params.id);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return unauthorized();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();
    const role = await checkProjectAccess(db, params.id, session.user.id, "owner");
    if (!role) return notFound("Project not found");

    const { email, memberRole = "editor" } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (!user) {
      // Create invitation
      const { data: inv, error } = await db
        .from("invitations")
        .insert({
          project_id: params.id,
          email,
          role: memberRole,
          invited_by: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ invited: true, invitation: inv }, { status: 201 });
    }

    const { data, error } = await db
      .from("project_members")
      .upsert({ project_id: params.id, user_id: user.id, role: memberRole })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch {
    return unauthorized();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();
    const role = await checkProjectAccess(db, params.id, session.user.id, "owner");
    if (!role) return notFound("Project not found");

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    await db
      .from("project_members")
      .delete()
      .eq("project_id", params.id)
      .eq("user_id", userId);

    return new NextResponse(null, { status: 204 });
  } catch {
    return unauthorized();
  }
}
