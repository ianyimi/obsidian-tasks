/**
 * @jest-environment jsdom
 */
import moment from 'moment';
import { TimeParser } from '../../src/DateTime/TimeParser';
import { resetSettings, updateSettings } from '../../src/Config/Settings';

window.moment = moment;

describe('TimeParser', () => {
    afterEach(() => {
        resetSettings();
    });
    describe('parseTimeFromDescription', () => {
        it('should parse Day Planner format with start and end time', () => {
            const result = TimeParser.parseTimeFromDescription('15:00 - 16:30 Meeting with team');
            
            expect(result.startTime).toEqual('15:00');
            expect(result.endTime).toEqual('16:30');
            expect(result.cleanedDescription).toEqual('Meeting with team');
        });

        it('should parse simple time format with only start time', () => {
            const result = TimeParser.parseTimeFromDescription('09:15 Daily standup');
            
            expect(result.startTime).toEqual('09:15');
            expect(result.endTime).toBeNull();
            expect(result.cleanedDescription).toEqual('Daily standup');
        });

        it('should handle time format with extra spaces', () => {
            const result = TimeParser.parseTimeFromDescription('14:00  -  15:00   Project review');
            
            expect(result.startTime).toEqual('14:00');
            expect(result.endTime).toEqual('15:00');
            expect(result.cleanedDescription).toEqual('Project review');
        });

        it('should return null for no time format', () => {
            const result = TimeParser.parseTimeFromDescription('Regular task without time');
            
            expect(result.startTime).toBeNull();
            expect(result.endTime).toBeNull();
            expect(result.cleanedDescription).toEqual('Regular task without time');
        });

        it('should handle time in the middle of description (not at start)', () => {
            const result = TimeParser.parseTimeFromDescription('Call client about 15:00 - 16:00 meeting');
            
            expect(result.startTime).toBeNull();
            expect(result.endTime).toBeNull();
            expect(result.cleanedDescription).toEqual('Call client about 15:00 - 16:00 meeting');
        });

        it('should handle single digit hours', () => {
            const result = TimeParser.parseTimeFromDescription('9:30 - 10:15 Morning workout');
            
            expect(result.startTime).toEqual('9:30');
            expect(result.endTime).toEqual('10:15');
            expect(result.cleanedDescription).toEqual('Morning workout');
        });
    });

    describe('calculateNotificationTime', () => {
        it('should calculate notification time 10 minutes before start time', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, '15:30');
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 15:20');
        });

        it('should handle early morning times', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, '00:15');
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:05');
        });

        it('should handle notifications crossing midnight', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, '00:05');
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-03 23:55');
        });

        it('should return null for invalid time format', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, 'invalid');
            
            expect(result).toBeNull();
        });

        it('should return null for invalid base date', () => {
            const baseDate = moment(''); // Empty string creates invalid moment
            const result = TimeParser.calculateNotificationTime(baseDate, '15:30');
            
            expect(result).toBeNull();
        });

        it('should return null for out-of-range hours', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, '25:30');
            
            expect(result).toBeNull();
        });

        it('should return null for out-of-range minutes', () => {
            const baseDate = moment('2023-07-04');
            const result = TimeParser.calculateNotificationTime(baseDate, '15:75');
            
            expect(result).toBeNull();
        });
    });

    describe('getNotificationBaseDate', () => {
        it('should prefer scheduled date over due date', () => {
            const scheduledDate = moment('2023-07-03');
            const dueDate = moment('2023-07-05');
            
            const result = TimeParser.getNotificationBaseDate(scheduledDate, dueDate);
            
            expect(result).toBe(scheduledDate);
        });

        it('should use due date if scheduled date is null', () => {
            const dueDate = moment('2023-07-05');
            
            const result = TimeParser.getNotificationBaseDate(null, dueDate);
            
            expect(result).toBe(dueDate);
        });

        it('should return null if both dates are null and no file path', () => {
            const result = TimeParser.getNotificationBaseDate(null, null);
            
            expect(result).toBeNull();
        });

        it('should use due date if scheduled date is invalid', () => {
            const scheduledDate = moment(''); // Empty string creates invalid moment
            const dueDate = moment('2023-07-05');
            
            const result = TimeParser.getNotificationBaseDate(scheduledDate, dueDate);
            
            expect(result).toBe(dueDate);
        });

        it('should return null if both dates are invalid and no file path', () => {
            const scheduledDate = moment(''); // Empty string creates invalid moment
            const dueDate = moment(''); // Empty string creates invalid moment
            
            const result = TimeParser.getNotificationBaseDate(scheduledDate, dueDate);
            
            expect(result).toBeNull();
        });

        it('should use filename date if both scheduled and due dates are null', () => {
            updateSettings({ useFilenameAsScheduledDate: true });
            
            const result = TimeParser.getNotificationBaseDate(null, null, '2023-07-04.md');
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD')).toEqual('2023-07-04');
        });

        it('should use filename date if both scheduled and due dates are invalid', () => {
            updateSettings({ useFilenameAsScheduledDate: true });
            
            const scheduledDate = moment(''); // Invalid
            const dueDate = moment(''); // Invalid
            
            const result = TimeParser.getNotificationBaseDate(scheduledDate, dueDate, '2023-07-04.md');
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD')).toEqual('2023-07-04');
        });

        it('should prefer scheduled date over filename date', () => {
            const scheduledDate = moment('2023-07-03');
            
            const result = TimeParser.getNotificationBaseDate(scheduledDate, null, '2023-07-04.md');
            
            expect(result).toBe(scheduledDate);
        });

        it('should prefer due date over filename date', () => {
            const dueDate = moment('2023-07-05');
            
            const result = TimeParser.getNotificationBaseDate(null, dueDate, '2023-07-04.md');
            
            expect(result).toBe(dueDate);
        });

        it('should return null if filename cannot be parsed as date', () => {
            const result = TimeParser.getNotificationBaseDate(null, null, 'regular-filename.md');
            
            expect(result).toBeNull();
        });

        it('should handle different filename date formats', () => {
            updateSettings({ useFilenameAsScheduledDate: true });
            
            // Test YYYY-MM-DD format
            const result1 = TimeParser.getNotificationBaseDate(null, null, '2023-07-04.md');
            expect(result1).not.toBeNull();
            expect(result1!.format('YYYY-MM-DD')).toEqual('2023-07-04');

            // Test YYYYMMDD format
            const result2 = TimeParser.getNotificationBaseDate(null, null, '20230704.md');
            expect(result2).not.toBeNull();
            expect(result2!.format('YYYY-MM-DD')).toEqual('2023-07-04');

            // Test date with path
            const result3 = TimeParser.getNotificationBaseDate(null, null, 'Daily Notes/2023-07-04.md');
            expect(result3).not.toBeNull();
            expect(result3!.format('YYYY-MM-DD')).toEqual('2023-07-04');
        });
    });

    describe('generateAutoNotifyDate', () => {
        it('should return null if no notify emoji present', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '15:00 - 16:00 Meeting',
                moment('2023-07-04'),
                null,
                false
            );
            
            expect(result).toBeNull();
        });

        it('should generate notification time with Day Planner format', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '15:00 - 16:00 Team meeting',
                moment('2023-07-04'),
                null,
                true
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 14:50');
        });

        it('should generate notification time with simple time format', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '09:30 Daily standup',
                moment('2023-07-04'),
                null,
                true
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 09:20');
        });

        it('should default to start of day if no time format', () => {
            const result = TimeParser.generateAutoNotifyDate(
                'Regular task without time',
                moment('2023-07-04'),
                null,
                true
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should prefer scheduled date over due date', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '15:00 - 16:00 Meeting',
                moment('2023-07-03'), // scheduled
                moment('2023-07-05'), // due
                true
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-03 14:50');
        });

        it('should use due date if scheduled date is null', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '15:00 - 16:00 Meeting',
                null, // scheduled
                moment('2023-07-05'), // due
                true
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-05 14:50');
        });

        it('should use filename date if no scheduled or due date available', () => {
            updateSettings({ useFilenameAsScheduledDate: true });
            
            const result = TimeParser.generateAutoNotifyDate(
                '21:00 - 22:00 Dinner #health',
                null, // scheduled
                null, // due
                true,
                '2023-07-04.md' // filename
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 20:50');
        });

        it('should default to start of day with filename date if no time format', () => {
            updateSettings({ useFilenameAsScheduledDate: true });
            
            const result = TimeParser.generateAutoNotifyDate(
                'Regular task',
                null, // scheduled
                null, // due
                true,
                '2023-07-04.md' // filename
            );
            
            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD HH:mm')).toEqual('2023-07-04 00:00');
        });

        it('should return null if no base date available (no filename date)', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '15:00 - 16:00 Meeting',
                null,
                null,
                true
            );
            
            expect(result).toBeNull();
        });

        it('should return null if filename cannot be parsed as date', () => {
            const result = TimeParser.generateAutoNotifyDate(
                '21:00 - 22:00 Dinner',
                null,
                null,
                true,
                'regular-filename.md'
            );
            
            expect(result).toBeNull();
        });
    });

    describe('hasTimeFormat', () => {
        it('should return true for Day Planner format', () => {
            expect(TimeParser.hasTimeFormat('15:00 - 16:30 Meeting')).toBe(true);
        });

        it('should return true for simple time format', () => {
            expect(TimeParser.hasTimeFormat('09:15 Daily standup')).toBe(true);
        });

        it('should return false for no time format', () => {
            expect(TimeParser.hasTimeFormat('Regular task without time')).toBe(false);
        });

        it('should return false for time in middle of description', () => {
            expect(TimeParser.hasTimeFormat('Call about 15:00 - 16:00 meeting')).toBe(false);
        });
    });
});