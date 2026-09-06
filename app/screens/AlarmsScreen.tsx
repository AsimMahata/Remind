import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alarm } from '../types/alarm';
import { Colors, Typography } from '../constants/theme';
import { Header } from '../components/Header';
import { AlarmCard } from '../components/AlarmCard';
import { AddEditAlarmModal } from '../components/AddEditAlarmModal';
import { formatAlarmTimeString, getRemainingTimeText } from '../services/alarmEngine';

interface AlarmsScreenProps {
  alarms: Alarm[];
  onAddAlarm: (alarmData: {
    time: string;
    targetTimestamp: number;
    label?: string;
    vibrate: boolean;
    soundUri?: string;
  }) => void;
  onUpdateAlarm: (id: string, updates: Partial<Alarm>) => void;
  onToggleAlarm: (id: string, enabled: boolean) => void;
  onDeleteAlarm: (id: string) => void;
}

export const AlarmsScreen: React.FC<AlarmsScreenProps> = ({
  alarms,
  onAddAlarm,
  onUpdateAlarm,
  onToggleAlarm,
  onDeleteAlarm,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);

  // Compute next closest upcoming alarm
  const nextAlarmInfo = useMemo(() => {
    const enabledAlarms = alarms.filter((a) => a.enabled && a.targetTimestamp > Date.now());
    if (enabledAlarms.length === 0) return null;

    // Sort by earliest targetTimestamp
    const sorted = [...enabledAlarms].sort((a, b) => a.targetTimestamp - b.targetTimestamp);
    const closest = sorted[0];

    return {
      timeStr: formatAlarmTimeString(closest.time),
      label: closest.label,
      countdown: getRemainingTimeText(closest.targetTimestamp),
    };
  }, [alarms]);

  const handleOpenAdd = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setEditingAlarm(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (alarm: Alarm) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setEditingAlarm(alarm);
    setModalVisible(true);
  };

  // Instant 1-tap quick alarms (+15m, +30m, +1h, +2h)
  const handleQuickAdd = (minutes: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const target = new Date(Date.now() + minutes * 60 * 1000);
    const h24 = target.getHours();
    const m = target.getMinutes();
    const hStr = h24 < 10 ? `0${h24}` : `${h24}`;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const time24 = `${hStr}:${mStr}`;

    const label = minutes >= 60 ? `In ${minutes / 60} hour(s)` : `In ${minutes} minutes`;

    onAddAlarm({
      time: time24,
      targetTimestamp: target.getTime(),
      label,
      vibrate: true,
      soundUri: 'default',
    });
  };

  const handleDeleteWithConfirm = (id: string) => {
    Alert.alert(
      'Delete Alarm',
      'Remove this alarm?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteAlarm(id);
          },
        },
      ]
    );
  };

  const handleSaveModal = (data: {
    id?: string;
    time: string;
    targetTimestamp: number;
    label?: string;
    vibrate: boolean;
    soundUri?: string;
  }) => {
    if (data.id) {
      onUpdateAlarm(data.id, {
        time: data.time,
        targetTimestamp: data.targetTimestamp,
        label: data.label,
        vibrate: data.vibrate,
        soundUri: data.soundUri,
        enabled: true,
      });
    } else {
      onAddAlarm({
        time: data.time,
        targetTimestamp: data.targetTimestamp,
        label: data.label,
        vibrate: data.vibrate,
        soundUri: data.soundUri,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Alarms"
        showBack={false}
        showSearch={false}
        showMenu={false}
        rightElement={
          <TouchableOpacity
            onPress={handleOpenAdd}
            style={styles.headerAddBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Add alarm"
          >
            <Ionicons name="add" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      {/* Quick 1-Tap Preset Bar */}
      <View style={styles.quickBar}>
        <Text style={styles.quickBarTitle}>Quick set:</Text>
        <View style={styles.quickChipsRow}>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => handleQuickAdd(15)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickChipText}>+15m</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickChip, styles.quickChipHighlight]}
            onPress={() => handleQuickAdd(30)}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickChipText, styles.quickChipTextHighlight]}>
              +30m
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickChip, styles.quickChipHighlight]}
            onPress={() => handleQuickAdd(60)}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickChipText, styles.quickChipTextHighlight]}>
              +1 hr
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => handleQuickAdd(120)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickChipText}>+2 hr</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Next Alarm Countdown Banner */}
      {nextAlarmInfo && (
        <View style={styles.nextAlarmBanner}>
          <Ionicons
            name="alarm-outline"
            size={18}
            color={Colors.accentCyan}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.nextAlarmText}>
            Next alarm <Text style={styles.nextAlarmHighlight}>{nextAlarmInfo.countdown}</Text> ({nextAlarmInfo.timeStr})
          </Text>
        </View>
      )}

      {/* Alarms FlatList */}
      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            onToggleEnabled={onToggleAlarm}
            onEditPress={handleOpenEdit}
            onDeletePress={handleDeleteWithConfirm}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alarm-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No active alarms</Text>
            <Text style={styles.emptySub}>
              Use the quick buttons above or tap + to set an alarm for any time
            </Text>
          </View>
        }
      />

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        onPress={handleOpenAdd}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityLabel="Add new alarm"
      >
        <Ionicons name="add" size={32} color={Colors.fabIcon} />
      </TouchableOpacity>

      {/* Add / Edit Alarm Modal with Native Clock Scroll Drums */}
      <AddEditAlarmModal
        visible={modalVisible}
        alarmToEdit={editingAlarm}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerAddBtn: {
    padding: 6,
    marginLeft: 8,
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundDarker,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  quickBarTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickChipsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickChipHighlight: {
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quickChipTextHighlight: {
    color: Colors.accentCyan,
  },
  nextAlarmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#073656',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  nextAlarmText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  nextAlarmHighlight: {
    color: Colors.accentCyan,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 90,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.fabBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
