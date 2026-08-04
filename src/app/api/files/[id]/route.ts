import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, checkProjectAccess } from "@/lib/api-helpers";
import { deleteFromR2, getR2PublicUrl } from "@/lib/r2";

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

    await deleteFromR2(file.r2_object_key);
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

    const url = getR2PublicUrl(file.r2_object_key);

    return NextResponse.json({ url, file });
  } catch {
    return unauthorized();
  }
}
