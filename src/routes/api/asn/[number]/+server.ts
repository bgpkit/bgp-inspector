import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ASNData } from '../../../../types/ASNData';
import type { RadarData } from '../../../../types/RadarData';
import { RADAR_API_TOKEN } from '$env/static/private';

async function fetchRadarStats(asn: number, token: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/radar/bgp/routes/stats?asn=${asn}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) return null;
  const data: RadarData = await response.json();
  if (!data.success || !data.result) return null;
  return data.result.stats;
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

  const [rankResponse, radarStats] = await Promise.all([
    fetch(`https://api.asrank.caida.org/v2/restful/asns/${asnNumber}`),
    fetchRadarStats(asnNumber, token)
  ]);

  if (!rankResponse.ok) {
    throw error(502, 'Failed to fetch ASN rank data');
  }

  const rankBody: ASNData = await rankResponse.json();

  return json({
    rankData: rankBody.data.asn,
    radarData: radarStats
  });
};
