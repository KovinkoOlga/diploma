export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export function secondsUntil(nextResendAt) {
  if (!nextResendAt) return 0;
  const diffMs = new Date(nextResendAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getAuthErrorMessage(error) {
  const message = String(error?.message ?? "");

  if (message.includes("Email already in use")) return "Эта почта уже используется";
  if (message.includes("Email is not registered or not verified")) {
    return "Почта не зарегистрирована или резервная почта не подтверждена";
  }
  if (message.includes("Backup email must be different from primary email")) {
    return "Резервная почта должна отличаться от основной";
  }
  if (message.includes("Backup email is not set")) return "Сначала укажите резервную почту";
  if (message.includes("New email must be different")) return "Укажите другую почту";
  if (message.includes("Code is invalid")) return "Код неверный";
  if (message.includes("Code has expired")) return "Код истёк. Запросите новый";
  if (message.includes("Too many attempts")) return "Слишком много попыток. Запросите новый код";
  if (message.includes("Resend available later")) return "Отправить код повторно можно позже";
  if (message.includes("Unable to send code right now")) return "Не удалось отправить код. Попробуйте позже";
  if (message.includes("Network request failed") || message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Не удалось подключиться к серверу";
  }

  return message || "Не удалось выполнить действие";
}
