import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import ActionButton from "../../components/ActionButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../store/AuthStore";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthErrorMessage(error) {
  const message = String(error?.message ?? "");

  if (message.includes("Email already registered")) return "Пользователь с таким email уже зарегистрирован";
  if (message.includes("Invalid email or password")) return "Неверный email или пароль";
  if (message.includes("Unable to refresh session") || message.includes("401")) return "Сессия истекла, войдите снова";
  if (message.includes("Network request failed") || message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Не удалось подключиться к серверу";
  }

  return "Не удалось выполнить действие";
}

export default function AuthScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const passwordValid = password.length >= 6;
  const canSubmit = useMemo(() => emailValid && passwordValid, [emailValid, passwordValid]);
  const showEmailError = (emailTouched || submitAttempted) && !emailValid;
  const showPasswordError = (passwordTouched || submitAttempted) && !passwordValid;

  const submit = async () => {
    setSubmitAttempted(true);
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (mode === "login") {
        await login(normalizedEmail, password);
      } else {
        await register(normalizedEmail, password);
      }
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={[typography.h1, { color: colors.text }]}>{mode === "login" ? "Вход" : "Регистрация"}</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
          Используйте аккаунт, чтобы синхронизировать шкаф, образы и профиль.
        </Text>

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.lg }]}>Email</Text>
        <Input
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{ marginTop: 6 }}
        />
        {showEmailError ? (
          <Text style={[typography.meta, { color: colors.danger, marginTop: 6 }]}>Введите корректный email</Text>
        ) : null}

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Пароль</Text>
        <Input
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          onBlur={() => setPasswordTouched(true)}
          placeholder="Минимум 6 символов"
          secureTextEntry
          style={{ marginTop: 6 }}
        />
        {showPasswordError ? (
          <Text style={[typography.meta, { color: colors.danger, marginTop: 6 }]}>Пароль должен быть не короче 6 символов</Text>
        ) : null}

        {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}

        <ActionButton
          label={submitting ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          icon="log-in-outline"
          onPress={submit}
          disabled={!canSubmit || submitting}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
        <ActionButton
          label={mode === "login" ? "Зарегистрироваться" : "Уже есть аккаунт"}
          variant="ghost"
          onPress={() => {
            setMode((current) => (current === "login" ? "register" : "login"));
            setError("");
            setSubmitAttempted(false);
          }}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>
    </Screen>
  );
}
