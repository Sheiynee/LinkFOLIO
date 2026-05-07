"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile, uploadAvatar } from "./actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  initial: {
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  };
}

export function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [uploadPending, startUpload] = useTransition();
  const [message, setMessage] = useState<{ ok?: boolean; text: string } | null>(null);
  const [avatar, setAvatar] = useState(initial.avatar_url);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) setMessage({ text: result.error });
      else setMessage({ ok: true, text: "Saved" });
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      const result = await uploadAvatar(formData);
      if (result.error) setMessage({ text: result.error });
      else if (result.url) {
        setAvatar(result.url);
        setMessage({ ok: true, text: "Avatar updated" });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={avatar ?? ""} />
          <AvatarFallback className="text-2xl">
            {initial.display_name?.[0] ?? initial.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <Label htmlFor="avatar" className="cursor-pointer">
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              {uploadPending ? "Uploading..." : "Change avatar"}
            </span>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={uploadPending}
            />
          </Label>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 2MB</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username (your page URL)</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">linkfolio.app/</span>
          <Input
            id="username"
            name="username"
            defaultValue={initial.username}
            required
            pattern="[a-z0-9_\-]{3,30}"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">3-30 chars, lowercase letters, numbers, _ or -</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={initial.display_name ?? ""}
          placeholder="Your full name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio ?? ""}
          placeholder="Tell visitors about yourself"
          rows={3}
          maxLength={280}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
        {message && (
          <span className={message.ok ? "text-sm text-green-600" : "text-sm text-destructive"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
