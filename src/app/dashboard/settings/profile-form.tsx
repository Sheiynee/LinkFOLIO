"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile, uploadAvatar, checkUsernameAvailable } from "./actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Loader2, X } from "lucide-react";

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
  const [username, setUsername] = useState(initial.username);
  const [usernameStatus, setUsernameStatus] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "available" }
    | { state: "unavailable"; reason: string }
  >({ state: "idle" });

  useEffect(() => {
    if (username === initial.username) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    setUsernameStatus({ state: "checking" });
    const handle = setTimeout(async () => {
      const result = await checkUsernameAvailable(username);
      if (result.available) {
        setUsernameStatus({ state: "available" });
      } else {
        setUsernameStatus({ state: "unavailable", reason: result.reason ?? "Unavailable" });
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [username, initial.username]);

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
          <div className="relative flex-1">
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              pattern="[a-z0-9_\-]{3,30}"
              className="pr-9"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              {usernameStatus.state === "checking" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {usernameStatus.state === "available" && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {usernameStatus.state === "unavailable" && (
                <X className="h-4 w-4 text-destructive" />
              )}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {usernameStatus.state === "unavailable"
            ? <span className="text-destructive">{usernameStatus.reason}</span>
            : usernameStatus.state === "available"
            ? <span className="text-green-600">Available</span>
            : "3-30 chars, lowercase letters, numbers, _ or -"}
        </p>
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
        <Button type="submit" disabled={pending || usernameStatus.state === "unavailable" || usernameStatus.state === "checking"}>
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
