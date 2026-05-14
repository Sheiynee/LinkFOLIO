import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "./onboarding-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <main className="min-h-screen bg-background">
      <OnboardingFlow />
    </main>
  );
}
