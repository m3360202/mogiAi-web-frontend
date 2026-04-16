"use client";

import { useSearchParams } from "next/navigation";
import RoomImpl, { type RoomMode } from "./RoomImpl";

export default function RoomRouter() {
  const searchParams = useSearchParams();
  const mode: RoomMode = searchParams.get("mode") === "discussion" ? "discussion" : "interview";
  return <RoomImpl mode={mode} />;
}

