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
  Share,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'errors'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [errorsList, setErrorsList] = useState<any[]>([]);
  const [errorCounts, setErrorCounts] = useState<{ total: number; activeCount: number; solvedCount: number }>({
    total: 0,
    activeCount: 0,
    solvedCount: 0,
  });
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [errorFilter, setErrorFilter] = useState<'all' | 'active' | 'solved'>('all');

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
      const [statsRes, eventsRes, errorsRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).catch(() => null),
        fetch(`${API_CONFIG.BASE_URL}/admin/events?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).catch(() => []),
        fetch(`${API_CONFIG.BASE_URL}/admin/errors?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).catch(() => ({ reports: [], total: 0, activeCount: 0, solvedCount: 0 })),
      ]);

      if (statsRes) setStats(statsRes);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
      if (errorsRes && Array.isArray(errorsRes.reports)) {
        setErrorsList(errorsRes.reports);
        setErrorCounts({
          total: errorsRes.total || 0,
          activeCount: errorsRes.activeCount || 0,
          solvedCount: errorsRes.solvedCount || 0,
        });
      }
    } catch (err: any) {
      setErrorMsg('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResolveError = async (id: string, currentlySolved: boolean) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/errors/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ solved: !currentlySolved }),
      }).then((r) => r.json());

      if (res.success) {
        setErrorsList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  solved: !currentlySolved,
                  solvedAt: !currentlySolved ? new Date().toISOString() : null,
                  expiresAt: res.report?.expiresAt || item.expiresAt,
                }
              : item
          )
        );
        setErrorCounts((prev) => ({
          ...prev,
          activeCount: currentlySolved ? prev.activeCount + 1 : Math.max(0, prev.activeCount - 1),
          solvedCount: currentlySolved ? Math.max(0, prev.solvedCount - 1) : prev.solvedCount + 1,
        }));
      }
    } catch {
      // Safe degradation
    }
  };

  const handleDeleteError = async (id: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/errors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.json());

      if (res.success) {
        setErrorsList((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      // Safe degradation
    }
  };

  const handleCopyErrorLog = async (errItem: any) => {
    const fullLog = `=== CRASH / ERROR REPORT ===
ID: ${errItem.id}
Name: ${errItem.errorName}
Message: ${errItem.errorMessage}
Platform: ${errItem.platform} (App v${errItem.appVersion || '1.0.0'})
Occurrences: ${errItem.count}
Status: ${errItem.solved ? 'SOLVED (Purges in 24h)' : 'ACTIVE (Default TTL: 7d)'}
First Seen: ${errItem.firstSeenAt}
Last Seen: ${errItem.lastSeenAt}
Auto Expires At: ${errItem.expiresAt}

--- STACK TRACE ---
${errItem.stackTrace || 'No stack trace available'}

--- COMPONENT STACK ---
${errItem.componentStack || 'N/A'}

--- DECRYPTED CLIENT CONTEXT & STATE ---
${JSON.stringify(errItem.diagnostics, null, 2)}
============================`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullLog);
        setCopyStatus(errItem.id);
        setTimeout(() => setCopyStatus(null), 3000);
        return;
      }
    } catch {
      // Continue to Share API
    }

    try {
      await Share.share({
        title: `Crash Report: ${errItem.errorName}`,
        message: fullLog,
      });
      setCopyStatus(errItem.id);
      setTimeout(() => setCopyStatus(null), 3000);
    } catch {
      // Safe degradation
    }
  };

  const openWebDashboard = () => {
    Linking.openURL(`${API_CONFIG.BASE_URL}/admin`).catch(() => {});
  };

  const filteredErrors = errorsList.filter((e) => {
    if (errorFilter === 'active') return !e.solved;
    if (errorFilter === 'solved') return e.solved;
    return true;
  });

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
              <Text style={styles.subTitle}>Server, Audit & Crash Logs</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!adminToken ? (
            // Admin Login
            <View style={styles.loginBox}>
              <Text style={styles.adminNote}>
                Enter backend master credentials to access the admin audit & crash diagnostics panel.
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
            // Admin Dashboard Body
            <View style={{ flex: 1 }}>
              {/* Tab Navigation */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('overview')}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={16}
                    color={activeTab === 'overview' ? Colors.accentCyan : Colors.textSecondary}
                  />
                  <Text
                    style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}
                  >
                    Overview
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'errors' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('errors')}
                >
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color={activeTab === 'errors' ? '#f87171' : Colors.textSecondary}
                  />
                  <Text
                    style={[styles.tabText, activeTab === 'errors' && styles.tabTextActiveErrors]}
                  >
                    Crashes ({errorCounts.activeCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.refreshIconBtn}
                  onPress={() => fetchAdminData()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.accentCyan} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={Colors.accentCyan} />
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 20 }}>
                {activeTab === 'overview' ? (
                  <>
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
                          <Text style={[styles.statNum, { color: '#f87171' }]}>
                            {errorCounts.activeCount}
                          </Text>
                          <Text style={styles.statLabel}>Crashes</Text>
                        </View>
                      </View>
                    )}

                    {/* Event Logs */}
                    <Text style={styles.sectionHeader}>Recent Audit Events</Text>
                    {loading && events.length === 0 ? (
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
                  </>
                ) : (
                  // Errors & Crashes Tab
                  <>
                    {/* Error Filter Chips */}
                    <View style={styles.filterRow}>
                      <TouchableOpacity
                        style={[styles.filterChip, errorFilter === 'all' && styles.filterChipActive]}
                        onPress={() => setErrorFilter('all')}
                      >
                        <Text style={[styles.filterChipText, errorFilter === 'all' && styles.filterChipTextActive]}>
                          All ({errorCounts.total})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterChip, errorFilter === 'active' && styles.filterChipActiveRed]}
                        onPress={() => setErrorFilter('active')}
                      >
                        <Text style={[styles.filterChipText, errorFilter === 'active' && styles.filterChipTextActiveRed]}>
                          Active ({errorCounts.activeCount})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterChip, errorFilter === 'solved' && styles.filterChipActiveGreen]}
                        onPress={() => setErrorFilter('solved')}
                      >
                        <Text style={[styles.filterChipText, errorFilter === 'solved' && styles.filterChipTextActiveGreen]}>
                          Solved ({errorCounts.solvedCount})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.ttlNotice}>
                      * Active crashes have a 7-day TTL. Solved bugs auto-purge from DB in 24 hours.
                    </Text>

                    {loading && errorsList.length === 0 ? (
                      <ActivityIndicator color={Colors.accentCyan} style={{ marginVertical: 20 }} />
                    ) : filteredErrors.length === 0 ? (
                      <View style={styles.emptyBox}>
                        <Ionicons name="checkmark-done-circle-outline" size={38} color="#22c55e" />
                        <Text style={styles.emptyText}>No crash or error reports found!</Text>
                      </View>
                    ) : (
                      filteredErrors.map((errItem) => {
                        const isExpanded = expandedErrorId === errItem.id;
                        const isCopied = copyStatus === errItem.id;
                        const dateStr = new Date(errItem.lastSeenAt).toLocaleString();

                        return (
                          <View key={errItem.id} style={styles.errorCard}>
                            {/* Card Header */}
                            <View style={styles.errorHeaderRow}>
                              <View style={styles.errorTitleContainer}>
                                <Text style={styles.errorCardName} numberOfLines={1}>
                                  {errItem.errorName || 'Runtime Error'}
                                </Text>
                                <Text style={styles.errorCardMsg} numberOfLines={2}>
                                  {errItem.errorMessage}
                                </Text>
                              </View>
                              <View style={styles.badgeCol}>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    errItem.solved ? styles.solvedBadge : styles.activeBadge,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      errItem.solved ? styles.solvedBadgeText : styles.activeBadgeText,
                                    ]}
                                  >
                                    {errItem.solved ? 'SOLVED' : 'ACTIVE'}
                                  </Text>
                                </View>
                                <Text style={styles.countBadgeText}>{errItem.count}x</Text>
                              </View>
                            </View>

                            {/* Meta row */}
                            <View style={styles.errorMetaRow}>
                              <Text style={styles.errorMetaText}>
                                {errItem.platform.toUpperCase()} • {dateStr}
                              </Text>
                              <TouchableOpacity
                                onPress={() => setExpandedErrorId(isExpanded ? null : errItem.id)}
                                style={styles.expandToggle}
                              >
                                <Text style={styles.expandToggleText}>
                                  {isExpanded ? 'Hide Details' : 'View Details'}
                                </Text>
                                <Ionicons
                                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={12}
                                  color={Colors.accentCyan}
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <View style={styles.expandedContent}>
                                <Text style={styles.detailSectionTitle}>Stack Trace:</Text>
                                <TextInput
                                  editable={false}
                                  multiline
                                  selectTextOnFocus
                                  style={styles.codeBox}
                                  value={errItem.stackTrace || 'No stack trace available'}
                                />

                                {errItem.componentStack && (
                                  <>
                                    <Text style={styles.detailSectionTitle}>Component Tree:</Text>
                                    <TextInput
                                      editable={false}
                                      multiline
                                      selectTextOnFocus
                                      style={styles.codeBox}
                                      value={errItem.componentStack}
                                    />
                                  </>
                                )}

                                {errItem.diagnostics && (
                                  <>
                                    <Text style={styles.detailSectionTitle}>Decrypted Diagnostics:</Text>
                                    <TextInput
                                      editable={false}
                                      multiline
                                      selectTextOnFocus
                                      style={styles.codeBox}
                                      value={JSON.stringify(errItem.diagnostics, null, 2)}
                                    />
                                  </>
                                )}
                              </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.actionRow}>
                              {/* 1-Tap Copy Log */}
                              <TouchableOpacity
                                style={[styles.actionBtn, isCopied && styles.actionBtnCopied]}
                                onPress={() => handleCopyErrorLog(errItem)}
                              >
                                <Ionicons
                                  name={isCopied ? 'checkmark-circle' : 'copy-outline'}
                                  size={13}
                                  color={isCopied ? '#22c55e' : Colors.accentCyan}
                                />
                                <Text
                                  style={[
                                    styles.actionBtnText,
                                    isCopied && styles.actionBtnTextCopied,
                                  ]}
                                >
                                  {isCopied ? 'Copied Log!' : 'Copy Full Log'}
                                </Text>
                              </TouchableOpacity>

                              {/* Mark Solved / Unsolve */}
                              <TouchableOpacity
                                style={[
                                  styles.actionBtn,
                                  errItem.solved ? styles.actionBtnUnsolve : styles.actionBtnResolve,
                                ]}
                                onPress={() => handleToggleResolveError(errItem.id, errItem.solved)}
                              >
                                <Ionicons
                                  name={errItem.solved ? 'arrow-undo-outline' : 'checkmark-outline'}
                                  size={13}
                                  color={errItem.solved ? '#94a3b8' : '#22c55e'}
                                />
                                <Text
                                  style={[
                                    styles.actionBtnText,
                                    { color: errItem.solved ? '#94a3b8' : '#22c55e' },
                                  ]}
                                >
                                  {errItem.solved ? 'Reopen' : 'Mark Solved'}
                                </Text>
                              </TouchableOpacity>

                              {/* Purge / Delete */}
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.actionBtnDelete]}
                                onPress={() => handleDeleteError(errItem.id)}
                              >
                                <Ionicons name="trash-outline" size={13} color="#f87171" />
                                <Text style={[styles.actionBtnText, { color: '#f87171' }]}>
                                  Delete
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </>
                )}
              </ScrollView>
            </View>
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
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 8,
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.semiBold,
  },
  tabTextActive: {
    color: Colors.accentCyan,
  },
  tabTextActiveErrors: {
    color: '#f87171',
  },
  refreshIconBtn: {
    marginLeft: 'auto',
    padding: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  filterChipActive: {
    borderColor: Colors.accentCyan,
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
  },
  filterChipActiveRed: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  filterChipActiveGreen: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  filterChipTextActive: {
    color: Colors.accentCyan,
  },
  filterChipTextActiveRed: {
    color: '#f87171',
  },
  filterChipTextActiveGreen: {
    color: '#22c55e',
  },
  ttlNotice: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  errorCard: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorTitleContainer: {
    flex: 1,
  },
  errorCardName: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: '#f87171',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  errorCardMsg: {
    fontSize: 11,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  badgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  activeBadge: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  solvedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  activeBadgeText: {
    color: '#f87171',
  },
  solvedBadgeText: {
    color: '#22c55e',
  },
  countBadgeText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: Typography.weights.semiBold,
  },
  errorMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  errorMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandToggleText: {
    fontSize: 10,
    color: Colors.accentCyan,
    fontWeight: Typography.weights.medium,
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  detailSectionTitle: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 2,
  },
  codeBox: {
    backgroundColor: '#070b13',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    padding: 8,
    fontSize: 10,
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxHeight: 120,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnCopied: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  actionBtnResolve: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  actionBtnUnsolve: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  actionBtnDelete: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    marginLeft: 'auto',
  },
  actionBtnText: {
    fontSize: 10,
    color: Colors.accentCyan,
    fontWeight: Typography.weights.semiBold,
  },
  actionBtnTextCopied: {
    color: '#22c55e',
  },
});
