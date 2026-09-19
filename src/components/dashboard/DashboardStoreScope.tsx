"use client";

import React from "react";
import { StoreProvider, type State } from "@/lib/store/StoreContext";

/** Nests a StoreProvider seeded with real, server-fetched data around the dashboard tier components, which call useStore() unmodified. */
export function DashboardStoreScope({ data, children }: { data: State; children: React.ReactNode }) {
  return <StoreProvider initialData={data}>{children}</StoreProvider>;
}
