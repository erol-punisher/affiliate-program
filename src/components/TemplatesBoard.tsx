"use client";

import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { PlusIcon, TrashIcon, CheckIcon } from "@/components/icons";

type Props = {
  userEmail: string;
};

type TemplateStep = {
  id: string;
  cadenceId: string;
  label: string;
  content: string;
  order: number;
};

type TemplateCadence = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  steps: TemplateStep[];
};

export function TemplatesBoard({ userEmail }: Props) {
  const [cadences, setCadences] = useState<TemplateCadence[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newCadenceName, setNewCadenceName] = useState("");
  const [confirmingDeleteCadenceId, setConfirmingDeleteCadenceId] = useState<string | null>(null);
  const [draggedCadenceId, setDraggedCadenceId] = useState<string | null>(null);
  const [dragOverCadenceId, setDragOverCadenceId] = useState<string | null>(null);

  const [newStepLabel, setNewStepLabel] = useState("");
  const [newStepContent, setNewStepContent] = useState("");
  const [confirmingDeleteStepId, setConfirmingDeleteStepId] = useState<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/templates/cadences");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      const loaded: TemplateCadence[] = data.cadences ?? [];
      setCadences(loaded);
      setSelectedId((prev) => prev ?? loaded[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    }
  }

  const selectedCadence = useMemo(
    () => cadences?.find((c) => c.id === selectedId) ?? null,
    [cadences, selectedId],
  );

  async function addCadence() {
    const name = newCadenceName.trim();
    if (!name) return;
    setNewCadenceName("");
    try {
      const res = await fetch("/api/templates/cadences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const { cadence } = await res.json();
      setCadences((prev) => [...(prev ?? []), cadence]);
      setSelectedId(cadence.id);
    } catch {
      setError("Failed to create cadence");
    }
  }

  async function renameCadence(id: string, name: string) {
    setCadences((prev) => prev?.map((c) => (c.id === id ? { ...c, name } : c)) ?? null);
    try {
      const res = await fetch(`/api/templates/cadences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  }

  async function deleteCadence(id: string) {
    setCadences((prev) => prev?.filter((c) => c.id !== id) ?? null);
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/templates/cadences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  }

  async function reorderCadences(orderedIds: string[]) {
    setCadences((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
    });
    try {
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          fetch(`/api/templates/cadences/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      await load();
    }
  }

  function handleCadenceDrop(targetId: string) {
    if (!draggedCadenceId || draggedCadenceId === targetId || !cadences) return;
    const ids = cadences.map((c) => c.id);
    const fromIndex = ids.indexOf(draggedCadenceId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    void reorderCadences(ids);
  }

  async function addStep() {
    const label = newStepLabel.trim();
    const content = newStepContent.trim();
    if (!label || !content || !selectedCadence) return;
    setNewStepLabel("");
    setNewStepContent("");
    try {
      const res = await fetch("/api/templates/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadenceId: selectedCadence.id, label, content }),
      });
      if (!res.ok) throw new Error();
      const { step } = await res.json();
      setCadences(
        (prev) =>
          prev?.map((c) => (c.id === selectedCadence.id ? { ...c, steps: [...c.steps, step] } : c)) ?? null,
      );
    } catch {
      setError("Failed to create template");
    }
  }

  async function updateStep(id: string, patch: Partial<Pick<TemplateStep, "label" | "content" | "order">>) {
    if (!selectedCadence) return;
    const cadenceId = selectedCadence.id;
    setCadences(
      (prev) =>
        prev?.map((c) =>
          c.id === cadenceId ? { ...c, steps: c.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : c,
        ) ?? null,
    );
    try {
      const res = await fetch(`/api/templates/steps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  }

  async function deleteStep(id: string) {
    if (!selectedCadence) return;
    const cadenceId = selectedCadence.id;
    setCadences(
      (prev) => prev?.map((c) => (c.id === cadenceId ? { ...c, steps: c.steps.filter((s) => s.id !== id) } : c)) ?? null,
    );
    try {
      const res = await fetch(`/api/templates/steps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  }

  async function reorderSteps(orderedIds: string[]) {
    if (!selectedCadence) return;
    const cadenceId = selectedCadence.id;
    setCadences((prev) => {
      if (!prev) return prev;
      return prev.map((c) => {
        if (c.id !== cadenceId) return c;
        const byId = new Map(c.steps.map((s) => [s.id, s]));
        return { ...c, steps: orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i })) };
      });
    });
    try {
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          fetch(`/api/templates/steps/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      await load();
    }
  }

  function handleStepDrop(targetId: string) {
    if (!draggedStepId || draggedStepId === targetId || !selectedCadence) return;
    const ids = selectedCadence.steps.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedStepId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    void reorderSteps(ids);
  }

  async function copyStep(step: TemplateStep) {
    try {
      await navigator.clipboard.writeText(step.content);
      setCopiedStepId(step.id);
      setTimeout(() => setCopiedStepId((prev) => (prev === step.id ? null : prev)), 1500);
    } catch {
      setError("Couldn't copy to clipboard");
    }
  }

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full gap-6 px-6 py-8">
        {/* Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h1 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cadences</h1>
          </div>

          {cadences === null ? (
            <p className="px-1 text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1">
              {cadences.length === 0 && (
                <p className="px-1 pb-2 text-sm text-zinc-500">No cadences yet — add one below.</p>
              )}
              {cadences.map((cadence) => {
                const isDragged = draggedCadenceId === cadence.id;
                const isHovered =
                  draggedCadenceId !== null && draggedCadenceId !== cadence.id && dragOverCadenceId === cadence.id;
                const active = selectedId === cadence.id;
                return (
                  <div
                    key={cadence.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedCadenceId(cadence.id);
                    }}
                    onDragEnd={() => {
                      setDraggedCadenceId(null);
                      setDragOverCadenceId(null);
                    }}
                    onDragOver={(e) => {
                      if (draggedCadenceId && draggedCadenceId !== cadence.id) {
                        e.preventDefault();
                        if (dragOverCadenceId !== cadence.id) setDragOverCadenceId(cadence.id);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCadenceDrop(cadence.id);
                      setDraggedCadenceId(null);
                      setDragOverCadenceId(null);
                    }}
                    onClick={() => setSelectedId(cadence.id)}
                    className={`group flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-150 active:cursor-grabbing ${
                      isDragged
                        ? "scale-95 border-white/10 opacity-40"
                        : isHovered
                          ? "scale-[1.01] border-blue-500/50 ring-2 ring-blue-500/40"
                          : active
                            ? "border-blue-500/30 bg-blue-500/10 text-zinc-100"
                            : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{cadence.name}</span>
                    <span className="shrink-0 text-xs text-zinc-600">{cadence.steps.length}</span>
                    {confirmingDeleteCadenceId === cadence.id ? (
                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteCadence(cadence.id);
                            setConfirmingDeleteCadenceId(null);
                          }}
                          className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteCadenceId(null)}
                          className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteCadenceId(cadence.id);
                        }}
                        className="hidden shrink-0 text-zinc-500 transition-colors hover:text-red-400 group-hover:block"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 px-1">
            <input
              type="text"
              value={newCadenceName}
              onChange={(e) => setNewCadenceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addCadence();
              }}
              placeholder="New cadence…"
              className="w-full min-w-0 rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button
              type="button"
              onClick={() => void addCadence()}
              className="flex shrink-0 items-center justify-center rounded-lg bg-blue-700 p-2 text-zinc-100 transition-colors hover:bg-blue-600"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">
          {error && (
            <p className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {!selectedCadence ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-zinc-500">
              {cadences === null ? "Loading…" : "Pick a cadence on the left, or create a new one."}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <input
                  type="text"
                  defaultValue={selectedCadence.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== selectedCadence.name) void renameCadence(selectedCadence.id, name);
                    else e.target.value = selectedCadence.name;
                  }}
                  key={selectedCadence.id}
                  className="w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-semibold text-zinc-100 outline-none focus:border-white/10 focus:bg-white/5"
                />
                <p className="mt-1 px-1 text-sm text-zinc-500">
                  {selectedCadence.steps.length} template{selectedCadence.steps.length === 1 ? "" : "s"} — drag to
                  reorder, use {"{{placeholders}}"} for anything that changes per affiliate.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {selectedCadence.steps.map((step) => {
                  const isDragged = draggedStepId === step.id;
                  const isHovered = draggedStepId !== null && draggedStepId !== step.id && dragOverStepId === step.id;
                  return (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedStepId(step.id);
                      }}
                      onDragEnd={() => {
                        setDraggedStepId(null);
                        setDragOverStepId(null);
                      }}
                      onDragOver={(e) => {
                        if (draggedStepId && draggedStepId !== step.id) {
                          e.preventDefault();
                          if (dragOverStepId !== step.id) setDragOverStepId(step.id);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleStepDrop(step.id);
                        setDraggedStepId(null);
                        setDragOverStepId(null);
                      }}
                      className={`overflow-hidden rounded-2xl border bg-[#10141f] shadow-xl shadow-black/40 transition-all duration-150 ${
                        isDragged ? "scale-95 opacity-40" : isHovered ? "ring-2 ring-blue-500/40" : "border-white/[0.08]"
                      }`}
                    >
                      <div className="flex cursor-grab items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-3 active:cursor-grabbing">
                        <input
                          type="text"
                          defaultValue={step.label}
                          onBlur={(e) => {
                            const label = e.target.value.trim();
                            if (label && label !== step.label) void updateStep(step.id, { label });
                            else e.target.value = step.label;
                          }}
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent text-sm font-medium text-zinc-200 outline-none focus:border-white/10 focus:bg-white/5"
                        />
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyStep(step)}
                            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5"
                          >
                            {copiedStepId === step.id ? (
                              <>
                                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> Copied
                              </>
                            ) : (
                              "Copy"
                            )}
                          </button>
                          {confirmingDeleteStepId === step.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteStep(step.id);
                                  setConfirmingDeleteStepId(null);
                                }}
                                className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteStepId(null)}
                                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteStepId(step.id)}
                              className="text-zinc-500 transition-colors hover:text-red-400"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        defaultValue={step.content}
                        onBlur={(e) => {
                          const content = e.target.value.trim();
                          if (content && content !== step.content) void updateStep(step.id, { content });
                          else e.target.value = step.content;
                        }}
                        rows={4}
                        className="w-full resize-y bg-transparent px-5 py-4 text-sm leading-relaxed text-zinc-300 outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <div className="flex flex-col gap-3 px-5 py-4">
                  <input
                    type="text"
                    value={newStepLabel}
                    onChange={(e) => setNewStepLabel(e.target.value)}
                    placeholder="New template label, e.g. &quot;Day 3 — First content idea&quot;"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                  <textarea
                    value={newStepContent}
                    onChange={(e) => setNewStepContent(e.target.value)}
                    placeholder="Message text, e.g. &quot;Hi {{first_name}}, ...&quot;"
                    rows={3}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => void addStep()}
                    disabled={!newStepLabel.trim() || !newStepContent.trim()}
                    className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add template
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
