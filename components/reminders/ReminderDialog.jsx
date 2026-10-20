"use client";

/**
 * components/reminders/ReminderDialog.jsx
 *
 * "Remind" for one contact — opened from their transactions page.
 *
 * Reads the contact's dues fresh from the server every time it opens (see
 * hooks/useDues.js), so the amount and the "days since oldest unpaid bill"
 * are never stale. Offline, the dialog says so and does nothing else.
 */

import { useEffect } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useDues } from "@/hooks/useDues";
import { hasDues } from "@/lib/utils/duesUtils";
import { ReminderComposer, OfflineNotice } from "./ReminderComposer";

export const ReminderDialog = ({ open, onOpenChange, contact }) => {
  const { isOnline } = useOnlineStatus();
  const { profile } = useBusinessProfile();
  const { dues, isLoading, hasLoaded, error, refresh, reset } = useDues({
    enabled: open && isOnline && !!contact,
    contactId: contact?.id ?? null,
  });

  // Start clean next time: a reminder must never open showing yesterday's amount.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const contactDues = contact ? dues.get(contact.id) : null;

  let body;
  if (!isOnline && !hasLoaded) {
    body = (
      <div className="p-4">
        <OfflineNotice />
      </div>
    );
  } else if (error && !hasLoaded) {
    body = (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Couldn't load the latest balance. Check your connection and try again.
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
  } else if (!hasLoaded) {
    body = (
      <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-sm">Checking the latest balance…</p>
      </div>
    );
  } else if (!hasDues(contactDues)) {
    body = (
      <div className="p-8 text-center space-y-1">
        <p className="font-medium">Nothing to remind</p>
        <p className="text-sm text-muted-foreground">
          {contact?.name} has no outstanding dues right now.
        </p>
      </div>
    );
  } else {
    body = (
      <ReminderComposer
        key={contact.id}
        contact={contact}
        dues={contactDues}
        business={profile}
        isOnline={isOnline}
        onSent={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 flex flex-col max-h-[92svh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/60 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Payment reminder</DialogTitle>
              <DialogDescription className="text-sm mt-0.5 truncate">
                {contact?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};
