/**
 * COLLAPSIBLE SECTIONS - Reduce Cognitive Load (2026 UX)
 * Secondary content is hidden by default, expandable on demand
 */

export function initCollapsible(container) {
  const toggles = container.querySelectorAll('[data-toggle="collapsible"]');
  
  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const target = toggle.getAttribute('data-target');
      const content = container.querySelector(target);
      
      if (!content) return;
      
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      const icon = toggle.querySelector('.toggle-icon');
      
      toggle.setAttribute('aria-expanded', !isOpen);
      content.setAttribute('aria-hidden', isOpen);
      
      if (isOpen) {
        // Close
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
        content.style.overflow = 'hidden';
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else {
        // Open - calculate actual height
        const originalHeight = content.style.maxHeight;
        content.style.maxHeight = 'none';
        const height = content.scrollHeight;
        content.style.maxHeight = height + 'px';
        content.style.opacity = '1';
        content.style.overflow = 'visible';
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    });
  });
}

/**
 * Helper to render collapsible HTML
 * @param {string} id - Unique ID for this section
 * @param {string} title - Button title/label
 * @param {string} content - HTML content inside collapsible
 * @param {boolean} open - Start open? Default false
 */
export function renderCollapsibleSection(id, title, content, open = false) {
  return `
    <div class="collapsible-group">
      <button 
        type="button"
        data-toggle="collapsible" 
        data-target="#${id}-content"
        aria-expanded="${open ? 'true' : 'false'}"
        style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 1rem; background: var(--surface-strong); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 1rem; font-weight: 500; cursor: pointer; transition: all 150ms ease; min-height: 48px;"
      >
        <span>${title}</span>
        <span class="toggle-icon" style="display: inline-block; transition: transform 300ms ease; margin-left: auto; font-size: 0.8rem; transform: ${open ? 'rotate(180deg)' : 'rotate(0deg)'};">▼</span>
      </button>
      <div 
        id="${id}-content"
        class="collapsible-content" 
        aria-hidden="${open ? 'false' : 'true'}"
        style="background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; padding: 1rem; max-height: ${open ? 'none' : '0'}px; opacity: ${open ? '1' : '0'}; overflow: ${open ? 'visible' : 'hidden'}; transition: max-height 300ms ease, opacity 300ms ease;"
      >
        ${content}
      </div>
    </div>
  `;
}
