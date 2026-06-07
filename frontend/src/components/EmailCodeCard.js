import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import ActionButton from "./ActionButton";
import Input from "./Input";
import { useAppTheme } from "../theme/ThemeProvider";
import { formatCountdown, secondsUntil } from "../utils/authFlow";


export default function EmailCodeCard({
  title,
  description,
  code,
  onChangeCode,
  onSubmit,
  onResend,
  onBack,
  onSkip,
  submitting = false,
  resendLoading = false,
  nextResendAt = null,
  error = "",
  marginTop,
  codeInputVariant = "default",
  showHeader = true,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(nextResendAt));
  const [codeFocused, setCodeFocused] = useState(false);
  const hiddenCodeInputRef = useRef(null);

  useEffect(() => {
    setRemainingSeconds(secondsUntil(nextResendAt));
  }, [nextResendAt]);

  useEffect(() => {
    if (!remainingSeconds) return undefined;
    const timer = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const resendLabel = useMemo(() => {
    if (resendLoading) return "Отправляем...";
    if (remainingSeconds > 0) {
      return `Отправить ещё раз через ${formatCountdown(remainingSeconds)}`;
    }
    return "Отправить ещё раз";
  }, [remainingSeconds, resendLoading]);

  const activeCodeIndex = useMemo(() => {
    const clampedLength = Math.min(code.length, 6);
    if (clampedLength >= 6) return 5;
    return clampedLength;
  }, [code.length]);

  function renderOtpInput() {
    return (
      <Pressable
        onPress={() => hiddenCodeInputRef.current?.focus()}
        style={{
          width: "100%",
          alignSelf: "center",
          marginTop: spacing.lg,
        }}
      >
        <TextInput
          ref={hiddenCodeInputRef}
          value={code}
          onChangeText={onChangeCode}
          keyboardType="number-pad"
          maxLength={6}
          onFocus={() => setCodeFocused(true)}
          onBlur={() => setCodeFocused(false)}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
          }}
          selectionColor={colors.accent}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm}}>
          {Array.from({ length: 6 }).map((_, index) => {
            const digit = code[index] ?? "";
            const isActive = codeFocused && activeCodeIndex === index;
            return (
              <View
                key={`otp-digit-${index}`}
                style={{
                  width: 44,
                  height: 58,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.accent : colors.inputBorder,
                  backgroundColor: isActive ? colors.background : colors.secondaryBackground,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    typography.h1,
                    {
                      color: colors.text,
                      fontSize: 28,
                      lineHeight: 32,
                    },
                  ]}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        marginTop: marginTop ?? spacing.xxl,
        borderRadius: radius.xl,
        backgroundColor: colors.secondaryBackground,
        padding: spacing.lg,
      }}
    >
      {showHeader ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[typography.h1, { color: colors.text, flex: 1 }]}>{title}</Text>
            {onSkip ? <ActionButton label="Пропустить" variant="ghost" compact onPress={onSkip} /> : null}
          </View>
          <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>{description}</Text>
        </>
      ) : (
        <Text style={[typography.body, { color: colors.secondaryText }]}>{description}</Text>
      )}

      {codeInputVariant === "otp" ? (
        renderOtpInput()
      ) : (
        <>
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.lg }]}>Код</Text>
          <Input
            value={code}
            onChangeText={onChangeCode}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            style={{ marginTop: 6, letterSpacing: 6 }}
          />
        </>
      )}

      {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}

      <ActionButton
        label={submitting ? "Подождите..." : "Подтвердить"}
        icon="checkmark-outline"
        onPress={onSubmit}
        disabled={submitting}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
      <ActionButton
        label={resendLabel}
        variant="secondary"
        onPress={onResend}
        disabled={submitting || resendLoading || remainingSeconds > 0}
        style={{ marginTop: spacing.sm }}
        fullWidth
      />
      {onBack ? (
        <ActionButton label="Назад" variant="ghost" onPress={onBack} style={{ marginTop: spacing.sm }} fullWidth />
      ) : null}
    </View>
  );
}
