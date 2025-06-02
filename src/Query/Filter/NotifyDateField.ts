import type { Moment } from 'moment';
import type { Task } from '../../Task/Task';
import { DateField } from './DateField';

/**
 * NotifyDateField supports filtering by notification/reminder date.
 */
export class NotifyDateField extends DateField {
    constructor() {
        super();
    }
    public fieldName(): string {
        return 'notify date';
    }
    public date(task: Task): Moment | null {
        return task.notifyDate;
    }
    protected filterResultIfFieldMissing() {
        return false;
    }
}
