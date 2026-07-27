// components/tile.js
//
// Every home-screen section is a "tile": a tappable card in the vertical
// stack. Keeping the wrapper markup in one place means a new tile added in
// a later stage (e.g. "Rangefinder", "Course map") automatically matches
// the existing ones instead of needing its own bespoke card styling.

export function tile({ href, extraClass = '', innerHtml, ariaLabel }) {
  const isLink = Boolean(href);
  const tag = isLink ? 'a' : 'div';
  const attrs = [
    isLink ? `href="${href}"` : '',
    ariaLabel ? `aria-label="${ariaLabel}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<${tag} class="tile ${extraClass}" ${attrs}>${innerHtml}</${tag}>`;
}
