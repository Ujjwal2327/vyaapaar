"use client";

/**
 * components/reminders/RemindAllModal.jsx
 *
 * Remind several people, one setup for everyone:
 *
 *   1. Tick who to remind. One button flips Select all / Clear for the people
 *      showing; "Overdue 15d+" is a toggle that limits the list to the
 *      people whose oldest bill is at least that old.
 *   2. Choose whether to attach the statement PDF (on by default). The
 *      message and the UPI QR are fixed, exactly as in a single reminder.
 *   3. "Prepare" reads fresh balances and builds each person's message, QR
 *      image and (if ticked) statement PDF up front.
 *   4. Share each one. A tap opens the share sheet with that person's
 *      files and message, same as the single reminder — pick their chat and
 *      press send. Prepared ahead of time, so every tap is instant and valid.
 *
 * Why it is one reminder per tap: WhatsApp never lets a website send on your
 * behalf, and it can't open a chat with files attached — the share sheet is
 * the only way to attach the QR image / PDF, and it makes you pick the chat.
 * Sending them all in one go needs the WhatsApp Business API.
 *
 * Offline: nothing can be prepared or shared; a notice replaces the content.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  Check,
  CheckSquare,
  Loader2,
  MessageCircle,
  QrCode,
  Share2,
  Square,
  TriangleAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useDues, fetchDueRows } from "@/hooks/useDues";
import {
  fmtINR,
  groupDuesByContact,
  hasDues,
  phonesOf,
} from "@/lib/utils/duesUtils";
import { buildReminderMessage } from "@/lib/utils/reminderBuilder";
import { buildUpiQrFile } from "@/lib/utils/upiQrImage";
import { deliverReminder } from "@/lib/utils/reminderShare";
import { isValidUpiId } from "@/lib/utils/upi";
import { DaysBadge, OfflineNotice } from "./ReminderComposer";

const OVERDUE_DAYS = 15;
const PDF_CONCURRENCY = 2; // PDFs are the slow part; don't build dozens at once

const SORTS = [
  { id: "oldest", label: "Oldest bill" },
  { id: "amount", label: "Highest amount" },
];

/** Runs fn over items with at most `limit` in flight, keeping result order. */
const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

export const RemindAllModal = ({ open, onOpenChange, peopleData }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isOnline } = useOnlineStatus();
  const { profile } = useBusinessProfile();
  const { dues, isLoading, hasLoaded, error, refresh, reset } = useDues({
    enabled: open && isOnline,
  });

  const [step, setStep] = useState("select"); // select | send
  const [selected, setSelected] = useState(() => new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sortBy, setSortBy] = useState("oldest");
  const [attachStatement, setAttachStatement] = useState(true);
  const [prepared, setPrepared] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [prepareError, setPrepareError] = useState(null);
  const [opened, setOpened] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const initialisedRef = useRef(false);

  const vpa = profile?.upiId?.trim() || "";
  const hasUpi = isValidUpiId(vpa);

  useEffect(() => {
    if (!open) {
      reset();
      setStep("select");
      setSelected(new Set());
      setOnlyOverdue(false);
      setAttachStatement(true);
      setPrepared([]);
      setOpened(new Set());
      setPrepareError(null);
      initialisedRef.current = false;
    }
  }, [open, reset]);

  const rows = useMemo(() => {
    const list = [];
    for (const person of peopleData ?? []) {
      const d = dues.get(person.id);
      if (!hasDues(d)) continue;
      list.push({ person, dues: d, phone: phonesOf(person)[0] ?? null });
    }
    list.sort(
      sortBy === "oldest"
        ? (a, b) =>
            (b.dues.daysOutstanding ?? -1) - (a.dues.daysOutstanding ?? -1) ||
            b.dues.net - a.dues.net
        : (a, b) => b.dues.net - a.dues.net,
    );
    return list;
  }, [peopleData, dues, sortBy]);

  // Everyone starts ticked; untick to leave someone out.
  useEffect(() => {
    if (!hasLoaded || initialisedRef.current) return;
    initialisedRef.current = true;
    setSelected(new Set(rows.map((r) => r.person.id)));
  }, [hasLoaded, rows]);

  const visibleRows = onlyOverdue
    ? rows.filter((r) => (r.dues.daysOutstanding ?? 0) >= OVERDUE_DAYS)
    : rows;
  const targets = visibleRows.filter((r) => selected.has(r.person.id));
  const selectedTotal = targets.reduce((s, r) => s + r.dues.net, 0);
  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((r) => selected.has(r.person.id));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // One button, both jobs: acts on whoever is currently showing.
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((r) =>
        allVisibleSelected ? next.delete(r.person.id) : next.add(r.person.id),
      );
      return next;
    });

  // ── prepare ───────────────────────────────────────────────────────────────
  // Reads FRESH balances (the list on screen may be minutes old), then builds
  // each person's message, QR image and statement.
  const prepare = async () => {
    if (!userId || targets.length === 0 || preparing) return;
    setPreparing(true);
    setPrepareError(null);
    setProgress({ done: 0, total: targets.length });

    try {
      const allRows = await fetchDueRows(userId, {
        withDetails: attachStatement,
      });
      const freshDues = groupDuesByContact(allRows);
      const rowsByContact = new Map();
      for (const r of allRows) {
        if (!rowsByContact.has(r.contactId)) rowsByContact.set(r.contactId, []);
        rowsByContact.get(r.contactId).push(r);
      }
      const buildStatementFile = attachStatement
        ? (await import("@/lib/utils/statementPdfGenerator")).buildStatementFile
        : null;

      const results = await mapLimit(
        targets,
        PDF_CONCURRENCY,
        async ({ person, phone }) => {
          const base = { id: person.id, name: person.name, phone };
          const d = freshDues.get(person.id);
          let out;
          if (!hasDues(d)) {
            out = { ...base, skipped: "Nothing owed any more" };
          } else {
            try {
              const files = [];
              if (hasUpi) {
                files.push(
                  await buildUpiQrFile({
                    shopName: profile?.businessName,
                    vpa,
                    amount: d.net,
                  }),
                );
              }
              if (buildStatementFile) {
                files.push(
                  await buildStatementFile({
                    business: profile,
                    contact: person,
                    rows: rowsByContact.get(person.id) ?? [],
                  }),
                );
              }
              out = {
                ...base,
                amount: d.net,
                days: d.daysOutstanding,
                files,
                message: buildReminderMessage({
                  contactName: person.name,
                  shopName: profile?.businessName,
                  amount: d.net,
                  daysOutstanding: d.daysOutstanding,
                  vpa: hasUpi ? vpa : null,
                }),
              };
            } catch (err) {
              console.error("Reminder prep failed for", person.name, err);
              out = { ...base, error: "Couldn't prepare this one" };
            }
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          return out;
        },
      );

      setPrepared(results);
      setOpened(new Set());
      setStep("send");
    } catch (err) {
      console.warn("[RemindAll] prepare failed:", err?.message);
      setPrepareError(
        "Couldn't load the latest balances. Check your connection and try again.",
      );
    } finally {
      setPreparing(false);
    }
  };

  // ── send step ─────────────────────────────────────────────────────────────
  const ready = prepared.filter((p) => p.message);
  const failed = prepared.filter((p) => p.error);
  const skipped = prepared.filter((p) => p.skipped);
  const nextUp = ready.find((p) => !opened.has(p.id));

  const handleShare = async (p) => {
    if (busyId || !isOnline) return;
    setBusyId(p.id);
    try {
      // Straight from the tap, nothing awaited first: see lib/utils/reminderShare.js.
      const result = await deliverReminder({
        phone: p.phone,
        message: p.message,
        files: p.files,
      });
      switch (result.method) {
        case "share":
        case "fallback":
        case "whatsapp":
          setOpened((prev) => new Set(prev).add(p.id));
          if (result.method === "fallback") {
            toast.success("Files downloaded and WhatsApp opened", {
              description: "Attach them in the chat.",
            });
          }
          break;
        case "needs-tap":
          toast.info("Tap once more to open the share sheet.");
          break;
        case "blocked":
          toast.info(
            "Your browser blocked the popup. Allow popups and try again.",
          );
          break;
        default:
          break; // cancelled
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open WhatsApp", {
        description: "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const filesLabel = (p) => {
    const n = p.files?.length ?? 0;
    return n === 0 ? "text only" : n === 1 ? "1 file" : `${n} files`;
  };

  // ── body ──────────────────────────────────────────────────────────────────
  let body;
  if (!isOnline && step === "select" && !hasLoaded) {
    body = (
      <div className="p-4">
        <OfflineNotice />
      </div>
    );
  } else if (step === "select" && error && !hasLoaded) {
    body = (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Couldn't load balances. Check your connection and try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
        >
          Retry
        </Button>
      </div>
    );
  } else if (step === "select" && !hasLoaded) {
    body = (
      <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-sm">Checking the latest balances…</p>
      </div>
    );
  } else if (step === "select" && rows.length === 0) {
    body = (
      <div className="p-8 text-center space-y-1">
        <p className="font-medium">All settled up</p>
        <p className="text-sm text-muted-foreground">
          No one owes you anything right now.
        </p>
      </div>
    );
  } else if (step === "select") {
    body = (
      <>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-4">
            {!isOnline && <OfflineNotice />}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={toggleAllVisible}
                  disabled={visibleRows.length === 0}
                >
                  {allVisibleSelected ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  {allVisibleSelected ? "Clear" : "Select all"}
                </Button>

                {/* Toggle: filled with a tick while on, outlined while off. */}
                <Button
                  type="button"
                  size="sm"
                  variant={onlyOverdue ? "default" : "outline"}
                  aria-pressed={onlyOverdue}
                  className="h-8 gap-1.5"
                  onClick={() => setOnlyOverdue((v) => !v)}
                  title={`Only show people whose oldest bill is ${OVERDUE_DAYS}+ days old`}
                >
                  {onlyOverdue && <Check className="w-4 h-4" />}
                  Overdue {OVERDUE_DAYS}d+
                </Button>
              </div>

              <div className="flex gap-1 p-1 rounded-lg bg-muted shrink-0">
                {SORTS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSortBy(id)}
                    className={`h-8 px-3 rounded-md text-sm font-medium transition-all ${
                      sortBy === id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {targets.length} of {visibleRows.length} selected
              {targets.length > 0 && ` · ${fmtINR(selectedTotal)}`}
            </p>

            {visibleRows.length === 0 ? (
              <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                No one is {OVERDUE_DAYS}+ days overdue.
              </div>
            ) : (
              <div className="border rounded-xl divide-y overflow-hidden">
                {visibleRows.map(({ person, dues: d }) => (
                  <label
                    key={person.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selected.has(person.id)}
                      onCheckedChange={() => toggle(person.id)}
                    />
                    <p className="flex-1 min-w-0 font-medium truncate">
                      {person.name}
                    </p>
                    <DaysBadge days={d.daysOutstanding} />
                    <span className="font-semibold tabular-nums text-green-600 dark:text-green-400 w-20 text-right">
                      {fmtINR(d.net)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2.5">
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
                {hasUpi
                  ? "Each person gets a short message with your UPI ID and their amount, plus a UPI QR image for that amount."
                  : "Add your UPI ID in Settings → Profile to include the UPI QR and details."}
              </p>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="bulk-statement"
                  checked={attachStatement}
                  onCheckedChange={(v) => setAttachStatement(v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <Label
                    htmlFor="bulk-statement"
                    className="text-base font-medium cursor-pointer"
                  >
                    Attach statement (PDF)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Each person's unpaid bills with their age.
                  </p>
                </div>
              </div>
            </div>

            {prepareError && (
              <p className="text-sm text-destructive">{prepareError}</p>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3 flex gap-2 shrink-0 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={preparing}
          >
            Close
          </Button>
          <Button
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={prepare}
            disabled={!isOnline || preparing || targets.length === 0}
          >
            {preparing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing {progress.done}/{progress.total}…
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Prepare {targets.length} reminder
                {targets.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </>
    );
  } else {
    // send
    body = (
      <>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-4">
            {!isOnline && <OfflineNotice />}

            {nextUp ? (
              <Button
                size="lg"
                className="w-full h-auto py-3 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleShare(nextUp)}
                disabled={!isOnline || !!busyId}
              >
                {busyId === nextUp.id ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Share2 className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  Share next: {nextUp.name} · {fmtINR(nextUp.amount)}
                </span>
              </Button>
            ) : ready.length > 0 ? (
              <div className="rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                All {ready.length} done. Make sure you pressed send in each
                chat.
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {opened.size} of {ready.length} done. Each tap opens your share
              sheet with that person's files and message — pick their chat and
              press send, then come back for the next. The message is copied in
              case WhatsApp drops the text.
            </p>

            {failed.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {failed.length} couldn't be prepared. Go back and prepare
                  again.
                </span>
              </div>
            )}

            <div className="border rounded-xl divide-y overflow-hidden">
              {prepared.map((p) => {
                const done = opened.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {p.error
                          ? p.error
                          : p.skipped
                            ? p.skipped
                            : `${fmtINR(p.amount)}${p.days != null && p.days > 0 ? ` · ${p.days}d` : ""} · ${filesLabel(p)}`}
                      </p>
                    </div>
                    {p.message && (
                      <Button
                        size="sm"
                        variant={done ? "ghost" : "outline"}
                        className="shrink-0 gap-1.5"
                        onClick={() => handleShare(p)}
                        disabled={!isOnline || !!busyId}
                      >
                        {done ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            Again
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            Share
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {skipped.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {skipped.length} skipped — their balance was cleared since the
                list loaded.
              </p>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3 flex gap-2 shrink-0 bg-background">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setStep("select")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/60 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">Payment reminders</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {step === "select"
                  ? "Choose who to remind"
                  : "Share each reminder in WhatsApp"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};
