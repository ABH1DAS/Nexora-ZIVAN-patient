"use client";

import type { ReactNode } from "react";

export function HospitalAuthGuard({ children }: { children: ReactNode }) {
  // Always render protected children directly with active hospital demo session
  return <>{children}</>;
}
