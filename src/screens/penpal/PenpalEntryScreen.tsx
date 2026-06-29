import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalEntry'>;

const ACCENT = '#4361EE';

export default function PenpalEntryScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Back arrow */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        {/* Page title */}
        <Text style={styles.pageTitle}>
          Purpose of <Text style={styles.pageTitleAccent}>Penpal Group</Text>
        </Text>

        {/* Block 1 — icon left, text right */}
        <View style={styles.rowBlock}>
          <View style={styles.iconBox}>
            <Image source={require('../../assets/pg1.png')} style={styles.iconImg} resizeMode="contain" />
          </View>
          <Text style={styles.blockText}>
            Slow down and rediscover the art of intentional connection. Whether through pixels or paper, the Penpal Club is a space for deep thoughts.
          </Text>
        </View>

        {/* Bullet 1 */}
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.
          </Text>
        </View>

        {/* Block 2 — text left, icon right */}
        <View style={[styles.rowBlock, styles.rowReversed]}>
          <View style={styles.iconBox}>
            <Image source={require('../../assets/pg2.png')} style={styles.iconImg} resizeMode="contain" />
          </View>
          <Text style={[styles.blockText, { flex: 1 }]}>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>

        {/* Pink card */}
        <View style={styles.pinkCard}>
          <Text style={styles.cardText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>

        {/* Block 3 — icon left, text right */}
        <View style={styles.rowBlock}>
          <View style={styles.iconBox}>
            <Image source={require('../../assets/pg3.png')} style={styles.iconImg} resizeMode="contain" />
          </View>
          <Text style={styles.blockText}>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>

        {/* Bullet 2 */}
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.
          </Text>
        </View>

        {/* Dark card */}
        <View style={styles.darkCard}>
          <Text style={styles.cardText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>

        {/* Block 4 — icon left, text right */}
        <View style={styles.rowBlock}>
          <View style={styles.iconBox}>
            <Image source={require('../../assets/pg4.png')} style={styles.iconImg} resizeMode="contain" />
          </View>
          <Text style={styles.blockText}>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>

        {/* Bullet 3 */}
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.
          </Text>
        </View>

      </ScrollView>

      {/* Continue button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => navigation.navigate('PenpalSetup')}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },

  backBtn: {
    marginBottom: 16,
  },
  backArrow: {
    fontSize: 19,
    color: Colors.text,
    fontFamily: 'Gilroy-SemiBold',
  },

  pageTitle: {
    fontSize: 24,
    fontFamily: 'Gilroy-Black',
    color: Colors.text,
    lineHeight: 32,
    marginBottom: 28,
  },
  pageTitleAccent: {
    color: ACCENT,
    fontFamily: 'Gilroy-Black',
  },

  rowBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  rowReversed: {
    flexDirection: 'row-reverse',
  },
  iconBox: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconImg: {
    width: 56,
    height: 56,
  },
  blockText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
    fontFamily: 'Gilroy-Regular',
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 13,
    color: Colors.text,
    marginRight: 8,
    lineHeight: 19,
    fontFamily: 'Gilroy-Regular',
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
    fontFamily: 'Gilroy-Regular',
  },

  pinkCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  darkCard: {
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardText: {
    fontSize: 12,
    color: Colors.white,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Gilroy-Medium',
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  continueBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: 'Gilroy-SemiBold',
  },
});
