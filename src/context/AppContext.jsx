import React, { createContext, useContext } from "react";

// Shared context exposing App-level state, actions and constants to extracted
// components that previously relied on closure access (OCard, etc.).
export const AppContext = createContext(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppContext.Provider>");
  return ctx;
};
