/**
 * Code Validator - Syntax validation for JavaScript, TypeScript, and JSON files
 * Provides basic syntax checks before writing code files
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Checks if a file should be validated based on its extension
 */
export declare function shouldValidate(filePath: string): boolean;
/**
 * Validates file content based on file type
 */
export declare function validate(filePath: string, content: string): ValidationResult;
/**
 * Validates JSON syntax
 */
export declare function validateJSON(content: string): ValidationResult;
/**
 * Validates JavaScript/TypeScript syntax (basic checks)
 */
export declare function validateJavaScript(content: string): ValidationResult;
/**
 * Checks for balanced delimiters: {}, [], ()
 */
export declare function checkBalancedDelimiters(content: string): {
    errors: string[];
};
/**
 * Checks for unclosed string literals
 */
export declare function checkStrings(content: string): {
    errors: string[];
    warnings: string[];
};
/**
 * Checks for unclosed template literals
 */
export declare function checkTemplateLiterals(content: string): {
    errors: string[];
};
