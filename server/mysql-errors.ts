const MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH = 8;

type ObjectLike = object;

function isObjectLike(value: unknown): value is ObjectLike {
  return (
    value !== null && (typeof value === "object" || typeof value === "function")
  );
}

function readProperty(value: ObjectLike, property: PropertyKey): unknown {
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}

export function isMySqlDuplicateEntryError(error: unknown): boolean {
  const seen = new Set<ObjectLike>();
  let current: unknown = error;

  for (
    let depth = 0;
    depth <= MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH;
    depth += 1
  ) {
    if (!isObjectLike(current) || seen.has(current)) return false;
    seen.add(current);

    if (readProperty(current, "code") === "ER_DUP_ENTRY") return true;
    const errno = readProperty(current, "errno");
    if (typeof errno === "number" && errno === 1062) return true;

    if (depth === MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH) return false;
    const cause = readProperty(current, "cause");
    if (!isObjectLike(cause)) return false;
    current = cause;
  }

  return false;
}

export { MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH };
