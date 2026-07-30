import { createPitcProvider } from "./pitc";

/** Lahore Electric Supply Company — hosted on the shared PITC portal. */
export const lescoProvider = createPitcProvider({ code: "lesco", label: "LESCO" });
