import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "react-native";
import { TamaguiProvider, Theme } from "tamagui";
import { tamaguiConfig } from "../../tamagui.config";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnReconnect: true }, mutations: { retry: 0 } },
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";
  return <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}><Theme name={theme}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></Theme></TamaguiProvider>;
}
