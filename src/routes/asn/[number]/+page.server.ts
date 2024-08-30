import type { PageServerLoad } from './$types';
import type { ASNData } from '../../../types/ASNData';
import type { RadarData } from '../../../types/RadarData';


async function fetchRadarData(asn: number, env): Promise<RadarData> {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RADAR_API_TOKEN}`
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
  console.log(platform.env);
  const asnNumber = params.number;

  const [rankResponse, radarData] = await Promise.all([
    fetch(`https://api.asrank.caida.org/v2/restful/asns/${asnNumber}`),
    fetchRadarData(Number(asnNumber), platform.env)
  ]);

  const rankData: ASNData = await rankResponse.json();

  return {
    rankData: rankData.data.asn,
    radarData: radarData.result.stats
  };
};