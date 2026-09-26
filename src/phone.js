export function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidPhone(value) {
  const digits = phoneDigits(value);
  return digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits));
}

export function phoneHref(value) {
  const digits = phoneDigits(value);
  const international = digits.length === 10 ? `7${digits}`
    : digits.length === 11 && digits.startsWith("8") ? `7${digits.slice(1)}`
      : digits;
  return `tel:+${international}`;
}
