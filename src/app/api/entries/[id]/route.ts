import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data, error } = await db
      .from("entries")
      .select(`
        *,
        project:projects(id, name, color),
        workstream:workstreams(id, name, color),
        creator:users!entries_created_by_fkey(id, name, avatar_url),
        assignees:entry_assignees(user:users(id, name, avatar_url)),
        files(id, filename, size_bytes, mime_type, r2_object_key, created_at)
      `)
      .eq("id", params.id)
      .single();

    if (error || !data) return notFound("Entry not found");

    const role = await checkProjectAccess(db, data.project_id, session.user.id);
    if (!role) return notFound("Entry not found");

    return NextResponse.json({
      ...data,
      assignees: (data.assignees || []).map((a: { user: unknown }) => a.user),
    });
  } catch {
    return unauthorized();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: entry } = await db
      .from("entries")
      .select("project_id, type, content")
      .eq("id", params.id)
      .single();

    if (!entry) return notFound("Entry not found");

    const role = await checkProjectAccess(db, entry.project_id, session.user.id, "editor");
    if (!role) return notFound("Entry not found");

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("content" in body) updates.content = { ...(entry.content as object), ...body.content };
    if ("pinnedDate" in body) updates.pinned_date = body.pinnedDate;
    if ("pinnedDateEnd" in body) updates.pinned_date_end = body.pinnedDateEnd;
    if ("tags" in body) updates.tags = body.tags;
    if ("isPinned" in body) updates.is_pinned = body.isPinned;
    if ("workstreamId" in body) updates.workstream_id = body.workstreamId;

    const { data, error } = await db
      .from("entries")
      .update(updates)
      .eq("id", params.id)
      .select(`
        *,
        project:projects(id, name, color),
        workstream:workstreams(id, name, color),
        creator:users!entries_created_by_fkey(id, name, avatar_url),
        assignees:entry_assignees(user:users(id, name, avatar_url)),
        files(id, filename, size_bytes, mime_type, r2_object_key, created_at)
      `)
      .single();

    if (error) throw error;

    // Save note version on content update
    if (entry.type === "note" && "content" in body) {
      const newContent = data?.content as { version_number?: number };
      const versionNum = (newContent?.version_number || 1);
      await db.from("note_versions").insert({
        entry_id: params.id,
        version_number: versionNum,
        content_snapshot: updates.content,
        saved_by: session.user.id,
      });
      // Keep only last 20
      const { data: versions } = await db
        .from("note_versions")
        .select("id")
        .eq("entry_id", params.id)
        .order("created_at", { ascending: false });

      if (versions && versions.length > 20) {
        const toDelete = versions.slice(20).map((v) => v.id);
        await db.from("note_versions").delete().in("id", toDelete);
      }
    }

    return NextResponse.json({
      ...data,
      assignees: ((data as { assignees?: { user: unknown }[] })?.assignees || []).map((a) => a.user),
    });
  } catch (err) {
    console.error(err);
    return unauthorized();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: entry } = await db
      .from("entries")
      .select("project_id")
      .eq("id", params.id)
      .single();

    if (!entry) return notFound("Entry not found");

    const role = await checkProjectAccess(db, entry.project_id, session.user.id, "editor");
    if (!role) return notFound("Entry not found");

    await db.from("entries").delete().eq("id", params.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return unauthorized();
  }
}
