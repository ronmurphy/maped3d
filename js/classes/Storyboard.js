/**
 * Storyboard.js - Node-based story and event management system for the game
 * Handles creation, editing, and execution of narrative flows and game events
 */

// Check if Storyboard already exists to prevent redeclaration
if (typeof window.Storyboard === 'undefined') {
  /**
   * Storyboard.js - Node-based story and event management system for the game
   * Handles creation, editing, and execution of narrative flows and game events
   */
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

    testResourceManager() {
      if (!this.resourceManager) {
        console.error('Resource Manager not available');
        return false;
      }
      
      // Check essential structures
      if (!this.resourceManager.resources || 
          !this.resourceManager.resources.splashArt) {
        console.error('Resource Manager missing essential structures');
        return false;
      }
      
      return true;
    }

    /**
     * Initialize CSS styles for story displays
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
    
        // Create and attach the drawer synchronously
        const drawer = document.createElement('sl-drawer');
        drawer.label = 'Storyboard Editor';
        drawer.placement = 'end';
        drawer.style.cssText = '--size: calc(100vw - 260px);';
        document.body.appendChild(drawer);

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
    
        // Set up close button handler
        drawer.querySelector('#sb-close-btn').addEventListener('click', () => {
          this.saveCurrentGraph(); // Save before closing
          this.editorState.active = false;
          drawer.hide();
        });
        
        // Show the drawer
        drawer.show();
        
        // Initialize functionality directly after showing
        drawer.addEventListener('sl-after-show', () => {
          // Find key elements
          const canvas = drawer.querySelector('#storyboard-canvas');
          const properties = drawer.querySelector('#storyboard-properties');
          
          if (!canvas || !properties) {
            console.error('Required elements not found');
            return;
          }
          
          // Store references
          this.editorState.canvasElement = canvas;
          this.editorState.propertiesElement = properties;
          
          // Set up tools, canvas interactions, etc.
          this.setupToolButtons();
          this.setupCanvasInteractions(canvas, properties);
          this.restoreNodesFromData(canvas);
        });
      } catch (error) {
        console.error('Error opening editor:', error);
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
                  <sl-textarea id="dialog-text-input" name="text" rows="4">${nodeData.data.text || ''}</sl-textarea>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Image</div>
                <div class="storyboard-property-field">
                  <sl-button id="select-image-btn" size="small">Select Image</sl-button>
                  ${nodeData.data.image ? `
                    <div class="selected-image-preview" style="margin-top: 8px; position: relative;">
                      <img src="${this.getSplashArtUrl(nodeData.data.image)}" 
                           style="max-width: 100%; max-height: 100px; border-radius: 4px;">
                      <sl-button size="small" class="remove-image-btn" style="position: absolute; top: 4px; right: 4px;">
                        <span class="material-icons" style="font-size: 16px;">close</span>
                      </sl-button>
                    </div>
                  ` : ''}
                </div>
              </div>
              
              <div class="storyboard-property-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
                <sl-button id="apply-dialog-changes" variant="primary">Apply Changes</sl-button>
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
            propertiesHtml = `
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Condition Type</div>
                <div class="storyboard-property-field">
                  <sl-select name="condition">
                    <sl-option value="none">Select Condition Type</sl-option>
                    <sl-option value="hasMonster" ?selected="${nodeData.data.condition === 'hasMonster'}">Has Monster</sl-option>
                    <sl-option value="hasItem" ?selected="${nodeData.data.condition === 'hasItem'}">Has Item</sl-option>
                    <sl-option value="hasFlag" ?selected="${nodeData.data.condition === 'hasFlag'}">Has Flag</sl-option>
                    <sl-option value="monsterLevel" ?selected="${nodeData.data.condition === 'monsterLevel'}">Monster Level</sl-option>
                  </sl-select>
                </div>
              </div>
              
              <div class="storyboard-property-group">
                <div class="storyboard-property-label">Condition Parameters</div>
                <div class="storyboard-property-field">
                  <p style="color:#777; font-size:0.9em;">Parameters will be displayed based on selected condition type.</p>
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

        properties.innerHTML = `
            <div class="storyboard-properties-content" data-node-id="${nodeId}">
              <h3 style="margin-top:0;">${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)} Node</h3>
              ${propertiesHtml}
            </div>
          `;

        // Set up node-specific event handlers
        this.setupNodePropertyHandlers(nodeData, nodeId, properties);
      }
    }

    /**
     * New method to set up property handlers for different node types
     */
    setupNodePropertyHandlers(nodeData, nodeId, properties) {
      if (!properties || !nodeData) return;

      // Handle dialog node properties
      if (nodeData.type === 'dialog') {
        // Apply button handler
        const applyBtn = properties.querySelector('#apply-dialog-changes');
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            // Get current values from inputs
            const titleInput = properties.querySelector('#dialog-title-input');
            const textInput = properties.querySelector('#dialog-text-input');
          
            if (titleInput && textInput) {
              // Update node data
              nodeData.data.title = titleInput.value.trim();
              nodeData.data.text = textInput.value.trim();
              
              // The image is already stored in nodeData.data.image
              // when selected in showSplashArtSelector
              
              // Update node visual representation
              this.updateNodeVisual(nodeData);
              
              // Mark as dirty for saving
              this.currentGraph.dirty = true;
              
              this.showToast('Node updated', 'success');
            }
          });
        }

        // Select image button handler
        const selectImageBtn = properties.querySelector('#select-image-btn');
        if (selectImageBtn) {
          selectImageBtn.addEventListener('click', () => {
            this.showSplashArtSelector(nodeData);
          });
        }

        // Remove image button handler
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

      // Add handlers for choice nodes
      else if (nodeData.type === 'choice') {
        // Add option button
        const addOptionBtn = properties.querySelector('.add-option');
        if (addOptionBtn) {
          addOptionBtn.addEventListener('click', () => {
            nodeData.data.options.push({ text: 'New Option', targetId: null });
            this.currentGraph.dirty = true;
            this.selectNode(nodeData.element); // Refresh properties panel
          });
        }

        // Delete option buttons
        const deleteOptionBtns = properties.querySelectorAll('.delete-option');
        deleteOptionBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-index'));
            nodeData.data.options.splice(index, 1);
            this.currentGraph.dirty = true;
            this.selectNode(nodeData.element); // Refresh properties panel
          });
        });
      }

      // Add handlers for other node types as needed...
    }

    /**
     * New method to update a node's visual appearance based on its data
     */
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

      // Update content in body based on node type
      const body = element.querySelector('.storyboard-node-body');
      if (body) {
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

          case 'choice':
            body.innerHTML = `
                <div>${nodeData.data.text || ''}</div>
                <div style="color:#777;font-size:0.9em;">${nodeData.data.options?.length || 0} options</div>
              `;
            break;

          case 'trigger':
            body.innerHTML = `<div>X: ${nodeData.data.x || 0}, Y: ${nodeData.data.y || 0}, Radius: ${nodeData.data.radius || 1}</div>`;
            break;

          case 'event':
            body.innerHTML = `<div>Event: ${nodeData.data.eventType || 'none'}</div>`;
            break;

          // Other node types...
        }
      }
    }

    /**
     * New method to show a splash art selector
     */
    showSplashArtSelector(nodeData) {
      if (!this.resourceManager || !nodeData) {
        this.showToast('Resource Manager not available', 'error');
        return;
      }
    
      // Get all splash art categories from resource manager
      let allSplashArt = [];
      
      // Get all available categories dynamically
      const categories = Object.keys(this.resourceManager.resources.splashArt || {});
      
      if (categories.length === 0) {
        this.showToast('No splash art available in resource manager', 'error');
        return;
      }
      
      categories.forEach(category => {
        const artMap = this.resourceManager.resources.splashArt[category];
        if (artMap && artMap.size > 0) {
          Array.from(artMap.entries()).forEach(([id, art]) => {
            // Check if we have usable data
            if (art && (art.thumbnail || art.data)) {
              allSplashArt.push({
                id,
                name: art.name || 'Unnamed',
                thumbnail: art.thumbnail || art.data, // Fall back to full data if no thumbnail
                data: art.data,
                category
              });
            }
          });
        }
      });

      // Add drawer content
      drawer.innerHTML = `
          <div style="padding: 16px;">
            <div style="margin-bottom: 16px;">
              <sl-input placeholder="Search splash art..." clearable id="splash-art-search"></sl-input>
            </div>
            
            <div class="splash-art-grid" style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
              gap: 16px;
              max-height: calc(70vh - 120px);
              overflow-y: auto;
              padding-right: 8px;
            ">
              ${allSplashArt.length > 0 ?
          allSplashArt.map(art => `
                  <div class="splash-art-item" data-id="${art.id}" data-category="${art.category}" style="
                    cursor: pointer;
                    border: 1px solid #444;
                    border-radius: 8px;
                    overflow: hidden;
                    transition: all 0.2s;
                    background: #333;
                  ">
                    <div style="height: 120px; overflow: hidden;">
                      <img src="${art.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="padding: 8px;">
                      <div style="font-weight: 500;">${art.name}</div>
                      <div style="font-size: 0.8em; color: #aaa;">${art.category}</div>
                    </div>
                  </div>
                `).join('') :
          `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">
                  No splash art available. Add some in the Resource Manager.
                </div>`
        }
            </div>
          </div>
          
          <div slot="footer" style="display: flex; justify-content: space-between; align-items: center;">
            <sl-button variant="text">Cancel</sl-button>
            <div style="color: #aaa; font-size: 0.9em;">
              ${allSplashArt.length} items available
            </div>
          </div>
        `;

      document.body.appendChild(drawer);
      drawer.show();

      // Set up search functionality
      const searchInput = drawer.querySelector('#splash-art-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();

          drawer.querySelectorAll('.splash-art-item').forEach(item => {
            const name = item.querySelector('div > div').textContent.toLowerCase();
            const category = item.querySelector('div > div:nth-child(2)').textContent.toLowerCase();

            // Show/hide based on search term
            if (name.includes(searchTerm) || category.includes(searchTerm)) {
              item.style.display = 'block';
            } else {
              item.style.display = 'none';
            }
          });
        });
      }

      // Set up item selection
      drawer.querySelectorAll('.splash-art-item').forEach(item => {
        item.addEventListener('click', () => {
          const artId = item.getAttribute('data-id');
          const category = item.getAttribute('data-category');

          // Update node data
          nodeData.data.image = {
            id: artId,
            category: category
          };

          // Mark as dirty
          this.currentGraph.dirty = true;

          // Update visual
          this.updateNodeVisual(nodeData);

          // Refresh properties panel
          this.selectNode(nodeData.element);

          // Close drawer
          drawer.hide();

          // Show confirmation
          this.showToast('Image added to dialog', 'success');
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
      });
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
        // Handle different image data formats
        if (typeof imageData === 'string') {
          // Direct base64 or URL
          return imageData;
        }
        
        const { id, category } = imageData;
        const art = this.resourceManager.resources.splashArt[category]?.get(id);
        
        // Return full data when available, fall back to thumbnail
        return art?.data || art?.thumbnail || '';
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
        try {
          // Get appropriate image data
          const imageUrl = this.getDialogImageUrl(dialogData.image);
          
          if (imageUrl) {
            imageHtml = `
              <div class="story-image">
                <img src="${imageUrl}" alt="Story Image" onerror="this.style.display='none'">
              </div>
            `;
          }
        } catch (error) {
          console.error('Error preparing dialog image:', error);
          // Continue without the image
        }
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

    // New helper method to get dialog images
getDialogImageUrl(imageData) {
  // Handle string URLs or base64 directly
  if (typeof imageData === 'string') {
    return imageData;
  }
  
  // Handle resource manager references
  if (imageData && imageData.id && imageData.category && this.resourceManager) {
    const resource = this.resourceManager.resources.splashArt[imageData.category]?.get(imageData.id);
    return resource?.data || resource?.thumbnail || '';
  }
  
  // Handle direct image objects
  if (imageData && imageData.data) {
    return imageData.data;
  }
  
  return '';
}

// Check if a splash art resource exists
splashArtExists(id, category) {
  if (!this.resourceManager || !id || !category) return false;
  
  const categoryMap = this.resourceManager.resources.splashArt[category];
  return categoryMap && categoryMap.has(id);
}

// Get a splash art resource safely
getSplashArt(id, category) {
  if (!this.splashArtExists(id, category)) return null;
  return this.resourceManager.resources.splashArt[category].get(id);
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




};
// Create global instance when script loads
window.initStoryboard = (scene3D, resourceManager) => {
  window.storyboard = new window.Storyboard(scene3D, resourceManager);
  return window.storyboard;
};