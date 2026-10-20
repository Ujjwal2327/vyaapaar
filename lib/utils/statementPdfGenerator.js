/**
 * lib/utils/statementPdfGenerator.js
 *
 * Account statement for ONE contact — the optional PDF attached to a
 * WhatsApp reminder. Same fonts and black-on-white look as
 * lib/utils/invoicePdfGenerator.js.
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
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import { format, differenceInCalendarDays } from "date-fns";
import { categorizeBalance } from "@/lib/utils/analyticsUtils";

Font.register({
  family: "Ubuntu",
  fonts: [
    { src: "/fonts/Ubuntu-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Ubuntu-Medium.ttf", fontWeight: "500" },
    { src: "/fonts/Ubuntu-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 40,
    fontFamily: "Ubuntu",
    fallbackFont: "Helvetica",
    fontSize: 10,
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 12,
  },
  businessBlock: { maxWidth: "58%" },
  businessName: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  businessLine: { fontSize: 9.5, color: "#333333", marginBottom: 2 },
  docBlock: { maxWidth: "38%", alignItems: "flex-end" },
  docTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
  docMetaLine: {
    fontSize: 9.5,
    color: "#333333",
    marginBottom: 2,
    textAlign: "right",
  },

  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  partyLine: { fontSize: 10, color: "#333333", marginBottom: 1.5 },

  table: { width: "100%", marginTop: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  th: { padding: 6, fontSize: 9, fontWeight: "bold" },
  td: { padding: 6, fontSize: 9.5 },
  tdSub: { fontSize: 7.5, color: "#888888", marginTop: 1 },

  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsBlock: { width: "58%" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: "#333333" },
  totalsValue: { fontSize: 10 },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#000000",
    marginTop: 4,
    paddingTop: 6,
  },
  netLabel: { fontSize: 12, fontWeight: "bold" },
  netValue: { fontSize: 12, fontWeight: "bold" },

  empty: { fontSize: 10, color: "#666666", marginTop: 10 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 8,
  },
});

const EPSILON = 0.01;

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);

const safeDate = (iso, pattern) => {
  try {
    return format(new Date(iso), pattern);
  } catch {
    return "";
  }
};

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
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.businessBlock}>
            <Text style={styles.businessName}>
              {business?.businessName || "Your Business"}
            </Text>
            {business?.businessAddress ? (
              <Text style={styles.businessLine}>
                {business.businessAddress}
              </Text>
            ) : null}
            {business?.phone ? (
              <Text style={styles.businessLine}>Ph: {business.phone}</Text>
            ) : null}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>STATEMENT</Text>
            <Text style={styles.docMetaLine}>
              As of {safeDate(now, "d MMM yyyy")}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account of</Text>
          <Text style={styles.partyName}>{contact?.name}</Text>
          {phone ? <Text style={styles.partyLine}>{phone}</Text> : null}
          {contact?.address ? (
            <Text style={styles.partyLine}>{contact.address}</Text>
          ) : null}
        </View>

        {data.lines.length === 0 ? (
          <Text style={styles.empty}>No outstanding bills.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <View style={[styles.th, { width: "14%" }]}>
                <Text>Date</Text>
              </View>
              <View style={[styles.th, { width: "34%" }]}>
                <Text>Details</Text>
              </View>
              <View style={[styles.th, { width: "16%", textAlign: "right" }]}>
                <Text>Total</Text>
              </View>
              <View style={[styles.th, { width: "16%", textAlign: "right" }]}>
                <Text>Paid</Text>
              </View>
              <View style={[styles.th, { width: "20%", textAlign: "right" }]}>
                <Text>Balance</Text>
              </View>
            </View>

            {data.lines.map((l) => (
              <View key={l.id} style={styles.tableRow} wrap={false}>
                <View style={[styles.td, { width: "14%" }]}>
                  <Text>{safeDate(l.date, "d MMM yy")}</Text>
                </View>
                <View style={[styles.td, { width: "34%" }]}>
                  <Text>{l.label}</Text>
                  {l.detail ? (
                    <Text style={styles.tdSub}>{l.detail}</Text>
                  ) : null}
                  {ageText(l.age) ? (
                    <Text style={styles.tdSub}>{ageText(l.age)}</Text>
                  ) : null}
                </View>
                <View style={[styles.td, { width: "16%", textAlign: "right" }]}>
                  <Text>{fmtMoney(l.total)}</Text>
                </View>
                <View style={[styles.td, { width: "16%", textAlign: "right" }]}>
                  <Text>{fmtMoney(l.paid)}</Text>
                </View>
                <View style={[styles.td, { width: "20%", textAlign: "right" }]}>
                  <Text>
                    {l.due > EPSILON
                      ? fmtMoney(l.due)
                      : `-${fmtMoney(l.credit)}`}
                  </Text>
                  {l.credit > EPSILON ? (
                    <Text style={styles.tdSub}>Credit</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total due</Text>
              <Text style={styles.totalsValue}>{fmtMoney(data.totalDue)}</Text>
            </View>
            {data.totalCredit > EPSILON ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Less: credits in your favour
                </Text>
                <Text style={styles.totalsValue}>
                  -{fmtMoney(data.totalCredit)}
                </Text>
              </View>
            ) : null}
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net payable</Text>
              <Text style={styles.netValue}>{fmtMoney(data.net)}</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated with Vyaapaar • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
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
