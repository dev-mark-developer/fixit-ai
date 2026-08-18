import React, { useState } from 'react';
import {
  View,
  Image,
  ImageBackground,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  ImageResizeMode,
} from 'react-native';
import { Colors } from '../../utils/colors';
import { resolveImageUrl } from '../../utils/imageUrl';

interface BaseProps {
  /** Raw URL from the API — relative paths are resolved against the API host. */
  uri?: string | null;
  /** Spinner colour; pick one that reads against the surface behind it. */
  indicatorColor?: string;
  indicatorSize?: 'small' | 'large';
  resizeMode?: ImageResizeMode;
}

interface RemoteImageProps extends BaseProps {
  style?: StyleProp<ImageStyle | ViewStyle>;
  /** Rendered when the URL is missing OR the download fails (e.g. a 404). */
  fallback?: React.ReactNode;
}

/**
 * <Image> that resolves relative API URLs and shows a spinner while the
 * bitmap downloads. When the URL is missing or the file fails to load it
 * renders `fallback` (or nothing), so a dead link never leaves a blank box.
 */
export default function RemoteImage({
  uri,
  style,
  resizeMode,
  indicatorColor = Colors.textMuted,
  indicatorSize = 'small',
  fallback,
}: RemoteImageProps) {
  const source = resolveImageUrl(uri);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (!source || failed) return <>{fallback ?? null}</>;

  return (
    <View style={[styles.container, style as StyleProp<ViewStyle>]}>
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <ActivityIndicator color={indicatorColor} size={indicatorSize} />
        </View>
      )}
      <Image
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
    </View>
  );
}

interface RemoteImageBackgroundProps extends BaseProps {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
}

/**
 * <ImageBackground> variant — same resolve + spinner. The spinner sits behind
 * `children` so card overlays (names, buttons) stay visible while loading.
 */
export function RemoteImageBackground({
  uri,
  style,
  imageStyle,
  resizeMode,
  indicatorColor = Colors.textMuted,
  indicatorSize = 'small',
  children,
}: RemoteImageBackgroundProps) {
  const source = resolveImageUrl(uri);
  const [loading, setLoading] = useState(true);

  return (
    <ImageBackground
      source={source ? { uri: source } : undefined}
      style={style}
      imageStyle={imageStyle}
      resizeMode={resizeMode}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => setLoading(false)}
    >
      {!!source && loading && (
        <View
          style={[StyleSheet.absoluteFill, styles.placeholder, imageStyle as StyleProp<ViewStyle>]}
          pointerEvents="none"
        >
          <ActivityIndicator color={indicatorColor} size={indicatorSize} />
        </View>
      )}
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
});
