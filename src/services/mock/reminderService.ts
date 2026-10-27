/** Demo reminders: nobody else is using the demo, so nobody reminds you. */
import type { Reminder } from '../../types';

const ReminderService = {
  async getReminders(): Promise<Reminder[]> {
    return [];
  },
  async dismiss(_id: string): Promise<void> {},
};

export default ReminderService;
