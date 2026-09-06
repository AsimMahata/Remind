import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';

interface TimePickerModalProps {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onConfirm: (selectedDate: Date) => void;
}

type PickerMode = 'hour' | 'minute';

const DIAL_SIZE = 220;
const RADIUS = DIAL_SIZE / 2;
const NUMBER_RADIUS = RADIUS - 26; // Distance from center to numbers

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  initialDate,
  onClose,
  onConfirm,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(initialDate));
  const [mode, setMode] = useState<PickerMode>('hour');
  const [isManualInput, setIsManualInput] = useState(false);

  // Sync only on modal open
  useEffect(() => {
    if (visible) {
      setSelectedDate(new Date(initialDate));
      setMode('hour');
      setIsManualInput(false);
    }
  }, [visible]);

  const hoursRaw = selectedDate.getHours();
  const isPM = hoursRaw >= 12;
  const currentHour12 = hoursRaw % 12 === 0 ? 12 : hoursRaw % 12;
  const currentMinute = selectedDate.getMinutes();

  // Temporary manual inputs
  const [manualHour, setManualHour] = useState(String(currentHour12));
  const [manualMinute, setManualMinute] = useState(
    currentMinute < 10 ? `0${currentMinute}` : String(currentMinute)
  );

  const toggleManualInput = () => {
    if (!isManualInput) {
      setManualHour(String(currentHour12));
      setManualMinute(currentMinute < 10 ? `0${currentMinute}` : String(currentMinute));
    }
    setIsManualInput((prev) => !prev);
  };

  const handlePeriodChange = (pm: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = new Date(selectedDate);
    let h = updated.getHours() % 12;
    if (pm) h += 12;
    updated.setHours(h);
    setSelectedDate(updated);
  };

  // Direct, rock-solid click handlers (NO buggy coordinate math)
  const handleSelectHour = (hour12: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = new Date(selectedDate);
    let actualH = hour12 % 12;
    if (isPM) actualH += 12;
    updated.setHours(actualH);
    setSelectedDate(updated);
    // Instant smooth switch to minute selection
    setMode('minute');
  };

  const handleSelectMinute = (minute: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = new Date(selectedDate);
    updated.setMinutes(minute);
    setSelectedDate(updated);
  };

  // Stepper adjustment for any intermediate minute (e.g. 52)
  const adjustMinute = (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = new Date(selectedDate);
    let newMin = (updated.getMinutes() + delta + 60) % 60;
    updated.setMinutes(newMin);
    setSelectedDate(updated);
  };

  const adjustHour = (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const updated = new Date(selectedDate);
    let current12 = updated.getHours() % 12 === 0 ? 12 : updated.getHours() % 12;
    let next12 = ((current12 - 1 + delta + 12) % 12) + 1;
    let actualH = next12 % 12;
    if (isPM) actualH += 12;
    updated.setHours(actualH);
    setSelectedDate(updated);
  };

  const handleManualApply = () => {
    let h = parseInt(manualHour, 10);
    if (isNaN(h) || h < 1) h = 1;
    if (h > 12) h = 12;

    let m = parseInt(manualMinute, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    const updated = new Date(selectedDate);
    let actualHour = h % 12;
    if (isPM) actualHour += 12;
    updated.setHours(actualHour);
    updated.setMinutes(m);
    setSelectedDate(updated);
    setIsManualInput(false);
  };

  // Hour numbers 1-12
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // Minute display numbers (00, 05, 10 ... 55)
  const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Precise hand pointer angle based on selected value
  const pointerAngle =
    mode === 'hour'
      ? ((currentHour12 % 12) * 30 - 90) * (Math.PI / 180)
      : (currentMinute * 6 - 90) * (Math.PI / 180);

  const pointerX = RADIUS + NUMBER_RADIUS * Math.cos(pointerAngle);
  const pointerY = RADIUS + NUMBER_RADIUS * Math.sin(pointerAngle);

  // Check if current minute is an exact multiple of 5
  const isMinuteOnMarker = currentMinute % 5 === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          {/* Header (Cyan Blue Banner - exactly matching image.png) */}
          <View style={styles.headerBanner}>
            <View style={styles.timeDisplayRow}>
              {/* Hour button */}
              <TouchableOpacity
                onPress={() => {
                  setMode('hour');
                  setIsManualInput(false);
                }}
                style={styles.timeUnitBtn}
              >
                <Text
                  style={[
                    styles.timeText,
                    mode === 'hour' && !isManualInput && styles.timeTextActive,
                  ]}
                >
                  {currentHour12 < 10 ? `0${currentHour12}` : currentHour12}
                </Text>
              </TouchableOpacity>

              <Text style={styles.colonText}>:</Text>

              {/* Minute button */}
              <TouchableOpacity
                onPress={() => {
                  setMode('minute');
                  setIsManualInput(false);
                }}
                style={styles.timeUnitBtn}
              >
                <Text
                  style={[
                    styles.timeText,
                    mode === 'minute' && !isManualInput && styles.timeTextActive,
                  ]}
                >
                  {currentMinute < 10 ? `0${currentMinute}` : currentMinute}
                </Text>
              </TouchableOpacity>

              {/* AM / PM Toggles */}
              <View style={styles.periodCol}>
                <TouchableOpacity
                  onPress={() => handlePeriodChange(false)}
                  style={styles.periodBtn}
                >
                  <Text
                    style={[
                      styles.periodText,
                      !isPM && styles.periodTextActive,
                    ]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePeriodChange(true)}
                  style={styles.periodBtn}
                >
                  <Text
                    style={[
                      styles.periodText,
                      isPM && styles.periodTextActive,
                    ]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Clock Dial Face or Manual Input */}
          <View style={styles.contentBody}>
            {!isManualInput ? (
              <>
                <View style={styles.dialDisc}>
                  {/* Center Dot */}
                  <View style={styles.centerDot} />

                  {/* Pointer Hand Line */}
                  <View
                    style={[
                      styles.pointerLine,
                      {
                        width: NUMBER_RADIUS,
                        transform: [
                          { rotate: `${(pointerAngle * 180) / Math.PI}deg` },
                        ],
                      },
                    ]}
                  />

                  {/* Pointer Tip Highlight Circle */}
                  <View
                    style={[
                      styles.pointerHead,
                      {
                        left: pointerX - 16,
                        top: pointerY - 16,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    {mode === 'minute' && !isMinuteOnMarker ? (
                      <Text style={styles.pointerHeadText}>
                        {currentMinute < 10 ? `0${currentMinute}` : currentMinute}
                      </Text>
                    ) : (
                      <View style={styles.pointerHeadInnerDot} />
                    )}
                  </View>

                  {/* Direct Touch Targets around the Dial Face */}
                  {mode === 'hour'
                    ? hourNumbers.map((hour) => {
                        const angle = ((hour % 12) * 30 - 90) * (Math.PI / 180);
                        const x = RADIUS + NUMBER_RADIUS * Math.cos(angle);
                        const y = RADIUS + NUMBER_RADIUS * Math.sin(angle);
                        const isSelected = hour === currentHour12;

                        return (
                          <TouchableOpacity
                            key={`btn-hour-${hour}`}
                            onPress={() => handleSelectHour(hour)}
                            style={[
                              styles.numberBtn,
                              {
                                left: x - 16,
                                top: y - 16,
                              },
                              isSelected && styles.numberBtnSelected,
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.numberText,
                                isSelected && styles.numberTextSelected,
                              ]}
                            >
                              {hour}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    : minuteNumbers.map((minute) => {
                        const angle = (minute * 6 - 90) * (Math.PI / 180);
                        const x = RADIUS + NUMBER_RADIUS * Math.cos(angle);
                        const y = RADIUS + NUMBER_RADIUS * Math.sin(angle);
                        const isSelected = minute === currentMinute;

                        return (
                          <TouchableOpacity
                            key={`btn-min-${minute}`}
                            onPress={() => handleSelectMinute(minute)}
                            style={[
                              styles.numberBtn,
                              {
                                left: x - 16,
                                top: y - 16,
                              },
                              isSelected && styles.numberBtnSelected,
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.numberText,
                                isSelected && styles.numberTextSelected,
                              ]}
                            >
                              {minute < 10 ? `0${minute}` : minute}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                </View>

                {/* Instant Fine-Tuning Controls for intermediate minutes (e.g. 52) */}
                <View style={styles.fineTuneRow}>
                  {mode === 'minute' ? (
                    <>
                      <TouchableOpacity
                        onPress={() => adjustMinute(-5)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>-5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => adjustMinute(-1)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>-1</Text>
                      </TouchableOpacity>

                      <View style={styles.tuneDisplay}>
                        <Text style={styles.tuneDisplayText}>
                          {currentMinute < 10 ? `0${currentMinute}` : currentMinute} min
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => adjustMinute(1)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>+1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => adjustMinute(5)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>+5</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={() => adjustHour(-1)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>-1 hr</Text>
                      </TouchableOpacity>

                      <View style={styles.tuneDisplay}>
                        <Text style={styles.tuneDisplayText}>
                          {currentHour12} {isPM ? 'PM' : 'AM'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => adjustHour(1)}
                        style={styles.tuneBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.tuneBtnText}>+1 hr</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            ) : (
              /* Direct Numeric Keyboard Input Mode */
              <View style={styles.manualContainer}>
                <Text style={styles.manualHeading}>Type Time Directly</Text>
                <View style={styles.manualRow}>
                  <TextInput
                    style={styles.manualInput}
                    value={manualHour}
                    onChangeText={setManualHour}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={styles.manualColon}>:</Text>
                  <TextInput
                    style={styles.manualInput}
                    value={manualMinute}
                    onChangeText={setManualMinute}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                </View>
                <TouchableOpacity
                  onPress={handleManualApply}
                  style={styles.manualApplyBtn}
                >
                  <Text style={styles.manualApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons (Footer) */}
          <View style={styles.actionsFooter}>
            <TouchableOpacity
              onPress={toggleManualInput}
              style={styles.keyboardIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Switch input mode"
            >
              <Ionicons
                name={isManualInput ? 'time-outline' : 'keypad-outline'}
                size={22}
                color="#0288D1"
              />
            </TouchableOpacity>

            <View style={styles.footerRightBtns}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.footerBtn}
              >
                <Text style={styles.footerBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onConfirm(selectedDate)}
                style={styles.footerBtn}
              >
                <Text style={[styles.footerBtnText, styles.okBtnText]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 310,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  headerBanner: {
    backgroundColor: '#0288D1', // Cyan blue matching reference image
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeUnitBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 48,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 1,
  },
  timeTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  colonText: {
    fontSize: 44,
    fontWeight: '300',
    color: '#FFFFFF',
    marginHorizontal: 2,
    marginBottom: 4,
  },
  periodCol: {
    marginLeft: 14,
    justifyContent: 'space-between',
    height: 46,
  },
  periodBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  periodTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  contentBody: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  dialDisc: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: '#F3F4F6', // Light clean disc
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    position: 'absolute',
    left: RADIUS - 4,
    top: RADIUS - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0288D1',
    zIndex: 10,
  },
  pointerLine: {
    position: 'absolute',
    left: RADIUS,
    top: RADIUS - 1,
    height: 2,
    backgroundColor: '#0288D1',
    zIndex: 4,
    transformOrigin: 'left center',
  },
  pointerHead: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0288D1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  pointerHeadInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  pointerHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  numberBtn: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  numberBtnSelected: {
    backgroundColor: '#0288D1',
  },
  numberText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
  numberTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fineTuneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  tuneBtn: {
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tuneBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0288D1',
  },
  tuneDisplay: {
    paddingHorizontal: 8,
  },
  tuneDisplayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222222',
  },
  manualContainer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manualHeading: {
    fontSize: 14,
    color: '#555',
    marginBottom: 14,
    fontWeight: '600',
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualInput: {
    width: 58,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0288D1',
    textAlign: 'center',
    fontSize: 24,
    color: '#111',
    fontWeight: 'bold',
  },
  manualColon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  manualApplyBtn: {
    backgroundColor: '#0288D1',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  manualApplyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  actionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  keyboardIconBtn: {
    padding: 6,
  },
  footerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 6,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0288D1',
    letterSpacing: 0.5,
  },
  okBtnText: {
    color: '#0288D1',
  },
});
