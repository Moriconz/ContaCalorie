/**
 * LAZY LOADING - Improve Performance
 * Load lists progressively instead of all at once
 */

const ITEMS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 200; // pixels from bottom

export function initLazyLoad(container, items, renderFn, options = {}) {
  const {
    itemsPerPage = ITEMS_PER_PAGE,
    threshold = SCROLL_THRESHOLD
  } = options;
  
  let currentIndex = 0;
  let isLoading = false;
  
  // Render initial batch
  function loadMore() {
    if (isLoading) return;
    
    isLoading = true;
    const nextIndex = Math.min(currentIndex + itemsPerPage, items.length);
    const batch = items.slice(currentIndex, nextIndex);
    
    // Render batch
    batch.forEach((item, idx) => {
      const element = renderFn(item);
      container.appendChild(element);
    });
    
    currentIndex = nextIndex;
    isLoading = false;
    
    return currentIndex < items.length;
  }
  
  // Load initial batch
  loadMore();
  
  // Setup infinite scroll
  const parentScroll = container.parentElement;
  
  if (parentScroll) {
    parentScroll.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = parentScroll;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      
      if (distanceFromBottom < threshold && currentIndex < items.length) {
        loadMore();
      }
    });
  }
}

/**
 * Intersection Observer API for lazy loading (modern approach)
 * Use this for images and expensive components
 */
export function lazyLoadImages(selector = 'img[loading="lazy"]') {
  if (!('IntersectionObserver' in window)) {
    // Fallback for older browsers
    document.querySelectorAll(selector).forEach(img => {
      img.src = img.dataset.src;
    });
    return;
  }
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('loading');
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px'
  });
  
  document.querySelectorAll(selector).forEach(img => {
    imageObserver.observe(img);
  });
}

/**
 * Virtual scrolling for very large lists
 * Only renders visible items + buffer
 */
export function createVirtualScroller(container, items, renderFn, itemHeight = 60) {
  const scrollParent = container.parentElement;
  const buffer = Math.ceil((scrollParent.clientHeight / itemHeight) * 0.5);
  let visibleStart = 0;
  let visibleEnd = buffer;
  
  function getVisibleRange() {
    const scrollTop = scrollParent.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const end = Math.min(items.length, Math.ceil((scrollTop + scrollParent.clientHeight) / itemHeight) + buffer);
    return { start, end };
  }
  
  function render() {
    const { start, end } = getVisibleRange();
    
    if (start !== visibleStart || end !== visibleEnd) {
      container.innerHTML = '';
      
      // Add spacer for scrolled items
      if (start > 0) {
        const spacer = document.createElement('div');
        spacer.style.height = (start * itemHeight) + 'px';
        container.appendChild(spacer);
      }
      
      // Render visible items
      for (let i = start; i < end; i++) {
        const element = renderFn(items[i], i);
        container.appendChild(element);
      }
      
      // Add spacer for remaining items
      if (end < items.length) {
        const spacer = document.createElement('div');
        spacer.style.height = ((items.length - end) * itemHeight) + 'px';
        container.appendChild(spacer);
      }
      
      visibleStart = start;
      visibleEnd = end;
    }
  }
  
  // Initial render
  render();
  
  // Listen to scroll
  scrollParent.addEventListener('scroll', render);
}
