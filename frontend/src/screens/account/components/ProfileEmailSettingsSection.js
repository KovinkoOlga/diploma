import React, { useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import Card from "../../../components/Card";
import Input from "../../../components/Input";
import ActionButton from "../../../components/ActionButton";
import EmailCodeCard from "../../../components/EmailCodeCard";
import SectionHeader from "../../../components/SectionHeader";
import SheetModal from "../../../components/SheetModal";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { useAuth } from "../../../store/AuthStore";
import { getAuthErrorMessage, isValidEmail, normalizeEmail } from "../../../utils/authFlow";


function EmailStatus({ label, value, status }) {
  const { colors, typography, spacing } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[typography.meta, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.text }]}>{value || "—"}</Text>
      <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: spacing.sm }]}>{status}</Text>
    </View>
  );
}


export default function ProfileEmailSettingsSection() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const {
    currentUser,
    setBackupEmail,
    deleteBackupEmail,
    requestBackupEmailCode,
    verifyBackupEmailCode,
    requestPrimaryEmailChange,
    verifyPrimaryEmailChange,
  } = useAuth();

  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryCode, setPrimaryCode] = useState("");
  const [primaryNextResendAt, setPrimaryNextResendAt] = useState(null);
  const [primarySubmitting, setPrimarySubmitting] = useState(false);
  const [primaryResendLoading, setPrimaryResendLoading] = useState(false);
  const [primaryError, setPrimaryError] = useState("");

  const [backupEmailInput, setBackupEmailInput] = useState(currentUser?.backupEmail ?? "");
  const [backupCode, setBackupCode] = useState("");
  const [backupNextResendAt, setBackupNextResendAt] = useState(null);
  const [backupSubmitting, setBackupSubmitting] = useState(false);
  const [backupResendLoading, setBackupResendLoading] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [codeModalType, setCodeModalType] = useState(null);

  useEffect(() => {
    setBackupEmailInput(currentUser?.backupEmail ?? "");
  }, [currentUser?.backupEmail]);

  const normalizedPrimaryEmail = normalizeEmail(primaryEmail);
  const normalizedStoredBackupEmail = normalizeEmail(currentUser?.backupEmail ?? "");
  const normalizedBackupInput = normalizeEmail(backupEmailInput);
  const backupEmailChanged = normalizedBackupInput !== normalizedStoredBackupEmail;

  const activeCodeModal = useMemo(() => {
    if (codeModalType === "primary") {
      return {
        title: "Подтвердите новую почту",
        description: `Мы отправили код на ${normalizedPrimaryEmail}`,
        code: primaryCode,
        onChangeCode: (value) => {
          setPrimaryCode(value.replace(/\D/g, ""));
          setPrimaryError("");
        },
        onSubmit: handlePrimaryVerifyCode,
        onResend: handlePrimaryResend,
        onBack: closeCodeModal,
        submitting: primarySubmitting,
        resendLoading: primaryResendLoading,
        nextResendAt: primaryNextResendAt,
        error: primaryError,
      };
    }

    if (codeModalType === "backup") {
      return {
        title: "Подтвердите резервную почту",
        description: `Мы отправили код на ${normalizeEmail(currentUser?.backupEmail || backupEmailInput)}`,
        code: backupCode,
        onChangeCode: (value) => {
          setBackupCode(value.replace(/\D/g, ""));
          setBackupError("");
        },
        onSubmit: handleBackupVerifyCode,
        onResend: handleBackupRequestExisting,
        onBack: closeCodeModal,
        submitting: backupSubmitting,
        resendLoading: backupResendLoading,
        nextResendAt: backupNextResendAt,
        error: backupError,
      };
    }

    return null;
  }, [
    backupCode,
    backupEmailInput,
    backupError,
    backupNextResendAt,
    backupResendLoading,
    backupSubmitting,
    codeModalType,
    currentUser?.backupEmail,
    normalizedPrimaryEmail,
    primaryCode,
    primaryError,
    primaryNextResendAt,
    primaryResendLoading,
    primarySubmitting,
  ]);

  function closeCodeModal() {
    setCodeModalType(null);
  }

  async function handlePrimaryRequestCode() {
    if (!isValidEmail(normalizedPrimaryEmail) || primarySubmitting) return;
    setPrimarySubmitting(true);
    setPrimaryError("");
    try {
      const response = await requestPrimaryEmailChange(normalizedPrimaryEmail);
      setPrimaryNextResendAt(response?.nextResendAt ?? null);
      setPrimaryCode("");
      setCodeModalType("primary");
    } catch (error) {
      setPrimaryError(getAuthErrorMessage(error));
    } finally {
      setPrimarySubmitting(false);
    }
  }

  async function handlePrimaryVerifyCode() {
    if (primaryCode.trim().length !== 6 || primarySubmitting) return;
    setPrimarySubmitting(true);
    setPrimaryError("");
    try {
      await verifyPrimaryEmailChange(normalizedPrimaryEmail, primaryCode.trim());
      setPrimaryEmail("");
      setPrimaryCode("");
      setPrimaryNextResendAt(null);
      closeCodeModal();
    } catch (error) {
      setPrimaryError(getAuthErrorMessage(error));
    } finally {
      setPrimarySubmitting(false);
    }
  }

  async function handlePrimaryResend() {
    if (primaryResendLoading) return;
    setPrimaryResendLoading(true);
    setPrimaryError("");
    try {
      const response = await requestPrimaryEmailChange(normalizedPrimaryEmail);
      setPrimaryNextResendAt(response?.nextResendAt ?? null);
    } catch (error) {
      setPrimaryError(getAuthErrorMessage(error));
    } finally {
      setPrimaryResendLoading(false);
    }
  }

  async function handleBackupSaveAndRequest() {
    if (!isValidEmail(normalizedBackupInput) || backupSubmitting || !backupEmailChanged) return;
    setBackupSubmitting(true);
    setBackupError("");
    try {
      await setBackupEmail(normalizedBackupInput);
      const response = await requestBackupEmailCode();
      setBackupNextResendAt(response?.nextResendAt ?? null);
      setBackupCode("");
      setCodeModalType("backup");
    } catch (error) {
      setBackupError(getAuthErrorMessage(error));
    } finally {
      setBackupSubmitting(false);
    }
  }

  async function handleBackupRequestExisting() {
    if (backupResendLoading) return;
    setBackupResendLoading(true);
    setBackupError("");
    try {
      const response = await requestBackupEmailCode();
      setBackupNextResendAt(response?.nextResendAt ?? null);
      setBackupCode("");
      setCodeModalType("backup");
    } catch (error) {
      setBackupError(getAuthErrorMessage(error));
    } finally {
      setBackupResendLoading(false);
    }
  }

  async function handleBackupVerifyCode() {
    if (backupCode.trim().length !== 6 || backupSubmitting) return;
    setBackupSubmitting(true);
    setBackupError("");
    try {
      await verifyBackupEmailCode(backupCode.trim());
      setBackupCode("");
      setBackupNextResendAt(null);
      closeCodeModal();
    } catch (error) {
      setBackupError(getAuthErrorMessage(error));
    } finally {
      setBackupSubmitting(false);
    }
  }

  function handleDeleteBackupEmail() {
    Alert.alert(
      "Удалить резервную почту?",
      "Резервная почта будет удалена из профиля и перестанет использоваться для входа.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              setBackupError("");
              await deleteBackupEmail();
              setBackupEmailInput("");
              setBackupCode("");
              setBackupNextResendAt(null);
              if (codeModalType === "backup") {
                closeCodeModal();
              }
            } catch (error) {
              setBackupError(getAuthErrorMessage(error));
            }
          },
        },
      ]
    );
  }

  return (
    <>
      <View>
        <SectionHeader title="Основная почта" />
        <View style={{ marginTop: spacing.sm }}>
          <Card style={{ padding: spacing.lg, borderRadius: radius.lg }}>
            <EmailStatus label="Текущая почта" value={currentUser?.email} status="Подтверждена" />
            <Input
              value={primaryEmail}
              onChangeText={(value) => {
                setPrimaryEmail(value);
                setPrimaryError("");
              }}
              placeholder="new@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {primaryError ? (
              <Text style={[typography.body, { color: colors.danger, marginTop: 8 }]}>{primaryError}</Text>
            ) : null}
            <ActionButton
              label={primarySubmitting ? "Подождите..." : "Получить код"}
              icon="mail-outline"
              onPress={handlePrimaryRequestCode}
              disabled={primarySubmitting || !isValidEmail(normalizedPrimaryEmail)}
              style={{ marginTop: spacing.md }}
              fullWidth
            />
          </Card>
        </View>
      </View>

      <View>
        <SectionHeader title="Резервная почта" />
        <View style={{ marginTop: spacing.sm }}>
          <Card style={{ padding: spacing.lg, borderRadius: radius.lg }}>
            <EmailStatus
              label="Текущая резервная почта"
              value={currentUser?.backupEmail || "Резервная почта не указана"}
              status={
                currentUser?.backupEmail
                  ? currentUser?.backupEmailVerified
                    ? "Подтверждена"
                    : "Не подтверждена"
                  : "Не указана"
              }
            />
            <View style={{ gap: spacing.sm }}>
              <Input
                value={backupEmailInput}
                onChangeText={(value) => {
                  setBackupEmailInput(value);
                  setBackupError("");
                }}
                placeholder="backup@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {backupError ? <Text style={[typography.body, { color: colors.danger }]}>{backupError}</Text> : null}
              <ActionButton
                label={backupSubmitting ? "Подождите..." : currentUser?.backupEmail ? "Изменить и получить код" : "Добавить и получить код"}
                icon="mail-outline"
                onPress={handleBackupSaveAndRequest}
                disabled={backupSubmitting || !isValidEmail(normalizedBackupInput) || !backupEmailChanged}
                fullWidth
              />
              {currentUser?.backupEmail && !currentUser?.backupEmailVerified ? (
                <ActionButton
                  label={backupResendLoading ? "Подождите..." : "Подтвердить текущую почту"}
                  variant="secondary"
                  onPress={handleBackupRequestExisting}
                  disabled={backupResendLoading}
                  fullWidth
                />
              ) : null}
              {currentUser?.backupEmail ? (
                <ActionButton
                  label="Удалить"
                  variant="danger"
                  onPress={handleDeleteBackupEmail}
                  disabled={backupSubmitting || backupResendLoading}
                  fullWidth
                />
              ) : null}
            </View>
          </Card>
        </View>
      </View>

      <SheetModal
        visible={Boolean(activeCodeModal)}
        onClose={closeCodeModal}
        title={activeCodeModal?.title || ""}
        withKeyboard
      >
        {activeCodeModal ? (
          <EmailCodeCard
            title={activeCodeModal.title}
            description={activeCodeModal.description}
            code={activeCodeModal.code}
            onChangeCode={activeCodeModal.onChangeCode}
            onSubmit={activeCodeModal.onSubmit}
            onResend={activeCodeModal.onResend}
            onBack={activeCodeModal.onBack}
            submitting={activeCodeModal.submitting}
            resendLoading={activeCodeModal.resendLoading}
            nextResendAt={activeCodeModal.nextResendAt}
            error={activeCodeModal.error}
            marginTop={0}
            codeInputVariant="otp"
            showHeader={false}
          />
        ) : null}
      </SheetModal>
    </>
  );
}
