import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Carrier } from '@/types';

interface CarrierIconProps {
  carrier: Carrier;
  size?: number;
}

/**
 * Stylized carrier logo component.
 * Each carrier gets a brand-evocative visual mark — not just a colored circle
 * with a letter, but a distinctive mini-logo that's recognizable at small sizes.
 *
 * Renders inside a circular container sized to the `size` prop (default 40).
 * Used across package list, shipment cards, detail screens, partner screens.
 */
const carrierBg: Record<Carrier, string> = {
  Amazon: '#232F3E',  // Amazon dark navy
  UPS: '#351C15',     // UPS brown
  USPS: '#004B87',    // USPS postal blue
  FedEx: '#FFFFFF',   // FedEx white (wordmark carries the color)
  Other: '#6B7F99',   // Slate gray
};

export default React.memo(function CarrierIcon({ carrier, size = 40 }: CarrierIconProps) {
  const inner = Math.round(size * 0.78);

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: carrierBg[carrier],
          borderWidth: carrier === 'FedEx' ? 1 : 0,
          borderColor: carrier === 'FedEx' ? '#D6E0EE' : 'transparent',
        },
      ]}
    >
      {carrier === 'Amazon' && <AmazonLogo size={inner} />}
      {carrier === 'UPS' && <UPSLogo size={inner} />}
      {carrier === 'USPS' && <USPSLogo size={inner} />}
      {carrier === 'FedEx' && <FedExLogo size={inner} />}
      {carrier === 'Other' && <OtherLogo size={inner} />}
    </View>
  );
});

// ─── Amazon ──────────────────────────────────────────────────────────────────
// Dark navy circle with "amazon" wordmark + iconic orange smile-arrow swoosh

function AmazonLogo({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.26);
  const swooshW = Math.round(size * 0.52);
  const swooshH = Math.round(size * 0.2);
  return (
    <View style={styles.center}>
      <Text
        style={{
          fontSize,
          fontWeight: '700' as const,
          color: '#FFFFFF',
          letterSpacing: -0.3,
          marginBottom: -1,
        }}
      >
        amazon
      </Text>
      {/* Smile arrow: curved arc with arrowhead on the right */}
      <View style={{ width: swooshW, height: swooshH, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: swooshW,
            height: swooshH,
            borderBottomLeftRadius: swooshH * 2,
            borderBottomRightRadius: swooshH * 2,
            borderWidth: 1.8,
            borderTopWidth: 0,
            borderColor: '#FF9900',
            borderStyle: 'solid' as const,
          }}
        />
        {/* Arrowhead */}
        <View
          style={{
            position: 'absolute' as const,
            right: -1,
            bottom: 1,
            width: Math.round(size * 0.1),
            height: Math.round(size * 0.1),
            borderRightWidth: 1.8,
            borderBottomWidth: 1.8,
            borderColor: '#FF9900',
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>
    </View>
  );
}

// ─── UPS ─────────────────────────────────────────────────────────────────────
// Brown circle with a gold shield shape containing "UPS"

function UPSLogo({ size }: { size: number }) {
  const shieldW = Math.round(size * 0.56);
  const shieldH = Math.round(size * 0.68);
  const fontSize = Math.round(size * 0.22);
  return (
    <View style={styles.center}>
      <View
        style={{
          width: shieldW,
          height: shieldH,
          backgroundColor: '#FFD400',
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderBottomLeftRadius: shieldW * 0.5,
          borderBottomRightRadius: shieldW * 0.5,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 2,
        }}
      >
        <Text
          style={{
            fontSize,
            fontWeight: '800' as const,
            color: '#351C15',
            letterSpacing: 0.5,
          }}
        >
          UPS
        </Text>
      </View>
    </View>
  );
}

// ─── USPS ────────────────────────────────────────────────────────────────────
// Postal blue circle with a stylized eagle-swoosh and "USPS" text

function USPSLogo({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.21);
  const eagleW = Math.round(size * 0.5);
  const eagleH = Math.round(size * 0.16);
  return (
    <View style={styles.center}>
      {/* Eagle head silhouette — angular wedge suggesting the USPS eagle */}
      <View style={{ width: eagleW, height: eagleH, alignItems: 'center', justifyContent: 'center', marginBottom: 1 }}>
        <View
          style={{
            width: eagleW,
            height: eagleH * 0.5,
            backgroundColor: '#FFFFFF',
            transform: [{ rotate: '-12deg' }, { skewX: '-15deg' }],
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: 'absolute' as const,
            bottom: 0,
            width: eagleW * 0.7,
            height: eagleH * 0.35,
            backgroundColor: '#FFFFFF',
            opacity: 0.7,
            transform: [{ rotate: '8deg' }, { skewX: '10deg' }],
            borderRadius: 1,
          }}
        />
      </View>
      <Text
        style={{
          fontSize,
          fontWeight: '800' as const,
          color: '#FFFFFF',
          letterSpacing: 0.8,
        }}
      >
        USPS
      </Text>
    </View>
  );
}

// ─── FedEx ───────────────────────────────────────────────────────────────────
// White circle with two-color wordmark: "Fed" in purple, "Ex" in orange
// The negative space between E and x creates the hidden arrow

function FedExLogo({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.28);
  return (
    <View style={[styles.center, { paddingHorizontal: 2 }]}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' }}>
        <Text
          style={{
            fontSize,
            fontWeight: '900' as const,
            color: '#4D148C',
            letterSpacing: -0.5,
          }}
        >
          Fed
        </Text>
        <Text
          style={{
            fontSize,
            fontWeight: '900' as const,
            color: '#FF6600',
            letterSpacing: -0.5,
          }}
        >
          Ex
        </Text>
      </View>
    </View>
  );
}

// ─── Other ───────────────────────────────────────────────────────────────────
// Slate circle with a simple package/box glyph

function OtherLogo({ size }: { size: number }) {
  const boxSize = Math.round(size * 0.42);
  const flap = Math.round(size * 0.21);
  return (
    <View style={styles.center}>
      <View
        style={{
          width: boxSize,
          height: boxSize,
          borderWidth: 1.6,
          borderColor: '#FFFFFF',
          borderRadius: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Top flap line */}
        <View
          style={{
            position: 'absolute' as const,
            top: -1,
            width: flap,
            height: 1.6,
            backgroundColor: '#FFFFFF',
          }}
        />
        {/* Tape line down the middle */}
        <View
          style={{
            width: 1.6,
            height: boxSize * 0.7,
            backgroundColor: '#FFFFFF',
            opacity: 0.6,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
