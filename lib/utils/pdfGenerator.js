/**
 * lib/utils/pdfGenerator.js
 *
 * v2 (consistency pass): page margins, type sizes, colours, table style and the
 * (optional) footer now come from the shared lib/utils/docTheme.js +
 * lib/utils/pdfTheme.js, so the contacts directory matches the invoices and
 * statement. Layouts (table / grid / bento) and what they print are unchanged.
 * The download link is also no longer revoked instantly (could cancel the
 * download on some mobile browsers).
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Image,
} from "@react-pdf/renderer";
import { COLORS, PAGE, SIZE } from "@/lib/utils/docTheme";
// Importing pdfTheme registers the shared Ubuntu font.
import { S as shared } from "@/lib/utils/pdfTheme";

// STYLES
const createStyles = (orientation, gridColumns = 2, bentoColumns = 1) => {
  const getGridWidth = () => {
    if (gridColumns === 4) return "23%";
    else if (gridColumns === 3) return "31%";
    else if (gridColumns === 2) return "47%";
    else return "95%";
  };

  const getBentoWidth = () => {
    if (bentoColumns === 4) return "23%";
    else if (bentoColumns === 3) return "31%";
    else if (bentoColumns === 2) return "47%";
    else return "95%";
  };

  return StyleSheet.create({
    // Same page as every other document (margins, font, base size, colours);
    // no fixed footer here, so the bottom margin is the plain one.
    page: { ...shared.page, paddingBottom: PAGE.margin },

    header: {
      marginBottom: 14,
      borderBottomWidth: 2,
      borderBottomColor: COLORS.rule,
      paddingBottom: 12,
    },

    title: {
      fontSize: SIZE.docTitle,
      fontWeight: "bold",
      marginBottom: 4,
    },

    subtitle: {
      fontSize: SIZE.body,
      fontWeight: "normal",
      color: COLORS.text,
    },

    /* ---------- TABLE ---------- */

    table: {
      width: "100%",
      marginTop: 4,
    },

    // Prevent individual rows from being split across pages
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: COLORS.hairline,
      pageBreakInside: "avoid",
      minPresenceAhead: 40,
    },

    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: COLORS.headBg,
      borderTopWidth: 1,
      borderTopColor: COLORS.rule,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.rule,
    },

    tableHeaderCell: {
      padding: 6,
      fontSize: SIZE.head,
      fontWeight: "bold",
    },

    tableCell: {
      padding: 6,
      fontSize: SIZE.cell,
    },

    /* ---------- GRID ---------- */

    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 10,
    },

    // Prevent grid cards from being split across pages
    gridItem: {
      width: getGridWidth(),
      borderWidth: 1,
      borderColor: COLORS.rule,
      borderRadius: 6,
      padding: 8,
      backgroundColor: COLORS.boxBg,
      pageBreakInside: "avoid",
      minPresenceAhead: 40,
    },

    /* ---------- BENTO ---------- */

    bentoContainer: {
      flexDirection: "row",

      gap: 12,
      marginTop: 10,
      alignItems: "flex-start", // Prevents height stretching across rows
    },

    bentoColumn: {
      flex: 1,
      gap: 12,
      flexDirection: "column",
    },

    // Prevent bento cards from being split across pages
    bentoItem: {
      width: "100%",
      borderWidth: 1,
      borderColor: COLORS.rule,
      borderRadius: 6,
      padding: 8,
      backgroundColor: COLORS.boxBg,
      pageBreakInside: "avoid",
      minPresenceAhead: 40,
      marginBottom: 0, // No extra margin, gap handled by bentoColumn
    },

    /* ---------- COMMON ---------- */

    contactName: {
      fontSize: SIZE.party,
      fontWeight: "bold",
      marginBottom: 6,
    },

    categoryBadge: {
      backgroundColor: COLORS.hairline,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      fontSize: SIZE.label,
      fontWeight: "bold",
      alignSelf: "flex-start",
      marginBottom: 8,
    },

    fieldLabel: {
      fontSize: SIZE.label,
      fontWeight: "bold",
      color: COLORS.muted,
      marginTop: 2,
      marginBottom: 2,
      textTransform: "uppercase",
    },

    fieldValue: {
      fontSize: SIZE.cell,
      lineHeight: 1.5,
    },

    phoneNumber: {
      fontSize: SIZE.cell,
      marginBottom: 2,
    },

    photo: {
      width: 40,
      aspectRatio: "1 / 1",
      borderRadius: 5,
      objectFit: "cover",
      pageBreakInside: "avoid",
    },

    photoLarge: {
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 6,
      objectFit: "cover",
      pageBreakInside: "avoid",
    },

    divider: {
      height: 1,
      backgroundColor: COLORS.rule,
      marginVertical: 4,
    },

    footer: shared.footer,
  });
};

/* ============================
   HELPERS
   ============================ */

const getCategoryLabel = (categoryId, categories) => {
  const category = categories.find((cat) => cat.id === categoryId);
  return category?.label || categoryId;
};

/* ============================
   LAYOUTS
   ============================ */

const TableLayout = ({ contacts, categories, includeFields, styles }) => {
  // Helper function to check if any contact has data for a specific field
  const hasDataInField = (fieldName) => {
    return contacts.some((contact) => {
      switch (fieldName) {
        case "photo":
          return contact.photo;
        case "name":
          return contact.name;
        case "category":
          return contact.category;
        case "phones":
          return contact.phones?.filter((p) => p && p.trim()).length > 0;
        case "address":
          return contact.address;
        case "specialty":
          return contact.specialty;
        case "notes":
          return contact.notes;
        default:
          return false;
      }
    });
  };

  // Define base weights for each column (relative proportions)
  const columnConfigs = [
    { key: "photo", label: "Photo", weight: 10, field: "photo" },
    { key: "name", label: "Name", weight: 20, field: "name" },
    { key: "category", label: "Category", weight: 12, field: "category" },
    { key: "phones", label: "Phone", weight: 18, field: "phones" },
    { key: "address", label: "Address", weight: 20, field: "address" },
    { key: "specialty", label: "Specialty", weight: 15, field: "specialty" },
    { key: "notes", label: "Notes", weight: 15, field: "notes" },
  ];

  // Filter columns based on includeFields and hasData
  const columns = columnConfigs.filter(
    (col) => includeFields[col.field] && hasDataInField(col.field),
  );

  // Calculate total weight and assign proportional widths
  const totalWeight = columns.reduce((sum, col) => sum + col.weight, 0);
  columns.forEach((col) => {
    col.w = `${(col.weight / totalWeight) * 100}%`;
  });

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        {columns.map((c) => (
          <View key={c.key} style={[styles.tableHeaderCell, { width: c.w }]}>
            <Text>{c.key.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {contacts.map((c, i) => {
        const phones = c.phones?.filter((p) => p && p.trim()) || [];
        return (
          <View key={c.id || i} style={styles.tableRow} wrap={false}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.tableCell, { width: col.w }]}>
                {col.key === "photo" && c.photo && (
                  <Image src={c.photo} style={styles.photo} />
                )}
                {col.key === "name" && <Text>{c.name}</Text>}
                {col.key === "category" && (
                  <Text>{getCategoryLabel(c.category, categories)}</Text>
                )}
                {col.key === "phones" && (
                  <>
                    {phones.length > 0 ? (
                      phones.map((phone, i) => (
                        <Text key={i} style={styles.phoneNumber}>
                          {phone}
                          {i === 0 && phones.length > 1 ? " ★" : ""}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: COLORS.faint }}>-</Text>
                    )}
                  </>
                )}
                {col.key === "address" && <Text>{c.address || "-"}</Text>}
                {col.key === "specialty" && <Text>{c.specialty || "-"}</Text>}
                {col.key === "notes" && <Text>{c.notes || "-"}</Text>}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
};

// Grid Layout Component
const GridLayout = ({ contacts, categories, includeFields, styles }) => {
  return (
    <View style={styles.gridContainer}>
      {contacts.map((contact, index) => {
        const phones = contact.phones?.filter((p) => p && p.trim()) || [];

        return (
          <View
            key={contact.id || index}
            style={styles.gridItem}
            // Avoid splitting this card across pages
            wrap={false}
          >
            <View style={{ gap: 2 }}>
              {includeFields.photo && contact.photo && (
                <Image src={contact.photo} style={styles.photoLarge} />
              )}

              {includeFields.name && (
                <Text style={styles.contactName}>{contact.name}</Text>
              )}

              {includeFields.category && (
                <View style={styles.categoryBadge}>
                  <Text>{getCategoryLabel(contact.category, categories)}</Text>
                </View>
              )}

              {includeFields.phones && phones.length > 0 && (
                <View>
                  <Text style={styles.fieldLabel}>PHONE</Text>
                  {phones.map((phone, i) => (
                    <Text key={i} style={styles.phoneNumber}>
                      • {phone}
                      {i === 0 && phones.length > 1 ? " (Primary)" : ""}
                    </Text>
                  ))}
                </View>
              )}

              {includeFields.address && contact.address && (
                <View>
                  <Text style={styles.fieldLabel}>ADDRESS</Text>
                  <Text style={styles.fieldValue}>{contact.address}</Text>
                </View>
              )}

              {includeFields.specialty && contact.specialty && (
                <View>
                  <Text style={styles.fieldLabel}>SPECIALTY</Text>
                  <Text style={styles.fieldValue}>{contact.specialty}</Text>
                </View>
              )}

              {includeFields.notes && contact.notes && (
                <View>
                  <Text style={styles.fieldLabel}>NOTES</Text>
                  <Text style={styles.fieldValue}>{contact.notes}</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Bento Layout Component - Column-wise distribution
const BentoLayout = ({
  contacts,
  categories,
  includeFields,
  styles,
  bentoColumns,
}) => {
  // Distribute contacts into columns - fill each column completely before next
  const distributeIntoColumns = (items, numColumns) => {
    const columns = Array.from({ length: numColumns }, () => []);
    const itemsPerColumn = Math.ceil(items.length / numColumns);

    // Fill columns sequentially: column 0 gets items 0-2, column 1 gets items 3-5, etc.
    items.forEach((item, index) => {
      const columnIndex = Math.floor(index / itemsPerColumn);
      if (columnIndex < numColumns) {
        columns[columnIndex].push(item);
      }
    });

    return columns;
  };

  const columns = distributeIntoColumns(contacts, bentoColumns);

  return (
    <View style={styles.bentoContainer}>
      {columns.map((columnContacts, columnIndex) => (
        <View key={columnIndex} style={styles.bentoColumn}>
          {columnContacts.map((contact, index) => {
            const phones = contact.phones?.filter((p) => p && p.trim()) || [];

            return (
              <View
                key={contact.id || index}
                style={styles.bentoItem}
                wrap={false}
              >
                <View style={{ gap: 2 }}>
                  {includeFields.photo && contact.photo && (
                    <Image src={contact.photo} style={styles.photoLarge} />
                  )}

                  {includeFields.name && (
                    <Text style={styles.contactName}>{contact.name}</Text>
                  )}

                  {includeFields.category && (
                    <View style={styles.categoryBadge}>
                      <Text>
                        {getCategoryLabel(contact.category, categories)}
                      </Text>
                    </View>
                  )}

                  {includeFields.phones && phones.length > 0 && (
                    <View>
                      <Text style={styles.fieldLabel}>PHONE</Text>
                      {phones.map((phone, i) => (
                        <Text key={i} style={styles.phoneNumber}>
                          • {phone}
                          {i === 0 && phones.length > 1 ? " (Primary)" : ""}
                        </Text>
                      ))}
                    </View>
                  )}

                  {includeFields.address && contact.address && (
                    <View>
                      <Text style={styles.fieldLabel}>ADDRESS</Text>
                      <Text style={styles.fieldValue}>{contact.address}</Text>
                    </View>
                  )}

                  {includeFields.specialty && contact.specialty && (
                    <View>
                      <Text style={styles.fieldLabel}>SPECIALTY</Text>
                      <Text style={styles.fieldValue}>{contact.specialty}</Text>
                    </View>
                  )}

                  {includeFields.notes && contact.notes && (
                    <View>
                      <Text style={styles.fieldLabel}>NOTES</Text>
                      <Text style={styles.fieldValue}>{contact.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

/* ============================
   DOCUMENT
   ============================ */

const ContactsPDFDocument = ({
  contacts,
  categories,
  layout,
  orientation,
  includeFields,
  gridColumns,
  bentoColumns,
}) => {
  const styles = createStyles(orientation, gridColumns, bentoColumns);

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Contacts Directory</Text>
          <Text style={styles.subtitle}>
            {contacts.length} Contact{contacts.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Content based on layout */}
        {layout === "table" && (
          <TableLayout
            contacts={contacts}
            categories={categories}
            includeFields={includeFields}
            styles={styles}
          />
        )}

        {layout === "grid" && (
          <GridLayout
            contacts={contacts}
            categories={categories}
            includeFields={includeFields}
            styles={styles}
          />
        )}

        {layout === "bento" && (
          <BentoLayout
            contacts={contacts}
            categories={categories}
            includeFields={includeFields}
            styles={styles}
            bentoColumns={bentoColumns}
          />
        )}

        {/* <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated with Vyaapaar • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        /> */}
      </Page>
    </Document>
  );
};

/* ============================
   EXPORT FUNCTION
   ============================ */

export const generateContactsPDF = async (props) => {
  const blob = await pdf(<ContactsPDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Contacts_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();

  // Revoking straight away can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
