import { Navigate } from 'react-router-dom';
import { useSeed } from '../core/seed';

/** Opens the app on the seeded flagship treatment in the Reader (the signature). */
export function Home() {
  const seed = useSeed();
  if (seed === undefined) return <div className="jose-loading">Opening the seeded treatment…</div>;
  if (!seed) return <div className="jose-stub"><h2>No seeded treatment</h2><p>Run <code>node scripts/seed-flagship.mjs</code> against the backend.</p></div>;
  return <Navigate to={`/ko/${encodeURIComponent(seed.koId)}`} replace />;
}
