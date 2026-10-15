"use client";

import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ArrowLeftIcon } from "@/components/icons";
import { WeeklyOutreachSection } from "@/components/WeeklyOutreachSection";

type Props = {
  userEmail: string;
};

export function CrmAnalyticsBoard({ userEmail }: Props) {
  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <div>
          <Link
            href="/crm"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to CRM
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Weekly outreach against targets</p>
        </div>

        <WeeklyOutreachSection />
      </main>
    </div>
  );
}
