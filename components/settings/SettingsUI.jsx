"use client";

/**
 * components/settings/SettingsUI.jsx
 *
 * Small shared building blocks for the Settings page so every section
 * (Profile, Appearance, Catalog, Contacts) renders its header the same
 * way — a round icon badge, a title, an optional one-line description,
 * and an optional control pinned to the right (a Switch, a Badge count,
 * whatever that section needs) — instead of every section hand-rolling
 * its own heading markup with its own spacing and font sizes. The icon
 * badge is the same "w-9 h-9 rounded-full bg-primary/10" shape already
 * used for header icons across the app's modals (AddPaymentModal,
 * NetSettleModal, AssignContactModal, ...), so Settings reads as part of
 * the same design language rather than its own thing.
 */

export const SettingsSectionCard = ({
  icon: Icon,
  title,
  description,
  action,
  children,
  className = "",
}) => {
  return (
    <section
      className={`bg-card rounded-xl border p-4 sm:p-5 space-y-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 className="font-semibold text-base leading-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
};

export const SettingsStatCard = ({ icon: Icon, label, value }) => {
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4 bg-card rounded-xl border">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold leading-tight tabular-nums">
          {value}
        </p>
        <p className="text-sm text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
};
