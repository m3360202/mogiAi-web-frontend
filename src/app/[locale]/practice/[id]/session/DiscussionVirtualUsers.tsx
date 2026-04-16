"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DiscussionVirtualRole = {
  role_id: string;
  name: string;
  avatar?: string | null;
};

export function DiscussionVirtualUsers(props: {
  roles: DiscussionVirtualRole[];
  className?: string;
}) {
  const roles = props.roles || [];
  if (!roles.length) return null;

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-4", props.className)}>
      {roles.map((r) => (
        <Card key={r.role_id} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1 bg-indigo-50 text-indigo-700 text-2xl">
              {r.avatar || "🤖"}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900">{r.name}</p>
              <p className="text-xs text-muted-foreground">AI</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

