import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ChatAttachment } from '../../api/dating';
import RemoteImage from '../common/RemoteImage';
import { resolveMediaUrl } from '../../utils/imageUrl';
import { Colors } from '../../utils/colors';

interface Props {
  visible: boolean;
  attachments: ChatAttachment[];
  initialIndex: number;
  accent: string;
  onClose: () => void;
}

/** Full-screen, swipeable viewer for a message's photos and videos. */
export default function AttachmentViewer({ visible, attachments, initialIndex, accent, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => { setIndex(initialIndex); }, [initialIndex, visible]);

  const openExternally = useCallback(async (attachment: ChatAttachment) => {
    const url = resolveMediaUrl(attachment.fileUrl);
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open', 'No app on this device can play that file.');
    }
  }, []);

  if (attachments.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Icon name="close" size={26} color={Colors.white} />
          </TouchableOpacity>
          {attachments.length > 1 && (
            <Text style={styles.counter}>{index + 1} / {attachments.length}</Text>
          )}
        </View>

        <FlatList
          data={attachments}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          keyExtractor={(item, i) => `${item.fileUrl}-${i}`}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height: height * 0.75 }]}>
              {item.fileType === 'Video' ? (
                <TouchableOpacity
                  style={styles.videoCta}
                  onPress={() => openExternally(item)}
                  activeOpacity={0.85}
                >
                  <Icon name="play-circle" size={72} color={Colors.white} />
                  <Text style={styles.videoText}>Play video</Text>
                  {!!item.fileName && (
                    <Text style={styles.videoName} numberOfLines={1}>{item.fileName}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <RemoteImage
                  uri={item.fileUrl}
                  style={{ width, height: height * 0.75 }}
                  resizeMode="contain"
                  indicatorColor={accent}
                  indicatorSize="large"
                  fallback={
                    <View style={styles.broken}>
                      <Icon name="image-outline" size={48} color={Colors.textMuted} />
                      <Text style={styles.brokenText}>This file is no longer available</Text>
                    </View>
                  }
                />
              )}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  counter: { color: Colors.white, fontSize: 14, fontWeight: '600' },

  page: { alignItems: 'center', justifyContent: 'center' },
  videoCta: { alignItems: 'center', gap: 10 },
  videoText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  videoName: { color: 'rgba(255,255,255,0.65)', fontSize: 12, maxWidth: 260 },

  broken: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  brokenText: { color: Colors.textMuted, fontSize: 14 },
});
