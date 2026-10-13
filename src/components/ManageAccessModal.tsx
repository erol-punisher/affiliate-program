"use client";

import { useEffect, useState } from "react";
import { TrashIcon, XIcon } from "@/components/icons";

type AllowedUserRow = {
  id: string;
  email: string;
  addedBy: string | null;
  createdAt: string;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ManageAccessModal({ currentUserEmail, onClose }: { currentUserEmail: string; onClose: () => void }) {
  const [users, setUsers] = useState<AllowedUserRow[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- fetch-on-mount, load() is only ever called here
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/admin/allowed-users");
      if (!res.ok) throw new Error();
      const body = await res.json();
      setUsers(body.users ?? []);
    } catch {
      setUsers([]);
    }
  }

  async function addUser() {
    const email = newEmail.trim();
    if (!email) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/allowed-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to add");
      setUsers((prev) => (prev?.some((u) => u.id === body.user.id) ? prev : [...(prev ?? []), body.user]));
      setNewEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function removeUser(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/allowed-users/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to remove");
      setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  const enforced = (users?.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Manage access</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {enforced
                ? "Only these people can log in, on top of any domain restriction already in place."
                : "No one's been added yet — everyone allowed by the domain restriction can log in. Add someone below to start restricting access to just these people."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          {users === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map((u) => {
                const isSelf = u.email === currentUserEmail.toLowerCase();
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-100">
                        {u.email}
                        {isSelf && <span className="ml-1.5 text-xs text-zinc-500">(you)</span>}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Added {formatDate(u.createdAt)}
                        {u.addedBy ? ` by ${u.addedBy}` : ""}
                      </p>
                    </div>
                    {isSelf ? (
                      <span title="You can't remove your own access" className="shrink-0 text-zinc-700">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : confirmingDeleteId === u.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void removeUser(u.id)}
                          className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(u.id)}
                        className="shrink-0 text-zinc-500 transition-colors hover:text-red-400"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addUser();
                  }}
                  placeholder="teammate@company.com"
                  className="w-full rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => void addUser()}
                  className="shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
