/**
 * Language utilities for multilingual support
 */

export type SupportedLanguage = 'et' | 'en' | 'fi';

/**
 * Maps language codes to human-readable language names
 */
export function getLanguageName(code: string): string {
	const mapping: Record<SupportedLanguage, string> = {
		et: 'Estonian',
		en: 'English',
		fi: 'Finnish'
	};
	return mapping[code as SupportedLanguage] || 'English';
}

/**
 * Validates if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
	return ['et', 'en', 'fi'].includes(code);
}

/**
 * Gets the default language (Estonian)
 */
export function getDefaultLanguage(): SupportedLanguage {
	return 'et';
}

/**
 * Normalizes language code to supported format
 */
export function normalizeLanguageCode(code: string | null | undefined): SupportedLanguage {
	if (!code) return getDefaultLanguage();

	const normalized = code.toLowerCase().substring(0, 2);
	return isSupportedLanguage(normalized) ? normalized : getDefaultLanguage();
}
