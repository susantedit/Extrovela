/**
 * EXTROVELA — Media Storage Service (Phase 7)
 * 
 * Handles uploading processed memory media (photos and videos) to Firebase Storage with local fallback.
 */

import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject, StorageReference } from 'firebase/storage';
import { getFirebaseApp } from '../firebase/firebaseConfig';
import { ProcessedMedia } from '../../features/memories/mediaProcessor';
import { MemoryMedia } from '../../types/memory';
import { isRetriable, nextRetryDelayMs, progressFraction } from './uploadBackoff';
import logger from '../../utils/logger';

/**
 * Thrown when an in-flight upload is aborted via the caller's AbortSignal. It is
 * distinct from an upload failure so the caller can fire a `cancelled` event
 * rather than a `failed` one, and never retries.
 */
export class UploadCancelledError extends Error {
  constructor() {
    super('upload_cancelled');
    this.name = 'UploadCancelledError';
  }
}

/**
 * Optional observers/controls for a media upload. All are opt-in; when none are
 * supplied the upload behaves exactly as before, plus the bounded retry budget.
 */
export interface MediaUploadHooks {
  /** 0..1 upload progress, reported as bytes stream in. */
  onProgress?: (fraction: number) => void;
  /** Called before retry N (1-based) is attempted, per the backoff schedule. */
  onRetry?: (attempt: number) => void;
  /** Called once when the upload is aborted via `signal`. */
  onCancelled?: () => void;
  /** Aborts the upload; the returned record is marked failed, no retry. */
  signal?: AbortSignal;
}

export class MediaStorageService {
  /**
   * Uploads processed image or video to Firebase Storage.
   *
   * The upload is resumable and retried on transient failure using the pure,
   * deterministic schedule in uploadBackoff.ts (up to MAX_UPLOAD_RETRIES). A
   * caller may observe progress/retries and cancel via `hooks`.
   */
  async uploadMemoryMedia(params: {
    userId: string;
    memoryId: string;
    mediaId: string;
    processed: ProcessedMedia;
  }, hooks?: MediaUploadHooks): Promise<MemoryMedia> {
    const isVideo = params.processed.type === 'video';
    const ext = isVideo ? 'mp4' : 'jpg';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    const folder = isVideo ? 'videos' : 'photos';
    const storagePath = `users/${params.userId}/memories/${params.memoryId}/${folder}/${params.mediaId}.${ext}`;

    const mediaRecord: MemoryMedia = {
      id: params.mediaId,
      memoryId: params.memoryId,
      userId: params.userId,
      type: params.processed.type,
      storagePath,
      downloadUrl: params.processed.dataUrl,
      thumbnailUrl: params.processed.thumbnailUrl || params.processed.dataUrl,
      width: params.processed.width,
      height: params.processed.height,
      duration: params.processed.durationSeconds,
      size: params.processed.sizeBytes,
      createdAt: new Date().toISOString(),
      status: 'queued',
    };

    const app = getFirebaseApp();
    if (!app) {
      logger.info('Firebase app not configured; storing media locally', { mediaId: params.mediaId });
      mediaRecord.status = 'uploaded';
      return mediaRecord;
    }

    try {
      mediaRecord.status = 'uploading';
      const storage = getStorage(app);
      const storageRef = ref(storage, storagePath);

      // Resumable upload with a bounded retry budget. Progress and cancellation
      // are surfaced through hooks; a cancel throws UploadCancelledError so it is
      // never mistaken for a transient failure and never retried.
      await this.uploadWithRetry(storageRef, params.processed.blob, contentType, params.processed.sizeBytes, hooks);
      const downloadUrl = await getDownloadURL(storageRef);

      let thumbnailUrl = downloadUrl;
      if (params.processed.thumbnailUrl && params.processed.thumbnailUrl.startsWith('data:')) {
        try {
          const thumbPath = `users/${params.userId}/memories/${params.memoryId}/${folder}/thumb_${params.mediaId}.jpg`;
          const thumbRef = ref(storage, thumbPath);
          const thumbRes = await fetch(params.processed.thumbnailUrl);
          const thumbBlob = await thumbRes.blob();
          await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' });
          thumbnailUrl = await getDownloadURL(thumbRef);
        } catch (thumbErr) {
          logger.warn('Failed to upload thumbnail to storage, using preview', { error: String(thumbErr) });
        }
      }

      mediaRecord.downloadUrl = downloadUrl;
      mediaRecord.thumbnailUrl = thumbnailUrl;
      mediaRecord.status = 'uploaded';

      logger.info('Memory media successfully uploaded to Firebase Storage', { storagePath });
      return mediaRecord;
    } catch (err) {
      if (err instanceof UploadCancelledError) {
        logger.info('Media upload cancelled', { mediaId: params.mediaId });
        mediaRecord.status = 'failed';
        hooks?.onCancelled?.();
        return mediaRecord;
      }
      logger.warn('Failed to upload media to Firebase Storage, keeping local state', { error: String(err) });
      mediaRecord.status = 'failed';
      return mediaRecord;
    }
  }

  /**
   * Runs one resumable upload, retrying transient failures on the fixed backoff
   * schedule. Resolves when the bytes are committed; rejects with the original
   * error once the retry budget is exhausted, or UploadCancelledError on abort.
   */
  private uploadWithRetry(
    storageRef: StorageReference,
    data: Blob,
    contentType: string,
    totalBytes: number,
    hooks?: MediaUploadHooks
  ): Promise<void> {
    const attemptOnce = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (hooks?.signal?.aborted) {
          reject(new UploadCancelledError());
          return;
        }
        const task = uploadBytesResumable(storageRef, data, { contentType });
        const onAbort = () => {
          try {
            task.cancel();
          } catch {
            /* task already settled */
          }
        };
        hooks?.signal?.addEventListener('abort', onAbort, { once: true });
        task.on(
          'state_changed',
          snap => hooks?.onProgress?.(progressFraction(snap.bytesTransferred, snap.totalBytes || totalBytes)),
          err => {
            hooks?.signal?.removeEventListener('abort', onAbort);
            if (hooks?.signal?.aborted || (err as { code?: string })?.code === 'storage/canceled') {
              reject(new UploadCancelledError());
            } else {
              reject(err);
            }
          },
          () => {
            hooks?.signal?.removeEventListener('abort', onAbort);
            resolve();
          }
        );
      });

    const run = async (): Promise<void> => {
      let failures = 0;
      for (;;) {
        try {
          await attemptOnce();
          return;
        } catch (err) {
          if (err instanceof UploadCancelledError) throw err;
          if (!isRetriable(failures)) throw err;
          const delay = nextRetryDelayMs(failures);
          failures += 1;
          hooks?.onRetry?.(failures);
          await this.sleep(delay, hooks?.signal);
        }
      }
    };
    return run();
  }

  /** Delay that resolves after `ms`, or rejects immediately if aborted. */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      let id: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        clearTimeout(id);
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(new UploadCancelledError());
      };
      id = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Legacy wrapper for photo upload compatibility
   */
  async uploadMemoryPhoto(params: {
    userId: string;
    memoryId: string;
    mediaId: string;
    processed: ProcessedMedia;
  }): Promise<string> {
    const record = await this.uploadMemoryMedia(params);
    return record.downloadUrl;
  }

  /**
   * Deletes a specific media item from Firebase Storage
   */
  async deleteMediaItem(storagePath: string): Promise<void> {
    const app = getFirebaseApp();
    if (!app || !storagePath || storagePath.startsWith('data:')) return;

    try {
      const storage = getStorage(app);
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      logger.info('Deleted media from Firebase Storage', { storagePath });
    } catch (err) {
      logger.warn('Failed to delete media from Firebase Storage (may not exist)', { storagePath, err });
    }
  }
}

export const mediaStorageService = new MediaStorageService();
export default mediaStorageService;
