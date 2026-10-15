"use client";

import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, UploadIcon, AnalyticsIcon } from "@/components/icons";
import { CsvImportModal } from "@/components/CsvImportModal";
import { LeadModal, type LeadFormValues, EMPTY_LEAD_FORM } from "@/components/LeadModal";
import { LeadDetailPanel } from "@/components/LeadDetailPanel";
import { LeadQuickViewPanel, type EditableLeadField } from "@/components/LeadQuickViewPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PIPELINE_CATEGORIES } from "@/lib/pipelineCategory";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  order: number;
  stageId: string;
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
  updatedAt: string;
};

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

  useEffect(() => {
    void loadGroups();
  }, []);

  async function loadGroups(preferGroupId?: string, preferPipelineId?: string) {
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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load CRM");
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
          <div className="flex shrink-0 items-center gap-2">
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
                  <select
                    value={activePipelineId ?? ""}
                    onChange={(e) => setActivePipelineId(e.target.value)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    {/* Main overview pipelines (no category) first, then one section per category */}
                    {activeGroup.pipelines
                      .filter((p) => !PIPELINE_CATEGORIES.some((c) => c.value === p.category))
                      .map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#10141f] text-zinc-100">
                          {p.name}
                        </option>
                      ))}
                    {PIPELINE_CATEGORIES.map((c) => {
                      const inCategory = activeGroup.pipelines.filter((p) => p.category === c.value);
                      if (inCategory.length === 0) return null;
                      return (
                        <optgroup key={c.value} label={c.label} className="bg-[#10141f] text-zinc-500">
                          {inCategory.map((p) => (
                            <option key={p.id} value={p.id} className="bg-[#10141f] text-zinc-100">
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
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
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePipeline(true)}
                      title="Delete sub-pipeline"
                      className="text-zinc-500 transition-colors hover:text-red-400"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
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
                          {stage.leads.length} {stage.leads.length === 1 ? "lead" : "leads"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/stage:opacity-100">
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
                      {stage.leads.map((lead) => (
                        <div
                          key={lead.id}
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
                            draggedLeadId === lead.id
                              ? "rotate-2 scale-95 border-blue-500/50 bg-white/[0.03] opacity-40 shadow-lg"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-100">{lead.name}</p>
                              {lead.email && (
                                <p className="mt-0.5 truncate text-xs text-zinc-500">{lead.email}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/lead:opacity-100">
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
