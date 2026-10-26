/**
 * Utility functions for handling, compressing, and uploading site images
 */

export const SAMPLE_SITE_PHOTOS = [
  {
    title: 'Commercial Façade',
    category: 'Façade Scaffold',
    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'High-Rise Cup-Lock',
    category: 'Cup-Lock System',
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Ground Shoring & Base',
    category: 'Heavy Shoring',
    url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Elevation Safety Netting',
    category: 'Safety Staging',
    url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
  },
];

/**
 * Reads a File object and converts it to a base64 Data URL.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image client-side using HTML5 Canvas to keep memory & upload sizes optimal.
 * Typical 4MB-10MB phone camera photos are reduced to ~100KB-200KB while preserving high visual fidelity.
 */
export async function compressImage(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  // If not in a browser environment or not an image, fallback to raw read
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return readFileAsDataUrl(file);
  }

  const dataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down proportionally if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl); // Fallback
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Return as JPEG Data URL
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(dataUrl); // Fallback to uncompressed if Image load fails
    };

    img.src = dataUrl;
  });
}

/**
 * Attempts to upload a file to the server /api/upload endpoint.
 * If server upload succeeds, returns the static URL (`/uploads/...`).
 * If it fails (e.g. read-only filesystem or network glitch), falls back seamlessly to the compressed Data URL.
 */
export async function processAndUploadImage(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn('Server upload unavailable, using client-side compressed base64 fallback:', err);
  }

  // Fallback to client-side compressed base64 Data URL
  return compressImage(file);
}
