import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../utils/colors';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export default function AppAlert({ visible, title, message, buttons, onClose }: Props) {
  const btns: AlertButton[] = buttons?.length ? buttons : [{ text: 'OK', style: 'default' }];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>
          <View style={styles.divider} />
          <View style={[styles.btnRow, btns.length === 1 && styles.btnRowSingle]}>
            {btns.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btns.length > 1 && i < btns.length - 1 && styles.btnBorderRight,
                ]}
                activeOpacity={0.7}
                onPress={() => { btn.onPress?.(); onClose(); }}
              >
                <Text style={[
                  styles.btnText,
                  btn.style === 'cancel' && styles.btnTextCancel,
                  btn.style === 'destructive' && styles.btnTextDestructive,
                  (btn.style === 'default' || !btn.style) && btns.length === 1 && styles.btnTextPrimary,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  body: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  btnRow: {
    flexDirection: 'row',
  },
  btnRowSingle: {},
  btn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnBorderRight: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  btnTextPrimary: {
    color: Colors.primary,
    fontWeight: '700',
  },
  btnTextCancel: {
    color: Colors.textSecondary,
  },
  btnTextDestructive: {
    color: Colors.error,
    fontWeight: '600',
  },
});
