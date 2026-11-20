"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useCloud } from "@/hooks/useCloud";
import { useToast } from "@/hooks/useToast";
import { DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { DestinationTile, SimulatedBadge } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A mock OAuth consent screen. No credentials are requested or sent anywhere. */
export function ConnectDialog({ id, onClose, onConnected }: { id: DestinationId | null; onClose: () => void; onConnected?: () => void }) {
  const { connect } = useCloud();
  const toast = useToast();
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (id) {
      setAccount("");
      setBusy(false);
      setTouched(false);
    }
  }, [id]);

  if (!id) return null;
  const d = DESTINATIONS[id];
  const invalid = !EMAIL_RE.test(account.trim());

  const authorize = () => {
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    setTimeout(() => {
      connect(id, account.trim());
      toast(`${d.name} connected as ${account.trim()}`);
      onConnected?.();
      onClose();
    }, 1100);
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Connect ${d.name}`} size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">S</span>
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full bg-slate-300 ${busy ? "animate-pulse" : ""}`} style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
          <DestinationTile id={id} size="lg" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">Spendwise wants to access your {d.name} account</p>
          <p className="mt-1 text-xs text-slate-500">
            <SimulatedBadge className="mr-1" /> Simulated sign-in — nothing is sent anywhere and no password is needed.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Account email</span>
          <input
            type="email"
            autoComplete="off"
            placeholder="you@example.com"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => e.key === "Enter" && authorize()}
            className={`input ${touched && invalid ? "input-error" : ""}`}
            disabled={busy}
          />
          {touched && invalid && <span className="text-xs text-rose-600">Enter a valid email address.</span>}
        </label>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">This will allow Spendwise to:</p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
            {(d.scopes ?? []).map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                {s}
              </li>
            ))}
            <li className="flex gap-2">
              <span className="text-slate-400">✕</span>
              <span>Read your other files — Spendwise only sees what it creates</span>
            </li>
          </ul>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary flex-1" onClick={authorize} disabled={busy}>
            {busy ? "Authorizing…" : "Allow access"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
