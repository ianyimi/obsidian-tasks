/**
 * Simple hash function that creates a consistent hash from a string.
 * Uses the djb2 algorithm which is fast and has good distribution.
 * 
 * @param str - The string to hash
 * @returns A positive integer hash
 */
function simpleHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
}

/**
 * Generates a consistent, deterministic ID for a task based on its content and location.
 * The ID will be the same for identical task content in the same location.
 * 
 * @param taskContent - The task content (description + other parseable parts, without emojis/dates that might change)
 * @param filePath - The path to the file containing the task
 * @param lineNumber - The line number of the task in the file
 * @returns A consistent 6-character alphanumeric ID
 */
export function generateHashId(taskContent: string, filePath: string, lineNumber: number): string {
    // Normalize the input to ensure consistent hashing
    const normalizedContent = taskContent.trim();
    const normalizedPath = filePath.replace(/\\/g, '/'); // Normalize path separators
    
    // Create a composite string that uniquely identifies this task
    // Use line number for uniqueness in the same file
    const composite = `${normalizedPath}:${lineNumber}:${normalizedContent}`;
    
    // Generate hash and convert to base36 (a-z, 0-9)
    const hash = simpleHash(composite);
    
    // Convert to base36 and pad to ensure we get at least 6 characters
    let hashString = hash.toString(36);
    
    // If shorter than 6 characters, pad with leading zeros
    // If longer than 6 characters, take the first 6
    if (hashString.length < 6) {
        hashString = hashString.padStart(6, '0');
    } else if (hashString.length > 6) {
        hashString = hashString.substring(0, 6);
    }
    
    return hashString;
}

/**
 * Extracts the core content of a task for hashing purposes.
 * This should include the description and stable elements, but exclude
 * things that might change frequently (like dates) to maintain consistency.
 * 
 * @param line - The complete task line
 * @returns The core content for hashing
 */
export function extractTaskCoreContent(line: string): string {
    // Remove the task prefix (indentation, list marker, status)
    const match = line.match(/^(\s*)([-*+]|\d+\.)\s*\[.\]\s*(.*)$/);
    if (!match) {
        return line; // Fallback to full line if no match
    }
    
    let content = match[3]; // Everything after the task status
    
    // Remove dates (they might change and shouldn't affect the core identity)
    // Remove common date patterns: 📅 2023-01-01, ⏳ 2023-01-01, etc.
    content = content.replace(/[📅⏳🛫✅❌➕🔔]\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/gu, '');
    
    // Remove block links (they might change)
    content = content.replace(/\s*\^[a-zA-Z0-9]+\s*$/, '');
    
    // Clean up multiple spaces left by removals
    content = content.replace(/\s+/g, ' ');
    
    // Keep the core description, tags, priority, recurrence, dependencies
    // These are stable identifiers of the task
    return content.trim();
}