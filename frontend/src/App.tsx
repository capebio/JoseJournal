import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Stub } from './components/common/Stub';
import { useSeed } from './core/seed';
import { Home } from './screens/Home';
import { Reader } from './screens/Reader';
import { DoiResolver } from './screens/DoiResolver';
import { Discovery } from './screens/Discovery';
import { Builder } from './screens/Builder';
import { ReviewPanel } from './screens/ReviewPanel';
import { DistributionMap } from './screens/DistributionMap';
import { Capture } from './screens/Capture';
import { Profile } from './screens/Profile';
import { Lightbox } from './screens/Lightbox';
import { SnippetViewer } from './screens/SnippetViewer';

/** Redirect a parameterless nav target (/review, /map) to the seeded treatment. */
function SeedRedirect({ base }: { base: string }) {
  const seed = useSeed();
  if (seed === undefined) return <div className="jose-loading">Loading…</div>;
  if (!seed) return <Home />;
  return <Navigate to={`${base}/${encodeURIComponent(seed.koId)}`} replace />;
}

/** Routes reflect the three-identifier model (IS §3.9): version URLs/DOIs never client-redirect. */
export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<Home />} />
        <Route path="/ko/:koId" element={<Reader />} />
        <Route path="/ko/:koId/v/:verId" element={<Reader />} />
        <Route path="/doi/:doi" element={<DoiResolver />} />
        <Route path="/explore" element={<Discovery />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/builder/:koId" element={<Builder />} />
        <Route path="/review" element={<SeedRedirect base="/review" />} />
        <Route path="/review/:koId" element={<ReviewPanel />} />
        <Route path="/map" element={<SeedRedirect base="/map" />} />
        <Route path="/map/:koId" element={<DistributionMap />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/m/:mediaId" element={<Lightbox />} />
        <Route path="/s/:snippetId" element={<SnippetViewer />} />
        <Route path="*" element={<Stub fe="404" title="Not found" note="No such route." />} />
      </Routes>
    </AppShell>
  );
}
