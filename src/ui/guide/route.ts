/**
 * Address of the guide: #anleitung or #guide, optionally with a section
 * (#anleitung/befehle). Kept apart from the guide texts so the app can check
 * the address without loading them (the guide is a chunk of its own).
 */
import type { Language } from '../../core';

/** Parses "#anleitung", "#guide" and "#anleitung/<section>". Returns null for other hashes. */
export function parseGuideHash(hash: string): { section: string | null } | null {
  const match = /^#(?:anleitung|guide)(?:\/([\w-]+))?$/.exec(hash);
  return match ? { section: match[1] ?? null } : null;
}

export function guideHash(lang: Language, section?: string): string {
  return `#${lang === 'de' ? 'anleitung' : 'guide'}${section ? `/${section}` : ''}`;
}
