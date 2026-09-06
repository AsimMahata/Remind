import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../constants/theme';
import { useAppInsets } from '../hooks/useAppInsets';

interface QuickTaskBarProps {
  onAddQuickTask: (taskText: string) => void;
  onFabPress: () => void;
  onMicPress?: () => void;
}

export const QuickTaskBar: React.FC<QuickTaskBarProps> = ({
  onAddQuickTask,
  onFabPress,
  onMicPress,
}) => {
  const { bottomInset } = useAppInsets();
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    if (inputText.trim()) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // ignore
      }
      onAddQuickTask(inputText.trim());
      setInputText('');
      Keyboard.dismiss();
    }
  };

  return (
    <View style={styles.container}>
      {/* Quick Task Bar Card */}
      <View style={styles.inputPill}>
        <TouchableOpacity
          onPress={onMicPress}
          style={styles.micButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Add with details"
        >
          <Ionicons name="mic-outline" size={22} color={Colors.accentCyan} />
        </TouchableOpacity>

        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Quick task..."
          placeholderTextColor={Colors.placeholder}
          style={styles.textInput}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {inputText.length > 0 ? (
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.sendButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-up-circle" size={28} color={Colors.accentCyan} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        onPress={onFabPress}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityLabel="Add new reminder with date & time"
      >
        <Ionicons name="add" size={32} color={Colors.fabIcon} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  micButton: {
    paddingRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 6,
  },
  sendButton: {
    paddingLeft: 6,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.fabBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
