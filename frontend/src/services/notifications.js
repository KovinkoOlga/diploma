import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { Routes } from "../navigation/routes";
import { toISODate } from "../utils/formatDate";

const CHANNEL_ID = "calendar-reminders";
const WEEKLY_REMINDER_KEY = "weekly-calendar-reminder";

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

async function doEnsureWeeklyCalendarReminder() {
  await ensureAndroidChannel();

  const permission = await Notifications.getPermissionsAsync();
  let granted = permission.granted || permission.status === "granted";

  if (!granted && permission.status === "undetermined") {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted || requested.status === "granted";
  }

  if (!granted) {
    return { granted: false, scheduled: false };
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter((entry) => entry.content?.data?.reminderKey === WEEKLY_REMINDER_KEY);

  if (existing.length > 1) {
    await Promise.all(existing.map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)));
  }

  if (existing.length !== 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Пора обновить календарь образов",
        body: "Отметьте, какие образы и вещи вы носили на этой неделе — так статистика гардероба будет точнее.",
        data: {
          reminderKey: WEEKLY_REMINDER_KEY,
          screen: Routes.OutfitCalendar,
        },
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1,
        hour: 21,
        minute: 0,
      },
    });
  }

  return { granted: true, scheduled: true };
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
