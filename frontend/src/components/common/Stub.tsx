/** Placeholder for screens filled in by the FE2–FE9 fan-out. */
export function Stub({ fe, title, note }: { fe: string; title: string; note?: string }) {
  return (
    <div className="jose-stub">
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--type-red)', marginBottom: 14 }}>next · {fe}</div>
      <h2>{title}</h2>
      <p>{note ?? 'This screen is part of the build sequence. The Reader is live — open it from the nav.'}</p>
    </div>
  );
}
