'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Order } from '@/types';

const POLL_INTERVAL_MS = 15_000; // 15 seconds

interface UseOrderNotificationOptions {
  onNewOrder: (order: Order) => void;
}

/** Plays a Shopify-like 'cha-ching' sound using the Web Audio API */
function playChaChingSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playTone = (freq: number, startTime: number, duration: number, gainPeak: number) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration * 0.3);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime); osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playTone(880, now, 0.15, 0.4); playTone(1100, now, 0.15, 0.2);
    playTone(1760, now + 0.18, 0.6, 0.5); playTone(2200, now + 0.18, 0.6, 0.25);
    playTone(2640, now + 0.22, 0.5, 0.15);
    setTimeout(() => ctx.close(), 1500);
  } catch { /* silently fail */ }
}

export function useOrderNotification({ onNewOrder }: UseOrderNotificationOptions) {
  const lastSeenTimestamp = useRef<string | null>(null);
  const initialized       = useRef(false);
  const seenIds           = useRef<Set<string>>(new Set());

  const handleNewOrder = useCallback((order: Order) => {
    if (seenIds.current.has(order.id)) return;
    seenIds.current.add(order.id);
    if (!initialized.current) return;
    playChaChingSound();
    onNewOrder(order);
  }, [onNewOrder]);

  useEffect(() => {
    // 1. Seed initial state ? get latest order timestamp so we don't fire on mount
    fetch('/api/orders/check-new')
      .then(r => r.json())
      .then(({ latestId }) => {
        if (latestId) seenIds.current.add(latestId);
        lastSeenTimestamp.current = new Date().toISOString();
        initialized.current = true;
      })
      .catch(console.error);

    // 2. Poll every 15 seconds for new orders
    const intervalId = setInterval(async () => {
      if (!initialized.current || !lastSeenTimestamp.current) return;
      try {
        const res = await fetch(`/api/orders/check-new?since=${encodeURIComponent(lastSeenTimestamp.current)}`);
        if (!res.ok) return;
        const { newOrders } = await res.json();
        if (newOrders?.length) {
          lastSeenTimestamp.current = new Date().toISOString();
          newOrders.forEach((o: Order) => handleNewOrder(o));
        }
      } catch (e) { console.error('[OrderNotification] Poll error:', e); }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [handleNewOrder]);
}