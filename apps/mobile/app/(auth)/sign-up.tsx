import { ArrowRight, Check, ChevronRight, Church, Eye, EyeOff, LockKeyhole, MapPin, ShieldCheck, UserRound } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Button,
  H1,
  H2,
  Input,
  Label,
  Paragraph,
  ScrollView,
  Spinner,
  Switch,
  TextArea,
  XStack,
  YStack,
} from "tamagui";
import { ApiError } from "@/lib/api";
import { useJoinableChurches, useRegister, type RegisterInput } from "@/features/onboarding/api";
import { useAuthStore } from "@/stores/auth-store";

const GENDERS: Array<{ value: RegisterInput["gender"]; label: string }> = [
  { value: "female", label: "महिला" },
  { value: "male", label: "पुरुष" },
  { value: "other", label: "अन्य" },
  { value: "prefer_not_to_say", label: "भन्न नचाहने" },
];

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: RegisterInput["gender"] | null;
  permanentAddress: string;
  temporaryAddress: string;
  password: string;
  passwordConfirm: string;
};

const INITIAL_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: null,
  permanentAddress: "",
  temporaryAddress: "",
  password: "",
  passwordConfirm: "",
};

export default function SignUpScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const churches = useJoinableChurches();
  const register = useRegister();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [sameAddress, setSameAddress] = useState(true);
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedChurch = useMemo(() => churches.data?.find((church) => church.id === selectedChurchId) ?? null, [churches.data, selectedChurchId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function validate() {
    if (form.fullName.trim().length < 2) return "कृपया आफ्नो पूरा नाम लेख्नुहोस्।";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "सही इमेल ठेगाना लेख्नुहोस्।";
    if (!/^(97|98)\d{8}$/.test(form.phone.replace(/\D/g, ""))) return "९७ वा ९८ बाट सुरु हुने १० अङ्कको मोबाइल नम्बर लेख्नुहोस्।";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) || new Date(`${form.dateOfBirth}T00:00:00`) >= new Date()) return "जन्ममिति YYYY-MM-DD ढाँचामा लेख्नुहोस्।";
    if (!form.gender) return "लिङ्गसम्बन्धी विकल्प छान्नुहोस्।";
    if (form.permanentAddress.trim().length < 3) return "स्थायी ठेगाना लेख्नुहोस्।";
    if (!sameAddress && form.temporaryAddress.trim().length < 3) return "हाल बसोबास गर्ने ठेगाना लेख्नुहोस्।";
    if (form.password.length < 8) return "पासवर्ड कम्तीमा ८ अक्षरको हुनुपर्छ।";
    if (form.password !== form.passwordConfirm) return "दुवै पासवर्ड मिलेनन्।";
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) return setNotice(validationError);
    const payload: RegisterInput = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      fullName: form.fullName.trim(),
      phone: `+977${form.phone.replace(/\D/g, "")}`,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender!,
      permanentAddress: form.permanentAddress.trim(),
      temporaryAddress: sameAddress ? form.permanentAddress.trim() : form.temporaryAddress.trim(),
      ...(selectedChurchId ? { churchId: selectedChurchId } : {}),
    };
    try {
      const session = await register.mutateAsync(payload);
      await setSession(session);
      router.replace("/(tabs)");
    } catch (error) {
      setNotice(error instanceof ApiError && error.code === "CONFLICT" ? "यो इमेलबाट खाता पहिले नै बनेको छ।" : error instanceof Error ? error.message : "खाता बनाउन सकिएन। फेरि प्रयास गर्नुहोस्।");
    }
  }

  return (
    <ScrollView flex={1} bg="$background" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <YStack px="$4" pt="$5" pb="$8" gap="$5" maxWidth={480} width="100%" alignSelf="center">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$3">
            <YStack width={44} height={44} borderRadius="$3" bg="$accentBackground" alignItems="center" justifyContent="center"><Church size={23} color="$accentColor" /></YStack>
            <YStack><H2 size="$4" lineHeight="$4" color="$color">Church App</H2><Paragraph size="$1" color="$colorMuted">नेपाली मण्डलीको डिजिटल घर</Paragraph></YStack>
          </XStack>
          <YStack px="$2" py="$1" borderRadius="$7" bg="$goldSoft"><Paragraph size="$1" fontWeight="700" color="$tealDeep">सुरक्षित दर्ता</Paragraph></YStack>
        </XStack>

        <YStack gap="$2">
          <Paragraph size="$2" color="$accentBackground" fontWeight="800" letterSpacing={0.7}>नयाँ सदस्य खाता</Paragraph>
          <H1 color="$color" size="$6" lineHeight="$6">तपाईंको मण्डली परिवारसँग जोडिनुहोस्</H1>
          <Paragraph color="$colorMuted" size="$3" lineHeight="$3">एकपटक विवरण पूरा गर्नुहोस्। तपाईंले मण्डली छान्नुभयो भने प्रशासककहाँ सामान्य सदस्यताको अनुरोध मात्र जान्छ।</Paragraph>
        </YStack>

        <FormSection icon={UserRound} eyebrow="व्यक्तिगत परिचय" title="आधारभूत विवरण">
          <Field label="पूरा नाम"><Input value={form.fullName} onChangeText={(value) => update("fullName", value)} placeholder="जस्तै: सारा तामाङ" autoComplete="name" minHeight={48} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>
          <Field label="जन्ममिति"><Input value={form.dateOfBirth} onChangeText={(value) => update("dateOfBirth", value)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" minHeight={48} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>
          <Field label="मोबाइल नम्बर"><XStack minHeight={48} borderWidth={1} borderColor="$borderColor" borderRadius="$3" bg="$background" alignItems="center" px="$3"><Paragraph fontWeight="700" color="$colorMuted">+977</Paragraph><Input unstyled flex={1} value={form.phone.replace(/\D/g, "").slice(0, 10)} onChangeText={(value) => update("phone", value)} placeholder="98XXXXXXXX" keyboardType="phone-pad" autoComplete="tel" px="$2" /></XStack></Field>
          <Field label="लिङ्ग"><XStack gap="$2" flexWrap="wrap">{GENDERS.map((item) => { const active=form.gender===item.value; return <Button key={item.value} minHeight={44} borderRadius="$7" bg={active ? "$accentBackground" : "$background"} color={active ? "$accentColor" : "$color"} borderWidth={1} borderColor={active ? "$accentBackground" : "$borderColor"} {...(active ? { icon: Check } : {})} onPress={() => update("gender", item.value)}>{item.label}</Button>; })}</XStack></Field>
        </FormSection>

        <FormSection icon={MapPin} eyebrow="निजी विवरण" title="ठेगाना">
          <Field label="स्थायी ठेगाना"><TextArea value={form.permanentAddress} onChangeText={(value) => update("permanentAddress", value)} placeholder="प्रदेश, जिल्ला, पालिका, वडा र टोल" minHeight={80} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>
          <XStack minHeight={52} p="$3" bg="$background" borderWidth={1} borderColor="$borderColor" borderRadius="$3" alignItems="center" justifyContent="space-between" gap="$3"><YStack flex={1} gap="$1"><Paragraph size="$2" fontWeight="700" color="$color">हालको ठेगाना उही छ</Paragraph><Paragraph size="$1" color="$colorMuted">फरक बसोबास भए बन्द गर्नुहोस्।</Paragraph></YStack><Switch size="$3" checked={sameAddress} onCheckedChange={setSameAddress} bg={sameAddress ? "$accentBackground" : "$borderColor"}><Switch.Thumb bg="$backgroundStrong" /></Switch></XStack>
          {!sameAddress && <Field label="अस्थायी / हालको ठेगाना"><TextArea value={form.temporaryAddress} onChangeText={(value) => update("temporaryAddress", value)} placeholder="अहिले बसोबास गर्ने पूरा ठेगाना" minHeight={80} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>}
        </FormSection>

        <FormSection icon={Church} eyebrow="सदस्यता" title="आफ्नो मण्डली छान्नुहोस्" optional>
          {churches.isLoading ? <XStack minHeight={64} alignItems="center" justifyContent="center"><Spinner color="$accentBackground" /><Paragraph ml="$3" size="$2" color="$colorMuted">मण्डली सूची लोड हुँदैछ…</Paragraph></XStack> : churches.isError ? <Notice text="मण्डली सूची अहिले लोड भएन। तपाईं मण्डली पछि पनि छान्न सक्नुहुन्छ।" /> : <YStack gap="$2"><ChurchChoice active={selectedChurchId === null} title="पछि छान्छु" subtitle="खाता बनेपछि सदस्यता स्क्रिनबाट छान्नुहोस्।" onPress={() => setSelectedChurchId(null)} />{churches.data?.map((church) => <ChurchChoice key={church.id} active={church.id === selectedChurchId} title={church.nameNe || church.name} subtitle={church.address || "ठेगाना उल्लेख गरिएको छैन"} onPress={() => setSelectedChurchId(church.id)} />)}</YStack>}
          {selectedChurch && <XStack p="$3" bg="$tealSoft" borderRadius="$3" gap="$3" alignItems="center"><ShieldCheck color="$tealDeep" size={22} /><Paragraph flex={1} size="$2" color="$tealDeep"><Paragraph fontWeight="800">{selectedChurch.nameNe || selectedChurch.name}</Paragraph> का प्रशासकले स्वीकृत गरेपछि मात्र सदस्य सामग्री खुल्छ।</Paragraph></XStack>}
        </FormSection>

        <FormSection icon={LockKeyhole} eyebrow="खाता सुरक्षा" title="प्रवेश विवरण">
          <Field label="इमेल ठेगाना"><Input value={form.email} onChangeText={(value) => update("email", value)} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" minHeight={48} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>
          <Field label="पासवर्ड"><XStack minHeight={48} borderWidth={1} borderColor="$borderColor" borderRadius="$3" bg="$background" alignItems="center"><Input unstyled flex={1} px="$3" value={form.password} onChangeText={(value) => update("password", value)} placeholder="कम्तीमा ८ अक्षर" secureTextEntry={!showPassword} autoComplete="new-password" /><Button unstyled width={48} height={48} alignItems="center" justifyContent="center" icon={showPassword ? EyeOff : Eye} onPress={() => setShowPassword((current) => !current)} aria-label={showPassword ? "पासवर्ड लुकाउनुहोस्" : "पासवर्ड देखाउनुहोस्"} /></XStack></Field>
          <Field label="पासवर्ड फेरि लेख्नुहोस्"><Input value={form.passwordConfirm} onChangeText={(value) => update("passwordConfirm", value)} placeholder="उही पासवर्ड" secureTextEntry={!showPassword} autoComplete="new-password" minHeight={48} borderRadius="$3" bg="$background" borderColor="$borderColor" /></Field>
        </FormSection>

        {notice && <Notice text={notice} />}

        <Button minHeight={52} borderRadius="$3" bg="$accentBackground" color="$accentColor" fontWeight="800" size="$4" {...(register.isPending ? {} : { iconAfter: ArrowRight })} disabled={register.isPending} opacity={register.isPending ? 0.72 : 1} onPress={() => void submit()}>{register.isPending ? <XStack gap="$3" alignItems="center"><Spinner color="$accentColor" /><Paragraph color="$accentColor" fontWeight="800">खाता सुरक्षित गर्दै…</Paragraph></XStack> : "सुरक्षित खाता बनाउनुहोस्"}</Button>
        <Paragraph textAlign="center" size="$2" color="$colorMuted">तपाईंको जन्ममिति, फोन, लिङ्ग र ठेगाना निजी रहन्छन् र सदस्य सूचीमा देखाइँदैनन्।</Paragraph>
      </YStack>
    </ScrollView>
  );
}

function FormSection({ icon: Icon, eyebrow, title, optional = false, children }: { icon: typeof Church; eyebrow: string; title: string; optional?: boolean; children: React.ReactNode }) {
  return <YStack bg="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius="$4" p="$4" gap="$4"><XStack alignItems="center" gap="$3"><YStack width={40} height={40} borderRadius="$3" bg="$tealSoft" alignItems="center" justifyContent="center"><Icon size={21} color="$tealDeep" /></YStack><YStack flex={1}><XStack alignItems="center" gap="$2"><Paragraph size="$1" fontWeight="800" color="$accentBackground">{eyebrow}</Paragraph>{optional && <Paragraph size="$1" px="$2" py="$1" borderRadius="$7" bg="$goldSoft" color="$tealDeep">ऐच्छिक</Paragraph>}</XStack><H2 size="$5" lineHeight="$5" color="$color">{title}</H2></YStack></XStack><YStack gap="$3">{children}</YStack></YStack>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <YStack gap="$1"><Label size="$2" color="$color" fontWeight="700">{label}</Label>{children}</YStack>;
}

function ChurchChoice({ active, title, subtitle, onPress }: { active: boolean; title: string; subtitle: string; onPress: () => void }) {
  return <Button unstyled minHeight={56} px="$3" py="$2" borderWidth={1} borderColor={active ? "$accentBackground" : "$borderColor"} bg={active ? "$tealSoft" : "$background"} borderRadius="$3" onPress={onPress}><XStack flex={1} alignItems="center" gap="$3"><YStack width={34} height={34} borderRadius="$7" bg={active ? "$accentBackground" : "$backgroundStrong"} borderWidth={1} borderColor={active ? "$accentBackground" : "$borderColor"} alignItems="center" justifyContent="center">{active ? <Check size={18} color="$accentColor" /> : <Church size={17} color="$colorMuted" />}</YStack><YStack flex={1} gap="$1"><Paragraph size="$2" fontWeight="800" color="$color">{title}</Paragraph><Paragraph size="$1" color="$colorMuted">{subtitle}</Paragraph></YStack><ChevronRight size={18} color="$colorMuted" /></XStack></Button>;
}

function Notice({ text }: { text: string }) {
  return <XStack p="$3" bg="$goldSoft" borderRadius="$3" gap="$2" alignItems="flex-start"><ShieldCheck size={20} color="$tealDeep" /><Paragraph flex={1} size="$2" color="$tealDeep" fontWeight="600">{text}</Paragraph></XStack>;
}
