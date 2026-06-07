import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import ActionButton from "../../components/ActionButton";
import EmailCodeCard from "../../components/EmailCodeCard";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../store/AuthStore";
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from "../../utils/authFlow";


export default function BackupEmailOfferScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { setBackupEmail, requestBackupEmailCode, verifyBackupEmailCode, skipBackupOnboarding } = useAuth();
  const [step, setStep] = useState("email");
  const [backupEmail, setBackupEmailValue] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextResendAt, setNextResendAt] = useState(null);

  const normalizedBackupEmail = normalizeEmail(backupEmail);

  async function handleSaveBackupEmail() {
    if (!isValidEmail(normalizedBackupEmail) || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await setBackupEmail(normalizedBackupEmail);
      const response = await requestBackupEmailCode();
      setNextResendAt(response?.nextResendAt ?? null);
      setStep("code");
      setCode("");
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (code.trim().length !== 6 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await verifyBackupEmailCode(code.trim());
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (resendLoading) return;
    setResendLoading(true);
    setError("");
    try {
      const response = await requestBackupEmailCode();
      setNextResendAt(response?.nextResendAt ?? null);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setResendLoading(false);
    }
  }

  if (step === "code") {
    return (
      <Screen padded withKeyboard>
        <EmailCodeCard
          title="Подтвердите резервную почту"
          description={`Мы отправили код на ${normalizedBackupEmail}`}
          code={code}
          onChangeCode={(value) => {
            setCode(value.replace(/\D/g, ""));
            setError("");
          }}
          onSubmit={handleVerifyCode}
          onResend={handleResendCode}
          onBack={() => {
            setStep("email");
            setError("");
          }}
          onSkip={skipBackupOnboarding}
          submitting={submitting}
          resendLoading={resendLoading}
          nextResendAt={nextResendAt}
          error={error}
        />
      </Screen>
    );
  }

  return (
    <Screen padded withKeyboard>
      <View
        style={{
          marginTop: spacing.xxl,
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.lg,
        }}
      >
        <Text style={[typography.h1, { color: colors.text }]}>Укажите резервную почту</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
          Резервная почта поможет сохранить доступ к цифровому гардеробу, если вы потеряете доступ к основной почте.
        </Text>

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.lg }]}>Email</Text>
        <Input
          value={backupEmail}
          onChangeText={(value) => {
            setBackupEmailValue(value);
            setError("");
          }}
          placeholder="backup@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{ marginTop: 6 }}
        />
        {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}

        <ActionButton
          label={submitting ? "Подождите..." : "Подтвердить"}
          icon="mail-outline"
          onPress={handleSaveBackupEmail}
          disabled={submitting || !isValidEmail(normalizedBackupEmail)}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
        <ActionButton
          label="Пропустить"
          variant="ghost"
          onPress={skipBackupOnboarding}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>
    </Screen>
  );
}
