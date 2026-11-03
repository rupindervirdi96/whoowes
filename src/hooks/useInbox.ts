import { usePendingSettlements } from './useSettlements';
import { useFriendRequests, useReminders } from './useFriends';
import { useContactMatches } from './useContacts';

/**
 * What's waiting on me, for the bell on the home screen: payments to confirm,
 * reminders, friend requests, and contacts who joined WhoOwes.
 *
 * `count` is what the bell's badge shows. It counts things someone did, not
 * the standing "find friends from your contacts" suggestion, so the badge
 * clears once you've dealt with everything.
 */
export function useInbox() {
  const { data: pending = [] } = usePendingSettlements();
  const { data: requests } = useFriendRequests();
  const { data: reminders = [] } = useReminders();
  const contacts = useContactMatches();

  const incoming = requests?.incoming ?? [];
  const newOnWhoOwes = contacts.data?.onWhoOwes.filter((m) => m.state === 'none') ?? [];
  const askForContacts = contacts.data?.permission === 'undetermined';
  const contactsRow = newOnWhoOwes.length > 0 || askForContacts;

  const count = pending.length + reminders.length + incoming.length + (newOnWhoOwes.length > 0 ? 1 : 0);
  const rows = pending.length + reminders.length + incoming.length + (contactsRow ? 1 : 0);

  return { pending, reminders, incoming, newOnWhoOwes, contactsRow, count, rows };
}
