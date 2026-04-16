"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, ArrowRight, User, TrendingUp, Briefcase, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function HistoryListPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations(); // using global or specific translation
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  useEffect(() => {
    async function fetchHistoryList() {
      if (!initialized) return;
      try {
        const filters: string[] = [];
        if (session?.user?.id) filters.push(`supabase_user_id.eq.${session.user.id}`);
        if (profile?.id) filters.push(`user_id.eq.${profile.id}`);
        if (!filters.length) {
          setHistoryList([]);
          return;
        }

        const supabase = getSupabaseClient();
        let query = supabase
          .from('web_history')
          .select('id, mode, interview_type, practice_category, position, overall_score, created_at')
          .order('created_at', { ascending: false });

        query = filters.length === 1
          ? (filters[0].startsWith('supabase_user_id')
            ? query.eq('supabase_user_id', session!.user.id)
            : query.eq('user_id', profile!.id))
          : query.or(filters.join(','));

        const { data, error } = await query;
          
        if (error) throw error;
        setHistoryList(data || []);
      } catch (err) {
        console.error('Failed to fetch history list:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistoryList();
  }, [initialized, session?.user?.id, profile?.id]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10">
      <div className="mx-auto max-w-[1200px] space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-2 border-l-4 border-primary pl-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">History Records</h1>
          <p className="text-muted-foreground">Review your past interview sessions and track your progress.</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading history records...</div>
        ) : historyList.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No records found</h3>
              <p className="mt-1 text-sm text-gray-500">You haven't completed any interview practices yet.</p>
              <Link href="/courses">
                <Button className="mt-6">Start a Practice</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-none shadow-sm ring-1 ring-black/5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="hover:bg-transparent border-b-gray-200">
                    <TableHead className="font-bold text-gray-700 whitespace-nowrap">Date</TableHead>
                    <TableHead className="font-bold text-gray-700 whitespace-nowrap">Type & Position</TableHead>
                    <TableHead className="font-bold text-gray-700 whitespace-nowrap">Score</TableHead>
                    <TableHead className="font-bold text-gray-700 whitespace-nowrap text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyList.map((record) => (
                    <TableRow key={record.id} className="group hover:bg-gray-50/80 border-b-gray-100 last:border-0 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        {new Date(record.created_at).toLocaleDateString()}
                        <div className="text-xs text-gray-500 font-normal">
                          {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            {record.position || 'General Practice'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
                              <Briefcase className="h-3 w-3" />
                              {record.interview_type || record.mode}
                            </span>
                            {record.practice_category && (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md capitalize">
                                <TrendingUp className="h-3 w-3" />
                                {record.practice_category}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-sm font-bold w-10 h-10 rounded-full flex items-center justify-center",
                            record.overall_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                            record.overall_score >= 60 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {record.overall_score || 0}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <Link href={`/history/${record.id}`}>
                          <Button variant="ghost" className="gap-2 text-primary hover:bg-primary/10">
                            Review
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
        )}
      </div>
    </div>
  );
}
