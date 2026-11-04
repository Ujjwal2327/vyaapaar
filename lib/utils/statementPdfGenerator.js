/**
 * lib/utils/statementPdfGenerator.js
 *
 * v2 (consistency pass): look comes from the shared lib/utils/docTheme.js +
 * lib/utils/pdfTheme.js — identical header, party block, table, totals, money
 * and date format, and footer to the invoices. Logic unchanged.
 *
 * Account statement for ONE contact — the optional PDF attached to a
 * WhatsApp reminder.
 *
 * Lists every bill that still has a balance, oldest first, with how old each
 * unpaid sale is, then: total due, less anything you owe them (advances /
 * purchases), and the net — the same figure the reminder asks for.
 *
 * Imported lazily by ReminderComposer (a dynamic import()) so
 * @react-pdf/renderer stays out of the Contacts page's main bundle until
 * someone actually ticks "attach statement".
 *
 * Cost prices never appear: only the fields printed below are read.
 */

import React from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { differenceInCalendarDays } from "date-fns";
import { categorizeBalance } from "@/lib/utils/analyticsUtils";
import { fmtDate, money } from "@/lib/utils/docTheme";
import { PdfFooter, PdfHeader, S, W, right } from "@/lib/utils/pdfTheme";

const EPSILON = 0.01;

const describe = (row, receivable, payable) => {
  let label;
  if (row.type === "out")
    label = receivable > EPSILON ? "Sale" : "Sale – advance received";
  else label = payable > EPSILON ? "Purchase" : "Purchase – advance due back";

  let detail = "";
  if (row.kind === "item" && row.itemsList?.length > 0) {
    const names = row.itemsList
      .slice(0, 2)
      .map((it) => (it.name || "").split(" › ").pop())
      .filter(Boolean)
      .join(", ");
    const more =
      row.itemsList.length > 2 ? ` +${row.itemsList.length - 2}` : "";
    detail = names + more;
  } else if (row.note?.trim()) {
    detail = row.note.trim();
  }
  return { label, detail };
};

/** Turns raw rows into printable lines + totals. Exported for testing. */
export const buildStatementData = (rows, now = new Date()) => {
  const lines = [];
  let totalDue = 0;
  let totalCredit = 0;

  const sorted = [...(rows ?? [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  for (const row of sorted) {
    const { toReceive, toGive } = categorizeBalance(
      row.totalAmount,
      row.paidAmount,
      row.type,
    );
    if (toReceive < EPSILON && toGive < EPSILON) continue;

    totalDue += toReceive;
    totalCredit += toGive;

    const { label, detail } = describe(row, toReceive, toGive);
    const isUnpaidSale = row.type === "out" && toReceive > EPSILON;
    const age = isUnpaidSale
      ? Math.max(0, differenceInCalendarDays(now, new Date(row.createdAt)))
      : null;

    lines.push({
      id: row.id,
      date: row.createdAt,
      label,
      detail,
      age,
      total: row.totalAmount,
      paid: row.paidAmount,
      due: toReceive,
      credit: toGive,
    });
  }

  return {
    lines,
    totalDue,
    totalCredit,
    net: totalDue - totalCredit,
  };
};

const ageText = (age) =>
  age == null
    ? null
    : age === 0
      ? "today"
      : `${age} day${age === 1 ? "" : "s"} old`;

const StatementDocument = ({ business, contact, data, now }) => {
  const phone = (
    contact?.phones ?? (contact?.phone ? [contact.phone] : [])
  ).find((p) => p && p.trim());

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PdfHeader
          name={business?.businessName || "Your Business"}
          lines={[
            business?.businessAddress,
            business?.phone ? `Ph: ${business.phone}` : null,
            business?.email,
          ]}
          title="Statement"
          meta={[`As of ${fmtDate(now)}`]}
        />

        <View style={S.section}>
          <Text style={S.label}>Account of</Text>
          <Text style={S.partyName}>{contact?.name}</Text>
          {phone ? <Text style={S.partyLine}>{phone}</Text> : null}
          {contact?.address ? (
            <Text style={S.partyLine}>{contact.address}</Text>
          ) : null}
        </View>

        {data.lines.length === 0 ? (
          <Text style={S.empty}>No outstanding bills.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.tableHeaderRow} fixed>
              <View style={[S.th, W(14)]}>
                <Text>Date</Text>
              </View>
              <View style={[S.th, W(34)]}>
                <Text>Details</Text>
              </View>
              <View style={[S.th, W(16), right]}>
                <Text>Total</Text>
              </View>
              <View style={[S.th, W(16), right]}>
                <Text>Paid</Text>
              </View>
              <View style={[S.th, W(20), right]}>
                <Text>Balance</Text>
              </View>
            </View>

            {data.lines.map((l) => (
              <View key={l.id} style={S.tableRow} wrap={false}>
                <View style={[S.td, W(14)]}>
                  <Text>{fmtDate(l.date, "d MMM yy")}</Text>
                </View>
                <View style={[S.td, W(34)]}>
                  <Text>{l.label}</Text>
                  {l.detail ? <Text style={S.tdSub}>{l.detail}</Text> : null}
                  {ageText(l.age) ? (
                    <Text style={S.tdSub}>{ageText(l.age)}</Text>
                  ) : null}
                </View>
                <View style={[S.td, W(16), right]}>
                  <Text>{money(l.total)}</Text>
                </View>
                <View style={[S.td, W(16), right]}>
                  <Text>{money(l.paid)}</Text>
                </View>
                <View style={[S.td, W(20), right]}>
                  <Text>
                    {l.due > EPSILON ? money(l.due) : money(-l.credit)}
                  </Text>
                  {l.credit > EPSILON ? (
                    <Text style={S.tdSub}>Credit</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={S.totalsWrap}>
          <View style={S.totalsBlock}>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Total due</Text>
              <Text style={S.totalsValue}>{money(data.totalDue)}</Text>
            </View>
            {data.totalCredit > EPSILON ? (
              <View style={S.totalsRow}>
                <Text style={S.totalsLabel}>Less: credits in your favour</Text>
                <Text style={S.totalsValue}>{money(-data.totalCredit)}</Text>
              </View>
            ) : null}
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>Net payable</Text>
              <Text style={S.grandValue}>{money(data.net)}</Text>
            </View>
          </View>
        </View>

        <PdfFooter />
      </Page>
    </Document>
  );
};

const slug = (s) =>
  (s || "contact")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "contact";

/**
 * @param {object} p
 * @param {object|null} p.business  from hooks/useBusinessProfile
 * @param {object} p.contact        the contact record
 * @param {object[]} p.rows         from fetchDueRows(..., { withDetails: true })
 * @returns {Promise<File>}
 */
export const buildStatementFile = async ({ business, contact, rows }) => {
  const now = new Date();
  const data = buildStatementData(rows, now);
  const blob = await pdf(
    <StatementDocument
      business={business}
      contact={contact}
      data={data}
      now={now.toISOString()}
    />,
  ).toBlob();

  const filename = `Statement_${slug(contact?.name)}_${now.toISOString().slice(0, 10)}.pdf`;
  return new File([blob], filename, { type: "application/pdf" });
};
