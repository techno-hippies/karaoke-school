/**
 * Strict lyrics format validator
 * Ensures all lyrics files follow standardized format before processing
 */

export interface ValidationError {
  file: string;
  line: number;
  error: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Standard section names allowed
const VALID_SECTION_NAMES = new Set([
  'intro',
  'verse',
  'verse 1',
  'verse 2',
  'verse 3',
  'verse 4',
  'pre-chorus',
  'chorus',
  'post-chorus',
  'bridge',
  'breakdown',
  'instrumental',
  'interlude',
  'outro'
]);

/**
 * Validate a single lyrics file
 */
export function validateLyricsFile(
  content: string,
  filename: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for section markers
    const markerMatch = line.match(/^\s*([\(\[])?([^\)\]]+)([\)\]])?\s*$/);

    if (!markerMatch) continue; // Not a marker, skip

    const openBracket = markerMatch[1];
    const content = markerMatch[2];
    const closeBracket = markerMatch[3];

    // Only validate if it looks like a section marker
    if (!openBracket && !closeBracket) continue;

    // ERROR: Mixed brackets
    if (openBracket && closeBracket) {
      if (
        (openBracket === '(' && closeBracket !== ')') ||
        (openBracket === '[' && closeBracket !== ']')
      ) {
        errors.push({
          file: filename,
          line: lineNum,
          error: `Mixed brackets: ${line.trim()}. Use matching pairs: [] or ()`,
          severity: 'error'
        });
        continue;
      }
    }

    // ERROR: Must use brackets []
    if (openBracket === '(' || closeBracket === ')') {
      errors.push({
        file: filename,
        line: lineNum,
        error: `Use brackets [] not parentheses (): "${line.trim()}"`,
        severity: 'error'
      });
      continue;
    }

    // ERROR: Missing opening or closing bracket
    if (!openBracket || !closeBracket) {
      errors.push({
        file: filename,
        line: lineNum,
        error: `Incomplete marker: "${line.trim()}". Must be [SectionName]`,
        severity: 'error'
      });
      continue;
    }

    // Normalize section name
    const sectionName = content.trim().toLowerCase();

    // WARNING: Non-standard section name
    if (!VALID_SECTION_NAMES.has(sectionName)) {
      // Check for common typos
      const typoSuggestions: Record<string, string> = {
        'chrous': 'chorus',
        'versus': 'verse',
        'vers': 'verse',
        'prechorus': 'pre-chorus',
        'prechoruss': 'pre-chorus',
        'postchoruss': 'post-chorus',
        'brigde': 'bridge',
        'outtro': 'outro',
        'montuno': 'bridge',
        'hook': 'chorus',
        'refrain': 'chorus'
      };

      const suggestion = typoSuggestions[sectionName];
      if (suggestion) {
        errors.push({
          file: filename,
          line: lineNum,
          error: `Typo detected: "${content}" → Did you mean "[${suggestion.charAt(0).toUpperCase() + suggestion.slice(1)}]"?`,
          severity: 'error'
        });
      } else {
        warnings.push({
          file: filename,
          line: lineNum,
          error: `Non-standard section name: "${content}". Standard names: ${Array.from(VALID_SECTION_NAMES).join(', ')}`,
          severity: 'warning'
        });
      }
    }

    // WARNING: Incorrect capitalization
    const expectedCapitalization = content
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (content !== expectedCapitalization && VALID_SECTION_NAMES.has(sectionName)) {
      warnings.push({
        file: filename,
        line: lineNum,
        error: `Capitalization: "${content}" → Should be "${expectedCapitalization}"`,
        severity: 'warning'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extract section structure from lyrics
 */
function extractSectionStructure(content: string): string[] {
  const lines = content.split('\n');
  const sections: string[] = [];

  for (const line of lines) {
    const markerMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (markerMatch) {
      sections.push(markerMatch[1].trim().toLowerCase());
    }
  }

  return sections;
}

/**
 * Validate that translation files match the main lyrics structure
 */
export function validateTranslations(
  mainLyrics: string,
  translations: Map<string, string>,
  songId: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const mainStructure = extractSectionStructure(mainLyrics);

  for (const [langCode, translationContent] of translations.entries()) {
    const translationStructure = extractSectionStructure(translationContent);

    // ERROR: Different number of sections
    if (translationStructure.length !== mainStructure.length) {
      errors.push({
        file: `${songId}/translations/${langCode}.txt`,
        line: 0,
        error: `Section count mismatch: Main has ${mainStructure.length} sections, ${langCode} has ${translationStructure.length}`,
        severity: 'error'
      });
      continue;
    }

    // ERROR: Section markers don't match
    for (let i = 0; i < mainStructure.length; i++) {
      if (mainStructure[i] !== translationStructure[i]) {
        errors.push({
          file: `${songId}/translations/${langCode}.txt`,
          line: 0,
          error: `Section ${i + 1} mismatch: Main has "${mainStructure[i]}", ${langCode} has "${translationStructure[i]}"`,
          severity: 'error'
        });
      }
    }

    // Count lines per section
    const mainSectionLines = countLinesPerSection(mainLyrics);
    const translationSectionLines = countLinesPerSection(translationContent);

    // WARNING: Different line counts per section
    for (let i = 0; i < mainStructure.length; i++) {
      const mainLines = mainSectionLines[i] || 0;
      const transLines = translationSectionLines[i] || 0;

      if (mainLines !== transLines) {
        warnings.push({
          file: `${songId}/translations/${langCode}.txt`,
          line: 0,
          error: `Section "${mainStructure[i]}" line count: Main has ${mainLines} lines, ${langCode} has ${transLines}`,
          severity: 'warning'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Count lines per section (excluding section marker itself)
 */
function countLinesPerSection(content: string): number[] {
  const lines = content.split('\n');
  const lineCounts: number[] = [];
  let currentSectionLines = 0;

  for (const line of lines) {
    const isMarker = line.match(/^\s*\[([^\]]+)\]\s*$/);
    const isEmpty = line.trim() === '';

    if (isMarker) {
      if (currentSectionLines > 0) {
        lineCounts.push(currentSectionLines);
      }
      currentSectionLines = 0;
    } else if (!isEmpty) {
      currentSectionLines++;
    }
  }

  // Push last section
  if (currentSectionLines > 0) {
    lineCounts.push(currentSectionLines);
  }

  return lineCounts;
}

/**
 * Validate entire song folder
 */
export async function validateSongFolder(
  songId: string,
  mainLyrics: string,
  translations: Map<string, string>
): Promise<ValidationResult> {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  // Validate main lyrics
  const mainResult = validateLyricsFile(mainLyrics, `${songId}/lyrics.txt`);
  allErrors.push(...mainResult.errors);
  allWarnings.push(...mainResult.warnings);

  // Validate each translation file
  for (const [langCode, content] of translations.entries()) {
    const transResult = validateLyricsFile(
      content,
      `${songId}/translations/${langCode}.txt`
    );
    allErrors.push(...transResult.errors);
    allWarnings.push(...transResult.warnings);
  }

  // Validate translations match structure
  const structureResult = validateTranslations(mainLyrics, translations, songId);
  allErrors.push(...structureResult.errors);
  allWarnings.push(...structureResult.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Format validation errors for console output
 */
export function formatValidationErrors(result: ValidationResult): string {
  const output: string[] = [];

  if (result.errors.length > 0) {
    output.push('\n❌ VALIDATION ERRORS:');
    for (const error of result.errors) {
      const location = error.line > 0 ? `:${error.line}` : '';
      output.push(`   ${error.file}${location}: ${error.error}`);
    }
  }

  if (result.warnings.length > 0) {
    output.push('\n⚠️  VALIDATION WARNINGS:');
    for (const warning of result.warnings) {
      const location = warning.line > 0 ? `:${warning.line}` : '';
      output.push(`   ${warning.file}${location}: ${warning.error}`);
    }
  }

  return output.join('\n');
}
