import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Image,
  Font,
} from "@react-pdf/renderer";

// FONT REGISTRATION (LOCAL)
Font.register({
  family: "Ubuntu",
  fonts: [
    {
      src: "/fonts/Ubuntu-Regular.ttf",
      fontWeight: "normal",
    },
    {
      src: "/fonts/Ubuntu-Medium.ttf",
      fontWeight: "500",
    },
    {
      src: "/fonts/Ubuntu-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

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
    page: {
      padding: 20,
      fontFamily: "Ubuntu",
      fallbackFont: "Helvetica",
      fontSize: 11,
      backgroundColor: "#ffffff",
      color: "#000000",
    },

    header: {
      marginBottom: 14,
      borderBottomWidth: 2,
      borderBottomColor: "#000000",
      paddingBottom: 12,
    },

    title: {
      fontSize: 26,
      fontWeight: "bold",
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 12,
      fontWeight: "normal",
    },

    /* ---------- TABLE ---------- */

    table: {
      width: "100%",
      marginTop: 10,
    },

    // Prevent individual rows from being split across pages
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#000000",
      pageBreakInside: "avoid",
      // minPresenceAhead can be added if needed to reserve extra space, e.g. minPresenceAhead: 40
    },

    tableHeaderCell: {
      padding: 8,
      fontSize: 10,
      fontWeight: "bold",
      backgroundColor: "#f0f0f0",
    },

    tableCell: {
      padding: 8,
      fontSize: 10,
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
      borderWidth: 1.5,
      borderColor: "#000000",
      borderRadius: 8,
      padding: 8,
      backgroundColor: "#f9f9f9",
      pageBreakInside: "avoid",
      // You can also use minPresenceAhead if you find very tall cards still causing issues
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
      borderWidth: 1.5,
      borderColor: "#000000",
      borderRadius: 8,
      padding: 8,
      backgroundColor: "#f9f9f9",
      pageBreakInside: "avoid",
      marginBottom: 0, // No extra margin, gap handled by bentoColumn
    },

    /* ---------- COMMON ---------- */

    contactName: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 6,
    },

    categoryBadge: {
      backgroundColor: "#e5e5e5",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      fontSize: 9,
      fontWeight: "bold",
      alignSelf: "flex-start",
      marginBottom: 8,
    },

    fieldLabel: {
      fontSize: 10,
      fontWeight: "bold",
      marginTop: 2,
      marginBottom: 2,
      textTransform: "uppercase",
    },

    fieldValue: {
      fontSize: 10,
      lineHeight: 1.5,
    },

    phoneNumber: {
      fontSize: 10,
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
      borderRadius: 8,
      objectFit: "cover",
      pageBreakInside: "avoid",
    },

    divider: {
      height: 1,
      backgroundColor: "#000000",
      marginVertical: 4,
    },

    footer: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      textAlign: "center",
      fontSize: 9,
      borderTopWidth: 1,
      borderTopColor: "#000000",
      paddingTop: 8,
    },
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
  const columns = [];
  if (includeFields.photo)
    columns.push({ key: "photo", label: "Photo", w: "10%" });
  if (includeFields.name)
    columns.push({ key: "name", label: "Name", w: "20%" });
  if (includeFields.category)
    columns.push({ key: "category", label: "Category", w: "12%" });
  if (includeFields.phones)
    columns.push({ key: "phones", label: "Phone", w: "18%" });
  if (includeFields.address)
    columns.push({ key: "address", label: "Address", w: "20%" });
  if (includeFields.specialty)
    columns.push({ key: "specialty", label: "Specialty", w: "15%" });
  if (includeFields.notes)
    columns.push({ key: "notes", label: "Notes", w: "15%" });

  return (
    <View style={styles.table}>
      <View style={styles.tableRow} fixed>
        {columns.map((c) => (
          <View key={c.key} style={[styles.tableHeaderCell, { width: c.w }]}>
            <Text>{c.key.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {contacts.map((c, i) => {
        const phones = c.phones?.filter((p) => p && p.trim()) || [];
        // tableRow style already contains pageBreakInside: 'avoid'
        return (
          <View
            key={c.id || i}
            style={styles.tableRow}
            // wrap={false} prevents children from being broken across pages in many cases
            wrap={false}
          >
            {includeFields.photo && (
              <View style={[styles.tableCell, { width: "10%" }]}>
                {c.photo && <Image src={c.photo} style={styles.photo} />}
              </View>
            )}
            {includeFields.name && (
              <View style={[styles.tableCell, { width: "20%" }]}>
                <Text>{c.name}</Text>
              </View>
            )}
            {includeFields.category && (
              <View style={[styles.tableCell, { width: "12%" }]}>
                <Text>{getCategoryLabel(c.category, categories)}</Text>
              </View>
            )}
            {includeFields.phones && (
              <View style={[styles.tableCell, { width: "18%" }]}>
                {phones.length > 0 ? (
                  phones.map((phone, i) => (
                    <Text key={i} style={styles.phoneNumber}>
                      {phone}
                      {i === 0 && phones.length > 1 ? " â­" : ""}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: "#9ca3af" }}>-</Text>
                )}
              </View>
            )}
            {includeFields.address && (
              <View style={[styles.tableCell, { width: "20%" }]}>
                <Text>{c.address || "-"}</Text>
              </View>
            )}
            {includeFields.specialty && (
              <View style={[styles.tableCell, { width: "15%" }]}>
                <Text>{c.specialty || "-"}</Text>
              </View>
            )}
            {includeFields.notes && (
              <View style={[styles.tableCell, { width: "15%" }]}>
                <Text>{c.notes || "-"}</Text>
              </View>
            )}
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
                      â€¢ {phone}
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
const BentoLayout = ({ contacts, categories, includeFields, styles, bentoColumns }) => {
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

  URL.revokeObjectURL(url);
};