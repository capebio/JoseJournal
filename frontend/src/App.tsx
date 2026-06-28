import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Stub } from './components/common/Stub';
import { useSeed } from './core/seed';
// Home + Reader are eager — they gate first contentful paint on the common entry.
import { Home } from './screens/Home';
import { Reader } from './screens/Reader';

// Every other screen is route-split so a visitor who only opens the Reader does
// not download the Builder, map, review, etc. on first load (FE9 low-bandwidth).
const DoiResolver = lazy(() => import('./screens/DoiResolver').then((m) => ({ default: m.DoiResolver })));
const Discovery = lazy(() => import('./screens/Discovery').then((m) => ({ default: m.Discovery })));
const Builder = lazy(() => import('./screens/Builder').then((m) => ({ default: m.Builder })));
const ReviewPanel = lazy(() => import('./screens/ReviewPanel').then((m) => ({ default: m.ReviewPanel })));
const DistributionMap = lazy(() => import('./screens/DistributionMap').then((m) => ({ default: m.DistributionMap })));
const Capture = lazy(() => import('./screens/Capture').then((m) => ({ default: m.Capture })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Lightbox = lazy(() => import('./screens/Lightbox').then((m) => ({ default: m.Lightbox })));
const SnippetViewer = lazy(() => import('./screens/SnippetViewer').then((m) => ({ default: m.SnippetViewer })));
const FirstEdition = lazy(() => import('./screens/FirstEdition').then((m) => ({ default: m.FirstEdition })));

/** Redirect a parameterless nav target (/review, /map) to the seeded treatment. */
function SeedRedirect({ base }: { base: string }) {
  const seed = useSeed();
  if (seed === undefined) return <div className="jose-loading">Finding the seeded treatment…</div>;
  if (!seed) return <Home />;
  return <Navigate to={`${base}/${encodeURIComponent(seed.koId)}`} replace />;
}

/** Routes reflect the three-identifier model (IS §3.9): version URLs/DOIs never client-redirect. */
export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="jose-loading">Loading…</div>}>
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
        <Route path="/first-edition" element={<FirstEdition />} />
        <Route path="*" element={<Stub fe="404" title="Not found" note="No such route." />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}
