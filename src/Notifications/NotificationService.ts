import { getSettings } from '../Config/Settings';
import { logging } from '../lib/logging';
import type { Task } from '../Task/Task';

export class NotificationService {
    private static instance: NotificationService;
    private logger = logging.getLogger('tasks.NotificationService');

    private constructor() {}

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Schedule a notification for a task if it has a notification date
     * Uses ntfy's native scheduling with X-At header
     */
    public scheduleNotification(task: Task): void {
        const settings = getSettings();

        if (!settings.enableNotifications || !settings.ntfyServerUrl) {
            return;
        }

        if (!task.notifyDate || !task.notifyDate.isValid()) {
            return;
        }

        // Only send notifications for tasks with bell emoji or notify:: syntax
        if (!this.shouldNotifyForTask(task)) {
            return;
        }

        this.logger.debug(`Scheduling notification for task ${task.id} at ${task.notifyDate.format()}`);

        // Send notification immediately to ntfy with X-At header for scheduling
        this.sendScheduledNotification(task);
    }

    /**
     * Cancel a scheduled notification by sending a cancellation request to ntfy
     */
    public cancelNotification(notificationId: string): void {
        // With ntfy's native scheduling, we need to track which notifications
        // we've sent and potentially send a cancel request if supported
        this.logger.debug(`Cancelling notification ${notificationId}`);
        // Note: ntfy doesn't have a standard cancel API, so we rely on task completion
        // to naturally prevent notifications from being relevant
    }

    /**
     * Cancel all scheduled notifications
     */
    public cancelAllNotifications(): void {
        this.logger.debug('Clearing notification tracking');
        // With ntfy native scheduling, we don't need to cancel locally
        // The notifications will be delivered as scheduled by ntfy server
    }

    /**
     * Reschedule all notifications for updated tasks
     */
    public rescheduleNotifications(tasks: Task[]): void {
        for (const task of tasks) {
            if (!task.isDone) {
                this.scheduleNotification(task);
            }
        }
    }

    /**
     * Send scheduled notification to ntfy server using X-At header
     */
    private async sendScheduledNotification(task: Task): Promise<void> {
        const settings = getSettings();

        if (!settings.ntfyServerUrl) {
            this.logger.error('Cannot send notification: ntfy server URL not configured');
            return;
        }

        try {
            const headers = this.createNotificationHeaders(task);
            const message = this.createNotificationMessage(task);

            // Debug logging for notification details
            const settings = getSettings();
            console.log(`[DEBUG] Notification for task ${task.id}:`);
            console.log(`  Description: "${task.description}"`);
            console.log(`  File path: ${task.path}`);
            console.log(`  useFilenameAsScheduledDate setting: ${settings.useFilenameAsScheduledDate}`);
            console.log(`  Scheduled date: ${task.scheduledDate?.format() || 'null'}`);
            console.log(`  Due date: ${task.dueDate?.format() || 'null'}`);
            console.log(`  Notify date: ${task.notifyDate?.format() || 'null'}`);
            console.log(`  Unix timestamp: ${task.notifyDate?.unix() || 'null'}`);
            console.log(`  X-At header: ${headers['X-At']}`);
            console.log(`  Full headers:`, headers);

            const response = await fetch(settings.ntfyServerUrl, {
                method: 'POST',
                headers,
                body: message,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log(`Scheduled notification sent successfully for task ${task.id}: `, task, headers);
            this.logger.debug(`Scheduled notification sent successfully for task ${task.id}`);
        } catch (error) {
            this.logger.error(`Failed to send scheduled notification for task ${task.id}:`, error);
        }
    }

    /**
     * Create notification headers with all task data
     */
    private createNotificationHeaders(task: Task): HeadersInit {
        const headers: HeadersInit = {
            'X-Title': 'Task Reminder',
            'X-Priority': this.mapPriorityToNtfy(task.priorityNumber).toString(),
            'X-Tags': this.createNotificationTags(task),
            'X-At': task.notifyDate!.unix().toString(), // Unix timestamp for scheduling
            'X-ID': task.id, // For deduplication
            'Content-Type': 'text/markdown',
            'X-Markdown': '1',
        };

        // Add action to open task in Obsidian if we have file info
        if (task.path) {
            const actions = [
                {
                    action: 'view',
                    label: 'Open in Obsidian',
                    url: `obsidian://open?vault=${encodeURIComponent('current')}&file=${encodeURIComponent(task.path)}`,
                },
            ];
            headers['X-Actions'] = JSON.stringify(actions);
            headers['X-Click'] = `obsidian://open?vault=${encodeURIComponent('current')}&file=${encodeURIComponent(
                task.path,
            )}`;
        }

        // Add task icon based on priority
        if (task.priorityNumber <= 1) {
            headers['X-Icon'] =
                'https://raw.githubusercontent.com/obsidian-tasks-group/obsidian-tasks/main/resources/icons/tasks-high-priority.png';
        } else {
            headers['X-Icon'] =
                'https://raw.githubusercontent.com/obsidian-tasks-group/obsidian-tasks/main/resources/icons/tasks.png';
        }

        return headers;
    }

    /**
     * Create rich notification message with task details
     */
    private createNotificationMessage(task: Task): string {
        let message = `**${task.description || 'Unnamed task'}**\n\n`;

        // Add task details
        const details: string[] = [];

        if (task.dueDate && task.dueDate.isValid()) {
            const dueDateStr = task.dueDate.format('YYYY-MM-DD');
            const isOverdue = task.dueDate.isBefore(window.moment(), 'day');
            details.push(`📅 **Due:** ${dueDateStr}${isOverdue ? ' ⚠️ *Overdue*' : ''}`);
        }

        if (task.scheduledDate && task.scheduledDate.isValid()) {
            details.push(`⏳ **Scheduled:** ${task.scheduledDate.format('YYYY-MM-DD')}`);
        }

        if (task.startDate && task.startDate.isValid()) {
            details.push(`🛫 **Start:** ${task.startDate.format('YYYY-MM-DD')}`);
        }

        if (task.priorityNumber < 3) {
            details.push(`🔥 **Priority:** ${task.priorityName}`);
        }

        if (task.recurrenceRule) {
            details.push(`🔁 **Recurring:** ${task.recurrenceRule}`);
        }

        // Add file location
        if (task.path) {
            const fileName = task.filename || task.path.split('/').pop();
            details.push(`📁 **File:** ${fileName}`);
        }

        if (task.precedingHeader) {
            details.push(`📝 **Section:** ${task.precedingHeader}`);
        }

        if (details.length > 0) {
            message += details.join('\n');
        }

        return message;
    }

    /**
     * Create notification tags from task data
     */
    private createNotificationTags(task: Task): string {
        const tags = ['task', 'reminder'];

        // Add priority-based tags
        if (task.priorityNumber <= 1) {
            tags.push('high-priority', 'urgent');
        }

        // Add status-based tags
        if (task.dueDate && task.dueDate.isBefore(window.moment(), 'day')) {
            tags.push('overdue', 'warning');
        }

        // Add task tags (remove # prefix and any emojis)
        if (task.tags.length > 0) {
            tags.push(...task.tags.map((tag) => tag.replace('#', '').replace(/[^\w-]/g, '')));
        }

        // Add relevant ASCII tags
        tags.push('clipboard', 'time');

        return tags.join(',');
    }

    /**
     * Map Tasks priority to ntfy priority (1-5 scale)
     */
    private mapPriorityToNtfy(taskPriority: number): number {
        // Tasks priority: 0=Highest, 1=High, 2=Medium, 3=None, 4=Low, 5=Lowest
        // ntfy priority: 5=max, 4=high, 3=default, 2=low, 1=min
        switch (taskPriority) {
            case 0:
                return 5; // Highest -> max
            case 1:
                return 4; // High -> high
            case 2:
                return 3; // Medium -> default
            case 3:
                return 3; // None -> default
            case 4:
                return 2; // Low -> low
            case 5:
                return 1; // Lowest -> min
            default:
                return 3; // default
        }
    }

    /**
     * Check if task should trigger notifications
     */
    private shouldNotifyForTask(task: Task): boolean {
        // Check for bell emoji in description
        if (task.description.includes('🔔')) {
            return true;
        }

        // Check for notify:: syntax in dataview format
        if (task.description.includes('notify::')) {
            return true;
        }

        // Check if task has notifyDate set (bell emoji format)
        return task.notifyDate !== null && task.notifyDate.isValid();
    }
}
