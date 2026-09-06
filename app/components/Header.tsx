import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
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
  // Multi-select mode props
  isSelectionMode?: boolean;
  selectedCount?: number;
  onCloseSelection?: () => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  onDeleteSelected?: () => void;
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
  isSelectionMode = false,
  selectedCount = 0,
  onCloseSelection,
  onSelectAll,
  isAllSelected = false,
  onDeleteSelected,
}) => {
  const { topInset } = useAppInsets();

  if (isSelectionMode) {
    return (
      <View style={[styles.headerContainer, styles.selectionHeaderContainer, { paddingTop: topInset + 8 }]}>
        <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
        <View style={styles.headerContent}>
          {/* Left: Close selection mode */}
          <View style={styles.leftContainer}>
            <TouchableOpacity
              onPress={onCloseSelection}
              style={styles.iconButton}
              accessibilityLabel="Exit selection mode"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.selectionCountText}>
              {selectedCount} {selectedCount === 1 ? 'selected' : 'selected'}
            </Text>
          </View>

          {/* Right: Select All & Batch Delete */}
          <View style={styles.rightContainer}>
            {onSelectAll && (
              <TouchableOpacity
                onPress={onSelectAll}
                style={styles.selectionActionButton}
                accessibilityLabel={isAllSelected ? 'Deselect all' : 'Select all'}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isAllSelected ? 'checkbox' : 'checkbox-outline'}
                  size={22}
                  color={Colors.textPrimary}
                />
                <Text style={styles.actionButtonText}>
                  {isAllSelected ? 'None' : 'All'}
                </Text>
              </TouchableOpacity>
            )}

            {onDeleteSelected && (
              <TouchableOpacity
                onPress={onDeleteSelected}
                disabled={selectedCount === 0}
                style={[styles.iconButton, selectedCount === 0 && { opacity: 0.4 }]}
                accessibilityLabel={`Delete ${selectedCount} selected reminders`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="trash" size={23} color="#fca5a5" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

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
  selectionHeaderContainer: {
    backgroundColor: '#023859', // Slightly deeper navy cyan for selection mode
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 209, 255, 0.3)',
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
  selectionCountText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 12,
    letterSpacing: 0.2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    marginLeft: 10,
  },
  selectionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    marginLeft: 8,
  },
  actionButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.semiBold,
    marginLeft: 4,
  },
});
