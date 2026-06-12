/**
 * SWIPE GESTURE SUPPORT - Mobile Navigation
 * Swipe left/right to navigate between tabs
 * Improves mobile UX without requiring button clicks
 */

export function initSwipeNavigation(container, navButtons, onViewChange) {
  let touchStartX = 0;
  let touchEndX = 0;
  const SWIPE_THRESHOLD = 50; // pixels
  
  container.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);
  
  container.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);
  
  function handleSwipe() {
    const diff = touchStartX - touchEndX;
    
    // Swipe left (next tab)
    if (diff > SWIPE_THRESHOLD) {
      navigateToNextTab();
    }
    // Swipe right (previous tab)
    else if (diff < -SWIPE_THRESHOLD) {
      navigateToPreviousTab();
    }
  }
  
  function getCurrentTabIndex() {
    for (let i = 0; i < navButtons.length; i++) {
      if (navButtons[i].classList.contains('active')) {
        return i;
      }
    }
    return 0;
  }
  
  function navigateToNextTab() {
    const currentIndex = getCurrentTabIndex();
    const nextIndex = (currentIndex + 1) % navButtons.length;
    const nextView = navButtons[nextIndex].getAttribute('data-view');
    if (nextView) onViewChange(nextView);
  }
  
  function navigateToPreviousTab() {
    const currentIndex = getCurrentTabIndex();
    const prevIndex = (currentIndex - 1 + navButtons.length) % navButtons.length;
    const prevView = navButtons[prevIndex].getAttribute('data-view');
    if (prevView) onViewChange(prevView);
  }
}

/**
 * Add visual feedback during swipe
 */
export function addSwipeHint(element) {
  element.addEventListener('touchstart', function() {
    this.style.opacity = '0.95';
    this.style.transition = 'opacity 100ms ease';
  });
  
  element.addEventListener('touchend', function() {
    this.style.opacity = '1';
  });
}
