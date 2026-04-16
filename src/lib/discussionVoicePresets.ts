export type DiscussionLanguage = 'zh' | 'ja' | 'en';

export type DiscussionVoicePresetId =
  | 'zh_cn_1'
  | 'zh_cn_2'
  | 'zh_cn_3'
  | 'zh_cn_4'
  | 'ja_jp_1'
  | 'ja_jp_2'
  | 'ja_jp_3'
  | 'ja_jp_4'
  | 'en_us_1'
  | 'en_us_2';

export type DiscussionVoiceOption = {
  id: DiscussionVoicePresetId;
  labelKey: string;
};

const VOICE_OPTIONS: Record<DiscussionLanguage, DiscussionVoiceOption[]> = {
  zh: [
    { id: 'zh_cn_1', labelKey: 'voice_zh_1' },
    { id: 'zh_cn_2', labelKey: 'voice_zh_2' },
    { id: 'zh_cn_3', labelKey: 'voice_zh_3' },
    { id: 'zh_cn_4', labelKey: 'voice_zh_4' },
  ],
  ja: [
    { id: 'ja_jp_1', labelKey: 'voice_ja_1' },
    { id: 'ja_jp_2', labelKey: 'voice_ja_2' },
    { id: 'ja_jp_3', labelKey: 'voice_ja_3' },
    { id: 'ja_jp_4', labelKey: 'voice_ja_4' },
  ],
  en: [
    { id: 'en_us_1', labelKey: 'voice_en_1' },
    { id: 'en_us_2', labelKey: 'voice_en_2' },
  ],
};

function normalizeLanguage(locale?: string | null): DiscussionLanguage {
  const lc = (locale || '').toLowerCase();
  if (lc.startsWith('zh')) return 'zh';
  if (lc.startsWith('en')) return 'en';
  return 'ja';
}

export function getDiscussionLanguage(locale?: string | null): DiscussionLanguage {
  return normalizeLanguage(locale);
}

export function getDiscussionSpeechLocale(locale?: string | null): 'zh-CN' | 'ja-JP' | 'en-US' {
  const lang = normalizeLanguage(locale);
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'en') return 'en-US';
  return 'ja-JP';
}

export function getDiscussionVoiceOptions(locale?: string | null): DiscussionVoiceOption[] {
  return VOICE_OPTIONS[normalizeLanguage(locale)];
}

export function getDefaultDiscussionVoicePreset(locale?: string | null): DiscussionVoicePresetId {
  return getDiscussionVoiceOptions(locale)[0].id;
}

export function normalizeDiscussionVoicePreset(
  locale: string | null | undefined,
  preset: string | null | undefined
): DiscussionVoicePresetId {
  const options = getDiscussionVoiceOptions(locale);
  const match = options.find((o) => o.id === preset);
  return match ? match.id : options[0].id;
}

export function getDiscussionPreviewText(locale: string | null | undefined, roleName: string): string {
  const lang = normalizeLanguage(locale);
  if (lang === 'zh') return `你好，我是${roleName}。我们开始讨论。`;
  if (lang === 'en') return `Hi, I am ${roleName}. Let's start our discussion.`;
  return `こんにちは、${roleName}です。ディスカッションを始めましょう。`;
}
