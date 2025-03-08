/**
 * Storyboard.js - Node-based story and event management system for the game
 * Handles creation, editing, and execution of narrative flows and game events
 */

class Storyboard {
    constructor(scene3D, resourceManager) {
      // Core dependencies
      this.scene3D = scene3D;
      this.resourceManager = resourceManager;
      
      // Story data
      this.storyGraphs = new Map(); // Map of story IDs to story graph objects
      this.activeStories = new Map(); // Currently active story executions
      this.triggeredStories = new Set(); // IDs of stories that have been triggered
      
      // UI references
      this.editor = null; // Reference to editor when open
      this.currentOverlay = null; // Current story overlay (dialogs etc)
      
      // Initialize styles
      this.initStyles();
      
      // Register world trigger check with scene3D if available
      if (this.scene3D && typeof this.scene3D.registerUpdateCallback === 'function') {
        this.scene3D.registerUpdateCallback(this.checkTriggers.bind(this));
      }
      
      console.log('Storyboard system initialized');
    }
  
    /**
     * Initialize CSS styles for story displays
     */
    // initStyles() {
    //   const styles = document.createElement('style');
    //   styles.textContent = `
    //     .story-overlay {
    //       position: fixed;
    //       top: 0;
    //       left: 0;
    //       right: 0;
    //       bottom: 0;
    //       background: rgba(0, 0, 0, 0.7);
    //       display: flex;
    //       justify-content: center;
    //       align-items: center;
    //       z-index: 2000;
    //       opacity: 0;
    //       transition: opacity 0.3s ease;
    //     }
        
    //     .story-content {
    //       background: #fff;
    //       max-width: 800px;
    //       width: 80vw;
    //       max-height: 80vh;
    //       border-radius: 8px;
    //       overflow: hidden;
    //       display: flex;
    //       flex-direction: column;
    //       box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    //       transform: scale(0.95);
    //       transition: transform 0.3s ease;
    //     }
        
    //     .story-header {
    //       padding: 16px;
    //       background: linear-gradient(135deg, #673ab7, #9c27b0);
    //       color: white;
    //       font-weight: bold;
    //       font-size: 1.2rem;
    //       display: flex;
    //       justify-content: space-between;
    //       align-items: center;
    //     }
        
    //     .story-body {
    //       padding: 24px;
    //       overflow-y: auto;
    //       flex: 1;
    //       display: flex;
    //       flex-direction: column;
    //       gap: 20px;
    //     }
        
    //     .story-image {
    //       width: 100%;
    //       border-radius: 4px;
    //       overflow: hidden;
    //     }
        
    //     .story-image img {
    //       width: 100%;
    //       height: auto;
    //       display: block;
    //     }
        
    //     .story-text {
    //       font-size: 1.1rem;
    //       line-height: 1.6;
    //       color: #333;
    //     }
        
    //     .story-choices {
    //       display: flex;
    //       flex-direction: column;
    //       gap: 8px;
    //       margin-top: 16px;
    //     }
        
    //     .story-choice {
    //       padding: 12px 16px;
    //       background: #f0f0f0;
    //       border-radius: 4px;
    //       cursor: pointer;
    //       transition: background 0.2s;
    //     }
        
    //     .story-choice:hover {
    //       background: #e0e0e0;
    //     }
        
    //     .story-footer {
    //       padding: 16px;
    //       background: #f5f5f5;
    //       border-top: 1px solid #ddd;
    //       display: flex;
    //       justify-content: flex-end;
    //     }
        
    //     /* Dark mode support */
    //     @media (prefers-color-scheme: dark) {
    //       .story-content {
    //         background: #2a2a2a;
    //       }
          
    //       .story-text {
    //         color: #e0e0e0;
    //       }
          
    //       .story-choice {
    //         background: #3a3a3a;
    //         color: #e0e0e0;
    //       }
          
    //       .story-choice:hover {
    //         background: #4a4a4a;
    //       }
          
    //       .story-footer {
    //         background: #333;
    //         border-top: 1px solid #444;
    //       }
    //     }
        
    //     /* Node Editor Styles */
    //     .storyboard-editor {
    //       display: flex;
    //       height: 100%;
    //       overflow: hidden;
    //     }
        
    //     .storyboard-canvas {
    //       flex: 1;
    //       background: #f0f0f0;
    //       background-image: 
    //         linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
    //         linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px);
    //       background-size: 20px 20px;
    //       position: relative;
    //       overflow: auto;
    //     }
        
    //     .storyboard-sidebar {
    //       width: 300px;
    //       background: #fff;
    //       border-left: 1px solid #ddd;
    //       display: flex;
    //       flex-direction: column;
    //       overflow: hidden;
    //     }
        
    //     .storyboard-node {
    //       position: absolute;
    //       background: white;
    //       border-radius: 6px;
    //       box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    //       min-width: 200px;
    //       display: flex;
    //       flex-direction: column;
    //       user-select: none;
    //       cursor: move;
    //       z-index: 1;
    //     }
        
    //     .storyboard-node-header {
    //       padding: 8px 12px;
    //       background: #673ab7;
    //       color: white;
    //       font-weight: bold;
    //       border-radius: 6px 6px 0 0;
    //       display: flex;
    //       justify-content: space-between;
    //       align-items: center;
    //     }
        
    //     .storyboard-node-body {
    //       padding: 12px;
    //     }
        
    //     .storyboard-node-footer {
    //       padding: 8px 12px;
    //       display: flex;
    //       justify-content: space-between;
    //       border-top: 1px solid #eee;
    //     }
        
    //     .storyboard-connection {
    //       position: absolute;
    //       pointer-events: none;
    //       z-index: 0;
    //     }
        
    //     .storyboard-port {
    //       width: 14px;
    //       height: 14px;
    //       border-radius: 50%;
    //       background: #aaa;
    //       border: 2px solid white;
    //       position: absolute;
    //       cursor: pointer;
    //       z-index: 2;
    //     }
        
    //     .storyboard-port.input {
    //       top: -7px;
    //       left: 50%;
    //       transform: translateX(-50%);
    //     }
        
    //     .storyboard-port.output {
    //       bottom: -7px;
    //       left: 50%;
    //       transform: translateX(-50%);
    //     }
        
    //     .storyboard-toolbox {
    //       padding: 12px;
    //       border-bottom: 1px solid #ddd;
    //       display: flex;
    //       flex-wrap: wrap;
    //       gap: 8px;
    //     }
        
    //     .storyboard-tool {
    //       padding: 6px 12px;
    //       background: #673ab7;
    //       color: white;
    //       border-radius: 4px;
    //       cursor: pointer;
    //       font-size: 0.9rem;
    //     }
        
    //     .storyboard-properties {
    //       flex: 1;
    //       padding: 12px;
    //       overflow-y: auto;
    //     }
        
    //     .storyboard-property-group {
    //       margin-bottom: 16px;
    //     }
        
    //     .storyboard-property-label {
    //       font-weight: bold;
    //       margin-bottom: 4px;
    //       color: #555;
    //     }
        
    //     .storyboard-property-field {
    //       margin-bottom: 8px;
    //     }
        
    //     /* Dark mode for editor */
    //     @media (prefers-color-scheme: dark) {
    //       .storyboard-canvas {
    //         background-color: #2a2a2a;
    //         background-image: 
    //           linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
    //           linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
    //       }
          
    //       .storyboard-sidebar {
    //         background: #333;
    //         border-left: 1px solid #444;
    //       }
          
    //       .storyboard-node {
    //         background: #333;
    //         box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    //       }
          
    //       .storyboard-node-body {
    //         color: #e0e0e0;
    //       }
          
    //       .storyboard-node-footer {
    //         border-top: 1px solid #444;
    //       }
          
    //       .storyboard-property-label {
    //         color: #aaa;
    //       }
    //     }
    //   `;
      
    //   document.head.appendChild(styles);
    // }
  
/**
 * Replace the initStyles method in Storyboard class with this improved version
 * This fixes the white border and aligns better with your app's styling
 */
initStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
      /* Drawer styling overrides */
      sl-drawer::part(panel) {
        padding: 0;
        border: none;
        background: #242424;
        color: #e0e0e0;
      }
      
      sl-drawer::part(header) {
        background: #333;
        padding: 16px;
        border-bottom: 1px solid #444;
      }
      
      sl-drawer::part(body) {
        padding: 0;
      }
      
      sl-drawer::part(footer) {
        background: #333;
        border-top: 1px solid #444;
        padding: 12px;
      }
      
      /* Story overlay styling */
      .story-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .story-content {
        background: #242424;
        max-width: 800px;
        width: 80vw;
        max-height: 80vh;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        transform: scale(0.95);
        transition: transform 0.3s ease;
      }
      
      .story-header {
        padding: 16px;
        background: linear-gradient(135deg, #673ab7, #9c27b0);
        color: white;
        font-weight: bold;
        font-size: 1.2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .story-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .story-image {
        width: 100%;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .story-image img {
        width: 100%;
        height: auto;
        display: block;
      }
      
      .story-text {
        font-size: 1.1rem;
        line-height: 1.6;
        color: #e0e0e0;
      }
      
      .story-choices {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      }
      
      .story-choice {
        padding: 12px 16px;
        background: #333;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
        color: #e0e0e0;
      }
      
      .story-choice:hover {
        background: #444;
      }
      
      .story-footer {
        padding: 16px;
        background: #333;
        border-top: 1px solid #444;
        display: flex;
        justify-content: flex-end;
      }
      
      /* Node Editor Styles */
      .storyboard-editor {
        display: flex;
        height: 100%;
        overflow: hidden;
      }
      
      .storyboard-canvas {
        flex: 1;
        background: #1e1e1e;
        background-image: 
          linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 20px 20px;
        position: relative;
        overflow: auto;
      }
      
      .storyboard-sidebar {
        width: 300px;
        background: #242424;
        border-left: 1px solid #444;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .storyboard-node {
        position: absolute;
        background: #333;
        border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        min-width: 200px;
        display: flex;
        flex-direction: column;
        user-select: none;
        cursor: move;
        z-index: 1;
      }
      
      .storyboard-node-header {
        padding: 8px 12px;
        background: #673ab7;
        color: white;
        font-weight: bold;
        border-radius: 6px 6px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .storyboard-node-body {
        padding: 12px;
        color: #e0e0e0;
      }
      
      .storyboard-node-footer {
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #444;
      }
      
      .storyboard-connection {
        position: absolute;
        pointer-events: none;
        z-index: 0;
      }
      
      .storyboard-port {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #aaa;
        border: 2px solid #333;
        position: absolute;
        cursor: pointer;
        z-index: 2;
      }
      
      .storyboard-port.input {
        top: -7px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .storyboard-port.output {
        bottom: -7px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .storyboard-toolbox {
        padding: 12px;
        border-bottom: 1px solid #444;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .storyboard-tool {
        padding: 6px 12px;
        background: #673ab7;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
      }
      
      .storyboard-tool:hover {
        background: #7e57c2;
      }
      
      .storyboard-tool:active {
        background: #5e35b1;
      }
      
      .storyboard-properties {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        color: #e0e0e0;
      }
      
      .storyboard-property-group {
        margin-bottom: 16px;
      }
      
      .storyboard-property-label {
        font-weight: bold;
        margin-bottom: 4px;
        color: #aaa;
      }
      
      .storyboard-property-field {
        margin-bottom: 8px;
      }
      
      /* Make node buttons more visible */
      .storyboard-node-close {
        display: inline-block;
        width: 18px;
        height: 18px;
        line-height: 16px;
        text-align: center;
        border-radius: 50%;
        background: rgba(0,0,0,0.2);
        cursor: pointer;
        font-weight: bold;
      }
      
      .storyboard-node-close:hover {
        background: rgba(255,0,0,0.5);
      }
      
      /* Selected node styling */
      .storyboard-node.selected {
        outline: 2px solid #fff;
        box-shadow: 0 0 10px rgba(255,255,255,0.3);
      }
    `;
    
    document.head.appendChild(styles);
  }

    /**
     * Opens the storyboard editor in an sl-drawer
     */
    // openEditor() {
    //     if (this.editor) {
    //       console.log('Editor already open');
    //       return;
    //     }
        
    //     // Create editor drawer
    //     const drawer = document.createElement('sl-drawer');
    //     drawer.label = 'Storyboard Editor';
    //     drawer.placement = 'end';
        
    //     // Set size to leave room for sidebar
    //     drawer.style.cssText = '--size: calc(100vw - 260px);';
        
    //     // Create editor content
    //     drawer.innerHTML = `
    //       <div class="storyboard-editor">
    //         <div class="storyboard-canvas" id="storyboard-canvas">
    //           <!-- Nodes will be added here dynamically -->
    //         </div>
    //         <div class="storyboard-sidebar">
    //           <div class="storyboard-toolbox">
    //             <div class="storyboard-tool" data-type="dialog">Dialog</div>
    //             <div class="storyboard-tool" data-type="choice">Choice</div>
    //             <div class="storyboard-tool" data-type="trigger">Trigger</div>
    //             <div class="storyboard-tool" data-type="event">Event</div>
    //             <div class="storyboard-tool" data-type="condition">Condition</div>
    //             <div class="storyboard-tool" data-type="combat">Combat</div>
    //             <div class="storyboard-tool" data-type="reward">Reward</div>
    //           </div>
    //           <div class="storyboard-properties" id="storyboard-properties">
    //             <div class="story-no-selection">
    //               <p>Select a node to edit its properties.</p>
    //             </div>
    //           </div>
    //           <div style="padding: 12px; border-top: 1px solid #ddd;">
    //             <sl-button variant="primary" id="save-storyboard" style="width: 100%;">Save Storyboard</sl-button>
    //           </div>
    //         </div>
    //       </div>
          
    //       <sl-button slot="footer" variant="primary">Close</sl-button>
    //     `;
        
    //     document.body.appendChild(drawer);
    //     drawer.show();
        
    //     // Store reference to editor
    //     this.editor = drawer;
        
    //     // Set up editor functionality after drawer is shown
    //     drawer.addEventListener('sl-after-show', () => {
    //       this.initEditorFunctionality();
    //     });
        
    //     // Clean up when drawer is closed
    //     drawer.addEventListener('sl-after-hide', () => {
    //       this.editor = null;
    //     });
    //   }
    

/**
 * Updated openEditor method for the Storyboard class
 */
openEditor() {
    console.log('Opening storyboard editor');
    
    if (this.editor) {
      console.log('Editor already open');
      return;
    }
    
    try {
      // Create editor drawer
      const drawer = document.createElement('sl-drawer');
      drawer.label = 'Storyboard Editor';
      drawer.placement = 'end';
      
      // Set size to leave room for sidebar
      drawer.style.cssText = '--size: calc(100vw - 260px);';
      
      // Create editor content - IMPORTANT: We add unique IDs to make debugging easier
      drawer.innerHTML = `
        <div class="storyboard-editor" id="sb-editor">
          <div class="storyboard-canvas" id="storyboard-canvas">
            <!-- Nodes will be added here dynamically -->
          </div>
          <div class="storyboard-sidebar" id="sb-sidebar">
            <div class="storyboard-toolbox" id="sb-toolbox">
              <div class="storyboard-tool" id="sb-tool-dialog" data-type="dialog">Dialog</div>
              <div class="storyboard-tool" id="sb-tool-choice" data-type="choice">Choice</div>
              <div class="storyboard-tool" id="sb-tool-trigger" data-type="trigger">Trigger</div>
              <div class="storyboard-tool" id="sb-tool-event" data-type="event">Event</div>
              <div class="storyboard-tool" id="sb-tool-condition" data-type="condition">Condition</div>
              <div class="storyboard-tool" id="sb-tool-combat" data-type="combat">Combat</div>
              <div class="storyboard-tool" id="sb-tool-reward" data-type="reward">Reward</div>
            </div>
            <div class="storyboard-properties" id="storyboard-properties">
              <div class="story-no-selection">
                <p>Select a node to edit its properties.</p>
              </div>
            </div>
            <div style="padding: 12px; border-top: 1px solid #ddd;">
              <sl-button variant="primary" id="save-storyboard" style="width: 100%;">Save Storyboard</sl-button>
            </div>
          </div>
        </div>
        
        <sl-button slot="footer" variant="primary" id="sb-close-btn">Close</sl-button>
      `;
      
      // Add to DOM
      document.body.appendChild(drawer);
      
      // Store reference to editor before showing
      this.editor = drawer;
      
      // Add event listeners for drawer
      drawer.addEventListener('sl-after-show', () => {
        console.log('Drawer shown, initializing editor');
        this.initEditorFunctionality();
      });
      
      // Clean up when drawer is closed
      drawer.addEventListener('sl-after-hide', () => {
        console.log('Drawer closed, cleaning up');
        this.editor = null;
      });
      
      // Show the drawer
      console.log('Showing storyboard drawer');
      drawer.show();
      
    } catch (error) {
      console.error('Error opening storyboard editor:', error);
    }
  }

    /**
     * Initialize the functionality of the storyboard editor
     */
    // initEditorFunctionality() {
    //   if (!this.editor) return;
      
    //   const canvas = this.editor.querySelector('#storyboard-canvas');
    //   const properties = this.editor.querySelector('#storyboard-properties');
    //   const tools = this.editor.querySelectorAll('.storyboard-tool');
      
    //   // Track editor state
    //   const editorState = {
    //     selectedNode: null,
    //     draggingNode: null,
    //     draggingOffset: { x: 0, y: 0 },
    //     connectingFrom: null,
    //     nodes: new Map(),
    //     connections: []
    //   };
      
    //   // Load any existing story graphs
    //   // For now just create a sample node for testing
    //   this.createSampleNode(canvas, editorState);
      
    //   // Set up tool buttons
    //   tools.forEach(tool => {
    //     tool.addEventListener('click', () => {
    //       const nodeType = tool.getAttribute('data-type');
    //       this.createNewNode(canvas, editorState, nodeType);
    //     });
    //   });
      
    //   // Set up canvas interactions
    //   canvas.addEventListener('mousedown', (e) => {
    //     // Check if we clicked on a node
    //     let nodeEl = e.target.closest('.storyboard-node');
        
    //     if (nodeEl) {
    //       // Handle node selection
    //       this.selectNode(nodeEl, editorState, properties);
          
    //       // Handle node dragging
    //       if (e.target.closest('.storyboard-node-header')) {
    //         const rect = nodeEl.getBoundingClientRect();
    //         editorState.draggingNode = nodeEl;
    //         editorState.draggingOffset = {
    //           x: e.clientX - rect.left,
    //           y: e.clientY - rect.top
    //         };
    //       }
          
    //       // Handle connection creation
    //       if (e.target.closest('.storyboard-port')) {
    //         const port = e.target.closest('.storyboard-port');
    //         if (port.classList.contains('output')) {
    //           editorState.connectingFrom = {
    //             node: nodeEl,
    //             port: port
    //           };
              
    //           // Create temporary connection line
    //           const conn = document.createElement('div');
    //           conn.className = 'storyboard-connection temp-connection';
    //           conn.style.cssText = `
    //             position: absolute;
    //             height: 2px;
    //             background: #673ab7;
    //             transform-origin: left center;
    //           `;
              
    //           const fromRect = port.getBoundingClientRect();
    //           const canvasRect = canvas.getBoundingClientRect();
              
    //           const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
    //           const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
              
    //           conn.style.left = `${x1}px`;
    //           conn.style.top = `${y1}px`;
              
    //           canvas.appendChild(conn);
    //           editorState.connectingFrom.tempConnection = conn;
    //         }
    //       }
    //     } else {
    //       // Clicked on empty canvas
    //       this.deselectNode(editorState, properties);
    //     }
    //   });
      
    //   canvas.addEventListener('mousemove', (e) => {
    //     // Handle node dragging
    //     if (editorState.draggingNode) {
    //       const canvasRect = canvas.getBoundingClientRect();
    //       const x = e.clientX - canvasRect.left - editorState.draggingOffset.x;
    //       const y = e.clientY - canvasRect.top - editorState.draggingOffset.y;
          
    //       editorState.draggingNode.style.left = `${x}px`;
    //       editorState.draggingNode.style.top = `${y}px`;
          
    //       // Update any connections attached to this node
    //       this.updateConnections(editorState);
    //     }
        
    //     // Handle connection creation
    //     if (editorState.connectingFrom) {
    //       const canvasRect = canvas.getBoundingClientRect();
    //       const fromRect = editorState.connectingFrom.port.getBoundingClientRect();
          
    //       const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
    //       const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
    //       const x2 = e.clientX - canvasRect.left;
    //       const y2 = e.clientY - canvasRect.top;
          
    //       const dx = x2 - x1;
    //       const dy = y2 - y1;
    //       const length = Math.sqrt(dx * dx + dy * dy);
    //       const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          
    //       const conn = editorState.connectingFrom.tempConnection;
    //       conn.style.width = `${length}px`;
    //       conn.style.transform = `rotate(${angle}deg)`;
    //     }
    //   });
      
    //   canvas.addEventListener('mouseup', (e) => {
    //     // Handle node dragging end
    //     if (editorState.draggingNode) {
    //       editorState.draggingNode = null;
    //     }
        
    //     // Handle connection creation end
    //     if (editorState.connectingFrom) {
    //       const targetPort = e.target.closest('.storyboard-port');
          
    //       if (targetPort && targetPort.classList.contains('input')) {
    //         const fromNode = editorState.connectingFrom.node;
    //         const toNode = targetPort.closest('.storyboard-node');
            
    //         // Don't connect to self
    //         if (fromNode !== toNode) {
    //           this.createConnection(canvas, editorState, {
    //             from: {
    //               node: fromNode,
    //               port: editorState.connectingFrom.port
    //             },
    //             to: {
    //               node: toNode,
    //               port: targetPort
    //             }
    //           });
    //         }
    //       }
          
    //       // Remove temporary connection
    //       if (editorState.connectingFrom.tempConnection) {
    //         editorState.connectingFrom.tempConnection.remove();
    //       }
          
    //       editorState.connectingFrom = null;
    //     }
    //   });
      
    //   // Save button
    //   const saveButton = this.editor.querySelector('#save-storyboard');
    //   saveButton.addEventListener('click', () => {
    //     this.saveStoryboard(editorState);
    //   });
    // }

    /**
 * Updated initEditorFunctionality method for Storyboard class
 * This adds more robust event handling and debug logging
 */
initEditorFunctionality() {
    if (!this.editor) {
      console.error('Editor not found');
      return;
    }
    
    console.log('Initializing editor functionality');
    
    // Ensure the drawer is fully rendered before setting up editor
    setTimeout(() => {
      try {
        const canvas = this.editor.querySelector('#storyboard-canvas');
        const properties = this.editor.querySelector('#storyboard-properties');
        const tools = this.editor.querySelectorAll('.storyboard-tool');
        
        if (!canvas) {
          console.error('Canvas element not found in editor');
          return;
        }
        
        console.log('Found canvas element:', canvas);
        console.log('Found tool buttons:', tools.length);
        
        // Track editor state
        const editorState = {
          selectedNode: null,
          draggingNode: null,
          draggingOffset: { x: 0, y: 0 },
          connectingFrom: null,
          nodes: new Map(),
          connections: []
        };
        
        // Load any existing story graphs
        // For now just create a sample node for testing
        this.createSampleNode(canvas, editorState);
        
        // Set up tool buttons with direct event handlers
        tools.forEach(tool => {
          console.log('Setting up tool:', tool.getAttribute('data-type'));
          
          tool.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const nodeType = tool.getAttribute('data-type');
            console.log('Tool clicked:', nodeType);
            
            this.createNewNode(canvas, editorState, nodeType);
          });
        });
        
        // Set up canvas interactions with proper event delegation
        canvas.addEventListener('mousedown', (e) => {
          // Check if we clicked on a node
          let nodeEl = e.target.closest('.storyboard-node');
          
          if (nodeEl) {
            // Handle node selection
            this.selectNode(nodeEl, editorState, properties);
            
            // Handle node dragging
            if (e.target.closest('.storyboard-node-header')) {
              const rect = nodeEl.getBoundingClientRect();
              editorState.draggingNode = nodeEl;
              editorState.draggingOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              };
            }
            
            // Handle connection creation
            if (e.target.closest('.storyboard-port')) {
              const port = e.target.closest('.storyboard-port');
              if (port.classList.contains('output')) {
                editorState.connectingFrom = {
                  node: nodeEl,
                  port: port
                };
                
                // Create temporary connection line
                const conn = document.createElement('div');
                conn.className = 'storyboard-connection temp-connection';
                conn.style.cssText = `
                  position: absolute;
                  height: 2px;
                  background: #673ab7;
                  transform-origin: left center;
                `;
                
                const fromRect = port.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
                const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                
                conn.style.left = `${x1}px`;
                conn.style.top = `${y1}px`;
                
                canvas.appendChild(conn);
                editorState.connectingFrom.tempConnection = conn;
              }
            }
          } else {
            // Clicked on empty canvas
            this.deselectNode(editorState, properties);
          }
        });
        
        canvas.addEventListener('mousemove', (e) => {
          // Handle node dragging
          if (editorState.draggingNode) {
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - editorState.draggingOffset.x;
            const y = e.clientY - canvasRect.top - editorState.draggingOffset.y;
            
            editorState.draggingNode.style.left = `${x}px`;
            editorState.draggingNode.style.top = `${y}px`;
            
            // Update any connections attached to this node
            this.updateConnections(editorState);
          }
          
          // Handle connection creation
          if (editorState.connectingFrom) {
            const canvasRect = canvas.getBoundingClientRect();
            const fromRect = editorState.connectingFrom.port.getBoundingClientRect();
            
            const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
            const x2 = e.clientX - canvasRect.left;
            const y2 = e.clientY - canvasRect.top;
            
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            const conn = editorState.connectingFrom.tempConnection;
            conn.style.width = `${length}px`;
            conn.style.transform = `rotate(${angle}deg)`;
          }
        });
        
        canvas.addEventListener('mouseup', (e) => {
          // Handle node dragging end
          if (editorState.draggingNode) {
            editorState.draggingNode = null;
          }
          
          // Handle connection creation end
          if (editorState.connectingFrom) {
            const targetPort = e.target.closest('.storyboard-port');
            
            if (targetPort && targetPort.classList.contains('input')) {
              const fromNode = editorState.connectingFrom.node;
              const toNode = targetPort.closest('.storyboard-node');
              
              // Don't connect to self
              if (fromNode !== toNode) {
                this.createConnection(canvas, editorState, {
                  from: {
                    node: fromNode,
                    port: editorState.connectingFrom.port
                  },
                  to: {
                    node: toNode,
                    port: targetPort
                  }
                });
              }
            }
            
            // Remove temporary connection
            if (editorState.connectingFrom.tempConnection) {
              editorState.connectingFrom.tempConnection.remove();
            }
            
            editorState.connectingFrom = null;
          }
        });
        
        // Save button with explicit handler
        const saveButton = this.editor.querySelector('#save-storyboard');
        if (saveButton) {
          console.log('Found save button');
          saveButton.addEventListener('click', (e) => {
            console.log('Save button clicked');
            this.saveStoryboard(editorState);
          });
        } else {
          console.error('Save button not found');
        }
        
        // Close button with explicit handler
        const closeButton = this.editor.querySelector('sl-button[slot="footer"]');
        if (closeButton) {
          console.log('Found close button');
          closeButton.addEventListener('click', (e) => {
            console.log('Close button clicked');
            this.editor.hide();
          });
        } else {
          console.error('Close button not found');
        }
        
        console.log('Editor functionality initialized successfully');
      } catch (error) {
        console.error('Error initializing editor functionality:', error);
      }
    }, 300); // Add a small delay to ensure components are ready
  }
    
    /**
     * Create a sample node for testing
     */
    createSampleNode(canvas, editorState) {
      const node = document.createElement('div');
      node.className = 'storyboard-node';
      node.setAttribute('data-type', 'dialog');
      node.setAttribute('data-id', 'node_' + Date.now());
      node.style.left = '100px';
      node.style.top = '100px';
      
      node.innerHTML = `
        <div class="storyboard-node-header">
          Dialog Node
          <span class="storyboard-node-close">×</span>
        </div>
        <div class="storyboard-node-body">
          <div>Welcome to the game!</div>
        </div>
        <div class="storyboard-node-footer">
          <div class="storyboard-port input"></div>
          <div class="storyboard-port output"></div>
        </div>
      `;
      
      canvas.appendChild(node);
      
      // Add to nodes collection
      editorState.nodes.set(node.getAttribute('data-id'), {
        element: node,
        type: 'dialog',
        data: {
          title: 'Dialog Node',
          text: 'Welcome to the game!',
          image: null
        }
      });
      
      // Set up delete handler
      node.querySelector('.storyboard-node-close').addEventListener('click', () => {
        this.deleteNode(node, editorState);
      });
    }
    
    /**
     * Create a new node of the specified type
     */
    // createNewNode(canvas, editorState, nodeType) {
    //   const node = document.createElement('div');
    //   node.className = 'storyboard-node';
    //   node.setAttribute('data-type', nodeType);
    //   node.setAttribute('data-id', 'node_' + Date.now());
      
    //   // Position in center of visible canvas
    //   const canvasRect = canvas.getBoundingClientRect();
    //   const scrollLeft = canvas.scrollLeft;
    //   const scrollTop = canvas.scrollTop;
      
    //   node.style.left = `${scrollLeft + canvasRect.width / 2 - 100}px`;
    //   node.style.top = `${scrollTop + canvasRect.height / 2 - 50}px`;
      
    //   // Configure based on node type
    //   let title, body, data;
      
    //   switch (nodeType) {
    //     case 'dialog':
    //       title = 'Dialog';
    //       body = '<div>New dialog text</div>';
    //       data = { title: 'Dialog', text: 'New dialog text', image: null };
    //       break;
    //     case 'choice':
    //       title = 'Choice';
    //       body = '<div>What would you like to do?</div><div style="color:#777;font-size:0.9em;">Add options in properties</div>';
    //       data = { 
    //         text: 'What would you like to do?', 
    //         options: [
    //           { text: 'Option 1', targetId: null },
    //           { text: 'Option 2', targetId: null }
    //         ] 
    //       };
    //       break;
    //     case 'trigger':
    //       title = 'Location Trigger';
    //       body = '<div>X: 0, Y: 0, Radius: 1</div>';
    //       data = { x: 0, y: 0, radius: 1, once: true };
    //       break;
    //     case 'event':
    //       title = 'Game Event';
    //       body = '<div>Select event in properties</div>';
    //       data = { eventType: 'none', params: {} };
    //       break;
    //     case 'condition':
    //       title = 'Condition';
    //       body = '<div>Configure condition in properties</div>';
    //       data = { condition: 'none', params: {} };
    //       break;
    //     case 'combat':
    //       title = 'Combat';
    //       body = '<div>Start combat with enemies</div>';
    //       data = { enemies: [], background: null };
    //       break;
    //     case 'reward':
    //       title = 'Reward';
    //       body = '<div>Give rewards to player</div>';
    //       data = { items: [], experience: 0, monsters: [] };
    //       break;
    //     default:
    //       title = 'Node';
    //       body = '<div>Configure node</div>';
    //       data = {};
    //   }
      
    //   node.innerHTML = `
    //     <div class="storyboard-node-header">
    //       ${title}
    //       <span class="storyboard-node-close">×</span>
    //     </div>
    //     <div class="storyboard-node-body">
    //       ${body}
    //     </div>
    //     <div class="storyboard-node-footer">
    //       <div class="storyboard-port input"></div>
    //       <div class="storyboard-port output"></div>
    //     </div>
    //   `;
      
    //   canvas.appendChild(node);
      
    //   // Add to nodes collection
    //   editorState.nodes.set(node.getAttribute('data-id'), {
    //     element: node,
    //     type: nodeType,
    //     data: data
    //   });
      
    //   // Set up delete handler
    //   node.querySelector('.storyboard-node-close').addEventListener('click', () => {
    //     this.deleteNode(node, editorState);
    //   });
      
    //   // Select the new node
    //   this.selectNode(node, editorState, this.editor.querySelector('#storyboard-properties'));
    // }

    /**
 * Replace the createNewNode method in Storyboard class to fix the event handling
 */
createNewNode(canvas, editorState, nodeType) {
    console.log('Creating new node of type:', nodeType);
    
    // Create node element
    const node = document.createElement('div');
    node.className = 'storyboard-node';
    node.setAttribute('data-type', nodeType);
    node.setAttribute('data-id', 'node_' + Date.now());
    
    // Position in center of visible canvas
    const canvasRect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.scrollLeft;
    const scrollTop = canvas.scrollTop;
    
    // Calculate position - center of visible area
    const centerX = scrollLeft + canvasRect.width / 2 - 100;
    const centerY = scrollTop + canvasRect.height / 2 - 50;
    
    node.style.left = `${centerX}px`;
    node.style.top = `${centerY}px`;
    
    // Configure based on node type
    let title, body, data;
    
    switch (nodeType) {
      case 'dialog':
        title = 'Dialog';
        body = '<div>New dialog text</div>';
        data = { title: 'Dialog', text: 'New dialog text', image: null };
        break;
      case 'choice':
        title = 'Choice';
        body = '<div>What would you like to do?</div><div style="color:#777;font-size:0.9em;">Add options in properties</div>';
        data = { 
          text: 'What would you like to do?', 
          options: [
            { text: 'Option 1', targetId: null },
            { text: 'Option 2', targetId: null }
          ] 
        };
        break;
      case 'trigger':
        title = 'Location Trigger';
        body = '<div>X: 0, Y: 0, Radius: 1</div>';
        data = { x: 0, y: 0, radius: 1, once: true };
        break;
      case 'event':
        title = 'Game Event';
        body = '<div>Select event in properties</div>';
        data = { eventType: 'none', params: {} };
        break;
      case 'condition':
        title = 'Condition';
        body = '<div>Configure condition in properties</div>';
        data = { condition: 'none', params: {} };
        break;
      case 'combat':
        title = 'Combat';
        body = '<div>Start combat with enemies</div>';
        data = { enemies: [], background: null };
        break;
      case 'reward':
        title = 'Reward';
        body = '<div>Give rewards to player</div>';
        data = { items: [], experience: 0, monsters: [] };
        break;
      default:
        title = 'Node';
        body = '<div>Configure node</div>';
        data = {};
    }
    
    node.innerHTML = `
      <div class="storyboard-node-header">
        ${title}
        <span class="storyboard-node-close">×</span>
      </div>
      <div class="storyboard-node-body">
        ${body}
      </div>
      <div class="storyboard-node-footer">
        <div class="storyboard-port input"></div>
        <div class="storyboard-port output"></div>
      </div>
    `;
    
    // Add the node to canvas
    canvas.appendChild(node);
    console.log('Node added to canvas');
    
    // Add to nodes collection
    editorState.nodes.set(node.getAttribute('data-id'), {
      element: node,
      type: nodeType,
      data: data
    });
    
    // Set up delete handler
    const closeBtn = node.querySelector('.storyboard-node-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Delete node clicked');
        this.deleteNode(node, editorState);
      });
    }
    
    // Select the new node
    this.selectNode(node, editorState, this.editor.querySelector('#storyboard-properties'));
    
    return node;
  }
    
    /**
     * Create a connection between two nodes
     */
    createConnection(canvas, editorState, connection) {
      const fromNode = connection.from.node;
      const toNode = connection.to.node;
      
      const conn = document.createElement('div');
      conn.className = 'storyboard-connection';
      conn.setAttribute('data-from', fromNode.getAttribute('data-id'));
      conn.setAttribute('data-to', toNode.getAttribute('data-id'));
      
      conn.style.cssText = `
        position: absolute;
        height: 2px;
        background: #673ab7;
        transform-origin: left center;
        z-index: 0;
      `;
      
      canvas.appendChild(conn);
      
      // Add to connections collection
      editorState.connections.push({
        element: conn,
        from: fromNode.getAttribute('data-id'),
        to: toNode.getAttribute('data-id')
      });
      
      // Update connection position
      this.updateConnection(conn, fromNode, toNode, canvas);
    }
    
    /**
     * Update a single connection's position
     */
    updateConnection(connectionEl, fromNode, toNode, canvas) {
      const fromPort = fromNode.querySelector('.storyboard-port.output');
      const toPort = toNode.querySelector('.storyboard-port.input');
      
      const canvasRect = canvas.getBoundingClientRect();
      
      const fromRect = fromPort.getBoundingClientRect();
      const toRect = toPort.getBoundingClientRect();
      
      const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
      const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
      const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      connectionEl.style.left = `${x1}px`;
      connectionEl.style.top = `${y1}px`;
      connectionEl.style.width = `${length}px`;
      connectionEl.style.transform = `rotate(${angle}deg)`;
    }
    
    /**
     * Update all connections in the editor
     */
    updateConnections(editorState) {
      const canvas = this.editor.querySelector('#storyboard-canvas');
      
      editorState.connections.forEach(connection => {
        const fromNode = canvas.querySelector(`.storyboard-node[data-id="${connection.from}"]`);
        const toNode = canvas.querySelector(`.storyboard-node[data-id="${connection.to}"]`);
        
        if (fromNode && toNode) {
          this.updateConnection(connection.element, fromNode, toNode, canvas);
        }
      });
    }
    
    /**
     * Delete a node and its connections
     */
    deleteNode(nodeEl, editorState) {
      const nodeId = nodeEl.getAttribute('data-id');
      
      // Remove associated connections
      editorState.connections = editorState.connections.filter(conn => {
        if (conn.from === nodeId || conn.to === nodeId) {
          conn.element.remove();
          return false;
        }
        return true;
      });
      
      // Remove node element
      nodeEl.remove();
      
      // Remove from nodes collection
      editorState.nodes.delete(nodeId);
      
      // Deselect if this was the selected node
      if (editorState.selectedNode === nodeEl) {
        this.deselectNode(editorState, this.editor.querySelector('#storyboard-properties'));
      }
    }
    
    /**
     * Select a node and show its properties
     */
    selectNode(nodeEl, editorState, propertiesPanel) {
      // Deselect previous node
      if (editorState.selectedNode) {
        editorState.selectedNode.classList.remove('selected');
      }
      
      // Select this node
      nodeEl.classList.add('selected');
      editorState.selectedNode = nodeEl;
      
      // Show properties
      const nodeId = nodeEl.getAttribute('data-id');
      const nodeData = editorState.nodes.get(nodeId);
      
      if (nodeData) {
        let propertiesHtml = '';
        
        switch (nodeData.type) {
          case 'dialog':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Dialog Title</div>
                <div class="storyboard-property-field">
                  <sl-input name="title" value="${nodeData.data.title || ''}"></sl-input>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Dialog Text</div>
                <div class="storyboard-property-field">
                  <sl-textarea name="text" rows="4">${nodeData.data.text || ''}</sl-textarea>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Image</div>
                <div class="storyboard-property-field">
                  <sl-button size="small">Select Image</sl-button>
                </div>
              </div>
            `;
            break;
            
          case 'choice':
            let optionsHtml = '';
            
            if (nodeData.data.options && nodeData.data.options.length) {
              nodeData.data.options.forEach((option, index) => {
                optionsHtml += `
                  <div style="display:flex; margin-bottom:8px; gap:8px; align-items:center;">
                    <sl-input name="option_${index}" value="${option.text}" style="flex:1;"></sl-input>
                    <sl-button size="small" class="delete-option" data-index="${index}">×</sl-button>
                  </div>
                `;
              });
            }
            
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Question Text</div>
                <div class="storyboard-property-field">
                  <sl-textarea name="text" rows="3">${nodeData.data.text || ''}</sl-textarea>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Options</div>
                <div class="storyboard-property-options">
                  ${optionsHtml}
                </div>
                <sl-button size="small" class="add-option">Add Option</sl-button>
              </div>
            `;
            break;
            
          case 'trigger':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Position</div>
                <div class="storyboard-property-field" style="display:flex; gap:8px;">
                  <sl-input type="number" name="x" value="${nodeData.data.x || 0}" label="X"></sl-input>
                  <sl-input type="number" name="y" value="${nodeData.data.y || 0}" label="Y"></sl-input>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Radius</div>
                <div class="storyboard-property-field">
                  <sl-input type="number" name="radius" value="${nodeData.data.radius || 1}"></sl-input>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-field">
                  <sl-checkbox name="once" ?checked="${nodeData.data.once !== false}">Trigger only once</sl-checkbox>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <sl-button size="small">Pick Location In-Game</sl-button>
              </div>
            `;
            break;
            
          case 'event':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Event Type</div>
                <div class="storyboard-property-field">
                  <sl-select name="eventType">
                    <sl-option value="none">Select Event Type</sl-option>
                    <sl-option value="offerStarter" ?selected="${nodeData.data.eventType === 'offerStarter'}">Offer Starter Monster</sl-option>
                    <sl-option value="showPartyManager" ?selected="${nodeData.data.eventType === 'showPartyManager'}">Show Party Manager</sl-option>
                    <sl-option value="giveItem" ?selected="${nodeData.data.eventType === 'giveItem'}">Give Item</sl-option>
                    <sl-option value="setFlag" ?selected="${nodeData.data.eventType === 'setFlag'}">Set Game Flag</sl-option>
                    <sl-option value="teleport" ?selected="${nodeData.data.eventType === 'teleport'}">Teleport Player</sl-option>
                  </sl-select>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Event Parameters</div>
                <div class="storyboard-property-field">
                  <p style="color:#777; font-size:0.9em;">Parameters will be displayed based on selected event type.</p>
                </div>
              </div>
            `;
            break;
            
          case 'combat':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Enemies</div>
                <div class="storyboard-property-field">
                  <sl-button size="small">Select Enemies</sl-button>
                </div>
                <div style="font-size:0.9em; color:#777; margin-top:8px;">
                  Selected: None
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Background</div>
                <div class="storyboard-property-field">
                  <sl-button size="small">Select Background</sl-button>
                </div>
              </div>
            `;
            break;
            
          default:
            propertiesHtml = `
              <div class="storyboard-property-group">
                <p>Properties for ${nodeData.type} node</p>
              </div>
            `;
        }
        
        propertiesPanel.innerHTML = `
          <div class="storyboard-properties-content" data-node-id="${nodeId}">
            <h3 style="margin-top:0;">${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)} Node</h3>
            ${propertiesHtml}
          </div>
        `;
        
        // Set up property update handlers
        const inputs = propertiesPanel.querySelectorAll('sl-input, sl-textarea, sl-select, sl-checkbox');
        inputs.forEach(input => {
          input.addEventListener('change', () => {
            this.updateNodeProperty(nodeData, input, editorState);
          });
        });
        
        // Set up special handlers for certain node types
        if (nodeData.type === 'choice') {
          // Add option button
          const addOptionBtn = propertiesPanel.querySelector('.add-option');
          if (addOptionBtn) {
            addOptionBtn.addEventListener('click', () => {
              nodeData.data.options.push({ text: 'New Option', targetId: null });
              this.selectNode(nodeEl, editorState, propertiesPanel); // Refresh properties panel
            });
          }
          
          // Delete option buttons
          const deleteOptionBtns = propertiesPanel.querySelectorAll('.delete-option');
          deleteOptionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
              const index = parseInt(btn.getAttribute('data-index'));
              nodeData.data.options.splice(index, 1);
              this.selectNode(nodeEl, editorState, propertiesPanel); // Refresh properties panel
            });
          });
        }
      }
    }
    
    /**
     * Deselect the current node
     */
    deselectNode(editorState, propertiesPanel) {
      if (editorState.selectedNode) {
        editorState.selectedNode.classList.remove('selected');
        editorState.selectedNode = null;
      }
      
      propertiesPanel.innerHTML = `
        <div class="story-no-selection">
          <p>Select a node to edit its properties.</p>
        </div>
      `;
    }
    
    /**
     * Update a node's property based on input change
     */
    updateNodeProperty(nodeData, input, editorState) {
      const name = input.getAttribute('name');
      let value;
      
      // Get value based on input type
      if (input.tagName.toLowerCase() === 'sl-checkbox') {
        value = input.checked;
      } else {
        value = input.value;
      }
      
      // Handle special property cases
      if (name.startsWith('option_')) {
        const index = parseInt(name.split('_')[1]);
        nodeData.data.options[index].text = value;
      } else {
        // Regular property
        nodeData.data[name] = value;
      }
      
      // Update node display
      const nodeEl = editorState.nodes.get(nodeData.element.getAttribute('data-id')).element;
      
      // Update body content based on node type
      if (nodeData.type === 'dialog') {
        nodeEl.querySelector('.storyboard-node-body').textContent = nodeData.data.text || '';
      } else if (nodeData.type === 'choice') {
        nodeEl.querySelector('.storyboard-node-body').innerHTML = `
          <div>${nodeData.data.text || ''}</div>
          <div style="color:#777;font-size:0.9em;">${nodeData.data.options?.length || 0} options</div>
        `;
      } else if (nodeData.type === 'trigger') {
        nodeEl.querySelector('.storyboard-node-body').textContent = `X: ${nodeData.data.x || 0}, Y: ${nodeData.data.y || 0}, Radius: ${nodeData.data.radius || 1}`;
      }
    }
    
    /**
     * Save the current storyboard
     */
    saveStoryboard(editorState) {
      // Convert editor state to story graph data
      const storyGraph = {
        nodes: [],
        connections: []
      };
      
      // Add nodes
      editorState.nodes.forEach((nodeData, nodeId) => {
        storyGraph.nodes.push({
          id: nodeId,
          type: nodeData.type,
          position: {
            x: parseInt(nodeData.element.style.left),
            y: parseInt(nodeData.element.style.top)
          },
          data: nodeData.data
        });
      });
      
      // Add connections
      editorState.connections.forEach(conn => {
        storyGraph.connections.push({
          from: conn.from,
          to: conn.to
        });
      });
      
      // Create unique ID for this story
      const storyId = 'story_' + Date.now();
      
      // Add to storyGraphs collection
      this.storyGraphs.set(storyId, storyGraph);
      
      // Save to localStorage for persistence
      this.saveToStorage();
      
      // Show confirmation
      const toast = document.createElement('sl-alert');
      toast.variant = 'success';
      toast.closable = true;
      toast.duration = 3000;
      toast.innerHTML = `
        <sl-icon slot="icon" name="check-circle"></sl-icon>
        Storyboard saved successfully!
      `;
      
      document.body.appendChild(toast);
      toast.toast();
    }
    
    /**
     * Save all story graphs to localStorage
     */
    saveToStorage() {
      const storageData = {
        storyGraphs: Array.from(this.storyGraphs.entries()),
        triggeredStories: Array.from(this.triggeredStories)
      };
      
      try {
        localStorage.setItem('storyboardData', JSON.stringify(storageData));
        console.log('Storyboard data saved to localStorage');
      } catch (error) {
        console.error('Error saving storyboard data:', error);
      }
    }
    
    /**
     * Load story graphs from localStorage
     */
    loadFromStorage() {
      try {
        const storageData = localStorage.getItem('storyboardData');
        
        if (storageData) {
          const data = JSON.parse(storageData);
          
          if (data.storyGraphs) {
            this.storyGraphs = new Map(data.storyGraphs);
          }
          
          if (data.triggeredStories) {
            this.triggeredStories = new Set(data.triggeredStories);
          }
          
          console.log('Storyboard data loaded from localStorage');
        }
      } catch (error) {
        console.error('Error loading storyboard data:', error);
      }
    }
    
    /**
     * Check for story triggers based on player position
     */
    checkTriggers() {
      // Only check if we have the scene3D reference
      if (!this.scene3D || !this.scene3D.player) return;
      
      // Get player position
      const playerPosition = this.scene3D.player.position;
      
      // Check all story graphs for trigger nodes
      this.storyGraphs.forEach((storyGraph, storyId) => {
        // Skip if already triggered and completed
        if (this.triggeredStories.has(storyId)) return;
        
        // Look for trigger nodes
        const triggerNodes = storyGraph.nodes.filter(node => 
          node.type === 'trigger' && !node.triggered
        );
        
        // Check each trigger node
        for (const triggerNode of triggerNodes) {
          const { x, y, radius } = triggerNode.data;
          
          // Calculate distance (2D for now)
          const dx = playerPosition.x - x;
          const dy = playerPosition.z - y; // Using z as the ground plane
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If player is within trigger radius
          if (distance <= radius) {
            console.log(`Triggered story node: ${triggerNode.id}`);
            
            // Mark as triggered
            triggerNode.triggered = true;
            
            // Execute the story flow starting from this node
            this.executeStoryNode(storyId, triggerNode.id);
            
            // Only trigger one node at a time
            break;
          }
        }
      });
    }
    
    /**
     * Execute a story node and follow the flow
     */
    executeStoryNode(storyId, nodeId) {
      const storyGraph = this.storyGraphs.get(storyId);
      if (!storyGraph) return;
      
      // Find the node
      const node = storyGraph.nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      console.log(`Executing story node: ${node.type}`);
      
      // Process based on node type
      switch (node.type) {
        case 'dialog':
          this.showDialog(node.data, () => {
            // Find next node
            const connection = storyGraph.connections.find(c => c.from === nodeId);
            if (connection) {
              this.executeStoryNode(storyId, connection.to);
            } else {
              // End of flow
              this.completeStory(storyId);
            }
          });
          break;
          
        case 'choice':
          this.showChoice(node.data, (optionIndex) => {
            // Find the connection for this option
            const selectedOption = node.data.options[optionIndex];
            
            if (selectedOption && selectedOption.targetId) {
              this.executeStoryNode(storyId, selectedOption.targetId);
            } else {
              // Try to find a connection based on index
              const connections = storyGraph.connections.filter(c => c.from === nodeId);
              
              if (connections.length > optionIndex) {
                this.executeStoryNode(storyId, connections[optionIndex].to);
              } else {
                // End of flow
                this.completeStory(storyId);
              }
            }
          });
          break;
          
        case 'event':
          this.executeEvent(node.data, () => {
            // Find next node
            const connection = storyGraph.connections.find(c => c.from === nodeId);
            if (connection) {
              this.executeStoryNode(storyId, connection.to);
            } else {
              // End of flow
              this.completeStory(storyId);
            }
          });
          break;
          
        case 'combat':
          this.startCombat(node.data, (result) => {
            // Find appropriate connection based on result
            const connections = storyGraph.connections.filter(c => c.from === nodeId);
            
            if (connections.length > 0) {
              if (connections.length === 1) {
                // Just one path
                this.executeStoryNode(storyId, connections[0].to);
              } else if (connections.length >= 2) {
                // Victory or defeat paths
                const nextNodeId = result === 'victory' ? connections[0].to : connections[1].to;
                this.executeStoryNode(storyId, nextNodeId);
              }
            } else {
              // End of flow
              this.completeStory(storyId);
            }
          });
          break;
          
        default:
          console.log(`Unhandled node type: ${node.type}`);
          // Continue to next node
          const connection = storyGraph.connections.find(c => c.from === nodeId);
          if (connection) {
            this.executeStoryNode(storyId, connection.to);
          } else {
            // End of flow
            this.completeStory(storyId);
          }
      }
    }
    
    /**
     * Mark a story as completed
     */
    completeStory(storyId) {
      console.log(`Story completed: ${storyId}`);
      this.triggeredStories.add(storyId);
      this.saveToStorage();
    }
    
    /**
     * Show a dialog overlay with the given data
     */
    showDialog(dialogData, onClose) {
      if (this.currentOverlay) {
        this.closeOverlay();
      }
      
      const overlay = document.createElement('div');
      overlay.className = 'story-overlay';
      
      let imageHtml = '';
      if (dialogData.image) {
        // Get image URL from resource manager if available
        const imageUrl = this.resourceManager ? 
          this.resourceManager.getSplashArtUrl(dialogData.image) : 
          dialogData.image;
          
        imageHtml = `
          <div class="story-image">
            <img src="${imageUrl}" alt="Story Image">
          </div>
        `;
      }
      
      overlay.innerHTML = `
        <div class="story-content">
          <div class="story-header">
            ${dialogData.title || 'Dialog'}
          </div>
          
          <div class="story-body">
            ${imageHtml}
            <div class="story-text">${dialogData.text || ''}</div>
          </div>
          
          <div class="story-footer">
            <sl-button variant="primary" class="story-continue-btn">Continue</sl-button>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      this.currentOverlay = overlay;
      
      // Set up continue button
      overlay.querySelector('.story-continue-btn').addEventListener('click', () => {
        this.closeOverlay();
        if (typeof onClose === 'function') {
          onClose();
        }
      });
      
      // Animate in
      setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('.story-content').style.transform = 'scale(1)';
      }, 10);
      
      // If we have scene3D, pause controls
      if (this.scene3D && typeof this.scene3D.pauseControls === 'function') {
        this.scene3D.pauseControls();
      }
    }
    
    /**
     * Show a choice dialog with options
     */
    showChoice(choiceData, onSelect) {
      if (this.currentOverlay) {
        this.closeOverlay();
      }
      
      const overlay = document.createElement('div');
      overlay.className = 'story-overlay';
      
      let optionsHtml = '';
      if (choiceData.options && choiceData.options.length) {
        optionsHtml = '<div class="story-choices">';
        
        choiceData.options.forEach((option, index) => {
          optionsHtml += `
            <div class="story-choice" data-index="${index}">
              ${option.text}
            </div>
          `;
        });
        
        optionsHtml += '</div>';
      }
      
      overlay.innerHTML = `
        <div class="story-content">
          <div class="story-header">
            Choice
          </div>
          
          <div class="story-body">
            <div class="story-text">${choiceData.text || ''}</div>
            ${optionsHtml}
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      this.currentOverlay = overlay;
      
      // Set up option buttons
      const optionButtons = overlay.querySelectorAll('.story-choice');
      optionButtons.forEach(button => {
        button.addEventListener('click', () => {
          const index = parseInt(button.getAttribute('data-index'));
          this.closeOverlay();
          if (typeof onSelect === 'function') {
            onSelect(index);
          }
        });
      });
      
      // Animate in
      setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('.story-content').style.transform = 'scale(1)';
      }, 10);
      
      // If we have scene3D, pause controls
      if (this.scene3D && typeof this.scene3D.pauseControls === 'function') {
        this.scene3D.pauseControls();
      }
    }
    
    /**
     * Execute a game event
     */
    executeEvent(eventData, onComplete) {
      console.log(`Executing game event: ${eventData.eventType}`);
      
      switch (eventData.eventType) {
        case 'offerStarter':
          // Show starter monster selection
          if (window.partyManager) {
            window.partyManager.checkForStarterMonster()
              .then(() => {
                if (typeof onComplete === 'function') {
                  onComplete();
                }
              })
              .catch(error => {
                console.error('Error in starter monster selection:', error);
                if (typeof onComplete === 'function') {
                  onComplete();
                }
              });
          } else {
            console.error('PartyManager not available');
            if (typeof onComplete === 'function') {
              onComplete();
            }
          }
          break;
          
        case 'showPartyManager':
          // Show party manager
          if (window.partyManager) {
            window.partyManager.showPartyManager();
            
            // Check when dialog closes
            const checkForDialog = setInterval(() => {
              const dialog = document.querySelector('sl-dialog[label="Monster Party"]');
              if (!dialog) {
                clearInterval(checkForDialog);
                if (typeof onComplete === 'function') {
                  onComplete();
                }
              }
            }, 100);
          } else {
            console.error('PartyManager not available');
            if (typeof onComplete === 'function') {
              onComplete();
            }
          }
          break;
          
        case 'teleport':
          // Teleport player
          if (this.scene3D && this.scene3D.player) {
            const { x, y, z } = eventData.params || {};
            if (x !== undefined && z !== undefined) {
              // Y is height, often want to keep the player on the ground
              const targetY = y !== undefined ? y : this.scene3D.player.position.y;
              
              // Teleport
              this.scene3D.player.position.set(x, targetY, z);
              console.log(`Teleported player to: ${x}, ${targetY}, ${z}`);
            }
          }
          
          if (typeof onComplete === 'function') {
            onComplete();
          }
          break;
          
        case 'giveItem':
          // Give item to player
          console.log('Give item event - not implemented yet');
          
          if (typeof onComplete === 'function') {
            onComplete();
          }
          break;
          
        case 'setFlag':
          // Set game flag
          if (window.gameFlags) {
            const { flag, value } = eventData.params || {};
            if (flag) {
              window.gameFlags[flag] = value !== undefined ? value : true;
              console.log(`Set game flag: ${flag} = ${window.gameFlags[flag]}`);
            }
          }
          
          if (typeof onComplete === 'function') {
            onComplete();
          }
          break;
          
        default:
          console.log(`Unknown event type: ${eventData.eventType}`);
          if (typeof onComplete === 'function') {
            onComplete();
          }
      }
    }
    
    /**
     * Start a combat encounter
     */
    startCombat(combatData, onComplete) {
      if (window.combatSystem) {
        // Start combat with specified enemies
        const enemies = combatData.enemies || [];
        
        // Set background if specified
        if (combatData.background && window.combatSystem.setCombatBackground) {
          window.combatSystem.setBattleBackground(combatData.background);
        }
        
        // Initialize combat
        window.combatSystem.initiateCombat(enemies)
          .then(result => {
            if (typeof onComplete === 'function') {
              onComplete(result);
            }
          })
          .catch(error => {
            console.error('Error in combat:', error);
            if (typeof onComplete === 'function') {
              onComplete('defeat');
            }
          });
      } else {
        console.error('CombatSystem not available');
        if (typeof onComplete === 'function') {
          onComplete('victory'); // Default to victory if combat not available
        }
      }
    }
    
    /**
     * Close the current overlay
     */
    closeOverlay() {
      if (this.currentOverlay) {
        // Animate out
        this.currentOverlay.style.opacity = '0';
        const content = this.currentOverlay.querySelector('.story-content');
        if (content) {
          content.style.transform = 'scale(0.95)';
        }
        
        // Remove after animation
        setTimeout(() => {
          this.currentOverlay.remove();
          this.currentOverlay = null;
          
          // If we have scene3D, resume controls
          if (this.scene3D && typeof this.scene3D.resumeControls === 'function') {
            this.scene3D.resumeControls();
          }
        }, 300);
      }
    }
    
    /**
     * Add a position-based story trigger point (backward compatibility)
     */
    addStoryPoint(x, y, splashArtId, text) {
      const id = `story_${Date.now()}`;
      
      // Create simple story graph with dialog node
      const storyGraph = {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { x, y, radius: 1, once: true }
          },
          {
            id: 'dialog_1',
            type: 'dialog',
            position: { x: 200, y: 0 },
            data: { text, image: splashArtId }
          }
        ],
        connections: [
          { from: 'trigger_1', to: 'dialog_1' }
        ]
      };
      
      this.storyGraphs.set(id, storyGraph);
      return id;
    }
    
    /**
     * Check if player is on a trigger (backward compatibility)
     */
    isPlayerOnTrigger(playerX, playerY, triggerPos) {
      // Add some tolerance for trigger area
      const tolerance = 1; // One unit tolerance
      return Math.abs(playerX - triggerPos.x) <= tolerance && 
             Math.abs(playerY - triggerPos.y) <= tolerance;
    }
    
    /**
     * Get splash art URL (backward compatibility)
     */
    getSplashArtUrl(splashArtId) {
      return this.resourceManager ? 
        this.resourceManager.getSplashArtUrl(splashArtId) : 
        '';
    }
    
    /**
     * Serialize storyboard data for saving
     */
    serialize() {
      return {
        storyGraphs: Array.from(this.storyGraphs.entries()),
        triggeredStories: Array.from(this.triggeredStories)
      };
    }
    
    /**
     * Deserialize storyboard data from saved state
     */
    deserialize(data) {
      if (data.storyGraphs) {
        this.storyGraphs = new Map(data.storyGraphs);
      }
      
      if (data.triggeredStories) {
        this.triggeredStories = new Set(data.triggeredStories);
      }
    }
  }
  
  // Create global instance when script loads
  window.initStoryboard = (scene3D, resourceManager) => {
    window.storyboard = new Storyboard(scene3D, resourceManager);
    return window.storyboard;
  };