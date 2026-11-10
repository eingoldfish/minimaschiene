/**
 * Automatic saving in the browser's localStorage.
 *
 * localStorage is a small key/value store per website that survives
 * reloading the page (like a tiny Properties file in Java). Nothing is sent
 * to a server. It can be unavailable (private mode, blocked cookies), so
 * every access is wrapped in try/catch and the app works without it.
 */

const KEY_SOURCE = 'minimaschine.source';
const KEY_FILE_NAME = 'minimaschine.fileName';
const KEY_SETTINGS = 'minimaschine.settings';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: the app keeps working, only without autosave.
  }
}

/** The last program text, or null if nothing was saved yet. */
export function loadSource(): string | null {
  return read(KEY_SOURCE);
}

export function saveSource(source: string): void {
  write(KEY_SOURCE, source);
}

export function loadFileName(): string | null {
  return read(KEY_FILE_NAME);
}

export function saveFileName(name: string | null): void {
  write(KEY_FILE_NAME, name);
}

/**
 * Saved settings as a plain object. The caller checks each value,
 * because the stored data could be old or edited by hand.
 */
export function loadSettings(): Record<string, unknown> {
  const raw = read(KEY_SETTINGS);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings: Record<string, unknown>): void {
  write(KEY_SETTINGS, JSON.stringify(settings));
}
