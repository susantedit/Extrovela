/**
 * EXTROVELA — Media Processor & Privacy Stripper (Phase 7)
 * 
 * - Compresses images to lightweight JPEG web-optimized formats
 * - Strips sensitive EXIF GPS metadata before storage
 * - Generates fast thumbnails for journal timelines
 */

export interface ProcessedMedia {
  blob: Blob;
  dataUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  sizeBytes: number;
  durationSeconds?: number;
  type: 'photo' | 'video';
}

export interface MediaValidationConfig {
  maxImageSizeBytes?: number; // default 10MB
  maxVideoSizeBytes?: number; // default 50MB
  maxVideoDurationSeconds?: number; // default 60s
  allowedImageMimeTypes?: string[];
  allowedVideoMimeTypes?: string[];
}

const DEFAULT_CONFIG: Required<MediaValidationConfig> = {
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxVideoSizeBytes: 50 * 1024 * 1024,
  maxVideoDurationSeconds: 60,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'],
  allowedVideoMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'],
};

export class MediaProcessor {
  /**
   * Validates MIME type and size before processing
   */
  static validateFile(file: File, config: MediaValidationConfig = {}): { isValid: boolean; error?: string } {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return { isValid: false, error: 'Unsupported file type. Please upload a photo or short video.' };
    }

    if (isImage) {
      if (file.size > merged.maxImageSizeBytes) {
        return { isValid: false, error: `Image file exceeds maximum limit of ${Math.round(merged.maxImageSizeBytes / (1024 * 1024))}MB.` };
      }
      if (!merged.allowedImageMimeTypes.includes(file.type.toLowerCase())) {
        return { isValid: false, error: 'Unsupported image format. Allowed formats: JPEG, PNG, WEBP.' };
      }
    }

    if (isVideo) {
      if (file.size > merged.maxVideoSizeBytes) {
        return { isValid: false, error: `Video file exceeds maximum limit of ${Math.round(merged.maxVideoSizeBytes / (1024 * 1024))}MB.` };
      }
      if (!merged.allowedVideoMimeTypes.includes(file.type.toLowerCase())) {
        return { isValid: false, error: 'Unsupported video format. Allowed formats: MP4, WEBM, MOV.' };
      }
    }

    return { isValid: true };
  }

  /**
   * Compresses image to max dimension 1280px and strips EXIF GPS metadata
   */
  static async processImage(fileOrBlob: Blob | File, maxDimension = 1280, quality = 0.82): Promise<ProcessedMedia> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(fileOrBlob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;

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
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }

        // Draw image onto canvas (effectively stripping EXIF GPS metadata)
        ctx.drawImage(img, 0, 0, width, height);

        // Generate thumbnail (max 300px)
        const thumbCanvas = document.createElement('canvas');
        const thumbMax = 300;
        let thumbW = width;
        let thumbH = height;
        if (thumbW > thumbMax || thumbH > thumbMax) {
          if (thumbW > thumbH) {
            thumbH = Math.round((thumbH * thumbMax) / thumbW);
            thumbW = thumbMax;
          } else {
            thumbW = Math.round((thumbW * thumbMax) / thumbH);
            thumbH = thumbMax;
          }
        }
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
        }
        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({
              blob,
              dataUrl,
              thumbnailUrl,
              width,
              height,
              sizeBytes: blob.size,
              type: 'photo',
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for processing'));
      };

      img.src = url;
    });
  }

  /**
   * Validates video duration & generates video thumbnail frame
   */
  static async processVideo(file: File, maxDurationSeconds = 60): Promise<ProcessedMedia> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        if (video.duration > maxDurationSeconds) {
          URL.revokeObjectURL(url);
          reject(new Error(`Video duration (${Math.round(video.duration)}s) exceeds maximum allowed (${maxDurationSeconds}s).`));
          return;
        }

        // Seek to 1s to capture thumbnail
        video.currentTime = Math.min(1.0, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);
        // NOTE: do NOT revoke `url` here. It is returned as `dataUrl` for in-session
        // playback and as the local-only download URL when Firebase Storage is not
        // configured (see mediaStorageService); revoking it would hand back a dead
        // blob URL. The browser releases it on page unload and the capture flow is
        // short-lived, so the retained object URL is bounded.

        resolve({
          blob: file,
          dataUrl: url,
          thumbnailUrl,
          width: video.videoWidth || 640,
          height: video.videoHeight || 360,
          sizeBytes: file.size,
          durationSeconds: Math.round(video.duration),
          type: 'video',
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video file for processing.'));
      };

      video.src = url;
    });
  }
}

