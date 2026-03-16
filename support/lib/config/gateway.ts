const rawGatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8790';

const normalize = () => {
  try {
    const parsed = new URL(rawGatewayUrl);
    const path = parsed.pathname.endsWith('/') && parsed.pathname !== '/' ? parsed.pathname.slice(0, -1) : parsed.pathname;
    return `${parsed.origin}${path === '/' ? '' : path}`;
  } catch {
    return 'http://localhost:8790';
  }
};

export const gatewayHttpBaseUrl = normalize();

export const buildGatewayUrl = (path = ''): string =>
  `${gatewayHttpBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
