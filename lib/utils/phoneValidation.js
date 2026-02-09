/**
 * Phone Validation Utilities
 * Provides functions to validate and clean phone numbers
 * Note: Multiple contacts CAN have the same phone number
 */

/**
 * Clean and deduplicate an array of phone numbers
 * Removes spaces and duplicate numbers within the same contact
 * @param {Array} phones - Array of phone numbers
 * @returns {Array} Cleaned and deduplicated phone numbers
 */
export const cleanAndDeduplicatePhones = (phones) => {
  if (!phones || !Array.isArray(phones)) return [''];
  
  // Clean each phone (remove spaces) and filter out empty strings
  const cleanedPhones = phones
    .map(phone => phone ? phone.replace(/\s+/g, '') : '')
    .filter(phone => phone.trim() !== '');
  
  // Remove duplicates using Set (within the same contact)
  const uniquePhones = [...new Set(cleanedPhones)];
  
  // If no valid phones, return array with empty string (for UI consistency)
  return uniquePhones.length > 0 ? uniquePhones : [''];
};

/**
 * Check for duplicate phones within the same contact's phone array
 * @param {Array} phones - Array of phone numbers
 * @returns {Object} { hasDuplicates: boolean, duplicateNumbers: Array }
 */
export const checkInternalDuplicates = (phones) => {
  const cleanedPhones = phones
    .filter(p => p && p.trim())
    .map(p => p.replace(/\s+/g, ''));
  
  const uniquePhones = [...new Set(cleanedPhones)];
  const hasDuplicates = cleanedPhones.length !== uniquePhones.length;
  
  const duplicateNumbers = cleanedPhones.filter((phone, index) => 
    cleanedPhones.indexOf(phone) !== index
  );

  return {
    hasDuplicates,
    duplicateNumbers: [...new Set(duplicateNumbers)]
  };
};

/**
 * Find contacts that share the same phone number
 * Used for duplicate detection, NOT validation
 * @param {string} phone - Phone number to search for
 * @param {Array} peopleData - Array of all contacts
 * @param {string} excludePersonId - ID of person to exclude from search
 * @returns {Array} Array of contacts that have this phone number
 */
export const findContactsWithPhone = (phone, peopleData, excludePersonId = null) => {
  if (!phone || !phone.trim()) {
    return [];
  }

  // Clean the phone number (remove spaces)
  const cleanedPhone = phone.replace(/\s+/g, '');
  
  // Only search for 10-digit valid phones
  if (!/^\d{10}$/.test(cleanedPhone)) {
    return [];
  }

  // Find all contacts with this phone number
  const contacts = peopleData.filter(person => {
    // Skip the excluded person
    if (excludePersonId && person.id === excludePersonId) {
      return false;
    }

    // Get all phones for this person (handle both old 'phone' and new 'phones' array)
    const phones = person.phones || (person.phone ? [person.phone] : []);
    
    // Check if any of this person's phones match
    return phones.some(p => {
      if (!p) return false;
      const cleanedP = p.replace(/\s+/g, '');
      return cleanedP === cleanedPhone;
    });
  });

  return contacts;
};

/**
 * Batch find all contacts that share phone numbers
 * Returns a map of phone numbers to contacts
 * @param {Array} peopleData - Array of all contacts
 * @returns {Object} Map of phone -> array of contacts with that phone
 */
export const findAllSharedPhoneNumbers = (peopleData) => {
  const phoneMap = new Map(); // phone -> array of contacts
  
  peopleData.forEach(person => {
    const phones = person.phones || (person.phone ? [person.phone] : []);
    
    phones.forEach(phone => {
      if (!phone || !phone.trim()) return;
      
      const cleanedPhone = phone.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(cleanedPhone)) return;
      
      if (!phoneMap.has(cleanedPhone)) {
        phoneMap.set(cleanedPhone, []);
      }
      phoneMap.get(cleanedPhone).push(person);
    });
  });
  
  // Filter to only include phones shared by multiple contacts
  const sharedPhones = {};
  phoneMap.forEach((contacts, phone) => {
    if (contacts.length > 1) {
      sharedPhones[phone] = contacts;
    }
  });
  
  return sharedPhones;
};