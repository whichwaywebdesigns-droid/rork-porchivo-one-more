/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    PORCHIVO — USER-FACING COPY                          ║
 * ║                                                                          ║
 * ║  Every headline, subtitle, button label, and error message that users   ║
 * ║  see lives here. Change text in one place — no need to hunt through     ║
 * ║  individual screen files.                                                ║
 * ║                                                                          ║
 * ║  HOW TO USE:                                                             ║
 * ║    Find the text you want to change below, edit the string, save.       ║
 * ║    The screen will automatically show the new text.                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export const COPY = {

  // ── APP-WIDE ──────────────────────────────────────────────────────────────

  appName: 'Porchivo',
  appTagline: 'Package risk intelligence for your porch.',
  // Shown in places like the browser tab title and push notification sender name
  appShortTagline: 'Know before it\'s too late.',


  // ── WELCOME SCREEN ────────────────────────────────────────────────────────

  welcome: {
    headline: 'Know before\nit\'s too late.',
    // Shown below the headline — keep this under 60 characters
    kicker: 'Package risk intelligence',
    subtitle: 'Real-time porch risk scores and theft alerts for every delivery.',
    // The main button on the welcome screen
    primaryCta: 'See how it works',
    // Shown below the main button
    secondaryCta: 'I already have an account',
    // The "7 days free" trial nudge shown near the button
    trialNudge: '7 days free · No commitment',
    // Social proof line shown under stats
    socialProofLine: 'Trusted on 12,000+ porches across the US',
  },


  // ── INTRO / ONBOARDING SLIDES ─────────────────────────────────────────────

  intro: {
    slide1: {
      headline: '119M packages stolen every year.',
      subheadline: '1 in 5 deliveries never makes it inside.',
      body: 'Porch theft isn\'t rare — it\'s a $19 billion problem that gets worse every year.',
    },
    slide2: {
      headline: 'Your porch, scored in real time.',
      subheadline: 'Not guesses. Actual risk intelligence.',
      body: 'Porchivo weighs neighborhood alerts, delivery timing, and your protection setup to score every package before it lands.',
    },
    slide3: {
      headline: 'Act before theft happens.',
      subheadline: 'Not after.',
      body: 'Get notified when risk is rising. Activate Theft Shield. Assign a Porch Partner. Stay ahead of it.',
    },
    // Button shown at the end of the slides
    finalCta: 'Get started — it\'s free',
    skipLabel: 'Skip intro',
  },


  // ── LOGIN / SIGN UP ───────────────────────────────────────────────────────

  auth: {
    signInHeadline: 'Welcome back',
    signUpHeadline: 'Create your account',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    signInButton: 'Sign in',
    signUpButton: 'Create account',
    forgotPassword: 'Forgot password?',
    switchToSignUp: 'Don\'t have an account? Sign up',
    switchToSignIn: 'Already have an account? Sign in',
    // Shown while auth is loading
    loadingMessage: 'Signing you in…',
    // Error messages — edit these if users report confusing auth errors
    errorInvalidCredentials: 'Incorrect email or password. Please try again.',
    errorEmailInUse: 'An account with this email already exists. Try signing in instead.',
    errorWeakPassword: 'Password must be at least 8 characters.',
    errorGeneric: 'Something went wrong. Please try again.',
  },


  // ── ADDRESS / LOCATION SETUP ──────────────────────────────────────────────

  address: {
    headline: 'Where\'s your porch?',
    subtitle: 'We use your address to pull neighborhood alerts and calibrate your risk score.',
    placeholder: 'Enter your home address',
    confirmButton: 'Use this address',
    skipButton: 'Skip for now',
    // Shown when location permission is requested
    locationPermissionTitle: 'Allow location access',
    locationPermissionBody: 'Porchivo uses your location to show nearby alerts and improve your risk score. We never share your exact location.',
    locationPermissionAllow: 'Allow location access',
    locationPermissionSkip: 'Skip — I\'ll enter manually',
  },


  // ── HOME SCREEN ───────────────────────────────────────────────────────────

  home: {
    // Tab title
    tabLabel: 'Home',
    // Section headers
    packagesHeader: 'Your packages',
    nearbyHeader: 'Nearby deliveries',
    // Empty state when user has no packages
    emptyPackagesHeadline: 'No packages yet',
    emptyPackagesBody: 'Add a tracking number to start monitoring your deliveries.',
    emptyPackagesCta: 'Add a package',
    // Pull-to-refresh label (not always visible but good to have)
    refreshingLabel: 'Updating…',
    // Greeting shown at top of home screen (user name is appended)
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
  },


  // ── PACKAGE RISK SCREEN ───────────────────────────────────────────────────

  risk: {
    // Screen title
    screenTitle: 'Porch Risk',
    // Risk level labels
    levelLow: 'Low Risk',
    levelMedium: 'Elevated Risk',
    levelHigh: 'High Risk',
    // Shown under the risk score number
    scoreSubLabel: 'today\'s porch risk score',
    // Section headers
    factorsHeader: 'What\'s driving your score',
    historyHeader: 'This week',
    // Empty state when no package is inbound
    noPackageHeadline: 'No inbound packages',
    noPackageBody: 'Your risk score will appear once you have a package on the way.',
    // Premium upsell card on risk screen
    upsellHeadline: 'Unlock Theft Shield',
    upsellSubtitle: 'Get real-time alerts, geofenced notifications, and priority routing.',
    upsellCta: 'Start 7-day free trial',
  },


  // ── PAYWALL / UPGRADE SCREEN ──────────────────────────────────────────────

  paywall: {
    headline: 'Protect Every Delivery',
    // Shown under the headline
    subheadline: 'Get real-time porch risk scores, instant theft alerts, and unlimited package tracking.',
    // The main upgrade button label
    primaryCta: 'Start Free Trial',
    // Shown under the CTA button
    ctaSubtext: '7 days free · Cancel anytime',
    // Restore purchases link
    restoreLabel: 'Restore purchases',
    // Legal fine print (customize if App Store reviewer asks)
    legalLine: 'Subscriptions auto-renew. Cancel anytime in Settings.',
    // Plan card labels
    planMonthlyBadge: '',
    planAnnualBadge: 'Best Value',
    // Feature bullet points shown on the paywall
    // Keep these outcome-focused (what the user GETS, not what the feature IS)
    bullets: [
      'Track unlimited packages — no cap',
      'Real-time porch risk score for every delivery',
      'Theft Shield alerts when risk spikes',
      'Neighborhood theft alerts before they reach your door',
    ],
    // Shown at the bottom — addresses the main objection (price)
    objectionAnchor: 'Less than the cost of one stolen package.',
    // Shown when the user already has premium
    alreadyPremiumMessage: 'You\'re already on Porchivo Premium. Thank you!',
    // Error shown when a purchase fails
    purchaseError: 'Purchase could not be completed. Please try again or restore your purchases.',
    // Success message after purchase
    purchaseSuccess: 'Welcome to Porchivo Premium!',
  },


  // ── ADD PACKAGE SCREEN ────────────────────────────────────────────────────

  addPackage: {
    screenTitle: 'Add a Package',
    trackingNumberPlaceholder: 'Tracking number',
    packageNamePlaceholder: 'Package name (optional)',
    submitButton: 'Track this package',
    // Shown when free user hits the 5-package limit
    limitReachedHeadline: 'Package limit reached',
    limitReachedBody: 'Free accounts can track up to 5 packages. Upgrade to track unlimited deliveries.',
    limitReachedCta: 'Upgrade to Premium',
    // Shown when tracking number is invalid
    invalidTrackingError: 'That tracking number doesn\'t look right. Double-check it and try again.',
    // Shown while looking up the tracking number
    lookingUpLabel: 'Looking up your package…',
  },


  // ── ALERTS ────────────────────────────────────────────────────────────────

  alerts: {
    screenTitle: 'Alerts',
    tabLabel: 'Alerts',
    emptyHeadline: 'All clear on your block',
    emptyBody: 'No porch theft alerts in your area right now. We\'ll notify you if anything changes.',
    // Report alert button
    reportCta: 'Report an incident',
    // Shown when loading alerts
    loadingLabel: 'Checking your neighborhood…',
  },


  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  notifications: {
    // Permission request screen
    permissionTitle: 'Stay ahead of theft',
    permissionBody: 'Get instant alerts when your package risk rises, a delivery is inbound, or there\'s suspicious activity near your porch.',
    permissionAllowCta: 'Turn on notifications',
    permissionSkipCta: 'Not now',
    // Push notification content (shown on lock screen)
    ofdTitle: 'Package on the way',
    ofdBody: 'Your {carrier} package is out for delivery today.',
    highRiskTitle: '⚠️ High porch risk today',
    highRiskBody: 'Risk score is {score}/100 — consider activating Theft Shield.',
    deliveredTitle: '📦 Package delivered',
    deliveredBody: '{name} has been delivered. Bring it inside soon.',
  },


  // ── PROFILE / SETTINGS ────────────────────────────────────────────────────

  profile: {
    screenTitle: 'Profile',
    tabLabel: 'Profile',
    // Section headers
    accountSection: 'Account',
    subscriptionSection: 'Subscription',
    securitySection: 'Security & Privacy',
    supportSection: 'Support',
    // Button labels
    editProfileButton: 'Edit profile',
    manageSubscriptionButton: 'Manage subscription',
    notificationSettingsButton: 'Notification settings',
    privacyPolicyButton: 'Privacy policy',
    termsButton: 'Terms of service',
    helpButton: 'Help & Support',
    signOutButton: 'Sign out',
    deleteAccountButton: 'Delete account',
    // Delete account confirmation
    deleteAccountConfirmTitle: 'Delete your account?',
    deleteAccountConfirmBody: 'This will permanently delete all your data, packages, and alerts. This cannot be undone.',
    deleteAccountConfirmCta: 'Yes, delete my account',
    deleteAccountCancelCta: 'Cancel',
  },


  // ── EMPTY / ERROR / LOADING STATES ───────────────────────────────────────

  states: {
    // Generic loading
    genericLoading: 'Loading…',
    // Generic error with retry
    genericErrorHeadline: 'Something went wrong',
    genericErrorBody: 'We hit a snag. Pull down to refresh or try again in a moment.',
    genericErrorCta: 'Try again',
    // No internet connection
    offlineHeadline: 'No connection',
    offlineBody: 'Check your internet connection and try again.',
    // Session expired / signed out
    sessionExpiredTitle: 'Session expired',
    sessionExpiredBody: 'Please sign in again to continue.',
    sessionExpiredCta: 'Sign in',
  },

} as const;
