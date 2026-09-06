import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { useAppInsets } from '../hooks/useAppInsets';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  onSearchPress?: () => void;
  showMenu?: boolean;
  onMenuPress?: () => void;
  isSearchActive?: boolean;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Remind',
  showBack = false,
  onBack,
  showSearch = true,
  onSearchPress,
  showMenu = true,
  onMenuPress,
  rightElement,
}) => {
  const { topInset } = useAppInsets();

  return (
    <View style={[styles.headerContainer, { paddingTop: topInset + 8 }]}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
      <View style={styles.headerContent}>
        {/* Left Side: Back button OR Checkmark Icon + Title */}
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.iconButton}
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.titleWithIcon}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.titleText}>{title}</Text>
            </View>
          )}

          {showBack && <Text style={styles.titleText}>{title}</Text>}
        </View>

        {/* Right Side Actions */}
        <View style={styles.rightContainer}>
          {rightElement}

          {showSearch && (
            <TouchableOpacity
              onPress={onSearchPress}
              style={styles.iconButton}
              accessibilityLabel="Search reminders"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="search" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}

          {showMenu && (
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.iconButton}
              accessibilityLabel="Menu"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: Colors.primary,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleText: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    marginLeft: 12,
  },
});
