/**
 * Unit tests for src/services/supabase/analytics.ts (M10).
 * The RPC does the timezone-correct bucketing (covered by pgTAP); here we lock
 * down the client contract: correct args, error normalization, the null-data
 * path, and the summary math — including that "no resolved doses" is null (not
 * a misleading 0%).
 */

/* eslint-disable no-var */
var mockRpc: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  mockRpc = jest.fn();
  return {
    supabase: {
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  };
});

import { getAdherenceStats, summarizeAdherence, type AdherenceDay } from '../analytics';
import { AppError } from '../errors';

describe('getAdherenceStats', () => {
  beforeEach(() => mockRpc.mockReset());

  it('calls the adherence_stats RPC with patient id and window, returns rows', async () => {
    const rows: AdherenceDay[] = [{ bucket_day: '2026-07-01', total_doses: 3, taken_doses: 3 }];
    mockRpc.mockResolvedValue({ data: rows, error: null });

    const result = await getAdherenceStats('patient-1', 14);

    expect(mockRpc).toHaveBeenCalledWith('adherence_stats', {
      p_patient_id: 'patient-1',
      p_days: 14,
    });
    expect(result).toEqual(rows);
  });

  it('defaults the window when days is omitted', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getAdherenceStats('patient-1');

    expect(mockRpc).toHaveBeenCalledWith('adherence_stats', {
      p_patient_id: 'patient-1',
      p_days: 30,
    });
  });

  it('returns [] when the RPC yields null data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(getAdherenceStats('patient-1')).resolves.toEqual([]);
  });

  it('throws a normalized AppError on RPC failure', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    await expect(getAdherenceStats('patient-1')).rejects.toBeInstanceOf(AppError);
  });
});

describe('summarizeAdherence', () => {
  it('sums taken/total across days and rounds the percentage', () => {
    // 18 taken / 21 total = 85.7% → rounds to 86 (matches the seed fixture)
    const days: AdherenceDay[] = [
      { bucket_day: '2026-07-01', total_doses: 3, taken_doses: 3 },
      { bucket_day: '2026-07-02', total_doses: 3, taken_doses: 3 },
      { bucket_day: '2026-07-03', total_doses: 3, taken_doses: 0 },
      { bucket_day: '2026-07-04', total_doses: 3, taken_doses: 3 },
      { bucket_day: '2026-07-05', total_doses: 3, taken_doses: 3 },
      { bucket_day: '2026-07-06', total_doses: 3, taken_doses: 3 },
      { bucket_day: '2026-07-07', total_doses: 3, taken_doses: 3 },
    ];
    expect(summarizeAdherence(days)).toEqual({
      totalDoses: 21,
      takenDoses: 18,
      missedDoses: 3,
      percent: 86,
    });
  });

  it('reports null percent (not 0) when there are no resolved doses', () => {
    expect(summarizeAdherence([])).toEqual({
      totalDoses: 0,
      takenDoses: 0,
      missedDoses: 0,
      percent: null,
    });
  });

  it('reports 100 when every dose was taken', () => {
    const days: AdherenceDay[] = [{ bucket_day: '2026-07-01', total_doses: 4, taken_doses: 4 }];
    expect(summarizeAdherence(days).percent).toBe(100);
  });
});
