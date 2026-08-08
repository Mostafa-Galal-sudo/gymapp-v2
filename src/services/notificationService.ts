import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const WATER_NOTIFICATION_CHANNEL = 'water_reminders';
const WATER_NOTIF_IDS = Array.from({ length: 16 }, (_, i) => 1000 + i);

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleWaterReminders(remainingMl: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const granted = await isNotificationPermissionGranted() || await requestNotificationPermission();
    if (!granted) return;

    // Cancel existing water reminders first
    await cancelWaterReminders();

    const now = new Date();
    const startHour = 7;  // 7 AM
    const endHour = 22;   // 10 PM

    const notifications = [];
    let notifIndex = 0;

    for (let hour = startHour; hour <= endHour; hour++) {
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, 0, 0, 0);

      // Skip hours that have already passed today
      if (scheduledTime <= now) continue;

      if (notifIndex >= 16) break;

      notifications.push({
        id: WATER_NOTIF_IDS[notifIndex],
        title: '💧 اشرب ماء!',
        body: `هدفك ${remainingMl}ml باقي. جسمك محتاج ماء دلوقتي! 🥤`,
        schedule: { at: scheduledTime },
        channelId: WATER_NOTIFICATION_CHANNEL,
        smallIcon: 'ic_stat_water',
        actionTypeId: '',
        extra: { type: 'water_reminder' },
      });

      notifIndex++;
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.warn('Failed to schedule water reminders:', err);
  }
}

export async function cancelWaterReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const waterNotifs = pending.notifications.filter(n =>
      WATER_NOTIF_IDS.includes(n.id)
    );
    if (waterNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: waterNotifs });
    }
  } catch (err) {
    console.warn('Failed to cancel water reminders:', err);
  }
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

// ── Supplement Timing Reminders ─────────────────────────────────────────────
const SUPPLEMENT_NOTIFICATION_CHANNEL = 'supplement_reminders';
const SUPPLEMENT_NOTIF_IDS = Array.from({ length: 40 }, (_, i) => 2000 + i);

// Each supplement's `timing` is free text (e.g. "Morning with breakfast",
// "Evening before bed", "Morning + Evening") — parsed into clock times via
// keyword matching rather than requiring a strict time-picker field.
const TIMING_KEYWORDS: { keywords: string[]; hour: number; minute: number }[] = [
  { keywords: ['morning', 'breakfast', 'صباح', 'الفطار'], hour: 8, minute: 0 },
  { keywords: ['lunch', 'غداء', 'الغدا'], hour: 13, minute: 0 },
  { keywords: ['afternoon', 'بعد الضهر'], hour: 15, minute: 0 },
  { keywords: ['evening', 'dinner', 'مساء', 'العشاء'], hour: 19, minute: 0 },
  { keywords: ['night', 'before bed', 'bed', 'ليل', 'قبل النوم'], hour: 21, minute: 30 },
];

interface SupplementForReminders {
  id: string;
  name: string;
  timing: string;
}

export async function scheduleSupplementReminders(supplements: SupplementForReminders[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const granted = await isNotificationPermissionGranted() || await requestNotificationPermission();
    if (!granted) return;

    await cancelSupplementReminders();

    const now = new Date();
    const notifications = [];
    let notifIndex = 0;

    for (const sup of supplements) {
      const timingLower = sup.timing.toLowerCase();
      const matchedSlots = TIMING_KEYWORDS.filter(slot =>
        slot.keywords.some(kw => timingLower.includes(kw))
      );
      // Fall back to a single reasonable default if the timing text didn't
      // match any known keyword, so every supplement still gets a reminder.
      const slotsToUse = matchedSlots.length > 0 ? matchedSlots : [TIMING_KEYWORDS[0]];

      for (const slot of slotsToUse) {
        if (notifIndex >= SUPPLEMENT_NOTIF_IDS.length) break;
        const scheduledTime = new Date();
        scheduledTime.setHours(slot.hour, slot.minute, 0, 0);
        if (scheduledTime <= now) scheduledTime.setDate(scheduledTime.getDate() + 1);

        notifications.push({
          id: SUPPLEMENT_NOTIF_IDS[notifIndex],
          title: '💊 وقت المكمل',
          body: `حان وقت أخذ ${sup.name} (${sup.timing})`,
          schedule: { at: scheduledTime, repeats: true, every: 'day' as const },
          channelId: SUPPLEMENT_NOTIFICATION_CHANNEL,
          extra: { type: 'supplement_reminder', supplementId: sup.id },
        });
        notifIndex++;
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.warn('Failed to schedule supplement reminders:', err);
  }
}

export async function cancelSupplementReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const supplementNotifs = pending.notifications.filter(n =>
      SUPPLEMENT_NOTIF_IDS.includes(n.id)
    );
    if (supplementNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: supplementNotifs });
    }
  } catch (err) {
    console.warn('Failed to cancel supplement reminders:', err);
  }
}
