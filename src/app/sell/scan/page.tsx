"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/uploads";

type ScanResult = {
  card_name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  language: string | null;
  variant: string | null;
  category: string;
  title: string;
  description: string;
  confidence: number;
  estimated_price: number | null;
  low_price: number | null;
  high_price: number | null;
  source: string;
  source_image_url: string;
  draft?: {
    card_name: string;
    set_name: string;
    card_number: string | null;
    rarity: string | null;
    condition: string;
    category: string;
    price: number;
    quantity: number;
    description: string | null;
    images: string[];
    status: "active";
  };
};

const CAMERA_SETTINGS = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

const MAX_CAPTURE_EDGE = 1600;
const JPEG_QUALITY = 0.86;

type ScanResponseError = {
  error?: string;
  stage?: string;
};

function formatPrice(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "Unavailable";
}

async function fileFromCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Unable to process the captured image.");
  return new File([blob], fileName.replace(/\.[^.]+$/, "") || "scan.jpg", { type: "image/jpeg" });
}

async function compressImageFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longestEdge > MAX_CAPTURE_EDGE ? MAX_CAPTURE_EDGE / longestEdge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to process the selected image.");

  context.drawImage(bitmap, 0, 0, width, height);
  return fileFromCanvas(canvas, file.name);
}

async function captureFrame(video: HTMLVideoElement, fileName: string) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("Camera is still loading. Try again in a moment.");

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to capture the camera image.");

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return fileFromCanvas(canvas, fileName);
}

export default function ScanCardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!alive) return;
      if (!user) router.replace("/auth?redirectTo=/sell/scan");
    });

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    setMessage(null);
    setCameraBusy(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        throw new Error("Camera access is not available in this browser. Use upload instead.");
      }

      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_SETTINGS, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => null);
      }
    } catch (cameraError) {
      stopCamera();
      setError(cameraError instanceof Error ? cameraError.message : "Unable to start the camera.");
      setMessage("If the camera fails, upload a clear photo instead.");
    } finally {
      setCameraBusy(false);
    }
  };

  const runScan = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Please keep the file under ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.`);
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setFileName(file.name);

    try {
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch("/api/sell/scan", {
        method: "POST",
        body: payload,
      });
      const data = await response.json().catch(() => ({} as ScanResponseError & { result?: ScanResult }));

      if (!response.ok) {
        const stagePrefix = data.stage ? `${data.stage}: ` : "";
        throw new Error(stagePrefix + (data.error ?? "Scan failed."));
      }

      const nextResult = data.result ?? null;
      setResult(nextResult);
      setMessage(nextResult?.confidence && nextResult.confidence < 50 ? "Fallback scan complete. Please review the details before publishing." : "Scan complete. Review the draft and publish when ready.");
      if (nextResult?.source?.toLowerCase().includes("fallback") || nextResult?.source?.toLowerCase().includes("manual")) {
        setError("Automated recognition was unavailable, so a fallback match was used.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      setError("Choose a card photo first.");
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      await runScan(compressed);
      event.currentTarget.reset();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    }
  };

  const handleCapture = async () => {
    if (!cameraActive || !videoRef.current) {
      setError("Start the camera first.");
      return;
    }

    try {
      const file = await captureFrame(videoRef.current, `scan-${Date.now()}.jpg`);
      await runScan(file);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Unable to capture the card.");
    }
  };

  const saveDraftToListingBuilder = () => {
    if (!result) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "tcgpm:scan-card:draft",
      JSON.stringify({
        form: {
          card_name: result.card_name,
          set_name: result.set_name,
          card_number: result.card_number ?? "",
          rarity: result.rarity ?? "",
          condition: "Near Mint",
          category:
            result.category === "single"
              ? "single"
              : result.category === "sealed"
                ? "sealed"
                : result.category === "graded"
                  ? "graded"
                  : "accessory",
          grade_company: "",
          grade_score: "",
          price: (result.estimated_price ?? result.low_price ?? result.high_price ?? 0).toFixed(2),
          quantity: "1",
          description: result.description,
          status: "active",
        },
        imageUrls: [result.source_image_url],
        coverImageIndex: 0,
      }),
    );
    router.push("/listings/create");
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6 lg:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">Seller scanner</div>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Scan a Pokémon card</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">Use your camera first or upload a photo. The scan will turn into a listing draft when it succeeds.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5">Dashboard</Link>
            <Link href="/listings/create" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">Create listing</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-6 shadow-2xl shadow-black/20">
            <div className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Camera capture</div>
              <p className="text-sm text-gray-400">Best results come from a flat, well-lit card with no glare. Use upload if the camera won’t start.</p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <video ref={videoRef} playsInline muted autoPlay className={`h-full min-h-[320px] w-full object-cover ${cameraActive ? "block" : "hidden"}`} />
              {!cameraActive && (
                <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center text-sm text-gray-400">
                  <div className="text-5xl">📷</div>
                  <p className="mt-4 max-w-sm">Start the camera to scan with your device, or upload a card image instead.</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={startCamera} disabled={cameraBusy} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
                {cameraBusy ? "Starting camera..." : cameraActive ? "Restart camera" : "Open camera"}
              </button>
              <button type="button" onClick={handleCapture} disabled={!cameraActive || loading} className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-50">
                Capture card
              </button>
              <button type="button" onClick={stopCamera} disabled={!cameraActive} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50">
                Stop camera
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Upload fallback</div>
                <p className="mt-2 text-sm text-gray-400">Use this if the camera fails or if you already have a photo saved on the device.</p>
              </div>
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
              <p className="text-xs text-gray-500">Accepted: JPEG, PNG, WebP, GIF. Max {Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB after upload.</p>
              <button type="submit" disabled={loading} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
                {loading ? "Scanning..." : "Scan uploaded image"}
              </button>
            </form>

            {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</div>}
            {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
            {fileName && <p className="text-xs text-gray-500">Last file processed: {fileName}</p>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
            <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Scan results</div>
            {!result ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">Your scan results will appear here after capture or upload.</div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#13131f]">
                  <div className="aspect-[4/3] bg-black/20">
                    <img src={result.source_image_url} alt={result.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{result.title}</h2>
                      {result.confidence < 50 ? <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-300">Fallback</span> : null}
                    </div>
                    <p className="text-sm text-gray-400">{result.description}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Card name", result.card_name],
                    ["Set", result.set_name],
                    ["Card number", result.card_number ?? "—"],
                    ["Rarity", result.rarity ?? "—"],
                    ["Language", result.language ?? "—"],
                    ["Variant", result.variant ?? "—"],
                    ["Confidence", `${result.confidence}%`],
                    ["Price", formatPrice(result.estimated_price)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                      <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Market source</span>
                    <span className="font-semibold text-white">{result.source}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span>Low / high</span>
                    <span className="font-semibold text-white">{formatPrice(result.low_price)} · {formatPrice(result.high_price)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={saveDraftToListingBuilder} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300">Send to listing draft</button>
                  <Link href="/sell" className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5">Back to listing builder</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
