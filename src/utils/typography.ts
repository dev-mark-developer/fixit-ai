/**
 * Poppins font family constants.
 *
 * Font files must be placed in assets/fonts/ and linked via
 * `npx react-native-asset` (or `npx react-native link` for older RN).
 *
 * Required files (download from Google Fonts → Poppins):
 *   Poppins-Regular.ttf
 *   Poppins-Medium.ttf
 *   Poppins-SemiBold.ttf
 *   Poppins-Bold.ttf
 *   Poppins-ExtraBold.ttf
 *   Poppins-Italic.ttf
 *   Poppins-MediumItalic.ttf
 */
export const Fonts = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
  extraBold: 'Poppins-ExtraBold',
  italic: 'Poppins-Italic',
  mediumItalic: 'Poppins-MediumItalic',
} as const;

export type FontWeight = keyof typeof Fonts;
