/**
 * Firebase Storage Utilities
 * 
 * Utility functions for working with Firebase Storage images
 */

import { storage } from '../components/FirebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

// Cache for Firebase Storage URLs to avoid repeated API calls
const urlCache = new Map<string, string>();
const errorCache = new Set<string>();

// Default fallback images
export const DEFAULT_IMAGES = {
  main: 'https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/default.webp',
  placeholder: '/assets/placeholder-image.png' // Local fallback if Firebase is unavailable
};

/**
 * Upload a single image to Firebase Storage
 * @param file - The file to upload
 * @param path - The storage path (e.g., 'inflateables/product-name.png')
 * @returns Promise<string> - The download URL
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  try {
    console.log(`📤 Uploading image to: ${path}`);
    
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ Image uploaded successfully: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
}

/**
 * Upload main inflatable image
 * @param file - The main image file
 * @param productName - The product name (will be used as filename)
 * @returns Promise<string> - The download URL
 */
export async function uploadMainImage(file: File, productName: string): Promise<string> {
  const extension = file.name.split('.').pop() || 'png';
  const fileName = `${productName.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
  const path = `inflateables/${fileName}`;
  
  return uploadImage(file, path);
}

/**
 * Upload detail images for a product
 * @param files - Array of detail image files
 * @param productName - The product name
 * @returns Promise<string[]> - Array of download URLs
 */
export async function uploadDetailImages(files: File[], productName: string): Promise<string[]> {
  const uploadPromises = files.map((file, index) => {
    const extension = file.name.split('.').pop() || 'png';
    const fileName = file.name || `${productName.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.${extension}`;
    const path = `inflateables/detail-images/${productName}/${fileName}`;
    
    return uploadImage(file, path);
  });
  
  return Promise.all(uploadPromises);
}

/**
 * Delete an image from Firebase Storage
 * @param path - The storage path of the image to delete
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log(`🗑️ Image deleted: ${path}`);
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    throw error;
  }
}

/**
 * Get all images for a specific product with caching
 * @param productName - The product name
 * @returns Promise<{mainImage: string | null, detailImages: string[]}
 */
export async function getProductImages(productName: string): Promise<{
  mainImage: string | null;
  detailImages: string[];
}> {
  try {
    const cacheKey = `product-${productName}`;
    
    // Check cache first
    if (urlCache.has(cacheKey)) {
      const cachedData = JSON.parse(urlCache.get(cacheKey)!);
      return cachedData;
    }
    
    // Get main image
    let mainImage: string | null = null;
    const productKey = productName.toLowerCase().replace(/\s+/g, '-');
    
    // Try different extensions for main image
    const extensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
    for (const ext of extensions) {
      try {
        const imagePath = `inflateables/${productKey}.${ext}`;
        if (!errorCache.has(imagePath)) {
          const mainImageRef = ref(storage, imagePath);
          mainImage = await getDownloadURL(mainImageRef);
          break;
        }
      } catch (error) {
        errorCache.add(`inflateables/${productKey}.${ext}`);
      }
    }
    
    // Fallback to default if no main image found
    if (!mainImage) {
      mainImage = DEFAULT_IMAGES.main;
    }
    
    // Get detail images
    const detailImages: string[] = [];
    try {
      const detailImagesRef = ref(storage, `inflateables/detail-images/${productName}`);
      const listResult = await listAll(detailImagesRef);
      
      const downloadPromises = listResult.items.map(async (item) => {
        try {
          return await getDownloadURL(item);
        } catch (error) {
          console.warn(`Failed to get URL for detail image: ${item.fullPath}`);
          return null;
        }
      });
      
      const urls = await Promise.all(downloadPromises);
      detailImages.push(...urls.filter((url): url is string => url !== null));
    } catch (error) {
      console.log(`No detail images found for ${productName}`);
    }
    
    const result = { mainImage, detailImages };
    
    // Cache the result
    urlCache.set(cacheKey, JSON.stringify(result));
    
    return result;
  } catch (error) {
    console.error('❌ Error getting product images:', error);
    
    // Return defaults on error
    return {
      mainImage: DEFAULT_IMAGES.main,
      detailImages: []
    };
  }
}

/**
 * Generate a Firebase Storage URL for a product's main image
 * @param productName - The product name
 * @param extension - The image extension (default: 'png')
 * @returns string - The Firebase Storage URL
 */
export function generateMainImageUrl(productName: string, extension: string = 'png'): string {
  const fileName = `${productName.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
  return `https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/${fileName}`;
}

/**
 * Generate Firebase Storage URLs for a product's detail images
 * @param productName - The product name
 * @param imageNames - Array of image filenames
 * @returns string[] - Array of Firebase Storage URLs
 */
export function generateDetailImageUrls(productName: string, imageNames: string[]): string[] {
  return imageNames.map(imageName => 
    `https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/detail-images/${productName}/${imageName}`
  );
}

/**
 * Convert local image path to Firebase Storage URL
 * This is useful during migration from local images to Firebase Storage
 */
export function convertLocalToFirebaseUrl(localPath: string): string {
  // Remove /assets/ prefix and convert to Firebase Storage URL
  const firebasePath = localPath.replace('/assets/', '');
  return `https://storage.googleapis.com/pppro-b060e.firebasestorage.app/${firebasePath}`;
}

/**
 * Image compression utility (optional)
 * Compress an image before uploading to save storage space and bandwidth
 */
export async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        file.type,
        quality
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Preload images for better performance
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Preload multiple images
 */
export async function preloadImages(urls: string[]): Promise<void> {
  const loadPromises = urls.map(url => 
    preloadImage(url).catch(error => {
      console.warn(`Failed to preload image: ${url}`, error);
    })
  );
  
  await Promise.all(loadPromises);
}

/**
 * Clear caches (useful for development/testing)
 */
export function clearStorageCaches(): void {
  urlCache.clear();
  errorCache.clear();
  console.log('Firebase Storage caches cleared');
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats() {
  return {
    urlCacheSize: urlCache.size,
    errorCacheSize: errorCache.size,
    cachedUrls: Array.from(urlCache.keys()),
    errorPaths: Array.from(errorCache)
  };
}

/**
 * Enhanced main image URL generator with fallback
 */
export function getMainImageUrl(productName: string, extension: string = 'webp'): string {
  try {
    const fileName = `${productName.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
    return `https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/${fileName}`;
  } catch (error) {
    return DEFAULT_IMAGES.main;
  }
}

/**
 * Get detail image URLs with error handling
 */
export function getDetailImageUrls(productName: string, imageFilenames: string[]): string[] {
  try {
    const productFolder = productName.toLowerCase().replace(/\s+/g, '-');
    return imageFilenames.map(filename => 
      `https://storage.googleapis.com/pppro-b060e.firebasestorage.app/inflateables/detail-images/${productFolder}/${filename}`
    );
  } catch (error) {
    console.warn(`Error generating detail image URLs for ${productName}:`, error);
    return [];
  }
}