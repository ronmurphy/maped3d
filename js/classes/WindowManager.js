/**
 * WindowManager.js
 * Handles dialog management, z-indexing, and draggable functionality
 */
class WindowManager {
  constructor() {
    this.windows = [];
    this.baseZIndex = 10000;
    this.activeWindow = null;
    
    // Bind methods
    this.makeDialogDraggable = this.makeDialogDraggable.bind(this);
    this.bringToFront = this.bringToFront.bind(this);
  }

  

  registerWindow(element, options = {}) {
    // Default options
    const defaultOptions = {
      draggable: true,
      dragHandle: '.party-header, .details-header, .recruitment-header', // CSS selector for drag handle
      initialPosition: { x: null, y: null },
      onRegister: null, // Callback after registration
      onFocus: null     // Callback when window gets focus
    };
    
    const windowOptions = {...defaultOptions, ...options};
    
    // Assign a unique ID if not present
    if (!element.id) {
      element.id = `window-${Date.now()}-${this.windows.length}`;
    }
    
    // Create window object
    const windowObj = {
      id: element.id,
      element: element,
      options: windowOptions,
      zIndex: this.baseZIndex + this.windows.length + 1
    };
    
    // Add to windows array
    this.windows.push(windowObj);
    
    // Set initial z-index
    element.style.zIndex = windowObj.zIndex;
    
    // Make draggable if specified
    if (windowOptions.draggable) {
      this.makeDialogDraggable(element, windowOptions.dragHandle);
    }
    
    // Set initial position if specified
    if (windowOptions.initialPosition.x !== null && windowOptions.initialPosition.y !== null) {
      element.style.position = 'absolute';
      element.style.left = `${windowOptions.initialPosition.x}px`;
      element.style.top = `${windowOptions.initialPosition.y}px`;
      element.style.margin = '0';
    }
    
    // Add click handler to bring window to front
    element.addEventListener('mousedown', () => {
      this.bringToFront(windowObj.id);
    });
    
    // Call onRegister callback if provided
    if (typeof windowOptions.onRegister === 'function') {
      windowOptions.onRegister(windowObj);
    }
    
    // Set as active window
    this.activeWindow = windowObj;
    
    return windowObj;
  }

  unregisterWindow(id) {
    const index = this.windows.findIndex(win => win.id === id);
    if (index > -1) {
      this.windows.splice(index, 1);
      
      // Reassign z-indices to remaining windows
      this.windows.forEach((win, idx) => {
        win.zIndex = this.baseZIndex + idx + 1;
        win.element.style.zIndex = win.zIndex;
      });
      
      // Set new active window if needed
      if (this.windows.length > 0) {
        this.activeWindow = this.windows[this.windows.length - 1];
      } else {
        this.activeWindow = null;
      }
    }
  }

  bringToFront(id) {
    const windowObj = this.windows.find(win => win.id === id);
    if (!windowObj) return;
    
    // If already at front, do nothing
    if (this.activeWindow && this.activeWindow.id === id) return;
    
    // Reorder windows array to move this window to the end
    const index = this.windows.findIndex(win => win.id === id);
    if (index > -1) {
      this.windows.splice(index, 1);
      this.windows.push(windowObj);
      
      // Reassign z-indices
      this.windows.forEach((win, idx) => {
        win.zIndex = this.baseZIndex + idx + 1;
        win.element.style.zIndex = win.zIndex;
      });
      
      // Update active window
      this.activeWindow = windowObj;
      
      // Call onFocus callback if provided
      if (typeof windowObj.options.onFocus === 'function') {
        windowObj.options.onFocus(windowObj);
      }
    }
  }

  makeDialogDraggable(element, handleSelector) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;


  // Special handling for Shoelace dialogs
  if (element.tagName.toLowerCase() === 'sl-dialog') {
    // Wait for the dialog to be fully rendered
    setTimeout(() => {
      // Try to find the header in the shadow DOM
      const dialogHeader = element.shadowRoot?.querySelector('[part="header"]');
      if (dialogHeader) {
        dialogHeader.style.cursor = 'move';
        dialogHeader.addEventListener('mousedown', startDrag);
        dialogHeader.addEventListener('touchstart', e => {
          const touch = e.touches[0];
          startDrag({
            preventDefault: () => e.preventDefault(),
            clientX: touch.clientX,
            clientY: touch.clientY
          });
        });
        console.log('Successfully made Shoelace dialog header draggable');
      } else {
        console.warn('Could not find header in Shoelace dialog shadow DOM');
      }
    }, 100);
  }

    
    // Find handle elements
    const handles = element.querySelectorAll(handleSelector);
    
    if (handles.length === 0) {
      console.warn(`No drag handles found with selector "${handleSelector}" for element:`, element);
      return;
    }
    
    // Ensure the element can be positioned
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
      element.style.position = 'relative';
    }
    
    // Add visual indicator for draggable areas
    handles.forEach(handle => {
      handle.style.cursor = 'move';
      
      // Optional: Add a visual hint that this is draggable
      handle.title = "Drag to move window";
      
      // Mouse events for desktop
      handle.addEventListener('mousedown', startDrag);
      
      // Touch events for mobile
      handle.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        startDrag({
          preventDefault: () => e.preventDefault(),
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      });
    });
    
    function startDrag(e) {
      // Prevent default browser behavior
      e.preventDefault();
      
      // Bring window to front
      const windowId = element.id;
      window.windowManager.bringToFront(windowId);
      
      // Initialize drag
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(element.style.left) || element.offsetLeft;
      initialTop = parseInt(element.style.top) || element.offsetTop;
      
      // Set absolute positioning if not already
      if (element.style.position !== 'absolute') {
        // Get current position in page
        const rect = element.getBoundingClientRect();
        element.style.position = 'absolute';
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.margin = '0';
        
        // Update initial values after position change
        initialLeft = rect.left;
        initialTop = rect.top;
      }
      
      // Add move and end events
      document.addEventListener('mousemove', doDrag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        doDrag({
          preventDefault: () => e.preventDefault(),
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      });
      document.addEventListener('touchend', stopDrag);
    }
    
    function doDrag(e) {
      if (!isDragging) return;
      e.preventDefault();
      
      // Calculate new position
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Apply new position
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    }
    
    function stopDrag(e) {
      isDragging = false;
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchmove', doDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  closeAll() {
    // Close all windows (useful for cleanup)
    const windowsCopy = [...this.windows];
    windowsCopy.forEach(win => {
      // Check if the element has a close method (sl-dialog has a hide method)
      if (win.element.hide && typeof win.element.hide === 'function') {
        win.element.hide();
      } else {
        // Fallback to removing the element
        if (win.element.parentNode) {
          win.element.parentNode.removeChild(win.element);
        }
      }
      this.unregisterWindow(win.id);
    });
  }
  
  // Get current active window
  getActiveWindow() {
    return this.activeWindow;
  }
  
  // Get all open windows
  getAllWindows() {
    return [...this.windows];
  }
}

// Create a global instance
window.windowManager = new WindowManager();