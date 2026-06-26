/**
 * A small local pool of sample AI-drafted paragraphs (FE4, AC 11.7). The Builder
 * is an authoring surface, not a real model — these stand in for "✦ AI draft".
 * Picking walks the pool by an incrementing index (NOT Math.random in render),
 * so drafts are deterministic and vary call-to-call.
 */
export const AI_POOL: readonly string[] = [
  'The capsule is hygrochastic, opening when wetted to release seeds in response to rain — a dispersal strategy common among arid-adapted Aizoaceae.',
  'Bladder cells on the epidermis store water and scatter excess light, buffering the plant against the high irradiance of open quartz fields.',
  'Populations are patchily distributed across quartz gravel, where reduced competition and a cooler root zone appear to favour establishment.',
  'Anthesis is concentrated in the early afternoon, with flowers closing by dusk and reopening over several successive days.',
  'Seeds are small and D-shaped, retained within the locular cavity until sufficient moisture prompts the keels to separate the valves.',
  'Vegetative growth is slow; individuals may persist for years as compact cushions barely raised above the gravel surface.',
];

/** Pick the next sample by an incrementing cursor (deterministic, not random). */
export function pickAI(cursor: number): string {
  return AI_POOL[cursor % AI_POOL.length];
}
