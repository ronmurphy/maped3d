/**
 * Storyboard.js - Node-based story and event management system for the game
 * Handles creation, editing, and execution of narrative flows and game events
 */

// Check if Storyboard already exists to prevent redeclaration
if (typeof window.Storyboard === 'undefined') {

  window.Storyboard = class Storyboard {
    constructor(scene3D, resourceManager) {
      // Core dependencies
      this.scene3D = scene3D;
      this.resourceManager = resourceManager;

      // Story data - persistent between sessions
      this.storyGraphs = new Map(); // Map of story IDs to story graph objects
      this.activeStories = new Map(); // Currently active story executions
      this.triggeredStories = new Set(); // IDs of stories that have been triggered

      // Current working graph data - persists between editor sessions
      this.currentGraph = {
        id: 'graph_default',
        nodes: new Map(),  // Persistent node data
        connections: [],   // Persistent connection data
        dirty: false       // Whether data has changed since last save
      };

      // UI references - temporary, only valid when editor is open
      this.editor = null;  // Reference to editor drawer
      this.currentOverlay = null; // Current story overlay (dialogs etc)

      // Editor UI state - temporary, reset each time editor opens
      this.editorState = {
        active: false,
        selectedNode: null,
        draggingNode: null,
        draggingOffset: { x: 0, y: 0 },
        connectingFrom: null,
        canvasElement: null,
        propertiesElement: null
      };

      // Try to load existing data
      this.loadFromStorage();

      // Initialize styles
      this.initStyles();

      // Register world trigger check with scene3D if available
      if (this.scene3D && typeof this.scene3D.registerUpdateCallback === 'function') {
        this.scene3D.registerUpdateCallback(this.checkTriggers.bind(this));
      }

      console.log('Storyboard system initialized with persistent data');
    }


    connectToResourceManager(resourceManager) {
      if (!resourceManager) {
        console.error('Storyboard - Invalid ResourceManager provided');
        return false;
      }

      this.resourceManager = resourceManager;
      console.log('Storyboard is Connected to ResourceManager');
      return true;
    }

    /**
     * Initialize CSS styles for story displays
     */
  // .storyboard-drawer::part(header) {
  //   background: #333;
  //   padding: 16px;
  //   border-bottom: 1px solid #444;
  // }

    initStyles() {
      const styles = document.createElement('style');
      styles.textContent = `
      /* Drawer styling overrides */
  .storyboard-drawer::part(panel) {
    padding: 0;
    border: none;
    background: #242424;
    color: #e0e0e0;
  }
  
.storyboard-drawer::part(header) {
  background: #333;
  border-bottom: 1px solid #444;
  height: 48px;
  padding: 0 16px; /* Reduce padding */
  display: flex;
  align-items: center; /* Vertically center content */
}

/* Target the title specifically */
.storyboard-drawer::part(title) {
  font-size: 1rem; /* Slightly smaller font */
  white-space: nowrap; /* Prevent wrapping */
  overflow: hidden;
  text-overflow: ellipsis; /* Add ellipsis for long titles */
}

/* Adjust the close button */
.storyboard-drawer::part(close-button) {
  margin-left: 8px; /* Less margin */
  padding: 8px; /* Smaller click target but still usable */
}
  
  .storyboard-drawer::part(body) {
    padding: 0;
  }
  
  .storyboard-drawer::part(footer) {
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
        background: rgba(128, 5, 5, 0.91);
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
    openEditor() {
      console.log('Opening storyboard editor');

      if (this.editor) {
        console.log('Editor already open');
        return;
      }

      try {
        // Reset UI state but keep data
        this.editorState.active = true;
        this.editorState.selectedNode = null;
        this.editorState.draggingNode = null;
        this.editorState.connectingFrom = null;
        this.editorState.canvasElement = null;
        this.editorState.propertiesElement = null;

        // Create editor drawer
        const drawer = document.createElement('sl-drawer');
        drawer.label = 'Storyboard Editor';
        drawer.placement = 'end';

        // Add the storyboard-drawer class
        drawer.classList.add('storyboard-drawer');

        // Set size to leave room for sidebar
        drawer.style.cssText = '--size: calc(100vw - 280px);';

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

        // Add explicit close handler
        const closeBtn = drawer.querySelector('#sb-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            console.log('Close button clicked');

            // Make sure to save any unsaved changes when closing
            if (this.currentGraph.dirty) {
              this.saveCurrentGraph();
            }

            this.editorState.active = false; // Update UI state first
            drawer.hide();
            this.editor = null;
          });
        }

        // Handle hide event
        drawer.addEventListener('sl-after-hide', () => {
          console.log('Drawer closed, cleaning up');

          // Just reset UI state, not data
          this.editorState.active = false;
          this.editor = null;
        });

        // Show the drawer
        console.log('Showing storyboard drawer');
        drawer.show();

        // Initialize functionality after a small delay
        console.log('Setting up initialization timer');
        setTimeout(() => {
          console.log('Initialization timer fired, initializing editor');
          this.directInitEditor();
        }, 500);

      } catch (error) {
        console.error('Error opening storyboard editor:', error);
        this.editorState.active = false;
      }
    }

    /**
     * New saveCurrentGraph method to persist the current graph
     */
    saveCurrentGraph() {
      if (!this.currentGraph.id) {
        this.currentGraph.id = 'graph_' + Date.now();
      }

      // Create clean graph data without DOM references
      const cleanGraph = {
        nodes: [],
        connections: []
      };

      // Convert nodes to clean format
      this.currentGraph.nodes.forEach((nodeData, nodeId) => {
        // Extract position from DOM if available
        let position = { x: 0, y: 0 };
        if (nodeData.element) {
          position = {
            x: parseInt(nodeData.element.style.left) || 0,
            y: parseInt(nodeData.element.style.top) || 0
          };
        } else if (nodeData.position) {
          position = nodeData.position;
        }

        // Create clean node data
        cleanGraph.nodes.push({
          id: nodeId,
          type: nodeData.type,
          position: position,
          data: nodeData.data
        });
      });

      // Add connections
      this.currentGraph.connections.forEach(conn => {
        cleanGraph.connections.push({
          from: conn.from,
          to: conn.to
        });
      });

      // Store in storyGraphs
      this.storyGraphs.set(this.currentGraph.id, cleanGraph);

      // Mark as clean
      this.currentGraph.dirty = false;

      // Save to localStorage
      this.saveToStorage();

      console.log('Current graph saved:', this.currentGraph.id);
    }

    /**
     * New method for direct initialization without relying on the sl-after-show event
     */
    directInitEditor() {
      if (!this.editor) {
        console.error('Editor not found in directInitEditor');
        this.editorState.active = false;
        return;
      }

      console.log('Starting direct editor initialization');

      try {
        const canvas = this.editor.querySelector('#storyboard-canvas');
        const properties = this.editor.querySelector('#storyboard-properties');

        if (!canvas || !properties) {
          console.error('Canvas or properties element not found in editor');
          return;
        }

        // Store references in UI state
        this.editorState.canvasElement = canvas;
        this.editorState.propertiesElement = properties;

        console.log('Found canvas and properties elements');

        // Set up tool buttons
        this.setupToolButtons();

        // Set up canvas interactions
        this.setupCanvasInteractions(canvas, properties);

        // Set up save button
        const saveButton = this.editor.querySelector('#save-storyboard');
        if (saveButton) {
          console.log('Setting up save button');
          saveButton.addEventListener('click', () => {
            console.log('Save button clicked');
            this.saveCurrentGraph();

            // Show confirmation toast
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
          });
        }

        // Restore nodes from persistent data
        this.restoreNodesFromData(canvas);

        console.log('Editor initialization complete');

      } catch (error) {
        console.error('Error in directInitEditor:', error);
        this.editorState.active = false;
      }
    }

    /**
     * New method to set up tool buttons
     */
    setupToolButtons() {
      if (!this.editor) return;

      const toolIds = ['sb-tool-dialog', 'sb-tool-choice', 'sb-tool-trigger',
        'sb-tool-event', 'sb-tool-condition', 'sb-tool-combat', 'sb-tool-reward'];

      toolIds.forEach(id => {
        const tool = this.editor.querySelector(`#${id}`);
        if (tool) {
          console.log(`Setting up tool button: ${id}`);
          tool.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const nodeType = tool.getAttribute('data-type');
            console.log(`Tool clicked: ${nodeType}`);
            this.createNewNode(this.editorState.canvasElement, nodeType);
          });
        } else {
          console.error(`Tool button not found: ${id}`);
        }
      });
    }

    /**
     * New method to restore nodes from persistent data
     */
    restoreNodesFromData(canvas) {
      if (!canvas) return;

      // Clear the canvas first
      const existingNodes = canvas.querySelectorAll('.storyboard-node');
      existingNodes.forEach(node => node.remove());

      // Check if we have existing nodes in the current graph
      if (this.currentGraph.nodes.size === 0) {
        // If empty, add a sample node
        console.log('No existing nodes, creating sample node');
        this.createSampleNode(canvas);
        return;
      }

      console.log(`Restoring ${this.currentGraph.nodes.size} nodes from persistent data`);

      // Restore all nodes
      this.currentGraph.nodes.forEach((nodeData, nodeId) => {
        this.restoreSingleNode(canvas, nodeData, nodeId);
      });

      // Restore connections after all nodes are created
      setTimeout(() => {
        this.restoreConnections(canvas);
      }, 100);
    }

    /**
     * New method to restore a single node
     */
    restoreSingleNode(canvas, nodeData, nodeId) {
      // Create node element
      const node = document.createElement('div');
      node.className = 'storyboard-node';
      node.setAttribute('data-type', nodeData.type);
      node.setAttribute('data-id', nodeId);

      // Set position
      if (nodeData.position) {
        node.style.left = `${nodeData.position.x}px`;
        node.style.top = `${nodeData.position.y}px`;
      } else {
        node.style.left = '100px';
        node.style.top = '100px';
      }

      // Set content based on node type
      const title = nodeData.data.title || nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1);
      let body = '';

      switch (nodeData.type) {
        case 'dialog':
          body = `<div>${nodeData.data.text || ''}</div>`;
          break;
        case 'choice':
          body = `
        <div>${nodeData.data.text || ''}</div>
        <div style="color:#777;font-size:0.9em;">${nodeData.data.options?.length || 0} options</div>
      `;
          break;
        case 'trigger':
          body = `<div>X: ${nodeData.data.x || 0}, Y: ${nodeData.data.y || 0}, Radius: ${nodeData.data.radius || 1}</div>`;
          break;
        case 'event':
          body = `<div>Event: ${nodeData.data.eventType || 'none'}</div>`;
          break;
        case 'condition':
          body = `<div>Condition: ${nodeData.data.condition || 'none'}</div>`;
          break;
        case 'combat':
          body = `<div>Combat with ${nodeData.data.enemies?.length || 0} enemies</div>`;
          break;
        case 'reward':
          body = `<div>Rewards: ${nodeData.data.items?.length || 0} items</div>`;
          break;
        default:
          body = '<div>Configure node</div>';
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

      // Add to canvas
      canvas.appendChild(node);

      // Update the stored node data to include element reference
      nodeData.element = node;

      // Set up delete handler
      const closeBtn = node.querySelector('.storyboard-node-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Delete node clicked');
          this.deleteNode(node);
        });
      }

      console.log(`Restored node: ${nodeId}`);
    }

    /**
     * New method to restore connections
     */
    restoreConnections(canvas) {
      if (!canvas) return;

      console.log(`Restoring ${this.currentGraph.connections.length} connections`);

      // Clear existing connection elements
      const existingConnections = canvas.querySelectorAll('.storyboard-connection:not(.temp-connection)');
      existingConnections.forEach(conn => conn.remove());

      // Recreate all connections
      this.currentGraph.connections.forEach(conn => {
        // Find source and target nodes
        const fromNode = canvas.querySelector(`.storyboard-node[data-id="${conn.from}"]`);
        const toNode = canvas.querySelector(`.storyboard-node[data-id="${conn.to}"]`);

        if (fromNode && toNode) {
          // Get the ports
          const fromPort = fromNode.querySelector('.storyboard-port.output');
          const toPort = toNode.querySelector('.storyboard-port.input');

          if (fromPort && toPort) {
            this.createConnection(canvas, {
              from: {
                node: fromNode,
                port: fromPort
              },
              to: {
                node: toNode,
                port: toPort
              }
            });
          }
        }
      });
    }

    setupCanvasInteractions(canvas, properties) {
      if (!canvas || !properties) return;

      // Store references in case they're needed
      const editorState = this.editorState;

      canvas.addEventListener('mousedown', (e) => {
        // Check if we clicked on a node
        let nodeEl = e.target.closest('.storyboard-node');

        if (nodeEl) {
          console.log('Node clicked:', nodeEl.getAttribute('data-id'));
          // Handle node selection
          this.selectNode(nodeEl);

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
          this.deselectNode();
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

          // Update node position in persistent data
          const nodeId = editorState.draggingNode.getAttribute('data-id');
          const nodeData = this.currentGraph.nodes.get(nodeId);
          if (nodeData) {
            nodeData.position = { x, y };
            this.currentGraph.dirty = true;
          }

          // Update any connections attached to this node
          this.updateConnections();
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
          if (conn) {
            conn.style.width = `${length}px`;
            conn.style.transform = `rotate(${angle}deg)`;
          }
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
              this.createConnection(canvas, {
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
    }



    /**
     * sees if the editor is avaliable after being closed
     * @returns true / false
     */
    isEditorAvailable() {
      // First check persistent state
      if (!this.editorState.active) {
        console.warn('Editor is not active according to persistent state');
        return false;
      }

      // Then check actual editor element
      if (!this.editor) {
        console.warn('Editor element is null but state is active - fixing inconsistency');
        this.editorState.active = false;
        return false;
      }

      // Check if canvas is accessible
      if (!this.editorState.canvasElement) {
        console.warn('Canvas element not available in editor state');
        return false;
      }

      return true;
    }

    /**
     * Update the createSampleNode method to be more reliable
     */
    createSampleNode(canvas, editorState) {
      console.log('Creating sample node at 100,100');

      // Create the node element
      const node = document.createElement('div');
      node.className = 'storyboard-node';
      node.setAttribute('data-type', 'dialog');
      node.setAttribute('data-id', 'node_' + Date.now());
      node.style.left = '100px';
      node.style.top = '100px';

      // Set HTML content
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

      // Add to canvas
      canvas.appendChild(node);
      console.log('Sample node added to canvas');

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

      // Set up delete handler with proper event handling
      const closeBtn = node.querySelector('.storyboard-node-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Delete node clicked');
          this.deleteNode(node, editorState);
        });
      }

      return node;
    }

    /**
     * Initialize the functionality of the storyboard editor
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
    createSampleNode(canvas) {
      console.log('Creating sample node at 100,100');

      // Create unique ID
      const nodeId = 'node_sample_' + Date.now();

      // Create sample node data
      const nodeData = {
        type: 'dialog',
        position: { x: 100, y: 100 },
        data: {
          title: 'Dialog Node',
          text: 'Welcome to the game!',
          image: null
        },
        element: null // Will be set after DOM creation
      };

      // Add to persistent graph
      this.currentGraph.nodes.set(nodeId, nodeData);
      this.currentGraph.dirty = true;

      // Create DOM element
      this.restoreSingleNode(canvas, nodeData, nodeId);

      return nodeData.element;
    }

    /**
     * Create a new node of the specified type
     */
    createNewNode(canvas, nodeType) {
      if (!this.isEditorAvailable() || !canvas) {
        console.error('Cannot create node - editor or canvas not available');
        return null;
      }

      console.log('Creating new node of type:', nodeType);

      // Create unique ID
      const nodeId = 'node_' + Date.now();

      // Create default data for this node type
      let data = {};

      switch (nodeType) {
        case 'dialog':
          data = { title: 'Dialog', text: 'New dialog text', image: null };
          break;
        case 'choice':
          data = {
            text: 'What would you like to do?',
            options: [
              { text: 'Option 1', targetId: null },
              { text: 'Option 2', targetId: null }
            ]
          };
          break;
        case 'trigger':
          data = { x: 0, y: 0, radius: 1, once: true };
          break;
        case 'event':
          data = { eventType: 'none', params: {} };
          break;
        case 'condition':
          data = { condition: 'none', params: {} };
          break;
        case 'combat':
          data = { enemies: [], background: null };
          break;
        case 'reward':
          data = { items: [], experience: 0, monsters: [] };
          break;
        default:
          data = {};
      }

      // Position in center of visible canvas
      const canvasRect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft;
      const scrollTop = canvas.scrollTop;
      const centerX = scrollLeft + canvasRect.width / 2 - 100;
      const centerY = scrollTop + canvasRect.height / 2 - 50;

      // Create persistent node data
      const nodeData = {
        type: nodeType,
        position: { x: centerX, y: centerY },
        data: data,
        element: null // Will be set after DOM creation
      };

      // Add to persistent graph
      this.currentGraph.nodes.set(nodeId, nodeData);
      this.currentGraph.dirty = true;

      // Create DOM element
      this.restoreSingleNode(canvas, nodeData, nodeId);

      // Select the new node
      if (nodeData.element) {
        this.selectNode(nodeData.element);
      }

      return nodeData.element;
    }

    /**
     * Create a connection between two nodes
     */
    createConnection(canvas, connection) {
      if (!canvas || !connection.from || !connection.to) {
        console.error('Invalid connection data');
        return null;
      }

      const fromNode = connection.from.node;
      const toNode = connection.to.node;
      const fromId = fromNode.getAttribute('data-id');
      const toId = toNode.getAttribute('data-id');

      console.log(`Creating connection from ${fromId} to ${toId}`);

      // Create connection element
      const conn = document.createElement('div');
      conn.className = 'storyboard-connection';
      conn.setAttribute('data-from', fromId);
      conn.setAttribute('data-to', toId);

      conn.style.cssText = `
        position: absolute;
        height: 2px;
        background: #673ab7;
        transform-origin: left center;
        z-index: 0;
      `;

      canvas.appendChild(conn);

      // Add to persistent connections
      this.currentGraph.connections.push({
        from: fromId,
        to: toId,
        element: conn
      });
      this.currentGraph.dirty = true;

      // Update connection position
      this.updateConnection(conn, fromNode, toNode, canvas);

      return conn;
    }

    /**
     * Update a single connection's position
     */
    updateConnection(connectionEl, fromNode, toNode, canvas) {
      if (!this.isEditorAvailable()) return;

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
    updateConnections() {
      if (!this.isEditorAvailable()) return;

      const canvas = this.editorState.canvasElement;
      if (!canvas) return;

      this.currentGraph.connections.forEach(connection => {
        if (!connection.element) return;

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
    deleteNode(nodeEl) {
      if (!nodeEl) return;

      const nodeId = nodeEl.getAttribute('data-id');
      console.log('Deleting node:', nodeId);

      // Remove associated connections
      const canvas = nodeEl.parentElement;
      if (canvas) {
        this.currentGraph.connections = this.currentGraph.connections.filter(conn => {
          if (conn.from === nodeId || conn.to === nodeId) {
            if (conn.element) {
              conn.element.remove();
            }
            return false;
          }
          return true;
        });
      }

      // Remove node element
      nodeEl.remove();

      // Remove from persistent graph
      this.currentGraph.nodes.delete(nodeId);
      this.currentGraph.dirty = true;

      // Deselect if this was the selected node
      if (this.editorState.selectedNode === nodeEl) {
        this.deselectNode();
      }
    }

    getImageName(imageData) {
      if (!imageData || !this.resourceManager) return '';
      try {
        const { id, category } = imageData;
        const art = this.resourceManager.resources.splashArt[category]?.get(id);
        return art?.name || '';
      } catch (error) {
        console.error('Error getting image name:', error);
        return '';
      }
    }

    /**
     * Select a node and show its properties
     */
    selectNode(nodeEl) {
      if (!this.isEditorAvailable() || !nodeEl) return;

      // Deselect previous node
      if (this.editorState.selectedNode) {
        this.editorState.selectedNode.classList.remove('selected');
      }

      // Select this node
      nodeEl.classList.add('selected');
      this.editorState.selectedNode = nodeEl;

      // Show properties
      const properties = this.editorState.propertiesElement;
      if (!properties) return;

      // Get the node data
      const nodeId = nodeEl.getAttribute('data-id');
      const nodeData = this.currentGraph.nodes.get(nodeId);



      if (nodeData) {

        let propertiesHtml = '';
        let paramsHtml = '';
        let optionsHtml = '';
        let eventOptionsHtml = '';
        let conditionOptionsHtml = '';


        switch (nodeData.type) {
          case 'dialog':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Dialog Title</div>
                <div class="storyboard-property-field">
                  <sl-input id="dialog-title-input" name="title" value="${nodeData.data.title || ''}"></sl-input>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Dialog Text</div>
                <div class="storyboard-property-field">
                  <!-- Regular HTML textarea that will always work -->
                  <textarea 
                    id="dialog-text-area" 
                    style="width: 100%; min-height: 120px; padding: 8px; border: 2px solid #6200ee; 
                           background: #333; color: white; border-radius: 4px; font-family: inherit;
                           font-size: 1em; resize: vertical; margin-bottom: 8px;"
                    rows="6"
                  >${nodeData.data.text || ''}</textarea>
                  
                  <div class="text-status" style="margin-top: 4px; font-size: 0.8em; color: #aaa;">
                    <span class="char-count">0</span> characters
                  </div>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Image</div>
                <div class="storyboard-property-field">
                  <sl-button id="select-image-btn" size="small">Select Image</sl-button>
                  ${nodeData.data.image ? `
                    <div class="selected-image-preview" style="margin-top: 12px; border: 1px solid #444; padding: 8px; border-radius: 4px; background: #333;">
                      <img src="${this.getSplashArtUrl(nodeData.data.image)}" 
                           style="max-width: 100%; max-height: 150px; display: block; margin: 0 auto; border-radius: 4px;">
                      <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa; font-size: 0.9em;">${this.getImageName(nodeData.data.image) || 'Selected Image'}</span>
                        <sl-button size="small" class="remove-image-btn" variant="danger">
                          <span class="material-icons" style="font-size: 16px;">close</span>
                        </sl-button>
                      </div>
                    </div>
                  ` : '<div style="margin-top: 8px; font-size: 0.9em; color: #888;">No image selected</div>'}
                </div>
              </div>
              
              <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
                <sl-button id="apply-dialog-changes" variant="primary">Apply Changes</sl-button>
              </div>
            `;
            break;

          case 'choice':
            // Initialize options array if it doesn't exist
            if (!nodeData.data.options || !Array.isArray(nodeData.data.options)) {
              nodeData.data.options = [
                { text: 'Option 1', targetId: null },
                { text: 'Option 2', targetId: null }
              ];
            }

            // Generate options HTML dynamically
            let optionsHtml = '';
            nodeData.data.options.forEach((option, index) => {
              optionsHtml += `
      <div class="option-row" style="display: flex; gap: 8px; margin-bottom: 12px; align-items: start;">
        <div style="flex: 1;">
          <textarea 
            class="option-text" 
            data-index="${index}"
            style="width: 100%; min-height: 60px; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
            rows="2">${option.text || ''}</textarea>
        </div>
        <sl-button size="small" class="delete-option-btn" data-index="${index}" style="flex-shrink: 0;">
          <span class="material-icons" style="font-size: 16px;">delete</span>
        </sl-button>
      </div>
    `;
            });

            propertiesHtml = `
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Question Text</div>
      <div class="storyboard-property-field">
        <textarea 
          id="choice-text-area" 
          style="width: 100%; min-height: 100px; padding: 8px; border: 2px solid #6200ee; 
                 background: #333; color: white; border-radius: 4px; font-family: inherit;
                 font-size: 1em; resize: vertical; margin-bottom: 8px;"
          rows="4"
        >${nodeData.data.text || 'What would you like to do?'}</textarea>
      </div>
    </div>
    
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Options</div>
      <div class="storyboard-property-field options-container">
        ${optionsHtml}
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 12px;">
        <sl-button id="add-option-btn" size="small" variant="primary">
          <span class="material-icons" style="font-size: 16px; margin-right: 4px;">add</span>
          Add Option
        </sl-button>
        <span style="color: #aaa; font-size: 0.9em; align-self: center;">
          ${nodeData.data.options.length} options
        </span>
      </div>
    </div>
    
    <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <sl-button id="apply-choice-changes" variant="primary">Apply Changes</sl-button>
    </div>
  `;
            break;

          // For the selectNode method in Storyboard.js - add this case for trigger nodes
          case 'trigger':
            // Ensure default values exist
            if (!nodeData.data.x) nodeData.data.x = 0;
            if (!nodeData.data.y) nodeData.data.y = 0;
            if (!nodeData.data.radius) nodeData.data.radius = 1;
            if (nodeData.data.once === undefined) nodeData.data.once = true;

            propertiesHtml = `
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Trigger Position</div>
      <div class="storyboard-property-field" style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">X Coordinate</label>
          <input 
            type="number" 
            id="trigger-x-input" 
            value="${nodeData.data.x}"
            step="0.1"
            style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
          >
        </div>
        <div style="flex: 1;">
          <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Y Coordinate</label>
          <input 
            type="number" 
            id="trigger-y-input" 
            value="${nodeData.data.y}"
            step="0.1"
            style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
          >
        </div>
      </div>
    </div>
    
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Trigger Radius</div>
      <div class="storyboard-property-field" style="margin-bottom: 16px;">
        <input 
          type="range" 
          id="trigger-radius-input" 
          min="0.1" 
          max="10" 
          step="0.1" 
          value="${nodeData.data.radius}"
          style="width: 100%; margin-bottom: 8px;"
        >
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #aaa; font-size: 0.9em;">0.1</span>
          <span id="radius-value" style="color: white; font-weight: bold;">${nodeData.data.radius}</span>
          <span style="color: #aaa; font-size: 0.9em;">10</span>
        </div>
      </div>
    </div>
    
    <div class="storyboard-property-group">
      <div class="storyboard-property-field" style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input 
            type="checkbox" 
            id="trigger-once-input" 
            ${nodeData.data.once ? 'checked' : ''}
            style="margin-right: 8px;"
          >
          <span>Trigger only once</span>
        </label>
        <div style="margin-top: 4px; color: #aaa; font-size: 0.9em; margin-left: 24px;">
          If checked, this trigger will only activate once per game session.
        </div>
      </div>
    </div>
    
    <div class="storyboard-property-group">
      <sl-button id="pick-location-btn" size="small" variant="primary">
        <span class="material-icons" style="font-size: 16px; margin-right: 4px;">location_on</span>
        Pick Location In-Game
      </sl-button>
      <div style="margin-top: 8px; color: #aaa; font-size: 0.9em;">
        This will allow you to place the trigger by clicking on the map.
      </div>
    </div>
    
    <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <sl-button id="apply-trigger-changes" variant="primary">Apply Changes</sl-button>
    </div>
  `;
            break;

          // For the selectNode method in Storyboard.js - add this case for event nodes
          case 'event':
            // Define available event types
            const eventTypes = [
              { value: 'offerStarter', label: 'Offer Starter Monster' },
              { value: 'showPartyManager', label: 'Show Party Manager' },
              { value: 'giveItem', label: 'Give Item to Player' },
              { value: 'setFlag', label: 'Set Game Flag' },
              { value: 'teleport', label: 'Teleport Player' }
            ];

            // Set default if not set
            if (!nodeData.data.eventType) {
              nodeData.data.eventType = 'offerStarter';
            }

            // Initialize params if they don't exist
            if (!nodeData.data.params) {
              nodeData.data.params = {};
            }

            // Generate event options
            const eventOptionsHtml = eventTypes.map(event => `
    <option value="${event.value}" ${nodeData.data.eventType === event.value ? 'selected' : ''}>
      ${event.label}
    </option>
  `).join('');

            // Generate parameter form based on event type
            let paramsHtml = '';
            switch (nodeData.data.eventType) {
              case 'giveItem':
                // Get item name if available
                const itemName = nodeData.data.params?.itemName || 'No item selected';

                paramsHtml = `
                  <div class="param-group" style="margin-top: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <label style="color: #aaa; font-size: 0.9em;">Selected Item</label>
                      <sl-button id="select-item-btn" size="small">
                        <span class="material-icons" style="font-size: 16px; margin-right: 4px;">search</span>
                        Browse Items
                      </sl-button>
                    </div>
                    
                    ${nodeData.data.params?.itemId ? `
                      <div class="selected-item-preview" style="margin-bottom: 16px; border: 1px solid #444; padding: 12px; border-radius: 4px; background: #333; display: flex; align-items: center; gap: 12px;">
                        <div style="flex-shrink: 0; width: 50px; height: 50px; overflow: hidden; border-radius: 4px;">
                          <img src="${this.resourceManager.resources.textures.props.get(nodeData.data.params.itemId)?.thumbnail || ''}" 
                               style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div style="flex: 1;">
                          <div style="font-weight: 500;">${itemName}</div>
                          <div style="font-size: 0.9em; color: #aaa;">ID: ${nodeData.data.params.itemId}</div>
                        </div>
                      </div>
                    ` : `
                      <div style="border: 1px dashed #666; padding: 16px; text-align: center; color: #888; margin-bottom: 16px; border-radius: 4px;">
                        No item selected yet. Click "Browse Items" to choose one.
                      </div>
                    `}
                  </div>
                  
                  <div class="param-group" style="margin-top: 16px;">
                    <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Quantity</label>
                    <input 
                      type="number" 
                      id="item-quantity-input" 
                      value="${nodeData.data.params?.quantity || 1}"
                      min="1"
                      style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                    >
                  </div>
                  
                  <div class="param-group" style="margin-top: 16px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                      <input 
                        type="checkbox" 
                        id="item-horizontal-input" 
                        ${nodeData.data.params?.isHorizontal ? 'checked' : ''}
                        style="margin-right: 8px;"
                      >
                      <span>Place horizontally (flat on ground)</span>
                    </label>
                    <div style="margin-top: 4px; margin-left: 24px; color: #aaa; font-size: 0.9em;">
                      When checked, item will be placed flat on the ground instead of standing upright.
                    </div>
                  </div>
                `;
                break;

              case 'setFlag':
                paramsHtml = `
        <div class="param-group" style="margin-top: 16px;">
          <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Flag Name</label>
          <input 
            type="text" 
            id="flag-name-input" 
            value="${nodeData.data.params.flag || ''}"
            style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
            placeholder="Enter flag name"
          >
        </div>
        <div class="param-group" style="margin-top: 16px;">
          <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Flag Value</label>
          <select 
            id="flag-value-input"
            style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
          >
            <option value="true" ${nodeData.data.params.value === true ? 'selected' : ''}>True</option>
            <option value="false" ${nodeData.data.params.value === false ? 'selected' : ''}>False</option>
          </select>
        </div>
      `;
                break;

              case 'teleport':
                paramsHtml = `
        <div class="param-group" style="margin-top: 16px; display: flex; gap: 12px;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">X Coordinate</label>
            <input 
              type="number" 
              id="teleport-x-input" 
              value="${nodeData.data.params.x || 0}"
              step="0.1"
              style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
            >
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Y Coordinate</label>
            <input 
              type="number" 
              id="teleport-y-input" 
              value="${nodeData.data.params.y || 0}"
              step="0.1"
              style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
            >
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Z Coordinate</label>
            <input 
              type="number" 
              id="teleport-z-input" 
              value="${nodeData.data.params.z || 0}"
              step="0.1"
              style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
            >
          </div>
        </div>
        <div style="margin-top: 12px;">
          <sl-button id="pick-teleport-location-btn" size="small">
            <span class="material-icons" style="font-size: 16px; margin-right: 4px;">location_on</span>
            Pick Location In-Game
          </sl-button>
        </div>
      `;
                break;

              // For offerStarter and showPartyManager, no additional parameters needed
              default:
                paramsHtml = `
        <div style="margin-top: 16px; padding: 12px; background: #383838; border-radius: 4px;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span class="material-icons" style="font-size: 20px; margin-right: 8px; color: #aaa;">info</span>
            <span>No additional parameters required for this event type.</span>
          </div>
        </div>
      `;
            }

            propertiesHtml = `
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Event Type</div>
      <div class="storyboard-property-field">
        <select 
          id="event-type-select" 
          style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
        >
          ${eventOptionsHtml}
        </select>
      </div>
    </div>
    
    <div class="storyboard-property-group">
      <div class="storyboard-property-label">Event Parameters</div>
      <div class="storyboard-property-field event-params-container">
        ${paramsHtml}
      </div>
    </div>
    
    <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <sl-button id="apply-event-changes" variant="primary">Apply Changes</sl-button>
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
                  Selected: ${nodeData.data.enemies?.length || 'None'}
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

          case 'reward':
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Items</div>
                <div class="storyboard-property-field">
                  <sl-button size="small">Select Items</sl-button>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Experience</div>
                <div class="storyboard-property-field">
                  <sl-input type="number" name="experience" value="${nodeData.data.experience || 0}"></sl-input>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Monsters</div>
                <div class="storyboard-property-field">
                  <sl-button size="small">Select Monsters</sl-button>
                </div>
              </div>
            `;
            break;

            case 'condition':
              // Define available condition types
              const conditionTypes = [
                { value: 'hasMonster', label: 'Has Monster' },
                { value: 'hasItem', label: 'Has Item' },
                { value: 'hasFlag', label: 'Has Game Flag' },
                { value: 'monsterLevel', label: 'Monster Level Check' }
                // Removed playerLevel as you suggested
              ];
              
              // Set default if not set
              if (!nodeData.data.condition) {
                nodeData.data.condition = 'hasFlag';
              }
              
              // Initialize params if they don't exist
              if (!nodeData.data.params) {
                nodeData.data.params = {};
              }
            
              // Generate condition options
              const conditionOptionsHtml = conditionTypes.map(cond => `
                <option value="${cond.value}" ${nodeData.data.condition === cond.value ? 'selected' : ''}>
                  ${cond.label}
                </option>
              `).join('');
            
              // Generate parameter form based on condition type
              paramsHtml = '';
              switch (nodeData.data.condition) {
                case 'hasMonster':
                  paramsHtml = `
                    <div class="param-group" style="margin-top: 16px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <label style="color: #aaa; font-size: 0.9em;">Selected Monster</label>
                        <sl-button id="select-monster-btn" size="small">
                          <span class="material-icons" style="font-size: 16px; margin-right: 4px;">search</span>
                          Browse Monsters
                        </sl-button>
                      </div>
                      
                      ${nodeData.data.params?.monsterId ? `
                        <div class="selected-monster-preview" style="margin-bottom: 16px; border: 1px solid #444; padding: 12px; border-radius: 4px; background: #333; display: flex; align-items: center; gap: 12px;">
                          <div style="flex-shrink: 0; width: 50px; height: 50px; overflow: hidden; border-radius: 4px;">
                            <img src="${this.resourceManager.resources.bestiary.get(nodeData.data.params.monsterId)?.thumbnail || ''}" 
                                 style="width: 100%; height: 100%; object-fit: contain;">
                          </div>
                          <div style="flex: 1;">
                            <div style="font-weight: 500;">${nodeData.data.params.monsterName || 'Unknown Monster'}</div>
                            <div style="font-size: 0.9em; color: #aaa;">ID: ${nodeData.data.params.monsterId}</div>
                          </div>
                        </div>
                      ` : `
                        <div style="border: 1px dashed #666; padding: 16px; text-align: center; color: #888; margin-bottom: 16px; border-radius: 4px;">
                          No monster selected yet. Click "Browse Monsters" to choose one.
                        </div>
                      `}
                    </div>
                  `;
                  break;
                  
                case 'hasItem':
                  paramsHtml = `
                    <div class="param-group" style="margin-top: 16px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <label style="color: #aaa; font-size: 0.9em;">Selected Item</label>
                        <sl-button id="select-item-btn" size="small">
                          <span class="material-icons" style="font-size: 16px; margin-right: 4px;">search</span>
                          Browse Items
                        </sl-button>
                      </div>
                      
                      ${nodeData.data.params?.itemId ? `
                        <div class="selected-item-preview" style="margin-bottom: 16px; border: 1px solid #444; padding: 12px; border-radius: 4px; background: #333; display: flex; align-items: center; gap: 12px;">
                          <div style="flex-shrink: 0; width: 50px; height: 50px; overflow: hidden; border-radius: 4px;">
                            <img src="${this.resourceManager.resources.textures.props.get(nodeData.data.params.itemId)?.thumbnail || ''}" 
                                 style="width: 100%; height: 100%; object-fit: contain;">
                          </div>
                          <div style="flex: 1;">
                            <div style="font-weight: 500;">${nodeData.data.params.itemName || 'Unknown Item'}</div>
                            <div style="font-size: 0.9em; color: #aaa;">ID: ${nodeData.data.params.itemId}</div>
                          </div>
                        </div>
                      ` : `
                        <div style="border: 1px dashed #666; padding: 16px; text-align: center; color: #888; margin-bottom: 16px; border-radius: 4px;">
                          No item selected yet. Click "Browse Items" to choose one.
                        </div>
                      `}
                      
                      <div style="margin-top: 12px;">
                        <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Minimum Quantity</label>
                        <input 
                          type="number" 
                          id="item-quantity-input" 
                          value="${nodeData.data.params?.quantity || 1}"
                          min="1"
                          style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                        >
                      </div>
                    </div>
                  `;
                  break;
                  
                case 'hasFlag':
                  paramsHtml = `
                    <div class="param-group" style="margin-top: 16px;">
                      <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Flag Name</label>
                      <input 
                        type="text" 
                        id="flag-name-input" 
                        value="${nodeData.data.params?.flag || ''}"
                        style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                        placeholder="Enter flag name"
                      >
                    </div>
                    <div class="param-group" style="margin-top: 16px;">
                      <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Required Value</label>
                      <select 
                        id="flag-value-input"
                        style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                      >
                        <option value="true" ${nodeData.data.params?.value === true ? 'selected' : ''}>True</option>
                        <option value="false" ${nodeData.data.params?.value === false ? 'selected' : ''}>False</option>
                      </select>
                    </div>
                  `;
                  break;
                  
                case 'monsterLevel':
                  paramsHtml = `
                    <div class="param-group" style="margin-top: 16px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <label style="color: #aaa; font-size: 0.9em;">Selected Monster</label>
                        <sl-button id="select-monster-btn" size="small">
                          <span class="material-icons" style="font-size: 16px; margin-right: 4px;">search</span>
                          Browse Monsters
                        </sl-button>
                      </div>
                      
                      ${nodeData.data.params?.monsterId ? `
                        <div class="selected-monster-preview" style="margin-bottom: 16px; border: 1px solid #444; padding: 12px; border-radius: 4px; background: #333; display: flex; align-items: center; gap: 12px;">
                          <div style="flex-shrink: 0; width: 50px; height: 50px; overflow: hidden; border-radius: 4px;">
                            <img src="${this.resourceManager.resources.bestiary.get(nodeData.data.params.monsterId)?.thumbnail || ''}" 
                                 style="width: 100%; height: 100%; object-fit: contain;">
                          </div>
                          <div style="flex: 1;">
                            <div style="font-weight: 500;">${nodeData.data.params.monsterName || 'Unknown Monster'}</div>
                            <div style="font-size: 0.9em; color: #aaa;">ID: ${nodeData.data.params.monsterId}</div>
                          </div>
                        </div>
                      ` : `
                        <div style="border: 1px dashed #666; padding: 16px; text-align: center; color: #888; margin-bottom: 16px; border-radius: 4px;">
                          No monster selected yet. Click "Browse Monsters" to choose one.
                        </div>
                      `}
                      
                      <div style="margin-top: 12px;">
                        <label style="display: block; margin-bottom: 4px; color: #aaa; font-size: 0.9em;">Minimum Level</label>
                        <input 
                          type="number" 
                          id="monster-level-input" 
                          value="${nodeData.data.params?.level || 1}"
                          min="1"
                          style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                        >
                      </div>
                    </div>
                  `;
                  break;
              }
            
              propertiesHtml = `
                <div class="storyboard-property-group">
                  <div class="storyboard-property-label">Condition Type</div>
                  <div class="storyboard-property-field">
                    <select 
                      id="condition-type-select" 
                      style="width: 100%; padding: 8px; border: 1px solid #666; background: #333; color: white; border-radius: 4px;"
                    >
                      ${conditionOptionsHtml}
                    </select>
                  </div>
                </div>
                
                <div class="storyboard-property-group">
                  <div class="storyboard-property-label">Condition Parameters</div>
                  <div class="storyboard-property-field condition-params-container">
                    ${paramsHtml}
                  </div>
                </div>
                
                <div class="storyboard-property-group">
                  <div style="background: #383838; padding: 12px; border-radius: 4px;">
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                      <span class="material-icons" style="font-size: 20px; margin-right: 8px; color: #aaa; margin-top: 2px;">info</span>
                      <span>Connect the output of this condition node to two different nodes. The first connection is followed if the condition is true, the second if the condition is false.</span>
                    </div>
                  </div>
                </div>
                
                <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
                  <sl-button id="apply-condition-changes" variant="primary">Apply Changes</sl-button>
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

        properties.innerHTML = `
        <div class="storyboard-properties-content" data-node-id="${nodeId}">
          <h3 style="margin-top:0;">${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)} Node</h3>
          ${propertiesHtml}
        </div>
      `;

        // Add a small delay to ensure custom elements are upgraded
        setTimeout(() => {
          this.setupNodePropertyHandlers(nodeData, nodeId, properties);
        }, 50);
      }
    }

    /**
     * New method to set up property handlers for different node types
     */
    setupNodePropertyHandlers(nodeData, nodeId, properties) {
      if (!properties || !nodeData) return;

      // Handle dialog node properties
      if (nodeData.type === 'dialog') {
        // Set up character counter
        const textArea = properties.querySelector('#dialog-text-area');
        const charCount = properties.querySelector('.char-count');

        if (textArea && charCount) {
          // Update initial count
          charCount.textContent = textArea.value.length;

          // Update count on input
          textArea.addEventListener('input', () => {
            charCount.textContent = textArea.value.length;
          });
        }

        // Apply button handler
        const applyBtn = properties.querySelector('#apply-dialog-changes');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            try {
              // Get current values from inputs
              const titleInput = properties.querySelector('#dialog-title-input');
              const textArea = properties.querySelector('#dialog-text-area');

              // Safer value retrieval
              const title = titleInput?.value?.trim() || '';
              const text = textArea?.value?.trim() || '';

              // Update node data
              nodeData.data.title = title;
              nodeData.data.text = text;

              // Mark as dirty
              this.currentGraph.dirty = true;

              // Update visual representation
              this.updateNodeVisual(nodeData);

              // Visual feedback
              if (textArea) textArea.style.borderColor = '#22c55e'; // Success green

              setTimeout(() => {
                if (textArea) textArea.style.borderColor = '#6200ee'; // Return to purple
              }, 1000);

              // Show confirmation
              this.showToast('Node updated', 'success');
            } catch (error) {
              console.error('Error updating node data:', error);
              this.showToast('Error updating node', 'error');
            }
          });
        }

        const selectImageBtn = properties.querySelector('#select-image-btn');
        if (selectImageBtn) {
          selectImageBtn.addEventListener('click', () => {
            // Use the unified resource selector
            this.showResourceSelector(nodeData, 'splashArt', 'title', (resourceId, resource) => {
              // Update node data with selected image
              nodeData.data.image = {
                id: resourceId,
                category: 'title'
              };
    
              // Mark as dirty
              this.currentGraph.dirty = true;
    
              // Update visual representation
              this.updateNodeVisual(nodeData);
    
              // Refresh properties panel
              this.selectNode(nodeData.element);
    
              // Show confirmation
              this.showToast(`Image "${resource.name}" selected`, 'success');
            });
          });
        }

        // Handle remove image button if it exists
        const removeImageBtn = properties.querySelector('.remove-image-btn');
        if (removeImageBtn) {
          removeImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Remove image reference
            nodeData.data.image = null;

            // Mark as dirty
            this.currentGraph.dirty = true;

            // Refresh properties panel
            this.selectNode(nodeData.element);
          });
        }
      }

      // In setupNodePropertyHandlers method, add this for choice nodes
      if (nodeData.type === 'choice') {
        // Apply button handler
        const applyBtn = properties.querySelector('#apply-choice-changes');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            try {
              // Get main question text
              const textArea = properties.querySelector('#choice-text-area');
              const text = textArea?.value?.trim() || '';

              // Get all option texts
              const optionTextareas = properties.querySelectorAll('.option-text');
              const options = [];

              optionTextareas.forEach(textarea => {
                const index = parseInt(textarea.getAttribute('data-index'));
                const text = textarea.value.trim();

                // Preserve existing targetId if available
                const existingOption = nodeData.data.options[index];
                const targetId = existingOption ? existingOption.targetId : null;

                options.push({ text, targetId });
              });

              // Update node data
              nodeData.data.text = text;
              nodeData.data.options = options;

              // Mark as dirty
              this.currentGraph.dirty = true;

              // Update visual representation
              this.updateNodeVisual(nodeData);

              // Show confirmation
              this.showToast('Choice options updated', 'success');
            } catch (error) {
              console.error('Error updating choice node:', error);
              this.showToast('Error updating choice node', 'error');
            }
          });
        }

        // Add option button
        const addOptionBtn = properties.querySelector('#add-option-btn');
        if (addOptionBtn) {
          addOptionBtn.addEventListener('click', () => {
            // Add new option to data
            nodeData.data.options.push({ text: 'New option', targetId: null });

            // Refresh properties panel to show new option
            this.selectNode(nodeData.element);

            // Show confirmation
            this.showToast('Option added', 'success');
          });
        }

        // Delete option buttons
        const deleteButtons = properties.querySelectorAll('.delete-option-btn');
        deleteButtons.forEach(button => {
          button.addEventListener('click', () => {
            const index = parseInt(button.getAttribute('data-index'));

            // Need at least one option
            if (nodeData.data.options.length <= 1) {
              this.showToast('Cannot delete last option', 'error');
              return;
            }

            // Remove the option
            nodeData.data.options.splice(index, 1);

            // Refresh properties panel
            this.selectNode(nodeData.element);

            // Show confirmation
            this.showToast('Option deleted', 'success');
          });
        });
      }

      // In setupNodePropertyHandlers method, add this for trigger nodes
      if (nodeData.type === 'trigger') {
        // Set up radius range slider
        const radiusInput = properties.querySelector('#trigger-radius-input');
        const radiusValue = properties.querySelector('#radius-value');

        if (radiusInput && radiusValue) {
          // Update value display when slider changes
          radiusInput.addEventListener('input', () => {
            radiusValue.textContent = radiusInput.value;
          });
        }

        // Apply button handler
        const applyBtn = properties.querySelector('#apply-trigger-changes');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            try {
              // Get values from inputs
              const xInput = properties.querySelector('#trigger-x-input');
              const yInput = properties.querySelector('#trigger-y-input');
              const radiusInput = properties.querySelector('#trigger-radius-input');
              const onceInput = properties.querySelector('#trigger-once-input');

              // Parse values (with validation)
              const x = parseFloat(xInput.value) || 0;
              const y = parseFloat(yInput.value) || 0;
              const radius = parseFloat(radiusInput.value) || 1;
              const once = onceInput.checked;

              // Update node data
              nodeData.data.x = x;
              nodeData.data.y = y;
              nodeData.data.radius = radius;
              nodeData.data.once = once;

              // Mark as dirty
              this.currentGraph.dirty = true;

              // Update visual representation
              this.updateNodeVisual(nodeData);

              // Show confirmation
              this.showToast('Trigger updated', 'success');
            } catch (error) {
              console.error('Error updating trigger node:', error);
              this.showToast('Error updating trigger node', 'error');
            }
          });
        }

        // Pick location button
        const pickLocationBtn = properties.querySelector('#pick-location-btn');
        if (pickLocationBtn) {
          pickLocationBtn.addEventListener('click', () => {
            // If we have a 3D scene, enable location picking mode
            if (this.scene3D) {
              this.showToast('Location picking mode enabled', 'info');

              // Close the editor drawer temporarily
              if (this.editor) {
                this.editor.hide();
              }

              // Here you'd connect to your scene's click handler
              // For now, we'll just show a toast with instructions
              this.showToast('Click on the map to place trigger (not implemented yet)', 'info', 5000);

              // In a real implementation, you'd have code like:
              /*
              this.scene3D.enablePickingMode((position) => {
                // Update node data with picked position
                nodeData.data.x = position.x;
                nodeData.data.y = position.z; // Assuming Y is up in your world
                
                // Re-open editor and refresh
                this.openEditor();
                this.selectNode(nodeData.element);
                
                this.showToast('Location set', 'success');
              });
              */
            } else {
              this.showToast('3D scene not available for picking', 'error');
            }
          });
        }
      }

      // In setupNodePropertyHandlers method, add this for event nodes
      if (nodeData.type === 'event') {
        // Event type change handler
        const eventTypeSelect = properties.querySelector('#event-type-select');
        if (eventTypeSelect) {
          eventTypeSelect.addEventListener('change', () => {
            // Update event type
            nodeData.data.eventType = eventTypeSelect.value;

            // Reset parameters for new event type
            nodeData.data.params = {};

            // Refresh panel to show appropriate parameters
            this.selectNode(nodeData.element);
          });
        }

        // Apply button handler
        const applyBtn = properties.querySelector('#apply-event-changes');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            try {
              // Get event type value
              const eventType = eventTypeSelect ? eventTypeSelect.value : nodeData.data.eventType;

              // Get parameters based on event type
              const params = {};

              switch (eventType) {
                case 'giveItem':
                  const selectItemBtn = properties.querySelector('#select-item-btn');
                  if (selectItemBtn) {
                    selectItemBtn.addEventListener('click', () => {
                      this.showPropsSelector(nodeData);
                    });
                  }

                  // Make sure we capture the horizontal flag for our item
                  const applyBtn = properties.querySelector('#apply-event-changes');
                  if (applyBtn) {
                    // We'll enhance the existing apply handler by adding the horizontal flag
                    applyBtn.addEventListener('click', () => {
                      // Make sure we save the current horizontal flag state when updating
                      if (nodeData.data.eventType === 'giveItem') {
                        const horizontalCheckbox = properties.querySelector('#item-horizontal-input');
                        if (horizontalCheckbox && nodeData.data.params) {
                          nodeData.data.params.isHorizontal = horizontalCheckbox.checked;
                        }
                      }
                    });
                  }
                  break;

                case 'setFlag':
                  const flagNameInput = properties.querySelector('#flag-name-input');
                  const flagValueInput = properties.querySelector('#flag-value-input');

                  params.flag = flagNameInput ? flagNameInput.value.trim() : '';
                  params.value = flagValueInput ? flagValueInput.value === 'true' : true;
                  break;

                case 'teleport':
                  const xInput = properties.querySelector('#teleport-x-input');
                  const yInput = properties.querySelector('#teleport-y-input');
                  const zInput = properties.querySelector('#teleport-z-input');

                  params.x = xInput ? parseFloat(xInput.value) || 0 : 0;
                  params.y = yInput ? parseFloat(yInput.value) || 0 : 0;
                  params.z = zInput ? parseFloat(zInput.value) || 0 : 0;
                  break;
              }

              // Update node data
              nodeData.data.eventType = eventType;
              nodeData.data.params = params;

              // Mark as dirty
              this.currentGraph.dirty = true;

              // Update visual representation
              this.updateNodeVisual(nodeData);

              // Show confirmation
              this.showToast('Event updated', 'success');
            } catch (error) {
              console.error('Error updating event node:', error);
              this.showToast('Error updating event node', 'error');
            }
          });
        }

        // Special event type specific handlers
        switch (nodeData.data.eventType) {
          case 'teleport':
            const pickLocationBtn = properties.querySelector('#pick-teleport-location-btn');
            if (pickLocationBtn) {
              pickLocationBtn.addEventListener('click', () => {
                this.showToast('Location picking not implemented yet', 'info');
                // Similar to trigger location picking
              });
            }
            break;

          // case 'giveItem':
          //   const selectItemBtn = properties.querySelector('#select-item-btn');
          //   if (selectItemBtn) {
          //     selectItemBtn.addEventListener('click', () => {
          //       this.showToast('Item browser not implemented yet', 'info');
          //       // Would connect to an item database browser
          //     });
          //   }
          //   break;

          case 'giveItem':
            const selectItemBtn = properties.querySelector('#select-item-btn');
            if (selectItemBtn) {
              selectItemBtn.addEventListener('click', () => {
                this.showResourceSelector(nodeData, 'textures', 'props', (resourceId, resource) => {
                  // Update node data with selected item
                  if (!nodeData.data.params) {
                    nodeData.data.params = {};
                  }
                  
                  nodeData.data.params.itemId = resourceId;
                  nodeData.data.params.itemName = resource.name;
                  nodeData.data.params.y = 0; // Set default y to 0 for ground placement
                  nodeData.data.params.isHorizontal = true; // Default to horizontal orientation
                  
                  // Mark as dirty
                  this.currentGraph.dirty = true;
          
                  // Refresh properties panel
                  this.selectNode(nodeData.element);
          
                  // Show confirmation
                  this.showToast(`Item "${resource.name}" selected`, 'success');
                });
              });
            }
            break;


        }
      }

// Add this to your setupNodePropertyHandlers method
// This goes in the if-else chain where other node types are handled

if (nodeData.type === 'condition') {
  // Condition type change handler
  const conditionTypeSelect = properties.querySelector('#condition-type-select');
  if (conditionTypeSelect) {
    conditionTypeSelect.addEventListener('change', () => {
      // Update condition type
      nodeData.data.condition = conditionTypeSelect.value;
      
      // Reset parameters for new condition type
      nodeData.data.params = {};
      
      // Refresh panel to show appropriate parameters
      this.selectNode(nodeData.element);
    });
  }
  
  // Apply button handler
  const applyBtn = properties.querySelector('#apply-condition-changes');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      try {
        // Get condition type value
        const condition = conditionTypeSelect ? conditionTypeSelect.value : nodeData.data.condition;
        
        // Get parameters based on condition type
        const params = {};
        
        switch (condition) {
          case 'hasMonster':
            // Keep existing monster data
            if (nodeData.data.params?.monsterId) {
              params.monsterId = nodeData.data.params.monsterId;
              params.monsterName = nodeData.data.params.monsterName;
            }
            break;
            
          case 'hasItem':
            // Keep existing item data, update quantity
            if (nodeData.data.params?.itemId) {
              params.itemId = nodeData.data.params.itemId;
              params.itemName = nodeData.data.params.itemName;
            }
            
            const quantityInput = properties.querySelector('#item-quantity-input');
            params.quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
            break;
            
          case 'hasFlag':
            const flagNameInput = properties.querySelector('#flag-name-input');
            const flagValueInput = properties.querySelector('#flag-value-input');
            
            params.flag = flagNameInput ? flagNameInput.value.trim() : '';
            params.value = flagValueInput ? flagValueInput.value === 'true' : true;
            break;
            
          case 'monsterLevel':
            // Keep existing monster data, update level
            if (nodeData.data.params?.monsterId) {
              params.monsterId = nodeData.data.params.monsterId;
              params.monsterName = nodeData.data.params.monsterName;
            }
            
            const levelInput = properties.querySelector('#monster-level-input');
            params.level = levelInput ? parseInt(levelInput.value) || 1 : 1;
            break;
            
          case 'playerLevel':
            // Note: This will be replaced later with something more fitting
            const playerLevelInput = properties.querySelector('#player-level-input');
            params.level = playerLevelInput ? parseInt(playerLevelInput.value) || 1 : 1;
            break;
        }
        
        // Update node data
        nodeData.data.condition = condition;
        nodeData.data.params = params;
        
        // Mark as dirty
        this.currentGraph.dirty = true;
        
        // Update visual representation
        this.updateNodeVisual(nodeData);
        
        // Show confirmation
        this.showToast('Condition updated', 'success');
      } catch (error) {
        console.error('Error updating condition node:', error);
        this.showToast('Error updating condition node', 'error');
      }
    });
  }
  
  // Resource selection handlers based on condition type
  switch (nodeData.data.condition) {
    case 'hasMonster':
    case 'monsterLevel':
      const selectMonsterBtn = properties.querySelector('#select-monster-btn');
      if (selectMonsterBtn) {
        selectMonsterBtn.addEventListener('click', () => {
          this.showResourceSelector(nodeData, 'bestiary', '', (monsterId, monster) => {
            // Update node data with selected monster
            if (!nodeData.data.params) {
              nodeData.data.params = {};
            }
            
            nodeData.data.params.monsterId = monsterId;
            nodeData.data.params.monsterName = monster.name;
            
            // Mark as dirty
            this.currentGraph.dirty = true;

            // Refresh properties panel
            this.selectNode(nodeData.element);

            // Show confirmation
            this.showToast(`Monster "${monster.name}" selected`, 'success');
          });
        });
      }
      break;
      
    case 'hasItem':
      const selectItemBtn = properties.querySelector('#select-item-btn');
      if (selectItemBtn) {
        selectItemBtn.addEventListener('click', () => {
          this.showResourceSelector(nodeData, 'textures', 'props', (itemId, item) => {
            // Update node data with selected item
            if (!nodeData.data.params) {
              nodeData.data.params = {};
            }
            
            nodeData.data.params.itemId = itemId;
            nodeData.data.params.itemName = item.name;
            
            // Mark as dirty
            this.currentGraph.dirty = true;

            // Refresh properties panel
            this.selectNode(nodeData.element);

            // Show confirmation
            this.showToast(`Item "${item.name}" selected`, 'success');
          });
        });
      }
      break;
  }
}





      // Add handlers for other node types as needed...
    }

    /**
     * old working method to update a node's visual appearance based on its data
     */
//     updateNodeVisual(nodeData) {
//       if (!nodeData || !nodeData.element) return;

//       const element = nodeData.element;
    
//       // Update title in header
//       const header = element.querySelector('.storyboard-node-header');
//       if (header) {
//         // Get the text node (first child)
//         let textNode = null;
//         for (const child of header.childNodes) {
//           if (child.nodeType === Node.TEXT_NODE) {
//             textNode = child;
//             break;
//           }
//         }

//         if (textNode) {
//           textNode.nodeValue = nodeData.data.title || nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1);
//         } else {
//           // If no text node found, insert one at the beginning
//           const closeButton = header.querySelector('.storyboard-node-close');
//           if (closeButton) {
//             header.insertBefore(
//               document.createTextNode(nodeData.data.title || nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)),
//               closeButton
//             );
//           }
//         }
//       }

//       const body = element.querySelector('.storyboard-node-body');
//       if (body) {
//         // Declare variables once at the top level
//         let description = '';
//         let eventTypeName = '';
//         let conditionName = '';
//         let itemName = '';
//         let quantity = 0;
//         let orientation = '';
        
//         switch (nodeData.type) {
//           case 'dialog':
//             body.innerHTML = `<div>${nodeData.data.text || ''}</div>`;
//             if (nodeData.data.image) {
//               body.innerHTML += `
//                   <div style="margin-top: 4px; font-size: 0.8em; color: #888;">
//                     <span class="material-icons" style="font-size: 14px; vertical-align: middle;">image</span>
//                     Image attached
//                   </div>
//                 `;
//             }
//             break;

//           // In the updateNodeVisual method, update the case for choice nodes
//           case 'choice':
//             body.innerHTML = `
//     <div>${nodeData.data.text || 'What would you like to do?'}</div>
//     <div style="margin-top: 4px; color: #aaa; font-size: 0.9em;">
//       ${nodeData.data.options?.length || 0} options
//     </div>
//   `;
//             break;

//           // In the updateNodeVisual method, update the case for trigger nodes
//           case 'trigger':
//             body.innerHTML = `
//     <div>Position: X=${nodeData.data.x.toFixed(1)}, Y=${nodeData.data.y.toFixed(1)}</div>
//     <div>Radius: ${nodeData.data.radius.toFixed(1)}</div>
//     <div style="margin-top: 4px; font-size: 0.9em; color: ${nodeData.data.once ? '#4CAF50' : '#FFC107'};">
//       ${nodeData.data.once ? 'Triggers once' : 'Triggers repeatedly'}
//     </div>
//   `;
//             break;

//           // In the updateNodeVisual method, update the case for event nodes
//           case 'event':
//             // Get a human-readable event type name
//             let eventTypeName = '';
//             switch (nodeData.data.eventType) {
//               case 'offerStarter': eventTypeName = 'Offer Starter Monster'; break;
//               case 'showPartyManager': eventTypeName = 'Show Party Manager'; break;
//               case 'giveItem': eventTypeName = 'Give Item'; break;
//               case 'setFlag': eventTypeName = 'Set Flag'; break;
//               case 'teleport': eventTypeName = 'Teleport Player'; break;
//               default: eventTypeName = nodeData.data.eventType || 'Unknown';
//             }

//             // Build description based on event type
//             let description = '';
//             switch (nodeData.data.eventType) {
//               case 'giveItem':
//                 const itemName = nodeData.data.params?.itemName || nodeData.data.params?.itemId || 'Not set';
//                 const quantity = nodeData.data.params?.quantity || 1;
//                 const orientation = nodeData.data.params?.isHorizontal ? 'Horizontal' : 'Vertical';
//                 description = `Item: ${itemName}, Qty: ${quantity}, ${orientation}`;
//                 break;
//               case 'setFlag':
//                 description = `Flag: ${nodeData.data.params?.flag || 'Not set'} = ${nodeData.data.params?.value ? 'True' : 'False'}`;
//                 break;
//               case 'teleport':
//                 const x = nodeData.data.params?.x || 0;
//                 const y = nodeData.data.params?.y || 0;
//                 const z = nodeData.data.params?.z || 0;
//                 description = `Position: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
//                 break;
//             }

//             body.innerHTML = `
//     <div>${eventTypeName}</div>
//     ${description ? `<div style="margin-top: 4px; font-size: 0.9em; color: #aaa;">${description}</div>` : ''}
//   `;
//             break;

// // condition method goes here




//           // Other node types...
//         }
//       }
//     }

updateNodeVisual(nodeData) {
  if (!nodeData || !nodeData.element) return;

  const element = nodeData.element;

  // Update title in header
  const header = element.querySelector('.storyboard-node-header');
  if (header) {
    // Get the text node (first child)
    let textNode = null;
    for (const child of header.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        textNode = child;
        break;
      }
    }

    if (textNode) {
      textNode.nodeValue = nodeData.data.title || nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1);
    } else {
      // If no text node found, insert one at the beginning
      const closeButton = header.querySelector('.storyboard-node-close');
      if (closeButton) {
        header.insertBefore(
          document.createTextNode(nodeData.data.title || nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)),
          closeButton
        );
      }
    }
  }

  const body = element.querySelector('.storyboard-node-body');
  if (body) {
    // Declare variables once at the top level
    let description = '';
    let eventTypeName = '';
    let conditionName = '';
    let itemName = '';
    let quantity = 0;
    let orientation = '';
    let x, y, z;
    
    switch (nodeData.type) {
      case 'dialog':
        body.innerHTML = `<div>${nodeData.data.text || ''}</div>`;
        if (nodeData.data.image) {
          body.innerHTML += `
              <div style="margin-top: 4px; font-size: 0.8em; color: #888;">
                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">image</span>
                Image attached
              </div>
            `;
        }
        break;

      // In the updateNodeVisual method, update the case for choice nodes
      case 'choice':
        body.innerHTML = `
<div>${nodeData.data.text || 'What would you like to do?'}</div>
<div style="margin-top: 4px; color: #aaa; font-size: 0.9em;">
  ${nodeData.data.options?.length || 0} options
</div>
`;
        break;

      // In the updateNodeVisual method, update the case for trigger nodes
      case 'trigger':
        body.innerHTML = `
<div>Position: X=${nodeData.data.x.toFixed(1)}, Y=${nodeData.data.y.toFixed(1)}</div>
<div>Radius: ${nodeData.data.radius.toFixed(1)}</div>
<div style="margin-top: 4px; font-size: 0.9em; color: ${nodeData.data.once ? '#4CAF50' : '#FFC107'};">
  ${nodeData.data.once ? 'Triggers once' : 'Triggers repeatedly'}
</div>
`;
        break;

      // In the updateNodeVisual method, update the case for event nodes
      case 'event':
        // Get a human-readable event type name - reuse variables from above
        eventTypeName = '';
        switch (nodeData.data.eventType) {
          case 'offerStarter': eventTypeName = 'Offer Starter Monster'; break;
          case 'showPartyManager': eventTypeName = 'Show Party Manager'; break;
          case 'giveItem': eventTypeName = 'Give Item'; break;
          case 'setFlag': eventTypeName = 'Set Flag'; break;
          case 'teleport': eventTypeName = 'Teleport Player'; break;
          default: eventTypeName = nodeData.data.eventType || 'Unknown';
        }

        // Build description based on event type - reuse variables from above
        description = '';
        switch (nodeData.data.eventType) {
          case 'giveItem':
            itemName = nodeData.data.params?.itemName || nodeData.data.params?.itemId || 'Not set';
            quantity = nodeData.data.params?.quantity || 1;
            orientation = nodeData.data.params?.isHorizontal ? 'Horizontal' : 'Vertical';
            description = `Item: ${itemName}, Qty: ${quantity}, ${orientation}`;
            break;
          case 'setFlag':
            description = `Flag: ${nodeData.data.params?.flag || 'Not set'} = ${nodeData.data.params?.value ? 'True' : 'False'}`;
            break;
          case 'teleport':
            x = nodeData.data.params?.x || 0;
            y = nodeData.data.params?.y || 0;
            z = nodeData.data.params?.z || 0;
            description = `Position: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
            break;
        }

        body.innerHTML = `
<div>${eventTypeName}</div>
${description ? `<div style="margin-top: 4px; font-size: 0.9em; color: #aaa;">${description}</div>` : ''}
`;
        break;

        case 'condition':
          // Get a human-readable condition type name - reuse variables from above
          conditionName = '';
          switch (nodeData.data.condition) {
            case 'hasMonster': conditionName = 'Has Monster'; break;
            case 'hasItem': conditionName = 'Has Item'; break;
            case 'hasFlag': conditionName = 'Has Flag'; break;
            case 'monsterLevel': conditionName = 'Monster Level'; break;
            case 'playerLevel': conditionName = 'Player Level'; break;
            default: conditionName = nodeData.data.condition || 'Unknown';
          }
          
          // Build description based on condition type - reuse variables from above
          description = '';
          switch (nodeData.data.condition) {
            case 'hasMonster':
              description = `Monster: ${nodeData.data.params?.monsterName || 'Not set'}`;
              break;
            case 'hasItem':
              description = `Item: ${nodeData.data.params?.itemName || 'Not set'}, Qty: ${nodeData.data.params?.quantity || 1}`;
              break;
            case 'hasFlag':
              description = `Flag: ${nodeData.data.params?.flag || 'Not set'} = ${nodeData.data.params?.value ? 'True' : 'False'}`;
              break;
            case 'monsterLevel':
              description = `Monster: ${nodeData.data.params?.monsterName || 'Not set'}, Level: ${nodeData.data.params?.level || 1}+`;
              break;
            case 'playerLevel':
              description = `Level: ${nodeData.data.params?.level || 1}+`;
              break;
          }
          
          body.innerHTML = `
  <div style="display: flex; align-items: center; gap: 6px;">
    <span class="material-icons" style="font-size: 18px; color: #FFC107;">help</span>
    <span>${conditionName}</span>
  </div>
  ${description ? `<div style="margin-top: 4px; font-size: 0.9em; color: #aaa;">${description}</div>` : ''}
  <div style="margin-top: 8px; font-size: 0.8em; color: #2196F3;">
    <span class="material-icons" style="font-size: 12px; vertical-align: middle;">arrow_forward</span> 
    First branch: If true
  </div>
  <div style="font-size: 0.8em; color: #F44336;">
    <span class="material-icons" style="font-size: 12px; vertical-align: middle;">arrow_forward</span> 
    Second branch: If false
  </div>
  `;
          break;
      // Other node types...





      default:
        body.innerHTML = '<div>Configure node</div>';
    }
  }
}



/**
 * Show a unified resource selector for various resource types
 * @param {Object} nodeData - The node data to update with selection
 * @param {string} resourceType - Main resource type: 'textures', 'sounds', 'splashArt', 'bestiary'
 * @param {string} category - Subcategory within the resource type: 'props', 'walls', 'ambient', 'title', etc.
 * @param {Function} onSelect - Callback function when item is selected (receives resourceId and resource)
 */
showResourceSelector(nodeData, resourceType, category, onSelect) {
  if (!this.resourceManager || !nodeData) {
    console.error('ResourceManager not available for resource selection');
    this.showToast('Resource Manager not available', 'error');
    return;
  }

  // Create drawer for resource selection
  const drawer = document.createElement('sl-drawer');
  drawer.label = `Select ${category.charAt(0).toUpperCase() + category.slice(1)}`;
  drawer.placement = 'bottom';
  drawer.style.cssText = '--size: 70vh;';
  
  // Add classes for styling
  drawer.classList.add('storyboard-drawer');
  drawer.classList.add('resource-selector-drawer');

  // Add styles for this specific drawer
  const selectorStyles = document.createElement('style');
  selectorStyles.textContent = `
    .resource-selector-drawer::part(overlay) {
      left: 280px !important;
      width: calc(100% - 280px) !important;
    }
    
    .resource-selector-drawer::part(panel) {
      background: #242424;
      color: #e0e0e0;
      left: 280px !important;
      width: calc(100% - 280px) !important;
      max-width: none !important;
      margin-left: 0 !important;
      border-radius: 8px 0 0 0 !important;
    }
    
.resource-selector-drawer::part(header) {
  background: #333;
  border-bottom: 1px solid #444;
  height: 48px;
  padding: 0 16px; /* Reduce padding */
  display: flex;
  align-items: center; /* Vertically center content */
}

/* Target the title specifically */
.resource-selector-drawer::part(title) {
  font-size: 1rem; /* Slightly smaller font */
  white-space: nowrap; /* Prevent wrapping */
  overflow: hidden;
  text-overflow: ellipsis; /* Add ellipsis for long titles */
}

/* Adjust the close button */
.resource-selector-drawer::part(close-button) {
  margin-left: 8px; /* Less margin */
  padding: 8px; /* Smaller click target but still usable */
}
    
    .resource-selector-drawer::part(body) {
      padding: 0;
    }
    
    .resource-selector-drawer::part(footer) {
      background: #333;
      border-top: 1px solid #444;
    }
    
    .resource-selector-drawer .resource-item {
      cursor: pointer;
      border: 1px solid #444;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s ease;
      background: #333;
    }
    
    .resource-selector-drawer .resource-item:hover {
      border-color: #673ab7;
      transform: translateY(-2px);
    }
  `;
  document.head.appendChild(selectorStyles);

  // Get resources from resource manager
  let resources = [];
  
  if (resourceType === 'textures') {
    const resourceMap = this.resourceManager.resources.textures[category];
    if (resourceMap && resourceMap.size > 0) {
      resources = Array.from(resourceMap.entries()).map(([id, resource]) => ({
        id,
        name: resource.name || 'Unnamed',
        thumbnail: resource.thumbnail,
        data: resource
      }));
    }
  } else if (resourceType === 'sounds') {
    const resourceMap = this.resourceManager.resources.sounds[category];
    if (resourceMap && resourceMap.size > 0) {
      resources = Array.from(resourceMap.entries()).map(([id, resource]) => ({
        id,
        name: resource.name || 'Unnamed',
        duration: resource.duration || 0,
        data: resource
      }));
    }
  } else if (resourceType === 'splashArt') {
    const resourceMap = this.resourceManager.resources.splashArt[category];
    if (resourceMap && resourceMap.size > 0) {
      resources = Array.from(resourceMap.entries()).map(([id, resource]) => ({
        id,
        name: resource.name || 'Unnamed',
        thumbnail: resource.thumbnail,
        data: resource
      }));
    }
  } else if (resourceType === 'bestiary') {
    const resourceMap = this.resourceManager.resources.bestiary;
    if (resourceMap && resourceMap.size > 0) {
      resources = Array.from(resourceMap.entries()).map(([id, resource]) => ({
        id,
        name: resource.name || 'Unnamed',
        thumbnail: resource.thumbnail,
        cr: resource.cr,
        type: resource.type,
        data: resource
      }));
    }
  }

  // Customize item rendering based on resource type
  let itemRenderer;
  
  if (resourceType === 'textures' || resourceType === 'splashArt') {
    // For visual resources
    itemRenderer = (resource) => `
      <div class="resource-item" data-id="${resource.id}" style="height: 100%;">
        <div style="height: 120px; overflow: hidden;">
          <img src="${resource.thumbnail}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div style="padding: 8px;">
          <div style="font-weight: 500; word-break: break-word;">${resource.name}</div>
        </div>
      </div>
    `;
  } else if (resourceType === 'sounds') {
    // For sound resources
    itemRenderer = (resource) => `
      <div class="resource-item" data-id="${resource.id}" style="height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; padding: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div class="material-icons" style="font-size: 32px; margin-bottom: 8px; color: #673ab7;">music_note</div>
          <div style="margin-bottom: 4px; text-align: center;">${resource.name}</div>
          <div style="font-size: 0.8em; color: #aaa;">${this.formatDuration(resource.duration)}</div>
        </div>
        <div style="padding: 8px; border-top: 1px solid #444; text-align: center;">
          <sl-button size="small" class="play-sound-btn" data-id="${resource.id}">
            <span class="material-icons" style="font-size: 16px;">play_arrow</span>
            Play
          </sl-button>
        </div>
      </div>
    `;
  } else if (resourceType === 'bestiary') {
    // For bestiary resources
    itemRenderer = (resource) => `
      <div class="resource-item" data-id="${resource.id}" style="height: 100%;">
        <div style="height: 120px; overflow: hidden;">
          <img src="${resource.thumbnail}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div style="padding: 8px;">
          <div style="font-weight: 500; word-break: break-word;">${resource.name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #aaa; margin-top: 4px;">
            <span>CR ${resource.cr || '?'}</span>
            <span>${resource.type || 'Monster'}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Add drawer content
  drawer.innerHTML = `
    <div style="padding: 16px;">
      <div style="margin-bottom: 16px;">
        <sl-input placeholder="Search..." clearable id="resource-search"></sl-input>
      </div>
      
      <div class="resources-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
        max-height: calc(70vh - 140px);
        overflow-y: auto;
        padding-right: 8px;
      ">
        ${resources.length > 0 ?
          resources.map(resource => itemRenderer(resource)).join('') :
          `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">
            No ${category} available. Add some in the Resource Manager.
          </div>`
        }
      </div>
    </div>
    
    <div slot="footer" style="display: flex; justify-content: space-between; align-items: center;">
      <sl-button variant="text">Cancel</sl-button>
      <div style="color: #aaa; font-size: 0.9em;">
        ${resources.length} items available
      </div>
    </div>
  `;

  document.body.appendChild(drawer);
  drawer.show();

  // Set up search functionality
  const searchInput = drawer.querySelector('#resource-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      drawer.querySelectorAll('.resource-item').forEach(item => {
        const nameElement = item.querySelector('div > div');
        if (!nameElement) return;
        
        const name = nameElement.textContent.toLowerCase();

        // Show/hide based on search term
        if (name.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Set up sound play buttons if needed
  if (resourceType === 'sounds') {
    drawer.querySelectorAll('.play-sound-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't select when just playing
        const soundId = button.getAttribute('data-id');
        this.resourceManager.playSound(soundId, category);
      });
    });
  }

  // Set up item selection
  drawer.querySelectorAll('.resource-item').forEach(item => {
    item.addEventListener('click', () => {
      const resourceId = item.getAttribute('data-id');
      let resource;
      
      // Get the selected resource based on resource type
      if (resourceType === 'textures') {
        resource = this.resourceManager.resources.textures[category].get(resourceId);
      } else if (resourceType === 'sounds') {
        resource = this.resourceManager.resources.sounds[category].get(resourceId);
      } else if (resourceType === 'splashArt') {
        resource = this.resourceManager.resources.splashArt[category].get(resourceId);
      } else if (resourceType === 'bestiary') {
        resource = this.resourceManager.resources.bestiary.get(resourceId);
      }

      if (resource) {
        // Use callback for selection if provided
        if (typeof onSelect === 'function') {
          onSelect(resourceId, resource);
        }
        
        // Close drawer
        drawer.hide();
      }
    });
  });

  // Set up cancel button
  const cancelBtn = drawer.querySelector('sl-button[variant="text"]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      drawer.hide();
    });
  }

  // Clean up when drawer is closed
  drawer.addEventListener('sl-after-hide', () => {
    drawer.remove();
    selectorStyles.remove();
  });
}

// Helper method to format sound duration
formatDuration(seconds) {
  if (!seconds) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

    /**
* Simplified toast notification method
*/
    showToast(message, type = 'info', duration = 3000) {
      // Create toast element
      const toast = document.createElement('div');
      toast.className = 'storyboard-toast';
      toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.3s;
  `;

      toast.textContent = message;
      document.body.appendChild(toast);

      // Animate in
      setTimeout(() => {
        toast.style.opacity = '1';
      }, 10);

      // Remove after duration
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, duration);
    }

    /**
     * Helper method to get splash art URL
     */
    getSplashArtUrl(imageData) {
      if (!imageData || !this.resourceManager) return '';

      try {
        const { id, category } = imageData;
        const art = this.resourceManager.resources.splashArt[category]?.get(id);

        return art?.thumbnail || '';
      } catch (error) {
        console.error('Error getting splash art URL:', error);
        return '';
      }
    }

    /**
     * Deselect the current node
     */
    deselectNode() {
      if (!this.isEditorAvailable()) return;

      if (this.editorState.selectedNode) {
        this.editorState.selectedNode.classList.remove('selected');
        this.editorState.selectedNode = null;
      }

      const properties = this.editorState.propertiesElement;
      if (properties) {
        properties.innerHTML = `
          <div class="story-no-selection">
            <p>Select a node to edit its properties.</p>
          </div>
        `;
      }
    }

    /**
     * Update a node's property based on input change
     */
    updateNodeProperty(nodeData, input) {
      if (!nodeData || !input) return;

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

      // Mark as dirty
      this.currentGraph.dirty = true;

      // Update node display if element exists
      if (nodeData.element) {
        // Update body content based on node type
        const body = nodeData.element.querySelector('.storyboard-node-body');
        if (!body) return;

        if (nodeData.type === 'dialog') {
          body.textContent = nodeData.data.text || '';
        } else if (nodeData.type === 'choice') {
          body.innerHTML = `
            <div>${nodeData.data.text || ''}</div>
            <div style="color:#777;font-size:0.9em;">${nodeData.data.options?.length || 0} options</div>
          `;
        } else if (nodeData.type === 'trigger') {
          body.textContent = `X: ${nodeData.data.x || 0}, Y: ${nodeData.data.y || 0}, Radius: ${nodeData.data.radius || 1}`;
        }
      }
    }


    /**
     * Save the current storyboard
     */
    saveStoryboard(editorState) {
      if (!this.isEditorAvailable()) {
        console.error('Editor not available in saveStoryboard');
        return;
      }

      // Convert editor state to story graph data
      const storyGraph = {
        nodes: [],
        connections: []
      };

      // Add nodes from persistent state
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

      // Add connections from persistent state
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

  // // Create global instance when script loads
  // window.initStoryboard = (scene3D, resourceManager) => {
  //   window.storyboard = new Storyboard(scene3D, resourceManager);
  //   return window.storyboard;
  // };




};
// Create global instance when script loads
window.initStoryboard = (scene3D, resourceManager) => {
  window.storyboard = new window.Storyboard(scene3D, resourceManager);
  return window.storyboard;
};