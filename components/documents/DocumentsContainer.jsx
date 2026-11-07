"use client";

/**
 * components/documents/DocumentsContainer.jsx
 *
 * The Documents page: quotations and delivery challans in two tabs, filterable
 * by status, with create / edit / cancel / convert-to-sale.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import SettingsButton from "@/components/SettingsButton";
import Loader from "@/components/Loader";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { DocumentFormModal } from "@/components/documents/DocumentFormModal";
import { DocumentDetailModal } from "@/components/documents/DocumentDetailModal";
import { useDocuments } from "@/hooks/useDocuments";
import { usePeople } from "@/hooks/usePeople";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import {
  displayStatus,
  docRef,
  itemsPreview,
  partyName,
  typeInfo,
} from "@/lib/utils/documentUtils";

const TAB_KEY = "documentsTab";
const STATUS_KEY = "documentsStatusFilter";

const TABS = [
  { id: "quotation", label: "Quotations", icon: FileText },
  { id: "challan", label: "Challans", icon: Truck },
];
const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const errorMessage = (err) => {
  switch (err?.message) {
    case "SELLER_GSTIN_MISSING":
      return "Add your GSTIN in Settings → GST billing first — this is a GST document.";
    case "DOC_CANCELLED":
      return "This document was cancelled, so it can't be converted.";
    case "DOC_NOT_FOUND":
      return "This document no longer exists.";
    case "DOC_NOT_OPEN":
      return "This document is no longer open, so it can't be changed.";
    default:
      return "Something went wrong. Please try again.";
  }
};

export const DocumentsContainer = () => {
  const router = useRouter();
  const {
    documents,
    isHydrated,
    isDataLoading,
    addDocument,
    updateDocument,
    cancelDocument,
    convertDocument,
  } = useDocuments();
  const { peopleData, isHydrated: peopleHydrated } = usePeople();
  const { profile: business } = useBusinessProfile();

  const [tab, setTab] = useState("quotation");
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [convertingId, setConvertingId] = useState(null);

  // Remember the last tab / status filter (read once on mount, like the other pages).
  useEffect(() => {
    try {
      const t = localStorage.getItem(TAB_KEY);
      if (t === "quotation" || t === "challan") setTab(t);
      const s = localStorage.getItem(STATUS_KEY);
      if (STATUS_OPTIONS.some((o) => o.value === s)) setStatusFilter(s);
    } catch {}
  }, []);

  const changeTab = (t) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const changeStatus = (s) => {
    setStatusFilter(s);
    try {
      localStorage.setItem(STATUS_KEY, s);
    } catch {}
  };

  const ofTab = useMemo(
    () => documents.filter((d) => d.docType === tab),
    [documents, tab],
  );
  const openCounts = useMemo(
    () => ({
      quotation: documents.filter(
        (d) => d.docType === "quotation" && d.status === "open",
      ).length,
      challan: documents.filter(
        (d) => d.docType === "challan" && d.status === "open",
      ).length,
    }),
    [documents],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofTab.filter((d) => {
      // "Open" includes quotations that have passed their validity date.
      if (statusFilter !== "all") {
        const s = displayStatus(d) === "expired" ? "open" : displayStatus(d);
        if (s !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        docRef(d).toLowerCase().includes(q) ||
        partyName(d).toLowerCase().includes(q) ||
        itemsPreview(d).toLowerCase().includes(q) ||
        (d.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [ofTab, statusFilter, search]);

  const detailDoc = useMemo(
    () => documents.find((d) => d.id === detailId) ?? null,
    [documents, detailId],
  );
  const detailContact = detailDoc?.contactId
    ? (peopleData.find((p) => p.id === detailDoc.contactId) ?? null)
    : null;

  if (!isHydrated || isDataLoading || !peopleHydrated) {
    return <Loader content="Loading documents..." />;
  }

  const salePathFor = (doc) =>
    doc.contactId && peopleData.some((p) => p.id === doc.contactId)
      ? `/contacts/${doc.contactId}/transactions`
      : "/unassigned";

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (doc) => {
    setEditing(doc);
    setDetailId(null);
    setShowForm(true);
  };

  const handleSaveDoc = async (payload) => {
    if (editing) {
      await updateDocument(editing.id, payload);
      toast.success(`${typeInfo(editing.docType).label} updated`);
    } else {
      const created = await addDocument(payload);
      toast.success(`${typeInfo(payload.docType).label} saved`, {
        description: created?.docNo
          ? created.docNo
          : "The number is issued once it has synced.",
      });
    }
  };

  const handleCancel = (doc) => {
    toast.warning(`Cancel this ${typeInfo(doc.docType).label.toLowerCase()}?`, {
      description:
        "It stays on record as cancelled and can't be converted. Nothing in the ledger changes.",
      action: {
        label: "Cancel document",
        onClick: async () => {
          const t = toast.loading("Cancelling...");
          try {
            await cancelDocument(doc.id);
            toast.success("Document cancelled", { id: t });
          } catch (err) {
            toast.error(errorMessage(err), { id: t });
          }
        },
      },
      duration: 6000,
    });
  };

  // One tap. The hook ignores a repeat while this is running, and the database
  // creates the sale at most once, so a double tap / second device / retry can
  // never produce two sales or take stock off twice.
  const handleConvert = async (doc) => {
    if (convertingId) return;
    setConvertingId(doc.id);
    const t = toast.loading("Converting to sale...");
    try {
      const res = await convertDocument(doc.id, {
        business,
        contactExists: (id) => peopleData.some((p) => p.id === id),
      });
      if (res.skipped) {
        toast.dismiss(t);
        return;
      }
      const viewSale = {
        label: "View sale",
        onClick: () =>
          router.push(
            res.contactId
              ? `/contacts/${res.contactId}/transactions`
              : "/unassigned",
          ),
      };
      if (res.alreadyConverted) {
        toast.info("Already converted", {
          id: t,
          description:
            "This document had already become a sale — no duplicate was created.",
          action: viewSale,
        });
      } else if (res.queued) {
        toast.success("Converted — will sync when you're online", {
          id: t,
          description: "Stock is updated once it has synced.",
          action: viewSale,
        });
      } else {
        toast.success("Converted to sale", {
          id: t,
          description:
            "It's in the ledger now. Record a payment from the sale.",
          action: viewSale,
        });
      }
    } catch (err) {
      console.error("Convert failed:", err);
      toast.error(errorMessage(err), { id: t });
    } finally {
      setConvertingId(null);
    }
  };

  const info = typeInfo(tab);

  return (
    <>
      <PageHeader actions={<SettingsButton />}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="font-semibold text-base">Documents</h1>
            <p className="text-sm text-muted-foreground truncate">
              Quotations and delivery challans — no ledger or stock effect until
              converted
            </p>
          </div>
          <Button size="sm" className="shrink-0 gap-1" onClick={openNew}>
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-muted mb-3">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              className={`flex-1 h-9 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {label}
              {openCounts[id] > 0 && (
                <span className="text-xs px-1.5 rounded-full bg-primary/10 text-primary tabular-nums">
                  {openCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search number, customer or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={changeStatus}>
            <SelectTrigger className="w-32 text-sm shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="max-w-4xl mx-auto p-2 space-y-2">
        {visible.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center space-y-3">
            <p className="text-muted-foreground">
              {ofTab.length === 0
                ? `No ${info.plural.toLowerCase()} yet.`
                : "Nothing matches these filters."}
            </p>
            {ofTab.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={openNew}
              >
                <Plus className="w-4 h-4" />
                New {info.label.toLowerCase()}
              </Button>
            )}
          </div>
        ) : (
          visible.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onClick={() => setDetailId(doc.id)}
            />
          ))
        )}
      </div>

      <DocumentFormModal
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) setEditing(null);
        }}
        docType={tab}
        editing={editing}
        peopleData={peopleData}
        onSave={handleSaveDoc}
      />

      <DocumentDetailModal
        open={!!detailDoc}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
        doc={detailDoc}
        contact={detailContact}
        business={business}
        converting={!!detailDoc && convertingId === detailDoc.id}
        onConvert={handleConvert}
        onEdit={openEdit}
        onCancel={handleCancel}
        onViewSale={(doc) => router.push(salePathFor(doc))}
      />
    </>
  );
};
