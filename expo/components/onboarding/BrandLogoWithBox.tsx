import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

interface BrandLogoWithBoxProps {
  /** Width/height of the foreground logo mark in points. */
  logoSize: number;
  /** How much the box extends behind the logo. 1.6 = box is ~1.6x the logo width. */
  boxScale?: number;
  /** Vertical offset of the box relative to the logo center; positive pushes it down. */
  boxOffsetY?: number;
  testID?: string;
}

const BOX_ASSET = require('@/assets/images/delivery_box_cardboard.png');
const LOGO_ASSET = require('@/assets/images/porchivo-logo.png');

/**
 * Porchivo mark underlaid by a cubic cardboard delivery box.
 * The box sits behind the logo so the mark reads as a stamped seal on a package.
 */
export default function BrandLogoWithBox({
  logoSize,
  boxScale = 1.65,
  boxOffsetY = logoSize * 0.06,
  testID,
}: BrandLogoWithBoxProps) {
  const boxWidth = logoSize * boxScale;
  const boxHeight = boxWidth * 0.874; // source image is 764x668 (~0.874:1)

  return (
    <View
      style={[
        styles.container,
        { width: boxWidth, height: boxHeight },
      ]}
      testID={testID}
    >
      <Image
        source={BOX_ASSET}
        style={[
          styles.box,
          {
            width: boxWidth,
            height: boxHeight,
            top: (logoSize - boxHeight) / 2 + boxOffsetY,
          },
        ]}
        resizeMode="contain"
      />
      <Image
        source={LOGO_ASSET}
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
            borderRadius: logoSize * 0.24,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    position: 'absolute',
    opacity: 0.95,
  },
  logo: {
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
});
