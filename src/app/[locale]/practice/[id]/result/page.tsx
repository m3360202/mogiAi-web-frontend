"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { 
  ArrowRight, Download, Share2, Sparkles, TrendingUp,
  FileText, ClipboardCheck, Heart, Mic, Video, User, Bot, Clock, Calendar, ChevronDown, ChevronUp,
  Brain
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// --- Constants & Config (Ported from Frontend) ---

// Dimension keys and icons (labels come from i18n)
const dimensionKeys = [
  { key: "clarity", icon: FileText, color: "#2563EB" },
  { key: "evidence", icon: ClipboardCheck, color: "#059669" },
  { key: "impact", icon: TrendingUp, color: "#D97706" },
  { key: "engagement", icon: Heart, color: "#DC2626" },
  { key: "verbal_performance", icon: Mic, color: "#7C3AED" },
  { key: "visual_performance", icon: Video, color: "#DB2777" },
];

const radarColors = {
  grid: "#E2E8F0",      // slate-200
  axis: "#CBD5E1",      // slate-300
  fillSelf: "rgba(59, 130, 246, 0.2)", // blue-500 with opacity
  strokeSelf: "#2563EB", // blue-600
  fillAvg: "rgba(148, 163, 184, 0.1)", // slate-400 with opacity
  strokeAvg: "#94A3B8",  // slate-400
};

// Mock Data
const mockScores = {
  clarity: 85,
  evidence: 90,
  impact: 82,
  engagement: 92,
  verbal_performance: 86,
  visual_performance: 89,
};

const averageScores = {
  clarity: 75,
  evidence: 78,
  impact: 72,
  engagement: 80,
  verbal_performance: 74,
  visual_performance: 76,
};

// --- Components ---

type Dimension = { key: string; label: string; icon: typeof FileText; color: string };

const RadarChart = ({ 
  dimensions,
  scores, 
  averages, 
  size = 300 
}: { 
  dimensions: Dimension[],
  scores: typeof mockScores, 
  averages: typeof averageScores, 
  size?: number 
}) => {
  const center = size / 2;
  const radius = (size / 2) - 40; // Padding for labels
  const numDimensions = dimensions.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / numDimensions - Math.PI / 2;
    const r = (radius * value) / 100;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const selfPoints = dimensions.map((dim, i) => {
    const { x, y } = getPoint(i, scores[dim.key as keyof typeof scores]);
    return `${x},${y}`;
  }).join(" ");

  const avgPoints = dimensions.map((dim, i) => {
    const { x, y } = getPoint(i, averages[dim.key as keyof typeof averages]);
    return `${x},${y}`;
  }).join(" ");

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="relative flex justify-center items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grid */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={dimensions.map((_, i) => {
              const { x, y } = getPoint(i, level);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke={radarColors.grid}
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        {dimensions.map((_, i) => {
          const end = getPoint(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke={radarColors.axis}
              strokeWidth="1"
            />
          );
        })}

        {/* Average Polygon */}
        <polygon
          points={avgPoints}
          fill={radarColors.fillAvg}
          stroke={radarColors.strokeAvg}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Self Polygon */}
        <polygon
          points={selfPoints}
          fill={radarColors.fillSelf}
          stroke={radarColors.strokeSelf}
          strokeWidth="2.5"
        />

        {/* Data Points */}
        {dimensions.map((dim, i) => {
          const { x, y } = getPoint(i, scores[dim.key as keyof typeof scores]);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill={radarColors.strokeSelf}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels */}
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
                    <span style={{ color: radarColors.strokeSelf }}>{scores[dim.key as keyof typeof scores]}</span>
                    <span className="text-gray-300 mx-0.5">|</span>
                    <span className="text-gray-400">{averages[dim.key as keyof typeof averages]}</span>
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

export default function ResultPage() {
  const t = useTranslations('result');
  const dimensions = useMemo(() => dimensionKeys.map((d) => ({ ...d, label: t(`dimensions.${d.key}`) })), [t]);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'qa'>('evaluation');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const [evalData, setEvalData] = useState<any | null>(null);

  useEffect(() => {
    const key = searchParams.get('eval');
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setEvalData(parsed);
      // Frontend debug: print evaluation result JSON
      console.log('[CareerFace] evaluation_result_json', parsed);
    } catch {
      // ignore
    }
  }, [searchParams]);

  const qaPairs = useMemo(() => {
    const interview = Array.isArray(evalData?.interview) ? evalData.interview : [];
    const pairs: Array<{ id: number; question: string; answer: string }> = [];
    let pendingQuestion: string | null = null;

    for (const msg of interview) {
      const role = msg?.role;
      const content = typeof msg?.content === 'string' ? msg.content : '';
      if (!content) continue;

      if (role === 'system') {
        pendingQuestion = content;
        continue;
      }
      if (role === 'user') {
        if (!pendingQuestion) continue;
        pairs.push({
          id: pairs.length + 1,
          question: pendingQuestion,
          answer: content,
        });
        pendingQuestion = null;
      }
    }

    return pairs;
  }, [evalData]);

  const scores = useMemo(() => {
    const dims = evalData?.dimensions || {};
    const out: any = {};
    for (const d of dimensionKeys) {
      out[d.key] = typeof dims?.[d.key]?.score === 'number' ? dims[d.key].score : 0;
    }
    return out as typeof mockScores;
  }, [evalData]);

  const overallScore = useMemo(() => {
    const v = evalData?.overall_score;
    if (typeof v === 'number') return Math.round(v);
    const vals = Object.values(scores);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return Math.round(avg);
  }, [evalData, scores]);

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{t('evaluation_results')}</h1>
            <p className="text-muted-foreground mt-1">
              {evalData?.topic ? `${t('topic_label')}${evalData.topic}` : t('detailed_analysis')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 bg-white hover:bg-gray-50">
              <Download className="h-4 w-4" />
              {t('export_pdf')}
            </Button>
            <Button variant="outline" className="gap-2 bg-white hover:bg-gray-50">
              <Share2 className="h-4 w-4" />
              {t('share_result')}
            </Button>
          </div>
        </div>

        {/* Top Stats Hero Card */}
        <Card className="border-none shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              
              {/* Score Circle */}
              <div className="flex flex-col items-center">
                <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 border-indigo-100 bg-white shadow-inner">
                  <div className="text-center">
                    <span className="block text-4xl font-black text-indigo-600 tracking-tight">{overallScore}</span>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t('overall')}</span>
                  </div>
                  {/* Decorative Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                     <circle cx="60" cy="60" r="58" fill="none" stroke="#e0e7ff" strokeWidth="4" />
                     <circle cx="60" cy="60" r="58" fill="none" stroke="#4f46e5" strokeWidth="4" strokeDasharray={`${(overallScore / 100) * 364} 364`} strokeLinecap="round" />
                  </svg>
                </div>
                <div className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold">
                  <Sparkles size={14} />
                  <span>{evalData?.overall_brief || t('overall_feedback_placeholder')}</span>
                </div>
              </div>

              {/* Stats Info */}
              <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-6 divide-x divide-gray-100">
                <div className="px-4 text-center sm:text-left">
                  <div className="flex items-center gap-2 text-gray-400 mb-1 justify-center sm:justify-start">
                    <Brain size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">{t('topic')}</span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{evalData?.topic || 'Self Introduction'}</p>
                </div>
                <div className="px-4 text-center sm:text-left">
                   <div className="flex items-center gap-2 text-gray-400 mb-1 justify-center sm:justify-start">
                    <Clock size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">{t('duration')}</span>
                  </div>
                  <p className="font-semibold text-gray-900">3 mins 45s</p>
                </div>
                <div className="px-4 text-center sm:text-left">
                   <div className="flex items-center gap-2 text-gray-400 mb-1 justify-center sm:justify-start">
                    <Calendar size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">{t('date')}</span>
                  </div>
                  <p className="font-semibold text-gray-900">Jan 14, 2026</p>
                </div>
                <div className="px-4 text-center sm:text-left">
                   <div className="flex items-center gap-2 text-gray-400 mb-1 justify-center sm:justify-start">
                    <TrendingUp size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">{t('practice')}</span>
                  </div>
                  <p className="font-semibold text-gray-900">#45 Total</p>
                </div>
              </div>

              {/* Action Button */}
               <Link href="/courses">
                <Button size="lg" className="hidden md:flex bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200">
                  {t('new_practice')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: User Dialogue (History) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tabs */}
            <div className="inline-flex w-full rounded-xl bg-white shadow-sm ring-1 ring-black/5 p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors",
                  activeTab === 'evaluation' ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
                )}
                onClick={() => {
                  setActiveTab('evaluation');
                  setExpandedQuestion(null);
                }}
              >
                {t('evaluation_tab')}
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors",
                  activeTab === 'qa' ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
                )}
                onClick={() => {
                  setActiveTab('qa');
                  setExpandedQuestion(null);
                }}
              >
                {t('qa_tab')}
              </button>
            </div>

            {/* Tab 1: Evaluation Result */}
            {activeTab === 'evaluation' && (
              <Card className="border-none shadow-md">
                <CardHeader className="border-b bg-gray-50/50 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900">{t('eval_result_title')}</CardTitle>
                      <CardDescription>{t('eval_result_desc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('brief')}</div>
                    <div className="p-4 bg-white rounded-xl border border-gray-100 text-gray-800 text-sm leading-relaxed shadow-sm">
                      {evalData?.overall_brief || t('no_brief_placeholder')}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(dimensions.filter((d) => evalData?.dimensions?.[d.key]) as typeof dimensions).map((dim) => {
                      const data = evalData?.dimensions?.[dim.key];
                      const score = typeof data?.score === 'number' ? data.score : undefined;
                      const brief = data?.brief_feedback;
                      const feedback = data?.detailed_feedback;

                      return (
                        <div key={dim.key} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-gray-100 text-gray-600">
                                <dim.icon size={14} />
                              </div>
                              <div className="font-semibold text-gray-900">{dim.label}</div>
                            </div>
                            {typeof score === 'number' && (
                              <div className="text-xs font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {score}
                              </div>
                            )}
                          </div>

                          {!!brief && (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('brief')}</div>
                              <div className="text-sm text-gray-700 leading-relaxed">{brief}</div>
                            </div>
                          )}

                          {!!feedback && (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('feedback')}</div>
                              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{feedback}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!evalData && (
                    <div className="text-sm text-gray-500">
                      {t('no_eval_data')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 2: AI Q&A */}
            {activeTab === 'qa' && (
            <Card className="border-none shadow-md h-full">
              <CardHeader className="border-b bg-gray-50/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Mic className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                      <CardTitle className="text-lg text-gray-900">{t('ai_qa_review')}</CardTitle>
                      <CardDescription>{t('qa_desc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
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
                            
                            {/* Collapsed State Preview */}
                            {expandedQuestion !== q.id && (
                              <p className="text-sm text-gray-500 line-clamp-1">{q.answer}</p>
                            )}
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedQuestion === q.id && (
                          <div className="mt-4 pl-12 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* User Answer */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <User size={12} />
                                {t('your_answer')}
                              </div>
                                <div className="p-4 bg-white rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed shadow-sm whitespace-pre-line">
                                {q.answer}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                    {!qaPairs.length && (
                      <div className="p-6 text-sm text-gray-500">
                        {t('no_qa_data')}
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Right Column: Evaluation & Radar */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Radar Chart Card */}
            <Card className="border-none shadow-md overflow-hidden">
               <CardHeader className="border-b bg-gray-50/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">{t('performance_chart')}</CardTitle>
                    <CardDescription>{t('six_dimensions')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center">
                 <RadarChart dimensions={dimensions} scores={scores} averages={averageScores} size={300} />
                 
                 <div className="flex gap-6 mt-6 text-xs text-gray-500">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-blue-500/20 border border-blue-600 rounded-sm"></div>
                     <span>{t('your_score')}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-slate-200 border border-slate-400 border-dashed rounded-sm"></div>
                     <span>{t('average')}</span>
                   </div>
                 </div>
              </CardContent>
            </Card>

            {/* Detailed Scores */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{t('breakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {dimensions.map((dim) => {
                  const score = scores[dim.key as keyof typeof scores];
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

            {/* Overall Feedback Summary */}
            <Card className="border-none shadow-md bg-indigo-600 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />
              
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {t('ai_summary')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-indigo-100 leading-relaxed text-sm">
                  {evalData?.overall_brief || "（暂无整体简评）"}
                </p>
                <Button variant="secondary" size="sm" className="mt-4 w-full bg-white/10 hover:bg-white/20 text-white border-0">
                  {t('view_full_report')}
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  );
}
