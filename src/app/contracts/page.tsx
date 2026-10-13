import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ContractGenerator } from "@/components/ContractGenerator";

export default async function ContractsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <ContractGenerator userEmail={session.email} />;
}
