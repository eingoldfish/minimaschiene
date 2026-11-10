/**
 * Languages of all texts the core produces (error messages, explanations,
 * instruction help). German is the default everywhere.
 */
export type Language = 'de' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'en'];

/** A text in every language. */
export type Texts = Readonly<Record<Language, string>>;
