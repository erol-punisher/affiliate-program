"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Edit the sender's email signature: import it from Gmail, or type/paste into
 * the box (formatting, links and images are kept). Saved per person.
 */
export function SignatureEditor({ onSaved }: { onSaved?: (html: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"import" | "save" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [empty, setEmpty] = useState(true);

  function show(html: string) {
    if (boxRef.current) boxRef.current.innerHTML = html;
    setEmpty(!html.trim());
  }

  useEffect(() => {
    void fetch("/api/email/signature")
      .then((r) => r.json())
      .then((d) => {
        show(d.html ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function run(kind: "import" | "save", request: () => Promise<Response>) {
    setBusy(kind);
    setStatus(null);
    try {
      const res = await request();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      show(data.html ?? "");
      onSaved?.(data.html ?? "");
      setStatus({ ok: true, text: kind === "import" ? "Imported from Gmail and saved" : data.html ? "Signature saved" : "Signature removed" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  const save = (html: string) =>
    run("save", () => fetch("/api/email/signature", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html }) }));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div
          ref={boxRef}
          contentEditable={loaded}
          suppressContentEditableWarning
          onInput={(e) => setEmpty(!e.currentTarget.textContent?.trim() && !e.currentTarget.querySelector("img"))}
          className="min-h-[7rem] rounded-lg border border-white/10 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        {empty && loaded && (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-400">
            Type or paste your signature here, or import it from Gmail
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run("import", () => fetch("/api/email/signature", { method: "POST" }))}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-50"
        >
          {busy === "import" ? "Importing…" : "Import from Gmail"}
        </button>
        <button
          type="button"
          disabled={!!busy || !loaded}
          onClick={() => void save(boxRef.current?.innerHTML ?? "")}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-zinc-100 hover:bg-blue-500 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save signature"}
        </button>
        {!empty && (
          <button type="button" disabled={!!busy} onClick={() => void save("")} className="text-xs text-zinc-500 hover:text-red-400">
            Remove
          </button>
        )}
        {status && <span className={`text-xs ${status.ok ? "text-emerald-400" : "text-red-400"}`}>{status.text}</span>}
      </div>
    </div>
  );
}
