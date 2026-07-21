"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { motion, Reorder } from "framer-motion";
import {
  Plus,
  Sparkles,
  ArrowLeft,
  X,
  GripVertical,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { renderStrip } from "@/lib/strip";
import { getSocket } from "@/lib/socket";
import type { CapturedPhoto, StripLayout } from "@/lib/types";

const LAYOUTS: { id: StripLayout; name: string; desc: string; icon: string }[] =
  [
    { id: "classic", name: "Classic", desc: "Vertical film strip", icon: "🎞️" },
    {
      id: "magazine",
      name: "Magazine",
      desc: "Big hero + side shots",
      icon: "📰",
    },
    { id: "couple", name: "Couple", desc: "Side-by-side pairs", icon: "💕" },
    { id: "memory", name: "Memory", desc: "Polaroid card style", icon: "📷" },
  ];

const QUICK_STICKERS = [
  "❤️",
  "💕",
  "✨",
  "🎉",
  "😍",
  "🥰",
  "😂",
  "🔥",
  "💫",
  "🌸",
  "🦋",
  "🌈",
  "⭐",
  "🎊",
  "💖",
  "🥳",
  "😘",
  "💯",
  "🙌",
  "👑",
  "🌺",
  "🍓",
  "🫶",
  "💝",
  "🎀",
  "🧸",
  "🪄",
  "🌙",
  "☁️",
  "🦄",
];

export default function StripBuilderView() {
  // const {
  //   capturedPhotos,
  //   stripLayout,
  //   setStripLayout,
  //   setFinalStripData,
  //   setAiCaption,
  //   setView,
  //   isCreator,
  // } = useAppStore();

  const capturedPhotos = useAppStore((s) => s.capturedPhotos);
  const stripLayout = useAppStore((s) => s.stripLayout);
  const setStripLayout = useAppStore((s) => s.setStripLayout);
  const setFinalStripData = useAppStore((s) => s.setFinalStripData);
  const setAiCaption = useAppStore((s) => s.setAiCaption);
  const setView = useAppStore((s) => s.setView);
  const isCreator = useAppStore((s) => s.isCreator);

  const slotCount = Math.min(4, Math.max(capturedPhotos.length, 1));
  const [isBuilding, setIsBuilding] = useState(false);

  const [rawSlots, setRawSlots] = useState<(CapturedPhoto | null)[]>(() =>
    Array(slotCount).fill(null),
  );

  const slots = useMemo<(CapturedPhoto | null)[]>(() => {
    if (rawSlots.length === slotCount) return rawSlots;
    const next: (CapturedPhoto | null)[] = Array(slotCount).fill(null);
    rawSlots.forEach((s, i) => {
      if (i < slotCount) next[i] = s;
    });
    return next;
  }, [rawSlots, slotCount]);

  // Quick stickers placed on the preview (emoji + position)
  const [overlayStickers, setOverlayStickers] = useState<
    { id: string; emoji: string; x: number; y: number; scale: number }[]
  >([]);
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const stripPreviewRef = useRef<HTMLDivElement>(null);

  // --- Collaborative editing ---
  const applyingRemote = useRef(false);
  const didMount = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const onRemoteSlots = (data: { slots: (number | null)[] }) => {
      applyingRemote.current = true;
      setRawSlots(() => {
        const len = Math.max(slotCount, data.slots.length);
        return Array.from({ length: len }, (_, i) => {
          const o = data.slots[i];
          return o == null
            ? null
            : (capturedPhotos.find((p) => p.order === o) ?? null);
        });
      });
      setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    };
    socket.on("strip-slot-update", onRemoteSlots);
    return () => {
      socket.off("strip-slot-update", onRemoteSlots);
    };
  }, [capturedPhotos, slotCount]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (applyingRemote.current) return;
    getSocket().emit("strip-slot-update", {
      slots: slots.map((s) => s?.order ?? null),
    });
  }, [slots]);

  const usedIds = new Set(slots.filter(Boolean).map((p) => p!.id));
  const pool = capturedPhotos.filter((p) => !usedIds.has(p.id));
  const filledCount = slots.filter(Boolean).length;

  const addToStrip = (photo: CapturedPhoto) => {
    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) {
      toast("Strip is full — remove a photo first");
      return;
    }
    setRawSlots((prev) => {
      const base =
        prev.length === slotCount
          ? [...prev]
          : Array(slotCount)
              .fill(null)
              .map((_, i) => prev[i] ?? null);
      base[idx] = photo;
      return base;
    });
  };

  const removeFromSlot = (idx: number) => {
    setRawSlots((prev) => prev.map((s, i) => (i === idx ? null : s)));
  };

  const autoFill = () => {
    const ordered = [...capturedPhotos].sort((a, b) => a.order - b.order);
    setRawSlots(ordered.slice(0, slotCount));
  };

  // Sticker drag on preview
  const onStickerPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      const preview = stripPreviewRef.current;
      if (!preview) return;
      const rect = preview.getBoundingClientRect();
      const sticker = overlayStickers.find((s) => s.id === id)!;
      setDraggingStickerId(id);
      setDragOffset({
        x: e.clientX - rect.left - sticker.x * rect.width,
        y: e.clientY - rect.top - sticker.y * rect.height,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [overlayStickers],
  );

  const onStickerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingStickerId) return;
      const preview = stripPreviewRef.current;
      if (!preview) return;
      const rect = preview.getBoundingClientRect();
      const nx = (e.clientX - rect.left - dragOffset.x) / rect.width;
      const ny = (e.clientY - rect.top - dragOffset.y) / rect.height;
      setOverlayStickers((prev) =>
        prev.map((s) =>
          s.id === draggingStickerId
            ? {
                ...s,
                x: Math.max(0, Math.min(1, nx)),
                y: Math.max(0, Math.min(1, ny)),
              }
            : s,
        ),
      );
    },
    [draggingStickerId, dragOffset],
  );

  const onStickerPointerUp = useCallback(() => {
    setDraggingStickerId(null);
  }, []);

  const addSticker = (emoji: string) => {
    setOverlayStickers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        emoji,
        x: 0.3 + Math.random() * 0.4,
        y: 0.2 + Math.random() * 0.6,
        scale: 1,
      },
    ]);
  };

  const removeSticker = (id: string) => {
    setOverlayStickers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreate = async () => {
    const chosen = slots.filter(Boolean) as CapturedPhoto[];
    if (chosen.length === 0) return;
    setIsBuilding(true);

    const stripData = await renderStrip(chosen, {
      layout: stripLayout,
      isCreator,
      showHeader: true,
    });
    if (!stripData) {
      toast.error("Could not build the strip");
      setIsBuilding(false);
      return;
    }

    // Burn overlay stickers into the strip canvas before saving
    let finalData = stripData;
    if (overlayStickers.length > 0) {
      const canvas = document.createElement("canvas");
      const img = new Image();
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.src = stripData;
      });
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      for (const s of overlayStickers) {
        const px = s.x * canvas.width;
        const py = s.y * canvas.height;
        const size = 64 * s.scale * (canvas.width / 448);
        ctx.font = `${size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.emoji, px, py);
      }
      finalData = canvas.toDataURL("image/jpeg", 0.92);
    }

    setFinalStripData(finalData);
    setView("result");

    fetch("/api/ai/caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "caption",
        context: `${chosen.length} photos, ${stripLayout} layout`,
      }),
    })
      .then((r) => r.json())
      .then((d) => setAiCaption(d.caption))
      .catch(() => setAiCaption("A moment worth remembering ✨"));
  };

  return (
    <div className="min-h-screen bg-[#f6f5f3] flex flex-col">
      <header className="sticky top-0 z-40 bg-[#f6f5f3]/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("studio")}
            className="text-neutral-600"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <h1 className="text-sm font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Build Your Strip
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={autoFill}
            className="text-neutral-500 text-xs"
          >
            Auto-fill
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-36 pt-4 space-y-5">
        {/* Layout picker */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5 flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" /> Layout
          </p>
          <div className="grid grid-cols-4 gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setStripLayout(l.id)}
                className={`rounded-xl p-3 text-center transition-all border ${
                  stripLayout === l.id
                    ? "bg-white border-primary/40 shadow-sm ring-2 ring-primary/20"
                    : "bg-white/60 border-transparent hover:border-black/10 hover:bg-white"
                }`}
              >
                <span className="text-2xl block mb-1">{l.icon}</span>
                <span className="text-[11px] font-semibold text-neutral-700 block">
                  {l.name}
                </span>
                <span className="text-[9px] text-neutral-400 leading-tight block mt-0.5">
                  {l.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(220px,280px)] gap-5">
          {/* Left: pool + stickers */}
          <div className="space-y-5">
            {/* Photo pool */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5">
                Photos · {pool.length} available
              </p>
              <div className="grid grid-cols-2 gap-2 content-start">
                {[...pool]
                  .sort((a, b) => a.order - b.order)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToStrip(p)}
                      className="relative rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 hover:ring-2 hover:ring-primary/40 transition-all group active:scale-95"
                    >
                      <img
                        src={p.dataUrl}
                        alt=""
                        className="w-full h-auto block" loading="eager" decoding="sync"
                      />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold text-white bg-black/50 rounded px-1 py-0.5">
                        #{p.order}
                      </span>
                    </button>
                  ))}
                {pool.length === 0 && (
                  <p className="col-span-full text-sm text-neutral-400 py-8 text-center">
                    All photos placed ✓
                  </p>
                )}
              </div>
            </div>

            {/* Sticker palette */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5">
                Stickers · tap to add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_STICKERS.map((e) => (
                  <button
                    key={e}
                    onClick={() => addSticker(e)}
                    className="w-10 h-10 rounded-xl bg-white hover:bg-white shadow-sm hover:shadow-md border border-black/5 hover:scale-110 active:scale-95 transition-all text-xl flex items-center justify-center"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: strip preview with draggable stickers */}
          <div className="mx-auto w-full max-w-[280px]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-2.5 text-center">
              Preview · drag stickers
            </p>

            <div
              ref={stripPreviewRef}
              className="relative bg-[#efe9df] rounded-xl p-3 shadow-md ring-1 ring-black/8 select-none"
              onPointerMove={onStickerPointerMove}
              onPointerUp={onStickerPointerUp}
            >
              {/* Reorderable slots */}
              <Reorder.Group
                axis="y"
                values={rawSlots}
                onReorder={setRawSlots}
                className="space-y-2"
              >
                {slots.map((slot, i) => (
                  <Reorder.Item
                    key={slot ? slot.id : `empty-${i}`}
                    value={slot}
                    dragListener={!!slot}
                    className="relative"
                  >
                    {slot ? (
                      <div className="group relative rounded-sm overflow-hidden">
                        <img
                          src={slot.dataUrl}
                          alt=""
                          className="w-full h-auto block"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <button
                          onClick={() => removeFromSlot(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab">
                          <GripVertical className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[3/2] rounded-sm bg-[#e6ddcf] flex items-center justify-center border-2 border-dashed border-[#d4cabc]">
                        <Plus className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              {/* Overlay stickers (draggable) */}
              {overlayStickers.map((s) => (
                <div
                  key={s.id}
                  className="absolute cursor-grab active:cursor-grabbing select-none"
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${28 * s.scale}px`,
                    zIndex: 20,
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => onStickerPointerDown(e, s.id)}
                >
                  <span>{s.emoji}</span>
                  <button
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center leading-none shadow"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeSticker(s.id)}
                  >
                    ×
                  </button>
                </div>
              ))}

              <p className="text-center text-[9px] tracking-widest text-neutral-400 mt-2.5 uppercase">
                SnapTogether · {LAYOUTS.find((l) => l.id === stripLayout)?.name}
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#f6f5f3] via-[#f6f5f3]/95 to-transparent pt-6 pb-5 px-4">
        <div className="max-w-md mx-auto">
          <Button
            size="lg"
            disabled={filledCount === 0 || isBuilding}
            onClick={handleCreate}
            className="w-full rounded-2xl py-6 text-base font-medium shadow-lg shadow-primary/20"
          >
            {isBuilding ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
              />
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Create Strip ({filledCount}/{slots.length})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
