/**
 * Photo Cache Utility
 * Manages contact photos separately from contact data for better performance
 * 
 * Strategy:
 * 1. Contacts are fetched WITHOUT photos (fast initial load)
 * 2. Photos are stored separately in cache
 * 3. Photos are loaded on-demand when viewing/editing contacts
 */

class PhotoCache {
  constructor() {
    this.cache = new Map(); // In-memory cache: contactId -> photoBase64
    this.loading = new Set(); // Track which photos are currently being loaded
    this.storageKey = 'peoplePhotos'; // LocalStorage key for photos
    this.loadFromLocalStorage();
  }

  /**
   * Load all photos from localStorage on initialization
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const photos = JSON.parse(stored);
        Object.entries(photos).forEach(([id, photo]) => {
          this.cache.set(id, photo);
        });
        console.log(`Loaded ${this.cache.size} photos from cache`);
      }
    } catch (e) {
      console.error('Failed to load photos from localStorage:', e);
    }
  }

  /**
   * Save all photos to localStorage
   */
  saveToLocalStorage() {
    try {
      const photos = {};
      this.cache.forEach((photo, id) => {
        photos[id] = photo;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(photos));
    } catch (e) {
      console.error('Failed to save photos to localStorage:', e);
      // If localStorage is full, try to clear old photos
      if (e.name === 'QuotaExceededError') {
        this.clearOldPhotos();
      }
    }
  }

  /**
   * Get a photo from cache
   * @param {string} contactId - Contact ID
   * @returns {string|null} Photo base64 or null if not cached
   */
  get(contactId) {
    return this.cache.get(contactId) || null;
  }

  /**
   * Set a photo in cache
   * @param {string} contactId - Contact ID
   * @param {string|null} photo - Photo base64 (null to remove)
   */
  set(contactId, photo) {
    if (photo === null || photo === '') {
      this.cache.delete(contactId);
    } else {
      this.cache.set(contactId, photo);
    }
    this.saveToLocalStorage();
  }

  /**
   * Check if a photo is in cache
   * @param {string} contactId - Contact ID
   * @returns {boolean}
   */
  has(contactId) {
    return this.cache.has(contactId);
  }

  /**
   * Remove a photo from cache
   * @param {string} contactId - Contact ID
   */
  remove(contactId) {
    this.cache.delete(contactId);
    this.loading.delete(contactId);
    this.saveToLocalStorage();
  }

  /**
   * Check if a photo is currently being loaded
   * @param {string} contactId - Contact ID
   * @returns {boolean}
   */
  isLoading(contactId) {
    return this.loading.has(contactId);
  }

  /**
   * Mark a photo as loading
   * @param {string} contactId - Contact ID
   */
  startLoading(contactId) {
    this.loading.add(contactId);
  }

  /**
   * Mark a photo as finished loading
   * @param {string} contactId - Contact ID
   */
  finishLoading(contactId) {
    this.loading.delete(contactId);
  }

  /**
   * Batch set photos
   * @param {Object} photos - Object mapping contactId to photo base64
   */
  batchSet(photos) {
    Object.entries(photos).forEach(([id, photo]) => {
      if (photo) {
        this.cache.set(id, photo);
      }
    });
    this.saveToLocalStorage();
  }

  /**
   * Clear all photos from cache
   */
  clear() {
    this.cache.clear();
    this.loading.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error('Failed to clear photos from localStorage:', e);
    }
  }

  /**
   * Clear old photos if storage quota exceeded
   * Keeps only the 50 most recently used photos
   */
  clearOldPhotos() {
    // Convert to array and keep only first 50
    const entries = Array.from(this.cache.entries()).slice(0, 50);
    this.cache.clear();
    entries.forEach(([id, photo]) => {
      this.cache.set(id, photo);
    });
    this.saveToLocalStorage();
  }

  /**
   * Get cache statistics
   * @returns {Object} Stats about the cache
   */
  getStats() {
    const totalSize = Array.from(this.cache.values()).reduce(
      (sum, photo) => sum + (photo?.length || 0),
      0
    );
    
    return {
      count: this.cache.size,
      totalSizeKB: Math.round(totalSize / 1024),
      loading: this.loading.size,
    };
  }
}

// Create singleton instance
export const photoCache = new PhotoCache();

/**
 * Hook for using photo cache in React components
 */
export const usePhotoCache = () => {
  return {
    getPhoto: (contactId) => photoCache.get(contactId),
    setPhoto: (contactId, photo) => photoCache.set(contactId, photo),
    hasPhoto: (contactId) => photoCache.has(contactId),
    isLoading: (contactId) => photoCache.isLoading(contactId),
    removePhoto: (contactId) => photoCache.remove(contactId),
    stats: photoCache.getStats(),
  };
};