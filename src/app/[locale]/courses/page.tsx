import { use } from 'react';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { courseIds } from '@/lib/mock-data';
import { BookOpen, Users, Target, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CoursesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('courses');

  // 设计升级：每门课分配一个独特的主题色系（Tailwind 类名）
  // 循环使用：Emerald(绿), Blue(蓝), Violet(紫), Amber(琥珀), Rose(红), Cyan(青)
  const getTheme = (id: number) => {
    const themes = [
      { bg: "bg-emerald-50 hover:bg-emerald-100", border: "border-emerald-200", text: "text-emerald-900", subtext: "text-emerald-600/80", icon: "bg-emerald-100 text-emerald-700", watermark: "text-emerald-900/5" },
      { bg: "bg-blue-50 hover:bg-blue-100", border: "border-blue-200", text: "text-blue-900", subtext: "text-blue-600/80", icon: "bg-blue-100 text-blue-700", watermark: "text-blue-900/5" },
      { bg: "bg-violet-50 hover:bg-violet-100", border: "border-violet-200", text: "text-violet-900", subtext: "text-violet-600/80", icon: "bg-violet-100 text-violet-700", watermark: "text-violet-900/5" },
      { bg: "bg-amber-50 hover:bg-amber-100", border: "border-amber-200", text: "text-amber-900", subtext: "text-amber-700/80", icon: "bg-amber-100 text-amber-700", watermark: "text-amber-900/5" },
      { bg: "bg-rose-50 hover:bg-rose-100", border: "border-rose-200", text: "text-rose-900", subtext: "text-rose-600/80", icon: "bg-rose-100 text-rose-700", watermark: "text-rose-900/5" },
      { bg: "bg-cyan-50 hover:bg-cyan-100", border: "border-cyan-200", text: "text-cyan-900", subtext: "text-cyan-600/80", icon: "bg-cyan-100 text-cyan-700", watermark: "text-cyan-900/5" },
    ];
    return themes[(id - 1) % themes.length];
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10">
      <div className="mx-auto max-w-[1400px] space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col gap-2 border-l-4 border-primary pl-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-12 xl:grid-cols-12">
          
          {/* Left: 12 Grid Selection (Interactive Cards) */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {t('course_grid')}
              </h2>
            </div>
            
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {courseIds.map((id) => {
                const theme = getTheme(id);
                return (
                  <Link key={id} href={`/courses/${id}`} className="group block h-full outline-none">
                    <Card className={cn(
                      "relative h-full min-h-[140px] sm:min-h-[160px] cursor-pointer overflow-hidden border shadow-sm transition-all duration-300", // Increased min-height
                      "group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary",
                      theme.bg,
                      theme.border
                    )}>
                      {/* Artistic Watermark Number */}
                      <div className={cn(
                        "absolute -bottom-4 -right-2 text-[5rem] font-black leading-none select-none pointer-events-none transition-transform duration-500 group-hover:scale-110",
                        theme.watermark
                      )}>
                        {id}
                      </div>

                      <CardContent className="flex h-full flex-col items-start justify-between p-3 sm:p-4 gap-4"> {/* Added gap */}
                        <div className="flex w-full items-start justify-between">
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-sm sm:h-7 sm:w-7 sm:text-xs",
                            "bg-white/80 backdrop-blur-sm",
                            theme.text
                          )}>
                            {id}
                          </span>
                          <Sparkles className={cn("h-4 w-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100", theme.text)} />
                        </div>
                        
                        <div className="w-full z-10"> {/* Added z-index to ensure text is above watermark if needed */}
                          <h3 className={cn(
                            "line-clamp-3 text-xs font-bold leading-relaxed tracking-tight sm:text-sm",
                            theme.text
                          )}>
                            {t(`data.${id}.name`)}
                          </h3>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Table View */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {t('list_title')}
              </h2>
            </div>

            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-black/5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/80">
                    <TableRow className="hover:bg-transparent border-b-gray-200">
                      <TableHead className="w-[60px] text-center font-bold text-gray-700 whitespace-nowrap">{t('table.id')}</TableHead>
                      <TableHead className="w-[180px] font-bold text-gray-700 whitespace-nowrap">{t('table.name')}</TableHead>
                      {/* 调整了列宽：从 w-[140px] 增加到 w-[200px]，并添加了 min-w 保证最小宽度 */}
                      <TableHead className="w-[200px] min-w-[160px] hidden md:table-cell font-bold text-gray-700 whitespace-nowrap">{t('table.target')}</TableHead>
                      <TableHead className="hidden lg:table-cell font-bold text-gray-700 whitespace-nowrap">{t('table.content')}</TableHead>
                      <TableHead className="w-[60px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseIds.map((id) => (
                      <TableRow key={id} className="group cursor-pointer hover:bg-gray-50/80 border-b-gray-100 last:border-0 transition-colors">
                        <TableCell className="text-center font-medium text-gray-500 group-hover:text-primary transition-colors">
                          {id}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          <div className="flex flex-col">
                            <span>{t(`data.${id}.name`)}</span>
                            <span className="md:hidden text-xs text-muted-foreground mt-1 font-normal">{t(`data.${id}.target`)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-gray-600">
                          {/* 优化 Badge：允许内容自然撑开，添加 whitespace-normal 允许换行 */}
                          <div className="inline-flex items-start gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 w-fit max-w-full leading-normal">
                            <Users className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-500" />
                            <span className="break-words">{t(`data.${id}.target`)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                          {t(`data.${id}.content`)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/courses/${id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
