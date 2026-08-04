import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { createServiceClient } from "./supabase";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return { session, db: createServiceClient() };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function checkProjectAccess(
  db: ReturnType<typeof createServiceClient>,
  projectId: string,
  userId: string,
  minRole: "viewer" | "editor" | "owner" = "viewer"
) {
  const { data } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const roles = ["viewer", "editor", "owner"];
  if (roles.indexOf(data.role) < roles.indexOf(minRole)) return null;

  return data.role as string;
}
