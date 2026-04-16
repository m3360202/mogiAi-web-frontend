"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { UploadCloud, Mic2, Users, Building2, Presentation, FileText, ArrowRight, Play, Loader2, Plus, Settings2, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { courseIds } from '@/lib/mock-data';
import { useRoleStore } from '@/store/useRoleStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiBaseUrl } from '@/lib/publicConfig';
import {
  getDefaultDiscussionVoicePreset,
  getDiscussionLanguage,
  getDiscussionPreviewText,
  getDiscussionVoiceOptions,
  normalizeDiscussionVoicePreset,
  type DiscussionVoicePresetId,
} from '@/lib/discussionVoicePresets';

export default function PracticeSetupPage() {
  const t = useTranslations('practice');
  const tCourses = useTranslations('courses');
  const router = useRouter();
  const params = useParams<{ id: string | string[]; locale?: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const locale = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  // 检查登录状态，未登录则跳转到登录页
  useEffect(() => {
    if (initialized && !user) {
      router.push('/login');
    }
  }, [initialized, user, router]);

  // 如果未登录，在重定向前不显示内容
  if (initialized && !user) {
    return null;
  }
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'interview' | 'discussion'>('interview');

  // Interview Mode State
  const [file, setFile] = useState<File | null>(null);
  const [scenario, setScenario] = useState("public");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Discussion Mode State
  const { roles, addRole } = useRoleStore();
  const [durationSec, setDurationSec] = useState(60);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const defaultVoicePresetId = useMemo(() => getDefaultDiscussionVoicePreset(locale), [locale]);
  const discussionLanguage = useMemo(() => getDiscussionLanguage(locale), [locale]);
  const voiceOptions = useMemo(() => getDiscussionVoiceOptions(locale), [locale]);
  const [newRole, setNewRole] = useState({ name: '', personality: '', expertise: '', description: '', tone: '', voicePresetId: defaultVoicePresetId as DiscussionVoicePresetId });
  // Per-role overrides for discussion mode
  const [roleOverrides, setRoleOverrides] = useState<Record<string, { personality: string; expertise: string; tone: string; voicePresetId: DiscussionVoicePresetId }>>({});
  const [previewingRoleId, setPreviewingRoleId] = useState<string | null>(null);

  const selectedRoles = useMemo(() => {
    const idSet = new Set(selectedRoleIds);
    return roles.filter((r) => idSet.has(r.id));
  }, [roles, selectedRoleIds]);

  const resolveApiBase = () => {
    const base = getApiBaseUrl();
    if (!base) return '/api/v1';
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  };

  const resolveLanguage = () => {
    const lang = (locale || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('en')) return 'en';
    return 'ja';
  };

  const previewVoice = async (roleId: string) => {
    const language = resolveLanguage();
    const ov = roleOverrides[roleId];
    const base = roles.find((r) => r.id === roleId);
    const voicePresetId = normalizeDiscussionVoicePreset(locale, ov?.voicePresetId || base?.voicePresetId);
    const name = base?.name || 'AI';
    const previewText =
      language === 'ja'
        ? `こんにちは、${name}です。ディスカッションを始めましょう。`
        : language === 'en'
          ? `Hello, I'm ${name}. Let's begin the discussion.`
          : `你好，我是${name}。我们开始讨论。`;
    setPreviewingRoleId(roleId);
    try {
      const res = await fetch(`${resolveApiBase()}/realtime/tts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: previewText,
          voice_preset_id: voicePresetId,
          language,
        }),
      });
      if (!res.ok) throw new Error(`tts preview failed: ${res.status}`);
      const data = await res.json();
      const url = data?.audio_url as string | undefined;
      const b64 = data?.audio_base64 as string | undefined;
      const mime = (data?.audio_mime as string | undefined) || 'audio/mpeg';
      if (url) {
        const audio = new Audio(url);
        await audio.play();
        return;
      }
      if (b64) {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bin], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        try {
          const audio = new Audio(objectUrl);
          await audio.play();
        } finally {
          // revoke later to avoid breaking playback on some browsers
          setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewingRoleId(null);
    }
  };

  const resolveTopic = () => {
    const courseId = Number(id);
    if (!id || !courseIds.includes(courseId as (typeof courseIds)[number])) {
      return `Course ${id}`;
    }
    return [
      `Course: ${tCourses(`data.${courseId}.name`)}`,
      `Target: ${tCourses(`data.${courseId}.target`)}`,
      `Content: ${tCourses(`data.${courseId}.content`)}`,
      `Goal: ${tCourses(`data.${courseId}.goal`)}`,
    ].join('\n');
  };

  const handleCreateRole = () => {
    if (!newRole.name) return;
    addRole({
      name: newRole.name,
      avatar: '👤', // Default avatar for custom roles
      description: newRole.description || 'Custom role',
      personality: newRole.personality,
      expertise: newRole.expertise,
      tone: newRole.tone,
      voicePresetId: normalizeDiscussionVoicePreset(locale, newRole.voicePresetId),
    });
    setIsCreatingRole(false);
    setNewRole({ name: '', personality: '', expertise: '', description: '', tone: '', voicePresetId: defaultVoicePresetId });
  };

  const toggleRoleSelected = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const exists = prev.includes(roleId);
      const next = exists ? prev.filter((x) => x !== roleId) : [...prev, roleId];
      return next;
    });
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      setRoleOverrides((prev) => ({
        ...prev,
        [roleId]: prev[roleId] || {
          personality: role.personality || '',
          expertise: role.expertise || '',
          tone: role.tone || '',
          voicePresetId: normalizeDiscussionVoicePreset(locale, role.voicePresetId),
        },
      }));
    }
  };

  const handleEnterPractice = async () => {
    if (!id) return;
    const language = resolveLanguage();

    if (activeTab === 'discussion') {
      if (!selectedRoleIds.length) return;
      setIsSubmitting(true);
      try {
        const payload = {
          language,
          duration_sec: durationSec,
          scenario,
          topic_hint: resolveTopic(),
          roles: selectedRoleIds
            .map((rid) => {
              const base = roles.find((r) => r.id === rid);
              if (!base) return null;
              const ov = roleOverrides[rid] || {
                personality: base.personality || '',
                expertise: base.expertise || '',
                tone: base.tone || '',
                voicePresetId: normalizeDiscussionVoicePreset(locale, base.voicePresetId),
              };
              return {
                role_id: base.id,
                name: base.name,
                avatar: base.avatar,
                personality: ov.personality,
                expertise: ov.expertise,
                tone: ov.tone,
                voice_preset_id: ov.voicePresetId,
              };
            })
            .filter(Boolean),
        };

        const response = await fetch(
          `${resolveApiBase()}/realtime/rooms/practice-${id}/discussion-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          throw new Error(`discussion-session failed: ${response.status}`);
        }

        router.push(
          `/practice/${id}/session?mode=discussion&duration=${encodeURIComponent(String(durationSec))}&language=${encodeURIComponent(language)}`
        );
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Existing Interview Mode Logic
    if (!file) {
      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append('topic', resolveTopic());
        formData.append('language', language);
        formData.append('min_rounds', '7');
        formData.append('max_rounds', '7');
        formData.append('scenario', scenario);

        const response = await fetch(
          `${resolveApiBase()}/realtime/rooms/practice-${id}/topic-session`,
          { method: 'POST', body: formData }
        );
        if (!response.ok) {
          throw new Error(`topic-session failed: ${response.status}`);
        }
        router.push(
          `/practice/${id}/session?scenario=${scenario}&topic=${encodeURIComponent(resolveTopic())}&language=${encodeURIComponent(language)}`
        );
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      formData.append('min_rounds', '7');
      formData.append('max_rounds', '7');
      formData.append('scenario', scenario);

      const response = await fetch(
        `${resolveApiBase()}/realtime/rooms/practice-${id}/doc-session`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        throw new Error(`doc-session failed: ${response.status}`);
      }
      router.push(
        `/practice/${id}/session?doc=1&scenario=${scenario}&topic=${encodeURIComponent(file ? `Uploaded document: ${file.name}` : resolveTopic())}&language=${encodeURIComponent(language)}`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            {t('setup_title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('setup_subtitle')}
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex justify-center mb-6">
            <div className="bg-white p-1 rounded-xl border shadow-sm inline-flex">
                <button
                    onClick={() => setActiveTab('interview')}
                    className={cn(
                        "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        activeTab === 'interview' 
                            ? "bg-indigo-600 text-white shadow-md" 
                            : "text-gray-600 hover:bg-gray-50"
                    )}
                >
                    {t('interview_mode')}
                </button>
                <button
                    onClick={() => setActiveTab('discussion')}
                    className={cn(
                        "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        activeTab === 'discussion' 
                            ? "bg-indigo-600 text-white shadow-md" 
                            : "text-gray-600 hover:bg-gray-50"
                    )}
                >
                    {t('discussion_mode')}
                </button>
            </div>
        </div>

        <Card className="border-none shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          {activeTab === 'interview' ? (
            // === INTERVIEW MODE CONTENT ===
            <>
              <CardHeader className="pb-8 border-b bg-white/50">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs">1</span>
                  {t('upload_material')}
                </div>
                <CardTitle className="text-xl">{t('upload_file')}</CardTitle>
                <CardDescription>{t('upload_description')}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-8 pt-8">
                {/* File Upload Area */}
                <div className="relative group">
                  <div className={cn(
                    "relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-gray-50/50",
                    file ? "border-emerald-400 bg-emerald-50/30" : "border-gray-300 hover:border-primary hover:bg-primary/5"
                  )}>
                    <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      accept=".pdf,.ppt,.pptx,.doc,.docx"
                    />
                    
                    <div className="flex flex-col items-center gap-3 text-center p-6">
                      {file ? (
                        <>
                          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                            <p className="text-xs text-emerald-600/80">{(file.size / 1024 / 1024).toFixed(2)} MB • {t('ready_to_analyze')}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 h-8">
                            {t('change_file')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                            <UploadCloud className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              <span className="text-primary font-semibold">{t('click_to_upload')}</span> {t('or_drag_and_drop')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{t('file_upload_hint')}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scenario Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs">2</span>
                    {t('select_scenario')}
                  </div>
                  
                  <RadioGroup 
                    defaultValue="public" 
                    onValueChange={setScenario}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {[
                      { id: 'public', icon: Mic2, label: t('scenarios.public'), desc: t('scenarios.public_desc') },
                      { id: 'internal', icon: Building2, label: t('scenarios.internal'), desc: t('scenarios.internal_desc') },
                      { id: 'client', icon: Presentation, label: t('scenarios.client'), desc: t('scenarios.client_desc') },
                    ].map((item) => (
                      <div key={item.id} className="relative">
                        <RadioGroupItem value={item.id} id={item.id} className="peer sr-only" />
                        <Label
                          htmlFor={item.id}
                          className="flex flex-col items-center justify-between p-4 h-full rounded-xl border-2 border-muted bg-white hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-indigo-50/30 peer-data-[state=checked]:text-primary cursor-pointer transition-all hover:shadow-md"
                        >
                          <item.icon className="h-8 w-8 mb-3 text-gray-500 peer-data-[state=checked]:text-primary" />
                          <div className="text-center space-y-1">
                            <div className="font-semibold">{item.label}</div>
                            <div className="text-xs text-muted-foreground font-normal">{item.desc}</div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Audience */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs">3</span>
                    {t('audience.label')}
                  </div>
                  <Select>
                    <SelectTrigger className="w-full h-12 text-base bg-white">
                      <SelectValue placeholder={t('audience.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{t('audience.small')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{t('audience.medium')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="large">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{t('audience.large')}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </>
          ) : (
            // === DISCUSSION MODE CONTENT ===
            <>
              <CardHeader className="pb-8 border-b bg-white/50">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs">1</span>
                  {t('discussion_setup')}
                </div>
                <CardTitle className="text-xl">{t('discussion_setup_title')}</CardTitle>
                <CardDescription>{t('configure_discussion')}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-8 pt-8">
                {/* 1. Duration */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">{t('duration_sec')}</Label>
                  <Input
                    type="number"
                    min={10}
                    max={600}
                    value={durationSec}
                    onChange={(e) => setDurationSec(parseInt(e.target.value) || 60)}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">{t('duration_hint')}</p>
                </div>

                {/* 2. AI Role Selection */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="text-base font-semibold">{t('select_roles')}</Label>
                        <Button variant="outline" size="sm" onClick={() => setIsCreatingRole(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('create_role')}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {roles.map((role) => (
                            <div 
                                key={role.id}
                                onClick={() => toggleRoleSelected(role.id)}
                                className={cn(
                                    "cursor-pointer p-4 rounded-xl border-2 transition-all hover:shadow-md space-y-3",
                                    selectedRoleIds.includes(role.id) 
                                        ? "border-purple-600 bg-purple-50/50" 
                                        : "border-gray-200 bg-white hover:border-purple-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                                        {role.avatar}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{role.name}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{role.expertise}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{role.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Per-role Settings */}
                {selectedRoles.length ? (
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      {t('role_params')}
                    </Label>
                    <div className="space-y-6">
                      {selectedRoles.map((r) => {
                        const ov = roleOverrides[r.id] || {
                          personality: r.personality || '',
                          expertise: r.expertise || '',
                          tone: r.tone || '',
                          voicePresetId: normalizeDiscussionVoicePreset(locale, r.voicePresetId),
                        };
                        return (
                          <div key={r.id} className="rounded-xl border bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                                  {r.avatar}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm">{r.name}</div>
                                  <div className="text-xs text-muted-foreground">{r.id}</div>
                                </div>
                              </div>
                              <div className="min-w-[180px]">
                                <Label className="text-xs text-muted-foreground">{t('voice_style')}</Label>
                                <Select
                                  value={normalizeDiscussionVoicePreset(locale, ov.voicePresetId)}
                                  onValueChange={(v) => {
                                    setRoleOverrides((prev) => ({
                                      ...prev,
                                      [r.id]: { ...ov, voicePresetId: normalizeDiscussionVoicePreset(locale, v) },
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder={t('voice_placeholder')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {voiceOptions.map((opt) => (
                                      <SelectItem key={opt.id} value={opt.id}>{t(opt.labelKey as any)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="mt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => previewVoice(r.id)}
                                    disabled={isSubmitting || previewingRoleId === r.id}
                                  >
                                    {previewingRoleId === r.id ? t('previewing') : t('preview_voice')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('personality')}</Label>
                                <Input
                                  value={ov.personality}
                                  onChange={(e) =>
                                    setRoleOverrides((prev) => ({
                                      ...prev,
                                      [r.id]: { ...ov, personality: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('expertise')}</Label>
                                <Input
                                  value={ov.expertise}
                                  onChange={(e) =>
                                    setRoleOverrides((prev) => ({
                                      ...prev,
                                      [r.id]: { ...ov, expertise: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t('tone')}</Label>
                                <Input
                                  value={ov.tone}
                                  onChange={(e) =>
                                    setRoleOverrides((prev) => ({
                                      ...prev,
                                      [r.id]: { ...ov, tone: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </>
          )}

          {/* Create Role Dialog */}
          {isCreatingRole && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                <Card className="w-full max-w-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                    <CardHeader>
                        <CardTitle>{t('create_new_role')}</CardTitle>
                        <CardDescription>{t('define_persona')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t('name')}</Label>
                            <Input 
                                value={newRole.name} 
                                onChange={(e) => setNewRole({...newRole, name: e.target.value})} 
                                placeholder={t('role_name')}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('expertise')}</Label>
                                <Input 
                                    value={newRole.expertise} 
                                    onChange={(e) => setNewRole({...newRole, expertise: e.target.value})} 
                                    placeholder={t('expertise_placeholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('personality')}</Label>
                                <Input 
                                    value={newRole.personality} 
                                    onChange={(e) => setNewRole({...newRole, personality: e.target.value})} 
                                    placeholder={t('personality_placeholder')}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('voice_style')}</Label>
                            <Select
                              value={normalizeDiscussionVoicePreset(locale, newRole.voicePresetId)}
                              onValueChange={(v) => setNewRole({ ...newRole, voicePresetId: normalizeDiscussionVoicePreset(locale, v) })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t('voice_placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {voiceOptions.map((opt) => (
                                  <SelectItem key={opt.id} value={opt.id}>{t(opt.labelKey as any)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>{t('tone')}</Label>
                            <Input 
                                value={newRole.tone} 
                                onChange={(e) => setNewRole({...newRole, tone: e.target.value})} 
                                placeholder={t('tone_placeholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input 
                                value={newRole.description} 
                                onChange={(e) => setNewRole({...newRole, description: e.target.value})} 
                                placeholder={t('description_placeholder')}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setIsCreatingRole(false)}>{t('cancel')}</Button>
                            <Button onClick={handleCreateRole}>{t('save_role')}</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
          )}

          {/* Action Button (Shared footer, or conditional) */}
          <div className="p-6 bg-gray-50/50 border-t">
            <Button 
                className={cn(
                    "w-full h-14 text-lg font-bold shadow-lg transition-all hover:scale-[1.01]",
                    activeTab === 'discussion' 
                        ? "shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        : "shadow-primary/20 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                )}
                onClick={handleEnterPractice}
                disabled={isSubmitting || (activeTab === 'discussion' && selectedRoleIds.length === 0)}
            >
                {isSubmitting ? (
                    <>
                    <Loader2 className="ml-1 h-5 w-5 animate-spin" />
                    <span className="ml-2">{t('session.waiting_question')}</span>
                    </>
                ) : (
                    <>
                    {activeTab === 'discussion' ? t('start_discussion') : t('enter_practice')}
                    <Play className="ml-2 h-5 w-5 fill-current" />
                    </>
                )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
                {t('terms_notice')}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
