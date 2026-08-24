"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type ProvisionNotice = { tone: "success" | "error"; text: string } | null;

function friendlyProvisionError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("no active account")) return "यो इमेलमा सक्रिय खाता भेटिएन। पहिले मण्डली प्रशासकको खाता बनाउनुहोस्।";
  if (normalized.includes("email must be confirmed")) return "मण्डली प्रशासकको इमेल पहिले पुष्टि हुनुपर्छ।";
  if (normalized.includes("must be different accounts")) return "सुपर एडमिन र मण्डली प्रशासक एउटै खाता हुन मिल्दैन।";
  if (normalized.includes("only a platform super")) return "यो काम वास्तविक प्लेटफर्म सुपर एडमिनले मात्र गर्न सक्छ।";
  return "मण्डली दर्ता गर्न सकिएन। नाम र प्रशासक इमेल जाँचेर फेरि प्रयास गर्नुहोस्।";
}

export function SuperAdminChurchProvisioner({ onCreated }: { onCreated: (churchId: number) => Promise<void> }) {
  const [churchName, setChurchName] = useState("");
  const [churchNameNe, setChurchNameNe] = useState("");
  const [churchAddress, setChurchAddress] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ProvisionNotice>(null);

  async function provisionChurch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!client) return;
    if (churchName.trim().length < 3) {
      setNotice({ tone: "error", text: "मण्डलीको नाम कम्तीमा ३ अक्षर लेख्नुहोस्।" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotice({ tone: "error", text: "मण्डली प्रशासकको सही इमेल लेख्नुहोस्।" });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { data, error } = await client.rpc("provision_church", {
      p_name: churchName.trim(),
      p_name_ne: churchNameNe.trim() || null,
      p_address: churchAddress.trim() || null,
      p_admin_email: normalizedEmail,
    });

    if (error || !data?.[0]) {
      setNotice({ tone: "error", text: friendlyProvisionError(error?.message ?? "") });
    } else {
      const created = data[0];
      setChurchName("");
      setChurchNameNe("");
      setChurchAddress("");
      setAdminEmail("");
      setNotice({ tone: "success", text: `“${created.church_name}” दर्ता भयो। ${created.admin_email} लाई मुख्य मण्डली प्रशासक बनाइयो।` });
      await onCreated(created.church_id);
    }
    setBusy(false);
  }

  return (
    <section className="membership-form-card admin-section-card super-admin-provisioner">
      <div className="membership-section-heading"><span>＋</span><div><p>प्लेटफर्म सुपर एडमिन मात्र</p><h2>मण्डली र मुख्य प्रशासक दर्ता</h2></div></div>
      <p className="membership-form-help">पहिले मण्डली प्रशासकको सामान्य Auth खाता बनाउनुहोस्। त्यसपछि त्यही खाताको पुष्टि भएको इमेल यहाँ राख्नुहोस्। सुपर एडमिन आफैँ मण्डली प्रशासक बन्न सक्दैन।</p>
      <form onSubmit={provisionChurch}>
        <label htmlFor="platform-church-name">मण्डलीको मुख्य नाम</label>
        <input id="platform-church-name" maxLength={200} value={churchName} onChange={(event) => setChurchName(event.target.value)} placeholder="जस्तै: Grace Community Church" />
        <label htmlFor="platform-church-name-ne">नेपाली नाम (ऐच्छिक)</label>
        <input id="platform-church-name-ne" maxLength={200} value={churchNameNe} onChange={(event) => setChurchNameNe(event.target.value)} placeholder="जस्तै: अनुग्रह सामुदायिक मण्डली" />
        <label htmlFor="platform-church-address">ठेगाना (ऐच्छिक)</label>
        <input id="platform-church-address" maxLength={500} value={churchAddress} onChange={(event) => setChurchAddress(event.target.value)} placeholder="टोल, शहर" />
        <label htmlFor="platform-admin-email">मुख्य मण्डली प्रशासकको पुष्टि भएको इमेल</label>
        <input id="platform-admin-email" type="email" autoComplete="off" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="church.admin@example.com" />
        <button className="membership-primary-action" type="submit" disabled={busy}>{busy ? "दर्ता गर्दै…" : "मण्डली दर्ता गरी प्रशासक तोक्नुहोस्"}</button>
      </form>
      {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    </section>
  );
}
