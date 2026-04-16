"use client";

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import {
  ArrowLeft, Download, Share2, Sparkles, TrendingUp, FileText, ClipboardCheck, Heart,
  Mic, Video, Bot, User, Play, Pause, Volume2, Maximize, Clock, Calendar, Briefcase, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

// --- Constants & Config (Ported from Result Page) ---
const dimensionKeys = [
  { key: "clarity", icon: FileText, color: "#2563EB" },
  { key: "evidence", icon: ClipboardCheck, color: "#059669" },
  { key: "impact", icon: TrendingUp, color: "#D97706" },
  { key: "engagement", icon: Heart, color: "#DC2626" },
  { key: "verbal_performance", icon: Mic, color: "#7C3AED" },
  { key: "visual_performance", icon: Video, color: "#DB2777" },
];

const radarColors = {
  grid: "#E2E8F0",
  axis: "#CBD5E1",
  fillSelf: "rgba(59, 130, 246, 0.2)",
  strokeSelf: "#2563EB",
  fillAvg: "rgba(148, 163, 184, 0.1)",
  strokeAvg: "#94A3B8",
};

// Radar Chart Component
const RadarChart = ({
  dimensions,
  scores,
  size = 300
}: {
  dimensions: any[],
  scores: Record<string, number>,
  size?: number
}) => {
  const center = size / 2;
  const radius = (size / 2) - 40;
  const numDimensions = dimensions.length;

  // Mock averages for the chart
  const averages: Record<string, number> = {
    clarity: 75, evidence: 78, impact: 72, engagement: 80, verbal_performance: 74, visual_performance: 76
  };

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / numDimensions - Math.PI / 2;
    const r = (radius * (value || 0)) / 100;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const selfPoints = dimensions.map((dim, i) => {
    const { x, y } = getPoint(i, scores[dim.key] || 0);
    return `${x},${y}`;
  }).join(" ");

  const avgPoints = dimensions.map((dim, i) => {
    const { x, y } = getPoint(i, averages[dim.key]);
    return `${x},${y}`;
  }).join(" ");

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="relative flex justify-center items-center">
      <svg width={size} height={size} className="overflow-visible">
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={dimensions.map((_, i) => `${getPoint(i, level).x},${getPoint(i, level).y}`).join(" ")}
            fill="none" stroke={radarColors.grid} strokeWidth="1"
          />
        ))}
        {dimensions.map((_, i) => (
          <line
            key={i} x1={center} y1={center} x2={getPoint(i, 100).x} y2={getPoint(i, 100).y}
            stroke={radarColors.axis} strokeWidth="1"
          />
        ))}
        <polygon points={avgPoints} fill={radarColors.fillAvg} stroke={radarColors.strokeAvg} strokeWidth="1.5" strokeDasharray="4 4" />
        <polygon points={selfPoints} fill={radarColors.fillSelf} stroke={radarColors.strokeSelf} strokeWidth="2.5" />
        {dimensions.map((dim, i) => {
          const { x, y } = getPoint(i, scores[dim.key] || 0);
          return <circle key={i} cx={x} cy={y} r="4" fill={radarColors.strokeSelf} stroke="#FFFFFF" strokeWidth="2" />;
        })}
        {dimensions.map((dim, i) => {
          const { x, y } = getPoint(i, 118);
          return (
            <g key={dim.key} transform={`translate(${x}, ${y})`}>
              <foreignObject x="-40" y="-15" width="80" height="40">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm border border-gray-100">
                    <dim.icon size={10} color={dim.color} />
                    <span className="text-[10px] font-bold text-gray-700 whitespace-nowrap">{dim.label}</span>
                  </div>
                  <div className="text-[10px] font-medium mt-0.5">
                    <span style={{ color: radarColors.strokeSelf }}>{scores[dim.key] || 0}</span>
                    <span className="text-gray-300 mx-0.5">|</span>
                    <span className="text-gray-400">{averages[dim.key]}</span>
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function HistoryDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const t = useTranslations('result'); // Reusing result translations for now, may need a 'history' namespace later
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'replay' | 'conversation'>('conversation');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [selectedReplayIndex, setSelectedReplayIndex] = useState(0);

  const dimensions = useMemo(() => dimensionKeys.map((d) => ({ ...d, label: t(`dimensions.${d.key}`) || d.key })), [t]);

  useEffect(() => {
    async function fetchHistory() {
      if (!id || !initialized) return;
      try {
        const filters: string[] = [];
        if (session?.user?.id) filters.push(`supabase_user_id.eq.${session.user.id}`);
        if (profile?.id) filters.push(`user_id.eq.${profile.id}`);
        if (!filters.length) {
          setHistoryData(null);
          return;
        }

        const supabase = getSupabaseClient();
        let query = supabase
          .from('web_history')
          .select('*')
          .eq('id', id);

        query = filters.length === 1
          ? (filters[0].startsWith('supabase_user_id')
            ? query.eq('supabase_user_id', session!.user.id)
            : query.eq('user_id', profile!.id))
          : query.or(filters.join(','));

        const { data, error } = await query.single();
          
        if (error) throw error;
        setHistoryData(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [id, initialized, session?.user?.id, profile?.id]);

  // Extract Scores
  const scores = useMemo(() => {
    const rawScores = historyData?.dimension_scores || {};
    const out: Record<string, number> = {};
    for (const d of dimensionKeys) {
      // Handle { clarity: { score: 80 }, ... } format or { clarity: 80 } format
      const val = rawScores[d.key];
      out[d.key] = typeof val === 'object' ? (val?.score || 0) : (typeof val === 'number' ? val : 0);
    }
    return out;
  }, [historyData]);

  // Extract Q&A
  const qaPairs = useMemo(() => {
    const conversation = historyData?.conversation || [];
    const pairs: Array<{ id: number; question: string; answer: string }> = [];
    let pendingQuestion: string | null = null;

    for (const msg of conversation) {
      if (msg.role === 'system' || msg.role === 'assistant') { // Often system/assistant asks the question
        pendingQuestion = msg.content;
      } else if (msg.role === 'user') {
        if (!pendingQuestion) pendingQuestion = "Previous Context"; 
        pairs.push({
          id: pairs.length + 1,
          question: pendingQuestion,
          answer: msg.content,
        });
        pendingQuestion = null;
      }
    }
    return pairs;
  }, [historyData]);

  const replayUrls = useMemo(() => {
    const fromOverallEval = Array.isArray(historyData?.overall_eval?.video_urls)
      ? historyData.overall_eval.video_urls
      : [];
    const fromTopLevel = Array.isArray((historyData as any)?.video_urls)
      ? (historyData as any).video_urls
      : [];
    const merged = [...fromTopLevel, ...fromOverallEval]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean);
    return Array.from(new Set(merged));
  }, [historyData]);

  useEffect(() => {
    if (replayUrls.length > 0) {
      setActiveTab('replay');
      setSelectedReplayIndex(0);
    } else {
      setActiveTab('conversation');
      setSelectedReplayIndex(0);
    }
  }, [replayUrls.length]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!historyData) {
    return <div className="min-h-screen flex items-center justify-center">History record not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Review Interview</h1>
            <p className="text-sm text-gray-500">
              {new Date(historyData.created_at).toLocaleString()} • {historyData.mode}
            </p>
          </div>
          <Button variant="outline" className="gap-2 bg-white hidden sm:flex">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Overview Stats */}
        <Card className="border-none shadow-sm ring-1 ring-black/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Overall Score */}
              <div className="flex flex-col items-center">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-[3px] border-indigo-100 bg-white">
                  <div className="text-center">
                    <span className="block text-3xl font-black text-indigo-600 tracking-tight">{historyData.overall_score || 0}</span>
                  </div>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                     <circle cx="48" cy="48" r="46" fill="none" stroke="#4f46e5" strokeWidth="3" strokeDasharray={`${((historyData.overall_score || 0) / 100) * 289} 289`} strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* Tags/Badges */}
              <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1"><Briefcase size={14} /> Type</div>
                  <p className="font-semibold text-gray-900 capitalize">{historyData.interview_type || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1"><User size={14} /> Position</div>
                  <p className="font-semibold text-gray-900 truncate">{historyData.position || 'General'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1"><TrendingUp size={14} /> Category</div>
                  <p className="font-semibold text-gray-900 capitalize">{historyData.practice_category || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1"><Clock size={14} /> Duration</div>
                  <p className="font-semibold text-gray-900">
                    {historyData.started_at && historyData.completed_at ? 
                      `${Math.round((new Date(historyData.completed_at).getTime() - new Date(historyData.started_at).getTime()) / 60000)} mins` 
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Replay / Conversation */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader className="border-b bg-gray-50/50 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {activeTab === 'replay' ? (
                      <>
                        <Video className="h-5 w-5 text-indigo-600" />
                        Replay
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5 text-indigo-600" />
                        Full Conversation
                      </>
                    )}
                  </CardTitle>
                  <div className="inline-flex rounded-lg border bg-white p-1">
                    <button
                      onClick={() => setActiveTab('conversation')}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md transition",
                        activeTab === 'conversation' ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Conversation
                    </button>
                    <button
                      onClick={() => setActiveTab('replay')}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md transition",
                        activeTab === 'replay' ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Replay
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {activeTab === 'replay' ? (
                  <div className="space-y-4 p-6">
                    {replayUrls.length > 0 ? (
                      <>
                        <video
                          key={replayUrls[selectedReplayIndex] || 'replay-video'}
                          src={replayUrls[selectedReplayIndex]}
                          controls
                          preload="metadata"
                          className="w-full rounded-xl border bg-black"
                        />
                        {replayUrls.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {replayUrls.map((_, idx) => (
                              <button
                                key={`seg-${idx}`}
                                onClick={() => setSelectedReplayIndex(idx)}
                                className={cn(
                                  "px-3 py-1.5 text-xs rounded-full border transition",
                                  idx === selectedReplayIndex
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                )}
                              >
                                Segment {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-sm text-gray-500">
                        No replay video is available for this attempt. The camera may have been off, or upload had not completed.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(qaPairs.length ? qaPairs : []).map((q) => (
                      <div key={q.id} className="group">
                        <div
                          className={cn(
                            "p-6 cursor-pointer transition-colors hover:bg-gray-50/50",
                            expandedQuestion === q.id ? "bg-indigo-50/30" : ""
                          )}
                          onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                              Q{q.id}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start gap-3">
                                <h4 className="font-semibold text-gray-900 leading-snug">{q.question}</h4>
                                {expandedQuestion === q.id ? (
                                  <ChevronUp size={16} className="text-gray-400 mt-1" />
                                ) : (
                                  <ChevronDown size={16} className="text-gray-400 mt-1" />
                                )}
                              </div>
                              {expandedQuestion !== q.id && (
                                <p className="text-sm text-gray-500 line-clamp-1">{q.answer}</p>
                              )}
                            </div>
                          </div>

                          {expandedQuestion === q.id && (
                            <div className="mt-4 pl-12 space-y-4">
                              <div className="p-4 bg-white rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed shadow-sm whitespace-pre-line">
                                {q.answer}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {!qaPairs.length && <div className="p-6 text-sm text-gray-500">No conversation history available.</div>}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Evaluation Results */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* AI Summary */}
            <Card className="border-none shadow-md bg-indigo-600 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-indigo-100 leading-relaxed text-sm">
                  {historyData.overall_feedback || "No overall feedback available."}
                </p>
              </CardContent>
            </Card>

            {/* Radar Chart Card */}
            <Card className="border-none shadow-md">
              <CardHeader className="border-b bg-gray-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center">
                <RadarChart dimensions={dimensions} scores={scores} size={300} />
              </CardContent>
            </Card>

            {/* Detailed Scores */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Dimension Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {dimensions.map((dim) => {
                  const score = scores[dim.key] || 0;
                  return (
                    <div key={dim.key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-gray-100 text-gray-600">
                            <dim.icon size={14} />
                          </div>
                          <span className="font-medium text-gray-700">{dim.label}</span>
                        </div>
                        <span className="font-bold" style={{ color: dim.color }}>{score}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${score}%`, backgroundColor: dim.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  );
}
