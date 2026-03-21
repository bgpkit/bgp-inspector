import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const asn = parseInt(params.number, 10);
  if (isNaN(asn) || asn < 1 || asn > 4294967295) {
    throw error(400, 'Invalid ASN');
  }
};
