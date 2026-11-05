/**
 * Pieces shared by the one-file and several-files Splitwise imports: reading
 * a picked file, matching Splitwise names to people, and the summary at the end.
 */

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { File } from 'expo-file-system';
import { useTheme } from '../../theme';
import { useT, type TKey } from '../../i18n';
import type { SplitwiseMatch, User } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/currency';
import { parseSplitwiseCsv, SplitwiseFileError, type SplitwiseFile, type SplitwiseFileProblem } from '../../utils/splitwiseCsv';
import Text from '../ui/Text';
import Card, { ListCard } from '../ui/Card';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import ListRow, { SectionHeader } from '../ui/ListRow';
import BottomSheet from '../ui/BottomSheet';
import EmptyState from '../ui/EmptyState';

export type FileProblem = SplitwiseFileProblem | 'unreadable';

export const PROBLEM: Record<FileProblem, TKey> = {
  unreadable: 'import.problem.unreadable',
  empty: 'import.problem.empty',
  notSplitwise: 'import.problem.notSplitwise',
  tooMany: 'import.problem.tooMany',
};

/** The picked file's text. Some phones won't let the file API read the copy; fetch can. */
async function readText(uri: string) {
  try {
    return await new File(uri).text();
  } catch {
    const res = await fetch(uri);
    if (!res.ok && res.status !== 0) throw new Error(`read failed: ${res.status}`);
    return res.text();
  }
}

export type PickedFile = { name: string; file: SplitwiseFile; problem?: undefined } | { name: string; file?: undefined; problem: FileProblem };

/** Reads and checks one picked file. */
export async function readSplitwiseFile(uri: string, name: string): Promise<PickedFile> {
  let text: string;
  try {
    text = await readText(uri);
  } catch {
    return { name, problem: 'unreadable' };
  }
  try {
    return { name, file: parseSplitwiseCsv(text) };
  } catch (e) {
    return { name, problem: e instanceof SplitwiseFileError ? e.problem : 'notSplitwise' };
  }
}

/** Changes one name's match, keeping a single "you" and each WhoOwes person once. */
export function withMatch(list: SplitwiseMatch[], i: number, m: SplitwiseMatch): SplitwiseMatch[] {
  return list.map((x, j) => {
    if (j === i) return m;
    if (m === 'me' && x === 'me') return 'new';
    if (typeof m === 'object' && typeof x === 'object' && x.userId === m.userId) return 'new';
    return x;
  });
}

interface PeopleMatcherProps {
  names: string[];
  matches: SplitwiseMatch[];
  onChange: (next: SplitwiseMatch[]) => void;
  /** Who a name can be (besides me): friends, or a group's members. */
  candidates: User[];
  hint: string;
}

/** "Who's who": each Splitwise name → me, someone on WhoOwes, or someone new. */
export const PeopleMatcher: React.FC<PeopleMatcherProps> = ({ names, matches, onChange, candidates, hint }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const [choosing, setChoosing] = useState<number | null>(null);

  const label = (m: SplitwiseMatch) =>
    m === 'me' ? tr('common.you') : m === 'new' ? tr('import.match.new') : (candidates.find((c) => c.id === m.userId)?.name ?? tr('import.match.new'));
  const choose = (m: SplitwiseMatch) => {
    if (choosing === null) return;
    onChange(withMatch(matches, choosing, m));
    setChoosing(null);
  };
  const check = <Icon name="check" color={t.colors.primary} />;

  return (
    <>
      <SectionHeader title={tr('import.whoIsWho')} />
      <Text variant="caption" tone="tertiary" style={{ marginTop: -4, marginBottom: 8, marginHorizontal: 4 }}>
        {hint}
      </Text>
      <ListCard>
        {names.map((name, i) => {
          const m = matches[i] ?? 'new';
          return (
            <ListRow
              key={`${name}-${i}`}
              leading={<Avatar name={name} />}
              title={name}
              subtitle={label(m)}
              subtitleTone={m === 'new' ? 'tertiary' : 'positive'}
              chevron
              divider={i < names.length - 1}
              onPress={() => setChoosing(i)}
            />
          );
        })}
      </ListCard>
      {!matches.includes('me') ? (
        <Text variant="caption" tone="warning" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {tr('import.pickYou')}
        </Text>
      ) : null}

      <BottomSheet visible={choosing !== null} onClose={() => setChoosing(null)} title={choosing !== null ? names[choosing] : undefined} subtitle={tr('import.match.sheetHint')}>
        {choosing !== null ? (
          <ScrollView style={{ flexGrow: 0, maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <ListRow
              leading={<Avatar name={me.name} uri={me.avatarUrl} />}
              title={tr('import.match.me', { name: me.name })}
              onPress={() => choose('me')}
              trailing={matches[choosing] === 'me' ? check : null}
              divider
            />
            {candidates.map((u) => {
              const m = matches[choosing];
              return (
                <ListRow
                  key={u.id}
                  leading={<Avatar name={u.name} uri={u.avatarUrl} />}
                  title={u.name}
                  subtitle={u.placeholder ? tr('placeholder.badge') : undefined}
                  onPress={() => choose({ userId: u.id })}
                  trailing={typeof m === 'object' && m.userId === u.id ? check : null}
                  divider
                />
              );
            })}
            <ListRow
              leading={
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="person-add-alt" size={20} color={t.colors.textSecondary} />
                </View>
              }
              title={tr('import.match.new')}
              subtitle={tr('import.match.newHint')}
              onPress={() => choose('new')}
              trailing={matches[choosing] === 'new' ? check : null}
            />
          </ScrollView>
        ) : null}
      </BottomSheet>
    </>
  );
};

/** What I'll get back or owe once it's in, per currency. */
export const MyBalanceCard: React.FC<{ totals: Record<string, number> | undefined }> = ({ totals }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const rows = Object.entries(totals ?? {}).filter(([, v]) => Math.abs(v) >= 0.005);
  if (!rows.length) return null;
  return (
    <Card variant="alt" style={{ marginTop: t.spacing.lg, gap: 4 }}>
      <Text variant="label" tone="tertiary">
        {tr('import.yourBalance')}
      </Text>
      {rows.map(([currency, v]) => (
        <Text key={currency} variant="bodyStrong" tone={v > 0 ? 'positive' : 'negative'}>
          {v > 0 ? tr('import.owedToYou', { amount: formatCurrency(v, currency) }) : tr('import.youOwe', { amount: formatCurrency(-v, currency) })}
        </Text>
      ))}
    </Card>
  );
};

export interface ImportSummary {
  expenses: number;
  payments: number;
  alreadyHere: number;
  newPeople: number;
  /** Several files: how many groups were made, and the files that failed. */
  groups?: number;
  failed?: string[];
}

interface ImportDoneProps {
  summary: ImportSummary;
  primary: { label: string; onPress: () => void };
  onAnother: () => void;
}

/** The end screen: what came over, and who isn't on WhoOwes yet. */
export const ImportDone: React.FC<ImportDoneProps> = ({ summary, primary, onAnother }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const nothing = summary.expenses + summary.payments === 0;
  const failed = summary.failed ?? [];
  // Several files always report failures (maybe none); one file never does.
  const several = summary.failed !== undefined;
  const body = nothing
    ? tr(several ? 'import.done.nothingBodyMany' : 'import.done.nothingBody')
    : [
        tr('import.done.counts', { expenses: summary.expenses, payments: summary.payments }),
        summary.groups ? tr('import.batch.groupsMade', { count: summary.groups }) : '',
        summary.alreadyHere ? tr('import.done.alreadyHere', { count: summary.alreadyHere }) : '',
      ]
        .filter(Boolean)
        .join(' ');
  return (
    <>
      <EmptyState
        emoji={nothing && !failed.length ? '👌' : nothing ? '⚠️' : '🎉'}
        title={nothing ? (failed.length ? tr('import.failed') : tr('import.done.nothingTitle')) : tr('import.done.title')}
        body={nothing && failed.length ? undefined : body}
      />
      {failed.length ? (
        <Card variant="alt" style={{ flexDirection: 'row', gap: 12, marginBottom: t.spacing.sm }}>
          <Icon name="error-outline" size={20} color={t.colors.negative} />
          <Text tone="secondary" style={{ flex: 1 }}>
            {tr('import.batch.failedFiles', { count: failed.length, names: failed.join(', ') })}
          </Text>
        </Card>
      ) : null}
      {summary.newPeople ? (
        <Card variant="alt" style={{ flexDirection: 'row', gap: 12 }}>
          <Icon name="person-outline" size={20} color={t.colors.primary} />
          <Text tone="secondary" style={{ flex: 1 }}>
            {tr('import.done.newPeople', { count: summary.newPeople })}
          </Text>
        </Card>
      ) : null}
      <View style={{ gap: 10, marginTop: t.spacing.xl }}>
        <Button title={primary.label} size="lg" fullWidth onPress={primary.onPress} />
        <Button title={tr('import.another')} variant="secondary" fullWidth onPress={onAnother} />
      </View>
    </>
  );
};
