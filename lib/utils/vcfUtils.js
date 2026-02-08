/**
 * VCF (vCard) Import Utility Functions
 * Supports importing contacts from .vcf files
 */

/**
 * Parse a VCF file and extract contact information
 * @param {string} vcfContent - The content of the VCF file
 * @returns {Array} Array of parsed contacts
 */
export const parseVCFFile = (vcfContent) => {
  if (!vcfContent || !vcfContent.trim()) {
    throw new Error("VCF file is empty");
  }

  const contacts = [];
  const vcards = vcfContent.split(/BEGIN:VCARD/i).filter(Boolean);

  vcards.forEach((vcard) => {
    if (!vcard.trim()) return;

    // Ensure the vcard has an END:VCARD
    if (!vcard.match(/END:VCARD/i)) return;

    try {
      const contact = parseVCard(vcard);
      if (contact && contact.name) {
        contacts.push(contact);
      }
    } catch (error) {
      console.warn("Failed to parse vCard:", error);
    }
  });

  return contacts;
};

/**
 * Parse a single vCard entry
 * @param {string} vcard - Single vCard content
 * @returns {Object} Parsed contact object
 */
const parseVCard = (vcard) => {
  const lines = vcard.split(/\r?\n/).filter(Boolean);
  const contact = {
    name: "",
    phones: [],
    address: "",
    specialty: "",
    notes: "",
    photo: null,
  };

  let currentField = null;
  let multilineValue = "";

  lines.forEach((line) => {
    // Handle continuation lines (lines starting with space or tab)
    if (line.match(/^[ \t]/)) {
      multilineValue += line.trim();
      return;
    }

    // Process previous multiline field if exists
    if (currentField && multilineValue) {
      processField(contact, currentField, multilineValue);
      multilineValue = "";
      currentField = null;
    }

    // Skip END:VCARD line
    if (line.match(/^END:VCARD/i)) return;

    // Parse field and value
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return;

    const fieldPart = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1).trim();

    // Handle fields with parameters (e.g., TEL;TYPE=CELL:+1234567890)
    const [fieldName, ...params] = fieldPart.split(";");
    const field = fieldName.toUpperCase();

    // Check if this is a multiline field
    if (value && !value.match(/^END:/i)) {
      currentField = { field, params, value };
      multilineValue = value;
    }
  });

  // Process final multiline field if exists
  if (currentField && multilineValue) {
    processField(contact, currentField, multilineValue);
  }

  return contact;
};

/**
 * Process a vCard field and update the contact object
 * @param {Object} contact - Contact object to update
 * @param {Object} fieldInfo - Field information
 * @param {string} value - Field value
 */
const processField = (contact, fieldInfo, value) => {
  const { field, params } = fieldInfo;

  switch (field) {
    case "FN": // Formatted Name
      contact.name = decodeVCardValue(value);
      break;

    case "N": // Structured Name (fallback if FN is not present)
      if (!contact.name) {
        // N format: Family;Given;Middle;Prefix;Suffix
        const parts = value.split(";").map((p) => decodeVCardValue(p));
        const [family, given, middle, prefix, suffix] = parts;
        const nameParts = [prefix, given, middle, family, suffix].filter(
          Boolean
        );
        contact.name = nameParts.join(" ").trim();
      }
      break;

    case "TEL": // Telephone
      const phone = cleanPhoneNumber(decodeVCardValue(value));
      if (phone && phone.length === 10) {
        // Check if this is a preferred/primary number
        const isPrimary =
          params.some((p) => p.match(/PREF/i)) ||
          params.some((p) => p.match(/TYPE=PREF/i));

        if (isPrimary && contact.phones.length > 0) {
          // Move to front if primary
          contact.phones.unshift(phone);
        } else {
          contact.phones.push(phone);
        }
      }
      break;

    case "ADR": // Address
      // ADR format: PoBox;Extended;Street;City;Region;PostalCode;Country
      const addrParts = value
        .split(";")
        .map((p) => decodeVCardValue(p))
        .filter(Boolean);
      if (addrParts.length > 0) {
        contact.address = addrParts.join(", ");
      }
      break;

    case "TITLE": // Job Title / Specialty
      contact.specialty = decodeVCardValue(value);
      break;

    case "ORG": // Organization (could be used as specialty)
      if (!contact.specialty) {
        contact.specialty = decodeVCardValue(value);
      }
      break;

    case "NOTE": // Notes
      contact.notes = decodeVCardValue(value);
      break;

    case "PHOTO": // Photo (base64 encoded)
      // PHOTO format can be: PHOTO;ENCODING=BASE64;TYPE=JPEG:base64data
      // or PHOTO:data:image/jpeg;base64,base64data
      if (value.includes("base64")) {
        // Extract base64 data
        let base64Data = value;

        // Check if it's in data URL format
        if (value.startsWith("data:")) {
          contact.photo = value;
        } else {
          // Determine image type from params
          let mimeType = "image/jpeg"; // default
          params.forEach((p) => {
            if (p.match(/TYPE=PNG/i)) mimeType = "image/png";
            if (p.match(/TYPE=GIF/i)) mimeType = "image/gif";
          });

          // Remove any whitespace from base64
          base64Data = value.replace(/\s/g, "");
          contact.photo = `data:${mimeType};base64,${base64Data}`;
        }
      }
      break;

    default:
      // Ignore other fields
      break;
  }
};

/**
 * Decode vCard escaped values
 * @param {string} value - Encoded value
 * @returns {string} Decoded value
 */
const decodeVCardValue = (value) => {
  if (!value) return "";

  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
};

/**
 * Clean and validate phone number
 * @param {string} phone - Raw phone number
 * @returns {string} Cleaned 10-digit phone number or empty string
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return "";

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Handle international format (e.g., +91XXXXXXXXXX for India)
  // If starts with country code, remove it
  if (cleaned.length > 10) {
    // Try removing common country codes
    if (cleaned.startsWith("91") && cleaned.length === 12) {
      // India +91
      return cleaned.substring(2);
    } else if (cleaned.startsWith("1") && cleaned.length === 11) {
      // USA +1
      return cleaned.substring(1);
    }
    // For other cases, take last 10 digits
    return cleaned.slice(-10);
  }

  // Return only if exactly 10 digits
  return cleaned.length === 10 ? cleaned : "";
};

/**
 * Convert contacts array to Vyaapaar format
 * @param {Array} vcfContacts - Parsed VCF contacts
 * @param {string} categoryId - Target category ID
 * @returns {Array} Contacts in Vyaapaar format
 */
export const convertVCFToVyaapaarFormat = (vcfContacts, categoryId) => {
  return vcfContacts
    .filter((contact) => contact.name && contact.name.trim())
    .map((contact) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: contact.name.trim(),
      category: categoryId,
      phones: contact.phones.length > 0 ? contact.phones : [""],
      address: contact.address.trim(),
      specialty: contact.specialty.trim(),
      notes: contact.notes.trim(),
      photo: contact.photo || null,
    }));
};

/**
 * Main function to import VCF file
 * @param {File} file - VCF file object
 * @param {string} categoryId - Target category ID
 * @returns {Promise<Array>} Promise resolving to array of contacts
 */
export const importVCFFile = async (file, categoryId) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const vcfContent = e.target.result;
        const vcfContacts = parseVCFFile(vcfContent);

        if (vcfContacts.length === 0) {
          reject(new Error("No valid contacts found in VCF file"));
          return;
        }

        const vyaapaarContacts = convertVCFToVyaapaarFormat(
          vcfContacts,
          categoryId
        );
        resolve(vyaapaarContacts);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read VCF file"));
    };

    reader.readAsText(file);
  });
};