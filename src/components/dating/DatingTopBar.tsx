import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../utils/colors';
import { useModuleStatus } from '../../store/ModuleStatusContext';

/**
 * Shared header row for the main dating screens (Discover / Matches / Chats /
 * My Profile): hamburger menu on the left, info + notification bell on the
 * right — matching the Figma. Accent follows the dating path (spiritual
 * purple/lime vs. non-spiritual pink).
 */
export default function DatingTopBar() {
  const navigation = useNavigation<any>();
  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const ringColor = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;
  const [tipsVisible, setTipsVisible] = useState(false);

  const openNotifications = () => {
    // Root stack (two levels up from the drawer screens) hosts Notifications
    let nav: any = navigation;
    while (nav?.getParent?.()) nav = nav.getParent();
    nav?.navigate('Notifications');
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => (navigation as any).openDrawer?.()}
        hitSlop={8}
      >
        <Icon name="menu" size={28} color={accent} />
      </TouchableOpacity>

      <View style={styles.right}>
        <TouchableOpacity onPress={() => setTipsVisible(true)} hitSlop={8}>
          <Icon name="information-circle-outline" size={26} color={ringColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openNotifications} hitSlop={8}>
          <Icon name="notifications-outline" size={25} color={accent} />
        </TouchableOpacity>
      </View>

      {/* Dating Tips & Guidelines modal (info button) */}
      <Modal
        visible={tipsVisible}
        animationType="slide"
        onRequestClose={() => setTipsVisible(false)}
      >
        <View style={styles.tipsRoot}>
          <View style={styles.tipsHeader}>
            <Text style={styles.tipsTitle}>Dating Tips and Guidelines</Text>
            <TouchableOpacity onPress={() => setTipsVisible(false)} hitSlop={8}>
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.tipsScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.tipsBody}>{TIPS_TEXT}</Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.tipsDoneBtn, { backgroundColor: accent }]}
            onPress={() => setTipsVisible(false)}
          >
            <Text style={styles.tipsDoneText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const TIPS_TEXT = `Stay Safe While Dating

1. Keep conversations in the app
Get to know the other person inside the app before sharing other contact details.

2. Protect your personal information
Never share financial information, your home address, or other sensitive details with someone you just met.

3. Take your time
There is no rush. Meaningful connections grow at their own pace.

4. Meet in public places
When you decide to meet in person, choose a busy public place and tell a friend where you are going.

5. Report and block
If someone makes you uncomfortable, use the report and block features — our team reviews every report.

6. Be yourself
Authentic profiles make authentic connections. Use recent photos and honest information.

7. Respect others
Treat every member with kindness and respect. Harassment or abusive behaviour leads to account removal.`;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  tipsRoot: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  tipsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tipsTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  tipsScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  tipsBody: { fontSize: 14, color: Colors.text, lineHeight: 22, paddingBottom: 24 },
  tipsDoneBtn: {
    margin: 20, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  tipsDoneText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
