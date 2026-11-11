import { GLOSSARY_MAP } from '../data/glossary';

/**
 * Escapes HTML special characters for safe innerHTML interpolation.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders beginner-friendly copy with [[term-id|label]] tokens converted into
 * accessible interactive jargon tooltip buttons.
 */
export function renderJargonMarkup(
  text: string,
  onOpenGlossary?: (termId: string) => void,
): HTMLElement {
  const wrapper = document.createElement('span');
  const pattern = /\[\[([a-z0-9-]+)\|([^\]]+)\]\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      wrapper.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const termId = match[1];
    const label = match[2];
    const entry = GLOSSARY_MAP[termId];

    if (!entry) {
      wrapper.appendChild(document.createTextNode(label));
    } else {
      const holder = document.createElement('span');
      holder.className = 'jargon-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jargon-term';
      btn.textContent = label;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', `${label}: ${entry.shortDef}`);

      const pop = document.createElement('span');
      pop.className = 'jargon-popover';
      pop.setAttribute('role', 'tooltip');
      pop.hidden = true;
      pop.innerHTML = `
        <strong>${escapeHtml(entry.term)}</strong>
        <span>${escapeHtml(entry.shortDef)}</span>
        ${
          onOpenGlossary
            ? `<button type="button" class="jargon-glossary-link">Open in Glossary →</button>`
            : ''
        }
      `;

      const closePop = () => {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextOpen = pop.hidden;
        // Close any other open popovers first
        document.querySelectorAll<HTMLElement>('.jargon-popover:not([hidden])').forEach((other) => {
          if (other !== pop) {
            other.hidden = true;
            other.previousElementSibling?.setAttribute('aria-expanded', 'false');
          }
        });
        pop.hidden = !nextOpen;
        btn.setAttribute('aria-expanded', String(nextOpen));
      });

      const glossaryBtn = pop.querySelector<HTMLButtonElement>('.jargon-glossary-link');
      if (glossaryBtn && onOpenGlossary) {
        glossaryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closePop();
          onOpenGlossary(termId);
        });
      }

      holder.appendChild(btn);
      holder.appendChild(pop);
      wrapper.appendChild(holder);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    wrapper.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return wrapper;
}

