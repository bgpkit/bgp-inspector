export type RadarData = {
    result: {
      meta: {
        data_time: string;
        query_time: string;
        total_peers: number;
      };
      stats: {
        distinct_origins: number;
        distinct_origins_ipv4: number;
        distinct_origins_ipv6: number;
        distinct_prefixes: number;
        distinct_prefixes_ipv4: number;
        distinct_prefixes_ipv6: number;
        routes_invalid: number;
        routes_invalid_ipv4: number;
        routes_invalid_ipv6: number;
        routes_total: number;
        routes_total_ipv4: number;
        routes_total_ipv6: number;
        routes_unknown: number;
        routes_unknown_ipv4: number;
        routes_unknown_ipv6: number;
        routes_valid: number;
        routes_valid_ipv4: number;
        routes_valid_ipv6: number;
      };
    };
    success: boolean;
  };