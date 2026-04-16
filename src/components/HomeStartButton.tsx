"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslations } from "next-intl";

export default function HomeStartButton() {
  const t = useTranslations("home");
  const user = useAuthStore((s) => s.user);

  const href = user ? "/courses" : "/login";
  // Per requirement: show "Login" on homepage, and if already logged in, jump to courses.
  const label = t("login");

  return (
    <Link href={href}>
      <Button size="lg">{label}</Button>
    </Link>
  );
}

