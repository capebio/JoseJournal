/**
 * The "First Edition" — JOSE's founding-edition cover and front-matter: a static
 * editorial showcase (masthead, scattered botanical engravings, a field-notebook
 * leaf, the founding statement). It ships as a self-contained HTML asset with its
 * own fonts, print-craft CSS and scroll-reveal animation, so it is rendered in a
 * full-bleed iframe to keep its global styles isolated from the app shell.
 */
export function FirstEdition() {
  return (
    <iframe
      title="JOSE — First Edition"
      src={`${import.meta.env.BASE_URL}first-edition.html`}
      style={{ display: 'block', width: '100%', height: '100vh', border: 0 }}
    />
  );
}
