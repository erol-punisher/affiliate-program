import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { OnboardingBoard } from "@/components/OnboardingBoard";

export default async function Onboarding() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <OnboardingBoard userEmail={session.email} />;
}
