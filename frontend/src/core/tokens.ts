/**
 * JOSE v1 design tokens (Frontend Spec §3). The single source for colour/type;
 * mirrored as CSS variables in styles/tokens.css. `--type-red` is meaningful, not
 * decorative — the herbarium type-label red marks provenance/type/annotation only.
 */
export const tokens = {
  color: {
    paper: '#F6F8F5', // base: cool off-white, faint green-grey cast
    ink: '#18201B', // text: near-black, green-black undertone
    sub: '#4A5650',
    structure: '#6E7C70', // rules, QDS lattice, version DAG
    rule: '#D9DED6',
    typeRed: '#A83A2C', // THE accent — provenance / type / annotation ONLY
    verified: '#2E6E5E', // status: verified / VoR / confirmed
    haze: '#ECEFE9', // fills, hovers, inactive lens strata
    ai: '#bcd4e2',
    aiHuman: '#cfe0d6',
  },
  font: {
    ui: "'Inter Tight', system-ui, sans-serif", // instrument voice
    body: "'Spectral', Georgia, serif", // treatments; strong italic = taxonomy
    mono: "'IBM Plex Mono', ui-monospace, monospace", // exact identifiers
  },
} as const;

export type Tokens = typeof tokens;
