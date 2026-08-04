"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, UserPlus, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectForm from "@/components/projects/ProjectForm";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import type { Project, ProjectMember } from "@/types";

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/members`).then((r) => r.json()),
    ]).then(([proj, mems]) => {
      setProject(proj);
      setMembers(mems);
      setLoading(false);
    });
  }, [id]);

  const updateProject = async (data: { name: string; description: string; color: string }) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
  };

  const deleteProject = async () => {
    if (!confirm(`Delete "${project?.name}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projects");
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, memberRole: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.invited) {
          setInviteMsg(`Invitation sent to ${inviteEmail}`);
        } else {
          setMembers((prev) => [...prev, data]);
          setInviteMsg(`Added ${inviteEmail} as ${inviteRole}`);
        }
        setInviteEmail("");
      } else {
        setInviteMsg(data.error || "Failed to invite");
      }
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/projects/${id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return null;

  const isOwner = project.member_role === "owner";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href={`/projects/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to {project.name}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-8">Project Settings</h1>

      {/* Edit project */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-4">General</h2>
        <ProjectForm project={project} onSubmit={updateProject} />
      </section>

      <Separator />

      {/* Members */}
      <section className="my-8">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Members ({members.length})
        </h2>

        <div className="space-y-3 mb-6">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.user?.avatar_url || ""} />
                <AvatarFallback className="text-xs">
                  {getInitials(member.user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.user?.email}</p>
              </div>
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                {member.role}
              </span>
              {isOwner && member.role !== "owner" && (
                <button
                  onClick={() => removeMember(member.user_id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Invite */}
        {isOwner && (
          <form onSubmit={inviteMember} className="space-y-3">
            <Label className="text-sm font-medium">Invite member</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={inviting || !inviteEmail}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Invite
              </Button>
            </div>
            {inviteMsg && (
              <p className="text-xs text-muted-foreground">{inviteMsg}</p>
            )}
          </form>
        )}
      </section>

      {/* Danger zone */}
      {isOwner && (
        <>
          <Separator />
          <section className="mt-8">
            <h2 className="text-base font-semibold text-destructive mb-4">Danger Zone</h2>
            <div className="border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete this project</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently deletes all workstreams, entries, and files.
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={deleteProject}>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Project
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
