import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingFlow } from "./onboarding-flow";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { rerun?: string };
}

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", session.user.id)
    .single();

  // If the user already finished onboarding, show a guard unless they
  // explicitly opted in with ?rerun=1.
  if (profile?.onboarded_at && searchParams.rerun !== "1") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">You&apos;ve already done this</h1>
          <p className="text-sm text-muted-foreground">
            Your page is ready. You can keep editing it from the dashboard, or
            re-run the setup flow to add more widgets — existing ones won&apos;t be
            duplicated.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
            <Button variant="outline" render={<Link href="/onboarding?rerun=1" />}>
              Re-run setup
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <OnboardingFlow />
    </main>
  );
}
