import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { API_CONFIG } from '../constants/config';
import { apiRequest } from '../services/api';

interface AdminDashboardModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  visible,
  onClose,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [email, setEmail] = useState('admin@remind.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (visible && adminToken) {
      fetchAdminData();
    }
  }, [visible, adminToken]);

  const handleAdminLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter admin email and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiRequest('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAdminToken(res.token);
      await fetchAdminData(res.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async (tokenOverride?: string) => {
    const token = tokenOverride || adminToken;
    if (!token) return;

    setLoading(true);
    try {
      const [statsRes, eventsRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_CONFIG.BASE_URL}/admin/events?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);

      setStats(statsRes);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch (err: any) {
      setErrorMsg('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const openWebDashboard = () => {
    Linking.openURL(`${API_CONFIG.BASE_URL}/admin`).catch(() => {});
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
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.title}>Admin Control Center</Text>
              <Text style={styles.subTitle}>Server & Audit Logs</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!adminToken ? (
            // Admin Login
            <View style={styles.loginBox}>
              <Text style={styles.adminNote}>
                Enter backend master credentials to access the admin audit panel.
              </Text>

              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="Admin Email"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Admin Password"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleAdminLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Authorize Admin</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Admin Dashboard
            <ScrollView style={styles.scroll}>
              <TouchableOpacity
                style={styles.webBtn}
                onPress={openWebDashboard}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={16} color={Colors.accentCyan} />
                <Text style={styles.webBtnText}>Open Web Dashboard in Browser</Text>
              </TouchableOpacity>

              {/* Stats Grid */}
              {stats && (
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{stats.totalUsers ?? 0}</Text>
                    <Text style={styles.statLabel}>Users</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: Colors.accentCyan }]}>
                      {stats.activeReminders ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Active</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: Colors.accentCompleted }]}>
                      {stats.completedReminders ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Completed</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: '#a855f7' }]}>
                      {stats.totalEvents ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Events</Text>
                  </View>
                </View>
              )}

              {/* Event Logs */}
              <Text style={styles.sectionHeader}>Recent Audit Events</Text>
              {loading ? (
                <ActivityIndicator color={Colors.accentCyan} style={{ marginVertical: 20 }} />
              ) : events.length === 0 ? (
                <Text style={styles.emptyText}>No events logged yet.</Text>
              ) : (
                events.map((e) => {
                  const dateStr = new Date(e.timestamp).toLocaleTimeString();
                  return (
                    <View key={e.id} style={styles.eventCard}>
                      <View style={styles.eventRow}>
                        <Text style={styles.eventType}>{e.type}</Text>
                        <Text style={styles.eventTime}>{dateStr}</Text>
                      </View>
                      {e.decryptedMetadata && (
                        <Text style={styles.eventMeta}>
                          {JSON.stringify(e.decryptedMetadata)}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
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
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subTitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.accentCyan,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  loginBox: {
    marginTop: 10,
  },
  adminNote: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: Typography.fontSizes.xs,
  },
  input: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: Colors.accentCyan,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.bold,
  },
  scroll: {
    flexGrow: 0,
  },
  webBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  webBtnText: {
    color: Colors.accentCyan,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 10,
  },
  eventCard: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: '#a855f7',
  },
  eventTime: {
    fontSize: 10,
    color: '#64748b',
  },
  eventMeta: {
    fontSize: 10,
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
