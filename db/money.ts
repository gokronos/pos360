export function parseMoney(value: unknown): number {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Use un valor monetario con máximo dos decimales");
  const negative = normalized.startsWith("-"),
    unsigned = negative ? normalized.slice(1) : normalized,
    [whole, decimals = ""] = unsigned.split("."),
    minor = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor))
    throw new Error("Valor monetario demasiado grande");
  return negative ? -minor : minor;
}

export const moneyToMajor = (minor: number) => minor / 100;

export function multiplyMoney(minor: number, quantity: number): number {
  const scaledQuantity = Math.round(Number(quantity) * 1_000_000);
  if (!Number.isSafeInteger(scaledQuantity) || scaledQuantity <= 0)
    throw new Error("Cantidad inválida");
  return Math.round((minor * scaledQuantity) / 1_000_000);
}
