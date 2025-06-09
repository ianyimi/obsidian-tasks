import { getSettings, updateSettings } from '../Config/Settings';
import { logging } from '../lib/logging';
import type { Task } from '../Task/Task';

interface QueuedNotification {
    task: Task;
    unixTimestamp: number;
    priority: number; // For sorting
}

interface NotificationTracker {
    unixTimestamp: number;
    lastSent: number; // When we last sent this notification
}

export class NotificationService {
    private static instance: NotificationService;
    private logger = logging.getLogger('tasks.NotificationService');

    // Queue management
    private notificationQueue: QueuedNotification[] = [];
    private isProcessingQueue = false;
    private readonly RATE_LIMIT_DELAY = 2000; // 2 seconds between requests to avoid 429

    // Tracking sent notifications to avoid duplicates
    private sentNotifications = new Map<string, NotificationTracker>();

    // Callback to save settings to disk
    private saveSettingsCallback?: () => Promise<void>;

    private constructor() {
        this.loadTrackingData();
        this.startQueueProcessor();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Set the callback to save settings to disk
     * Should be called once during plugin initialization
     */
    public setSaveCallback(callback: () => Promise<void>): void {
        this.saveSettingsCallback = callback;
    }

    /**
     * Schedule a notification for a task if it has a notification date
     * Uses intelligent queuing to avoid rate limits and duplicate notifications
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

        const unixTimestamp = task.notifyDate.unix();
        const existingTracker = this.sentNotifications.get(task.id);

        // Check if we need to send/update this notification
        if (existingTracker && existingTracker.unixTimestamp === unixTimestamp) {
            // Notification already sent for this exact timestamp, skip
            this.logger.debug(`Skipping duplicate notification for task ${task.id} - already sent`);
            return;
        }

        // Skip notifications for past times (they won't be useful)
        const now = window.moment().unix();
        if (unixTimestamp <= now) {
            this.logger.debug(`Skipping notification for task ${task.id} - time is in the past`);
            return;
        }

        this.logger.debug(`Queueing notification for task ${task.id} at ${task.notifyDate.format()}`);

        // Add to queue with priority (earlier notifications first)
        const queuedNotification: QueuedNotification = {
            task,
            unixTimestamp,
            priority: unixTimestamp, // Earlier timestamps = higher priority (lower number)
        };

        this.addToQueue(queuedNotification);
    }

    /**
     * Add notification to queue, avoiding duplicates and maintaining sort order
     */
    private addToQueue(notification: QueuedNotification): void {
        // Remove any existing notification for this task from queue
        this.notificationQueue = this.notificationQueue.filter((q) => q.task.id !== notification.task.id);

        // Add new notification
        this.notificationQueue.push(notification);

        // Keep queue sorted by priority (earliest notifications first)
        this.notificationQueue.sort((a, b) => a.priority - b.priority);

        this.logger.debug(`Queue now has ${this.notificationQueue.length} notifications`);
    }

    /**
     * Start the background queue processor
     */
    private startQueueProcessor(): void {
        this.processQueue();
    }

    /**
     * Process the notification queue with rate limiting
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.notificationQueue.length > 0) {
                const notification = this.notificationQueue.shift()!;

                // Double-check that we still need to send this notification
                const existingTracker = this.sentNotifications.get(notification.task.id);
                if (existingTracker && existingTracker.unixTimestamp === notification.unixTimestamp) {
                    continue;
                }

                // Send the notification
                await this.sendScheduledNotification(notification.task);

                // Track that we sent it
                this.sentNotifications.set(notification.task.id, {
                    unixTimestamp: notification.unixTimestamp,
                    lastSent: Date.now(),
                });

                // Save tracking data after each notification
                await this.saveTrackingData();

                // Rate limiting delay
                if (this.notificationQueue.length > 0) {
                    await this.sleep(this.RATE_LIMIT_DELAY);
                }
            }
        } catch (error) {
            this.logger.error('Error processing notification queue:', error);
        } finally {
            this.isProcessingQueue = false;

            // Schedule next queue check
            setTimeout(() => this.processQueue(), this.RATE_LIMIT_DELAY);
        }
    }

    /**
     * Utility function to sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Cancel a scheduled notification
     */
    public cancelNotification(taskId: string): void {
        // Remove from queue
        this.notificationQueue = this.notificationQueue.filter((q) => q.task.id !== taskId);

        // Remove from tracking
        this.sentNotifications.delete(taskId);

        this.logger.debug(`Cancelled notification for task ${taskId}`);
    }

    /**
     * Cancel all scheduled notifications
     */
    public cancelAllNotifications(): void {
        this.notificationQueue = [];
        this.sentNotifications.clear();
        this.logger.debug('Cleared all notification tracking');
    }

    /**
     * Reschedule all notifications for updated tasks
     */
    public async rescheduleNotifications(tasks: Task[]): Promise<void> {
        this.logger.debug(`Rescheduling notifications for ${tasks.length} tasks`);

        // Clean up tracking for completed tasks
        await this.cleanupCompletedTasks(tasks);

        for (const task of tasks) {
            if (!task.isDone) {
                this.scheduleNotification(task);
            }
        }
    }

    /**
     * Clean up tracking for completed or deleted tasks
     */
    private async cleanupCompletedTasks(currentTasks: Task[]): Promise<void> {
        const trackedIds = Array.from(this.sentNotifications.keys());
        let cleaned = false;

        for (const trackedId of trackedIds) {
            const task = currentTasks.find((t) => t.id === trackedId);
            if (!task || task.isDone) {
                // Task is completed or no longer exists, remove from tracking
                this.sentNotifications.delete(trackedId);
                this.notificationQueue = this.notificationQueue.filter((q) => q.task.id !== trackedId);
                this.logger.debug(`Cleaned up notification tracking for completed/deleted task ${trackedId}`);
                cleaned = true;
            }
        }

        // Clean up old notifications that have already been sent (older than 24 hours)
        const oneDayAgo = window.moment().unix() - 24 * 60 * 60;
        for (const [taskId, tracker] of this.sentNotifications.entries()) {
            if (tracker.unixTimestamp < oneDayAgo) {
                this.sentNotifications.delete(taskId);
                this.logger.debug(
                    `Cleaned up old notification tracking for task ${taskId} (notification was ${window.moment
                        .unix(tracker.unixTimestamp)
                        .format()})`,
                );
                cleaned = true;
            }
        }

        // Save if we cleaned up any entries
        if (cleaned) {
            await this.saveTrackingData();
        }
    }

    /**
     * Get queue status for debugging
     */
    public getQueueStatus(): { queueLength: number; trackedNotifications: number } {
        return {
            queueLength: this.notificationQueue.length,
            trackedNotifications: this.sentNotifications.size,
        };
    }

    /**
     * Load tracking data from settings
     */
    private loadTrackingData(): void {
        const settings = getSettings();
        const trackingData = settings.notificationTracking || {};

        this.sentNotifications.clear();
        for (const [taskId, tracker] of Object.entries(trackingData)) {
            this.sentNotifications.set(taskId, tracker);
        }

        this.logger.debug(`Loaded ${this.sentNotifications.size} notification tracking entries from settings`);
    }

    /**
     * Save tracking data to settings
     */
    private async saveTrackingData(): Promise<void> {
        const trackingData: Record<string, NotificationTracker> = {};

        for (const [taskId, tracker] of this.sentNotifications.entries()) {
            trackingData[taskId] = tracker;
        }

        updateSettings({ notificationTracking: trackingData });

        // Save to disk if callback is available
        if (this.saveSettingsCallback) {
            try {
                await this.saveSettingsCallback();
                this.logger.debug(`Saved ${this.sentNotifications.size} notification tracking entries to disk`);
            } catch (error) {
                this.logger.error('Failed to save notification tracking data to disk:', error);
            }
        } else {
            this.logger.debug(
                `Updated ${this.sentNotifications.size} notification tracking entries in memory (no save callback)`,
            );
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
