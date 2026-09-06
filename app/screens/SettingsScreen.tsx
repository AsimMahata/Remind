import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { Header } from '../components/Header';
import { AppSettings } from '../types/reminder';
import { testVoicePlayback } from '../services/tts';
import { useAppInsets } from '../hooks/useAppInsets';
import { getAuthState, subscribeToAuth } from '../services/auth';
import {
  getSyncStatus,
  subscribeToSyncStatus,
  performSync,
} from '../services/sync';
import { AccountModal } from '../components/AccountModal';
import { AdminDashboardModal } from '../components/AdminDashboardModal';
import { TrashModal } from '../components/TrashModal';
import { fetchReminderStats } from '../services/reminders';
import { API_CONFIG } from '../constants/config';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onBack: () => void;
  onRefreshReminders?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  onRefreshReminders,
}) => {
  const { bottomInset } = useAppInsets();
  const [authState, setAuthState] = useState(getAuthState());
  const [syncStatus, setSyncStatusState] = useState(getSyncStatus());
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [stats, setStats] = useState<{ active: number; completed: number; deleted: number; total: number }>({
    active: 0,
    completed: 0,
    deleted: 0,
    total: 0,
  });

  const loadStats = async () => {
    try {
      const s = await fetchReminderStats();
      setStats(s);
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  };

  useEffect(() => {
    loadStats();
    const unsubAuth = subscribeToAuth((newAuth) => {
      setAuthState(newAuth);
      loadStats();
    });
    const unsubSync = subscribeToSyncStatus(setSyncStatusState);
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    try {
      await performSync();
      await loadStats();
      onRefreshReminders?.();
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleOpenAdminDashboard = async () => {
    const url = `${API_CONFIG.BASE_URL}/admin`;
    try {
      await Linking.openURL(url);
    } catch {
      setShowAdminModal(true);
    }
  };

  const renderSyncBadge = () => {
    if (!authState.isAuthenticated) {
      return (
        <View style={[styles.statusBadge, styles.statusOffline]}>
          <Text style={styles.statusBadgeText}>Offline Only</Text>
        </View>
      );
    }

    if (syncStatus === 'syncing' || isSyncingManual) {
      return (
        <View style={[styles.statusBadge, styles.statusSyncing]}>
          <ActivityIndicator size="small" color="#000000" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: '#000000' }]}>Syncing...</Text>
        </View>
      );
    }

    if (syncStatus === 'offline') {
      return (
        <View style={[styles.statusBadge, styles.statusOffline]}>
          <Text style={styles.statusBadgeText}>Offline</Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusBadge, styles.statusSynced]}>
        <Ionicons name="checkmark-circle" size={14} color="#000000" style={{ marginRight: 4 }} />
        <Text style={[styles.statusBadgeText, { color: '#000000' }]}>Synced</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Settings"
        showBack={true}
        onBack={onBack}
        showSearch={false}
        showMenu={false}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Section: Account & Cloud Sync */}
        <Text style={styles.sectionTitle}>Account & Cloud Sync</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowAccountModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>
              {authState.isAuthenticated && authState.user
                ? authState.user.email
                : 'Cloud Account'}
            </Text>
            <Text style={styles.settingSubText}>
              {authState.isAuthenticated
                ? 'Logged in • Tap to view profile & cloud settings'
                : 'Logged out • Reminders stored locally on device'}
            </Text>
          </View>
          {renderSyncBadge()}
        </TouchableOpacity>

        {authState.isAuthenticated && (
          <TouchableOpacity
            style={[styles.settingRow, styles.subRow]}
            onPress={handleManualSync}
            disabled={isSyncingManual || syncStatus === 'syncing'}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextCol}>
              <Text style={styles.actionText}>🔄 Synchronize Now</Text>
              <Text style={styles.settingSubText}>
                Push local changes and pull latest cloud updates
              </Text>
            </View>
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.accentCyan} />
          </TouchableOpacity>
        )}

        {/* Section: Data & Storage Stats */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Data Management & Stats</Text>

        <View style={styles.statsSummaryBox}>
          <View style={styles.statMiniCol}>
            <Text style={styles.statMiniVal}>{stats.active}</Text>
            <Text style={styles.statMiniLbl}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statMiniCol}>
            <Text style={[styles.statMiniVal, { color: Colors.accentCompleted }]}>
              {stats.completed}
            </Text>
            <Text style={styles.statMiniLbl}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statMiniCol}>
            <Text style={[styles.statMiniVal, { color: stats.deleted > 0 ? '#f87171' : Colors.textSecondary }]}>
              {stats.deleted}
            </Text>
            <Text style={styles.statMiniLbl}>In Trash</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowTrashModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Recently Deleted / Trash</Text>
            <Text style={styles.settingSubText}>
              {stats.deleted > 0
                ? `${stats.deleted} reminder(s) can be recovered or permanently deleted`
                : 'No deleted items. Deletions are kept here for recovery.'}
            </Text>
          </View>
          <Ionicons
            name="trash-outline"
            size={20}
            color={stats.deleted > 0 ? '#f87171' : Colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Section: Notifications */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Notifications</Text>

        {/* Setting: Notifications Enabled */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() =>
            onUpdateSettings({ notificationsEnabled: !settings.notificationsEnabled })
          }
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Task notification</Text>
            <Text style={styles.settingSubText}>
              {settings.notificationsEnabled ? 'On time' : 'Disabled'}
            </Text>
          </View>
          <View
            style={[
              styles.checkboxBox,
              settings.notificationsEnabled && styles.checkboxBoxChecked,
            ]}
          >
            {settings.notificationsEnabled && (
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        {/* Setting: Voice / TTS */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() =>
            onUpdateSettings({ voiceReminderEnabled: !settings.voiceReminderEnabled })
          }
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Voice</Text>
            <Text style={styles.settingSubText}>
              Uses system default speech synthesizer (TTS)
            </Text>
          </View>
          <View
            style={[
              styles.checkboxBox,
              settings.voiceReminderEnabled && styles.checkboxBoxChecked,
            ]}
          >
            {settings.voiceReminderEnabled && (
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        {/* Voice Test Action */}
        <TouchableOpacity
          style={[styles.settingRow, styles.subRow]}
          onPress={testVoicePlayback}
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.actionText}>🔊 Test Speech Synthesizer</Text>
          </View>
          <Ionicons name="play" size={18} color={Colors.accentCyan} />
        </TouchableOpacity>

        {/* Setting: Vibration */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() =>
            onUpdateSettings({ vibrateEnabled: !settings.vibrateEnabled })
          }
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Vibration</Text>
            <Text style={styles.settingSubText}>
              {settings.vibrateEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View
            style={[
              styles.checkboxBox,
              settings.vibrateEnabled && styles.checkboxBoxChecked,
            ]}
          >
            {settings.vibrateEnabled && (
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        {/* Section: Quick Task */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Quick Task</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() =>
            onUpdateSettings({ quickTaskBarEnabled: !settings.quickTaskBarEnabled })
          }
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Quick task bar</Text>
            <Text style={styles.settingSubText}>
              {settings.quickTaskBarEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View
            style={[
              styles.checkboxBox,
              settings.quickTaskBarEnabled && styles.checkboxBoxChecked,
            ]}
          >
            {settings.quickTaskBarEnabled && (
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        {/* Section: Administration */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Administration</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleOpenAdminDashboard}
          activeOpacity={0.7}
        >
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Admin Dashboard</Text>
            <Text style={styles.settingSubText}>
              Server statistics, encrypted event logs, and system audit
            </Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.accentCyan} />
        </TouchableOpacity>

        {/* Section: About */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>About</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Remind</Text>
            <Text style={styles.settingSubText}>Version 1.0.0 (Offline-First with Cloud Sync)</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Storage Engine</Text>
            <Text style={styles.settingSubText}>Local SQLite + Node.js MongoDB Cloud Sync</Text>
          </View>
        </View>
      </ScrollView>

      {/* Account Modal */}
      <AccountModal
        visible={showAccountModal}
        onClose={() => {
          setShowAccountModal(false);
          loadStats();
        }}
        onLoggedIn={() => {
          loadStats();
          onRefreshReminders?.();
        }}
      />

      {/* Trash / Deleted Reminders Modal */}
      <TrashModal
        visible={showTrashModal}
        onClose={() => {
          setShowTrashModal(false);
          loadStats();
        }}
        onRestored={() => {
          loadStats();
          onRefreshReminders?.();
        }}
      />

      {/* Admin Dashboard Modal */}
      <AdminDashboardModal
        visible={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.accentCyan,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  subRow: {
    paddingLeft: 12,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  settingMainText: {
    fontSize: Typography.fontSizes.lg,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.regular,
    marginBottom: 3,
  },
  settingSubText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
  },
  actionText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.accentCyan,
    fontWeight: Typography.weights.medium,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: Colors.checkboxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSynced: {
    backgroundColor: Colors.accentCyan,
  },
  statusSyncing: {
    backgroundColor: '#f59e0b',
  },
  statusOffline: {
    backgroundColor: '#334155',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  statsSummaryBox: {
    flexDirection: 'row',
    backgroundColor: '#131b2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statMiniCol: {
    flex: 1,
    alignItems: 'center',
  },
  statMiniVal: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statMiniLbl: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#1e293b',
  },
});
