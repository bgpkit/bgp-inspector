import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const asn = url.searchParams.get('asn');
  if (asn) throw redirect(301, `/asn/${asn}`);
};
