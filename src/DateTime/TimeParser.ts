import type { Moment } from 'moment';
import { DateFallback } from './DateFallback';

/**
 * TimeParser handles parsing Day Planner time formats from task descriptions
 * and calculating notification times based on task schedules.
 */
export class TimeParser {
    // Regex to match Day Planner time format: "15:00 - 15:30" at start of text
    private static readonly DAY_PLANNER_TIME_REGEX = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.*)$/;
    
    // Regex to match just the start time if no end time
    private static readonly SIMPLE_TIME_REGEX = /^(\d{1,2}:\d{2})\s+(.*)$/;

    /**
     * Parse Day Planner time format from task description
     * @param description Task description that may start with time format
     * @returns Object with start time, end time (if present), and cleaned description
     */
    public static parseTimeFromDescription(description: string): {
        startTime: string | null;
        endTime: string | null;
        cleanedDescription: string;
    } {
        const dayPlannerMatch = description.match(this.DAY_PLANNER_TIME_REGEX);
        if (dayPlannerMatch) {
            return {
                startTime: dayPlannerMatch[1],
                endTime: dayPlannerMatch[2],
                cleanedDescription: dayPlannerMatch[3].trim(),
            };
        }

        const simpleTimeMatch = description.match(this.SIMPLE_TIME_REGEX);
        if (simpleTimeMatch) {
            return {
                startTime: simpleTimeMatch[1],
                endTime: null,
                cleanedDescription: simpleTimeMatch[2].trim(),
            };
        }

        return {
            startTime: null,
            endTime: null,
            cleanedDescription: description,
        };
    }

    /**
     * Calculate notification time (10 minutes before start time) on a given date
     * @param baseDate The date to use (scheduled or due date)
     * @param startTime Time in HH:MM format
     * @returns Moment object for notification time, or null if invalid
     */
    public static calculateNotificationTime(baseDate: Moment, startTime: string): Moment | null {
        if (!baseDate || !baseDate.isValid()) {
            return null;
        }

        const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
        if (!timeMatch) {
            return null;
        }

        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }

        // Create a new moment with the base date and specified time
        const scheduledTime = baseDate.clone()
            .hour(hours)
            .minute(minutes)
            .second(0)
            .millisecond(0);

        // Subtract 10 minutes for notification
        return scheduledTime.subtract(10, 'minutes');
    }

    /**
     * Determine the appropriate base date for notification calculation
     * Priority: scheduled date -> due date -> filename date -> null
     * @param scheduledDate Task's scheduled date
     * @param dueDate Task's due date
     * @param filePath Task file path for filename date fallback
     * @returns The date to use for notification calculation
     */
    public static getNotificationBaseDate(scheduledDate: Moment | null, dueDate: Moment | null, filePath?: string): Moment | null {
        if (scheduledDate && scheduledDate.isValid()) {
            return scheduledDate;
        }
        if (dueDate && dueDate.isValid()) {
            return dueDate;
        }
        
        // Try to get date from filename if available
        if (filePath) {
            const filenameDate = DateFallback.fromPath(filePath);
            if (filenameDate && filenameDate.isValid()) {
                return filenameDate;
            }
        }
        
        return null;
    }

    /**
     * Generate automatic notification date for a task with bell emoji but no explicit notify date
     * @param description Task description (may contain time format)
     * @param scheduledDate Task's scheduled date
     * @param dueDate Task's due date
     * @param hasNotifyEmoji Whether task has bell emoji
     * @param filePath Task file path for filename date fallback
     * @returns Calculated notification date or null
     */
    public static generateAutoNotifyDate(
        description: string,
        scheduledDate: Moment | null,
        dueDate: Moment | null,
        hasNotifyEmoji: boolean,
        filePath?: string,
    ): Moment | null {
        if (!hasNotifyEmoji) {
            return null;
        }

        const baseDate = this.getNotificationBaseDate(scheduledDate, dueDate, filePath);
        if (!baseDate) {
            return null;
        }

        const { startTime } = this.parseTimeFromDescription(description);
        
        if (startTime) {
            // Task has time format, calculate 10 minutes before start time
            return this.calculateNotificationTime(baseDate, startTime);
        } else {
            // No time format, default to base date at start of day (00:00)
            return baseDate.clone().startOf('day');
        }
    }

    /**
     * Check if a task description starts with a time format
     * @param description Task description
     * @returns true if description starts with time format
     */
    public static hasTimeFormat(description: string): boolean {
        return this.DAY_PLANNER_TIME_REGEX.test(description) || this.SIMPLE_TIME_REGEX.test(description);
    }
}