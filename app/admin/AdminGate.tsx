"use client";
import { useEffect, useState } from "react";
import AdminWorkspace from "./AdminWorkspace";
import PasscodeLogin from "./PasscodeLogin";
export default function AdminGate() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState(false);
  useEffect(() => {
    fetch("/api/admin/session", { method: "DELETE" })
      .then((r) => {
        if (r.ok) setReady(true);
        else setLockError(true);
      })
      .catch(() => setLockError(true));
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    let last = Date.now(),
      renewed = Date.now(),
      renewing = false;
    const lock = () => {
      setUnlocked(false);
      setReady(false);
      void fetch("/api/admin/session", { method: "DELETE", keepalive: true })
        .then((r) => {
          if (r.ok) setReady(true);
          else setLockError(true);
        })
        .catch(() => setLockError(true));
    };
    const activity = () => {
      const now = Date.now();
      if (now - last >= 300000) return lock();
      last = now;
      if (now - renewed > 15000 && !renewing) {
        renewing = true;
        void fetch("/api/admin/session", { method: "PATCH" })
          .then((r) => {
            if (!r.ok) lock();
            else renewed = now;
          })
          .catch(lock)
          .finally(() => {
            renewing = false;
          });
      }
    };
    const timer = setInterval(() => {
      if (Date.now() - last >= 300000) lock();
    }, 1000);
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, activity));
    };
  }, [unlocked]);
  if (lockError)
    return (
      <p role="alert">
        The panel is locked. Could not reach the server.{" "}
        <button onClick={() => window.location.reload()}>Retry</button>
      </p>
    );
  if (!ready) return <p>Locking admin panel…</p>;
  return unlocked ? (
    <AdminWorkspace name="Admin" />
  ) : (
    <PasscodeLogin onUnlock={() => setUnlocked(true)} />
  );
}
