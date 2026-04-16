export type SpeakOptions = {
  /**
   * Preferred BCP-47 language tag. Examples: "zh-CN", "zh-TW", "ja-JP".
   * Note: forcing a lang only works if the browser/OS provides a matching voice.
   */
  preferredLang?: string;
  /**
   * Fallback languages to try if no exact preferredLang voice exists.
   */
  fallbackLangs?: string[];
  rate?: number;
  pitch?: number;
  volume?: number;
};

function normLang(lang: string): string {
  return (lang || "").trim().toLowerCase();
}

function pickVoice(voices: SpeechSynthesisVoice[], langs: string[]): SpeechSynthesisVoice | null {
  const desired = langs.map(normLang).filter(Boolean);
  if (!desired.length) return null;

  // Prefer exact matches first (e.g. "zh-cn")
  for (const want of desired) {
    const v = voices.find((x) => normLang(x.lang) === want);
    if (v) return v;
  }
  // Then prefix matches (e.g. "zh" matches "zh-CN"/"zh-TW")
  for (const want of desired) {
    const v = voices.find((x) => normLang(x.lang).startsWith(want));
    if (v) return v;
  }
  return null;
}

/**
 * Speak text via Web Speech API, with a preferred language/voice.
 * Returns true if we attempted playback (API exists), false otherwise.
 */
export async function speakText(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;
  if (!text || !text.trim()) return false;

  const preferredLang = opts.preferredLang || "zh-CN";
  const fallbackLangs = opts.fallbackLangs || ["zh", "zh-TW", "zh-HK"];

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = preferredLang;
  if (typeof opts.rate === "number") utter.rate = opts.rate;
  if (typeof opts.pitch === "number") utter.pitch = opts.pitch;
  if (typeof opts.volume === "number") utter.volume = opts.volume;

  const getVoices = (): SpeechSynthesisVoice[] => {
    try {
      return synth.getVoices() || [];
    } catch {
      return [];
    }
  };

  const tryAssignVoice = () => {
    const voices = getVoices();
    const voice = pickVoice(voices, [preferredLang, ...fallbackLangs]);
    if (voice) utter.voice = voice;
  };

  // Voices may load async on some browsers (notably Chromium/Windows).
  tryAssignVoice();
  if (!utter.voice) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const t = window.setTimeout(done, 250);
      synth.onvoiceschanged = () => {
        window.clearTimeout(t);
        tryAssignVoice();
        synth.onvoiceschanged = null;
        resolve();
      };
    });
  }

  try {
    synth.cancel();
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

