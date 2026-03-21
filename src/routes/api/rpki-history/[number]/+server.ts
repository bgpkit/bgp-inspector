import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const asnNumber = parseInt(params.number, 10);
  if (isNaN(asnNumber) || asnNumber < 1 || asnNumber > 4294967295) {
    throw error(400, 'Invalid ASN');
  }

  const response = await fetch(
    `https://stats.labs.apnic.net/cgi-bin/rpki-json-table.pl?x=${asnNumber}`
  );
  if (!response.ok) {
    throw error(502, 'Failed to fetch RPKI history data');
  }

  const body = await response.json();
  return json(body.data ?? []);
};
