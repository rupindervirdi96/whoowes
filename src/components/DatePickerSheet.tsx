import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { currentLocale, useT } from '../i18n';
import { formatMonthYear } from '../utils/date';
import BottomSheet from './ui/BottomSheet';
import Text from './ui/Text';
import IconButton from './ui/IconButton';
import Button from './ui/Button';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onSelect: (date: Date) => void;
  /** Latest pickable day (default today): expenses can't be in the future. */
  maxDate?: Date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Locale's first day of the week (0 = Sunday). Falls back to Sunday where Intl can't tell. */
function firstDayOfWeek(): number {
  try {
    const info = (new Intl.Locale(currentLocale()) as unknown as { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } });
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    return firstDay ? firstDay % 7 : 0;
  } catch {
    return 0;
  }
}

/** Month calendar in a bottom sheet. */
const DatePickerSheet: React.FC<DatePickerSheetProps> = ({ visible, onClose, value, onSelect, maxDate }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const today = startOfDay(new Date());
  const max = startOfDay(maxDate ?? today);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  // Reopen on the month of the chosen date.
  useEffect(() => {
    if (visible) setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [visible, value]);

  const weekStart = useMemo(firstDayOfWeek, []);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(currentLocale(), { weekday: 'narrow' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
  }, [weekStart]);

  const cells = useMemo(() => {
    const lead = (month.getDay() - weekStart + 7) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month, weekStart]);

  const canGoNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= max;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const pick = (d: Date) => {
    onSelect(d);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={tr('date.pickTitle')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.md }}>
        <IconButton icon="chevron-left" variant="ghost" size={40} accessibilityLabel={tr('date.prevMonth')} onPress={() => shift(-1)} />
        <Text variant="h3">{formatMonthYear(month)}</Text>
        <IconButton
          icon="chevron-right"
          variant="ghost"
          size={40}
          accessibilityLabel={tr('date.nextMonth')}
          onPress={() => canGoNext && shift(1)}
          style={{ opacity: canGoNext ? 1 : 0.3 }}
        />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {weekdays.map((w, i) => (
          <Text key={i} variant="caption" tone="tertiary" align="center" style={{ flex: 1 }}>
            {w}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          const disabled = d > max;
          return (
            <View key={d.toISOString()} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable
                disabled={disabled}
                onPress={() => pick(d)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'full' }).format(d)}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? t.colors.primary : pressed ? t.colors.surfaceAlt : 'transparent',
                  borderWidth: isToday && !selected ? 1.5 : 0,
                  borderColor: t.colors.primary,
                })}
              >
                <Text
                  variant="bodyStrong"
                  tabular
                  color={selected ? t.colors.textOnPrimary : disabled ? t.colors.textTertiary : isToday ? t.colors.primary : t.colors.text}
                  style={{ opacity: disabled ? 0.45 : 1 }}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Button title={tr('date.today')} variant="ghost" icon="today" onPress={() => pick(today)} style={{ marginTop: t.spacing.sm }} />
    </BottomSheet>
  );
};

export default DatePickerSheet;
