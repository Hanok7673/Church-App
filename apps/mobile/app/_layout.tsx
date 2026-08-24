import "react-native-reanimated";
import "../tamagui.config";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppProvider } from "@/providers/app-provider";
import { useAuthStore } from "@/stores/auth-store";

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return <AppProvider><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false, animation: "fade" }} /></AppProvider>;
}
