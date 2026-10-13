"use client";

import { useState } from "react";
import { BuildingIcon, PencilIcon, PlusIcon, UsersIcon, XIcon } from "@/components/icons";
import type { LeadDetail } from "@/components/LeadDetailPanel";

export type EditableLeadField =
  | "username"
  | "affiliateManager"
  | "country"
  | "whatsapp"
  | "followerCount"
  | "email"
  | "websiteUrl"
  | "referralLink"
  | "dateOfReachOut"
  | "socialsUrl";

type StageOption = { id: string; name: string };

type Props = {
  lead: LeadDetail;
  groupName: string;
  pipelineName: string;
  stages: StageOption[];
  onClose: () => void;
  onEdit: () => void;
  onChangeStage: (stageId: string) => void;
  onUpdateField: (field: EditableLeadField, value: string) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EditableInfoRow({
  label,
  field,
  rawValue,
  displayValue,
  type = "text",
  editingField,
  draftValue,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  label: string;
  field: EditableLeadField;
  rawValue: string;
  displayValue: string | number | null;
  type?: "text" | "number" | "date" | "email" | "url";
  editingField: EditableLeadField | null;
  draftValue: string;
  onStartEdit: (field: EditableLeadField, currentRaw: string) => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="-mx-2 flex items-center justify-between gap-4 rounded-md bg-white/[0.04] px-2 py-1.5">
        <span className="shrink-0 text-sm text-zinc-500">{label}</span>
        <input
          autoFocus
          type={type}
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancel();
          }}
          className="w-1/2 rounded border border-blue-500/50 bg-[#0f141f] px-2 py-1 text-right text-sm text-zinc-100 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => onStartEdit(field, rawValue)}
      className="group/row -mx-2 flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.04]"
    >
      <span className="shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="max-w-[160px] truncate text-right text-sm text-zinc-200">
          {displayValue === null || displayValue === "" || displayValue === undefined ? "—" : displayValue}
        </span>
        <PencilIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover/row:opacity-100" />
      </span>
    </div>
  );
}

export function LeadQuickViewPanel({
  lead,
  groupName,
  pipelineName,
  stages,
  onClose,
  onEdit,
  onChangeStage,
  onUpdateField,
}: Props) {
  const [tab, setTab] = useState<"information" | "notes">("information");
  const [editingField, setEditingField] = useState<EditableLeadField | null>(null);
  const [draftValue, setDraftValue] = useState("");

  function startEdit(field: EditableLeadField, currentRaw: string) {
    setEditingField(field);
    setDraftValue(currentRaw);
  }

  function commit() {
    if (editingField) onUpdateField(editingField, draftValue);
    setEditingField(null);
  }

  function cancel() {
    setEditingField(null);
  }

  const rowProps = { editingField, draftValue, onStartEdit: startEdit, onDraftChange: setDraftValue, onCommit: commit, onCancel: cancel };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />

        <div className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between">
            <h2 className="truncate text-lg font-semibold text-blue-300">{lead.name}</h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                className="text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {lead.owner && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
              <UsersIcon className="h-3.5 w-3.5" />
              {lead.owner}
            </p>
          )}

          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Closing Date</span>
              <span className="text-zinc-200">{formatDate(lead.closingDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Team Pipeline</span>
              <span className="text-zinc-200">{groupName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Sub-Pipeline</span>
              <span className="text-zinc-200">{pipelineName}</span>
            </div>
          </div>

          <select
            value={lead.stageId}
            onChange={(e) => onChangeStage(e.target.value)}
            className="mt-4 w-full rounded-full border border-blue-500/30 bg-blue-600/80 px-4 py-2 text-center text-sm font-medium text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#10141f] text-zinc-100">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-5 border-b border-white/10 px-6">
          {(["information", "notes"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t ? "border-emerald-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "information" ? (
            <>
              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Related To</h3>
                <div className="flex flex-col gap-2 text-sm text-zinc-500">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-zinc-600" />
                    —
                  </div>
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-4 w-4 text-zinc-600" />
                    —
                  </div>
                </div>
              </section>

              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Tags</h3>
                <span
                  title="Tags aren't supported yet"
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-500"
                >
                  <PlusIcon className="h-3 w-3" />
                  Tag
                </span>
              </section>

              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">{lead.notes || "—"}</p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Other Info</h3>
                <div className="divide-y divide-white/5">
                  <EditableInfoRow
                    label="Username"
                    field="username"
                    rawValue={lead.username ?? ""}
                    displayValue={lead.username}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Affiliate Manager"
                    field="affiliateManager"
                    rawValue={lead.affiliateManager ?? ""}
                    displayValue={lead.affiliateManager}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Country"
                    field="country"
                    rawValue={lead.country ?? ""}
                    displayValue={lead.country}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="WA"
                    field="whatsapp"
                    rawValue={lead.whatsapp ?? ""}
                    displayValue={lead.whatsapp}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Follower Count"
                    field="followerCount"
                    type="number"
                    rawValue={lead.followerCount?.toString() ?? ""}
                    displayValue={lead.followerCount}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Email of Contact"
                    field="email"
                    type="email"
                    rawValue={lead.email ?? ""}
                    displayValue={lead.email}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Website URL"
                    field="websiteUrl"
                    type="url"
                    rawValue={lead.websiteUrl ?? ""}
                    displayValue={lead.websiteUrl}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Referral Link"
                    field="referralLink"
                    type="url"
                    rawValue={lead.referralLink ?? ""}
                    displayValue={lead.referralLink}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="Date of Reach Out"
                    field="dateOfReachOut"
                    type="date"
                    rawValue={lead.dateOfReachOut ? lead.dateOfReachOut.slice(0, 10) : ""}
                    displayValue={formatDate(lead.dateOfReachOut)}
                    {...rowProps}
                  />
                  <EditableInfoRow
                    label="URL of Socials"
                    field="socialsUrl"
                    type="url"
                    rawValue={lead.socialsUrl ?? ""}
                    displayValue={lead.socialsUrl}
                    {...rowProps}
                  />
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-zinc-500">{lead.notes || "No notes yet."}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 px-6 py-3">
          <p className="text-xs text-zinc-500">Last modified {formatDate(lead.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
