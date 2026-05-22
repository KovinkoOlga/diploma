import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { launchWardrobePhotoFlow, resolveWardrobePhotoCatalogId, getWardrobePhotoModeConfig } from "../../utils/wardrobePhotoFlow";

export default function WardrobePhotoLauncherScreen({ navigation, route, mode }) {
  const { colors, spacing, typography, radius, layout } = useAppTheme();
  const { catalogs, actions } = useWardrobe();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const config = getWardrobePhotoModeConfig(mode);
  const catalogId = resolveWardrobePhotoCatalogId(catalogs, route.params?.catalogId);

  const startFlow = async () => {
    if (pending) return;

    setPending(true);
    setError("");
    try {
      const result = await launchWardrobePhotoFlow({
        navigation,
        actions,
        catalogs,
        mode,
        catalogId,
      });

      if (result.canceled) {
        setPending(false);
      }
    } catch (requestError) {
      setError(requestError.message || config.defaultError);
      setPending(false);
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startFlow();
  });

  return (
    <Screen style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            marginTop: spacing.xxl,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBackground,
            padding: spacing.lg,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pending ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={config.ctaIcon} size={28} color={colors.text} />
            )}
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: "center" }]}>
            {config.launcherTitle}
          </Text>
          <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm, textAlign: "center" }]}>
            {error || config.launcherDescription}
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <ActionButton
            label={pending ? "Открываем..." : config.retryLabel}
            icon={config.ctaIcon}
            disabled={pending}
            onPress={startFlow}
            fullWidth
          />
          <ActionButton label="Назад" icon="arrow-back-outline" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        </View>
      </View>
    </Screen>
  );
}
