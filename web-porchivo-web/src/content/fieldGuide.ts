/**
 * Porchivo Field Guide — hosted web content.
 *
 * Mirrors the in-app "Porchivo Field Guide" (expo/constants/fieldGuide.ts) so the
 * manual is browser-accessible and linkable from emails at porchivo.com/guide.
 * Numbers/stats wrapped in **double asterisks** render bold + brand-orange to
 * anchor key facts.
 */

export type ManualBlock =
  | { type: "paragraph"; text: string }
  | { type: "tip"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface ManualSection {
  /** Stable id used as the URL anchor (#id). */
  id: string;
  title: string;
  teaser: string;
  blocks: ManualBlock[];
}

export const FIELD_GUIDE: ManualSection[] = [
  {
    id: "welcome",
    title: "Welcome to Porchivo",
    teaser: "What Porchivo is and why your block needs it.",
    blocks: [
      { type: "paragraph", text: "Porch piracy hits roughly **1 in 3** Americans every year, and a stolen package is gone in under **40 seconds**. Porchivo turns your street into a connected safety network so deliveries are watched, logged, and protected." },
      { type: "paragraph", text: "This guide walks you through every feature — from tracking a single box to coordinating an entire neighborhood. Each section takes about a minute to read." },
      { type: "tip", text: "You only need to read what is relevant to you. Use the index to jump straight to the parts you care about." },
    ],
  },
  {
    id: "dashboard",
    title: "Your Porch Dashboard",
    teaser: "Everything happening on your porch, at a glance.",
    blocks: [
      { type: "paragraph", text: "The Home tab is your command center. It surfaces active deliveries, recent block activity, and your current safety status the moment you open the app." },
      { type: "paragraph", text: "Cards are ordered by urgency: anything arriving today floats to the top, while resolved items settle below. Pull down to refresh at any time." },
      { type: "tip", text: "Tap any card to drill into its full detail view — tracking history, delivery window, and neighbor notes." },
    ],
  },
  {
    id: "tracking",
    title: "Tracking Deliveries",
    teaser: "Real-time status from carrier to doorstep.",
    blocks: [
      { type: "paragraph", text: "Porchivo follows your package across all major carriers and shows a live status from label-created to delivered. Statuses update automatically, usually within **15** minutes of a carrier scan." },
      { type: "table", headers: ["Status", "What it means"], rows: [
        ["In Transit", "On the way, not yet local"],
        ["Out for Delivery", "On a truck near you today"],
        ["Delivered", "Marked dropped at your address"],
        ["Exception", "Delay or issue — tap for detail"],
      ] },
      { type: "tip", text: "A package stuck on \"Out for Delivery\" past 8pm is worth a quick check — carriers occasionally mark items prematurely." },
    ],
  },
  {
    id: "add-package",
    title: "Adding a Package",
    teaser: "Two taps to start watching any delivery.",
    blocks: [
      { type: "paragraph", text: "Tap the **+** button, paste a tracking number, and Porchivo auto-detects the carrier. Give it an optional nickname like \"Mom's gift\" so it is easy to spot." },
      { type: "paragraph", text: "You can add up to **20** active packages on the free plan, and unlimited on Premium. Delivered items archive automatically after **7** days." },
      { type: "tip", text: "No tracking number yet? Add the package by expected date and update the number later — tracking backfills automatically." },
    ],
  },
  {
    id: "windows",
    title: "Delivery Windows",
    teaser: "Tell neighbors when to keep an eye out.",
    blocks: [
      { type: "paragraph", text: "Set a window for when you expect a delivery so the right neighbors get a heads-up at the right time — not a flood of all-day pings." },
      { type: "table", headers: ["Window", "Best for"], rows: [
        ["Morning", "8am – 12pm drops"],
        ["Afternoon", "12pm – 5pm drops"],
        ["Evening", "5pm – 9pm drops"],
        ["All Day", "Unknown timing"],
      ] },
      { type: "tip", text: "Tighter windows mean more attentive neighbors. Reserve \"All Day\" for when you truly have no estimate." },
    ],
  },
  {
    id: "watch",
    title: "Neighborhood Watch",
    teaser: "See your block in real time. Thieves think twice.",
    blocks: [
      { type: "paragraph", text: "The Neighborhood view shows anonymized delivery and alert activity on your block. When neighbors are visibly aware, opportunistic theft drops sharply." },
      { type: "paragraph", text: "Blocks with **5** or more active Porchivo households report meaningfully fewer incidents than isolated homes." },
      { type: "tip", text: "Privacy first: neighbors never see your address or contents — only that protected activity is happening nearby." },
    ],
  },
  {
    id: "partners",
    title: "Porch Partners",
    teaser: "Trusted neighbors hold packages when you are away.",
    blocks: [
      { type: "paragraph", text: "A Porch Partner is a verified neighbor who can accept and safely hold a delivery for you. No more boxes sitting unattended for hours while you are out." },
      { type: "paragraph", text: "Invite someone you trust, or get matched with a verified partner nearby. You stay in control of who can hold for you." },
      { type: "tip", text: "Set a default partner so eligible deliveries route to them automatically — handy during a vacation week." },
    ],
  },
  {
    id: "earn",
    title: "Becoming a Partner & Earning",
    teaser: "Be the trusted neighbor — and get paid for it.",
    blocks: [
      { type: "paragraph", text: "Verified Porch Partners earn **$5–25** per hold on a fully flexible schedule. Active partners make up to **$180** a month just by being home and reliable." },
      { type: "table", headers: ["Hold type", "Typical pay"], rows: [
        ["Standard (under 24h)", "$5 – 8"],
        ["Overnight", "$10 – 15"],
        ["Multi-day / fragile", "$15 – 25"],
      ] },
      { type: "tip", text: "Complete identity verification before your first hold — it unlocks payouts and boosts your match priority." },
    ],
  },
  {
    id: "alerts",
    title: "Instant Alerts",
    teaser: "One tap warns the whole block.",
    blocks: [
      { type: "paragraph", text: "See something suspicious? Send a block alert in one tap. Nearby neighbors are notified instantly so everyone can keep watch." },
      { type: "paragraph", text: "Most alerts reach neighbors within **10** seconds. False alarms can be cleared just as fast to keep the feed trustworthy." },
      { type: "tip", text: "Add a short note and direction (\"white van, heading east\") so neighbors know exactly what to look for." },
    ],
  },
  {
    id: "safety-score",
    title: "Block Safety Score",
    teaser: "A living measure of how protected your street is.",
    blocks: [
      { type: "paragraph", text: "Your Block Safety Score blends participation, alert response time, and partner coverage into a single number from **0** to **100**. Higher is safer." },
      { type: "table", headers: ["Score", "Meaning"], rows: [
        ["80 – 100", "Strong, well-covered block"],
        ["50 – 79", "Good — room to grow"],
        ["Below 50", "Vulnerable — invite neighbors"],
      ] },
      { type: "tip", text: "The fastest way to raise your score is inviting neighbors. Each active household can lift a block by several points." },
    ],
  },
  {
    id: "premium",
    title: "Premium & Billing",
    teaser: "What Premium unlocks and how billing works.",
    blocks: [
      { type: "paragraph", text: "Premium removes the **20**-package limit, unlocks unlimited delivery windows, priority partner matching, and advanced alert filters." },
      { type: "paragraph", text: "Manage or cancel anytime from Profile → Manage Plan. Cancellation keeps your benefits active until the end of the paid period." },
      { type: "tip", text: "Switched phones or reinstalled? Use \"Restore Purchases\" on the billing screen to instantly recover your plan." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Your Data",
    teaser: "What we collect, and what we never share.",
    blocks: [
      { type: "paragraph", text: "Porchivo is built privacy-first. Your address, package contents, and tracking numbers are never shown to other neighbors — they only see anonymized activity signals." },
      { type: "paragraph", text: "Location is used only to connect you with your block. You can revoke location access at any time in your device settings without losing your account." },
      { type: "tip", text: "Want a full copy of your data, or a deletion? Request it from Profile → Privacy. We process requests within **30** days." },
    ],
  },
  {
    id: "notifications",
    title: "Notifications Setup",
    teaser: "Get the right pings — and silence the rest.",
    blocks: [
      { type: "paragraph", text: "Enable notifications so you never miss a delivery update or a block alert. You can fine-tune exactly which events ping you in Profile → Notifications." },
      { type: "table", headers: ["Type", "Recommended"], rows: [
        ["Delivery updates", "On"],
        ["Block alerts", "On"],
        ["Partner requests", "On"],
        ["Tips & news", "Optional"],
      ] },
      { type: "tip", text: "Set quiet hours to mute non-urgent pings overnight — critical block alerts still come through." },
    ],
  },
  {
    id: "support",
    title: "Help & Support",
    teaser: "Stuck? Here is how to reach a human.",
    blocks: [
      { type: "paragraph", text: "Most questions are answered right here in the Field Guide. For anything else, our support team typically replies within **24** hours." },
      { type: "paragraph", text: "Reach us from Profile → Help, or email support@porchivo.com. Include your device and a short description and we will sort it fast." },
      { type: "tip", text: "Found a bug or have a feature idea? Send it our way — neighbor feedback shapes nearly every Porchivo update." },
    ],
  },
];
