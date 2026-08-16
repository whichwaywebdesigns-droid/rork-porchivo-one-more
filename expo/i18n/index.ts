/**
 * Porchivo — i18n initialization (Expo / React Native).
 *
 * Uses i18next + react-i18next with a custom AsyncStorage-backed language
 * detector. On first launch (no saved preference), the device's system
 * language is auto-detected via expo-localization and used as the default.
 * Subsequent launches restore the user's saved preference.
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t, i18n } = useTranslation();
 *   i18n.changeLanguage('es');
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectSystemLanguage,
  isRTL as checkIsRTL,
} from './languages';

/** AsyncStorage key for the persisted language preference. */
export const LANGUAGE_STORAGE_KEY = 'porchivo.language';
/** Key set to true after the first language resolution so we never override a user's choice. */
const LANGUAGE_INITIALIZED_KEY = 'porchivo.language_initialized';

/**
 * Resolve the initial language on app start.
 *
 * Priority:
 * 1. User's saved preference (AsyncStorage) — if it exists, always use it.
 * 2. Device system language (expo-localization) — only on first launch.
 * 3. DEFAULT_LANGUAGE ('en') — fallback if detection fails.
 *
 * @returns The resolved language code and whether it came from system detection.
 */
export async function resolveInitialLanguage(): Promise<{
  code: string;
  fromSystem: boolean;
}> {
  // Check if the user has already chosen a language.
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved) {
    return { code: saved, fromSystem: false };
  }

  // First launch — detect the device's system language.
  const detected = detectSystemLanguage();
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, detected);
  await AsyncStorage.setItem(LANGUAGE_INITIALIZED_KEY, 'true');
  return { code: detected, fromSystem: true };
}

/**
 * Change the app language and persist the choice.
 * Once the user manually selects a language, the system-detection
 * flag is set so we never override their preference on future launches.
 */
export async function changeLanguage(code: string): Promise<void> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  await AsyncStorage.setItem(LANGUAGE_INITIALIZED_KEY, 'true');
}

// ── Translation resources ───────────────────────────────────────────────────
// Minimal key set covering app-level chrome. Additional keys are added per
// screen as translations are wired up. Missing keys fall back to English.

const en = {
  'app.name': 'Porchivo',
  'app.tagline': 'Package risk intelligence for your porch.',

  'tab.home': 'Home',
  'tab.deliveries': 'Deliveries',
  'tab.porchPartner': 'Porch Partner',
  'tab.payments': 'Payments',
  'tab.requests': 'Requests',
  'tab.more': 'More',
  'tab.account': 'Account',

  'profile.editProfile': 'Edit profile',
  'profile.inviteFriends': 'Invite Friends',
  'profile.joinCommunity': 'Join Your Community',
  'profile.signOut': 'Sign out',
  'profile.settings': 'Settings',

  'settings.title': 'Settings',
  'settings.appearance': 'APPEARANCE',
  'settings.language': 'LANGUAGE',
  'settings.languageDescription':
    'Choose your preferred language. Your selection is saved on this device.',
  'settings.systemDefault': 'System Default',
  'settings.version': 'App version',
};

// Placeholder translations for supported languages — structure mirrors `en`.
// These provide the framework; full translations are added incrementally.
const es: typeof en = {
  ...en,
  'tab.home': 'Inicio',
  'tab.deliveries': 'Entregas',
  'tab.porchPartner': 'Socio de Pórtico',
  'tab.payments': 'Pagos',
  'tab.requests': 'Solicitudes',
  'tab.more': 'Más',
  'tab.account': 'Cuenta',
  'profile.editProfile': 'Editar perfil',
  'profile.inviteFriends': 'Invitar Amigos',
  'profile.joinCommunity': 'Únete a tu Comunidad',
  'profile.signOut': 'Cerrar sesión',
  'profile.settings': 'Configuración',
  'settings.title': 'Configuración',
  'settings.appearance': 'APARIENCIA',
  'settings.language': 'IDIOMA',
  'settings.languageDescription':
    'Elige tu idioma preferido. Tu selección se guarda en este dispositivo.',
  'settings.systemDefault': 'Predeterminado del Sistema',
  'settings.version': 'Versión de la app',
};

const zh: typeof en = {
  ...en,
  'tab.home': '首页',
  'tab.deliveries': '快递',
  'tab.more': '更多',
  'tab.account': '账户',
  'profile.editProfile': '编辑资料',
  'profile.inviteFriends': '邀请好友',
  'profile.joinCommunity': '加入您的社区',
  'profile.signOut': '退出登录',
  'profile.settings': '设置',
  'settings.title': '设置',
};

const fr: typeof en = {
  ...en,
  'tab.home': 'Accueil',
  'tab.deliveries': 'Livraisons',
  'tab.more': 'Plus',
  'tab.account': 'Compte',
  'profile.editProfile': 'Modifier le profil',
  'profile.inviteFriends': 'Inviter des Amis',
  'profile.joinCommunity': 'Rejoignez Votre Communauté',
  'profile.signOut': 'Déconnexion',
  'profile.settings': 'Paramètres',
  'settings.title': 'Paramètres',
};

const ru: typeof en = {
  ...en,
  'tab.home': 'Главная',
  'tab.deliveries': 'Доставки',
  'tab.more': 'Ещё',
  'tab.account': 'Аккаунт',
  'profile.editProfile': 'Редактировать профиль',
  'profile.inviteFriends': 'Пригласить друзей',
  'profile.joinCommunity': 'Присоединиться к сообществу',
  'profile.signOut': 'Выйти',
  'profile.settings': 'Настройки',
  'settings.title': 'Настройки',
};

const pt: typeof en = {
  ...en,
  'tab.home': 'Início',
  'tab.deliveries': 'Entregas',
  'tab.more': 'Mais',
  'tab.account': 'Conta',
  'profile.editProfile': 'Editar perfil',
  'profile.inviteFriends': 'Convidar Amigos',
  'profile.joinCommunity': 'Junte-se à Sua Comunidade',
  'profile.signOut': 'Sair',
  'profile.settings': 'Configurações',
  'settings.title': 'Configurações',
};

const ar: typeof en = {
  ...en,
  'tab.home': 'الرئيسية',
  'tab.deliveries': 'التسليمات',
  'tab.more': 'المزيد',
  'tab.account': 'الحساب',
  'profile.editProfile': 'تعديل الملف الشخصي',
  'profile.inviteFriends': 'دعوة الأصدقاء',
  'profile.joinCommunity': 'انضم إلى مجتمعك',
  'profile.signOut': 'تسجيل الخروج',
  'profile.settings': 'الإعدادات',
  'settings.title': 'الإعدادات',
};

const hi: typeof en = {
  ...en,
  'tab.home': 'होम',
  'tab.deliveries': 'डिलीवरी',
  'tab.more': 'और',
  'tab.account': 'खाता',
  'profile.editProfile': 'प्रोफ़ाइल संपादित करें',
  'profile.inviteFriends': 'दोस्तों को आमंत्रित करें',
  'profile.joinCommunity': 'अपना समुदाय जॉइन करें',
  'profile.signOut': 'साइन आउट',
  'profile.settings': 'सेटिंग्स',
  'settings.title': 'सेटिंग्स',
};

const ja: typeof en = {
  ...en,
  'tab.home': 'ホーム',
  'tab.deliveries': '配達',
  'tab.more': 'その他',
  'tab.account': 'アカウント',
  'profile.editProfile': 'プロフィール編集',
  'profile.inviteFriends': '友達を招待',
  'profile.joinCommunity': 'コミュニティに参加',
  'profile.signOut': 'サインアウト',
  'profile.settings': '設定',
  'settings.title': '設定',
};

const ko: typeof en = {
  ...en,
  'tab.home': '홈',
  'tab.deliveries': '배송',
  'tab.more': '더보기',
  'tab.account': '계정',
  'profile.editProfile': '프로필 편집',
  'profile.inviteFriends': '친구 초대',
  'profile.joinCommunity': '커뮤니티 가입',
  'profile.signOut': '로그아웃',
  'profile.settings': '설정',
  'settings.title': '설정',
};

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  fr: { translation: fr },
  ru: { translation: ru },
  pt: { translation: pt },
  ar: { translation: ar },
  hi: { translation: hi },
  ja: { translation: ja },
  ko: { translation: ko },
};

// Initialize i18next with the default language. The LanguageProvider will
// call resolveInitialLanguage() on mount and update via changeLanguage().
void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((l) => l.code),
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export { LANGUAGES };
export default i18n;

/** Check if the current language is RTL. */
export function isCurrentRTL(): boolean {
  return checkIsRTL(i18n.language || DEFAULT_LANGUAGE);
}
