import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, badRequest, checkProjectAccess } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const entryId = formData.get("entryId") as string;

    if (!file || !entryId) return badRequest("file and entryId required");
    if (file.size > 20 * 1024 * 1024) return badRequest("File must be under 20MB");

    // Verify entry access
    const { data: entry } = await db
      .from("entries")
      .select("project_id")
      .eq("id", entryId)
      .single();

    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const role = await checkProjectAccess(db, entry.project_id, session.user.id, "editor");
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const storagePath = `entries/${entryId}/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    const adminDb = createServiceClient();
    const { error: uploadError } = await adminDb.storage
      .from("ruang-files")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: fileRecord, error: dbError } = await db
      .from("files")
      .insert({
        entry_id: entryId,
        filename: file.name,
        size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json(fileRecord, { status: 201 });
  } catch (err) {
    console.error(err);
    return unauthorized();
  }
}
