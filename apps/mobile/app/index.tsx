import { Redirect } from "expo-router";
import { Spinner, YStack } from "tamagui";
import { useAuthStore } from "@/stores/auth-store";

export default function Index() {
  const { hydrated, session } = useAuthStore();
  if (!hydrated) return <YStack flex={1} alignItems="center" justifyContent="center" bg="$background"><Spinner size="large" color="$accentBackground" /></YStack>;
  return <Redirect href={session ? "/(tabs)" : "/(auth)/sign-up"} />;
}
