"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";

type Props = {
  userEmail: string;
};

function todayFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const FIELD_REFERENCE: { label: string; hint: string; example: string }[] = [
  { label: "Talent full name", hint: "Their legal name, exactly as it should appear on the signed contract.", example: "Péter Kallós" },
  { label: "Talent address", hint: "Full mailing address, written out as one line.", example: "Faknó utca 20/b, Budapest, 1115, Hungary" },
  { label: "Role / title", hint: "Just the role itself — the sentence is built for you.", example: "ecommerce mentor" },
  { label: "Talent email", hint: "Their contact email from the application or WhatsApp.", example: "kpeterb82@gmail.com" },
  { label: "Effective date", hint: "The date the agreement is made or signed.", example: "15/06/2026" },
  {
    label: "Referral link slug",
    hint: "Just the part after /codform/ — reuse their existing code if they already have one.",
    example: "nocodeai",
  },
];

/** "an" before a vowel sound, "a" otherwise — covers the common case; the article button can override it. */
function detectArticle(roleTitle: string): "a" | "an" {
  return /^[aeiou]/i.test(roleTitle.trim()) ? "an" : "a";
}

export function ContractGenerator({ userEmail }: Props) {
  const [talentName, setTalentName] = useState("");
  const [talentAddress, setTalentAddress] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleArticle, setRoleArticle] = useState<"a" | "an">("a");
  const [articleTouched, setArticleTouched] = useState(false);
  const [talentEmail, setTalentEmail] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayFormatted);
  const [referralSlug, setReferralSlug] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRoleTitle(value: string) {
    setRoleTitle(value);
    if (!articleTouched) setRoleArticle(detectArticle(value));
  }

  function setArticle(article: "a" | "an") {
    setArticleTouched(true);
    setRoleArticle(article);
  }

  const roleTitleTrimmed = roleTitle.trim();
  const roleEndsWithPunctuation = /[.!?]$/.test(roleTitleTrimmed);
  const talentRoleLine = roleTitleTrimmed
    ? `is ${roleArticle} ${roleTitleTrimmed}${roleEndsWithPunctuation ? "" : "."}`
    : "";

  const canSubmit =
    talentName.trim() &&
    talentAddress.trim() &&
    roleTitleTrimmed &&
    talentEmail.trim() &&
    effectiveDate.trim() &&
    referralSlug.trim();

  async function generate() {
    if (!canSubmit || isGenerating) return;
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          talentName: talentName.trim(),
          talentAddress: talentAddress.trim(),
          talentRoleLine: talentRoleLine.trim(),
          talentEmail: talentEmail.trim(),
          effectiveDate: effectiveDate.trim(),
          referralSlug: referralSlug.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to generate contract (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = talentName.trim().replace(/[^\w\- ]/g, "").trim().replace(/\s+/g, "_") || "Affiliate";
      link.download = `${safeName}_Releasit_Affiliate_Contract.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate contract");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />
          <div className="border-b border-white/10 px-6 py-5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Contract Generator</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Fills in the standard Releasit affiliate contract and downloads a ready-to-sign .docx
            </p>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            {error && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Talent full name</span>
              <input
                type="text"
                value={talentName}
                onChange={(e) => setTalentName(e.target.value)}
                placeholder="e.g. Péter Kallós"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Talent address</span>
              <input
                type="text"
                value={talentAddress}
                onChange={(e) => setTalentAddress(e.target.value)}
                placeholder="e.g. Faknó utca 20/b, Budapest, 1115, Hungary"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Role / title</span>
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10">
                  {(["a", "an"] as const).map((article) => (
                    <button
                      key={article}
                      type="button"
                      onClick={() => setArticle(article)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        roleArticle === article ? "bg-blue-700 text-zinc-100" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      {article}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => updateRoleTitle(e.target.value)}
                  placeholder="e.g. ecommerce mentor"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              <span className="text-xs text-zinc-600">
                Just the role itself — the full sentence (shown below) is built for you, so you can&apos;t forget the
                &quot;is a/an&quot; part.
              </span>
              {talentRoleLine && (
                <p className="mt-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
                  <span className="text-zinc-500">Background will read: </span>
                  {talentName.trim() || "{Talent name}"} {talentRoleLine}
                </p>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Talent email</span>
              <input
                type="email"
                value={talentEmail}
                onChange={(e) => setTalentEmail(e.target.value)}
                placeholder="e.g. contact@trsdesign.ro"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Effective date</span>
                <input
                  type="text"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Referral link slug</span>
                <input
                  type="text"
                  value={referralSlug}
                  onChange={(e) => setReferralSlug(e.target.value.replace(/\s+/g, ""))}
                  placeholder="e.g. nocodeai"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </label>
            </div>
            {referralSlug.trim() && (
              <p className="-mt-3 text-xs text-zinc-600">
                Full link: <span className="text-zinc-400">https://releas.it/codform/{referralSlug.trim()}</span>
              </p>
            )}

            <button
              type="button"
              onClick={() => void generate()}
              disabled={!canSubmit || isGenerating}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate contract"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60 lg:sticky lg:top-8">
          <div className="h-1 w-full bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-500" />
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">What goes where</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Based on real, already-signed contracts</p>
          </div>
          <div className="divide-y divide-white/5">
            {FIELD_REFERENCE.map((item) => (
              <div key={item.label} className="px-5 py-4">
                <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.hint}</p>
                <code className="mt-2 inline-block max-w-full whitespace-normal break-words rounded-md border border-blue-500/20 bg-blue-500/[0.07] px-2 py-1 font-mono text-xs text-blue-300/90">
                  {item.example}
                </code>
              </div>
            ))}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
