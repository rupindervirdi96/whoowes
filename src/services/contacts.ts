/**
 * "Who from my contacts is on WhoOwes?"
 *
 * 1. Read the address book (only after the user grants access; we never prompt silently).
 * 2. Normalise every number to E.164 and hash it with SHA-256 on the device.
 * 3. Ask the directory which hashes belong to WhoOwes users. Live mode asks the
 *    server (POST /contacts/match), which never sees the raw numbers; demo mode
 *    checks the in-memory users.
 *
 * The address book itself is never uploaded or stored.
 */

import * as Contacts from 'expo-contacts';
import { USE_MOCK_API } from '../config';
import { DEMO_ADDRESS_BOOK } from '../constants/sampleData';
import type { ContactFriendState, ContactMatch, ContactMatchResult, ContactsPermission, User } from '../types';
import { hashPhone, toE164 } from '../utils/phone';
import { nowISO } from '../utils/date';
import apiClient from './api/apiClient';
import { FriendService } from './impl';
import { db } from './mock/db';

interface RawContact {
  id: string;
  name: string;
  phones: string[];
}

async function available() {
  try {
    return await Contacts.isAvailableAsync();
  } catch {
    return false;
  }
}

async function getPermission(): Promise<{ permission: ContactsPermission; canAskAgain: boolean }> {
  if (!(await available())) return { permission: USE_MOCK_API ? 'demo' : 'unavailable', canAskAgain: false };
  const res = await Contacts.getPermissionsAsync();
  return { permission: res.status as ContactsPermission, canAskAgain: res.canAskAgain };
}

async function readAddressBook(permission: ContactsPermission): Promise<RawContact[]> {
  if (permission === 'demo') return DEMO_ADDRESS_BOOK;
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
  return data
    .map((c) => ({
      id: c.id ?? c.name,
      name: (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ')).trim(),
      phones: (c.phoneNumbers ?? []).map((p) => p.number ?? p.digits ?? '').filter(Boolean),
    }))
    .filter((c) => c.name && c.phones.length > 0);
}

// ─── Directory lookup ────────────────────────────────────────────────────────

/** Demo mode on a real phone: contacts shown as members so the feature can be tried. */
const demoSeededIds = new Set<string>();

async function lookUp(hashes: Map<string, { phone: string; name: string }>): Promise<Map<string, User>> {
  const found = new Map<string, User>();
  if (USE_MOCK_API) {
    for (const u of db.users) {
      if (!u.phone) continue;
      const h = await hashPhone(u.phone);
      if (hashes.has(h)) found.set(h, u);
    }
    return found;
  }
  // The server only ever sees hashes, and returns public profiles (no numbers).
  const res = await apiClient.post<{ matches: Array<{ hash: string; user: User }> }>('/contacts/match', {
    hashes: [...hashes.keys()],
  });
  for (const m of res.data.matches) if (hashes.has(m.hash)) found.set(m.hash, m.user);
  return found;
}

function seedDemoMembers(contacts: Array<{ key: string; name: string; phone: string }>) {
  const picks = [...contacts].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
  for (const c of picks) {
    const id = `demo-${c.key}`;
    if (db.users.some((u) => u.id === id)) continue;
    db.users.push({ id, name: c.name, email: '', phone: c.phone, createdAt: nowISO(), updatedAt: nowISO() });
    demoSeededIds.add(id);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

const STATE_ORDER: Record<ContactFriendState, number> = { incoming: 0, none: 1, requested: 2, friend: 3 };

export const ContactsService = {
  getPermission,

  async requestPermission(): Promise<ContactsPermission> {
    if (!(await available())) return USE_MOCK_API ? 'demo' : 'unavailable';
    const res = await Contacts.requestPermissionsAsync();
    return res.status as ContactsPermission;
  },

  /** Never prompts: returns empty lists until the user has granted access. */
  async findMatches(me: User): Promise<ContactMatchResult> {
    const { permission, canAskAgain } = await getPermission();
    const empty = { permission, canAskAgain, onWhoOwes: [], invite: [], demoSeeded: false };
    if (permission !== 'granted' && permission !== 'demo') return empty;

    const raw = await readAddressBook(permission);

    // One entry per distinct number; skip my own.
    const entries: Array<{ key: string; name: string; phone: string; hash: string }> = [];
    const seen = new Set<string>();
    for (const c of raw) {
      for (const n of c.phones) {
        const phone = toE164(n);
        if (!phone || phone === me.phone || seen.has(phone)) continue;
        seen.add(phone);
        entries.push({ key: `${c.id}:${phone}`, name: c.name, phone, hash: await hashPhone(phone) });
      }
    }
    if (entries.length === 0) return empty;

    const byHash = new Map(entries.map((e) => [e.hash, { phone: e.phone, name: e.name }]));
    let users = await lookUp(byHash);
    if (USE_MOCK_API && permission === 'granted' && users.size === 0) {
      seedDemoMembers(entries);
      users = await lookUp(byHash);
    }

    const [friends, pending] = await Promise.all([FriendService.getFriends(me.id), FriendService.getPendingRequests(me.id)]);
    const friendIds = new Set(friends.map((f) => f.friendId));
    const stateOf = (userId: string): { state: ContactFriendState; requestId?: string } => {
      if (friendIds.has(userId)) return { state: 'friend' };
      const incoming = pending.find((r) => r.userId === userId && r.friendId === me.id);
      if (incoming) return { state: 'incoming', requestId: incoming.id };
      if (pending.some((r) => r.userId === me.id && r.friendId === userId)) return { state: 'requested' };
      return { state: 'none' };
    };

    const onWhoOwes: ContactMatch[] = [];
    const invite: ContactMatch[] = [];
    const memberIds = new Set<string>();
    const invitedNames = new Set<string>();
    for (const e of entries) {
      const user = users.get(e.hash);
      if (user) {
        if (memberIds.has(user.id) || user.id === me.id) continue;
        memberIds.add(user.id);
        onWhoOwes.push({ key: e.key, contactName: e.name, phone: e.phone, user, ...stateOf(user.id) });
      } else if (!invitedNames.has(e.name)) {
        invitedNames.add(e.name);
        invite.push({ key: e.key, contactName: e.name, phone: e.phone, state: 'none' });
      }
    }
    // A contact who's a member under one number shouldn't also be in the invite list.
    const memberNames = new Set(onWhoOwes.map((m) => m.contactName));

    return {
      permission,
      canAskAgain,
      onWhoOwes: onWhoOwes.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.contactName.localeCompare(b.contactName)),
      invite: invite.filter((c) => !memberNames.has(c.contactName)).sort((a, b) => a.contactName.localeCompare(b.contactName)),
      demoSeeded: onWhoOwes.some((m) => m.user && demoSeededIds.has(m.user.id)),
    };
  },
};
