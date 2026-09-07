import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';

import { reportCrash } from '../services/crashReporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * Root Error Boundary for the Remind App.
 * Catches any render or component error in the tree and displays a
 * graceful, theme-matching recovery interface instead of hard crashing.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.warn('[ErrorBoundary] Caught component error gracefully:', error, errorInfo);
    try {
      reportCrash(error, {
        source: 'ErrorBoundary',
        componentStack: errorInfo.componentStack ?? undefined,
      });
    } catch {
      // Safe no-op
    }
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={styles.safeArea}>
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={44} color={Colors.accentCyan} />
              </View>

              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.subtitle}>
                An unexpected interface error was prevented from crashing your app.
                Your reminders, alarms, and offline data are completely safe.
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.retryButtonText}>Continue Using Remind</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailsToggle}
                onPress={this.toggleDetails}
                activeOpacity={0.7}
              >
                <Text style={styles.detailsToggleText}>
                  {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                </Text>
                <Ionicons
                  name={this.state.showDetails ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {this.state.showDetails && (
                <ScrollView style={styles.detailsCard}>
                  <Text style={styles.errorName}>
                    {this.state.error?.name}: {this.state.error?.message}
                  </Text>
                  {this.state.error?.stack && (
                    <Text style={styles.stackTrace}>{this.state.error.stack}</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentBlue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  detailsToggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  detailsCard: {
    maxHeight: 180,
    width: '100%',
    backgroundColor: '#0E131A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2633',
    padding: 12,
    marginTop: 12,
  },
  errorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  stackTrace: {
    fontSize: 11,
    lineHeight: 16,
    color: '#8A99AD',
    fontFamily: 'monospace',
  },
});
