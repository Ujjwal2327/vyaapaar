/**
 * Image Compression Utility
 * Compresses images before saving to database to reduce storage and improve performance
 */

/**
 * Compresses an image file or base64 string
 * @param {File|string} input - File object or base64 string
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 600)
 * @param {number} options.maxHeight - Maximum height (default: 600)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.75)
 * @param {string} options.outputFormat - Output format: 'jpeg' or 'webp' (default: 'jpeg')
 * @returns {Promise<string>} Compressed base64 image
 */
export const compressImage = async (input, options = {}) => {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.75,
    outputFormat = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    // Create image element
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = Math.round(maxWidth / aspectRatio);
          } else {
            height = maxHeight;
            width = Math.round(maxHeight * aspectRatio);
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression
        const mimeType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';
        const compressedBase64 = canvas.toBlob(
          (blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = () => {
              reject(new Error('Failed to read compressed image'));
            };
            reader.readAsDataURL(blob);
          },
          mimeType,
          quality
        );
        
        // Fallback to toDataURL if toBlob fails
        if (!compressedBase64) {
          const fallbackBase64 = canvas.toDataURL(mimeType, quality);
          resolve(fallbackBase64);
        }
      } catch (error) {
        reject(new Error(`Image compression failed: ${error.message}`));
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Set image source
    if (typeof input === 'string') {
      // Base64 string
      img.src = input;
    } else if (input instanceof File) {
      // File object
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(input);
    } else {
      reject(new Error('Invalid input type. Expected File or base64 string.'));
    }
  });
};

/**
 * Gets the size of a base64 image in KB
 * @param {string} base64String - Base64 image string
 * @returns {number} Size in KB
 */
export const getBase64Size = (base64String) => {
  if (!base64String) return 0;
  
  // Remove data URL prefix if present
  const base64Data = base64String.split(',')[1] || base64String;
  
  // Calculate size: base64 adds ~33% overhead, so we divide by 1.33 to get actual size
  const sizeInBytes = (base64Data.length * 3) / 4;
  return Math.round(sizeInBytes / 1024); // Return KB
};

/**
 * Validates and compresses image with automatic fallback
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<{base64: string, originalSize: number, compressedSize: number}>}
 */
export const validateAndCompressImage = async (file, options = {}) => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file');
  }
  
  const originalSize = Math.round(file.size / 1024); // KB
  
  // If file is already small, compress with higher quality
  const compressionOptions = {
    maxWidth: 600,
    maxHeight: 600,
    quality: originalSize > 500 ? 0.65 : 0.8,
    outputFormat: 'jpeg',
    ...options
  };
  
  try {
    const compressedBase64 = await compressImage(file, compressionOptions);
    const compressedSize = getBase64Size(compressedBase64);
    
    console.log(`Image compressed: ${originalSize}KB → ${compressedSize}KB (${Math.round((1 - compressedSize/originalSize) * 100)}% reduction)`);
    
    return {
      base64: compressedBase64,
      originalSize,
      compressedSize
    };
  } catch (error) {
    console.error('Compression error:', error);
    throw error;
  }
};