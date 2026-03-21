import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ASNData } from '../../../../types/ASNData';
import type { RadarData } from '../../../../types/RadarData';
import { RADAR_API_TOKEN } from '$env/static/private';

type Verdict = 'yes' | 'partial' | 'no' | 'unknown';

function computeVerdict(filterRate7d: number | null): Verdict {
  if (filterRate7d === null) return 'unknown';
  if (filterRate7d >= 80) return 'yes';
  if (filterRate7d >= 40) return 'partial';
  return 'no';
}

export const GET: RequestHandler = async ({ params, platform }) => {
  const asnNumber = parseInt(params.number, 10);
  if (isNaN(asnNumber) || asnNumber < 1 || asnNumber > 4294967295) {
    throw error(400, 'Invalid ASN');
  }

  const token = RADAR_API_TOKEN || platform?.env.RADAR_API_TOKEN;
  if (!token) {
    throw error(500, 'Server misconfiguration: RADAR_API_TOKEN not set');
  }

  const [rankResponse, radarResponse, rovResponse] = await Promise.all([
    fetch(`https://api.asrank.caida.org/v2/restful/asns/${asnNumber}`),
    fetch(
      `https://api.cloudflare.com/client/v4/radar/bgp/routes/stats?asn=${asnNumber}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    fetch(`https://stats.labs.apnic.net/cgi-bin/rpki-json-table.pl?x=${asnNumber}`)
  ]);

  // ASN name (non-fatal if missing)
  let asnName: string | null = null;
  if (rankResponse.ok) {
    const rankBody: ASNData = await rankResponse.json();
    asnName = rankBody.data.asn?.asnName ?? null;
  }

  // Cloudflare Radar route validity stats (non-fatal if missing)
  let rpkiValidPct: number | null = null;
  let rpkiInvalidPct: number | null = null;
  let rpkiUnknownPct: number | null = null;
  if (radarResponse.ok) {
    const radarBody: RadarData = await radarResponse.json();
    if (radarBody.success && radarBody.result) {
      const s = radarBody.result.stats;
      const total = s.routes_total;
      if (total > 0) {
        rpkiValidPct   = Math.round((s.routes_valid   / total) * 1000) / 10;
        rpkiInvalidPct = Math.round((s.routes_invalid / total) * 1000) / 10;
        rpkiUnknownPct = Math.round((s.routes_unknown / total) * 1000) / 10;
      }
    }
  }

  // APNIC I-ROV latest 7-day filter rate (non-fatal if missing)
  let filterRate7d: number | null = null;
  let rovDataDate: string | null = null;
  if (rovResponse.ok) {
    const rovBody = await rovResponse.json() as { data?: { date: string; '7'?: { filter_rate: number } }[] };
    const records = rovBody.data ?? [];
    if (records.length > 0) {
      const latest = records[records.length - 1];
      filterRate7d = latest['7']?.filter_rate ?? null;
      rovDataDate = latest.date ?? null;
    }
  }

  const verdict = computeVerdict(filterRate7d);

  return json({
    asn: asnNumber,
    name: asnName,
    rov_verdict: verdict,
    rov_verdict_thresholds: {
      yes:     'apnic_rov.filter_rate_7d_pct >= 80',
      partial: 'apnic_rov.filter_rate_7d_pct >= 40 and < 80',
      no:      'apnic_rov.filter_rate_7d_pct < 40',
      unknown: 'no APNIC measurement data available for this ASN'
    },
    rov_verdict_explanation:
      verdict === 'yes'     ? 'ASN is enforcing ROV: ≥80% of vantage points observe filtering of RPKI-invalid routes.' :
      verdict === 'partial' ? 'ASN shows partial ROV enforcement: 40–79% of vantage points observe filtering.' :
      verdict === 'no'      ? 'ASN does not appear to enforce ROV: <40% of vantage points observe filtering.' :
                              'Insufficient data to determine ROV status.',
    apnic_rov: filterRate7d !== null ? {
      filter_rate_7d_pct: Math.round(filterRate7d * 10) / 10,
      measurement_date: rovDataDate,
      note: 'Percentage of APNIC vantage points observing this ASN filtering RPKI-invalid routes (7-day window).'
    } : null,
    cloudflare_radar_rpki: rpkiValidPct !== null ? {
      valid_pct: rpkiValidPct,
      invalid_pct: rpkiInvalidPct,
      unknown_pct: rpkiUnknownPct,
      note: 'Route origin validity of prefixes announced by this ASN as seen by Cloudflare Radar.'
    } : null
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' }
  });
};
