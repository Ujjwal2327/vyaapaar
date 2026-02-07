/**
 * Utility functions for sorting categories
 */

/**
 * Sort categories alphabetically with "Other" always at the end
 * @param {Array} categories - Array of category objects
 * @returns {Array} Sorted categories
 */
export const sortCategories = (categories) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return [...categories].sort((a, b) => {
    // "Other" always goes last
    if (a.id === 'other') return 1;
    if (b.id === 'other') return -1;
    
    // Sort alphabetically by label
    return a.label.localeCompare(b.label);
  });
};

/**
 * Get count of people per category
 * @param {Array} peopleData - Array of people
 * @param {Array} categories - Array of categories
 * @returns {Object} Map of categoryId to count
 */
export const getCategoryCounts = (peopleData, categories) => {
  const counts = {};
  
  // Initialize all categories with 0
  categories.forEach((cat) => {
    counts[cat.id] = 0;
  });
  
  // Count people per category
  peopleData.forEach((person) => {
    const category = person.category || 'other';
    if (counts[category] !== undefined) {
      counts[category]++;
    }
  });
  
  return counts;
};