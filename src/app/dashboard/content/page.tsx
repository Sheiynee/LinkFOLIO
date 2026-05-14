import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BlockList } from "./block-list";
import type { Block } from "@/lib/blocks";

export default async function ContentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, title, url, content, visible, widget_kind, meta")
    .eq("user_id", session.user.id)
    .order("position", { ascending: true });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Content</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Your blocks</CardTitle>
            <CardDescription>
              Mix links, text, headings, dividers, and live widgets to build your page. Drag to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BlockList initial={(blocks ?? []) as Block[]} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
