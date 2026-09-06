import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../constants/theme';
import { useAppInsets } from '../hooks/useAppInsets';

export type PrimaryTab = 'REMINDERS' | 'ALARMS' | 'SETTINGS';

interface BottomNavDockProps {
  activeTab: PrimaryTab;
  onSelectTab: (tab: PrimaryTab) => void;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const { bottomInset } = useAppInsets();

  const handleTabPress = (tab: PrimaryTab) => {
    if (tab !== activeTab) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
      onSelectTab(tab);
    }
  };

  return (
    <View style={[styles.dockContainer, { paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 16 : 8) }]}>
      <View style={styles.dockBar}>
        {/* Tab 1: Reminders */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'REMINDERS' && styles.dockItemActive]}
          onPress={() => handleTabPress('REMINDERS')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Reminders"
          accessibilityState={{ selected: activeTab === 'REMINDERS' }}
        >
          <Ionicons
            name={activeTab === 'REMINDERS' ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={22}
            color={activeTab === 'REMINDERS' ? Colors.accentCyan : Colors.textSecondary}
          />
          <Text
            style={[
              styles.dockLabel,
              activeTab === 'REMINDERS' ? styles.dockLabelActive : styles.dockLabelInactive,
            ]}
          >
            Reminders
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Alarms */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'ALARMS' && styles.dockItemActive]}
          onPress={() => handleTabPress('ALARMS')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Alarms"
          accessibilityState={{ selected: activeTab === 'ALARMS' }}
        >
          <Ionicons
            name={activeTab === 'ALARMS' ? 'alarm' : 'alarm-outline'}
            size={22}
            color={activeTab === 'ALARMS' ? Colors.accentCyan : Colors.textSecondary}
          />
          <Text
            style={[
              styles.dockLabel,
              activeTab === 'ALARMS' ? styles.dockLabelActive : styles.dockLabelInactive,
            ]}
          >
            Alarms
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Settings */}
        <TouchableOpacity
          style={[styles.dockItem, activeTab === 'SETTINGS' && styles.dockItemActive]}
          onPress={() => handleTabPress('SETTINGS')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Settings"
          accessibilityState={{ selected: activeTab === 'SETTINGS' }}
        >
          <Ionicons
            name={activeTab === 'SETTINGS' ? 'settings' : 'settings-outline'}
            size={22}
            color={activeTab === 'SETTINGS' ? Colors.accentCyan : Colors.textSecondary}
          />
          <Text
            style={[
              styles.dockLabel,
              activeTab === 'SETTINGS' ? styles.dockLabelActive : styles.dockLabelInactive,
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    backgroundColor: Colors.backgroundDarker,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: 6,
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    height: 50,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  dockItemActive: {
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
  },
  dockLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: Typography.weights.medium,
  },
  dockLabelActive: {
    color: Colors.accentCyan,
    fontWeight: Typography.weights.bold,
  },
  dockLabelInactive: {
    color: Colors.textSecondary,
  },
});
