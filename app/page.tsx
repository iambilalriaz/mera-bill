import { HomeScreen } from "@/components/HomeScreen";
import { getProviderOptions } from "@/lib/providers/catalog";

/**
 * Server component so the provider list comes from the adapter registry at request
 * time — that keeps the server-only parsing code (cheerio) out of the client bundle.
 */
export default function Page() {
  return <HomeScreen providerOptions={getProviderOptions()} />;
}
