"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, UploadIcon, AnalyticsIcon, MailIcon, SearchIcon, XIcon } from "@/components/icons";
import { EmailComposeModal, type EmailRecipient } from "@/components/EmailComposeModal";
import { CsvImportModal } from "@/components/CsvImportModal";
import { LeadModal, type LeadFormValues, EMPTY_LEAD_FORM } from "@/components/LeadModal";
import { LeadDetailPanel } from "@/components/LeadDetailPanel";
import { LeadQuickViewPanel, type EditableLeadField } from "@/components/LeadQuickViewPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PIPELINE_CATEGORIES } from "@/lib/pipelineCategory";
import { nextOutreachStage } from "@/lib/outreachStages";
import { CHANNEL_LABELS, profileHref, socialPlatform, whatsappHref, type OutreachChannel } from "@/lib/outreachChannels";
import {
  ChannelBadges,
  ChannelPicker,
  ChatIcon,
  InstagramIcon,
  LinkedInIcon,
  WhatsAppIcon,
  lastUsedChannels,
  rememberChannels,
} from "@/components/OutreachChannels";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  order: number;
  stageId: string;
  sourceLeadId: string | null;
  username: string | null;
  firstName: string | null;
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
  outreachChannels: string[];
  updatedAt: string;
};

// The floating "which channel?" bar: after a move into a Contacted stage ("tag"), or to log a DM ("log").
type ChannelPrompt =
  | { mode: "tag"; key: number; eventIds: string[]; title: string; initial: OutreachChannel[]; autoEmail: boolean }
  | { mode: "log"; key: number; lead: Lead; initial: OutreachChannel[] };

type OutreachInfo = { eventIds: string[]; channels: OutreachChannel[]; emailed?: boolean } | null;

type Stage = {
  id: string;
  name: string;
  order: number;
  color: string | null;
  leads: Lead[];
};

type Pipeline = {
  id: string;
  name: string;
  order: number;
  category: string | null;
  stages: Stage[];
};

type PipelineGroup = {
  id: string;
  name: string;
  order: number;
  pipelines: Pipeline[];
};

type Props = {
  userEmail: string;
};

// Lower-case, accents stripped, so "jose" finds "José".
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function leadMatches(lead: Lead, terms: string[]): boolean {
  const haystack = normalize(
    [lead.name, lead.firstName, lead.username, lead.email, lead.country, lead.owner, lead.affiliateManager, lead.whatsapp, lead.websiteUrl, lead.socialsUrl]
      .filter(Boolean)
      .join(" "),
  );
  return terms.every((t) => haystack.includes(t));
}

const MAX_SEARCH_RESULTS = 30;

const STAGE_ACCENT: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
};

export function CrmBoard({ userEmail }: Props) {
  const [groups, setGroups] = useState<PipelineGroup[] | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);

  const [addingLeadStageId, setAddingLeadStageId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [quickViewLead, setQuickViewLead] = useState<Lead | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadModalError, setLeadModalError] = useState<string | null>(null);

  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const [addingPipeline, setAddingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [cloneStagesFrom, setCloneStagesFrom] = useState("");
  const [newPipelineCategory, setNewPipelineCategory] = useState("regional");

  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renamingGroupName, setRenamingGroupName] = useState("");
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const [renamingPipeline, setRenamingPipeline] = useState(false);
  const [renamingPipelineName, setRenamingPipelineName] = useState("");
  const [renamingPipelineCategory, setRenamingPipelineCategory] = useState("");
  const [confirmDeletePipeline, setConfirmDeletePipeline] = useState(false);
  const [deletingPipeline, setDeletingPipeline] = useState(false);

  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [confirmDeleteStageId, setConfirmDeleteStageId] = useState<string | null>(null);
  const [deletingStage, setDeletingStage] = useState(false);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ticked cards (e.g. the leads just emailed), to move together with the bar at the bottom.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetStageId, setMoveTargetStageId] = useState<string | null>(null);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const [channelPrompt, setChannelPrompt] = useState<ChannelPrompt | null>(null);
  const [channelBusy, setChannelBusy] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [outreachVersion, setOutreachVersion] = useState(0);

  const [composeFor, setComposeFor] = useState<EmailRecipient[] | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);

  useEffect(() => {
    // ?select=<lead ids>: arriving from the Emails tab after sending — tick those leads.
    const selectParam = new URLSearchParams(window.location.search).get("select");
    if (selectParam) window.history.replaceState(null, "", "/crm");
    void loadGroups().then((list) => {
      if (selectParam && list) selectEmailed(selectParam.split(",").filter(Boolean), list);
    });
    // Gmail: connection status, any result of the connect flow, and a reply check that may move leads.
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(!!d.connected))
      .catch(() => setGmailConnected(false));
    const result = new URLSearchParams(window.location.search).get("gmail");
    if (result) {
      window.history.replaceState(null, "", "/crm");
      const notice =
        result === "connected"
          ? "Gmail connected — you can now email leads from the CRM."
          : result === "wrong-account"
            ? "Connect the same Google account you're signed in with."
            : "Gmail access wasn't granted, so emails can't be sent yet.";
      void Promise.resolve().then(() => setGmailNotice(notice));
    }
    void fetch("/api/email/sync", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.moved > 0) void loadGroups();
      })
      .catch(() => {});
  }, []);

  async function loadGroups(preferGroupId?: string, preferPipelineId?: string): Promise<PipelineGroup[] | null> {
    setLoadError(null);
    try {
      const res = await fetch("/api/crm/groups");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load CRM (${res.status})`);
      }
      const body = await res.json();
      const list: PipelineGroup[] = body.groups ?? [];
      setGroups(list);

      const nextGroupId = (() => {
        const wanted = preferGroupId ?? activeGroupId;
        if (wanted && list.some((g) => g.id === wanted)) return wanted;
        return list[0]?.id ?? null;
      })();
      setActiveGroupId(nextGroupId);

      const group = list.find((g) => g.id === nextGroupId);
      setActivePipelineId((prev) => {
        const wanted = preferPipelineId ?? prev;
        if (wanted && group?.pipelines.some((p) => p.id === wanted)) return wanted;
        return group?.pipelines[0]?.id ?? null;
      });
      return list;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load CRM");
      return null;
    }
  }

  /**
   * Ticks the cards of these leads (originals or their mirrored copies), staying on the
   * current sub-pipeline if it has any of them, otherwise opening the one with the most.
   */
  function selectEmailed(leadIds: string[], list: PipelineGroup[]) {
    const wanted = new Set(leadIds);
    const matchesIn = (p: Pipeline) =>
      p.stages.flatMap((st) => st.leads).filter((l) => wanted.has(l.id) || (l.sourceLeadId !== null && wanted.has(l.sourceLeadId)));
    let best: { group: PipelineGroup; pipeline: Pipeline; cards: Lead[] } | null = null;
    for (const group of list)
      for (const pipeline of group.pipelines) {
        const cards = matchesIn(pipeline);
        if (!cards.length) continue;
        const isCurrent = pipeline.id === activePipelineId;
        if (isCurrent) best = { group, pipeline, cards };
        if (best?.pipeline.id === activePipelineId) continue;
        if (!best || cards.length > best.cards.length) best = { group, pipeline, cards };
      }
    if (!best) return;
    setActiveGroupId(best.group.id);
    setActivePipelineId(best.pipeline.id);
    setSelectedIds(new Set(best.cards.map((c) => c.id)));
    setMoveTargetStageId(null);
    setBulkNotice(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function moveSelected(cards: Lead[], stageId: string) {
    setBulkMoving(true);
    setBulkNotice(null);
    try {
      const res = await fetch("/api/crm/leads/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: cards.map((c) => c.id), stageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setSelectedIds(new Set());
      setMoveTargetStageId(null);
      setBulkNotice(`Moved ${data.moved} ${data.moved === 1 ? "lead" : "leads"} to ${data.stageName}`);
      const count = (data.outreach as OutreachInfo)?.eventIds.length ?? 0;
      askChannels(data.outreach, `${count} ${count === 1 ? "lead" : "leads"} → ${data.stageName}`);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch (err) {
      setBulkNotice(err instanceof Error ? err.message : "Couldn't move the leads");
    } finally {
      setBulkMoving(false);
    }
  }

  /**
   * After a move into a Contacted stage: ask which channel(s) were used. If the leads were just emailed
   * from the dashboard, that email is already logged, so nothing is pre-ticked and the bar only asks for extras.
   */
  function askChannels(outreach: OutreachInfo, title: string) {
    if (!outreach || outreach.eventIds.length === 0) return;
    const autoEmail = !!outreach.emailed;
    setChannelError(null);
    setChannelPrompt({
      mode: "tag",
      key: Date.now(),
      eventIds: outreach.eventIds,
      title,
      initial: autoEmail ? [] : outreach.channels.length > 0 ? outreach.channels : lastUsedChannels(),
      autoEmail,
    });
  }

  function askLogDm(lead: Lead, preset?: OutreachChannel) {
    setChannelError(null);
    setChannelPrompt({ mode: "log", key: Date.now(), lead, initial: preset ? [preset] : lastUsedChannels().filter((c) => c !== "email") });
  }

  async function confirmChannels(channels: OutreachChannel[]) {
    if (!channelPrompt) return;
    setChannelBusy(true);
    setChannelError(null);
    try {
      const res =
        channelPrompt.mode === "tag"
          ? await fetch("/api/crm/outreach/channels", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventIds: channelPrompt.eventIds, channels }),
            })
          : await fetch(`/api/crm/leads/${channelPrompt.lead.id}/touch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channels }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      rememberChannels(channels);
      setOutreachVersion((v) => v + 1);
      if (channelPrompt.mode === "log") {
        const via = channels.map((c) => CHANNEL_LABELS[c]).join(" + ");
        setBulkNotice(`Logged ${via} reach-out to ${channelPrompt.lead.name} — counts towards this week`);
      }
      setChannelPrompt(null);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : "Couldn't save the channels");
    } finally {
      setChannelBusy(false);
    }
  }

  const activeGroup = useMemo(
    () => groups?.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const activePipeline = useMemo(
    () => activeGroup?.pipelines.find((p) => p.id === activePipelineId) ?? null,
    [activeGroup, activePipelineId],
  );

  // Ticked cards on the board you're looking at, and the stage they'd most naturally go to next.
  const selectedInView = useMemo(
    () => (activePipeline ? activePipeline.stages.flatMap((st) => st.leads.filter((l) => selectedIds.has(l.id))) : []),
    [activePipeline, selectedIds],
  );
  const suggestedStageId = useMemo(() => {
    if (!activePipeline || selectedInView.length === 0) return null;
    const counts = new Map<string, number>();
    for (const l of selectedInView) counts.set(l.stageId, (counts.get(l.stageId) ?? 0) + 1);
    const commonStageId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const current = activePipeline.stages.find((st) => st.id === commonStageId);
    const nextName = current ? nextOutreachStage(current.name) : null;
    const byName = nextName && activePipeline.stages.find((st) => st.name.toLowerCase() === nextName.toLowerCase());
    if (byName) return byName.id;
    const idx = activePipeline.stages.findIndex((st) => st.id === commonStageId);
    return activePipeline.stages[idx + 1]?.id ?? null;
  }, [activePipeline, selectedInView]);
  const moveTarget = moveTargetStageId ?? suggestedStageId ?? "";

  const searchTerms = useMemo(() => normalize(search).split(/\s+/).filter(Boolean), [search]);
  // Matches across every group and sub-pipeline (mirrored copies show once per pipeline they're in).
  const searchResults = useMemo(() => {
    if (!groups || searchTerms.length === 0) return [];
    const out: { lead: Lead; group: PipelineGroup; pipeline: Pipeline; stage: Stage }[] = [];
    for (const group of groups)
      for (const pipeline of group.pipelines)
        for (const stage of pipeline.stages)
          for (const lead of stage.leads) if (leadMatches(lead, searchTerms)) out.push({ lead, group, pipeline, stage });
    return out;
  }, [groups, searchTerms]);

  // "/" focuses the search box (unless typing somewhere already).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openSearchResult(r: (typeof searchResults)[number]) {
    setActiveGroupId(r.group.id);
    setActivePipelineId(r.pipeline.id);
    setHighlightedLeadId(r.lead.id);
    setQuickViewLead(r.lead);
    setSearchOpen(false);
    requestAnimationFrame(() => document.getElementById(`lead-${r.lead.id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }));
  }

  function selectGroup(groupId: string) {
    setActiveGroupId(groupId);
    const group = groups?.find((g) => g.id === groupId);
    setActivePipelineId(group?.pipelines[0]?.id ?? null);
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/crm/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setNewGroupName("");
      setAddingGroup(false);
      await loadGroups(body.group?.id);
    } catch {
      setLoadError("Failed to create pipeline group");
    }
  }

  async function createPipeline() {
    const name = newPipelineName.trim();
    if (!name || !activeGroup) return;
    try {
      const res = await fetch("/api/crm/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineGroupId: activeGroup.id,
          name,
          category: newPipelineCategory || null,
          cloneStagesFrom: cloneStagesFrom || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setNewPipelineName("");
      setCloneStagesFrom("");
      setAddingPipeline(false);
      await loadGroups(activeGroup.id, body.pipeline?.id);
    } catch {
      setLoadError("Failed to create sub-pipeline");
    }
  }

  async function createStage() {
    const name = newStageName.trim();
    if (!name || !activePipeline) return;
    try {
      const res = await fetch("/api/crm/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: activePipeline.id, name }),
      });
      if (!res.ok) throw new Error();
      setNewStageName("");
      setAddingStage(false);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch {
      setLoadError("Failed to create stage");
    }
  }

  async function submitLead(values: LeadFormValues) {
    setSavingLead(true);
    setLeadModalError(null);
    try {
      const shared = {
        name: values.name,
        username: values.username || null,
        firstName: values.firstName || null,
        owner: values.owner || null,
        affiliateManager: values.affiliateManager || null,
        email: values.email || null,
        notes: values.notes || null,
        country: values.country || null,
        whatsapp: values.whatsapp || null,
        followerCount: values.followerCount === "" ? null : Number(values.followerCount),
        websiteUrl: values.websiteUrl || null,
        referralLink: values.referralLink || null,
        dateOfReachOut: values.dateOfReachOut || null,
        socialsUrl: values.socialsUrl || null,
        closingDate: values.closingDate || null,
      };

      if (editingLead) {
        const res = await fetch(`/api/crm/leads/${editingLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(shared),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save");
      } else if (addingLeadStageId) {
        const res = await fetch("/api/crm/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: addingLeadStageId, ...shared }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to save");
      }
      setEditingLead(null);
      setAddingLeadStageId(null);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch (err) {
      setLeadModalError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingLead(false);
    }
  }

  async function deleteLead() {
    if (!editingLead) return;
    setSavingLead(true);
    try {
      const res = await fetch(`/api/crm/leads/${editingLead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEditingLead(null);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch {
      setLeadModalError("Failed to delete");
    } finally {
      setSavingLead(false);
    }
  }

  async function moveLead(leadId: string, targetStageId: string) {
    if (!groups) return;
    const sourceStage = activePipeline?.stages.find((s) => s.leads.some((l) => l.id === leadId));
    const lead = sourceStage?.leads.find((l) => l.id === leadId);
    if (!lead || !sourceStage || sourceStage.id === targetStageId) return;

    // Optimistic move
    setGroups((prev) =>
      prev?.map((g) => {
        if (g.id !== activeGroupId) return g;
        return {
          ...g,
          pipelines: g.pipelines.map((p) => {
            if (p.id !== activePipelineId) return p;
            return {
              ...p,
              stages: p.stages.map((s) => {
                if (s.id === sourceStage.id) return { ...s, leads: s.leads.filter((l) => l.id !== leadId) };
                if (s.id === targetStageId)
                  return { ...s, leads: [...s.leads, { ...lead, stageId: targetStageId }] };
                return s;
              }),
            };
          }),
        };
      }) ?? null,
    );

    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: targetStageId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      const targetName = activePipeline?.stages.find((s) => s.id === targetStageId)?.name ?? "Contacted";
      askChannels(data.outreach ?? null, `${lead.name} → ${targetName}`);
      if (data.outreach?.channels?.length || data.outreach?.emailed) {
        setOutreachVersion((v) => v + 1);
        await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
      }
    } catch {
      setLoadError("Failed to move card — reloading");
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    }
  }

  async function changeViewingLeadStage(stageId: string) {
    if (!viewingLead) return;
    await moveLead(viewingLead.id, stageId);
    setViewingLead((prev) => (prev ? { ...prev, stageId } : null));
  }

  async function changeQuickViewLeadStage(stageId: string) {
    if (!quickViewLead) return;
    await moveLead(quickViewLead.id, stageId);
    setQuickViewLead((prev) => (prev ? { ...prev, stageId } : null));
  }

  async function updateQuickViewLeadField(field: EditableLeadField, value: string) {
    if (!quickViewLead) return;
    const parsedValue: string | number | null =
      field === "followerCount" ? (value === "" ? null : Number(value)) : value === "" ? null : value;

    // Optimistic update — patch both the open panel and the underlying board state directly,
    // so a full tree refetch isn't needed on every keystroke-commit.
    setQuickViewLead((prev) => (prev ? ({ ...prev, [field]: parsedValue } as Lead) : null));
    setGroups((prev) =>
      prev?.map((g) => {
        if (g.id !== activeGroupId) return g;
        return {
          ...g,
          pipelines: g.pipelines.map((p) => {
            if (p.id !== activePipelineId) return p;
            return {
              ...p,
              stages: p.stages.map((s) => ({
                ...s,
                leads: s.leads.map((l) => (l.id === quickViewLead.id ? ({ ...l, [field]: parsedValue } as Lead) : l)),
              })),
            };
          }),
        };
      }) ?? null,
    );

    try {
      const res = await fetch(`/api/crm/leads/${quickViewLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parsedValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLoadError("Failed to save field — reloading");
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    }
  }

  async function moveStage(stageId: string, targetStageId: string) {
    if (!activePipeline || stageId === targetStageId) return;
    const stages = [...activePipeline.stages];
    const fromIndex = stages.findIndex((s) => s.id === stageId);
    const toIndex = stages.findIndex((s) => s.id === targetStageId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = stages.splice(fromIndex, 1);
    stages.splice(toIndex, 0, moved);
    const reordered = stages.map((s, i) => ({ ...s, order: i }));

    // Optimistic reorder
    setGroups((prev) =>
      prev?.map((g) => {
        if (g.id !== activeGroupId) return g;
        return {
          ...g,
          pipelines: g.pipelines.map((p) =>
            p.id === activePipelineId ? { ...p, stages: reordered } : p,
          ),
        };
      }) ?? null,
    );

    try {
      const results = await Promise.all(
        reordered.map((s) =>
          fetch(`/api/crm/stages/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: s.order }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      setLoadError("Failed to save new stage order — reloading");
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    }
  }

  async function renameGroup() {
    const name = renamingGroupName.trim();
    if (!name || !activeGroup) return;
    try {
      const res = await fetch(`/api/crm/groups/${activeGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setRenamingGroup(false);
      await loadGroups(activeGroup.id, activePipelineId ?? undefined);
    } catch {
      setLoadError("Failed to rename group");
    }
  }

  async function deleteGroup() {
    if (!activeGroup) return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/crm/groups/${activeGroup.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmDeleteGroup(false);
      setActiveGroupId(null);
      setActivePipelineId(null);
      await loadGroups();
    } catch {
      setLoadError("Failed to delete group");
    } finally {
      setDeletingGroup(false);
    }
  }

  async function renamePipeline() {
    const name = renamingPipelineName.trim();
    if (!name || !activePipeline) return;
    try {
      const res = await fetch(`/api/crm/pipelines/${activePipeline.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: renamingPipelineCategory || null }),
      });
      if (!res.ok) throw new Error();
      setRenamingPipeline(false);
      await loadGroups(activeGroupId ?? undefined, activePipeline.id);
    } catch {
      setLoadError("Failed to rename sub-pipeline");
    }
  }

  async function deletePipeline() {
    if (!activePipeline) return;
    setDeletingPipeline(true);
    try {
      const res = await fetch(`/api/crm/pipelines/${activePipeline.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmDeletePipeline(false);
      setActivePipelineId(null);
      await loadGroups(activeGroupId ?? undefined);
    } catch {
      setLoadError("Failed to delete sub-pipeline");
    } finally {
      setDeletingPipeline(false);
    }
  }

  async function saveStageEdit() {
    if (!editingStage) return;
    const name = editStageName.trim();
    if (!name) return;
    setSavingStage(true);
    try {
      const res = await fetch(`/api/crm/stages/${editingStage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: editStageColor || null }),
      });
      if (!res.ok) throw new Error();
      setEditingStage(null);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch {
      setLoadError("Failed to save stage");
    } finally {
      setSavingStage(false);
    }
  }

  async function deleteStage(stageId: string) {
    setDeletingStage(true);
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmDeleteStageId(null);
      await loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
    } catch {
      setLoadError("Failed to delete stage");
    } finally {
      setDeletingStage(false);
    }
  }

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full flex-col gap-4 px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">CRM</h1>
            <p className="mt-0.5 text-sm text-zinc-500">Track leads through your pipelines</p>
          </div>
          <div className="relative mx-4 max-w-xl flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setHighlightedLeadId(null);
                  e.currentTarget.blur();
                }
                if (e.key === "Enter" && searchResults[0]) openSearchResult(searchResults[0]);
              }}
              placeholder="Search"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setHighlightedLeadId(null);
                }}
                title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {searchOpen && searchTerms.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[28rem] overflow-y-auto rounded-lg border border-white/10 bg-[#10141f] shadow-2xl">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-zinc-500">No leads match &ldquo;{search}&rdquo;</p>
                ) : (
                  <>
                    {searchResults.slice(0, MAX_SEARCH_RESULTS).map((r) => (
                      <button
                        key={`${r.pipeline.id}-${r.lead.id}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openSearchResult(r)}
                        className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-white/5"
                      >
                        <span className="text-sm text-zinc-100">
                          {r.lead.name}
                          {r.lead.country && <span className="text-zinc-500"> ({r.lead.country})</span>}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {r.pipeline.name} › {r.stage.name}
                          {r.lead.owner && ` · ${r.lead.owner}`}
                          {r.lead.email && ` · ${r.lead.email}`}
                        </span>
                      </button>
                    ))}
                    {searchResults.length > MAX_SEARCH_RESULTS && (
                      <p className="px-3 py-2 text-xs text-zinc-500">
                        Showing {MAX_SEARCH_RESULTS} of {searchResults.length} — type more to narrow it down
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {gmailConnected !== null &&
              (gmailConnected ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-300" title="Emails go out from your Gmail">
                  <MailIcon className="h-3.5 w-3.5" />
                  Gmail connected
                </span>
              ) : (
                <a
                  href="/api/gmail/connect"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
                >
                  <MailIcon className="h-3.5 w-3.5" />
                  Connect Gmail
                </a>
              ))}
            <Link
              href="/crm/analytics"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
            >
              <AnalyticsIcon className="h-3.5 w-3.5" />
              Analytics
            </Link>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              Import CSV
            </button>
          </div>
        </div>

        {loadError && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{loadError}</p>
        )}
        {gmailNotice && (
          <p className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
            {gmailNotice}
            <button type="button" onClick={() => setGmailNotice(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
              Dismiss
            </button>
          </p>
        )}

        {!groups && !loadError && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-white/5" />
            ))}
          </div>
        )}

        {groups && (
          <>
            {/* Level 1: pipeline groups */}
            <div className="flex flex-wrap items-center gap-2">
              {groups.length > 0 && (
                <select
                  value={activeGroupId ?? ""}
                  onChange={(e) => selectGroup(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[#10141f] text-zinc-100">
                      {g.name}
                    </option>
                  ))}
                </select>
              )}

              {activeGroup && !renamingGroup && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingGroup(true);
                      setRenamingGroupName(activeGroup.name);
                    }}
                    title="Rename group"
                    className="text-zinc-500 transition-colors hover:text-zinc-200"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteGroup(true)}
                    title="Delete group"
                    className="text-zinc-500 transition-colors hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              )}
              {renamingGroup && (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={renamingGroupName}
                    onChange={(e) => setRenamingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void renameGroup();
                      if (e.key === "Escape") setRenamingGroup(false);
                    }}
                    className="rounded-lg border border-blue-500/50 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void renameGroup()}
                    className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-sm text-zinc-100 hover:bg-blue-600"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingGroup(false)}
                    className="text-sm text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {addingGroup ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void createGroup();
                      if (e.key === "Escape") setAddingGroup(false);
                    }}
                    placeholder="Group name"
                    className="rounded-lg border border-blue-500/50 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void createGroup()}
                    className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-sm text-zinc-100 hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingGroup(true)}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-white/10 px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  New group
                </button>
              )}
            </div>

            {/* Level 2: sub-pipelines within the active group */}
            {activeGroup && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
                {activeGroup.pipelines.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {/* Main overview pipeline(s) such as Affiliates Standard on top, category dropdowns below */}
                    <div className="flex flex-wrap gap-1.5">
                      {activeGroup.pipelines
                        .filter((p) => !PIPELINE_CATEGORIES.some((c) => c.value === p.category))
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setActivePipelineId(p.id)}
                            className={`w-56 truncate rounded-md border px-2.5 py-1 text-left text-xs font-medium transition-colors ${
                              p.id === activePipelineId
                                ? "border-blue-500/60 bg-blue-500/15 text-zinc-100"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PIPELINE_CATEGORIES.map((c) => {
                        const inCategory = activeGroup.pipelines.filter((p) => p.category === c.value);
                        const isActive = inCategory.some((p) => p.id === activePipelineId);
                        return (
                          <select
                            key={c.value}
                            value={isActive ? (activePipelineId ?? "") : ""}
                            onChange={(e) => e.target.value && setActivePipelineId(e.target.value)}
                            className={`w-56 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium outline-none transition-colors focus:ring-1 focus:ring-blue-500/50 ${
                              isActive
                                ? "border-blue-500/60 bg-blue-500/15 text-zinc-100"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                          >
                            <option value="" disabled className="bg-[#10141f] text-zinc-500">
                              {c.label}
                            </option>
                            {inCategory.map((p) => (
                              <option key={p.id} value={p.id} className="bg-[#10141f] text-zinc-100">
                                {p.name}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activePipeline && !renamingPipeline && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingPipeline(true);
                        setRenamingPipelineName(activePipeline.name);
                        setRenamingPipelineCategory(activePipeline.category ?? "");
                      }}
                      title="Rename sub-pipeline"
                      className="text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    {/* The main overview pipeline (no category, e.g. Affiliates Standard) can't be deleted */}
                    {activePipeline.category && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePipeline(true)}
                        title="Delete sub-pipeline"
                        className="text-zinc-500 transition-colors hover:text-red-400"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
                {renamingPipeline && (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={renamingPipelineName}
                      onChange={(e) => setRenamingPipelineName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void renamePipeline();
                        if (e.key === "Escape") setRenamingPipeline(false);
                      }}
                      className="rounded-md border border-blue-500/50 bg-white/5 px-2 py-1 text-xs text-zinc-100 outline-none"
                    />
                    <select
                      value={renamingPipelineCategory}
                      onChange={(e) => setRenamingPipelineCategory(e.target.value)}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
                    >
                      <option value="" className="bg-[#10141f]">Main (top of list)</option>
                      {PIPELINE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#10141f]">
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void renamePipeline()}
                      className="rounded-md bg-blue-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingPipeline(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {addingPipeline ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Sub-pipeline name"
                      className="rounded-md border border-blue-500/50 bg-white/5 px-2 py-1 text-xs text-zinc-100 outline-none"
                    />
                    <select
                      value={newPipelineCategory}
                      onChange={(e) => setNewPipelineCategory(e.target.value)}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
                    >
                      {PIPELINE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#10141f]">
                          {c.label}
                        </option>
                      ))}
                      <option value="" className="bg-[#10141f]">Main (top of list)</option>
                    </select>
                    <select
                      value={cloneStagesFrom}
                      onChange={(e) => setCloneStagesFrom(e.target.value)}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
                    >
                      <option value="" className="bg-[#10141f]">
                        Start with no stages
                      </option>
                      {activeGroup.pipelines.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#10141f]">
                          Copy stages from &quot;{p.name}&quot;
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void createPipeline()}
                      className="rounded-md bg-blue-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-blue-600"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingPipeline(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingPipeline(true)}
                    className="flex items-center gap-1 rounded-md border border-dashed border-white/10 px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/5"
                  >
                    <PlusIcon className="h-3 w-3" />
                    New sub-pipeline
                  </button>
                )}
              </div>
            )}

            {/* Kanban board for the active sub-pipeline */}
            {activePipeline && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {activePipeline.stages.map((stage) => {
                  const isBeingDraggedStage = draggedStageId === stage.id;
                  const isDragActive = draggedStageId !== null || draggedLeadId !== null;
                  const isValidDropTarget = isDragActive && draggedStageId !== stage.id;
                  const isHovered = isValidDropTarget && dragOverStageId === stage.id;

                  return (
                  <div
                    key={stage.id}
                    className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-[#10141f] transition-all duration-150 ${
                      isBeingDraggedStage
                        ? "scale-[0.97] border-white/[0.08] opacity-40"
                        : isHovered
                          ? "scale-[1.015] border-blue-400 bg-blue-500/[0.07] shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/40"
                          : isValidDropTarget
                            ? "border-dashed border-blue-500/30"
                            : "border-white/[0.08]"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (isValidDropTarget && dragOverStageId !== stage.id) setDragOverStageId(stage.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverStageId(null);
                      const stageId = e.dataTransfer.getData("application/x-stage-id") || draggedStageId;
                      if (stageId) {
                        void moveStage(stageId, stage.id);
                        setDraggedStageId(null);
                        return;
                      }
                      const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
                      if (leadId) void moveLead(leadId, stage.id);
                      setDraggedLeadId(null);
                    }}
                  >
                    <div className={`h-1 w-full ${STAGE_ACCENT[stage.color ?? ""] ?? "bg-white/10"}`} />
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-stage-id", stage.id);
                        setDraggedStageId(stage.id);
                      }}
                      onDragEnd={() => {
                        setDraggedStageId(null);
                        setDragOverStageId(null);
                      }}
                      className="group/stage flex cursor-grab items-start justify-between gap-2 px-3.5 py-3 active:cursor-grabbing"
                      title="Drag to reorder this stage"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-zinc-100">{stage.name}</h3>
                        <p className="text-xs text-zinc-500">
                          {searchTerms.length > 0
                            ? `${stage.leads.filter((l) => leadMatches(l, searchTerms)).length} of ${stage.leads.length} match`
                            : `${stage.leads.length} ${stage.leads.length === 1 ? "lead" : "leads"}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/stage:opacity-100">
                        {stage.leads.some((l) => l.email) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setComposeFor(stage.leads.map((l) => ({ ...l, stageName: stage.name })));
                            }}
                            title="Email leads in this stage"
                            className="text-zinc-500 transition-colors hover:text-zinc-200"
                          >
                            <MailIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStage(stage);
                            setEditStageName(stage.name);
                            setEditStageColor(stage.color ?? "");
                          }}
                          title="Edit stage"
                          className="text-zinc-500 transition-colors hover:text-zinc-200"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteStageId(stage.id);
                          }}
                          title="Delete stage"
                          className="text-zinc-500 transition-colors hover:text-red-400"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex min-h-[60px] flex-1 flex-col gap-2 px-2.5 pb-2.5">
                      {(searchTerms.length > 0 ? stage.leads.filter((l) => leadMatches(l, searchTerms)) : stage.leads).map((lead) => (
                        <div
                          key={lead.id}
                          id={`lead-${lead.id}`}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", lead.id);
                            setDraggedLeadId(lead.id);
                          }}
                          onDragEnd={() => {
                            setDraggedLeadId(null);
                            setDragOverStageId(null);
                          }}
                          onClick={() => setViewingLead(lead)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setViewingLead(lead);
                          }}
                          className={`group/lead cursor-grab rounded-lg border px-3 py-2.5 text-left transition-all duration-150 active:cursor-grabbing ${
                            highlightedLeadId === lead.id ? "ring-2 ring-blue-500/70 " : ""
                          }${selectedIds.has(lead.id) ? "!border-blue-500/60 !bg-blue-500/10 " : ""}${
                            draggedLeadId === lead.id
                              ? "rotate-2 scale-95 border-blue-500/50 bg-white/[0.03] opacity-40 shadow-lg"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead.id)}
                              onChange={() => toggleSelected(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              title="Select to move with others"
                              className={`mt-0.5 shrink-0 cursor-pointer accent-blue-500 transition-opacity ${
                                selectedIds.size > 0 ? "opacity-100" : "opacity-0 group-hover/lead:opacity-100"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-100">{lead.name}</p>
                              {lead.email && (
                                <p className="mt-0.5 truncate text-xs text-zinc-500">{lead.email}</p>
                              )}
                              {lead.outreachChannels?.length > 0 && (
                                <div className="mt-1.5">
                                  <ChannelBadges channels={lead.outreachChannels} />
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/lead:opacity-100">
                              <ProfileLink lead={lead} onOpen={(platform) => askLogDm(lead, platform)} />
                              <WhatsAppLink lead={lead} onOpen={() => askLogDm(lead, "whatsapp")} />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  askLogDm(lead);
                                }}
                                title="Log a DM (Instagram, LinkedIn, WhatsApp…)"
                                className="text-zinc-500 transition-colors hover:text-zinc-200"
                              >
                                <ChatIcon className="h-3.5 w-3.5" />
                              </button>
                              {lead.email && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setComposeFor([{ ...lead, stageName: stage.name }]);
                                  }}
                                  title="Email"
                                  className="text-zinc-500 transition-colors hover:text-zinc-200"
                                >
                                  <MailIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickViewLead(lead);
                                }}
                                title="Quick view"
                                className="text-zinc-500 transition-colors hover:text-zinc-200"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLead(lead);
                                }}
                                title="Edit"
                                className="text-zinc-500 transition-colors hover:text-zinc-200"
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddingLeadStageId(stage.id)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add lead
                      </button>
                    </div>
                  </div>
                  );
                })}

                <div className="flex w-56 shrink-0 flex-col gap-2">
                  {addingStage ? (
                    <div className="rounded-xl border border-blue-500/40 bg-[#10141f] p-3">
                      <input
                        autoFocus
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void createStage();
                          if (e.key === "Escape") setAddingStage(false);
                        }}
                        placeholder="Stage name"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddingStage(false)}
                          className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void createStage()}
                          className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-blue-600"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingStage(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add stage
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeGroup && !activePipeline && (
              <p className="text-sm text-zinc-500">
                No sub-pipelines yet in &quot;{activeGroup.name}&quot; — add one above.
              </p>
            )}
          </>
        )}
        {channelPrompt &&
          (channelPrompt.mode === "tag" ? (
            <ChannelPicker
              key={channelPrompt.key}
              title={
                <>
                  Reached via? <span className="font-normal text-zinc-400">{channelPrompt.title}</span>
                </>
              }
              hint={channelPrompt.autoEmail ? "The email is already logged from the send. Tick any DMs too, or skip." : "Pick all that apply"}
              initial={channelPrompt.initial}
              confirmLabel="Save"
              busy={channelBusy}
              error={channelError}
              onConfirm={(channels) => void confirmChannels(channels)}
              onSkip={() => setChannelPrompt(null)}
            />
          ) : (
            <ChannelPicker
              key={channelPrompt.key}
              title={
                <>
                  Log a reach-out <span className="font-normal text-zinc-400">to {channelPrompt.lead.name}</span>
                </>
              }
              hint="Stays in its stage · counts as contacted this week"
              initial={channelPrompt.initial}
              confirmLabel="Log"
              requireOne
              busy={channelBusy}
              error={channelError}
              onConfirm={(channels) => void confirmChannels(channels)}
              onSkip={() => setChannelPrompt(null)}
            />
          ))}
        {!channelPrompt && (selectedInView.length > 0 || bulkNotice) && activePipeline && (
          <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-blue-500/40 bg-[#10141f]/95 px-4 py-3 shadow-2xl backdrop-blur">
            {selectedInView.length > 0 ? (
              <>
                <span className="text-sm font-medium text-zinc-100">
                  {selectedInView.length} {selectedInView.length === 1 ? "lead" : "leads"} selected
                </span>
                <span className="text-sm text-zinc-400">Move to</span>
                <select
                  value={moveTarget}
                  onChange={(e) => setMoveTargetStageId(e.target.value)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="" disabled className="bg-[#10141f]">
                    Pick a stage…
                  </option>
                  {activePipeline.stages.map((st) => (
                    <option key={st.id} value={st.id} className="bg-[#10141f]">
                      {st.name}
                      {st.id === suggestedStageId ? " (suggested)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!moveTarget || bulkMoving}
                  onClick={() => void moveSelected(selectedInView, moveTarget)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-blue-500 disabled:opacity-50"
                >
                  {bulkMoving ? "Moving…" : "Move"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setMoveTargetStageId(null);
                  }}
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear selection
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-zinc-200">{bulkNotice}</span>
                <button type="button" onClick={() => setBulkNotice(null)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">
                  Dismiss
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {(editingLead || addingLeadStageId) && (
        <LeadModal
          title={editingLead ? "Edit lead" : "Add lead"}
          submitLabel={editingLead ? "Save changes" : "Add lead"}
          initialValues={
            editingLead
              ? {
                  ...EMPTY_LEAD_FORM,
                  name: editingLead.name,
                  username: editingLead.username ?? "",
                  firstName: editingLead.firstName ?? "",
                  owner: editingLead.owner ?? "",
                  affiliateManager: editingLead.affiliateManager ?? "",
                  email: editingLead.email ?? "",
                  notes: editingLead.notes ?? "",
                  country: editingLead.country ?? "",
                  whatsapp: editingLead.whatsapp ?? "",
                  followerCount: editingLead.followerCount?.toString() ?? "",
                  websiteUrl: editingLead.websiteUrl ?? "",
                  referralLink: editingLead.referralLink ?? "",
                  dateOfReachOut: editingLead.dateOfReachOut ? editingLead.dateOfReachOut.slice(0, 10) : "",
                  socialsUrl: editingLead.socialsUrl ?? "",
                  closingDate: editingLead.closingDate ? editingLead.closingDate.slice(0, 10) : "",
                }
              : undefined
          }
          submitting={savingLead}
          error={leadModalError}
          onCancel={() => {
            setEditingLead(null);
            setAddingLeadStageId(null);
            setLeadModalError(null);
          }}
          onSubmit={(values) => void submitLead(values)}
          onDelete={editingLead ? () => void deleteLead() : undefined}
        />
      )}

      {viewingLead && activePipeline && (
        <LeadDetailPanel
          lead={viewingLead}
          groupName={activeGroup?.name ?? ""}
          pipelineName={activePipeline.name}
          stages={activePipeline.stages.map((s) => ({ id: s.id, name: s.name, order: s.order, color: s.color }))}
          onClose={() => setViewingLead(null)}
          onEdit={() => {
            setEditingLead(viewingLead);
            setViewingLead(null);
          }}
          onChangeStage={(stageId) => void changeViewingLeadStage(stageId)}
          outreachVersion={outreachVersion}
          onOutreachChanged={() => void loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined)}
        />
      )}

      {composeFor && activePipeline && (
        <EmailComposeModal
          recipients={composeFor}
          pipelineName={activePipeline.name}
          onClose={() => setComposeFor(null)}
          onSent={() => void loadGroups(activeGroupId ?? undefined, activePipeline.id)}
          onContinue={(ids) => {
            setComposeFor(null);
            void loadGroups(activeGroupId ?? undefined, activePipeline.id).then((list) => list && selectEmailed(ids, list));
          }}
        />
      )}

      {quickViewLead && activePipeline && (
        <LeadQuickViewPanel
          lead={quickViewLead}
          groupName={activeGroup?.name ?? ""}
          pipelineName={activePipeline.name}
          stages={activePipeline.stages.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setQuickViewLead(null)}
          onEdit={() => {
            setEditingLead(quickViewLead);
            setQuickViewLead(null);
          }}
          onChangeStage={(stageId) => void changeQuickViewLeadStage(stageId)}
          onUpdateField={(field, value) => void updateQuickViewLeadField(field, value)}
        />
      )}

      {editingStage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingStage(null);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-100">Edit stage</h2>
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</label>
                <input
                  autoFocus
                  value={editStageName}
                  onChange={(e) => setEditStageName(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Color</label>
                <div className="flex items-center gap-2">
                  {[
                    { value: "", label: "None", dot: "bg-white/20" },
                    { value: "green", label: "Green", dot: "bg-emerald-500" },
                    { value: "red", label: "Red", dot: "bg-red-500" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditStageColor(opt.value)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        editStageColor === opt.value
                          ? "border-blue-500/50 bg-blue-500/10 text-zinc-100"
                          : "border-white/10 text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveStageEdit()}
                disabled={savingStage || !editStageName.trim()}
                className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingStage ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGroup && activeGroup && (
        <ConfirmDialog
          title="Delete pipeline group?"
          message={`This permanently deletes "${activeGroup.name}" and every sub-pipeline, stage, and lead inside it. This can't be undone.`}
          confirmLabel="Delete group"
          confirmingLabel="Deleting…"
          confirming={deletingGroup}
          onCancel={() => setConfirmDeleteGroup(false)}
          onConfirm={() => void deleteGroup()}
        />
      )}

      {confirmDeletePipeline && activePipeline && (
        <ConfirmDialog
          title="Delete sub-pipeline?"
          message={`This permanently deletes "${activePipeline.name}" and every stage and lead inside it. This can't be undone.`}
          confirmLabel="Delete sub-pipeline"
          confirmingLabel="Deleting…"
          confirming={deletingPipeline}
          onCancel={() => setConfirmDeletePipeline(false)}
          onConfirm={() => void deletePipeline()}
        />
      )}

      {confirmDeleteStageId && (
        <ConfirmDialog
          title="Delete stage?"
          message="This permanently deletes this stage and every lead card in it. This can't be undone."
          confirmLabel="Delete stage"
          confirmingLabel="Deleting…"
          confirming={deletingStage}
          onCancel={() => setConfirmDeleteStageId(null)}
          onConfirm={() => void deleteStage(confirmDeleteStageId)}
        />
      )}

      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            void loadGroups(activeGroupId ?? undefined, activePipelineId ?? undefined);
          }}
        />
      )}
    </div>
  );
}

/** Opens the lead's Instagram/LinkedIn/other profile in a new tab, then offers to log the DM. */
function ProfileLink({ lead, onOpen }: { lead: Lead; onOpen: (platform: OutreachChannel) => void }) {
  const href = profileHref(lead.socialsUrl);
  const platform = socialPlatform(lead.socialsUrl);
  if (!href || !platform) return null;
  // A WhatsApp link in the socials field is covered by WhatsAppLink when the number field is set.
  if (platform === "whatsapp" && whatsappHref(lead.whatsapp)) return null;
  const label = platform === "other" ? "Open profile" : `Open ${CHANNEL_LABELS[platform]} ${platform === "whatsapp" ? "chat" : "profile"}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(platform);
      }}
      title={`${label} (then log the DM)`}
      className="text-zinc-500 transition-colors hover:text-zinc-200"
    >
      {platform === "instagram" ? (
        <InstagramIcon className="h-3.5 w-3.5" />
      ) : platform === "whatsapp" ? (
        <WhatsAppIcon className="h-3.5 w-3.5" />
      ) : platform === "linkedin" ? (
        <LinkedInIcon className="h-3.5 w-3.5" />
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      )}
    </a>
  );
}

/** Opens a WhatsApp chat with the lead's number, then offers to log the message. */
function WhatsAppLink({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const href = whatsappHref(lead.whatsapp);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title="Open WhatsApp chat (then log the message)"
      className="text-zinc-500 transition-colors hover:text-zinc-200"
    >
      <WhatsAppIcon className="h-3.5 w-3.5" />
    </a>
  );
}
