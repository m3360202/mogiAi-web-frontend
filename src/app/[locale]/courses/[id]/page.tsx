import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { courseIds } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Clock, Users, Target, PlayCircle, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';

export default async function CourseDetailPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const courseId = Number(id);
  if (!courseIds.includes(courseId as (typeof courseIds)[number])) {
    notFound();
  }

  const t = await getTranslations('course_detail');
  const tCourses = await getTranslations('courses');

  // Mock chapters with more detail
  const chapters = [
    { titleKey: "intro", duration: "5 min" },
    { titleKey: "core", duration: "15 min" },
    { titleKey: "case", duration: "20 min" },
    { titleKey: "techniques", duration: "25 min" },
    { titleKey: "pitfalls", duration: "10 min" },
    { titleKey: "advanced", duration: "30 min" },
    { titleKey: "review", duration: "10 min" },
    { titleKey: "quiz", duration: "15 min" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/courses" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors group">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {t('back_to_courses')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-xl ring-1 ring-black/5 overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
              
              <CardHeader className="pb-8 border-b bg-white/50 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                    {courseId}
                  </span>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      <Users className="h-3.5 w-3.5" />
                      {tCourses(`data.${courseId}.target`)}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      ~2.5h
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <CardTitle className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
                    {tCourses(`data.${courseId}.name`)}
                  </CardTitle>
                  <CardDescription className="text-lg text-gray-600 leading-relaxed">
                    {t('subtitle')}
                  </CardDescription>
                </div>

                <div className="flex items-start gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <Target className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-emerald-900 text-sm">{t('learning_goal')}</h4>
                    <p className="text-emerald-700/80 text-sm mt-1">{tCourses(`data.${courseId}.goal`)}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                    {t('syllabus')}
                  </h3>
                  <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                    {chapters.length} {t('lessons')}
                  </span>
                </div>

                <div className="space-y-3">
                  {chapters.map((chapter, idx) => (
                    <div 
                      key={idx} 
                      className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50/30 cursor-default"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold text-xs group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 group-hover:text-emerald-900 transition-colors truncate text-sm sm:text-base">
                          {t(`chapters.${chapter.titleKey}`)}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 group-hover:text-emerald-600/70">
                          <span className="flex items-center gap-1">
                            <PlayCircle className="h-3 w-3" /> {t('video')}
                          </span>
                          <span>•</span>
                          <span>{chapter.duration}</span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Ready to Start Card - Updated Style */}
              <Card className="border-2 border-emerald-100 shadow-xl bg-white overflow-hidden relative">
                {/* Gradient Top Bar */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
                
                {/* Subtle Background Blob */}
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-emerald-50 blur-3xl opacity-50" />
                
                <CardHeader className="pt-8 relative">
                  <CardTitle className="text-xl font-bold text-gray-900">{t('ready_to_start')}</CardTitle>
                  <CardDescription className="text-gray-500">
                    {t('master_skill')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span>{t('realtime_feedback')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span>{t('scenario_selection')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span>{t('detailed_analytics')}</span>
                    </div>
                  </div>

                  <Link href={`/practice/${id}`} className="block w-full">
                    <Button size="lg" className="w-full h-12 text-base font-bold shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all hover:scale-[1.02]">
                      {t('start_practice')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Course Stats Card */}
              <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>{t('completion_rate')}</span>
                    <span className="font-bold text-gray-900">94%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[94%] rounded-full" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    {t('join_employees')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
