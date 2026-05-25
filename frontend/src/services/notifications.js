import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { navigationRef } from "../navigation/navigationRef";
import { Routes } from "../navigation/routes";
import { toISODate } from "../utils/formatDate";

const CHANNEL_ID = "calendar-reminders";
const WEEKLY_REMINDER_KEY = "weekly-calendar-reminder";
const WEEKLY_REMINDER_ENABLED_KEY = "settings_weekly_calendar_reminder_enabled";
const WEEKLY_REMINDER_WEEKDAY = 1;
const WEEKLY_REMINDER_HOUR = 21;
const WEEKLY_REMINDER_MINUTE = 0;
const PERMISSION_ERROR = "Разрешите уведомления в настройках устройства, чтобы включить напоминание.";
const NOTIFICATIONS_UNAVAILABLE_ERROR = "Не удалось настроить уведомления на этом устройстве.";

let ensurePromise = null;
let responseListener = null;
let lastHandledResponseId = "";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isWeeklyReminderResponse(response) {
  return response?.notification?.request?.content?.data?.reminderKey === WEEKLY_REMINDER_KEY;
}

function openReminderTarget() {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate("HomeTab", {
    screen: Routes.OutfitCalendar,
    params: { selectedDate: toISODate(new Date()), refreshKey: Date.now() },
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Напоминания календаря",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function getNotificationPermission({ requestIfNeeded = false } = {}) {
  const permission = await Notifications.getPermissionsAsync();
  let granted = permission.granted || permission.status === "granted";

  if (!granted && requestIfNeeded && permission.status === "undetermined") {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted || requested.status === "granted";
  }

  return granted;
}

async function getWeeklyReminderEntries() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((entry) => entry.content?.data?.reminderKey === WEEKLY_REMINDER_KEY);
}

async function cancelWeeklyReminderEntries() {
  const entries = await getWeeklyReminderEntries();
  if (!entries.length) {
    return 0;
  }

  await Promise.all(entries.map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)));
  return entries.length;
}

async function scheduleWeeklyReminder() {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Пора обновить календарь образов",
      body: "Отметьте, какие образы и вещи вы носили на этой неделе, чтобы статистика гардероба оставалась точной.",
      data: {
        reminderKey: WEEKLY_REMINDER_KEY,
        screen: Routes.OutfitCalendar,
      },
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: WEEKLY_REMINDER_WEEKDAY,
      hour: WEEKLY_REMINDER_HOUR,
      minute: WEEKLY_REMINDER_MINUTE,
    },
  });
}

export async function getWeeklyCalendarReminderEnabled() {
  try {
    return (await SecureStore.getItemAsync(WEEKLY_REMINDER_ENABLED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setWeeklyCalendarReminderEnabled(enabled) {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(WEEKLY_REMINDER_ENABLED_KEY, "1");
      return;
    }

    await SecureStore.deleteItemAsync(WEEKLY_REMINDER_ENABLED_KEY);
  } catch {
    return;
  }
}

export async function enableWeeklyCalendarReminder() {
  try {
    const granted = await getNotificationPermission({ requestIfNeeded: true });
    if (!granted) {
      await setWeeklyCalendarReminderEnabled(false);
      throw new Error(PERMISSION_ERROR);
    }

    await cancelWeeklyReminderEntries();
    await scheduleWeeklyReminder();
    await setWeeklyCalendarReminderEnabled(true);

    return { enabled: true, granted: true, scheduled: true };
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(NOTIFICATIONS_UNAVAILABLE_ERROR);
  }
}

export async function disableWeeklyCalendarReminder() {
  try {
    await cancelWeeklyReminderEntries();
    await setWeeklyCalendarReminderEnabled(false);
    return { enabled: false, scheduled: false };
  } catch {
    throw new Error(NOTIFICATIONS_UNAVAILABLE_ERROR);
  }
}

async function doEnsureWeeklyCalendarReminder() {
  const enabled = await getWeeklyCalendarReminderEnabled();
  if (!enabled) {
    await cancelWeeklyReminderEntries();
    return { enabled: false, granted: false, scheduled: false };
  }

  try {
    const granted = await getNotificationPermission();
    if (!granted) {
      await cancelWeeklyReminderEntries();
      return { enabled: true, granted: false, scheduled: false };
    }

    await cancelWeeklyReminderEntries();
    await scheduleWeeklyReminder();
    return { enabled: true, granted: true, scheduled: true };
  } catch {
    return { enabled: true, granted: false, scheduled: false };
  }
}

export async function ensureWeeklyCalendarReminder() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = doEnsureWeeklyCalendarReminder().finally(() => {
    ensurePromise = null;
  });
  return ensurePromise;
}

export async function syncWeeklyCalendarReminder() {
  return ensureWeeklyCalendarReminder();
}

export async function registerNotificationResponseHandler() {
  if (!responseListener) {
    responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const responseId = response?.notification?.request?.identifier ?? "";
      if (!isWeeklyReminderResponse(response) || responseId === lastHandledResponseId) {
        return;
      }
      lastHandledResponseId = responseId;
      openReminderTarget();
    });
  }

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  const lastResponseId = lastResponse?.notification?.request?.identifier ?? "";
  if (isWeeklyReminderResponse(lastResponse) && lastResponseId && lastResponseId !== lastHandledResponseId) {
    lastHandledResponseId = lastResponseId;
    openReminderTarget();
  }

  return () => {
    if (responseListener) {
      responseListener.remove();
      responseListener = null;
    }
  };
}
