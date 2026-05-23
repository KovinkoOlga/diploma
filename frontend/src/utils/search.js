export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stemSearchWord(word) {
  let value = normalizeSearchText(word);
  const patterns = [
    /ыми$/u,
    /ими$/u,
    /ого$/u,
    /ему$/u,
    /ому$/u,
    /ами$/u,
    /ями$/u,
    /ая$/u,
    /яя$/u,
    /ое$/u,
    /ее$/u,
    /ые$/u,
    /ие$/u,
    /ый$/u,
    /ий$/u,
    /ой$/u,
    /ую$/u,
    /юю$/u,
    /ов$/u,
    /ев$/u,
    /ом$/u,
    /ем$/u,
    /ам$/u,
    /ям$/u,
    /ах$/u,
    /ях$/u,
    /ы$/u,
    /и$/u,
    /а$/u,
    /я$/u,
    /о$/u,
    /е$/u,
  ];

  for (const pattern of patterns) {
    if (value.length > 4 && pattern.test(value)) {
      value = value.replace(pattern, "");
      break;
    }
  }

  return value;
}

export function splitSearchTokens(values) {
  return values
    .flatMap((value) => normalizeSearchText(value).split(" "))
    .map((entry) => stemSearchWord(entry))
    .filter(Boolean);
}
