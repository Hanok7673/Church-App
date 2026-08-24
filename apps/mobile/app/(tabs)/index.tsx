import { Bell, BookOpen, CalendarDays, ChevronRight, Church, Music2 } from "@tamagui/lucide-icons";
import { Button, H1, H2, Paragraph, ScrollView, XStack, YStack } from "tamagui";
import { useAuthStore } from "@/stores/auth-store";

const QUICK_ACTIONS = [
  { icon: CalendarDays, label: "तालिका", caption: "सेवा र जिम्मेवारी" },
  { icon: Music2, label: "आराधना", caption: "भजन, कोरस र chords" },
  { icon: BookOpen, label: "नेपाली बाइबल", caption: "वचन पढ्नुहोस्" },
] as const;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.session?.user);

  return (
    <ScrollView flex={1} bg="$background" contentContainerStyle={{ flexGrow: 1 }}>
      <YStack width="100%" maxWidth={480} alignSelf="center" px="$4" pt="$5" pb="$8" gap="$5">
        <XStack minHeight={48} justifyContent="space-between" alignItems="center" gap="$3">
          <YStack flex={1} gap="$1">
            <Paragraph size="$2" color="$colorMuted">शुभ दिन</Paragraph>
            <H1 size="$5" lineHeight="$5" color="$color" numberOfLines={1}>
              {user?.fullName ?? "Church App सदस्य"}
            </H1>
          </YStack>
          <Button
            circular
            width={44}
            height={44}
            bg="$backgroundStrong"
            borderWidth={1}
            borderColor="$borderColor"
            icon={<Bell size={20} color="$color" />}
            aria-label="सूचनाहरू"
          />
        </XStack>

        <YStack bg="$accentBackground" borderRadius="$5" p="$5" gap="$3" overflow="hidden">
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack width={42} height={42} borderRadius="$3" bg="$accentColor" alignItems="center" justifyContent="center" opacity={0.96}>
              <Church size={22} color="$accentBackground" />
            </YStack>
            <Paragraph size="$1" px="$2" py="$1" borderRadius="$7" bg="$goldSoft" color="$tealDeep" fontWeight="800">
              आजको यात्रा
            </Paragraph>
          </XStack>
          <YStack gap="$2">
            <H1 size="$6" lineHeight="$6" color="$accentColor">विश्वासमा बढौँ</H1>
            <Paragraph size="$2" lineHeight="$3" color="$accentColor" opacity={0.84}>
              मण्डली, आराधना, वचन र सेवाको तयारी एउटै सुरक्षित ठाउँमा।
            </Paragraph>
          </YStack>
          <Button
            alignSelf="flex-start"
            minHeight={44}
            px="$4"
            borderRadius="$7"
            bg="$accentColor"
            color="$accentBackground"
            fontWeight="800"
            iconAfter={<ChevronRight size={18} color="$accentBackground" />}
          >
            आजको तालिका
          </Button>
        </YStack>

        <YStack gap="$3">
          <XStack alignItems="flex-end" justifyContent="space-between">
            <YStack gap="$1">
              <H2 size="$5" lineHeight="$5" color="$color">छिटो खोल्नुहोस्</H2>
              <Paragraph size="$2" color="$colorMuted">दैनिक रूपमा प्रयोग हुने सामग्री</Paragraph>
            </YStack>
          </XStack>

          <XStack flexWrap="wrap" gap="$3">
            {QUICK_ACTIONS.map(({ icon: ItemIcon, label, caption }) => (
              <Button
                key={label}
                unstyled
                minHeight={112}
                flexGrow={1}
                flexBasis="45%"
                p="$4"
                bg="$backgroundStrong"
                borderColor="$borderColor"
                borderWidth={1}
                borderRadius="$4"
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <YStack width={38} height={38} borderRadius="$3" bg="$tealSoft" alignItems="center" justifyContent="center">
                  <ItemIcon size={20} color="$tealDeep" />
                </YStack>
                <YStack width="100%" gap="$1">
                  <Paragraph size="$3" color="$color" fontWeight="800">{label}</Paragraph>
                  <Paragraph size="$1" color="$colorMuted" numberOfLines={1}>{caption}</Paragraph>
                </YStack>
              </Button>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </ScrollView>
  );
}
