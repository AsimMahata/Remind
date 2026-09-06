import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { Header } from '../components/Header';
import { AppSettings } from '../types/reminder';
import { testVoicePlayback } from '../services/tts';
import { useAppInsets } from '../hooks/useAppInsets';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const { bottomInset } = useAppInsets();

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
        {/* Section: Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>

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

        {/* Section: About */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>About</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Remind</Text>
            <Text style={styles.settingSubText}>Version 1.0.0 (Offline-first)</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingMainText}>Local Storage</Text>
            <Text style={styles.settingSubText}>All data saved on device</Text>
          </View>
        </View>
      </ScrollView>
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
});
