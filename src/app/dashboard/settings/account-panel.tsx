"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Trash2, Undo2 } from "lucide-react";
import {
  cancelAccountDeletion,
  exportUserData,
  softDeleteAccount,
} from "./account-actions";
import type { QuotaState } from "@/lib/storage-quota";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AccountPanel({
  storageUsage,
  pendingDelete,
  graceUntil,
}: {
  storageUsage: QuotaState;
  pendingDelete: boolean;
  graceUntil: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    startTransition(async () => {
      const res = await exportUserData();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `linkfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await softDeleteAccount();
      if (res.error) setError(res.error);
      setConfirming(false);
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelAccountDeletion();
      if (res.error) setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Storage, data export, and account deletion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Storage usage */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-sm">
            <span className="font-medium">Storage</span>
            <span className="text-muted-foreground">
              {fmtBytes(storageUsage.bytesUsed)} / {fmtBytes(storageUsage.quotaBytes)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${storageUsage.percentUsed}%` }}
            />
          </div>
        </div>

        {/* Data export */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-sm">Export data</div>
            <p className="text-xs text-muted-foreground">
              Download everything we hold for you as JSON.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={pending}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        </div>

        {/* Danger zone */}
        <div className="rounded-md border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-sm">Danger zone</span>
          </div>

          {pendingDelete ? (
            <>
              <p className="text-sm text-muted-foreground">
                Your account is scheduled for deletion on{" "}
                <span className="font-medium text-foreground">
                  {graceUntil ? new Date(graceUntil).toLocaleDateString() : "soon"}
                </span>
                . Until then everything is paused but recoverable.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={pending}>
                <Undo2 className="h-4 w-4 mr-1.5" /> Cancel deletion
              </Button>
            </>
          ) : confirming ? (
            <>
              <p className="text-sm text-foreground">
                This will mark your account for deletion. You have 30 days to undo it before the
                data is permanently wiped.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
                  Yes, delete my account
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
                  Never mind
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Delete your profile, page, blocks, elements, fonts, and uploads. 30-day grace
                period before anything is permanent.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={pending}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete account
              </Button>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
