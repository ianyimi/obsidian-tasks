/**
 * @jest-environment jsdom
 */
import moment from 'moment';
import { fromLine } from '../TestingTools/TestHelpers';

window.moment = moment;

describe('Task Auto-ID Generation', () => {
    describe('should generate IDs for all tasks', () => {
        it('should generate ID for simple task without any fields', () => {
            const taskLine = '- [ ] Simple task';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe('');
            expect(task!.id).toHaveLength(6);
            expect(task!.id).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate ID for task with dates', () => {
            const taskLine = '- [ ] Task with dates ⏳ 2023-07-04 📅 2023-07-05';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe('');
            expect(task!.id).toHaveLength(6);
            expect(task!.id).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate ID for task with notification', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe('');
            expect(task!.id).toHaveLength(6);
            expect(task!.id).toMatch(/^[a-z0-9]+$/);
        });

        it('should preserve explicit ID if provided', () => {
            const taskLine = '- [ ] Task with explicit ID 🆔 custom1';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).toBe('custom1');
            expect(task!.idIsExplicit).toBe(true);
        });

        it('should generate different IDs for different tasks', () => {
            const task1 = fromLine({ line: '- [ ] First task' });
            const task2 = fromLine({ line: '- [ ] Second task' });
            
            expect(task1).not.toBeNull();
            expect(task2).not.toBeNull();
            expect(task1!.id).not.toBe('');
            expect(task2!.id).not.toBe('');
            expect(task1!.id).not.toBe(task2!.id);
        });

        it('should generate ID for complex task with all fields', () => {
            const taskLine = '- [ ] Complex task ⏳ 2023-07-04 📅 2023-07-05 #tag1 #tag2 ⏫';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe('');
            expect(task!.id).toHaveLength(6);
            expect(task!.id).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate ID for task with depends on field', () => {
            const taskLine = '- [ ] Task with dependency ⛔ abc123';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe('');
            expect(task!.id).toHaveLength(6);
            expect(task!.id).toMatch(/^[a-z0-9]+$/);
            expect(task!.dependsOn).toEqual(['abc123']);
        });
    });

    describe('ID consistency', () => {
        it('should generate valid ID format consistently', () => {
            const tasks = [
                '- [ ] Task 1',
                '- [ ] Task 2 with more text',
                '- [ ] Task 3 📅 2023-01-01',
                '- [ ] Task 4 🔔',
                '- [x] Completed task',
                '- [/] In progress task',
            ];

            for (const taskLine of tasks) {
                const task = fromLine({ line: taskLine });
                expect(task).not.toBeNull();
                expect(task!.id).not.toBe('');
                expect(task!.id).toHaveLength(6);
                expect(task!.id).toMatch(/^[a-z0-9]+$/);
                expect(task!.idIsExplicit).toBe(false); // Auto-generated IDs are not explicit
            }
        });
    });

    describe('Serialization behavior', () => {
        it('should not serialize auto-generated IDs', () => {
            const taskLine = '- [ ] Simple task';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).not.toBe(''); // Has auto-generated ID
            expect(task!.idIsExplicit).toBe(false); // But it's not explicit
            
            const serialized = task!.toFileLineString();
            expect(serialized).toBe('- [ ] Simple task'); // No ID in output
            expect(serialized).not.toContain('🆔'); // No ID symbol
        });

        it('should serialize explicit IDs', () => {
            const taskLine = '- [ ] Task with explicit ID 🆔 custom1';
            const task = fromLine({ line: taskLine });
            
            expect(task).not.toBeNull();
            expect(task!.id).toBe('custom1');
            expect(task!.idIsExplicit).toBe(true);
            
            const serialized = task!.toFileLineString();
            expect(serialized).toContain('🆔 custom1'); // ID included in output
        });

        it('should maintain auto-generated IDs for internal processing', () => {
            const task1 = fromLine({ line: '- [ ] Task 1' });
            const task2 = fromLine({ line: '- [ ] Task 2' });
            
            expect(task1).not.toBeNull();
            expect(task2).not.toBeNull();
            
            // Both tasks have IDs for internal use
            expect(task1!.id).not.toBe('');
            expect(task2!.id).not.toBe('');
            expect(task1!.id).not.toBe(task2!.id);
            
            // But neither shows ID in serialization
            expect(task1!.toFileLineString()).toBe('- [ ] Task 1');
            expect(task2!.toFileLineString()).toBe('- [ ] Task 2');
        });
    });
});