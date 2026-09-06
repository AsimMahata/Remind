import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';

interface OfflineMigrationModalProps {
  visible: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OfflineMigrationModal: React.FC<OfflineMigrationModalProps> = ({
  visible,
  count,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload-outline" size={32} color={Colors.accentCyan} />
          </View>

          <Text style={styles.title}>Offline Reminders Found</Text>

          <Text style={styles.description}>
            We found <Text style={styles.bold}>{count}</Text> local reminder
            {count === 1 ? '' : 's'} created on this device.
          </Text>

          <Text style={styles.subDescription}>
            Would you like to sync these reminders to your authenticated cloud account?
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Keep Local</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmBtnText}>Sync to Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#131b2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  bold: {
    color: Colors.accentCyan,
    fontWeight: Typography.weights.bold,
  },
  subDescription: {
    fontSize: Typography.fontSizes.sm,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.medium,
  },
  confirmBtn: {
    backgroundColor: Colors.accentCyan,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.bold,
  },
});
