import { Bell, BookOpen, CalendarDays, Church, Music2 } from "@tamagui/lucide-icons";
import { Button, H1, Paragraph, ScrollView, XStack, YStack } from "tamagui";
import { useAuthStore } from "@/stores/auth-store";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.session?.user);
  return <ScrollView flex={1} bg="$background" contentContainerStyle={{ flexGrow: 1 }}><YStack px="$5" pt="$8" pb="$9" gap="$6"><XStack justifyContent="space-between" alignItems="center"><YStack gap="$1"><Paragraph color="$colorMuted">शुभ दिन</Paragraph><H1 color="$color">{user?.fullName ?? "Church App सदस्य"}</H1></YStack><Button circular size="$5" bg="$backgroundStrong" borderWidth={1} borderColor="$borderColor" icon={Bell} aria-label="सूचनाहरू" /></XStack><YStack bg="$accentBackground" borderRadius="$6" p="$6" gap="$3"><Church size={36} color="$accentColor" /><H1 color="$accentColor">विश्वासमा बढौँ</H1><Paragraph color="$accentColor" opacity={0.82}>तपाईंको मण्डली, आराधना, वचन र सेवाको तयारी एउटै सुरक्षित ठाउँमा।</Paragraph></YStack><XStack flexWrap="wrap" gap="$3">{[[CalendarDays,"तालिका"],[Music2,"आराधना"],[BookOpen,"नेपाली बाइबल"]].map(([Icon,label]) => { const ItemIcon=Icon as typeof Church; return <Button key={String(label)} minHeight={64} flexGrow={1} flexBasis="45%" bg="$backgroundStrong" borderColor="$borderColor" borderWidth={1} borderRadius="$4" icon={ItemIcon}>{String(label)}</Button>; })}</XStack></YStack></ScrollView>;
}
