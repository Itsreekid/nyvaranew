import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const COSMOS_BASE = 'https://api.cosmos.tn/api/v1';
const COSMOS_TOKEN = process.env.COSMOS_API_TOKEN!;
const TERMINAL_CALL_STATUSES = new Set(['delivered', 'returned']);

function resolveCallStatus(rawCosmosStatus: string, currentCallStatus: string | null): string {
  const cosmos = rawCosmosStatus?.toLowerCase().trim();
  const current = currentCallStatus || 'pending';

  // ── Determine terminal outcome from Cosmos status ──────────────────────────
  let terminalOutcome: 'delivered' | 'returned' | null = null;

  if (cosmos === 'delivered') {
    terminalOutcome = 'delivered';
  } else if ([
    'return-stock',
    'received-return',
    'return-in-transfer',
    'final-return',
    'rejected',   // Cosmos "rejected" = customer refused the package at door → return
    'refused',    // alternative spelling some APIs use
  ].includes(cosmos)) {
    terminalOutcome = 'returned';
  }

  // ── If current status is still in a call-center manual state, only apply
  //    terminal outcomes (never let Cosmos override a human decision mid-flow) ─
  const isManualCallCenterState = [
    'pending', 'attempt_1', 'attempt_2', 'attempt_3', 'attempt_4', 'attempt_5',
  ].includes(current);

  if (isManualCallCenterState) {
    return terminalOutcome ?? current;
  }

  // ── Order is confirmed / packed / already in logistics flow ───────────────
  if (current === 'confirmed' || current === 'packed') {
    if (terminalOutcome) return terminalOutcome;
    // Still in transit → show as packed
    if (['to-be-picked', 'in-depot', 'in-delivery', 'to-be-verified', 'in-transfer'].includes(cosmos)) return 'packed';
    return current;
  }

  // ── Manually rejected by call center — keep unless Cosmos says delivered ──
  if (current === 'rejected') {
    return terminalOutcome === 'delivered' ? 'delivered' : current;
  }

  // ── Any other state (delivered, returned) — terminal, don't change ────────
  return terminalOutcome ?? current;
}


export async function POST(req: NextRequest) {
  try {
    const rawOrders = await sql`
      SELECT id, cosmos_barcode, call_status, cosmos_status, last_synced_at
      FROM orders WHERE cosmos_barcode IS NOT NULL`;

    if (!rawOrders?.length) return NextResponse.json({ ok: true, message: 'No shipments found.', updatedCount: 0 });

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const ordersToSync = (rawOrders as any[]).filter(o => {
      const barcode = o.cosmos_barcode?.trim();
      if (!barcode) return false;
      if (TERMINAL_CALL_STATUSES.has(o.call_status ?? '')) return false;
      if (o.last_synced_at && new Date(o.last_synced_at) > twelveHoursAgo) return false;
      return true;
    });

    if (!ordersToSync.length) {
      return NextResponse.json({ ok: true, message: 'All shipments are terminal or recently cached.', updatedCount: 0 });
    }

    const barcodeToOrder: Record<string, { id: string; call_status: string | null }> = {};
    const barcodes: string[] = [];
    for (const o of ordersToSync) {
      barcodes.push(o.cosmos_barcode);
      barcodeToOrder[o.cosmos_barcode] = { id: o.id, call_status: o.call_status ?? null };
    }

    const cosmosRes = await fetch(`${COSMOS_BASE}/orders?barcode=${barcodes.join(',')}`, {
      headers: { 'Authorization': `Bearer ${COSMOS_TOKEN}`, 'Content-Type': 'application/json' },
    });
    const cosmosData = await cosmosRes.json();
    if (!cosmosRes.ok) return NextResponse.json({ ok: false, error: cosmosData }, { status: cosmosRes.status });

    const rows: any[] = cosmosData.data || [];
    const currentISOTime = new Date().toISOString();
    let updatedCount = 0;

    for (const d of rows) {
      const entry = barcodeToOrder[d.id];
      if (!entry) continue;
      const newCallStatus = resolveCallStatus(d.status, entry.call_status);
      await sql`
        UPDATE orders SET
          cosmos_status = ${d.status},
          call_status = ${newCallStatus},
          last_synced_at = ${currentISOTime}
        WHERE id = ${entry.id}::uuid`;
      updatedCount++;
    }

    return NextResponse.json({ ok: true, updatedCount });
  } catch (err: any) {
    console.error('[Cosmos Sync] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}