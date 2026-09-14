import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../utils/colors';

interface Props extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  secureToggle?: boolean;
  containerStyle?: ViewStyle;
  /**
   * The counter appears automatically whenever `maxLength` is set, which is
   * right for a bio or a report reason but noise on a short field — QA flagged
   * it on the Login and Forgot Password email inputs, where `maxLength` is
   * only a sanity cap the user never needs to see. Pass false there.
   */
  showCounter?: boolean;
}

export default function AppInput({
  label, required, error, hint, secureToggle, containerStyle, secureTextEntry, maxLength, value,
  showCounter = true, ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const charCount = value ? String(value).length : 0;
  const nearLimit = maxLength !== undefined && charCount >= maxLength * 0.85;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        {showCounter && maxLength !== undefined && (
          <Text style={[styles.counter, nearLimit && styles.counterNear]}>
            {charCount}/{maxLength}
          </Text>
        )}
      </View>
      <View style={[styles.inputWrapper, !!error && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureToggle ? !visible : secureTextEntry}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.toggle}>
            <Icon
              name={visible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={visible ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  required: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
  counter: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  counterNear: {
    color: Colors.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: Colors.text,
  },
  toggle: {
    paddingLeft: 8,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.error,
  },
  hintText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
