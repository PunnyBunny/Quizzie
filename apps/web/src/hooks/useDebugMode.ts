import { createContext, useContext } from "react";

export const DebugContext = createContext(false);

export function useDebugMode() {
  return useContext(DebugContext);
}
