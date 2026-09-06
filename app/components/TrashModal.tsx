import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { Reminder } from '../types/reminder';
import {
  fetchDeletedReminders,
  restoreDeletedReminder,
  permanentlyPurgeDeletedReminders,
} from '../services/reminders';

interface TrashModalProps {
  visible: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  visible,
  onClose,
  onRestored,
}) => {
  const [deletedList, setDeletedList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTrash();
    }
  }, [visible]);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const list = await fetchDeletedReminders();
      setDeletedList(list);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(true);
    try {
      await restoreDeletedReminder(id);
      setDeletedList((prev) => prev.filter((r) => r.id !== id));
      onRestored();
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeAll = () => {
    if (deletedList.length === 0) return;

    Alert.alert(
      'Permanently Delete All?',
      `Are you sure you want to permanently remove ${deletedList.length} deleted reminder(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await permanentlyPurgeDeletedReminders();
              setDeletedList([]);
              onRestored();
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>Trash / Deleted Reminders</Text>
              <Text style={styles.subtitle}>
                {deletedList.length} item{deletedList.length === 1 ? '' : 's'} recoverable
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Action Row */}
          {deletedList.length > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.purgeBtn}
                onPress={handlePurgeAll}
                disabled={actionLoading}
              >
                <Ionicons name="trash-bin-outline" size={16} color="#f87171" />
                <Text style={styles.purgeBtnText}>Empty Trash (Permanent)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List */}
          {loading ? (
            <ActivityIndicator color={Colors.accentCyan} style={{ marginVertical: 30 }} />
          ) : deletedList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trash-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>Trash is empty</Text>
              <Text style={styles.emptySubText}>
                When you delete reminders, they will appear here so you can easily recover them before permanently purging.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scroll}>
              {deletedList.map((r) => {
                const deletedDateStr = r.deletedAt
                  ? new Date(r.deletedAt).toLocaleDateString()
                  : 'Recently';

                return (
                  <View key={r.id} style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTask} numberOfLines={2}>
                        {r.task}
                      </Text>
                      <Text style={styles.itemSub}>Deleted on {deletedDateStr}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.recoverBtn}
                      onPress={() => handleRestore(r.id)}
                      disabled={actionLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-undo-outline" size={16} color="#000" />
                      <Text style={styles.recoverBtnText}>Recover</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#131b2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.accentCyan,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
    marginBottom: 12,
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  purgeBtnText: {
    color: '#f87171',
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  scroll: {
    flexGrow: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemTask: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    marginBottom: 4,
  },
  itemSub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  recoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentCyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  recoverBtnText: {
    color: '#000',
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.weights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
