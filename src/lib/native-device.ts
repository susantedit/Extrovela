// EXTROVELA — Native Device Hardware Services
// 100% Free & Open-Source Device Integrations via Capacitor
// Supports Android, iOS, and Web (with graceful fallbacks)

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// ─── 1. Camera & Photo Capture ────────────────────────────
export async function capturePhoto(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Gives user choice between Camera and Photos
      });
      return image.dataUrl || null;
    } else {
      // Web fallback: Prompt user with file picker
      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target?.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }
  } catch (error) {
    console.warn('[EXTROVELA Camera] Photo capture dismissed or unavailable:', error);
    return null;
  }
}

// ─── 2. GPS & Geolocation ─────────────────────────────────
export interface ExtrovelaCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export async function getCurrentGPS(): Promise<ExtrovelaCoords | null> {
  try {
    // Request permission if needed
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') {
        console.warn('[EXTROVELA GPS] Location permission denied.');
        return null;
      }
    }

    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (error) {
    console.warn('[EXTROVELA GPS] Unable to retrieve coordinates:', error);
    return null;
  }
}

// ─── 3. Haptic Feedback ───────────────────────────────────
export async function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light'): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      if (type === 'light') {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (type === 'medium') {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType.Warning });
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Web vibration API fallback
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(30);
      else if (type === 'success') navigator.vibrate([20, 40, 30]);
    }
  } catch {
    // Graceful silent ignore
  }
}

// ─── 4. Free Local Push Notifications ─────────────────────
export async function scheduleDailyQuestNotification(): Promise<void> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    // Schedule 9:00 AM Daily Morning Quest Drop
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 101,
          title: '✨ Your Daily Quest is Ready',
          body: "Break today's routine. Tap to discover your 3 personalized experiences.",
          schedule: {
            on: {
              hour: 9,
              minute: 0,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: undefined,
          extra: { type: 'daily_quest' },
        },
      ],
    });
  } catch (error) {
    console.warn('[EXTROVELA Notifications] Scheduling failed:', error);
  }
}

export async function scheduleQuestTimerNotification(questTitle: string, minutes: number): Promise<void> {
  try {
    const notifyAt = new Date(Date.now() + minutes * 60 * 1000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000),
          title: '🎉 Quest Time Completed!',
          body: `You've completed "${questTitle}". Tap to record your reflection and save the memory.`,
          schedule: { at: notifyAt },
        },
      ],
    });
  } catch {
    // Ignore if not supported on platform
  }
}

// ─── 5. Status Bar & Native Shell Setup ────────────────────
export async function initializeNativeShell(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Set status bar to dark aesthetic matching #08090D
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#08090D' });
      await StatusBar.setOverlaysWebView({ overlay: false });

      // Auto-hide splash screen once app boots
      await SplashScreen.hide();
    } catch (e) {
      console.warn('[EXTROVELA Native Shell] Setup warning:', e);
    }
  }
}
