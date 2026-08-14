/**
 * AdBanner — Disabled in HOA-provisioned model.
 * All users have full access (isAdFree = true), so this component returns null.
 */
import React from 'react';
import { View } from 'react-native';

export default React.memo(function AdBanner() {
  // HOA-provisioned model — no ads, all users have full access.
  return null;
});
