import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell loads the live Vercel deployment rather than a bundled static
 * export — the app has server-rendered routes and API endpoints that a static
 * export can't carry. Only the bill lookup itself runs natively (see
 * lib/providers/pitcNative.ts): CapacitorHttp bypasses the WebView's CORS/credentials
 * restrictions, which is what actually lets it reach bill.pitc.com.pk — see
 * app/api/bill/route.ts and README's "Deploying: the portal is geo-fenced" section
 * for why a request from outside Pakistan cannot do this at all.
 */
const config: CapacitorConfig = {
  appId: "com.merabill.app",
  appName: "Mera Bill",
  webDir: "public",
  server: {
    url: "https://mera-bill.vercel.app",
    cleartext: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
