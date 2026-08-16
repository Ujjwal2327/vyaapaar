"use client";

/**
 * components/marketplace/CartDrawer.jsx
 *
 * Everything currently in the marketplace cart, grouped by vendor —
 * "checkout" here means sharing each vendor an itemised enquiry, not a
 * payment step, so there's no cross-vendor cart total or shared payment
 * flow to build. Rendered as a Dialog for consistency with every other
 * modal in this app (SettleTransactionsModal, AssignContactModal, etc.) —
 * there's no Sheet/Drawer primitive already in this project, so this
 * doesn't introduce a new dependency for one.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  MessageCircle,
  Store,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { shareCartInquiry, sendTextOnlyInquiry } from "@/lib/utils/cartShare";

const fmt = (n) =>
  `\u20B9${(+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Floating trigger — renders nothing while the cart is empty. Counts
 * distinct items, not total quantity — see hooks/useCart.js. */
export const CartTriggerButton = ({ onClick, className = "" }) => {
  const { distinctItemCount } = useCart();
  console.log("distinctItemCount", distinctItemCount);
  if (distinctItemCount === 0) return null;
  return (
    <Button
      onClick={onClick}
      size="sm"
      className={`gap-1.5 shadow-lg ${className}`}
    >
      <ShoppingCart className="w-4 h-4" />
      Cart
      <Badge className="bg-background text-foreground border-0 ml-0.5">
        {distinctItemCount}
      </Badge>
    </Button>
  );
};

export const CartDrawer = ({ open, onOpenChange }) => {
  const { vendors, setItemQty, clearVendorCart } = useCart();
  const [sendingId, setSendingId] = useState(null);

  const handleSend = async (vendor) => {
    if (sendingId) return;
    setSendingId(vendor.businessId);
    try {
      const result = await shareCartInquiry(vendor);
      if (result.method === "share" && result.copiedToClipboard) {
        toast.success("Image shared", {
          description:
            "The message text is also copied to your clipboard, in case you want to paste it in as well.",
        });
      } else if (result.method === "fallback") {
        toast.success("Image downloaded, WhatsApp opened with the list", {
          description:
            "Your browser can't attach files directly — attach the downloaded image in the chat if you'd like to send it as a picture too.",
        });
      }
    } catch (err) {
      console.error("Failed to share cart inquiry:", err);
      toast.error("Couldn't prepare the enquiry", {
        description: "Please try again.",
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendTextOnly = (vendor) => {
    sendTextOnlyInquiry(vendor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col h-[85svh] overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Your cart</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Share a clear, itemised list with each vendor as an image — not
                wrapped chat text
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-4">
            {vendors.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-10">
                Your cart is empty. Add items from a vendor's catalog to get
                started.
              </p>
            ) : (
              vendors.map((vendor) => {
                const total = vendor.items.reduce(
                  (s, it) =>
                    s + (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0),
                  0,
                );
                return (
                  <div
                    key={vendor.businessId}
                    className="border rounded-xl overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/40 border-b flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {vendor.businessName}
                          </p>
                          {vendor.businessAddress && (
                            <p className="text-sm text-muted-foreground relative pl-4">
                              <MapPin className="w-3 h-3 absolute left-0 top-0.5" />
                              {vendor.businessAddress}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-sm text-muted-foreground shrink-0"
                        onClick={() => clearVendorCart(vendor.businessId)}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="divide-y">
                      {vendor.items.map((it) => (
                        <div
                          key={it.key}
                          className="flex items-center gap-2 px-3 py-2.5 min-w-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{it.name}</p>
                            {it.price > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {fmt(it.price)}/{it.unit || "unit"}
                              </p>
                            )}
                          </div>
                          {/* Delete sits apart on the left of this group,
                              separated from +/- by a wider gap, so a
                              mis-tap near the stepper can't land on delete
                              (and vice versa) — gap-1 within the stepper,
                              gap-3 between delete and the stepper. */}
                          <div className="flex items-center gap-3 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setItemQty(vendor, it, 0)}
                              aria-label={`Remove ${it.name} from cart`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  setItemQty(vendor, it, it.qty - 1)
                                }
                                aria-label={`Reduce quantity of ${it.name}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center text-sm tabular-nums">
                                {it.qty}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  setItemQty(vendor, it, it.qty + 1)
                                }
                                aria-label={`Increase quantity of ${it.name}`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-3 py-2.5 bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">
                          {total > 0
                            ? `Est. total ${fmt(total)}`
                            : "Price on enquiry"}
                        </span>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0"
                          onClick={() => handleSend(vendor)}
                          disabled={sendingId === vendor.businessId}
                        >
                          <MessageCircle className="w-4 h-4" />
                          {sendingId === vendor.businessId
                            ? "Preparing…"
                            : "Send enquiry"}
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendTextOnly(vendor)}
                        disabled={sendingId === vendor.businessId}
                        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 block ml-auto w-fit disabled:opacity-50"
                      >
                        Send as plain text instead
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="px-4 py-3 shrink-0">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Continue browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
