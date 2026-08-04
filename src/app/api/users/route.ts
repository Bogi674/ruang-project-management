import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await requireAuth();
    const search = req.nextUrl.searchParams.get("q");

    // Admin can list all users; others only get themselves + project members
    let query = db
      .from("users")
      .select("id, public_id, name, email, avatar_url, role, created_at");

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (session.user.role !== "admin") {
      // Only return project members
      const { data: memberships } = await db
        .from("project_members")
        .select("project_id")
        .eq("user_id", session.user.id);

      const projectIds = (memberships || []).map((m) => m.project_id);
      if (!projectIds.length) {
        return NextResponse.json([]);
      }

      const { data: members } = await db
        .from("project_members")
        .select("user_id")
        .in("project_id", projectIds);

      const seen = new Set<string>();
      const userIds = (members || []).map((m) => m.user_id).filter((id) => { if (seen.has(id)) return false; seen.add(id); return true; });
      query = query.in("id", userIds);
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return unauthorized();
  }
}

