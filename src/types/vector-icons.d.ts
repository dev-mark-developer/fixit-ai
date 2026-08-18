declare module 'react-native-vector-icons/Ionicons' {
  import * as React from 'react';
  import { TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  const Icon: React.ComponentClass<IconProps>;
  export default Icon;
}
