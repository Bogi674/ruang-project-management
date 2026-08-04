"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Workstream } from "@/types";

const PRESET_COLORS = [
  "#8b5cf6", "#6366f1", "#0ea5e9", "#22c55e",
  "#f97316", "#ec4899", "#14b8a6", "#eab308",
];

interface WorkstreamFormProps {
  workstream?: Workstream;
  projectId: string;
  onSubmit: (data: { name: string; description: string; color: string }) => Promise<void>;
  onCancel?: () => void;
}

export default function WorkstreamForm({ workstream, onSubmit, onCancel }: WorkstreamFormProps) {
  const [name, setName] = useState(workstream?.name || "");
  const [description, setDescription] = useState(workstream?.description || "");
  const [color, setColor] = useState(workstream?.color || PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), color });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Workstream name</Label>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Design, Engineering, Marketing"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this workstream cover?"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                outline: color === c ? `3px solid ${c}` : "none",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? "Saving..." : workstream ? "Save changes" : "Create workstream"}
        </Button>
      </div>
    </form>
  );
}
