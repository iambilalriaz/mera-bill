import { createPitcProvider } from "./pitc";

/** Multan Electric Power Company — hosted on the shared PITC portal. */
export const mepcoProvider = createPitcProvider({ code: "mepco", label: "MEPCO" });
