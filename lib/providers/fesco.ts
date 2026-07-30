import { createPitcProvider } from "./pitc";

/** Faisalabad Electric Supply Company — hosted on the shared PITC portal. */
export const fescoProvider = createPitcProvider({ code: "fesco", label: "FESCO" });
