import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { SplitwiseImportPayload, SplitwiseMatch } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useImportSplitwise } from '../../hooks/useImport';
import { firstName } from '../../utils/money';
import { guessMatches, nameFromFile } from '../../utils/splitwiseCsv';
import Screen from '../ui/Screen';
import Text from '../ui/Text';
import { ListCard } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import ListRow, { SectionHeader } from '../ui/ListRow';
import BottomSheet from '../ui/BottomSheet';
import { SegmentedControl } from '../ui/Chip';
import { MyBalanceCard, PeopleMatcher, PROBLEM, type ImportSummary, type PickedFile } from './SplitwiseShared';

interface Where {
  kind: 'newGroup' | 'none';
  name: string;
}

interface BatchImportProps {
  files: PickedFile[];
  /** Choose the files again. */
  onRepick: () => void;
  onDone: (summary: ImportSummary) => void;
}

/**
 * Several Splitwise files at once: each name is matched once for all of them,
 * each file becomes its own group (or stays between two people), and they go
 * in one after another. Someone new in one file is the same person in the next.
 */
const BatchImport: React.FC<BatchImportProps> = ({ files, onRepick, onDone }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const { data: friends = [] } = useFriends();
  const run = useImportSplitwise();

  const good = useMemo(() => files.flatMap((f) => (f.file ? [{ name: f.name, file: f.file }] : [])), [files]);
  // Everyone in any of the files, in the order they first appear.
  const names = useMemo(() => [...new Set(good.flatMap((g) => g.file.people))], [good]);
  const candidates = useMemo(() => friends.map((f) => f.friendUser), [friends]);

  const [matches, setMatches] = useState<SplitwiseMatch[]>([]);
  useEffect(() => setMatches(guessMatches(names, me, candidates)), [names, candidates, me]);
  const [where, setWhere] = useState<Where[]>(() =>
    good.map((g) => ({ kind: g.file.people.length === 2 ? 'none' : 'newGroup', name: nameFromFile(g.name) || 'Splitwise' })),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const myName = names[matches.indexOf('me')];
  // Files I'm not in can't be imported by me.
  const usable = good.map((g, i) => ({ ...g, where: where[i], index: i })).filter((g) => !!myName && g.file.people.includes(myName));
  const used = matches.flatMap((m) => (typeof m === 'object' ? [m.userId] : []));
  const ready = !!myName && used.length === new Set(used).size && usable.length > 0 && usable.every((g) => g.where.kind === 'none' || !!g.where.name.trim());

  // My bottom line across every file I'm in.
  const myTotals = useMemo(() => {
    if (!myName) return undefined;
    const sum: Record<string, number> = {};
    for (const g of usable) {
      const col = g.file.people.indexOf(myName);
      for (const [c, v] of Object.entries(g.file.totals[col])) sum[c] = Math.round(((sum[c] ?? 0) + v) * 100) / 100;
    }
    return sum;
  }, [usable, myName]);

  const describe = (g: (typeof good)[number], i: number) => {
    if (!myName || !g.file.people.includes(myName)) return { text: tr('import.batch.notYou'), tone: 'warning' as const };
    const w = where[i];
    const other = g.file.people.find((p) => p !== myName) ?? '';
    const place = w.kind === 'none' ? tr('import.batch.toNone', { name: firstName(other) }) : tr('import.batch.toGroup', { name: w.name.trim() || '…' });
    return { text: `${place} · ${tr('import.summary', { expenses: g.file.expenseCount, payments: g.file.paymentCount })}`, tone: 'tertiary' as const };
  };

  const submit = async () => {
    if (!ready) return;
    const byName = new Map(names.map((n, i) => [n, matches[i]] as const));
    const summary: Required<ImportSummary> = { expenses: 0, payments: 0, alreadyHere: 0, newPeople: 0, groups: 0, failed: [] };
    setProgress({ done: 0, total: usable.length });
    for (const [n, g] of usable.entries()) {
      const payload: SplitwiseImportPayload = {
        target: g.where.kind === 'none' ? { kind: 'none' } : { kind: 'newGroup', name: g.where.name.trim() },
        people: g.file.people.map((name) => ({ name, as: byName.get(name) ?? 'new' })),
        rows: g.file.rows,
      };
      try {
        const r = await run.mutateAsync(payload);
        summary.expenses += r.expenses;
        summary.payments += r.payments;
        summary.alreadyHere += r.alreadyHere;
        summary.newPeople += r.newPeople;
        if (r.groupId && g.where.kind === 'newGroup' && r.expenses + r.payments > 0) summary.groups++;
        // The same new person in a later file is the one just made.
        for (const c of r.created ?? []) byName.set(c.name, { userId: c.userId });
      } catch {
        summary.failed.push(g.where.kind === 'newGroup' ? g.where.name.trim() : g.name);
      }
      setProgress({ done: n + 1, total: usable.length });
    }
    setProgress(null);
    onDone(summary);
  };

  const edit = editing !== null ? good[editing] : null;
  const setEdit = (patch: Partial<Where>) => editing !== null && setWhere((list) => list.map((w, i) => (i === editing ? { ...w, ...patch } : w)));

  return (
    <Screen
      footer={
        <Button
          title={progress ? tr('import.batch.progress', { done: Math.min(progress.done + 1, progress.total), total: progress.total }) : tr('import.batch.run', { count: usable.length })}
          size="lg"
          fullWidth
          disabled={!ready || !!progress}
          loading={!!progress}
          onPress={submit}
        />
      }
    >
      <SectionHeader title={tr('import.batch.files', { count: files.length })} action={tr('import.change')} onAction={onRepick} style={{ marginTop: 0 }} />
      <ListCard>
        {files.map((f, i) => {
          if (!f.file) {
            return (
              <ListRow
                key={`${f.name}-${i}`}
                leading={<Icon name="error-outline" color={t.colors.negative} />}
                title={f.name}
                subtitle={tr(PROBLEM[f.problem])}
                subtitleTone="negative"
                divider={i < files.length - 1}
              />
            );
          }
          const gi = good.findIndex((g) => g.name === f.name && g.file === f.file);
          const d = describe(good[gi], gi);
          return (
            <ListRow
              key={`${f.name}-${i}`}
              leading={<Icon name={where[gi]?.kind === 'none' ? 'person' : 'group'} color={t.colors.primary} />}
              // A group shows its new name; a friend export shows who it's with.
              title={where[gi]?.kind === 'newGroup' ? where[gi].name || f.name : (f.file.people.find((p) => p !== myName) ?? f.name)}
              subtitle={d.text}
              subtitleTone={d.tone}
              chevron
              divider={i < files.length - 1}
              onPress={() => setEditing(gi)}
            />
          );
        })}
      </ListCard>

      {names.length ? (
        <PeopleMatcher names={names} matches={matches} onChange={setMatches} candidates={candidates} hint={tr('import.batch.peopleHint')} />
      ) : null}

      <MyBalanceCard totals={myTotals} />

      <BottomSheet visible={!!edit} onClose={() => setEditing(null)} title={tr('import.batch.editTitle')} subtitle={edit?.name}>
        {edit && editing !== null ? (
          <View>
            {edit.file.people.length === 2 ? (
              <SegmentedControl<Where['kind']>
                value={where[editing].kind}
                onChange={(kind) => setEdit({ kind })}
                options={[
                  { value: 'newGroup', label: tr('import.target.newGroup') },
                  { value: 'none', label: tr('import.target.none') },
                ]}
                style={{ marginBottom: t.spacing.base }}
              />
            ) : null}
            {where[editing].kind === 'newGroup' ? (
              <Input label={tr('import.groupName')} value={where[editing].name} onChangeText={(name) => setEdit({ name })} maxLength={60} placeholder={tr('import.groupNamePlaceholder')} />
            ) : (
              <Text tone="secondary" style={{ marginBottom: t.spacing.base }}>
                {tr('import.target.noneHint')}
              </Text>
            )}
            <Button title={tr('common.done')} size="lg" fullWidth onPress={() => setEditing(null)} />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

export default BatchImport;
