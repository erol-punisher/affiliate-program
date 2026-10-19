"use client";

import { useState } from "react";
import { XIcon } from "@/components/icons";

export type LeadFormValues = {
  name: string;
  username: string;
  firstName: string;
  owner: string;
  affiliateManager: string;
  email: string;
  notes: string;
  country: string;
  whatsapp: string;
  followerCount: string;
  websiteUrl: string;
  referralLink: string;
  dateOfReachOut: string;
  socialsUrl: string;
  closingDate: string;
};

export const EMPTY_LEAD_FORM: LeadFormValues = {
  name: "",
  username: "",
  firstName: "",
  owner: "",
  affiliateManager: "",
  email: "",
  notes: "",
  country: "",
  whatsapp: "",
  followerCount: "",
  websiteUrl: "",
  referralLink: "",
  dateOfReachOut: "",
  socialsUrl: "",
  closingDate: "",
};

type Props = {
  title: string;
  submitLabel: string;
  initialValues?: LeadFormValues;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: LeadFormValues) => void;
  onDelete?: () => void;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
      />
    </div>
  );
}

export function LeadModal({
  title,
  submitLabel,
  initialValues,
  submitting,
  error,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const [values, setValues] = useState<LeadFormValues>(initialValues ?? EMPTY_LEAD_FORM);

  function set<K extends keyof LeadFormValues>(key: K, v: LeadFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#10141f] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!values.name.trim()) return;
            onSubmit(values);
          }}
        >
          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <Field label="Username" value={values.username} onChange={(v) => set("username", v)} />
            <Field label="First name (for emails)" value={values.firstName} onChange={(v) => set("firstName", v)} />
            <Field
              label="Affiliate Name"
              value={values.name}
              onChange={(v) => set("name", v)}
              required
              autoFocus
            />
            <Field label="Owner" value={values.owner} onChange={(v) => set("owner", v)} />
            <Field
              label="Affiliate Manager"
              value={values.affiliateManager}
              onChange={(v) => set("affiliateManager", v)}
            />
            <Field label="Country" value={values.country} onChange={(v) => set("country", v)} />
            <Field label="WA" value={values.whatsapp} onChange={(v) => set("whatsapp", v)} />
            <Field
              label="Follower Count"
              value={values.followerCount}
              onChange={(v) => set("followerCount", v)}
              type="number"
            />
            <Field
              label="Email of Contact"
              value={values.email}
              onChange={(v) => set("email", v)}
              type="email"
            />
            <Field
              label="Website URL"
              value={values.websiteUrl}
              onChange={(v) => set("websiteUrl", v)}
              type="url"
            />
            <Field
              label="Referral Link"
              value={values.referralLink}
              onChange={(v) => set("referralLink", v)}
              type="url"
            />
            <Field
              label="Date of Reach Out"
              value={values.dateOfReachOut}
              onChange={(v) => set("dateOfReachOut", v)}
              type="date"
            />
            <Field
              label="URL of Socials"
              value={values.socialsUrl}
              onChange={(v) => set("socialsUrl", v)}
              type="url"
            />
            <Field
              label="Closing Date"
              value={values.closingDate}
              onChange={(v) => set("closingDate", v)}
              type="date"
            />
          </div>

          <div className="flex flex-col gap-1.5 px-6 pb-5">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</label>
            <textarea
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="A few words about this affiliate"
              className="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          {error && <p className="px-6 pb-4 text-sm text-red-400">{error}</p>}

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-white/10 bg-[#10141f] px-6 py-4">
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={submitting}
                className="rounded-lg border border-red-500/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !values.name.trim()}
                className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Saving…" : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
