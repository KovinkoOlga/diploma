import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import { useAppTheme } from "../../theme/ThemeProvider";
import {
  WARDROBE_PHOTO_MODES,
  getWardrobePhotoModeConfig,
  setWardrobePhotoGuideHidden,
} from "../../utils/wardrobePhotoFlow";

const guideAssets = {
  onSelfOk: require("../../../assets/wardrobe-photo-guide/06_example_on_self_ok.png"),
  onBackgroundOk: require("../../../assets/wardrobe-photo-guide/07_example_on_background_ok.png"),
  oneItemOk: require("../../../assets/wardrobe-photo-guide/08_example_one_item_ok.png"),
  fullOutfitBad: require("../../../assets/wardrobe-photo-guide/09_example_full_outfit_bad.png"),
  notCoveredOk: require("../../../assets/wardrobe-photo-guide/10_example_not_covered_ok.png"),
  coveredBad: require("../../../assets/wardrobe-photo-guide/11_example_covered_bad.png"),
  calmBackgroundOk: require("../../../assets/wardrobe-photo-guide/12_example_calm_background_ok_darker.png"),
  busyBackgroundBad: require("../../../assets/wardrobe-photo-guide/13_example_busy_background_bad.png"),
};

const extraTips = [
  {
    id: "light",
    icon: "sunny-outline",
    title: "Снимайте при хорошем свете",
    description: "Ровный дневной свет без вспышки и сильных теней.",
  },
  {
    id: "frame",
    icon: "scan-outline",
    title: "Поместите вещь целиком",
    description: "Не обрезайте края и оставьте немного воздуха вокруг.",
  },
  {
    id: "smooth",
    icon: "shirt-outline",
    title: "Расправьте вещь",
    description: "Складки, воротник, рукава и шнурки лучше расправить.",
  },
];

function FooterButton({ label, icon, onPress, disabled }) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
      })}
    >
      <View
        style={{
          minHeight: 42,
          borderRadius: radius.md,
          backgroundColor: colors.text,
          borderWidth: 1,
          borderColor: colors.text,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons name={icon} size={17} color={colors.background} />
        <Text style={[typography.button, { color: colors.background, marginLeft: 8, fontSize: 13, lineHeight: 16 }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function ExampleImage({ source }) {
  const { radius } = useAppTheme();
  const asset = Image.resolveAssetSource(source);
  const aspectRatio = asset.width / asset.height;

  return (
    <View
      style={{
        width: "48.5%",
        maxWidth: "48.5%",
        minWidth: 0,
        boxSizing: "content-box",
        aspectRatio: aspectRatio,
      }}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={{
          height: "100%",
          width: "100%",
          borderRadius: radius.md,
        }}
      />
    </View>
  );
}

function RuleCard({ rule }) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: spacing.sm,
        gap: 7,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={[typography.caption, { color: colors.text, fontWeight: "600", fontSize: 16, lineHeight: 17 }]}>
          {rule.title}
        </Text>
        <Text style={[typography.small, { color: colors.secondaryText, fontSize: 13, lineHeight: 14 }]}>
          {rule.description}
        </Text>
      </View>

      <View style={{ 
        flexDirection: "row", 
        alignItems: "flex-start", 
        justifyContent: "space-between",
      }}>
        {rule.examples.map((example) => (
          <ExampleImage key={example.id} source={example.source} />
        ))}
      </View>
    </View>
  );
}

function TipRow({ tip }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, flex: 1, minWidth: 150 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#E8F5E8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={tip.icon} size={14} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.small, { color: colors.text, fontWeight: "600", fontSize: 12, lineHeight: 14 }]}>
          {tip.title}
        </Text>
        <Text style={[typography.small, { color: colors.secondaryText, marginTop: 1, fontSize: 11, lineHeight: 13 }]}>
          {tip.description}
        </Text>
      </View>
    </View>
  );
}

export default function WardrobePhotoGuideScreen({ navigation, route }) {
  const { colors, spacing, typography, radius, layout } = useAppTheme();
  const mode = route.params?.mode ?? WARDROBE_PHOTO_MODES.camera;
  const catalogId = route.params?.catalogId;
  const modeConfig = getWardrobePhotoModeConfig(mode);
  const [hideGuide, setHideGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const rules = useMemo(
    () => [
      {
        id: "on-self",
        title: "1. Можно на себе или на фоне",
        description: "Сфотографируйте вещь на себе или разложите её на однотонном фоне.",
        examples: [
          { id: "self", source: guideAssets.onSelfOk },
          { id: "background", source: guideAssets.onBackgroundOk },
        ],
      },
      {
        id: "single-item",
        title: "2. Одна вещь — один кадр",
        description: "Добавляйте по одной вещи за раз. Не снимайте полный образ, если нужна одна вещь.",
        examples: [
          { id: "single-ok", source: guideAssets.oneItemOk },
          { id: "single-bad", source: guideAssets.fullOutfitBad },
        ],
      },
      {
        id: "not-covered",
        title: "3. Не закрывайте вещь",
        description: "Руки, волосы, сумка, шарф или другая одежда не должны перекрывать вещь.",
        examples: [
          { id: "cover-ok", source: guideAssets.notCoveredOk },
          { id: "cover-bad", source: guideAssets.coveredBad },
        ],
      },
      {
        id: "background",
        title: "4. Выберите спокойный фон",
        description: "Избегайте пёстрых поверхностей, зеркал и лишних предметов в кадре.",
        examples: [
          { id: "background-ok", source: guideAssets.calmBackgroundOk },
          { id: "background-bad", source: guideAssets.busyBackgroundBad },
        ],
      },
    ],
    []
  );

  const handleContinue = async () => {
    if (submitting) return;

    setSubmitting(true);
    await setWardrobePhotoGuideHidden(hideGuide);
    navigation.replace(modeConfig.route, { catalogId });
  };

  return (
    <Screen style={{ flex: 1 }} edges={["left", "right"]}>
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: 4,
            paddingBottom: footerHeight + 4,
            gap: 6,
          }}
        >
          <Text style={[typography.caption, { color: colors.secondaryText, fontSize: 12, lineHeight: 16 }]}>
            Снимите вещь так, чтобы она была хорошо видна. Так приложение точнее удалит фон и красивее покажет её в шкафу.
          </Text>

          <View style={{ gap: 6 }}>
            {rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </View>

          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: "rgba(23,142,69,0.10)",
              backgroundColor: "#F7FBF7",
              padding: spacing.sm,
              gap: 6,
            }}
          >
            <Text style={[typography.caption, { color: colors.text, fontWeight: "600", fontSize: 16, lineHeight: 17 }]}>
              Ещё пара советов
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {extraTips.map((tip) => (
                <TipRow key={tip.id} tip={tip} />
              ))}
            </View>
          </View>
        </ScrollView>

        <View
          onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: layout.screenPadding,
            paddingTop: 4,
            paddingBottom: 2,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            gap: 4,
          }}
        >
          <Pressable
            onPress={() => setHideGuide((current) => !current)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Ionicons name={hideGuide ? "checkbox-outline" : "square-outline"} size={18} color={colors.text} />
            <Text style={[typography.caption, { color: colors.text, marginLeft: 7, fontSize: 12, lineHeight: 16 }]}>
              Больше не показывать
            </Text>
          </Pressable>

          <FooterButton
            label={submitting ? "Открываем..." : modeConfig.ctaLabel}
            icon={modeConfig.ctaIcon}
            disabled={submitting}
            onPress={handleContinue}
          />
        </View>
      </View>
    </Screen>
  );
}
