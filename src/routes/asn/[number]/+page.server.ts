import type { PageServerLoad } from './$types';
import type { ASNData } from '../../../types/ASNData';
import type { RadarData } from '../../../types/RadarData';
import { RADAR_API_TOKEN } from '$env/static/private';

async function fetchRadarData(asn: number, radarApiToken: string): Promise<RadarData> {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${radarApiToken}`
    }
  };
  console.log(options);

  try {
    return fetch(`https://api.cloudflare.com/client/v4/radar/bgp/routes/stats?asn=${asn}`, options)
      .then(response => response.json())
      .then((data: any) => {
        if (!data.success || !data.result) {
          throw new Error(`Invalid RadarData response: ${JSON.stringify(data)}`);
        }
        return data as RadarData;
      })
      .catch(error => {
        console.error('Error fetching radar data:', error);
        throw error; // Re-throw to propagate the error
      });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export const load: PageServerLoad = async ({ params, platform }) => {
  const asnNumber = params.number;

  let radarApiToken = RADAR_API_TOKEN || platform?.env.RADAR_API_TOKEN;
  if (!radarApiToken) {
    console.error('RADAR_API_TOKEN is not set in the environment');
  }

  const [rankResponse, radarData] = await Promise.all([
    fetch(`https://api.asrank.caida.org/v2/restful/asns/${asnNumber}`),
    fetchRadarData(Number(asnNumber), radarApiToken)
  ]);

  const rankData: ASNData = await rankResponse.json();

  return {
    rankData: rankData.data.asn,
    radarData: radarData.result.stats
  };
};