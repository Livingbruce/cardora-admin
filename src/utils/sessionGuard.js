const TAB_SESSION_KEY = "cardora_admin_tab_session_id";

export function setTabSessionId() {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  try {
    sessionStorage.setItem(TAB_SESSION_KEY, id);
  } catch {
    // ignore storage errors
  }

  return id;
}

export function getTabSessionId() {
  try {
    return sessionStorage.getItem(TAB_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearTabSessionId() {
  try {
    sessionStorage.removeItem(TAB_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}