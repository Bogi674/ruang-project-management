import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, badRequest, checkProjectAccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const projectId = sp.get("projectId");
    const workstreamId = sp.get("workstreamId");
    const type = sp.get("type");
    const today = sp.get("today") === "true";
    const limit = parseInt(sp.get("limit") || "100");
    const offset = parseInt(sp.get("offset") || "0");

    let query = db
      .from("entries")
      .select(`
        *,
        project:projects(id, name, color),
        workstream:workstreams(id, name, color),
        creator:users!entries_created_by_fkey(id, name, avatar_url),
        assignees:entry_assignees(user:users(id, name, avatar_url)),
        files(id, filename, size_bytes, mime_type, r2_object_key)
      `)
      .order("pinned_date", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) {
      const role = await checkProjectAccess(db, projectId, session.user.id);
      if (!role) return NextResponse.json([], { status: 200 });
      query = query.eq("project_id", projectId);
    } else {
      // today view — get all accessible projects
      const { data: memberships } = await db
        .from("project_members")
        .select("project_id")
        .eq("user_id", session.user.id);

      const projectIds = (memberships || []).map((m) => m.project_id);
      if (!projectIds.length) return NextResponse.json([], { status: 200 });
      query = query.in("project_id", projectIds);
    }

    if (workstreamId) query = query.eq("workstream_id", workstreamId);
    if (type) query = query.eq("type", type);
    if (today) {
      const todayStr = new Date().toISOString().split("T")[0];
      query = query.eq("pinned_date", todayStr);
    }

    const { data, error } = await query;
    if (error) throw error;

    const entries = (data || []).map((e) => ({
      ...e,
      assignees: (e.assignees || []).map((a: { user: unknown }) => a.user),
    }));

    return NextResponse.json(entries);
  } catch {
    return unauthorized();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const body = await req.json();
    const { projectId, workstreamId, type, content, pinnedDate, pinnedDateEnd, tags } = body;

    if (!projectId || !workstreamId || !type) {
      return badRequest("projectId, workstreamId, and type are required");
    }

    const role = await checkProjectAccess(db, projectId, session.user.id, "editor");
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const defaultContent = getDefaultContent(type, content);

    const { data, error } = await db
      .from("entries")
      .insert({
        type,
        project_id: projectId,
        workstream_id: workstreamId,
        created_by: session.user.id,
        pinned_date: pinnedDate || null,
        pinned_date_end: pinnedDateEnd || null,
        tags: tags || [],
        content: defaultContent,
      })
      .select(`
        *,
        project:projects(id, name, color),
        workstream:workstreams(id, name, color),
        creator:users!entries_created_by_fkey(id, name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Save initial note version
    if (type === "note" && data) {
      await db.from("note_versions").insert({
        entry_id: data.id,
        version_number: 1,
        content_snapshot: defaultContent,
        saved_by: session.user.id,
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error(err);
    return unauthorized();
  }
}

function getDefaultContent(type: string, override: Record<string, unknown> = {}) {
  const defaults: Record<string, object> = {
    note: { title: "", tiptap_json: {}, is_locked: false, version_number: 1 },
    file: { title: "", description: "" },
    task: { title: "", status: "todo", due_date: null },
    reminder: {
      title: "",
      type_label: "deadline",
      schedule_type: "one_time",
      scheduled_at: null,
      recurrence: null,
      audience_type: "just_me",
      recipient_ids: [],
    },
    link: { url: "", title: "", og_image: null, og_description: null, notes: "" },
  };
  return { ...defaults[type], ...override };
}
