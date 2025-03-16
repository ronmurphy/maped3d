/**
 * sidebar-tabs.js
 * Handles the tab switching functionality in the sidebar
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only run if we're using the new UI
  if (!document.body.classList.contains('new-ui')) return;
  
  // Get tab elements
  const layersTab = document.getElementById('layersTab');
  const markersTab = document.getElementById('markersTab');
  
  // Get content elements
  const layersList = document.getElementById('layersList');
  const markersPanel = document.getElementById('markersPanel');
  
  // Only proceed if all elements exist
  if (!layersTab || !markersTab || !layersList || !markersPanel) return;
  
  // Function to switch to layers tab
  function showLayersTab() {
    // Update tab appearance
    layersTab.classList.add('active');
    markersTab.classList.remove('active');
    
    // Show/hide content
    layersList.parentElement.style.display = 'block';
    markersPanel.style.display = 'none';
    
    // If the LayersPanel class has a showLayersPanel method, call it
    if (window.mapEditor && window.mapEditor.layersPanel && 
        typeof window.mapEditor.layersPanel.showLayersPanel === 'function') {
      window.mapEditor.layersPanel.showLayersPanel();
    }
  }
  
  // Function to switch to markers tab
  function showMarkersTab() {
    // Update tab appearance
    markersTab.classList.add('active');
    layersTab.classList.remove('active');
    
    // Show/hide content
    layersList.parentElement.style.display = 'none';
    markersPanel.style.display = 'block';
    
    // If the LayersPanel class has a showMarkersPanel method, call it
    if (window.mapEditor && window.mapEditor.layersPanel && 
        typeof window.mapEditor.layersPanel.showMarkersPanel === 'function') {
      window.mapEditor.layersPanel.showMarkersPanel();
    }
  }
  
  // Add click handlers
  layersTab.addEventListener('click', showLayersTab);
  markersTab.addEventListener('click', showMarkersTab);
  
  // Update object count in footer
  function updateObjectCount() {
    const objectsStatus = document.getElementById('objectsStatus');
    if (!objectsStatus || !window.mapEditor) return;
    
    const roomCount = window.mapEditor.rooms ? window.mapEditor.rooms.length : 0;
    const markerCount = window.mapEditor.markers ? window.mapEditor.markers.length : 0;
    const totalCount = roomCount + markerCount;
    
    const countSpan = objectsStatus.querySelector('span:last-child');
    if (countSpan) {
      countSpan.textContent = `Objects: ${totalCount}`;
    }
  }
  
  // Update zoom level in footer
  function updateZoomStatus() {
    const zoomStatus = document.getElementById('zoomStatus');
    if (!zoomStatus || !window.mapEditor) return;
    
    const zoom = window.mapEditor.scale ? Math.round(window.mapEditor.scale * 100) : 100;
    
    const zoomSpan = zoomStatus.querySelector('span:last-child');
    if (zoomSpan) {
      zoomSpan.textContent = `Zoom: ${zoom}%`;
    }
  }
  
  // Update grid size in footer
  function updateGridStatus() {
    const gridStatus = document.getElementById('gridSizeStatus');
    if (!gridStatus || !window.mapEditor) return;
    
    const cellSize = window.mapEditor.cellSize || '--';
    
    const gridSpan = gridStatus.querySelector('span:last-child');
    if (gridSpan) {
      gridSpan.textContent = `Grid: ${cellSize}px`;
    }
  }
  
  // Set up mutation observer to track changes
  if (window.mapEditor) {
    // Initial updates
    updateObjectCount();
    updateZoomStatus();
    updateGridStatus();
    
    // Set up interval to update periodically
    setInterval(() => {
      updateObjectCount();
      updateZoomStatus();
      updateGridStatus();
    }, 1000);
  }
  
  // Set up last saved time in footer
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  const saveStatus = document.getElementById('saveStatus');
  
  if (saveProjectBtn && saveStatus) {
    saveProjectBtn.addEventListener('click', () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      const span = saveStatus.querySelector('span');
      if (span) {
        span.textContent = `Last saved: ${timeString}`;
      }
    });
  }
});