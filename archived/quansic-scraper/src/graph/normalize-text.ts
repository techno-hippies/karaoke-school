/**
 * Text normalization utilities for music data
 */

/**
 * Normalize capitalization for titles and names
 * - ALL CAPS -> Title Case
 * - lowercase -> Title Case
 * - Preserve mixed case if it looks intentional
 */
export function normalizeTitle(text: string | null | undefined): string {
  if (!text) return '';
  
  // Skip if it looks like an ID (contains numbers and all caps)
  if (/^[A-Z0-9_]+$/.test(text) && /\d/.test(text)) {
    return text;
  }
  
  // Check if it's all caps or all lowercase
  const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
  const isAllLower = text === text.toLowerCase() && /[a-z]/.test(text);
  
  // If it's mixed case and not just a single capital, preserve it
  if (!isAllCaps && !isAllLower && text !== text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()) {
    return text; // Preserve intentional mixed case like "iPhone" or "feat."
  }
  
  // Convert to title case
  return text
    .toLowerCase()
    .split(/(\s+|[-/])/)
    .map((word, index, array) => {
      // Keep delimiters as-is
      if (/^(\s+|[-/])$/.test(word)) return word;
      
      // Don't capitalize small words unless they're first/last
      const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with'];
      if (index !== 0 && index !== array.length - 1 && smallWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      
      // Special cases
      if (word.toLowerCase() === 'feat') return 'feat.';
      if (word.toLowerCase() === 'vs') return 'vs.';
      if (word.toLowerCase() === 'ii') return 'II';
      if (word.toLowerCase() === 'iii') return 'III';
      if (word.toLowerCase() === 'iv') return 'IV';
      
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Normalize publisher/company names
 * Preserves common abbreviations like LLC, INC, etc.
 */
export function normalizeCompanyName(text: string | null | undefined): string {
  if (!text) return '';
  
  // First normalize as title
  let normalized = normalizeTitle(text);
  
  // Fix common business abbreviations
  normalized = normalized
    .replace(/\b(llc|Llc)\b/gi, 'LLC')
    .replace(/\b(inc|Inc)\b\.?/gi, 'Inc.')
    .replace(/\b(corp|Corp)\b\.?/gi, 'Corp.')
    .replace(/\b(ltd|Ltd)\b\.?/gi, 'Ltd.')
    .replace(/\b(co|Co)\b\.(?!\w)/gi, 'Co.')
    .replace(/\b(pub|Pub)\b\.?/gi, 'Pub.')
    .replace(/\b(publ|Publ)\b\.?/gi, 'Publ.')
    .replace(/\bSony\/atv\b/gi, 'Sony/ATV')
    .replace(/\bBmi\b/g, 'BMI')
    .replace(/\bAscap\b/gi, 'ASCAP')
    .replace(/\bSesac\b/gi, 'SESAC');
    
  return normalized;
}

/**
 * Normalize person names
 * Handles special cases like "JOSHUA MARC FOUNTAIN" -> "Joshua Marc Fountain"
 */
export function normalizePersonName(text: string | null | undefined): string {
  if (!text) return '';
  
  // Check for non-Latin scripts (preserve as-is)
  if (/[\u0080-\uFFFF]/.test(text)) {
    return text;
  }
  
  return normalizeTitle(text);
}

/**
 * Decide which normalizer to use based on entity type
 */
export function normalizeByType(text: string | null | undefined, type: string): string {
  if (!text) return '';
  
  switch (type) {
    case 'publisher':
      return normalizeCompanyName(text);
    case 'mlc_writer':
    case 'contributor':
    case 'artist':
    case 'Person':
      return normalizePersonName(text);
    case 'work':
    case 'recording':
      return normalizeTitle(text);
    default:
      return text;
  }
}