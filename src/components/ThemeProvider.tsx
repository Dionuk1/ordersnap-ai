import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Dark/light theming via next-themes (class strategy, system-aware). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="ordersnap-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
