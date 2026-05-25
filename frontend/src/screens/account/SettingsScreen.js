import React, { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import ListRow from "../../components/ListRow";
import SectionHeader from "../../components/SectionHeader";
import SegmentedControl from "../../components/SegmentedControl";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../store/AuthStore";
import { Routes } from "../../navigation/routes";
import {
  disableWeeklyCalendarReminder,
  enableWeeklyCalendarReminder,
  getWeeklyCalendarReminderEnabled,
} from "../../services/notifications";

const THEME_OPTIONS = [
  { label: "Система", value: "system" },
  { label: "Светлая", value: "light" },
  { label: "Тёмная", value: "dark" },
];

const THEME_MODE_LABELS = {
  system: "Как в системе",
  light: "Светлая",
  dark: "Тёмная",
};

export default function SettingsScreen({ navigation }) {
  const { colors, spacing, typography, radius, themeMode, resolvedScheme, setThemeMode } = useAppTheme();
  const { logout } = useAuth();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(true);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadReminderSetting() {
      try {
        const enabled = await getWeeklyCalendarReminderEnabled();
        if (alive) {
          setReminderEnabled(enabled);
        }
      } finally {
        if (alive) {
          setReminderLoading(false);
        }
      }
    }

    loadReminderSetting();
    return () => {
      alive = false;
    };
  }, []);

  async function handleReminderToggle(nextValue) {
    setReminderLoading(true);
    setReminderError("");

    try {
      if (nextValue) {
        await enableWeeklyCalendarReminder();
        setReminderEnabled(true);
        return;
      }

      await disableWeeklyCalendarReminder();
      setReminderEnabled(false);
    } catch (error) {
      const message = error?.message || "Не удалось обновить настройку уведомлений.";
      setReminderEnabled(nextValue ? false : true);
      setReminderError(message);
      Alert.alert("Уведомления", message);
    } finally {
      setReminderLoading(false);
    }
  }

  async function handleThemeModeChange(nextMode) {
    if (nextMode === themeMode) {
      return;
    }

    await setThemeMode(nextMode);
  }

  const appearanceDescription =
    themeMode === "system"
      ? `Как в системе • Сейчас ${resolvedScheme === "dark" ? "тёмная" : "светлая"}`
      : THEME_MODE_LABELS[themeMode];

  return (
    <Screen scroll padded>
      <View style={{ gap: spacing.lg }}>
        <View>
          <SectionHeader title="Аккаунт" />
          <View style={{ marginTop: spacing.sm }}>
            <ListRow
              title="Личные данные"
              subtitle="Имя, email и фотография профиля"
              onPress={() => navigation.navigate(Routes.ProfileSettings)}
            />
          </View>
        </View>

        <View>
          <SectionHeader title="Уведомления" />
          <View style={{ marginTop: spacing.sm }}>
            <Card style={{ padding: spacing.md, borderRadius: radius.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.cardTitle, { color: colors.text }]}>Воскресное напоминание</Text>
                  <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>
                    Напоминать заполнить календарь образов каждое воскресенье в 21:00
                  </Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  disabled={reminderLoading}
                  onValueChange={handleReminderToggle}
                  trackColor={{ false: colors.divider, true: colors.text }}
                  thumbColor={colors.background}
                />
              </View>
            </Card>
            {reminderError ? (
              <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.sm }]}>{reminderError}</Text>
            ) : null}
          </View>
        </View>

        <View>
          <SectionHeader title="Внешний вид" />
          <View style={{ marginTop: spacing.sm }}>
            <Card style={{ padding: spacing.md, borderRadius: radius.lg }}>
              <Text style={[typography.cardTitle, { color: colors.text }]}>Тема</Text>
              <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>{appearanceDescription}</Text>
              <View style={{ marginTop: spacing.md }}>
                <SegmentedControl options={THEME_OPTIONS} value={themeMode} onChange={handleThemeModeChange} />
              </View>
            </Card>
          </View>
        </View>

        <View style={{ paddingTop: spacing.sm }}>
          <ListRow title="Выйти" danger onPress={logout} />
        </View>
      </View>
    </Screen>
  );
}
