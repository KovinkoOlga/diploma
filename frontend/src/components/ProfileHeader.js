import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import Avatar from "./Avatar";
import StatsRow from "./StatsRow";
import ActionButton from "./ActionButton";

export default function ProfileHeader({
  name,
  handle,
  bio,
  avatarLabel,
  avatarSource,
  stats,
  onPrimaryPress,
  onSecondaryPress,
}) {
  const { colors, typography, spacing } = useAppTheme();

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar size={84} label={avatarLabel ?? name} source={avatarSource} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <StatsRow items={stats} />
        </View>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.cardTitle, { color: colors.text }]}>{name}</Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 2 }]}>{handle}</Text>
        {bio ? <Text style={[typography.body, { color: colors.text, marginTop: 8 }]}>{bio}</Text> : null}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <ActionButton label="Редактировать" variant="secondary" onPress={onPrimaryPress} style={{ flex: 1 }} fullWidth />
        <ActionButton label="Поделиться" variant="secondary" onPress={onSecondaryPress} style={{ flex: 1 }} fullWidth />
      </View>
    </View>
  );
}
