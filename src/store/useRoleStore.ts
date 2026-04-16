import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiscussionVoicePresetId } from '@/lib/discussionVoicePresets';

export interface AIRole {
  id: string;
  name: string;
  avatar: string; // URL or emoji or identifier
  description: string;
  personality: string;
  expertise: string;
  tone: string;
  /**
   * Discussion mode voice preset id (backend maps to Google TTS voice_name)
   * - zh_cn_1..4 / ja_jp_1..4 / en_us_1..2
   */
  voicePresetId?: DiscussionVoicePresetId;
  isOfficial: boolean;
}

interface RoleState {
  roles: AIRole[];
  activeRoleId: string | null;
  addRole: (role: Omit<AIRole, 'id' | 'isOfficial'>) => void;
  setActiveRole: (id: string) => void;
  updateRole: (id: string, updates: Partial<AIRole>) => void;
}

export const DEFAULT_ROLES: AIRole[] = [
  {
    id: 'official-1',
    name: 'Sarah (HR Manager)',
    avatar: '👩‍💼',
    description: 'Experienced HR professional focused on behavioral questions.',
    personality: 'Professional, empathetic, but strict on core values.',
    expertise: 'Human Resources, Behavioral Psychology',
    tone: 'Formal, Encouraging',
    voicePresetId: 'zh_cn_1',
    isOfficial: true,
  },
  {
    id: 'official-2',
    name: 'Mike (Tech Lead)',
    avatar: '👨‍💻',
    description: 'Senior Technical Lead interested in system design and coding skills.',
    personality: 'Direct, analytical, focused on efficiency.',
    expertise: 'Software Architecture, Algorithms, System Design',
    tone: 'Technical, Concise, Critical',
    voicePresetId: 'zh_cn_2',
    isOfficial: true,
  },
  {
    id: 'official-3',
    name: 'Emma (Product Manager)',
    avatar: '👩‍🎨',
    description: 'Product Manager looking for user-centric thinking.',
    personality: 'Creative, collaborative, user-focused.',
    expertise: 'Product Management, UX/UI, Agile',
    tone: 'Casual, Inquisitive, Enthusiastic',
    voicePresetId: 'zh_cn_3',
    isOfficial: true,
  },
  {
    id: 'official-4',
    name: 'Alex (Strategy Consultant)',
    avatar: '🧠',
    description: 'Sharp, structured thinker who challenges assumptions and pushes for clear arguments.',
    personality: 'Rational, skeptical, but constructive.',
    expertise: 'Strategy, Business Analysis, Debate',
    tone: 'Calm, Logical, Persuasive',
    voicePresetId: 'zh_cn_4',
    isOfficial: true,
  },
];

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      roles: DEFAULT_ROLES,
      activeRoleId: null,
      addRole: (role) =>
        set((state) => ({
          roles: [
            ...state.roles,
            {
              ...role,
              id: `custom-${Date.now()}`,
              isOfficial: false,
            },
          ],
        })),
      setActiveRole: (id) => set({ activeRoleId: id }),
      updateRole: (id, updates) =>
        set((state) => ({
          roles: state.roles.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
    }),
    {
      name: 'ai-role-storage',
    }
  )
);
