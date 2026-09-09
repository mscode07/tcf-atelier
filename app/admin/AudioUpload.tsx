"use client";
import { useState } from "react";
import { ModuleKey } from "@/lib/admin/types";
export default function AudioUpload({
  module,
  onUploaded,
}: {
  module: ModuleKey;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <label className="admin-field">
        Upload audio (up to 10 MB)
        <input
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,.aac,.webm,.flac"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              if (file.size > 10000000)
                throw new Error("Choose audio up to 10 MB.");
              const form = new FormData();
              form.set("file", file);
              form.set("module", module);
              const r = await fetch("/api/admin/audio", {
                method: "POST",
                body: form,
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error);
              onUploaded(data.audioUrl);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Audio upload failed.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Uploading audio…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
