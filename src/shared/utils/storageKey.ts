export type StorageKeyCaseId = string | number | undefined | null;

const normalizeSegment = (value: string) => {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe || "root";
};

const getTenantId = () => {
  if (typeof window === "undefined") return "unknown";
  return localStorage.getItem("tenant_id") || "1";
};

const getPageKey = () => {
  if (typeof window === "undefined") return "unknown";
  const path = window.location.pathname || "";
  const search = window.location.search || "";
  return normalizeSegment(`${path}${search}`);
};

const getCaseIdFromUrl = () => {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const queryCaseId = params.get("caseId") || params.get("id");
  if (queryCaseId) return normalizeSegment(queryCaseId);
  const pathMatch = window.location.pathname.match(/\/(\d+)(?:\/)?$/);
  if (pathMatch?.[1]) return normalizeSegment(pathMatch[1]);
  return undefined;
};

export const getScopedStorageKey = (baseKey: string, caseId?: StorageKeyCaseId) => {
  const tenantId = getTenantId();
  const safeCaseId = caseId
    ? normalizeSegment(String(caseId))
    : getCaseIdFromUrl() || getPageKey();
  return `${baseKey}:${tenantId}:${safeCaseId}`;
};

const MIGRATION_FLAG_PREFIX = "storage_key_migration_v1";

export const migrateScopedStorageKeysOnce = (baseKeys: string[]) => {
  if (typeof window === "undefined") return;
  try {
    const tenantId = getTenantId();
    const flagKey = `${MIGRATION_FLAG_PREFIX}:${tenantId}`;
    if (localStorage.getItem(flagKey)) return;
    baseKeys.forEach((baseKey) => {
      const legacyValue = localStorage.getItem(baseKey);
      if (!legacyValue) return;
      const scopedKey = getScopedStorageKey(baseKey);
      if (localStorage.getItem(scopedKey)) return;
      localStorage.setItem(scopedKey, legacyValue);
    });
    localStorage.setItem(flagKey, "1");
  } catch {
    // ignore
  }
};
