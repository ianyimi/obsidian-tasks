/**
 * @jest-environment jsdom
 */
import { generateHashId, extractTaskCoreContent } from '../../src/lib/HashTools';

describe('HashTools', () => {
    describe('generateHashId', () => {
        it('should generate consistent IDs for same content', () => {
            const content = 'Buy groceries #shopping';
            const path = '/daily/2023-07-04.md';
            const lineNumber = 5;

            const id1 = generateHashId(content, path, lineNumber);
            const id2 = generateHashId(content, path, lineNumber);
            
            expect(id1).toBe(id2);
            expect(id1).toHaveLength(6);
            expect(id1).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate different IDs for different content', () => {
            const path = '/daily/2023-07-04.md';
            const lineNumber = 5;

            const id1 = generateHashId('Buy groceries #shopping', path, lineNumber);
            const id2 = generateHashId('Walk the dog #pets', path, lineNumber);
            
            expect(id1).not.toBe(id2);
        });

        it('should generate different IDs for different paths', () => {
            const content = 'Buy groceries #shopping';
            const lineNumber = 5;

            const id1 = generateHashId(content, '/daily/2023-07-04.md', lineNumber);
            const id2 = generateHashId(content, '/daily/2023-07-05.md', lineNumber);
            
            expect(id1).not.toBe(id2);
        });

        it('should generate different IDs for different line numbers', () => {
            const content = 'Buy groceries #shopping';
            const path = '/daily/2023-07-04.md';

            const id1 = generateHashId(content, path, 5);
            const id2 = generateHashId(content, path, 10);
            
            expect(id1).not.toBe(id2);
        });

        it('should normalize path separators', () => {
            const content = 'Buy groceries #shopping';
            const lineNumber = 5;

            const id1 = generateHashId(content, 'folder/file.md', lineNumber);
            const id2 = generateHashId(content, 'folder\\file.md', lineNumber);
            
            expect(id1).toBe(id2);
        });

        it('should always return 6-character IDs', () => {
            const testCases = [
                'a',
                'short task',
                'this is a much longer task description with many words and characters',
                '🔔 📅 ⏳ 🛫 ✅ ❌ emojis galore',
                'numbers 123 and symbols !@#$%^&*()',
            ];

            for (const content of testCases) {
                const id = generateHashId(content, '/test.md', 1);
                expect(id).toHaveLength(6);
                expect(id).toMatch(/^[a-z0-9]+$/);
            }
        });
    });

    describe('extractTaskCoreContent', () => {
        it('should extract basic task content', () => {
            const line = '- [ ] Buy groceries #shopping';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Buy groceries #shopping');
        });

        it('should handle different list markers', () => {
            expect(extractTaskCoreContent('* [ ] Task with asterisk')).toBe('Task with asterisk');
            expect(extractTaskCoreContent('+ [ ] Task with plus')).toBe('Task with plus');
            expect(extractTaskCoreContent('1. [ ] Numbered task')).toBe('Numbered task');
        });

        it('should handle indentation', () => {
            const line = '    - [ ] Indented task #tag';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Indented task #tag');
        });

        it('should preserve tags, priority, and recurrence', () => {
            const line = '- [ ] Important task #work #urgent ⏫ 🔁 every week';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Important task #work #urgent ⏫ 🔁 every week');
        });

        it('should remove dates to keep core content stable', () => {
            const line = '- [ ] Meeting ⏳ 2023-07-04 📅 2023-07-05 🛫 2023-07-03';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Meeting');
        });

        it('should remove block links', () => {
            const line = '- [ ] Task with block link ^abc123';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Task with block link');
        });

        it('should handle complex tasks with mixed content', () => {
            const line = '    - [ ] Complex task #work ⏫ 🔁 every day ⏳ 2023-07-04 📅 2023-07-05 ^block123';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Complex task #work ⏫ 🔁 every day');
        });

        it('should fallback to full line for non-task lines', () => {
            const line = 'Not a task line';
            const result = extractTaskCoreContent(line);
            expect(result).toBe('Not a task line');
        });
    });
});