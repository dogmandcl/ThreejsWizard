/**
 * Code Validator - Syntax validation for JavaScript, TypeScript, and JSON files
 * Provides basic syntax checks before writing code files
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// File extensions that should be validated
const VALIDATABLE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json']);

/**
 * Checks if a file should be validated based on its extension
 */
export function shouldValidate(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return VALIDATABLE_EXTENSIONS.has(ext);
}

/**
 * Validates file content based on file type
 */
export function validate(filePath: string, content: string): ValidationResult {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

  if (ext === '.json') {
    return validateJSON(content);
  }

  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    return validateJavaScript(content);
  }

  return { valid: true, errors: [], warnings: [] };
}

/**
 * Validates JSON syntax
 */
export function validateJSON(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`JSON syntax error: ${error.message}`);
    } else {
      errors.push(`JSON parsing failed: ${String(error)}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates JavaScript/TypeScript syntax (basic checks)
 */
export function validateJavaScript(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check balanced delimiters
  const delimiterResult = checkBalancedDelimiters(content);
  errors.push(...delimiterResult.errors);

  // Check unclosed strings
  const stringResult = checkStrings(content);
  errors.push(...stringResult.errors);
  warnings.push(...stringResult.warnings);

  // Check template literals
  const templateResult = checkTemplateLiterals(content);
  errors.push(...templateResult.errors);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Checks for balanced delimiters: {}, [], ()
 */
export function checkBalancedDelimiters(content: string): { errors: string[] } {
  const errors: string[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const closers: Record<string, string> = { '}': '{', ']': '[', ')': '(' };

  let inString: string | null = null;
  let inTemplateString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let lineNumber = 1;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Track line numbers
    if (char === '\n') {
      lineNumber++;
      inLineComment = false;
      i++;
      continue;
    }

    // Handle comments
    if (!inString && !inTemplateString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (!inString && !inTemplateString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i += 2;
      continue;
    }

    // Skip if in comment
    if (inLineComment || inBlockComment) {
      i++;
      continue;
    }

    // Handle escape sequences
    if ((inString || inTemplateString) && char === '\\') {
      i += 2;
      continue;
    }

    // Handle string delimiters
    if (char === '`') {
      inTemplateString = !inTemplateString;
      i++;
      continue;
    }
    if ((char === '"' || char === "'") && !inTemplateString) {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
      i++;
      continue;
    }

    // Skip if inside string
    if (inString || inTemplateString) {
      i++;
      continue;
    }

    // Track delimiters
    if (pairs[char]) {
      stack.push({ char, line: lineNumber });
    } else if (closers[char]) {
      const expected = closers[char];
      if (stack.length === 0) {
        errors.push(`Unexpected '${char}' at line ${lineNumber} - no matching '${expected}'`);
      } else {
        const top = stack.pop()!;
        if (top.char !== expected) {
          errors.push(`Mismatched delimiter: expected '${pairs[top.char]}' to close '${top.char}' from line ${top.line}, but found '${char}' at line ${lineNumber}`);
        }
      }
    }

    i++;
  }

  // Report unclosed delimiters
  for (const unclosed of stack) {
    errors.push(`Unclosed '${unclosed.char}' from line ${unclosed.line} - missing '${pairs[unclosed.char]}'`);
  }

  return { errors };
}

/**
 * Checks for unclosed string literals
 */
export function checkStrings(content: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // Skip lines that are likely comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    let inString: string | null = null;
    let stringStart = -1;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      // Handle escape sequences
      if (inString && char === '\\') {
        i += 2;
        continue;
      }

      // Check for template literals - they can span multiple lines
      if (char === '`') {
        // Template literals are handled separately
        i++;
        continue;
      }

      if ((char === '"' || char === "'")) {
        if (inString === char) {
          inString = null;
        } else if (!inString) {
          inString = char;
          stringStart = i;
        }
      }

      i++;
    }

    // Check for unclosed string on this line (not template literals)
    if (inString) {
      // Check if this might be intentional (like a long string literal)
      // or if it's clearly an error
      const remainingContent = line.slice(stringStart);
      if (remainingContent.length > 100) {
        warnings.push(`Possibly unclosed string starting at line ${lineNumber}, column ${stringStart + 1}`);
      } else {
        errors.push(`Unclosed string '${inString}' at line ${lineNumber}, column ${stringStart + 1}`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Checks for unclosed template literals
 */
export function checkTemplateLiterals(content: string): { errors: string[] } {
  const errors: string[] = [];

  let inTemplate = false;
  let templateStartLine = 0;
  let lineNumber = 1;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: string | null = null;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '\n') {
      lineNumber++;
      inLineComment = false;
      continue;
    }

    // Handle comments
    if (!inString && !inTemplate && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      continue;
    }
    if (!inString && !inTemplate && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++;
      continue;
    }

    if (inLineComment || inBlockComment) {
      continue;
    }

    // Handle escape sequences
    if ((inString || inTemplate) && char === '\\') {
      i++;
      continue;
    }

    // Handle regular strings
    if ((char === '"' || char === "'") && !inTemplate) {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
      continue;
    }

    if (inString) {
      continue;
    }

    // Handle template literals
    if (char === '`') {
      if (inTemplate) {
        inTemplate = false;
      } else {
        inTemplate = true;
        templateStartLine = lineNumber;
      }
    }
  }

  if (inTemplate) {
    errors.push(`Unclosed template literal starting at line ${templateStartLine}`);
  }

  return { errors };
}
