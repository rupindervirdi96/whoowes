import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import type { SplitwiseMatch, User } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useImportSplitwise } from '../../hooks/useImport';
import { useT } from '../../i18n';
import { formatShortDate } from '../../utils/date';
import { guessMatches, nameFromFile } from '../../utils/splitwiseCsv';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card, { ListCard } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SegmentedControl } from '../../components/ui/Chip';
import BatchImport from '../../components/import/BatchImport';
import {
  ImportDone,
  MyBalanceCard,
  PeopleMatcher,
  PROBLEM,
  readSplitwiseFile,
  type FileProblem,
  type ImportSummary,
  type PickedFile,
} from '../../components/import/SplitwiseShared';

type Target = 'newGroup' | 'group' | 'none';

/** Most people have a handful of groups; this keeps one import from running for ages. */
const MAX_FILES = 30;

/**
 * Account → "Move from Splitwise": one Splitwise spreadsheet (a group or a
 * friend), or several at once.
 */
const ImportSplitwiseScreen: React.FC<RootScreenProps<'ImportSplitwise'>> = ({ navigation }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const run = useImportSplitwise();

  const [single, setSingle] = useState<Extract<PickedFile, { file: object }> | null>(null);
  const [batch, setBatch] = useState<PickedFile[] | null>(null);
  const [batchKey, setBatchKey] = useState(0);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const [reading, setReading] = useState<'one' | 'many' | null>(null);
  const [target, setTarget] = useState<Target>('newGroup');
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState<string>();
  const [matches, setMatches] = useState<SplitwiseMatch[]>([]);
  const [done, setDone] = useState<{ summary: ImportSummary; groupId?: string | null } | null>(null);

  const file = single?.file;
  const group = groups.find((g) => g.id === groupId);
  // Who each Splitwise name can be: friends, or (into a group) its members.
  const candidates: User[] = useMemo(() => {
    if (target === 'group') return group ? group.members.map((m) => m.user).filter((u) => u.id !== me.id) : [];
    return friends.map((f) => f.friendUser);
  }, [target, group, friends, me.id]);

  // A fresh guess whenever the file or the people to match against change.
  useEffect(() => {
    if (file) setMatches(guessMatches(file.people, me, candidates));
  }, [file, candidates, me]);

  const pick = async (many: boolean) => {
    setProblem(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: many });
    if (picked.canceled || !picked.assets?.length) return;
    setReading(many ? 'many' : 'one');
    try {
      const assets = picked.assets.slice(0, MAX_FILES);
      const read = await Promise.all(assets.map((a) => readSplitwiseFile(a.uri, a.name)));
      setDone(null);
      // One file picked (either way) goes through the detailed review.
      if (read.length === 1) {
        const [only] = read;
        if (!only.file) return setProblem(only.problem);
        setBatch(null);
        setSingle(only);
        setGroupName(nameFromFile(only.name));
        setTarget(only.file.people.length === 2 ? 'none' : 'newGroup');
        return;
      }
      if (!read.some((r) => r.file)) return setProblem(read[0].problem ?? 'notSplitwise');
      setSingle(null);
      setBatch(read);
      setBatchKey((k) => k + 1);
    } finally {
      setReading(null);
    }
  };

  const reset = () => {
    setSingle(null);
    setBatch(null);
    setDone(null);
    setGroupId(undefined);
  };

  // ── Done ──
  if (done) {
    return (
      <Screen>
        <ImportDone
          summary={done.summary}
          onAnother={reset}
          primary={
            done.groupId
              ? { label: tr('import.done.openGroup'), onPress: () => navigation.replace('GroupDetail', { groupId: done.groupId! }) }
              : done.summary.groups
                ? { label: tr('import.batch.openGroups'), onPress: () => navigation.navigate('Main', { screen: 'Groups' }) }
                : { label: tr('common.done'), onPress: () => navigation.goBack() }
          }
        />
      </Screen>
    );
  }

  // ── Several files ──
  if (batch) {
    return <BatchImport key={batchKey} files={batch} onRepick={() => pick(true)} onDone={(summary) => setDone({ summary })} />;
  }

  // ── Choose ──
  if (!file) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: t.spacing.sm, marginBottom: t.spacing.lg }}>
          <Text style={{ fontSize: 44, lineHeight: 54 }}>📦</Text>
          <Text variant="h2" align="center" style={{ marginTop: 8 }}>
            {tr('import.title')}
          </Text>
          <Text tone="secondary" align="center" style={{ marginTop: 6 }}>
            {tr('import.intro')}
          </Text>
        </View>
        <Card>
          {(['import.step1', 'import.step2', 'import.step3'] as const).map((key, i) => (
            <View key={key} style={{ flexDirection: 'row', gap: 12, marginTop: i ? 14 : 0 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="label" tone="primary">
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, paddingTop: 2 }}>{tr(key)}</Text>
            </View>
          ))}
        </Card>
        {problem ? (
          <Card variant="alt" style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.base }}>
            <Icon name="error-outline" size={20} color={t.colors.negative} />
            <Text tone="secondary" style={{ flex: 1 }}>
              {tr(PROBLEM[problem])}
            </Text>
          </Card>
        ) : null}
        <View style={{ gap: 10, marginTop: t.spacing.xl }}>
          <Button title={tr('import.chooseOne')} icon="upload-file" size="lg" fullWidth loading={reading === 'one'} disabled={!!reading} onPress={() => pick(false)} />
          <Button
            title={tr('import.chooseMany')}
            icon="library-add"
            variant="secondary"
            size="lg"
            fullWidth
            loading={reading === 'many'}
            disabled={!!reading}
            onPress={() => pick(true)}
          />
        </View>
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 12 }}>
          {tr('import.chooseManyHint')}
        </Text>
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 8 }}>
          {tr('import.privacy')}
        </Text>
      </Screen>
    );
  }

  // ── One file: check and import ──
  const meIndex = matches.indexOf('me');
  const used = matches.flatMap((m) => (typeof m === 'object' ? [m.userId] : []));
  const twice = used.length !== new Set(used).size;
  const ready = meIndex >= 0 && !twice && (target === 'newGroup' ? !!groupName.trim() : target === 'group' ? !!groupId : true);

  const submit = () => {
    if (!ready) return;
    run.mutate(
      {
        target: target === 'newGroup' ? { kind: 'newGroup', name: groupName.trim() } : target === 'group' ? { kind: 'group', groupId: groupId! } : { kind: 'none' },
        people: file.people.map((name, i) => ({ name, as: matches[i] })),
        rows: file.rows,
      },
      { onSuccess: (r) => setDone({ summary: r, groupId: r.groupId }) },
    );
  };

  return (
    <Screen
      footer={
        <Button title={tr('import.run', { count: file.rows.length })} size="lg" fullWidth disabled={!ready} loading={run.isPending} onPress={submit} />
      }
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="description" color={t.colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {single?.name ?? 'Splitwise'}
          </Text>
          <Text variant="caption" tone="tertiary">
            {tr('import.summary', { expenses: file.expenseCount, payments: file.paymentCount })}
            {` · ${formatShortDate(file.from)} – ${formatShortDate(file.to)}`}
          </Text>
        </View>
        <Button title={tr('import.change')} variant="ghost" size="sm" onPress={() => pick(false)} />
      </Card>

      <PeopleMatcher names={file.people} matches={matches} onChange={setMatches} candidates={candidates} hint={tr('import.whoIsWhoHint')} />

      <SectionHeader title={tr('import.where')} />
      <SegmentedControl<Target>
        value={target}
        onChange={(v) => setTarget(v)}
        options={[
          { value: 'newGroup', label: tr('import.target.newGroup') },
          ...(groups.length ? [{ value: 'group' as const, label: tr('import.target.group') }] : []),
          ...(file.people.length === 2 ? [{ value: 'none' as const, label: tr('import.target.none') }] : []),
        ]}
      />
      <View style={{ marginTop: t.spacing.base }}>
        {target === 'newGroup' ? (
          <Input label={tr('import.groupName')} value={groupName} onChangeText={setGroupName} maxLength={60} placeholder={tr('import.groupNamePlaceholder')} />
        ) : target === 'group' ? (
          <ListCard>
            {groups.map((g, i) => (
              <ListRow
                key={g.id}
                title={g.name}
                subtitle={tr('import.members', { count: g.members.length })}
                divider={i < groups.length - 1}
                onPress={() => setGroupId(g.id)}
                trailing={g.id === groupId ? <Icon name="check" color={t.colors.primary} /> : null}
              />
            ))}
          </ListCard>
        ) : (
          <Text variant="caption" tone="tertiary" style={{ marginHorizontal: 4 }}>
            {tr('import.target.noneHint')}
          </Text>
        )}
      </View>

      <MyBalanceCard totals={meIndex >= 0 ? file.totals[meIndex] : undefined} />
    </Screen>
  );
};

export default ImportSplitwiseScreen;
