import React from 'react';
import {
  ScrollView, KeyboardAvoidingView, Platform, ScrollViewProps, StyleSheet,
} from 'react-native';

interface Props extends ScrollViewProps {
  children: React.ReactNode;
  extraHeight?: number;
}

export default function KeyboardAwareScrollView({
  children, contentContainerStyle, extraHeight = 80, style, ...rest
}: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.flex, style]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.grow, contentContainerStyle, { paddingBottom: extraHeight }]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
