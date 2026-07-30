/**
 * All Pakistani electricity distribution companies, for the provider dropdown.
 * `enabled` is derived from the adapter registry, so an entry lights up on its own
 * as soon as its adapter is registered.
 */
import { isProviderSupported } from "./registry";

export type ProviderOption = {
  code: string;
  label: string;
  region: string;
  enabled: boolean;
};

const DISCOS: Omit<ProviderOption, "enabled">[] = [
  { code: "mepco", label: "MEPCO", region: "Multan" },
  { code: "lesco", label: "LESCO", region: "Lahore" },
  { code: "fesco", label: "FESCO", region: "Faisalabad" },
  { code: "gepco", label: "GEPCO", region: "Gujranwala" },
  { code: "iesco", label: "IESCO", region: "Islamabad" },
  { code: "pesco", label: "PESCO", region: "Peshawar" },
  { code: "hesco", label: "HESCO", region: "Hyderabad" },
  { code: "sepco", label: "SEPCO", region: "Sukkur" },
  { code: "qesco", label: "QESCO", region: "Quetta" },
  { code: "tesco", label: "TESCO", region: "Tribal Areas" },
];

export function getProviderOptions(): ProviderOption[] {
  return DISCOS.map((disco) => ({
    ...disco,
    enabled: isProviderSupported(disco.code),
  }));
}
