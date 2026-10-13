"use client";

import { ArrowLeftIcon, CheckIcon, PencilIcon, UsersIcon, XIcon } from "@/components/icons";

export type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  username: string | null;
  owner: string | null;
  affiliateManager: string | null;
  country: string | null;
  whatsapp: string | null;
  followerCount: number | null;
  websiteUrl: string | null;
  referralLink: string | null;
  dateOfReachOut: string | null;
  socialsUrl: string | null;
  closingDate: string | null;
  stageId: string;
  updatedAt: string;
};

type StageOption = { id: string; name: string; order: number; color: string | null };

type Props = {
  lead: LeadDetail;
  groupName: string;
  pipelineName: string;
  stages: StageOption[];
  onClose: () => void;
  onEdit: () => void;
  onChangeStage: (stageId: string) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm text-zinc-200">
        {value === null || value === "" || value === undefined ? "—" : value}
      </span>
    </div>
  );
}

function StageStepper({
  stages,
  currentStageId,
  onChangeStage,
}: {
  stages: StageOption[];
  currentStageId: string;
  onChangeStage: (stageId: string) => void;
}) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const mainStages = sorted.filter((s) => !s.color);
  const terminalStages = sorted.filter((s) => s.color === "green" || s.color === "red");
  const currentIndex = mainStages.findIndex((s) => s.id === currentStageId);
  const currentIsTerminal = terminalStages.some((s) => s.id === currentStageId);

  return (
    <div className="flex items-center gap-6">
      {mainStages.length > 0 && (
        <div className="flex flex-1 items-center">
          {mainStages.map((stage, i) => {
            const isCurrent = stage.id === currentStageId;
            const isDone = !currentIsTerminal && currentIndex !== -1 && i < currentIndex;
            const isPastOrCurrent = currentIsTerminal || isDone || isCurrent;
            return (
              <div key={stage.id} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => onChangeStage(stage.id)}
                  title={stage.name}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full transition-colors ${
                    isCurrent
                      ? "bg-blue-700 px-3 py-1.5 text-xs font-medium text-zinc-100"
                      : "h-6 w-6 items-center justify-center"
                  } ${!isCurrent && isPastOrCurrent ? "bg-blue-500/20 text-blue-300" : ""} ${
                    !isCurrent && !isPastOrCurrent ? "border border-white/15 text-zinc-600 hover:border-white/30" : ""
                  }`}
                >
                  {(isPastOrCurrent || isCurrent) && <CheckIcon className="h-3 w-3 shrink-0" />}
                  {isCurrent && <span className="whitespace-nowrap">{stage.name}</span>}
                </button>
                {i < mainStages.length - 1 && (
                  <div className={`h-px flex-1 ${isPastOrCurrent && i < currentIndex ? "bg-blue-500/40" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {terminalStages.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          {terminalStages.map((stage) => {
            const isCurrent = stage.id === currentStageId;
            const isGreen = stage.color === "green";
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onChangeStage(stage.id)}
                title={stage.name}
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  isGreen
                    ? isCurrent
                      ? "border-emerald-500 bg-emerald-500/30 text-emerald-300"
                      : "border-emerald-500/30 text-emerald-500/60 hover:border-emerald-500/60"
                    : isCurrent
                      ? "border-red-500 bg-red-500/30 text-red-300"
                      : "border-red-500/30 text-red-500/60 hover:border-red-500/60"
                }`}
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeadDetailPanel({ lead, groupName, pipelineName, stages, onClose, onEdit, onChangeStage }: Props) {
  const currentStage = stages.find((s) => s.id === lead.stageId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05060a]">
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />

      <div className="shrink-0 border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              title="Back"
              className="text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-semibold text-blue-300">{lead.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
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
          <p className="mt-1 flex items-center gap-1.5 pl-8 text-sm text-zinc-400">
            <UsersIcon className="h-3.5 w-3.5" />
            {lead.owner}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 pl-8 text-sm text-zinc-400">
          <span>
            Team Pipeline: <span className="text-zinc-200">{groupName}</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span>
            Sub-Pipeline: <span className="text-zinc-200">{pipelineName}</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span>
            Closing Date: <span className="text-zinc-200">{formatDate(lead.closingDate)}</span>
          </span>
        </div>
      </div>

      <div className="shrink-0 border-b border-white/10 px-6 py-5">
        <StageStepper stages={stages} currentStageId={lead.stageId} onChangeStage={onChangeStage} />
        {currentStage && (
          <p className="mt-2 pl-1 text-xs text-zinc-500">
            Currently in <span className="text-zinc-300">{currentStage.name}</span>
          </p>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-white/10 px-6 py-5">
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{lead.notes || "—"}</p>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Other Info</h3>
            <div className="divide-y divide-white/5">
              <InfoRow label="Username" value={lead.username} />
              <InfoRow label="Affiliate Manager" value={lead.affiliateManager} />
              <InfoRow label="Country" value={lead.country} />
              <InfoRow label="WA" value={lead.whatsapp} />
              <InfoRow label="Follower Count" value={lead.followerCount} />
              <InfoRow label="Email of Contact" value={lead.email} />
              <InfoRow label="Website URL" value={lead.websiteUrl} />
              <InfoRow label="Referral Link" value={lead.referralLink} />
              <InfoRow label="Date of Reach Out" value={formatDate(lead.dateOfReachOut)} />
              <InfoRow label="URL of Socials" value={lead.socialsUrl} />
            </div>
          </section>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-5">
          <p className="text-sm text-zinc-600">
            No activity, notes, or files tracked for this lead yet.
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 px-6 py-3">
        <p className="text-xs text-zinc-500">Last modified {formatDate(lead.updatedAt)}</p>
      </div>
    </div>
  );
}
