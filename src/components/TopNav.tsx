"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReleasitLogo } from "@/components/ReleasitLogo";
import { ManageAccessModal } from "@/components/ManageAccessModal";

const TABS = [
  { href: "/", label: "Affiliates" },
  { href: "/payments", label: "Payment Records" },
  { href: "/crm", label: "CRM" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/applications", label: "Applications" },
  { href: "/contracts", label: "Contracts" },
  { href: "/documentation", label: "Documentation" },
  { href: "/templates", label: "Templates" },
];

type Props = {
  userEmail: string;
};

export function TopNav({ userEmail }: Props) {
  const pathname = usePathname();
  const [showManageAccess, setShowManageAccess] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-4">
        <ReleasitLogo />
        <div className="h-8 w-px bg-white/10" />
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowManageAccess(true)}
          className="whitespace-nowrap rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
        >
          Manage access
        </button>
        <span className="hidden text-xs text-zinc-500 sm:inline">{userEmail}</span>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
          >
            Sign out
          </button>
        </form>
      </div>

      {showManageAccess && (
        <ManageAccessModal currentUserEmail={userEmail} onClose={() => setShowManageAccess(false)} />
      )}
    </div>
  );
}
