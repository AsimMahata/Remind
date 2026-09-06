import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { useAppInsets } from '../hooks/useAppInsets';

interface MenuDropdownProps {
  visible: boolean;
  onClose: () => void;
  onNavigateSettings: () => void;
  onClearCompleted: () => void;
  onTestVoice: () => void;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({
  visible,
  onClose,
  onNavigateSettings,
  onClearCompleted,
  onTestVoice,
}) => {
  const { topInset } = useAppInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.menuContainer, { top: topInset + 48 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateSettings();
              }}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={Colors.accentCyan}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onTestVoice();
              }}
            >
              <Ionicons
                name="volume-high-outline"
                size={20}
                color={Colors.accentCyan}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Test Voice (TTS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onClearCompleted();
              }}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={Colors.accentOverdue}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Clear Completed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuContainer: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: Colors.modalBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.modalBorder,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
});
