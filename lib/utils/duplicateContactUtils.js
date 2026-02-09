/**
 * Duplicate Contact Detection and Resolution Utilities
 * Handles detecting, comparing, and resolving duplicate contacts
 */

/**
 * Calculate similarity between two strings (0-1, where 1 is identical)
 * Uses Levenshtein distance normalized by string length
 */
const stringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLen);
};

/**
 * Normalize phone number for comparison
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/\s+/g, '').trim();
};

/**
 * Check if two contacts are exactly the same
 * @param {Object} contact1 - First contact
 * @param {Object} contact2 - Second contact
 * @returns {boolean} True if contacts are identical
 */
export const areContactsIdentical = (contact1, contact2) => {
  // Compare names (case-insensitive)
  if (contact1.name.toLowerCase().trim() !== contact2.name.toLowerCase().trim()) {
    return false;
  }
  
  // Compare categories
  if (contact1.category !== contact2.category) {
    return false;
  }
  
  // Compare phones (order doesn't matter)
  const phones1 = (contact1.phones || []).map(normalizePhone).filter(Boolean).sort();
  const phones2 = (contact2.phones || []).map(normalizePhone).filter(Boolean).sort();
  
  if (phones1.length !== phones2.length) {
    return false;
  }
  
  if (!phones1.every((phone, idx) => phone === phones2[idx])) {
    return false;
  }
  
  // Compare addresses (case-insensitive, trimmed)
  const addr1 = (contact1.address || '').toLowerCase().trim();
  const addr2 = (contact2.address || '').toLowerCase().trim();
  
  if (addr1 !== addr2) {
    return false;
  }
  
  // Compare specialty
  const spec1 = (contact1.specialty || '').toLowerCase().trim();
  const spec2 = (contact2.specialty || '').toLowerCase().trim();
  
  if (spec1 !== spec2) {
    return false;
  }
  
  // Compare notes
  const notes1 = (contact1.notes || '').toLowerCase().trim();
  const notes2 = (contact2.notes || '').toLowerCase().trim();
  
  if (notes1 !== notes2) {
    return false;
  }
  
  return true;
};

/**
 * Calculate duplicate score between two contacts
 * @param {Object} newContact - New contact being added
 * @param {Object} existingContact - Existing contact in database
 * @returns {Object} { score: number (0-1), reasons: Array, matchType: string }
 */
export const calculateDuplicateScore = (newContact, existingContact) => {
  const reasons = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  // 1. Check name similarity (weight: 30)
  const nameSimilarity = stringSimilarity(newContact.name, existingContact.name);
  totalScore += nameSimilarity * 30;
  maxPossibleScore += 30;
  
  if (nameSimilarity > 0.8) {
    reasons.push({
      field: 'name',
      score: nameSimilarity,
      message: `Names are ${Math.round(nameSimilarity * 100)}% similar`
    });
  }
  
  // 2. Check phone number overlap (weight: 40)
  const newPhones = (newContact.phones || []).map(normalizePhone).filter(Boolean);
  const existingPhones = (existingContact.phones || []).map(normalizePhone).filter(Boolean);
  
  const commonPhones = newPhones.filter(phone => existingPhones.includes(phone));
  
  if (newPhones.length > 0 && existingPhones.length > 0) {
    const phoneOverlap = commonPhones.length / Math.max(newPhones.length, existingPhones.length);
    totalScore += phoneOverlap * 40;
    maxPossibleScore += 40;
    
    if (commonPhones.length > 0) {
      reasons.push({
        field: 'phones',
        score: phoneOverlap,
        message: `${commonPhones.length} phone number(s) match: ${commonPhones.join(', ')}`
      });
    }
  }
  
  // 3. Check address similarity (weight: 15)
  if (newContact.address || existingContact.address) {
    const addressSimilarity = stringSimilarity(
      newContact.address || '',
      existingContact.address || ''
    );
    
    totalScore += addressSimilarity * 15;
    maxPossibleScore += 15;
    
    if (addressSimilarity > 0.7) {
      reasons.push({
        field: 'address',
        score: addressSimilarity,
        message: `Addresses are ${Math.round(addressSimilarity * 100)}% similar`
      });
    }
  }
  
  // 4. Check category match (weight: 10)
  if (newContact.category === existingContact.category) {
    totalScore += 10;
    reasons.push({
      field: 'category',
      score: 1,
      message: 'Same category'
    });
  }
  maxPossibleScore += 10;
  
  // 5. Check specialty similarity (weight: 5)
  if (newContact.specialty || existingContact.specialty) {
    const specialtySimilarity = stringSimilarity(
      newContact.specialty || '',
      existingContact.specialty || ''
    );
    
    totalScore += specialtySimilarity * 5;
    maxPossibleScore += 5;
    
    if (specialtySimilarity > 0.7) {
      reasons.push({
        field: 'specialty',
        score: specialtySimilarity,
        message: `Specialty is ${Math.round(specialtySimilarity * 100)}% similar`
      });
    }
  }
  
  // Calculate final score (0-1)
  const finalScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  
  // Determine match type
  let matchType = 'none';
  if (finalScore >= 0.95) {
    matchType = 'exact'; // Virtually identical
  } else if (finalScore >= 0.7) {
    matchType = 'high'; // Very likely duplicate
  } else if (finalScore >= 0.5) {
    matchType = 'medium'; // Possible duplicate
  } else if (finalScore >= 0.3) {
    matchType = 'low'; // Weak match
  }
  
  return {
    score: finalScore,
    reasons,
    matchType,
    isExact: areContactsIdentical(newContact, existingContact)
  };
};

/**
 * Find potential duplicates for a new contact
 * @param {Object} newContact - New contact being added
 * @param {Array} existingContacts - Array of existing contacts
 * @param {number} threshold - Minimum score to consider as duplicate (0-1)
 * @returns {Array} Array of duplicate matches with scores
 */
export const findPotentialDuplicates = (newContact, existingContacts, threshold = 0.5) => {
  const duplicates = [];
  
  existingContacts.forEach(existingContact => {
    const duplicate = calculateDuplicateScore(newContact, existingContact);
    
    if (duplicate.score >= threshold) {
      duplicates.push({
        existingContact,
        newContact,
        ...duplicate
      });
    }
  });
  
  // Sort by score (highest first)
  duplicates.sort((a, b) => b.score - a.score);
  
  return duplicates;
};

/**
 * Batch find duplicates for multiple new contacts
 * @param {Array} newContacts - Array of new contacts being added
 * @param {Array} existingContacts - Array of existing contacts
 * @param {number} threshold - Minimum score to consider as duplicate
 * @returns {Array} Array of objects with contact and its duplicates
 */
export const batchFindDuplicates = (newContacts, existingContacts, threshold = 0.5) => {
  const results = [];
  
  newContacts.forEach((newContact, index) => {
    const duplicates = findPotentialDuplicates(newContact, existingContacts, threshold);
    
    if (duplicates.length > 0) {
      results.push({
        index,
        newContact,
        duplicates,
        // Mark as exact duplicate if all duplicates are exact matches
        isExactDuplicate: duplicates.every(d => d.isExact)
      });
    }
  });
  
  return results;
};

/**
 * Merge two contacts, preferring non-empty values from new contact
 * @param {Object} existingContact - Existing contact
 * @param {Object} newContact - New contact data
 * @param {Object} options - Merge options
 * @returns {Object} Merged contact
 */
export const mergeContacts = (existingContact, newContact, options = {}) => {
  const {
    preferNew = true, // Prefer new contact's data when both have values
    mergePhones = true, // Combine phone numbers
    mergeNotes = true // Combine notes
  } = options;
  
  const merged = { ...existingContact };
  
  // Merge name (prefer new if preferNew is true)
  if (newContact.name && (preferNew || !merged.name)) {
    merged.name = newContact.name;
  }
  
  // Merge category
  if (newContact.category && (preferNew || !merged.category)) {
    merged.category = newContact.category;
  }
  
  // Merge phones
  if (mergePhones) {
    const existingPhones = (merged.phones || []).map(normalizePhone).filter(Boolean);
    const newPhones = (newContact.phones || []).map(normalizePhone).filter(Boolean);
    
    // Combine and deduplicate
    const allPhones = [...new Set([...existingPhones, ...newPhones])];
    merged.phones = allPhones.length > 0 ? allPhones : [''];
  } else if (preferNew && newContact.phones && newContact.phones.length > 0) {
    merged.phones = newContact.phones;
  }
  
  // Merge address
  if (newContact.address && (preferNew || !merged.address)) {
    merged.address = newContact.address;
  }
  
  // Merge specialty
  if (newContact.specialty && (preferNew || !merged.specialty)) {
    merged.specialty = newContact.specialty;
  }
  
  // Merge notes
  if (mergeNotes && newContact.notes) {
    if (merged.notes) {
      // Combine notes with separator
      merged.notes = `${merged.notes}\n\n--- Merged from duplicate ---\n${newContact.notes}`;
    } else {
      merged.notes = newContact.notes;
    }
  } else if (preferNew && newContact.notes) {
    merged.notes = newContact.notes;
  }
  
  // Merge photo (prefer new if available)
  if (newContact.photo && (preferNew || !merged.photo)) {
    merged.photo = newContact.photo;
  }
  
  return merged;
};

/**
 * Get human-readable explanation of duplicate match
 * @param {Object} duplicate - Duplicate object from calculateDuplicateScore
 * @returns {string} Human-readable explanation
 */
export const getDuplicateExplanation = (duplicate) => {
  const { score, reasons, matchType } = duplicate;
  
  if (reasons.length === 0) {
    return 'No significant similarities found';
  }
  
  const reasonTexts = reasons.map(r => r.message);
  
  let confidence = '';
  if (matchType === 'exact') {
    confidence = 'Almost certainly the same contact';
  } else if (matchType === 'high') {
    confidence = 'Very likely a duplicate';
  } else if (matchType === 'medium') {
    confidence = 'Possibly a duplicate';
  } else if (matchType === 'low') {
    confidence = 'Weak match';
  }
  
  return `${confidence} (${Math.round(score * 100)}% match)\n${reasonTexts.join('\n')}`;
};