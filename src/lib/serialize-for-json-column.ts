/** Clone for Postgres jsonb — `JSON.stringify` cannot encode BigInt (e.g. fund plan amounts). */
export function serializeForJsonColumn<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as T;
}
