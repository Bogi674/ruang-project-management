import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: file } = await db
      .from("files")
      .select("*, entry:entries(project_id)")
      .eq("id", params.id)
      .single();

    if (!file) return notFound("File not found");

    const projectId = (file.entry as { project_id: string })?.project_id;
    const role = await checkProjectAccess(db, projectId, session.user.id, "editor");
    if (!role) return notFound("File not found");

    const adminDb = createServiceClient();
    await adminDb.storage.from("ruang-files").remove([file.storage_path]);
    await db.from("files").delete().eq("id", params.id);

    return new NextResponse(null, { status: 204 });
  } catch {
    return unauthorized();
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await requireAuth();

    const { data: file } = await db
      .from("files")
      .select("*, entry:entries(project_id)")
      .eq("id", params.id)
      .single();

    if (!file) return notFound("File not found");

    const projectId = (file.entry as { project_id: string })?.project_id;
    const role = await checkProjectAccess(db, projectId, session.user.id);
    if (!role) return notFound("File not found");

    const adminDb = createServiceClient();
    const { data } = adminDb.storage
      .from("ruang-files")
      .getPublicUrl(file.storage_path);

    return NextResponse.json({ url: data.publicUrl, file });
  } catch {
    return unauthorized();
  }
}
