/**
 * @jest-environment jsdom
 */
import moment from 'moment';
import { Task } from '../../src/Task/Task';
import { fromLine } from '../TestingTools/TestHelpers';
import { resetSettings, updateSettings } from '../../src/Config/Settings';

window.moment = moment;

describe('Task Auto-Notification', () => {
    afterEach(() => {
        resetSettings();
    });
    describe('parseTaskSignifiers with bell emoji auto-notification', () => {
        it('should auto-generate notification time with Day Planner format and scheduled date', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Team meeting 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
        });

        it('should auto-generate notification time with Day Planner format and due date', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Team meeting 🔔 📅 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
        });

        it('should auto-generate notification time with simple time format', () => {
            const taskLine = '- [ ] 09:30 Daily standup 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 09:20');
        });

        it('should default to start of day when no time format is present', () => {
            const taskLine = '- [ ] Regular task 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should prefer scheduled date over due date for auto-notification', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔 ⏳ 2023-07-03 📅 2023-07-05';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-03 14:50');
        });

        it('should prefer explicit dates over filename date', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔 ⏳ 2023-07-03';
            const task = fromLine({ line: taskLine, path: '2023-07-04.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            // Should use scheduled date, not filename date
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-03 14:50');
        });

        it('should use due date if scheduled date is not present', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔 📅 2023-07-05';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-05 14:50');
        });

        it('should not auto-generate notification if bell emoji is not present', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).toBeNull();
        });

        it('should not auto-generate notification if no scheduled or due date and no filename date', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔';
            const task = fromLine({ line: taskLine, path: 'regular-filename.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).toBeNull();
        });

        it('should auto-generate notification using filename date when no scheduled/due date', () => {
            updateSettings({ useFilenameAsScheduledDate: true });

            const taskLine = '- [ ] 21:00 - 22:00 Dinner #health 🔔';
            const task = fromLine({ line: taskLine, path: '2023-07-04.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 20:50');
        });

        it('should use filename date for notification when no time format present', () => {
            updateSettings({ useFilenameAsScheduledDate: true });

            const taskLine = '- [ ] Regular task 🔔';
            const task = fromLine({ line: taskLine, path: '2023-07-04.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should work with daily note path structure', () => {
            updateSettings({ useFilenameAsScheduledDate: true });

            const taskLine = '- [ ] 09:30 Morning standup 🔔';
            const task = fromLine({ line: taskLine, path: 'Daily Notes/2023-07-04.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 09:20');
        });

        it('should work with YYYYMMDD filename format', () => {
            updateSettings({ useFilenameAsScheduledDate: true });

            const taskLine = '- [ ] 15:30 Afternoon meeting 🔔';
            const task = fromLine({ line: taskLine, path: '20230704.md' });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 15:20');
        });

        it('should not override explicit notification date', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting ⏳ 2023-07-04 🔔 2023-07-04T13:00';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            // Should use explicit notify date, not auto-generated
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 13:00');
        });

        it('should handle time format with single digit hours', () => {
            const taskLine = '- [ ] 9:30 - 10:15 Morning workout 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 09:20');
        });

        it('should handle early morning times with notification crossing midnight', () => {
            const taskLine = '- [ ] 00:05 Early task 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-03 23:55');
        });

        it('should handle bell emoji in different positions', () => {
            const taskLine = '- [ ] 🔔 15:00 - 16:00 Meeting ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            // Since the bell emoji is at the start, time parsing should still work
            // The description will be "🔔 15:00 - 16:00 Meeting" which doesn't start with time format
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should work with complex task lines', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Team meeting 🔔 ⏳ 2023-07-04 📅 2023-07-05 #work #meeting ⏫';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
            expect(task!.tags).toContain('#work');
            expect(task!.tags).toContain('#meeting');
        });
    });

    describe('Task construction with auto-notification', () => {
        it('should preserve auto-generated notification through Task constructor', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔 ⏳ 2023-07-04';
            const originalTask = fromLine({ line: taskLine });

            expect(originalTask).not.toBeNull();
            expect(originalTask!.notifyDate).not.toBeNull();

            // Create a new task with the same data
            const newTask = new Task({
                ...originalTask!,
                description: originalTask!.description,
            });

            expect(newTask.notifyDate).not.toBeNull();
            expect(newTask.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
        });
    });

    describe('Edge cases', () => {
        it('should handle invalid date formats gracefully', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔 ⏳ invalid-date';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).toBeNull();
        });

        it('should handle malformed time formats', () => {
            const taskLine = '- [ ] Invalid time format text 🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            // Should default to start of day since no valid time format is present
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should handle multiple bell emojis', () => {
            const taskLine = '- [ ] 15:00 - 16:00 Meeting 🔔🔔🔔 ⏳ 2023-07-04';
            const task = fromLine({ line: taskLine });

            expect(task).not.toBeNull();
            expect(task!.notifyDate).not.toBeNull();
            expect(task!.notifyDate!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
        });
    });
});
