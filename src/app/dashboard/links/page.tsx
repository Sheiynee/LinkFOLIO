import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkList } from "./link-list";

export default async function LinksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: links } = await supabase
    .from("links")
    .select("id, title, url")
    .eq("user_id", session.user.id)
    .order("position", { ascending: true });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Links</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Your links</CardTitle>
            <CardDescription>These show up on your public page.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkList initial={links ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
