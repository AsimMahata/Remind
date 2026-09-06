import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { getAuthState, loginUser, registerUser, logout } from '../services/auth';
import { performSync } from '../services/sync';

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  onLoggedIn?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  visible,
  onClose,
  onLoggedIn,
}) => {
  const authState = getAuthState();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (tab === 'login') {
        await loginUser(email.trim(), password);
      } else {
        await registerUser(email.trim(), password);
      }
      setEmail('');
      setPassword('');
      onLoggedIn?.();
      performSync();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {authState.isAuthenticated ? 'Account Profile' : 'Cloud Sync & Account'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {authState.isAuthenticated && authState.user ? (
              // Logged in View
              <View style={styles.profileBox}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarLetter}>
                    {(authState.user.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.userEmail}>{authState.user.email}</Text>
                <Text style={styles.userRole}>
                  Role: {(authState.user.role || 'user').toUpperCase()}
                </Text>

                <View style={styles.infoBanner}>
                  <Ionicons name="cloud-done-outline" size={18} color={Colors.accentCyan} />
                  <Text style={styles.infoText}>
                    Cloud synchronization is active. All your reminders are safely backed up.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.btn, styles.logoutBtn]}
                  onPress={handleLogout}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.logoutBtnText}>Log Out of Device</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Logged out View (Login / Register Tabs)
              <View>
                <View style={styles.tabHeader}>
                  <TouchableOpacity
                    style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
                    onPress={() => {
                      setTab('login');
                      setErrorMsg('');
                    }}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === 'login' && styles.tabTextActive,
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
                    onPress={() => {
                      setTab('register');
                      setErrorMsg('');
                    }}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === 'register' && styles.tabTextActive,
                      ]}
                    >
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="At least 6 characters"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btn, styles.submitBtn]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {tab === 'login' ? 'Sign In' : 'Create Free Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.offlineNote}>
                  Note: Remind works completely offline. An account is only needed if you want cloud backup and sync.
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
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
    maxWidth: 380,
    backgroundColor: '#131b2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.accentCyan,
  },
  tabText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  tabTextActive: {
    color: Colors.accentCyan,
    fontWeight: Typography.weights.bold,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: Typography.fontSizes.sm,
    flex: 1,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: Colors.accentCyan,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.bold,
  },
  offlineNote: {
    fontSize: Typography.fontSizes.xs,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  profileBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  userEmail: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userRole: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 18,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.semiBold,
  },
});
