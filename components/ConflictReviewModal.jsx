"use client";

/**
 * components/ConflictReviewModal.jsx  (v2)
 *
 * Changes vs v1:
 *  1. "Keep both" option added — for contacts shows a per-field picker,
 *     for price_list deep-merges, for transactions merges payment histories.
 *  2. Fully responsive — single column on mobile, side-by-side on sm+.
 *  3. Contact conflict shows an interactive per-field chooser when "Keep both"
 *     is selected: each differing field shows local vs remote with a toggle.
 *  4. Progress indicator shows which conflict you're on (X of N).
 *  5. Resolving spinner per button so the user knows which action is in flight.
 */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Smartphone,
  Cloud,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { useSyncContext } from "@/hooks/useSyncManager";
import { format } from "date-fns";

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso ?? "—";
  }
};

const displayField = (val) => {
  if (val === null || val === undefined || val === "")
    return <span className="text-muted-foreground italic">empty</span>;
  if (Array.isArray(val)) {
    const items = val.filter(Boolean);
    return items.length === 0 ? (
      <span className="text-muted-foreground italic">none</span>
    ) : (
      items.join(", ")
    );
  }
  return String(val);
};

const CONTACT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "phones", label: "Phone numbers" },
  { key: "address", label: "Address" },
  { key: "specialty", label: "Specialty / Role" },
  { key: "notes", label: "Notes" },
];

// ─── FieldPicker — per-field local/remote chooser for contacts ────────────────

function FieldPicker({ localData, remoteData, fieldChoices, setFieldChoices }) {
  const changedFields = CONTACT_FIELDS.filter(({ key }) => {
    const lv = JSON.stringify(localData?.[key] ?? "");
    const rv = JSON.stringify(remoteData?.[key] ?? "");
    return lv !== rv;
  });

  if (changedFields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        No field-level differences detected.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick which value to keep for each changed field. Fields not listed are
        identical on both sides.
      </p>
      <div className="divide-y rounded-lg border overflow-hidden">
        {changedFields.map(({ key, label }) => {
          const choice = fieldChoices[key] ?? "remote"; // default: server wins
          return (
            <div key={key} className="p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Local option */}
                <button
                  type="button"
                  onClick={() =>
                    setFieldChoices((prev) => ({ ...prev, [key]: "local" }))
                  }
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    choice === "local"
                      ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40 ring-1 ring-blue-400"
                      : "border-border hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-3 h-3 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Mine
                    </span>
                    {choice === "local" && (
                      <Check className="w-3 h-3 text-blue-500 ml-auto" />
                    )}
                  </div>
                  <span className="break-all leading-snug text-foreground">
                    {displayField(localData?.[key])}
                  </span>
                </button>

                {/* Remote option */}
                <button
                  type="button"
                  onClick={() =>
                    setFieldChoices((prev) => ({ ...prev, [key]: "remote" }))
                  }
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    choice === "remote"
                      ? "border-purple-400 bg-purple-50 dark:border-purple-600 dark:bg-purple-950/40 ring-1 ring-purple-400"
                      : "border-border hover:border-purple-300 dark:hover:border-purple-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Cloud className="w-3 h-3 text-purple-500 shrink-0" />
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                      Server
                    </span>
                    {choice === "remote" && (
                      <Check className="w-3 h-3 text-purple-500 ml-auto" />
                    )}
                  </div>
                  <span className="break-all leading-snug text-foreground">
                    {displayField(remoteData?.[key])}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── conflict detail views ────────────────────────────────────────────────────

function PriceListConflict({ conflict, mode }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Your offline edits to the <strong>catalog / price list</strong> clash
        with changes made from another session.
      </p>

      {mode === "both" ? (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
          <p className="font-medium mb-0.5">Merge strategy</p>
          <p>
            All categories from both versions will be kept. Where the same
            category exists in both, your offline version takes priority.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Side
            label="Your offline version"
            icon={<Smartphone className="w-4 h-4" />}
            color="blue"
          >
            <p className="text-sm">
              {Object.keys(conflict.localData ?? {}).length} top-level
              categories
            </p>
          </Side>
          <Side
            label="Server version"
            icon={<Cloud className="w-4 h-4" />}
            color="purple"
          >
            <p className="text-sm">
              {Object.keys(conflict.remoteData ?? {}).length} top-level
              categories
            </p>
          </Side>
        </div>
      )}
    </div>
  );
}

function ContactConflict({ conflict, mode, fieldChoices, setFieldChoices }) {
  const { localData: local = {}, remoteData: remote = {} } = conflict;

  if (mode === "both") {
    return (
      <FieldPicker
        localData={local}
        remoteData={remote}
        fieldChoices={fieldChoices}
        setFieldChoices={setFieldChoices}
      />
    );
  }

  const changedFields = CONTACT_FIELDS.filter(({ key }) => {
    const lv = JSON.stringify(local[key] ?? "");
    const rv = JSON.stringify(remote[key] ?? "");
    return lv !== rv;
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Contact <strong>{local.name ?? remote.name}</strong> was edited both
        offline and on the server.
      </p>

      {changedFields.length > 0 && (
        <div className="rounded-lg border divide-y overflow-hidden">
          {changedFields.map(({ key, label }) => (
            <div key={key} className="px-3 py-2.5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 text-xs break-all">
                  <span className="text-blue-600 dark:text-blue-400 font-medium block mb-0.5">
                    Mine
                  </span>
                  {displayField(local[key])}
                </div>
                <div className="rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-2.5 py-1.5 text-xs break-all">
                  <span className="text-purple-600 dark:text-purple-400 font-medium block mb-0.5">
                    Server
                  </span>
                  {displayField(remote[key])}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionConflict({ conflict, mode }) {
  const local = conflict.localData ?? {};
  const remote = conflict.remoteData ?? {};

  if (mode === "both") {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2.5 text-sm text-green-700 dark:text-green-400 space-y-1">
        <p className="font-medium">Merge strategy</p>
        <p>
          Payment histories from both versions will be combined (duplicates
          removed). The larger total amount will be kept. Item list from server
          is preferred.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Transaction{" "}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          {local.id?.slice(0, 8) ?? ""}…
        </code>{" "}
        was modified both offline and on the server.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Side
          label="Your offline version"
          icon={<Smartphone className="w-4 h-4" />}
          color="blue"
        >
          <p>Total: ₹{local.total_amount ?? "—"}</p>
          <p>Paid: ₹{local.paid_amount ?? "—"}</p>
          <p>Status: {local.status ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(local.paid_amount_history ?? []).length} payment entries
          </p>
        </Side>
        <Side
          label="Server version"
          icon={<Cloud className="w-4 h-4" />}
          color="purple"
        >
          <p>Total: ₹{remote.total_amount ?? "—"}</p>
          <p>Paid: ₹{remote.paid_amount ?? "—"}</p>
          <p>Status: {remote.status ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(remote.paid_amount_history ?? []).length} payment entries
          </p>
        </Side>
      </div>
    </div>
  );
}

// ─── side card ────────────────────────────────────────────────────────────────

function Side({ label, icon, color, children }) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-1 ${
        color === "blue"
          ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${
          color === "blue"
            ? "text-blue-700 dark:text-blue-300"
            : "text-purple-700 dark:text-purple-300"
        }`}
      >
        {icon}
        {label}
      </div>
      <div className="text-sm text-foreground space-y-0.5">{children}</div>
    </div>
  );
}

// ─── main modal ───────────────────────────────────────────────────────────────

export default function ConflictReviewModal({ open, onOpenChange }) {
  const { conflicts, resolveConflict, dismissConflicts } = useSyncContext();

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // null | "local" | "remote" | "both"
  const [fieldChoices, setFieldChoices] = useState({}); // only used for contact "both"
  const [resolving, setResolving] = useState(null); // which button is spinning

  const current = conflicts[Math.min(index, conflicts.length - 1)];

  // Reset mode when switching between conflicts
  const goTo = (i) => {
    setIndex(i);
    setMode(null);
    setFieldChoices({});
    setResolving(null);
  };

  const handleResolve = async (choice) => {
    if (!current || resolving) return;
    setResolving(choice);

    const fc =
      choice === "both" && current.type === "contact" ? fieldChoices : null;
    await resolveConflict(current.id, choice, fc);

    setResolving(null);
    setMode(null);
    setFieldChoices({});

    if (conflicts.length <= 1) {
      onOpenChange(false);
      setIndex(0);
    } else {
      setIndex((i) => Math.min(i, conflicts.length - 2));
    }
  };

  const handleDismissAll = () => {
    dismissConflicts();
    onOpenChange(false);
    setIndex(0);
    setMode(null);
    setFieldChoices({});
  };

  if (!current) return null;

  const isBothMode = mode === "both";
  const canConfirm = mode !== null;
  const showFieldPicker = isBothMode && current.type === "contact";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 flex flex-col max-h-[92svh] overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/60 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-tight">
                Sync conflict
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5 leading-snug">
                {current.label}
              </DialogDescription>
            </div>
            {conflicts.length > 1 && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {index + 1}/{conflicts.length}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* ── Multi-conflict navigation ── */}
        {conflicts.length > 1 && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>
            <div className="flex gap-1">
              {conflicts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === index
                      ? "bg-red-500"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => goTo(Math.min(conflicts.length - 1, index + 1))}
              disabled={index === conflicts.length - 1}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── Body ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-4">
            {/* Timing info */}
            <div className="rounded-lg bg-muted/40 border px-3 py-2.5 space-y-1">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
                <span className="text-muted-foreground">
                  Your offline change
                </span>
                <span className="font-medium">{fmtDate(current.queuedAt)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
                <span className="text-muted-foreground">
                  Server last updated
                </span>
                <span className="font-medium">
                  {fmtDate(current.remoteUpdatedAt)}
                </span>
              </div>
            </div>

            {/* ── Step 1: choose a strategy ── */}
            {!mode && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  How do you want to resolve this?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("local")}
                    className="rounded-lg border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-left transition-all"
                  >
                    <Smartphone className="w-5 h-5 text-blue-500 mb-1.5" />
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      Keep mine
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                      Overwrite server with your offline version
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("remote")}
                    className="rounded-lg border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-left transition-all"
                  >
                    <Cloud className="w-5 h-5 text-purple-500 mb-1.5" />
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                      Use server
                    </p>
                    <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                      Discard your offline change
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("both")}
                    className="rounded-lg border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 bg-green-50/50 dark:bg-green-950/20 p-3 text-left transition-all"
                  >
                    <GitMerge className="w-5 h-5 text-green-500 mb-1.5" />
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      Keep both
                    </p>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5">
                      {current.type === "contact"
                        ? "Pick per field"
                        : "Smart merge"}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: preview / configure ── */}
            {mode && (
              <div className="space-y-3">
                {/* Mode label + back button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(null);
                      setFieldChoices({});
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <span className="text-sm text-muted-foreground">·</span>
                  <span
                    className={`text-sm font-medium ${
                      mode === "local"
                        ? "text-blue-600 dark:text-blue-400"
                        : mode === "remote"
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {mode === "local"
                      ? "Keep mine"
                      : mode === "remote"
                        ? "Use server"
                        : "Keep both"}
                  </span>
                </div>

                {/* Conflict-type detail */}
                {current.type === "price_list" && (
                  <PriceListConflict conflict={current} mode={mode} />
                )}
                {current.type === "contact" && (
                  <ContactConflict
                    conflict={current}
                    mode={mode}
                    fieldChoices={fieldChoices}
                    setFieldChoices={setFieldChoices}
                  />
                )}
                {current.type === "transaction" && (
                  <TransactionConflict conflict={current} mode={mode} />
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* ── Footer ── */}
        <div className="px-4 py-3 space-y-2 shrink-0 bg-background">
          {/* Confirm button — only shown once a mode is selected */}
          {canConfirm && (
            <Button
              className={`w-full gap-2 ${
                mode === "local"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : mode === "remote"
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
              }`}
              onClick={() => handleResolve(mode)}
              disabled={resolving !== null}
            >
              {resolving === mode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "local" ? (
                <Smartphone className="w-4 h-4" />
              ) : mode === "remote" ? (
                <Cloud className="w-4 h-4" />
              ) : (
                <GitMerge className="w-4 h-4" />
              )}
              {resolving === mode
                ? "Applying…"
                : mode === "local"
                  ? "Confirm: overwrite server"
                  : mode === "remote"
                    ? "Confirm: discard my change"
                    : showFieldPicker
                      ? "Confirm: apply field choices"
                      : "Confirm: merge both versions"}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground text-xs"
            onClick={handleDismissAll}
            disabled={resolving !== null}
          >
            Dismiss all conflicts and decide later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
