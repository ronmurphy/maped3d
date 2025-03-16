/**
 * drawer-management.js
 * Handles drawer interactions with the new UI layout:
 * - Hides sidebar when a drawer is shown
 * - Ensures proper z-index ordering
 * - Adjusts drawer width to stop at vertical toolbar
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only run if we're using the new UI
  if (!document.body.classList.contains('new-ui')) return;
  
  // Get relevant elements
  const sidebar = document.querySelector('.sidebar');
  const appHeader = document.querySelector('.app-header');
  const verticalToolbar = document.querySelector('.vertical-toolbar');
  
  // Constants
  const TOOLBAR_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toolbar-width')) || 48;
  
  // Find all drawers in the document (existing and dynamically added)
  function setupDrawers() {
    // Target all drawers (existing and future ones)
    document.querySelectorAll('sl-drawer').forEach(setupDrawer);
    
    // Set up a MutationObserver to watch for new drawers
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === 'SL-DRAWER') {
              setupDrawer(node);
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Setup individual drawer
  function setupDrawer(drawer) {
    // Skip if already set up
    if (drawer.hasAttribute('data-ui-managed')) return;
    drawer.setAttribute('data-ui-managed', 'true');
    
    // Step 1: Ensure the drawer has the right z-index
    // This makes sure it appears above the app header
    drawer.style.zIndex = '1100'; // Higher than header's z-index (10)
    
    // Step 2: Adjust the drawer's width
    // Default value is often '100%', we'll adjust to account for toolbar
    drawer.addEventListener('sl-show', () => {
      // Calculate the correct width
      const viewportWidth = window.innerWidth;
      const newWidth = `${viewportWidth - TOOLBAR_WIDTH}px`;
      
      // Set the drawer's proper width
      drawer.style.setProperty('--size', newWidth);
      
      // Move the drawer to the right of the toolbar
      drawer.style.left = `${TOOLBAR_WIDTH}px`;
      
      // Hide the sidebar
      if (sidebar) {
        sidebar.style.visibility = 'hidden';
      }
      
      // Ensure header remains visible above drawer
      if (appHeader) {
        appHeader.style.zIndex = '1200'; // Even higher than drawer
      }
    });
    
    // Restore sidebar visibility when drawer is hidden
    drawer.addEventListener('sl-after-hide', () => {
      if (sidebar) {
        sidebar.style.visibility = 'visible';
      }
    });
    
    // Fix for any drawers that are already open
    if (drawer.open) {
      // Calculate the correct width
      const viewportWidth = window.innerWidth;
      const newWidth = `${viewportWidth - TOOLBAR_WIDTH}px`;
      
      // Set the drawer's proper width
      drawer.style.setProperty('--size', newWidth);
      
      // Move the drawer to the right of the toolbar
      drawer.style.left = `${TOOLBAR_WIDTH}px`;
      
      // Hide the sidebar
      if (sidebar) {
        sidebar.style.visibility = 'hidden';
      }
      
      // Ensure header remains visible above drawer
      if (appHeader) {
        appHeader.style.zIndex = '1200';
      }
    }
  }
  
  // Handle window resize
  function handleResize() {
    // Update sizes for any open drawers
    document.querySelectorAll('sl-drawer[open]').forEach(drawer => {
      const viewportWidth = window.innerWidth;
      const newWidth = `${viewportWidth - TOOLBAR_WIDTH}px`;
      drawer.style.setProperty('--size', newWidth);
    });
  }
  
  // Listen for window resize
  window.addEventListener('resize', handleResize);
  
  // Initialize
  setupDrawers();
  
  // Also listen for custom drawer creation events if you're creating drawers programmatically
  document.addEventListener('drawer-created', (e) => {
    if (e.detail && e.detail.drawer) {
      setupDrawer(e.detail.drawer);
    }
  });
  
  // A helper function to ensure a drawer gets properly configured
  window.configureNewDrawer = (drawer) => {
    setupDrawer(drawer);
  };
  
  // Update all drawers if the toolbar width changes
  // This is a more advanced feature - only needed if toolbar width is dynamic
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      if (entry.target === verticalToolbar) {
        handleResize();
        break;
      }
    }
  });
  
  if (verticalToolbar) {
    resizeObserver.observe(verticalToolbar);
  }
});