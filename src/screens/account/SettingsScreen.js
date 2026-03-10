import React from "react";
import { View } from "react-native";
import Screen from "../../components/Screen";
import ListRow from "../../components/ListRow";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";

export default function SettingsScreen() {
  const { spacing } = useAppTheme();

  return (
    <Screen scroll padded>
      <SectionHeader title="Аккаунт" />
      <ListRow title="Личные данные" subtitle="Имя, контакты и описание профиля" />
      <ListRow title="Уведомления" subtitle="Обновления по образам и новостям" />
      <ListRow title="Внешний вид" subtitle="Светлая и темная тема" />

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Приложение" />
      </View>
      <ListRow title="Помощь" subtitle="FAQ и обратная связь" />
      <ListRow title="Политика конфиденциальности" />
      <ListRow title="Выйти" danger />
    </Screen>
  );
}
