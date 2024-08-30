export type ASNData = {
    data: {
      asn: {
        rank: number;
        asn: string;
        asnName: string;
        source: string;
        cliqueMember: boolean;
        seen: boolean;
        ixp: null | string;
        longitude: number;
        latitude: number;
        organization: {
          orgId: string;
        };
        cone: {
          numberAsns: number;
          numberPrefixes: number;
          numberAddresses: number;
        };
        country: {
          iso: string;
        };
        asnDegree: {
          total: number;
          customer: number;
          peer: number;
          provider: number;
        };
      };
    };
  };