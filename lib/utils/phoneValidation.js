/**
 * Phone Validation Utilities
 * Provides functions to check for duplicate phone numbers across contacts
 */

/**
 * Check if a phone number already exists in the people data
 * @param {string} phone - Phone number to check (will be cleaned)
 * @param {Array} peopleData - Array of all contacts
 * @param {string} excludePersonId - ID of person to exclude from check (for editing)
 * @returns {Object} { isDuplicate: boolean, existingContact: object|null }
 */
export const checkDuplicatePhone = (phone, peopleData, excludePersonId = null) => {
  if (!phone || !phone.trim()) {
    return { isDuplicate: false, existingContact: null };
  }

  // Clean the phone number (remove spaces)
  const cleanedPhone = phone.replace(/\s+/g, '');
  
  // Only check 10-digit valid phones
  if (!/^\d{10}$/.test(cleanedPhone)) {
    return { isDuplicate: false, existingContact: null };
  }

  // Find contact with this phone number
  const existingContact = peopleData.find(person => {
    // Skip the current person being edited
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

  return {
    isDuplicate: !!existingContact,
    existingContact: existingContact || null
  };
};

/**
 * Validate all phone numbers in a form to check for duplicates
 * @param {Array} phones - Array of phone numbers to validate
 * @param {Array} peopleData - Array of all contacts
 * @param {string} excludePersonId - ID of person to exclude from check
 * @returns {Object} { isValid: boolean, duplicates: Array }
 */
export const validatePhoneNumbers = (phones, peopleData, excludePersonId = null) => {
  const duplicates = [];
  
  phones.forEach((phone, index) => {
    if (!phone || !phone.trim()) return;
    
    const result = checkDuplicatePhone(phone, peopleData, excludePersonId);
    if (result.isDuplicate) {
      duplicates.push({
        phone,
        index,
        existingContact: result.existingContact
      });
    }
  });

  return {
    isValid: duplicates.length === 0,
    duplicates
  };
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
 * Batch check for duplicate phone numbers across multiple people
 * Used in bulk edit operations
 * @param {Array} peopleToCheck - Array of people objects to validate
 * @param {Array} existingPeople - Existing people data to check against
 * @returns {Object} { isValid: boolean, errors: Array }
 */
export const batchCheckDuplicatePhones = (peopleToCheck, existingPeople = []) => {
  const errors = [];
  const seenPhones = new Map(); // phone -> person name (within batch)

  peopleToCheck.forEach((person, personIndex) => {
    const phones = person.phones || [];
    
    phones.forEach((phone, phoneIndex) => {
      if (!phone || !phone.trim()) return;
      
      const cleanedPhone = phone.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(cleanedPhone)) return;

      // Check within batch (people being added/edited)
      if (seenPhones.has(cleanedPhone)) {
        errors.push({
          personIndex,
          phoneIndex,
          phone: cleanedPhone,
          type: 'batch_duplicate',
          message: `Phone ${cleanedPhone} is already used by "${seenPhones.get(cleanedPhone)}" (duplicate within this operation)`
        });
      } else {
        seenPhones.set(cleanedPhone, person.name);
      }

      // Check against existing people
      const duplicateCheck = checkDuplicatePhone(cleanedPhone, existingPeople, person.id);
      if (duplicateCheck.isDuplicate) {
        errors.push({
          personIndex,
          phoneIndex,
          phone: cleanedPhone,
          type: 'existing_duplicate',
          message: `Phone ${cleanedPhone} is already assigned to "${duplicateCheck.existingContact.name}"`,
          existingContact: duplicateCheck.existingContact
        });
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};