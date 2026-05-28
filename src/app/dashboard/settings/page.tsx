import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { AccountPanel } from "./account-panel";
import { ConnectedAccountsPanel } from "./connected-accounts-panel";
import { getUserStorageUsage } from "@/lib/storage-quota";
import { getProfileById } from "@/lib/db/profiles";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [profile, usage, { data: linkedProviderData }] = await Promise.all([
    getProfileById(session.user.id),
    getUserStorageUsage(session.user.id),
    createAdminClient().rpc("get_user_linked_providers", { p_user_id: session.user.id }),
  ]);

  if (!profile) redirect("/dashboard");

  const linkedProviders: string[] = Array.isArray(linkedProviderData) ? linkedProviderData : [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Settings</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Edit profile</CardTitle>
                <CardDescription>This is what visitors see on your public page.</CardDescription>
              </div>
              {profile.verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500 shrink-0">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified creator
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={profile} />
          </CardContent>
        </Card>

        <ConnectedAccountsPanel linkedProviders={linkedProviders} />

        <AccountPanel
          storageUsage={usage}
          pendingDelete={!!profile.deleted_grace_until}
          graceUntil={profile.deleted_grace_until}
        />
      </div>
    </main>
  );
}
