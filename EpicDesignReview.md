# EpicDesignReview

**Target:** frontend/src
**Platform:** web
**Framework:** react
**Files reviewed:** 59
**Generated:** 2026-06-27T08:40:51.278255Z

## Summary

- **59 confirmed findings** — 0 critical, 6 high, 33 medium, 20 low
- 1 uncertain findings (verifier couldn't confirm without more context)
- 4 candidates dismissed as false positives by verifier
- Detectors run: 5 (accessibility, critique, system, copy, craft)

No critical issues, but high-severity findings will degrade the experience for many users.

---

## Confirmed findings

### High

#### 1. "Open treatment at this version" link is built with a placeholder koId and dead-ends — `frontend/src/components/citation/SnippetCard.tsx:30-30`

**Category:** broken-navigation  **Detectors:** critique  **Platform:** web

treatmentHref hardcodes the em-dash '—' as the knowledge-object id because the real koId is not available to this component. The resulting route /ko/%E2%80%94/v/:versionId is rendered as the primary CTA in the snippet's "View entire treatment" view (button at line 71). The Reader keys its query on koId (getVersion(koId, verId)), so this link resolves to a 403/404 "Treatment unavailable" page — the one action offered in that view is a guaranteed dead-end, contradicting the adjacent hint that "the knowledge-object id is resolved by the reader."

**Verifier evidence:** Verified the href literally embeds '—' as the koId (line 30) and is the only CTA in the treatment view (Link, line 71). Reader reads koId straight from the route params and calls ep.getVersion(koId, verId) (Reader.tsx:36,52) with no version→ko resolution, so '—' yields the 'Treatment unavailable' stub (Reader.tsx:119-122). SnippetCard is rendered by SnippetViewer.tsx, so the dead-end is user-reachable; the adjacent hint that the reader resolves the id is false.

```tsx
  const treatmentHref = `/ko/${encodeURIComponent('—')}/v/${encodeURIComponent(snippet.versionId)}`;
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 2. Toast feedback (including all error messages) is not announced to screen readers — `frontend/src/components/common/useToast.tsx:4-11`

**Category:** status-not-announced  **Detectors:** a11y  **Platform:** web

The shared toast renders a plain <div className="jose-toast"> with no role="status"/role="alert" and no aria-live region, so its message is never announced. This single hook is the ONLY feedback channel for success AND failure across the app — 'Save failed', 'Not permitted', 'Release gated', 'Citation copied', etc. are flashed through it in Builder, Capture, Reader, ReviewPanel, DistributionMap, CertificationFlow and RecordCurator. A screen-reader or low-vision user gets no notification that an action succeeded or failed (WCAG 4.1.3 Status Messages). Add role="status" aria-live="polite" (or assertive for errors) to the toast node.

**Verifier evidence:** useToast.tsx line 10 renders the message in a bare <div className="jose-toast"> with no role or aria-live, and it is the app's sole transient feedback channel (imported by Reader, Builder, DistributionMap, Discovery, etc.). A node inserted without a live region and no focus change is not announced, violating WCAG 4.1.3.

```tsx
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1900);
  }, []);
  const node = toast ? <div className="jose-toast">{toast}</div> : null;
  return { toast, flash, node };
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 3. Lightbox dialog has no focus trap, initial focus move, or focus restore — `frontend/src/components/media/LightboxModal.tsx:22-41`

**Category:** focus-management  **Detectors:** a11y  **Platform:** web

The lightbox is marked role="dialog" aria-modal="true" and handles Escape, but it never moves focus into the dialog on open, never traps Tab inside it, and never returns focus to the figure button that opened it on close. A keyboard or screen-reader user opening a figure stays focused on the page behind the modal, can Tab straight out into the obscured Reader content, and loses their place when it closes (WCAG 2.4.3 Focus Order, 2.1.2). The CitePicker (Builder) and the Reader snippet/citer popovers share this gap.

**Verifier evidence:** LightboxModal.tsx only adds an Escape window listener (lines 22-26); there is no autoFocus, no focus-trap, and no stored/restored opener reference. With aria-modal="true" but focus left on the page behind, keyboard users can Tab into the obscured Reader and lose their place — a real 2.4.3/4.1.2 failure.

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lb-modal-back" onMouseDown={onClose}>
      <div className="lb-modal" role="dialog" aria-modal="true" aria-label="Image lightbox" onMouseDown={(e) => e.stopPropagation()}>
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 4. PouchDB is eagerly imported into the main bundle and replication starts on every page load — `frontend/src/core/offline/offline.ts:7-26`

**Category:** bundle-low-bandwidth  **Detectors:** craft  **Platform:** web

pouchdb-browser (~140KB+ gzipped, much larger un-gzipped) is statically imported at the top of offline.ts, and main.tsx calls startPublicReplication() at module top level (main.tsx:7,13). Because main.tsx is the single entry, every visitor — including a first-time, read-only user on a slow mobile connection — downloads, parses, and boots PouchDB and kicks off a live CouchDB replication before first paint, even though they may never go offline or open Capture. This is the single largest avoidable cost on a low-bandwidth first load. Lazy-load PouchDB (dynamic import) behind the offline/Capture path and start replication after idle or on first offline event.

**Verifier evidence:** offline.ts:7 statically imports pouchdb-browser, and main.tsx:7,13 calls startPublicReplication() at module top level — the single entry, so PouchDB loads and live replication starts for every visitor before first paint. pouchdb-browser is a well-known large dependency; the structural claim is verified and the low-bandwidth cost is real.

```typescript
import PouchDB from 'pouchdb-browser';
...
export function startPublicReplication(): PouchDB.Replication.Replication<{}> | null {
  const remote = new PouchDB(COUCH_PUBLIC, { skip_setup: true });
  return publicStore().replicate.from(remote, { live: true, retry: true });
}
// main.tsx:13 — startPublicReplication();  (runs for every visitor at startup)
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 5. "Publish to Commons" releases the manuscript publicly on a single click with no confirmation — `frontend/src/screens/Builder.tsx:345-357`

**Category:** destructive-action-no-confirmation  **Detectors:** critique  **Platform:** web

The footer's primary button (line 577) calls onPublish, which immediately fires ep.release(id, 'commons'), flips visibility to public, and relabels the tier — a consequential, hard-to-reverse action (it makes a draft a public, citable Commons object). There is no confirmation step, no summary of what becomes public, and no undo affordance. The primary visual weight (dark filled button) is given to the most dangerous action while the everyday action (Save draft) is de-emphasized. Publishing should require an explicit confirm or review-of-scope before going public.

**Verifier evidence:** onPublish (Builder.tsx:345-357) calls ep.release(id,'commons') and flips visibility to 'public' immediately, with no confirm dialog or scope summary; it is wired to the dark `className="primary"` footer button (line 577) while Save draft is plain. Making a draft public/citable on a single unconfirmed click is a real high-severity destructive-action concern (exact reversibility is unverified, but the absence of confirmation is clear).

```tsx
  const onPublish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = koId ?? (await ensureKo());
      const res = await ep.release(id, 'commons');
      if (res.status === 200) { setTierLabel('Commons'); setVisibility('public'); flash('Published to Commons'); }
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 6. White text on amber/yellow disposition chips is illegible (2.4:1 / 3.4:1) — `frontend/src/styles/jose.css:109-113`

**Category:** color-contrast  **Detectors:** a11y  **Platform:** web

The reviewer-disposition pill prints white text on #b8a93e (yellow ~2.39:1) and #c8772a (orange ~3.43:1), both far below the 4.5:1 needed for this 9.5px uppercase text. The pill carries the actual review verdict ('yellow · minor — not blocking', 'orange · seen, not incorporated'), so the meaning is the part that is hard to read. The same colors recur on the selected disposition buttons in review.css lines 16-19 (.seg button.on.yellow / .on.orange). Darken the chip backgrounds or use dark text on the light variants.

**Verifier evidence:** jose.css line 109 sets .disp color:#fff at font-size 9.5px; lines 111/113 give backgrounds #c8772a and #b8a93e. White-on-#b8a93e computes to 2.39:1 and white-on-#c8772a to 3.43:1, both far below the 4.5:1 floor for this small uppercase text that carries the review disposition; review.css 17-18 repeats the same .on.yellow/.on.orange white-on-amber.

```css
.jose-rev .disp { ... border-radius: 4px; color: #fff; }
.jose-rev.green .disp { background: var(--verified); }
.jose-rev.orange .disp { background: #c8772a; }
.jose-rev.red .disp { background: var(--type-red); }
.jose-rev.yellow .disp { background: #b8a93e; }
```

**Suggested direction:** darken/lighten the relevant token until contrast meets 4.5:1 (3:1 for large text or non-text UI).

---

### Medium

#### 1. No route-level code splitting — all 13 screens ship in the initial bundle — `frontend/src/App.tsx:1-16`

**Category:** bundle-route-split  **Detectors:** craft  **Platform:** web

Every screen is statically imported at the top of App.tsx (Reader, Builder ~32KB source, DistributionMap ~16KB, ReviewPanel, Discovery, etc.) and rendered through plain <Routes> with no React.lazy/Suspense anywhere in the app (confirmed: zero lazy/Suspense usages). A user who only opens one treatment in the Reader still downloads the entire authoring (Builder), map, and review code. Splitting heavy routes (Builder, DistributionMap, FirstEdition) behind React.lazy + a Suspense fallback would materially cut first-load JS on slow connections.

**Verifier evidence:** App.tsx:1-16 statically imports every screen and renders plain <Routes>; a repo-wide search for React.lazy/Suspense/lazy( returned zero matches. No route-level splitting exists, so all screens ship in the initial bundle — confirmed.

```tsx
import { Reader } from './screens/Reader';
import { Builder } from './screens/Builder';
import { ReviewPanel } from './screens/ReviewPanel';
import { DistributionMap } from './screens/DistributionMap';
// ...all 13 screens imported eagerly; no React.lazy / Suspense
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 2. Insert-citation modal has no Escape, focus trap, or focus restore — `frontend/src/components/builder/CitePicker.tsx:36-42`

**Category:** focus-management  **Detectors:** a11y  **Platform:** web

The CitePicker is role="dialog" aria-modal="true" and autoFocuses the search input (good initial focus), but it has no Escape-to-close handler, does not trap Tab inside the dialog, and does not restore focus to the toolbar 'Cite' button on close. Keyboard users can Tab out into the editor behind the modal and lose their place when it dismisses (WCAG 2.4.3, 2.1.2). Add Escape handling, a focus trap, and focus return.

**Verifier evidence:** CitePicker.tsx marks the panel role="dialog" aria-modal="true" and autoFocuses the search input (line 47), but the component has no keydown/Escape handler, no Tab trap, and no opener focus-restore; close is only via the × button or backdrop onMouseDown (37/41). Tab therefore escapes into the editor behind the modal — a real 2.4.3/2.1.2 gap, same class as the lightbox.

```tsx
    <div className="bld-pick-back" onMouseDown={() => setPick(null)}>
      <div className="bld-pick" role="dialog" aria-modal="true" aria-label="Insert citation" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bld-pick-h">
          <h4>Insert citation</h4>
          <button className="x" aria-label="Close" onClick={() => setPick(null)}>×</button>
        </div>
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 3. Citation-picker inputs use placeholder text as their only label — `frontend/src/components/builder/CitePicker.tsx:44-51`

**Category:** form-labels  **Detectors:** a11y  **Platform:** web

Every input in the Insert-citation dialog relies on placeholder text with no associated <label> and no aria-label: the bibliography search (lines 45-51), the DOI field (line 79), and the five manual-entry fields — authors/title/year/source/doi (lines 120-126). Placeholders are not accessible names: they vanish on input, are not reliably announced, and fail WCAG 3.3.2 / 4.1.2. Add a <label> (or at minimum aria-label) to each control.

**Verifier evidence:** Every input in CitePicker.tsx (search line 45-51, DOI line 79, and manual authors/title/year/source/doi lines 120-126) has only a placeholder attribute — no <label> and no aria-label. Placeholder-only fields have no persistent accessible name (3.3.2/4.1.2); contrast with Discovery.tsx, which does pair each <select> with a real <label htmlFor>.

```tsx
          <input
            className="bld-search"
            autoFocus
            placeholder="Search your bibliography…"
            value={pick.query || ''}
            onChange={(e) => set({ query: e.target.value })}
          />
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 4. De-facto AI-foreground (#1c4a63) and AI-border (#9cc1d6) colors repeated ~12x with no token — `frontend/src/components/builder/builder.css:14-45`

**Category:** token-drift  **Detectors:** system  **Platform:** web

An AI text color '#1c4a63' is hardcoded across builder.css lines 14, 33, 40, 45, 121, 126 and map.css lines 49, 54; an AI border color '#9cc1d6' across builder.css 14, 45, 126 and map.css 48; plus AI tints '#eef4f8' (builder 26, 110), '#eef5ef' (builder 27, 111) and '#f3f8fb' (map 48). The --ai/--aih fills are tokens, but their matching ink, border, and tints are repeated literals. This is a token that should exist (e.g. --ai-ink / --ai-border): editing the AI hue today means touching a dozen scattered hex values.

**Verifier evidence:** Verified #1c4a63 at builder.css:14,33,40,45,121,126 and map.css:49,54, and #9cc1d6 at builder.css:14,45,126 and map.css:48, plus AI tints #eef4f8 (builder:26,110), #eef5ef (builder:27,111) and #f3f8fb (map:48); none of these exist in tokens.css though --ai/--aih do. The AI ink/border/tint family is an untokenized de-facto palette scattered across two files — a real missing-token finding.

```css
.bld-pillbtn.ai { color: #1c4a63; border-color: #9cc1d6; }
.bld-segtag.ai { background: var(--ai); color: #1c4a63; }
.bld-tbtn.ai { border-color: #9cc1d6; color: #1c4a63; }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 5. Version popover dismisses on mouse-leave only and has no focus management — `frontend/src/components/lens/LensBar.tsx:37-64`

**Category:** keyboard  **Detectors:** a11y  **Platform:** web

The version-history popover trigger sets aria-expanded but omits aria-haspopup, and the open popover is dismissed only via onMouseLeave with no Escape handler and no focus management. A keyboard or touch user who opens it cannot close it without tabbing away (mouseleave never fires), and focus is neither moved into the popover nor returned to the trigger. Add aria-haspopup, an Escape/outside-click close, and roving/return focus.

**Verifier evidence:** LensBar.tsx 38 sets aria-expanded but no aria-haspopup, and 44 dismisses the popover only via onMouseLeave with no Escape/outside-click handler and no focus move/restore. On touch, mouseleave is unreliable, leaving the popover stuck open; the missing haspopup and Escape are genuine (if moderate) gaps. A keyboard user can still close it by re-pressing the trigger or selecting a row, so the 'cannot close' wording is slightly overstated.

```tsx
          <div className="jose-verbtn">
            <button className="jose-chip" onClick={() => setVerOpen((o) => !o)} aria-expanded={verOpen}>
              ...
            </button>
            {verOpen && (
              <div className="jose-pop" onMouseLeave={() => setVerOpen(false)}>
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 6. Version-history popover dismisses only on mouseLeave — fragile and keyboard/touch-hostile — `frontend/src/components/lens/LensBar.tsx:43-44`

**Category:** popover-dismissal-trap  **Detectors:** critique  **Platform:** web

The version-history popover closes solely via onMouseLeave on the panel. There is no Escape handler and no outside-click dismissal, so on touch (no mouseleave) or keyboard use the popover cannot be closed except by reopening the trigger, and on mouse it dismisses accidentally if the pointer briefly strays off the panel while reaching a row. This is both a dismissal trap and a fragile interaction. It is also inconsistent with the Builder's visibility menu (closed on outside mousedown) and the LightboxModal (Escape), so the three overlay surfaces dismiss three different ways.

**Verifier evidence:** Verified the only dismissal paths are onMouseLeave (line 44), re-toggling the trigger (line 38), or selecting a row (line 54) — no Escape/outside-click; the wrapper even stops mousedown propagation (line 32), defeating Reader's outside-click. The three-way inconsistency claim checks out: Builder closes its menu on outside mousedown (Builder.tsx:386 closeMenus) and LightboxModal closes on Escape (LightboxModal.tsx:23-25). Accidental mouse-stray dismissal and touch/keyboard hostility are real.

```tsx
            {verOpen && (
              <div className="jose-pop" onMouseLeave={() => setVerOpen(false)}>
                <h4>Version history</h4>
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 7. Two near-identical caution-yellows (#b8a93e vs #c9a23a) used for the same warning semantic — `frontend/src/components/review/review.css:17-57`

**Category:** token-drift  **Detectors:** system  **Platform:** web

The 'warning/negotiating' state is painted with '#b8a93e' in review.css lines 17 (.seg .on.yellow), 33 (.cstate.negotiating border) and jose.css 107/113, but with a different yellow '#c9a23a' in review.css 57 (.rr-check.warn) and DistributionMap.tsx 193/205 (pending marker). Two visually-adjacent yellows for one meaning, plus the '#8a7d24' text (review.css 33) and '#f8f6e8' tint, are all untokenized. Collapse to a single caution token so the warning color is consistent and theme-able.

**Verifier evidence:** Grep confirms #b8a93e (review.css:17,33; jose.css:107,113) and the near-duplicate #c9a23a (review.css:57; DistributionMap.tsx:193,205) both serve the warning/pending semantic, with #8a7d24 text and #f8f6e8 tint also untokenized. Two perceptually-adjacent yellows for one meaning, none in tokens.css — a real inconsistency and missing token.

```css
.jose-rev .act .seg button.on.yellow { background: #b8a93e; ... }
.jose-coauthor .cstate.negotiating { background: #f8f6e8; border-color: #b8a93e; color: #8a7d24; }
.rr-check.warn .mk { color: #c9a23a; }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 8. No string extraction despite a first-class Language lens — `frontend/src/components/shell/AppShell.tsx:6-15`

**Category:** localization-hardcoded-strings  **Detectors:** copy  **Platform:** web

All UI chrome — nav labels, headings, button text, toasts, error/empty/loading copy — is hardcoded English literals with no i18n layer. Yet language is an explicit product axis: the Lens Bar exposes a "Lang" control (LensBar.tsx:69-72) and lens-url.ts wires a `lang` field ("'en' only in v1, but wired") that Reader passes to the API. Translating content while leaving every label and message untranslatable is a visible gap. Extract user-facing strings to a translation catalog so the Lang lens can eventually drive the whole surface.

**Verifier evidence:** NAV labels are hardcoded English at AppShell.tsx:6-15; the Lang control exists at LensBar.tsx:69-72 (a non-interactive chip showing "en") and lens-url.ts:13 carries a wired `lang` field that Reader.tsx:52 passes to the API. The mismatch — an exposed language axis with zero string extraction — is factually accurate, though it is partly an accepted v1 limitation.

```tsx
const NAV = [
  { to: '/explore', label: 'Discovery', ic: '◎' },
  { to: '/reader', label: 'Reader', ic: '❑' },
  { to: '/builder', label: 'Builder', ic: '✎' },
  { to: '/review', label: 'Review', ic: '◷' },
  ...
];
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 9. "Request review" reports reviewers "will be nominated" but performs no action — `frontend/src/screens/Builder.tsx:341-343`

**Category:** misleading-success  **Detectors:** copy  **Platform:** web

onRequestReview only fires a toast; it makes no API call. When a koId exists it flashes "Review requested — reviewers will be nominated", asserting a state change that never happens on the backend. Success microcopy should describe what actually occurred — either wire the request or change the copy to reflect that the next step is manual (e.g. "Open the Review panel to nominate reviewers").

**Verifier evidence:** Builder.tsx 341-343: onRequestReview's entire body is a single flash() call with no ep.* request, yet the toast asserts 'Review requested — reviewers will be nominated', a backend state change that never occurs. Misleading success copy, confirmed.

```tsx
const onRequestReview = useCallback(() => {
  flash(koId ? 'Review requested — reviewers will be nominated' : 'Save a draft first, then request review');
}, [koId, flash]);
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 10. Builder "Request review" button is a dead stub — it only shows a toast, performs no action — `frontend/src/screens/Builder.tsx:341-343`

**Category:** misleading-affordance  **Detectors:** critique  **Platform:** web

The footer "Request review" button (line 575) is styled identically to the functional Save draft / Export / Publish buttons, but its handler onRequestReview only flashes a toast string; it never navigates to the Review panel, calls an endpoint, or nominates anyone. Users reasonably expect it to start the review flow. A control that looks fully actionable but does nothing erodes trust and leaves the user unsure whether review was actually requested.

**Verifier evidence:** onRequestReview (Builder.tsx:341-343) only calls flash() — no endpoint, navigation, or nomination — yet the toast claims "Review requested — reviewers will be nominated", and the button (line 575) is styled like the functional Save/Export/Publish actions. A clear misleading-affordance that also makes a false success claim; confirmed.

```tsx
  const onRequestReview = useCallback(() => {
    flash(koId ? 'Review requested — reviewers will be nominated' : 'Save a draft first, then request review');
  }, [koId, flash]);
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 11. Footer "Export" button hides which format it produces — `frontend/src/screens/Builder.tsx:576-576`

**Category:** vague-button-label  **Detectors:** copy  **Platform:** web

The footer's "Export" button silently calls onExport('md') — it always exports Markdown — while the Authorship rail offers four explicitly labelled exports (Markdown / docx / JATS / JSON, lines 561-564). A user reading "Export" cannot tell what file they will get, and the unlabelled button duplicates the rail with no format hint. Label it "Export Markdown" (or open the format menu) so the action's outcome is predictable.

**Verifier evidence:** Builder.tsx 576 wires the footer 'Export' button to onExport('md') with no format in the label, while the rail (561-564) exposes four explicitly labelled exports. The generic 'Export' gives no hint that it produces Markdown specifically — a genuine predictability gap.

```tsx
<button onClick={() => onExport('md')} disabled={busy}>Export</button>
```

**Suggested direction:** name the action concretely — verb + object — so the label survives without surrounding context.

---

#### 12. Data-entry screens have no <form> wrapper (Enter-to-submit and autofill break) — `frontend/src/screens/Capture.tsx:102-191`

**Category:** markup-form  **Detectors:** craft  **Platform:** web

There is not a single <form> element in the app (confirmed by search). Capture is a clear field-record form — taxon, note, latitude, longitude, sensitivity, then a Save button — but the inputs sit in plain <div>s and Save is a click-only <button>. Without a <form>, pressing Enter does not submit, browser/password-manager autofill heuristics are weakened, and the field group is not exposed as a form to assistive tech. The same pattern repeats in RecordCurator (profile) and the CitePicker manual/DOI panels. Wrap the fields in <form onSubmit> and make the primary action type="submit".

**Verifier evidence:** A repo-wide search for <form/onSubmit/type="submit" returned zero matches; Capture.tsx:102-191 places labelled inputs in <div>s and the Save action (line 181) is a click-only button. With no <form>, Enter-to-submit doesn't work, autofill is weakened, and the field group isn't exposed as a form — confirmed.

```tsx
<div className="jose-field">
  <label htmlFor="cap-taxon">Taxon ▸ concept id</label>
  <input id="cap-taxon" .../>
</div>
... (lat / lon / sensitivity inputs, all outside any <form>) ...
<button className="jose-btn primary" onClick={onSave} disabled={!canSave}>Save observation</button>
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 13. Discovery anchor-kind control (Taxon/Place/Evidence) does not change search results — `frontend/src/screens/Discovery.tsx:41-44`

**Category:** control-without-effect  **Detectors:** critique  **Platform:** web

The prominent segmented control (lines 89-100) lets the user pick Taxon, Place, or Evidence as the search anchor, but the query object (lines 41-44) never references `anchor` — switching it only changes the input placeholder. A user choosing "Place" or "Evidence" reasonably expects the search to be scoped to localities or specimens/sequences; instead results are identical to free text. The control implies a capability (scoped/faceted search) it does not deliver, which is a confusing information-architecture mismatch.

**Verifier evidence:** Verified: `anchor` state (line 29) feeds only the input placeholder (line 85) and the aria-pressed button state (lines 90-99); it is absent from `query` (lines 41-44) and from the cache `key` (line 45), so Place/Evidence return the same docs as free text. The page lede 'Browse the graph by taxon, place, or evidence' reinforces a scoping promise the code does not keep — a real IA mismatch, even though the component comment notes it is intentional v1 behaviour.

```tsx
  const query = useMemo(
    () => ({ text: text.trim() || undefined, koType: koType || undefined, status: status || undefined, index }),
    [text, koType, status, index],
  );
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 14. Search-failure surfaces the raw server error string to the user — `frontend/src/screens/Discovery.tsx:160-164`

**Category:** error-technical-leakage  **Detectors:** copy  **Platform:** web

On a failed search the panel prints `(searchQ.error as Error)?.message` verbatim. That message comes from ApiError, which is built from the server's JSON `message` (possibly a joined validation array) or falls back to `res.statusText` / raw response text (see core/api/client.ts). The user can be shown technical strings like "Internal Server Error", "Failed to fetch", or backend validation arrays, and the fallback "The search could not be completed." still offers no recovery step. Show a stable human message plus a next action ("Try again" / "adjust your filters").

**Verifier evidence:** Discovery.tsx line 163 renders error.message verbatim. client.ts confirms ApiError.message = server JSON `message` (array joined) or res.statusText (line 59-60), and a network failure throws a native TypeError('Failed to fetch') that react-query exposes the same way. Users can thus see raw technical strings, and no recovery action is offered.

```tsx
) : searchQ.isError ? (
  <div className="disc-err">
    <b>Search failed</b>
    {(searchQ.error as Error)?.message ?? 'The search could not be completed.'}
  </div>
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 15. setHover on every SVG mousemove re-renders the whole map and rebuilds gridLines each time — `frontend/src/screens/DistributionMap.tsx:100-157`

**Category:** perceived-performance  **Detectors:** craft  **Platform:** web

onMove calls setHover on every pointer move across the 440x440 SVG. Each resulting render re-runs the full component body, including the gridLines loop (lines 155-157) which is built inline in render (not memoized) and re-renders every grid line, cell, and marker. On low-end/field devices this makes the cursor readout janky for what is purely a text overlay. Throttle the hover update, write the readout via a ref instead of state, and/or move gridLines into a useMemo keyed on view+precision.

**Verifier evidence:** onMove (DistributionMap.tsx:100-109) calls setHover on every pointer move; each render re-runs the body and rebuilds gridLines via the inline loops at lines 155-157 (not memoized, unlike `cells`). The whole SVG re-renders for a text-only cursor readout — a real perceived-performance issue on low-end devices.

```tsx
const onMove = (e: React.MouseEvent) => {
  ...
  setHover(cell ? cell.codes[0] : '—');
};
// later, in render body (re-runs on every hover):
for (let lon = view.lonLo; lon <= view.lonHi + 1e-9; lon += gridStep) gridLines.push(<line .../>);
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 16. Curator/precise-access errors are terse and give no recovery path — `frontend/src/screens/DistributionMap.tsx:117-119`

**Category:** error-no-recovery  **Detectors:** copy  **Platform:** web

Failure toasts in the map flow are dead ends: "Decision failed" (line 119) and "Precise request failed" (line 141) tell the user nothing about why or what to do next. "Access served" vs "Access required" (line 139) is also vague/jargon-y wording for the same flow. Only the "…ask an editor" branch gives a usable next step. Give each failure a cause and an action (retry, check connection, request a grant).

**Verifier evidence:** DistributionMap.tsx 118 'Decision failed' and 141 'Precise request failed' are bare failure toasts with no cause or next step, and 139 'Access served' is jargon-y. Confirmed in source; only the 'ask an editor' branch (139) gives an action. The companion '403 — needs curator role' string does state the role, so that specific case is partially mitigated.

```tsx
} catch (e) {
  flash((e as { status?: number })?.status === 403 ? 'Not permitted — needs curator role' : 'Decision failed');
}
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 17. Distribution map header hardcodes one species name for every object — `frontend/src/screens/DistributionMap.tsx:162-162`

**Category:** hardcoded-content  **Detectors:** copy  **Platform:** web

The map title literally renders "Distribution · Mesembryanthemum aureum" regardless of which koId is loaded. Any object opened on /map/:koId other than the seeded flagship will display the wrong taxon name. The title should come from the loaded object/seed (seed?.name or the map/read model), not a hardcoded string. This is both a content-accuracy bug and a hardcoded user-facing string.

**Verifier evidence:** DistributionMap.tsx 162 hardcodes the taxon name in the header, while koId is dynamic (param ?? seed.koId, line 37) and the route /map/:koId accepts any object. The map query returns only ObservationPublic[] (no taxon), so opening any non-flagship object shows the wrong species name — a real content-accuracy bug.

```tsx
<div className="mp-h-title">Distribution · <i>Mesembryanthemum aureum</i></div>
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 18. Distribution map stage has no empty state when an object has no observations — `frontend/src/screens/DistributionMap.tsx:173-201`

**Category:** empty-state-missing  **Detectors:** critique  **Platform:** web

When the loaded observation list is empty, `accepted`/`pending`/`cells` are all empty and the viewport falls back to a default bbox (lines 74-79). The SVG then renders just an empty grid with a "cursor —" readout and no message explaining there is no distribution data. A blank graticule with no cells reads as a loading bug rather than "this taxon has no recorded localities yet." Add an empty-state overlay on the map stage (the rail already says "No pending observations", but the primary visualization is silent).

**Verifier evidence:** Verified: after the loading guard (line 152), empty `obs` yields empty accepted/pending/cells and a fallback bbox (lines 76-79); the SVG renders only the background rect and grid lines (lines 177-178) with a 'cursor —' readout and no on-stage message. The rail shows 'No pending observations' (line 238) but the primary map gives no empty state, so a no-data taxon reads as a render bug.

```tsx
          <div className="mp-readout">
            <span><span className="lbl">cursor</span> {hover || '—'}</span>
            {selCode && !exact && <span><span className="lbl">cell</span> {cells.find((c) => c.key === selCode)?.codes[0]} · {cells.find((c) => c.key === selCode)?.n} obs · ≈25 km</span>}
```

**Suggested direction:** add an empty-state component with a one-sentence explanation and a next-action affordance.

---

#### 19. Distribution-map cells are click-only SVG groups with no keyboard access — `frontend/src/screens/DistributionMap.tsx:179-188`

**Category:** keyboard  **Detectors:** a11y  **Platform:** web

Each QDS cell is a <g className="mp-cell" onClick={() => setSelCode(c.key)}> with no role, tabindex, or key handler, so it cannot be focused or activated by keyboard. Cell details (code, obs count, ~25 km) and the cursor coordinate readout are produced only by the mouse handlers (onMouseMove at lines 100-109, onClick here), leaving keyboard and screen-reader users with no way to inspect the distribution data the map conveys. Provide a keyboard-operable alternative (focusable cells with role="button" + Enter/Space, or a textual list of cells).

**Verifier evidence:** The cell <g> (DistributionMap.tsx 183) has onClick but no role/tabIndex/onKeyDown, and the cell detail readout (line 199) and cursor coordinates (onMouseMove 100-109) are mouse-only. The SVG carries role="img" but its interactive cells are unreachable by keyboard, so SR/keyboard users cannot inspect per-cell obs counts — a 2.1.1 failure.

```tsx
                return (
                  <g key={c.key} className="mp-cell" onClick={() => setSelCode(c.key)}>
                    <rect x={x} y={y} width={w} height={h} fill="#2E6E5E" .../>
                    <text ...>{c.n}</text>
                  </g>
                );
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 20. Click handler on a non-interactive SVG <g> — cell selection is mouse-only — `frontend/src/screens/DistributionMap.tsx:183-187`

**Category:** non-interactive-handler  **Detectors:** craft  **Platform:** web

Each distribution cell is a bare <g onClick={() => setSelCode(c.key)}> with no role, no tabindex, and no keyboard handler, so selecting a QDS cell to read its code/observation count is impossible by keyboard and invisible to assistive tech. Give the group role="button" + tabIndex={0} + an onKeyDown (Enter/Space), or render the interactive cell as a focusable element, so keyboard users can reach the same readout.

**Verifier evidence:** DistributionMap.tsx:183 is a plain <g onClick={...}> with no role, tabIndex, or onKeyDown; the cell readout (codes / obs count, shown at line 199) is therefore reachable only by mouse and is invisible to keyboard and AT users. Real medium a11y/craft defect.

```tsx
<g key={c.key} className="mp-cell" onClick={() => setSelCode(c.key)}>
  <rect x={x} y={y} width={w} height={h} fill="#2E6E5E" .../>
  <text ...>{c.n}</text>
</g>
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 21. Distribution-map SVG and legend hardcode token hex and an untokenized pending-yellow — `frontend/src/screens/DistributionMap.tsx:184-206`

**Category:** color-token-drift  **Detectors:** system  **Platform:** web

The map cells/points and the legend swatches use literal hex equal to tokens: '#2E6E5E' (--verified), '#A83A2C' (--type-red), grid stroke '#D9DED6' (--rule) at lines 156-157. The pending marker uses '#C9A23A' (lines 193, 205) which has no token at all and is a near-duplicate of the '#b8a93e' yellow used in jose.css/review.css for the same caution semantic. Background fill '#fbfcfa' (line 177) is an off-token near-white. Inline token-value literals defeat the token layer and the two yellows are an inconsistency.

**Verifier evidence:** Verified literals #2E6E5E/#A83A2C/#D9DED6 equal --verified/--type-red/--rule (lines 184-185,190,156-157,204,206), and the off-token near-white #fbfcfa is at line 177. The pending yellow #C9A23A (lines 193,205) has no token in tokens.css and grep confirms a sibling caution-yellow #b8a93e is used for the same warning semantic in jose.css:107/113 and review.css:17 — a real drift plus a two-yellow inconsistency.

```tsx
<rect ... fill="#2E6E5E" fillOpacity={on ? 0.34 : 0.2} stroke="#2E6E5E" .../>
<circle ... r={4.5} fill="#A83A2C" />
<rect ... stroke="#C9A23A" strokeWidth={2} ... />
<span><i style={{ background: 'transparent', border: '2px solid #C9A23A' }} />pending</span>
```

**Suggested direction:** replace the literal with the equivalent design-system token; if no token matches, add one.

---

#### 22. Clicking "Precise" in the top-left header opens its request form at the bottom of the right rail — `frontend/src/screens/DistributionMap.tsx:246-255`

**Category:** action-placement  **Detectors:** critique  **Platform:** web

The precision segmented control (incl. the 🔒 Precise button) lives in the sticky header top-left (lines 163-169). For a certified user with no grant, tapping it sets `requesting`, which renders the "Request precise access" card far away at the bottom of the right-hand rail (lines 248-255). The response to the action appears disconnected from where the user clicked, so it is easy to click Precise and not notice the form that appeared, especially on a tall map. Surface the request affordance adjacent to the trigger (e.g. a popover anchored to the Precise button).

**Verifier evidence:** Traced the flow: the 🔒 Precise button (header top-left, line 167) calls tryPrecise → setRequesting(true) (lines 145-148), and the request card renders inside `.mp-rail` under the 'Precise access' h3 at the bottom of the right column (lines 246-255). The trigger and its response are spatially disconnected across a ~440px-tall map, so the appearing form is easy to miss — a real feedback-locality issue.

```tsx
          {requesting && (
            <div className="mp-reqcard">
              <h4>Request precise access</h4>
              <p>Object-specific, time-limited (10 min), logged, and revocable. Served in-session only — never written to your device.</p>
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 23. Bare "Loading…" on the app's first screen gives no context — `frontend/src/screens/Home.tsx:7-7`

**Category:** loading-no-context  **Detectors:** copy  **Platform:** web

The landing route shows a context-free "Loading…" while it resolves the seed and redirects into the Reader. Every other async screen in the app uses a contextual message (Reader: "Loading treatment…", DistributionMap: "Loading distribution…", SnippetViewer: "Resolving snippet…"), so the very first thing a user sees is also the least informative. Say what is loading, e.g. "Opening treatment…" or "Loading JOSE…".

**Verifier evidence:** Home.tsx line 7 renders a bare "Loading…" while Reader.tsx (118 'Loading treatment…') and DistributionMap.tsx (152 'Loading distribution…') use contextual copy. This is a real consistency gap against the app's own established pattern on its very first screen, not merely a wording preference.

```tsx
if (seed === undefined) return <div className="jose-loading">Loading…</div>;
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 24. QDS-lattice SVG hardcodes exact token hex (#D9DED6=--rule, #2E6E5E=--verified, #A83A2C=--type-red) — `frontend/src/screens/Reader.tsx:27-30`

**Category:** color-token-drift  **Detectors:** system  **Platform:** web

The inline SVG paints with literal hex that exactly equal design tokens: stroke '#D9DED6' is --rule, fill '#2E6E5E' is --verified, fill '#A83A2C' is --type-red. The same pattern repeats in DistributionMap.tsx (lines 156-157 stroke #D9DED6; 184-185 fill #2E6E5E; 190 fill #A83A2C). These are token values copied as literals; if a token shifts, these graphics drift. Reference the tokens via style/CSS-var instead.

**Verifier evidence:** Confirmed: tokens are --rule=#d9ded6, --verified=#2e6e5e, --type-red=#a83a2c, and the QDSMini SVG uses those exact literals (Reader.tsx:27-30); the same literals recur in DistributionMap.tsx:156-157,184-185,190. They are semantically the tokens (grid rule, accepted-cell green, occurrence red) and could be expressed as style={{stroke:'var(--rule)'}} etc., so this is real, fixable token drift.

```tsx
<line ... stroke="#D9DED6" />
<rect ... fill="#2E6E5E" opacity="0.32" />
<circle cx="78" cy="40" r="4" fill="#A83A2C" />
```

**Suggested direction:** replace the literal with the equivalent design-system token; if no token matches, add one.

---

#### 25. Terse "Not permitted" errors omit the role needed and a way forward — `frontend/src/screens/Reader.tsx:118-122`

**Category:** error-no-recovery  **Detectors:** copy  **Platform:** web

Permission errors are rendered as a bare "Not permitted" heading with only the koId in mono below — no statement of which role is required and no action (sign in, switch account, go back). The same terse string recurs in Builder.tsx:335, ReviewPanel.tsx:107 and SnippetViewer.tsx:37. This is inconsistent with the app's good 403 copy elsewhere (Discovery: "Restricted index is limited to editors and stewards."; Builder: "Not permitted to edit this treatment"). In a role-gated app, telling the user they lack permission without saying what role to assume leaves them stuck.

**Verifier evidence:** Reader.tsx 119-121 shows only 'Not permitted' + the raw koId with no role hint or recovery action, and Builder.tsx 335 ('Not permitted') repeats the terse form. This is demonstrably below the app's own better 403 copy (Discovery.tsx 64 'Restricted index is limited to editors and stewards.', Builder 326 'Not permitted to edit this treatment') — a real dead-end in a role-gated app.

```tsx
if (readQ.isError || !readQ.data) {
  const status = (readQ.error as { status?: number })?.status;
  return <div className="jose-stub"><h2>{status === 403 ? 'Not permitted' : 'Treatment unavailable'}</h2><p className="jose-mono">{koId}</p></div>;
}
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 26. ProvChip component is declared inside the Reader render body, remounting every render — `frontend/src/screens/Reader.tsx:136-137`

**Category:** re-render  **Detectors:** craft  **Platform:** web

ProvChip is defined as a component inside Reader's render function, so it gets a new component identity on every Reader render. React therefore unmounts and remounts every <ProvChip> in the treatment body on each re-render. Reader re-renders frequently (every text-selection mouseUp, every citer/card state change, every lens toggle), so this throws away and rebuilds that subtree each time. Hoist ProvChip to module scope (passing showProv/verLabel/authorLabel as props) or inline it as plain JSX.

**Verifier evidence:** ProvChip is declared inside the Reader component body (Reader.tsx:136-137) and used in renderBlock at line 145, giving it a fresh identity each render and forcing remounts; Reader re-renders on selection (onMouseUp), citer/card state, and lens toggles. Cost is small when showProv is off (returns null) but the anti-pattern is real and correctly flagged.

```tsx
const ProvChip = ({ blockId }: { blockId: string }) =>
  showProv ? <div className="jose-prov">{verLabel} · {authorLabel}{blockId ? '' : ''}</div> : null;
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 27. Reader AI-legend swatches hardcode the exact hex of --ai/--aih tokens while the identical Builder legend uses var() — `frontend/src/screens/Reader.tsx:184-186`

**Category:** color-token-drift  **Detectors:** system  **Platform:** web

The AI-content legend renders inline swatches with literal hex: '#bcd4e2' is the exact value of the --ai token and '#cfe0d6' is the exact value of the --aih token (the human swatch '#dfe7e2' is also off-token; --haze is #ecefe9). Builder.tsx:415-417 renders the same three-item legend correctly with background: 'var(--haze)' / 'var(--ai)' / 'var(--aih)'. So one screen drifts from tokens the other honors — change the token palette and the Reader legend silently desyncs.

**Verifier evidence:** Confirmed against tokens.css: --ai=#bcd4e2 and --aih=#cfe0d6 exactly match the Reader literals (lines 185-186), and the human swatch #dfe7e2 differs from --haze (#ecefe9). The Builder renders the same legend with var(--haze)/var(--ai)/var(--aih) (Builder.tsx:415-417), so the Reader literals are genuine token drift that will desync — and the human swatch is already visually inconsistent between the two screens.

```tsx
<span><i style={{ background: '#dfe7e2' }} />human</span>
<span><i style={{ background: '#bcd4e2' }} />AI</span>
<span><i style={{ background: '#cfe0d6' }} />AI → human</span>
```

**Suggested direction:** replace the literal with the equivalent design-system token; if no token matches, add one.

---

#### 28. Reader evidence-rail items look identical but only some are interactive — `frontend/src/screens/Reader.tsx:240-253`

**Category:** affordance-inconsistency  **Detectors:** critique  **Platform:** web

In the evidence rail, "Distribution (QDS)" (241), "Specimens" (242), "Sequences" (243) and "Versions" (247-253) are rendered as <button className="jose-railitem"> with hover affordance but no onClick — they do nothing. Only "Provenance overlay" (244-246) actually toggles state. Because all five share identical button styling and hover feedback, the user cannot tell which evidence rows are actionable; clicking Specimens/Sequences/Distribution silently fails, which reads as a broken UI.

**Verifier evidence:** Verified in Reader.tsx: Distribution (241), Specimens (242), Sequences (243), and Versions (247-253) are <button className="jose-railitem"> with no onClick, while only Provenance overlay (244-246) has an onClick. Four of five identically-styled buttons are inert, so clicking them silently fails — a real medium affordance-inconsistency.

```tsx
          <button className="jose-railitem"><span className="ic">▰</span><span><span className="t">Specimens</span><span className="s">vouchers</span></span></button>
          <button className="jose-railitem"><span className="ic">⛓</span><span><span className="t">Sequences</span><span className="s">GenBank links</span></span></button>
          <button className={`jose-railitem ${showProv ? 'active' : ''}`} onClick={() => setLens({ annotations: { provenance: !showProv } })}>
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 29. Reader 'Cite this passage' flow and snippet card are mouse-only / not a dialog — `frontend/src/screens/Reader.tsx:266-286`

**Category:** keyboard  **Detectors:** a11y  **Platform:** web

The cite-passage affordance appears only from a mouse text selection (onMouseUp at lines 75-93) and the resulting snippet card is a bare <div className="jose-citecard"> — not role="dialog", with no focus move, trap, or restore, and dismissed by an outside onMouseDown. Keyboard and screen-reader users cannot reach the snippet-anchor/copy-citation action at all, and even mouse users get an unmanaged floating panel. Expose the action via a keyboard path and give the card proper dialog semantics + focus handling.

**Verifier evidence:** The citer is gated on onMouseUp (Reader.tsx 75-93), which does not fire for keyboard text selection, and the card (271-286) is a plain <div className="jose-citecard"> with no dialog role or focus management, dismissed by the page-level onMouseDown at line 178. Keyboard/SR users have no path to the Copy-citation action — a real 2.1.1 keyboard-operability failure.

```tsx
      {citer && (
        <button className="jose-citebtn" style={{ left: citer.x - 58, top: citer.y }} onMouseDown={(e) => e.preventDefault()} onClick={openCard}>
          <span className="c" /> Cite this passage
        </button>
      )}
      {card && (
        <div className="jose-citecard" style={{ left: card.x, top: card.y }} onMouseDown={(e) => e.stopPropagation()}>
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 30. AI annotation block hardcodes a literal --ai value and two untokenized AI shades — `frontend/src/styles/jose.css:90-92`

**Category:** token-drift  **Detectors:** system  **Platform:** web

Line 92 sets `.jose-aitag i { background: #bcd4e2 }` — #bcd4e2 is the exact value of the --ai token, so it should be var(--ai). Lines 90-91 introduce two further AI-family colors that have no token: the block tint '#f3f6f8' and the tag text '#3a6b86'. The AI fill is tokenized (--ai/--aih) but its companion tint and text are not, so the AI surface is only half-tokenized.

**Verifier evidence:** Confirmed: .jose-aitag i uses #bcd4e2 (line 92), exactly --ai, and this swatch is semantically the AI fill so it should be var(--ai). The block tint #f3f6f8 (line 90) and tag text #3a6b86 (line 91) are AI-surface colors with no token in tokens.css, so the AI annotation surface is genuinely only half-tokenized.

```css
.jose-block.ai-on { background: #f3f6f8; box-shadow: -12px 0 0 #f3f6f8, 12px 0 0 #f3f6f8; ... }
.jose-aitag { ... color: #3a6b86; ... }
.jose-aitag i { ... background: #bcd4e2; ... }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 31. type-red wash backgrounds use two near-duplicate literals (#fdf3f1 and #fdf6f5) repeated app-wide — `frontend/src/styles/jose.css:97-149`

**Category:** token-drift  **Detectors:** system  **Platform:** web

The light type-red wash that pairs with --type-red is hardcoded as '#fdf3f1' in jose.css 43/106, discovery.css 48, lightbox.css 89, map.css 11, profile.css 47, review.css 35, and as a near-duplicate '#fdf6f5' in jose.css 97/112/138 and builder.css 29/112. Two slightly different washes for the same purpose is drift; both should be a single --type-red-wash token. The matching wash borders ('#e3b7af', '#d8b4ad', '#f0d4cf', '#e3b7af') are likewise untokenized near-duplicates.

**Verifier evidence:** Grep confirms #fdf3f1 across jose.css:43,106, discovery.css:48, lightbox.css:89, map.css:11, profile.css:47, review.css:35 and the near-duplicate #fdf6f5 at jose.css:97 and builder.css:29,112,138 — two slightly different type-red washes for the same purpose, plus untokenized wash borders #e3b7af (map.css:11,37) and #f0d4cf (profile.css:47). Real cross-file drift; a couple of the cited #fdf6f5 line numbers are approximate but the pattern is exactly as described.

```css
.jose-evidence { ... background: #fdf6f5; ... }
.jose-rev.red { border-color: var(--type-red); background: #fdf3f1; }
.bld-seg.claim textarea { border-left: 3px solid var(--type-red); background: #fdf6f5; }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 32. Amber status text #c8772a on light backgrounds is ~3.4:1 — `frontend/src/styles/jose.css:163-163`

**Category:** color-contrast  **Detectors:** a11y  **Platform:** web

The amber/drift accent #c8772a fails 4.5:1 for normal text on white/paper (~3.43:1) wherever it is used as small text: the drift notice (.jose-drift, 11px), the 'not cited' badge (builder.css .used.zero line 173), and the offline indicator hardcoded inline in AppShell.tsx line 35 (`style={{ color: '#c8772a', fontSize: 11 }}`). The same hue as a ✗/⚠ icon mark (review.css .rr-check.no/.warn lines 56-57) is ~2.4:1, below the 3:1 graphical-object minimum. Use a darker amber for text/icons or pair with sufficient weight/size.

**Verifier evidence:** #c8772a on white is 3.43:1 (on #F6F8F5 paper 3.21:1), below 4.5:1 for the 11px .jose-drift (jose.css 163), the 10.5px .used.zero badge (builder.css 173) and the inline 11px offline indicator (AppShell.tsx 35) — all confirmed in source as small text. The warn check-mark #c9a23a (review.css 57) is 2.41:1, under the 3:1 non-text minimum, so the icon sub-claim also holds.

```css
.jose-drift { font-size: 11px; color: #c8772a; margin: 8px 0; font-family: var(--ui); }
```

**Suggested direction:** darken/lighten the relevant token until contrast meets 4.5:1 (3:1 for large text or non-text UI).

---

#### 33. --structure (#6E7C70) used as body/label text falls below 4.5:1 on paper — `frontend/src/styles/tokens.css:8-11`

**Category:** color-contrast  **Detectors:** a11y  **Platform:** web

The --structure token (#6E7C70) computes to ~4.11:1 against --paper (#F6F8F5), under the 4.5:1 floor for normal text. It is used pervasively for small (8.5–11px) but essential labels and placeholders: .jose-field label, .jose-h, .jose-card h3, .bld-rh, .mp-rh, .disc-count .disc-non, .jose-demo, input::placeholder, etc. (jose.css lines 36, 81, 86, 173, 179; builder/map/discovery CSS). Additionally white text on a #6E7C70 background (.po-src, .bld-refcard .rt chips) is ~4.39:1, also under 4.5:1 for 9–10.5px text. Darken --structure (or only use it for >=14px-bold/large text).

**Verifier evidence:** #6E7C70 on #F6F8F5 computes to 4.11:1 and white-on-#6E7C70 to 4.39:1, both under the 4.5:1 normal-text floor. The token is applied to many small (9–11px) labels/placeholders (e.g. jose.css .jose-h line 86, .jose-card h3 line 173, .jose-field label line 179, .bld-refcard .rt 9px white-on-structure chip), so essential non-large text fails AA.

```css
  --structure: #6e7c70;
  --rule: #d9ded6;
  --type-red: #a83a2c;
  --verified: #2e6e5e;
```

**Suggested direction:** darken/lighten the relevant token until contrast meets 4.5:1 (3:1 for large text or non-text UI).

---

### Low

#### 1. SeedRedirect shows a context-free "Loading…" — `frontend/src/App.tsx:21-21`

**Category:** loading-no-context  **Detectors:** copy  **Platform:** web

The /review and /map parameterless redirects render a bare "Loading…" while the seed resolves. Same issue as Home: it is inconsistent with the contextual loading copy used on every data screen. A short phrase like "Finding the seeded treatment…" matches the rest of the app and tells the user why they are waiting.

**Verifier evidence:** App.tsx line 21 (SeedRedirect, used by /review and /map) renders the same bare "Loading…" as Home, inconsistent with the contextual loading strings used on the data screens. A real but low-severity consistency finding.

```tsx
if (seed === undefined) return <div className="jose-loading">Loading…</div>;
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 2. useToast.flash schedules a setTimeout with no cleanup or clearTimeout — `frontend/src/components/common/useToast.tsx:6-11`

**Category:** effect-cleanup  **Detectors:** craft  **Platform:** web

flash() starts a 1900ms setTimeout to clear the toast but never stores or clears the timer. Rapid successive flashes stack independent timers (the toast can vanish earlier than its 1900ms because an older timer fires), and a flash immediately before the host unmounts calls setToast on an unmounted component. Keep the timer id in a ref, clear it at the start of flash, and clear it in a useEffect cleanup on unmount.

**Verifier evidence:** useToast.tsx:6-9 fires setTimeout(…,1900) with no ref, clearTimeout, or unmount cleanup. The stacked-timer bug is real: a second flash within 1900ms leaves the first timer alive, so it clears the newer message early. (The unmounted-setState concern is a no-op in React 18, but the early-dismiss behavior alone justifies the low-severity finding.)

```tsx
const flash = useCallback((m: string) => {
  setToast(m);
  setTimeout(() => setToast(null), 1900);
}, []);
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 3. Icon-only and text-link controls fall below the 44x44 px target — `frontend/src/components/media/lightbox.css:126-126`

**Category:** touch-target  **Detectors:** a11y  **Platform:** web

Several activation targets are well under WCAG 2.5.5's 44x44 CSS px: the lightbox close × (lightbox.css line 126, padding 0 4px around a 24px glyph), the account 'switch / sign out' link buttons (jose.css .shell-acct button.link line 18, padding 4px 0), and the per-block editor tools (builder.css .bld-blocktools button line 120, padding 2px 7px). These matter most on touch/field use, which JOSE's capture flow targets. Increase hit area via padding or min-height/min-width.

**Verifier evidence:** Measured from source: .lb-modal-close (lightbox.css 126) is ~24px tall with padding 0 4px (~22px wide), .shell-acct button.link (jose.css 18) ~15px tall, and .bld-blocktools button (builder.css 120) ~15px tall — all well under 44px. Note 2.5.5 is WCAG AAA (not part of 2.1 AA), but the targets are genuinely small for the touch/field-capture use the app targets.

```css
.lb-modal-close { border: 0; background: transparent; font-size: 24px; line-height: 1; color: var(--structure); cursor: pointer; padding: 0 4px; }
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 4. Verb/noun agreement assembled by inline conditionals — `frontend/src/components/review/ReleaseButton.tsx:68-76`

**Category:** localization-concat-plural  **Detectors:** copy  **Platform:** web

Release-readiness copy stitches grammar together with ternaries: "`${n} reviewer ${n===1 ? 'comment needs' : 'comments need'} your reply`" and "`${n} co-author ${n===1 ? 'is' : 'are'} named-unconfirmed`". DistributionMap.tsx:256 does the same with the lazy "point(s)" form. This per-string English grammar logic cannot be translated and is fragile; route plurals through a pluralization library / i18n catalog.

**Verifier evidence:** Verified the two inline-ternary plural forms at ReleaseButton.tsx:70 and 75, and the lazy "point(s)" form at DistributionMap.tsx:256. The English grammar is hardcoded in JSX with no pluralization layer; valid low-severity localization/craft observation, especially given a lang axis is wired (lens-url.ts).

```tsx
<span>{gated ? `${unresolved.length} reviewer ${unresolved.length === 1 ? 'comment needs' : 'comments need'} your reply` : 'All reviewer comments addressed'}</span>
...
<span>{unconfirmed.length} co-author {unconfirmed.length === 1 ? 'is' : 'are'} named-unconfirmed — flagged on the record, not blocked.</span>
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 5. Offline state worded three different ways across the app — `frontend/src/components/shell/AppShell.tsx:35-35`

**Category:** voice-inconsistency  **Detectors:** copy  **Platform:** web

The same offline condition is phrased and capitalized inconsistently: the nav says "● offline — public cache" (lowercase), OfflineBadge.tsx:21 says "Offline — will sync" (capitalized), and Capture.tsx:196 says "● Offline — will sync. Your capture is held locally and queued…". A user moving between screens sees conflicting framings (cache vs. queue) for one network state. Standardize the offline label and casing.

**Verifier evidence:** Confirmed all three strings: AppShell.tsx:35 "● offline — public cache" (lowercase), OfflineBadge.tsx:21 "Offline — will sync" (capitalized), Capture.tsx:196 "● Offline — will sync…". Casing is inconsistent for the same indicator and the framings differ (cache vs. queue); a real low-severity voice/consistency issue (the cache-vs-queue split is partly justified since one is read-side and one write-side).

```tsx
{!online && <div style={{ color: '#c8772a', fontSize: 11, marginBottom: 6 }}>● offline — public cache</div>}
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 6. Account/sign-in switcher menu has no outside-click or Escape dismissal — `frontend/src/components/shell/AppShell.tsx:47-60`

**Category:** dismissal-inconsistency  **Detectors:** critique  **Platform:** web

The account switcher dropdown (quick-login list) opens on "switch ▾" / "sign in (dev) ▾" but can only be closed by toggling the same button or selecting an entry — there is no outside-click or Escape close. The Builder (closeMenus on wrapper mousedown) and other overlays do close on outside interaction, so the app handles menu dismissal inconsistently across surfaces. Minor here because the menu is small, but it is a papercut and a consistency gap.

**Verifier evidence:** Verified the menu is gated on `menu` state toggled only by the switch/sign-in buttons (lines 41,45) and reset on login (line 54); there is no document/Escape listener, unlike Builder's outside-mousedown close (Builder.tsx:386). A user who clicks elsewhere expecting the dropdown to close finds it still open — a genuine, low-severity consistency gap as the finder concedes.

```tsx
            {menu && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {QUICK_LOGINS.map((q) => (
                  <button
                    key={q.sub}
                    className="jose-btn"
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 7. Builder screen mixes editing, persistence, AI declaration, export and navigation in one ~600-line component — `frontend/src/screens/Builder.tsx:97-381`

**Category:** single-responsibility  **Detectors:** craft  **Platform:** web

Builder is a large orchestrator that owns block/editor state, the citation index, AI drafting, server persistence (createKo/saveDraft/amend/release), AI-declaration recording, blob-based file export/download, navigation, and toasts. Much is delegated to citations.tsx/CitePicker/AutoTextarea, so this is borderline for a single screen, but the persistence + export + AI-declaration logic (ensureKo/recordAi/onSaveDraft/onPublish/onExport) is self-contained and would be clearer extracted into a useBuilderPersistence hook, shrinking the component and isolating the side-effectful flows. Low confidence — a single authoring screen carrying this much is partly intentional.

**Verifier evidence:** Builder.tsx is 598 lines and the enumerated flows all exist and are self-contained: ensureKo (299), recordAi (308), onSaveDraft (312), onPublish (345), onExport (359) bundle persistence, AI-declaration, release, and blob export in one component. The extract-a-hook suggestion is an accurate, honestly-hedged low-severity maintainability observation, not a fabrication.

```tsx
const ensureKo = useCallback(async (): Promise<string> => { ... ep.createKo(...) }, [...]);
const recordAi = useCallback(async (id) => { await ep.putAiDeclaration(id, ...); }, [...]);
const onSaveDraft = useCallback(async () => { ... ep.saveDraft / ep.amend ... }, [...]);
const onPublish = useCallback(async () => { ... ep.release(id, 'commons') ... }, [...]);
const onExport = useCallback(async (fmt) => { ... Blob + a.click() download ... }, [...]);
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 8. Two "Export" controls with different scope and placement — `frontend/src/screens/Builder.tsx:573-581`

**Category:** inconsistent-action  **Detectors:** critique  **Platform:** web

The footer has an "Export" button (line 576) that exports Markdown only (onExport('md')), while the Authorship rail (lines 558-565) offers a separate Export group with Markdown / docx / JATS / JSON. Same verb, two locations, different capabilities — a user who clicks the footer Export gets only Markdown with no indication other formats exist elsewhere. Consolidate to one Export affordance, or label the footer one as "Export Markdown" to disambiguate.

**Verifier evidence:** Verified: footer button labelled plain "Export" hardcodes onExport('md') (line 576), while the rail's Export group (lines 560-564) offers md/docx/jats/json — and that group lives under the 'Authorship' tab (default tab is 'references', line 111), so it is not even visible by default. The shared verb with differing scope and a hidden full-format set is a real ambiguity.

```tsx
      <div className="bld-foot" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onSaveDraft} disabled={busy}>Save draft</button>
        <button onClick={onRequestReview} disabled={busy}>Request review</button>
        <button onClick={() => onExport('md')} disabled={busy}>Export</button>
        <button className="primary" onClick={onPublish} disabled={busy}>Publish to Commons</button>
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 9. "Add photo" CTA performs no action, only flashes a placeholder note — `frontend/src/screens/Capture.tsx:91-100`

**Category:** misleading-cta  **Detectors:** copy  **Platform:** web

The prominent "Add photo" button does not add a photo — it flashes "Camera placeholder — capture happens in the native field app". A primary-looking affordance that cannot do what its label promises is a small trust hit; either disable/relabel it ("Photos: use the field app") or surface the limitation in the button itself rather than only after a click.

**Verifier evidence:** Capture.tsx:91-100: onClick only calls flash('Camera placeholder…'); there is no file input or capture action, and the aria-label "Add photo. EXIF metadata is stripped on sync." reinforces a promise the control can't keep. Real low-severity misleading-CTA.

```tsx
<button
  type="button"
  className="cap-photo"
  onClick={() => flash('Camera placeholder — capture happens in the native field app')}
  aria-label="Add photo. EXIF metadata is stripped on sync."
>
  <span className="glyph" aria-hidden>📷</span>
  <span>Add photo</span>
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 10. Select options mix Title Case with raw lowercase enum values — `frontend/src/screens/Discovery.tsx:116-128`

**Category:** capitalization-inconsistency  **Detectors:** copy  **Platform:** web

Within one Filters card the Tier select uses Title Case ("Both", "Journal", "Commons") while the Type and Status selects render raw lowercase enum values ("treatment", "micro-observation", "reviewed", "vor", "superseded"…). Capture.tsx:174-176 similarly shows lowercase "normal / sensitive / highly-sensitive". Presenting machine enum tokens directly to users alongside Title-Cased siblings reads as unfinished; map enum values to consistently-cased display labels.

**Verifier evidence:** In one Filters card, Tier options are Title Case (Discovery.tsx:111-113) while Type (KO_TYPES, line 120) and Status (STATUSES, line 127) render raw lowercase enum tokens including "vor" and "superseded"; Capture.tsx:174-176 likewise renders lowercase sensitivity tokens. The mixed casing within sibling controls is real and reads as unfinished.

```tsx
<select id="disc-type" value={koType} ...>
  <option value="">Any type</option>
  {KO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
</select>
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 11. "DOI not found" is a dead end with no next action — `frontend/src/screens/DoiResolver.tsx:16-16`

**Category:** empty-state-no-action  **Detectors:** copy  **Platform:** web

When a DOI does not resolve, the screen shows "DOI not found" and the raw DOI in mono, with nothing to do next — no link to search/Discovery, no "open the seeded treatment", no way back. A user who followed a stale DOI link is stranded. Add a recovery affordance (search by taxon, return home).

**Verifier evidence:** DoiResolver.tsx:16 returns a stub with only a heading and the raw DOI — no link, button, or contextual recovery action. The global AppShell nav still wraps the route (App.tsx) so the user isn't fully stranded, but the error state itself offers no next step; a valid low-severity empty/error-state finding.

```tsx
return <div className="jose-stub"><h2>DOI not found</h2><p className="jose-mono">{doi}</p></div>;
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 12. First Edition route loads a single 336KB self-contained HTML asset — `frontend/src/screens/FirstEdition.tsx:8-16`

**Category:** low-bandwidth-asset  **Detectors:** craft  **Platform:** web

The FirstEdition route renders an iframe whose src is first-edition.html, a 336KB self-contained document bundling its own fonts, print-craft CSS, and a scroll-reveal animation (verified file size). On a slow connection that is a heavy payload for an editorial showcase. The inline width/height style avoids CLS (so lazy-loading is not the fix here — it is the full-route, above-the-fold content), but the asset itself should be slimmed: subset/compress the embedded fonts and engraving data, gzip/brotli the HTML, and consider a lightweight poster while the iframe streams. Flagging as the FE9 low-bandwidth asset to track.

**Verifier evidence:** Verified frontend/public/first-edition.html is 336.1 KB, loaded via the full-bleed iframe at FirstEdition.tsx:8-16. It is a heavy single asset for an editorial showcase; it loads only on the /first-edition route (not the main bundle), as the finding itself acknowledges, so the slim-the-asset recommendation is the correct framing. Low-severity, accurate.

```tsx
<iframe
  title="JOSE — First Edition"
  src={`${import.meta.env.BASE_URL}first-edition.html`}
  style={{ display: 'block', width: '100%', height: '100vh', border: 0 }}
/>
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 13. Reader fires six concurrent queries on mount; only one is needed for first paint — `frontend/src/screens/Reader.tsx:50-59`

**Category:** perceived-performance  **Detectors:** craft  **Platform:** web

On every treatment open the Reader launches readQ, historyQ, reviewsQ, provQ, mapQ and (conditionally) aiQ in parallel. Only readQ gates first contentful paint; history/reviews/provenance/map feed the side rail counts and overlays that are off by default. On a slow connection these five extra requests compete with the critical read and delay it. Defer the rail/overlay queries (load on rail interaction or after the read resolves) to prioritise the reading content on low bandwidth.

**Verifier evidence:** Reader.tsx:50-59 launches five always-enabled queries (read/history/reviews/provenance/map) plus a conditional aiQ on mount; only readQ gates first paint (line 118) while history/map/provenance feed below-fold rail counts and off-by-default overlays. Deferring them is a reasonable low-severity low-bandwidth improvement; the claim is accurate.

```tsx
const readQ = useQuery({ queryKey: qk.read(koId, lensKey), ... });
const historyQ = useQuery({ queryKey: qk.history(koId), ... });
const reviewsQ = useQuery({ queryKey: qk.reviews(koId), ... });
const provQ = useQuery({ queryKey: qk.provenance(koId), ... });
const mapQ = useQuery({ queryKey: qk.map(koId), ... });
const aiQ = useQuery({ queryKey: qk.aiDecl(koId), ... });
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 14. Reader conveys section structure with non-heading divs while using h3/h4/h5 for sizing — `frontend/src/screens/Reader.tsx:206-232`

**Category:** heading-hierarchy  **Detectors:** critique  **Platform:** web

The treatment title is an <h1> (206) but in-body section headings are <div className="jose-h"> (211, 220), so the document's real section structure is not exposed as headings at all. Meanwhile the evidence rail uses <h3> (240), the cite card <h4> (273) and the "In the news" block <h5> (232) — heading levels picked for visual weight rather than nesting under the h1. The result is a flat/incorrect heading outline for the app's most content-heavy screen. Promote the section dividers to real headings and order levels by structure.

**Verifier evidence:** Verified: the only h1 is the title (line 206); actual section headings and 'Reviewer annotations' are `<div className="jose-h">` (lines 211, 220), while the evidence rail uses h3 (line 240), the news block h5 (line 232, via .jose-news h5), and the snippet-anchor popover h4 (line 273). Document section structure is therefore not exposed as headings, and the h3/h4/h5 that exist are sized-not-nested — a real heading-semantics defect on the most content-heavy screen.

```tsx
          <h1 className="jose-title" dangerouslySetInnerHTML={{ __html: italiciseBinomial(v.content.title) }} />
          <div className="jose-sec">sec. <b>{authorLabel}</b> · {v.status} · a living treatment</div>

          {v.content.sections.map((section) => (
            <div key={section.path}>
              <div className="jose-h">{section.title ?? section.path}</div>
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

#### 15. Placeholder <a href="#"> links lead nowhere — `frontend/src/screens/Reader.tsx:232-235`

**Category:** semantic-html  **Detectors:** a11y  **Platform:** web

The 'In the news' items (lines 233-234) and the per-claim evidence rows (line 167) are <a href="#" onClick={preventDefault}> — focusable links that announce as links but navigate nowhere and do nothing on activation, which is confusing for keyboard/screen-reader users. If these are not yet wired, render them as non-interactive text or disabled controls; otherwise give them real destinations.

**Verifier evidence:** Reader.tsx lines 233-234 (news) and line 167 (evidence rows) are <a href="#" onClick={e=>e.preventDefault()}> — they take focus and are announced as links but navigate nowhere and perform no action, a genuine (low-severity) keyboard/SR confusion. They are not resolved by surrounding context.

```tsx
            <div className="jose-news"><h5>In the news</h5>
              <a href="#" onClick={(e) => e.preventDefault()}>Quartz-field succulents and the poaching crisis <span>· Daily Maverick</span></a>
              <a href="#" onClick={(e) => e.preventDefault()}>New treatments from the Knersvlakte <span>· SANBI blog</span></a>
```

**Suggested direction:** treat as a WCAG 2.1 AA gap; apply the standard remedy for this success criterion.

---

#### 16. Inert <a href="#"> placeholders used for non-navigating UI — `frontend/src/screens/Reader.tsx:232-235`

**Category:** markup-quality  **Detectors:** craft  **Platform:** web

The evidence-row and "In the news" links are <a href="#" onClick={e => e.preventDefault()}> placeholders that navigate nowhere (also at line 167). A focusable anchor that does nothing is misleading to keyboard/AT users and, if JS fails, href="#" scrolls the page to the top. Use a real href when a destination exists, or a <button> styled as a link when the element only triggers an in-page action.

**Verifier evidence:** Confirmed inert anchors at Reader.tsx:233-234 ("In the news") and line 167 (evidence-ref rows), all <a href="#" onClick={e => e.preventDefault()}>. They are focusable, navigate nowhere, and would scroll-to-top without JS; a real low-severity markup/a11y quality issue.

```tsx
<div className="jose-news"><h5>In the news</h5>
  <a href="#" onClick={(e) => e.preventDefault()}>Quartz-field succulents and the poaching crisis <span>· Daily Maverick</span></a>
  <a href="#" onClick={(e) => e.preventDefault()}>New treatments from the Knersvlakte <span>· SANBI blog</span></a>
</div>
```

**Suggested direction:** address with the standard remedy for this pattern in your framework.

---

#### 17. Empty reviews state offers a next step only to managers — `frontend/src/screens/ReviewPanel.tsx:129-131`

**Category:** empty-state-no-action  **Detectors:** copy  **Platform:** web

The "No reviews yet." empty state appends "Nominate a reviewer to begin." only when canManage is true; for everyone else (including a reviewer who, per the panel below, can open a thread directly) it is just "No reviews yet." with no guidance. Tailor the empty state per role so a reviewer is pointed at "Open a new thread" and a reader gets an appropriate note rather than a blank dead end.

**Verifier evidence:** ReviewPanel.tsx:130 only appends guidance when canManage; non-managers get "No reviews yet. " with a trailing space and no next step. A reviewer does get an "Open a new thread" card lower down (lines 144-150), but the empty state itself doesn't point there — accurate low-severity finding.

```tsx
{reviews.length === 0 ? (
  <div className="jose-revempty">No reviews yet. {canManage ? 'Nominate a reviewer to begin.' : ''}</div>
) : (
```

**Suggested direction:** rewrite with the standard pattern for this surface (verb-first CTA; concrete error; first-time vs. now-empty distinction in empty states).

---

#### 18. Raised surfaces hardcode #fff (and #fbfcfa) instead of a --surface token, blocking any future dark/high-contrast theme — `frontend/src/styles/jose.css:40-52`

**Category:** theme-breaking  **Detectors:** system  **Platform:** web

Cards, popovers, inputs, chips and buttons are filled with literal '#fff' throughout jose.css (e.g. 40, 52, 155, 161, 172, 174, 180) and every screen CSS file, while the base uses the --paper token (#f6f8f5). '#fff' is effectively an undocumented 'raised surface' token; the off-white '#fbfcfa' (map.css 15, DistributionMap.tsx 177) is a second near-white surface. Because all surfaces are hardcoded white, the theme cannot be inverted (no dark mode) and the two near-whites are inconsistent. Define a --surface token. Severity is low only because the app currently ships a single light theme.

**Verifier evidence:** Verified tokens.css defines --paper/--haze but no --surface, and jose.css fills raised surfaces with literal #fff (lines 40,52,155,161,172,174,180, etc.), with a second near-white #fbfcfa at map.css:15 and DistributionMap.tsx:177. The facts are accurate and the two-near-white inconsistency is real; impact is forward-looking (theming/dark-mode) rather than a current user-visible defect, consistent with the low severity.

```css
.jose-chip { ... background: #fff; ... }
.jose-pop { ... background: #fff; ... }
.jose-card { ... background: #fff; ... }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 19. Herbarium figure-placeholder gradient is duplicated verbatim across two files — `frontend/src/styles/jose.css:122-122`

**Category:** duplicated-value  **Detectors:** system  **Platform:** web

The repeating-linear-gradient that fills the figure placeholder ('#eef1ec'/'#e7ebe5' at 9px stops) is copied verbatim into jose.css line 122 (.jose-figbox) and builder.css line 115 (.bld-figbox). The texture colors are bespoke and have no token; the literal duplication means the two figure boxes can silently diverge. Extract a shared class or token for the placeholder texture.

**Verifier evidence:** Verified the identical gradient `repeating-linear-gradient(135deg, #eef1ec, #eef1ec 9px, #e7ebe5 9px, #e7ebe5 18px)` appears verbatim in jose.css:122 (.jose-figbox) and builder.css:115 (.bld-figbox), with bespoke colors absent from tokens.css. A genuine DRY/maintainability duplication that can silently diverge.

```css
.jose-figbox { ... background: repeating-linear-gradient(135deg, #eef1ec, #eef1ec 9px, #e7ebe5 9px, #e7ebe5 18px); ... }
```

**Suggested direction:** either replace with a design-system token or document why this case is intentionally bespoke.

---

#### 20. Page headings skip from h1 to h3 across content screens — `frontend/src/styles/jose.css:169-173`

**Category:** heading-hierarchy  **Detectors:** critique  **Platform:** web

The shared scaffolding pairs a page <h1> (.jose-page h1) directly with card section headers styled as <h3> (.jose-card h3), with no h2 in between. Discovery, ReviewPanel, Profile and Capture all render <h1> then several <h3> card titles, so heading levels are chosen for visual size (small uppercase label) rather than document structure, and level 2 is skipped. This degrades the screen-reader outline and document semantics. Use sequential levels (h1 > h2 for card sections) and style by class, not by tag level.

**Verifier evidence:** Verified the markup matches the claim: Discovery renders h1 'Explore' then h3 'Anchor'/'Filters' (Discovery.tsx:72,77,106); Capture h1→h3 (Capture.tsx:82,89); ReviewPanel h1→h3 (ReviewPanel.tsx:119,146,157); Profile h1 then .jose-card h3. No `.jose-page h2`/`.jose-card h2` style exists, so level 2 is consistently skipped — a genuine (low-severity) WCAG 1.3.1 heading-outline degradation.

```css
.jose-page h1 { font-family: var(--body); font-weight: 600; font-size: 26px; margin: 0 0 4px; }
.jose-page .lede { color: var(--sub); font-size: 13px; margin-bottom: 22px; }
.jose-card { border: 1px solid var(--rule); border-radius: 10px; background: #fff; padding: 16px; margin-bottom: 14px; }
.jose-card h3 { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--structure); margin: 0 0 10px; }
```

**Suggested direction:** address the layout / hierarchy / consistency issue per the standard convention for the surface (typically: primary action prominent and conventionally placed; reduce competing CTAs; align with sibling screens).

---

## Uncertain findings

These findings need a human eye — the verifier couldn't confirm them without information outside the source code (visual rendering, theme values, runtime behavior).

#### 1. Editor text fields replace the focus outline with a near-invisible ring — `frontend/src/components/builder/builder.css:109-109`

**Category:** focus-visibility  **Detectors:** a11y  **Platform:** web

The Builder paragraph/abstract/figure-caption editors set outline:none on :focus and substitute box-shadow 0 0 0 1px var(--rule). The --rule color (#D9DED6) on the white focused background is ~1.37:1 — effectively invisible, so there is no perceptible focus indicator on the primary writing surface (builder.css lines 25 and 109; this is :focus, so it also suppresses the global type-red :focus-visible ring when builder.css wins source order). Use a visible ring (e.g. var(--type-red) or var(--ink), as the search/DOI inputs already do) for >=3:1 contrast (WCAG 2.4.7 / 1.4.11).

**Why uncertain:** The substituted box-shadow is indeed #D9DED6 on white = 1.37:1 (near-invisible), and builder.css 25/109 set outline:none. But tokens.css line 31 defines a global `.jose :focus-visible { outline: 2px solid var(--type-red) }` (type-red ~6:1) at equal specificity; because main.tsx imports App (line 8) before tokens.css/jose.css (lines 9-10), the global rule likely cascades later and overrides outline:none for keyboard/mouse focus on text fields, in which case a visible red ring renders. Whether the failure actually surfaces depends on the emitted CSS order and :focus-visible runtime behavior, which I cannot confirm from source alone.

---

## Appendix

### Findings per detector

| Detector | Candidates | Confirmed | False positive | Uncertain |
|---|---:|---:|---:|---:|
| a11y | 13 | 12 | 0 | 1 |
| critique | 13 | 12 | 1 | 0 |
| system | 12 | 11 | 1 | 0 |
| copy | 17 | 15 | 2 | 0 |
| craft | 11 | 11 | 0 | 0 |

### Workspace

Full artifacts (raw findings per detector, verifier output, merged ranking) are in:

```
.epicdesignreview\20260627T084030Z/
```

Delete this directory if you don't want the audit trail. Add `.epicdesignreview/` to `.gitignore` to avoid committing it.
