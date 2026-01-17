"use client";

import { createContext, useContext } from "react";
import type { UserProfile } from "@/types";

export interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refetch: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}
