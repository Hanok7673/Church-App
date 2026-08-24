"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

const MAX_RECORDING_SECONDS = 300;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function chooseRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"]
    .find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function uploadMimeType(recordingMimeType: string) {
  const baseType = recordingMimeType.split(";")[0];
  return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"].includes(baseType)
    ? baseType
    : "audio/webm";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/wav") return "wav";
  return "webm";
}

export function VoiceNoteRecorder({ userId, churchId, fellowshipId, onSaved }: {
  userId: string;
  churchId: number;
  fellowshipId: number;
  onSaved: () => Promise<void>;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const previewUrl = useMemo(() => recordedBlob ? URL.createObjectURL(recordedBlob) : "", [recordedBlob]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopTracks();
  }, []);

  const stopRecording = () => {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("यो ब्राउजरमा आवाज रेकर्ड गर्ने सुविधा उपलब्ध छैन। Chrome वा Safari को नयाँ संस्करण प्रयोग गर्नुहोस्।");
      return;
    }
    try {
      setNotice("");
      setRecordedBlob(null);
      setSeconds(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recordingType = chooseRecordingMimeType();
      const recorder = recordingType ? new MediaRecorder(stream, { mimeType: recordingType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = uploadMimeType(recorder.mimeType || recordingType);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob.size > 0 ? blob : null);
        setRecording(false);
        stopTracks();
      };
      recorder.start(1000);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS) window.setTimeout(stopRecording, 0);
          return Math.min(next, MAX_RECORDING_SECONDS);
        });
      }, 1000);
    } catch {
      stopTracks();
      setNotice("माइक्रोफोन अनुमति दिइएन। ब्राउजरको माइक्रोफोन अनुमति खोलेर फेरि प्रयास गर्नुहोस्।");
    }
  };

  const saveRecording = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !recordedBlob) return;
    if (recordedBlob.size > MAX_FILE_BYTES) {
      setNotice("आवाज फाइल १० MB भन्दा ठूलो भयो। छोटो रेकर्डिङ बनाउनुहोस्।");
      return;
    }
    setBusy(true);
    setNotice("");
    const mimeType = uploadMimeType(recordedBlob.type);
    const objectId = window.crypto.randomUUID();
    const path = `${userId}/${churchId}/${fellowshipId}/${objectId}.${extensionForMimeType(mimeType)}`;
    const { error: uploadError } = await client.storage
      .from("member-voice-notes")
      .upload(path, recordedBlob, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setNotice("आवाज फाइल Supabase Storage मा सुरक्षित गर्न सकिएन।");
      setBusy(false);
      return;
    }

    const { error: metadataError } = await client.from("member_voice_notes").insert({
      church_id: churchId,
      fellowship_id: fellowshipId,
      user_id: userId,
      storage_path: path,
      mime_type: mimeType,
      size_bytes: recordedBlob.size,
      duration_seconds: Math.max(1, seconds),
      caption: caption.trim() || null,
    });
    if (metadataError) {
      await client.storage.from("member-voice-notes").remove([path]);
      setNotice("आवाज फाइलको निजी अभिलेख बनाउन सकिएन। अपलोड फिर्ता हटाइएको छ।");
    } else {
      setRecordedBlob(null);
      setCaption("");
      setSeconds(0);
      setNotice("आवाज टिप्पणी निजी रूपमा सुरक्षित भयो।");
      await onSaved();
    }
    setBusy(false);
  };

  return (
    <section className="service-voice-recorder" aria-labelledby="voice-note-heading">
      <div><span aria-hidden="true">●</span><div><p>टाइप गर्न गाह्रो भएमा</p><h3 id="voice-note-heading">आवाज टिप्पणी</h3></div></div>
      <p>अधिकतम ५ मिनेट वा १० MB। आवाज PostgreSQL मा होइन, निजी Supabase Storage मा सुरक्षित हुन्छ र Storage quota प्रयोग गर्छ।</p>
      {recording ? (
        <button className="recording" type="button" onClick={stopRecording}><span aria-hidden="true">■</span> रेकर्ड रोक्नुहोस् · {seconds.toLocaleString("ne-NP")} सेकेन्ड</button>
      ) : (
        <button type="button" onClick={() => void startRecording()} disabled={busy}><span aria-hidden="true">●</span> आवाज रेकर्ड सुरु गर्नुहोस्</button>
      )}
      {recordedBlob && <div className="voice-recording-preview">
        <audio controls src={previewUrl} />
        <label htmlFor="voice-caption">छोटो शीर्षक (ऐच्छिक)</label>
        <input id="voice-caption" maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="जस्तै: आजको वचनबाट पाएको आशिष्" />
        <div><button type="button" onClick={() => { setRecordedBlob(null); setSeconds(0); }}>फेरि रेकर्ड</button><button type="button" className="save" disabled={busy} onClick={() => void saveRecording()}>{busy ? "सुरक्षित हुँदैछ…" : "आवाज सुरक्षित गर्नुहोस्"}</button></div>
      </div>}
      {notice && <p className="service-inline-notice" role="status">{notice}</p>}
    </section>
  );
}
