class MapEditor {
  constructor() {
    this.canvas = document.getElementById("mainCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.scene3D = new Scene3DController();
    this.rooms = [];
    this.baseImage = null;
    this.scale = 1;
    this.offset = { x: 0, y: 0 };
    this.isDragging = false;
    this.isResizing = false;
    this.selectedRoomId = null;
    this.currentTool = "rectangle";
    this.isDraggingMarker = false;
    this.previousTool = null;
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    this.previewPoint = null;
    this.polygonPreviewElement = null;
    this.markers = [];
    this.playerStart = null;
    this.isMarkerEditMode = false;
    this.mapName = null;
    this.layersPanel = new LayersPanel(this);
    this.originalMapName = null;
    this.monsterManager = new MonsterManager(this);
    this.dockingDistance = 5; // Distance in pixels to trigger docking
    this.dockedRooms = new Map(); // Store docked room relationships
    this.isDraggingDocked = false; // Prevent recursive drag handling
    this.isFreehandDrawing = false;
this.freehandPoints = [];
this.freehandMinDistance = 10; // Minimum distance between points (in pixels)
this.freehandPreviewElement = null;
this.lastFreehandPoint = null;
this.freehandActive = false;

    // Initialize managers in correct order
    this.resourceManager = null;  // Initialize to null first
    this.textureManager = null;   // Initialize to null first
    this.shapeForge = null;       // Initialize ShapeForge to null

    // Setup in correct order
    this.setupTitleHandlers();
    this.updateMapTitle();


    this.checkResourceManager(() => {
      console.log('ResourceManager initialized:', !!this.resourceManager);
      // Pass resourceManager to Scene3D
      this.scene3D.resourceManager = this.resourceManager;
      this.checkTextureManager(() => {
        console.log('TextureManager initialized:', !!this.textureManager);
        this.initShapeForge();
        this.setupEventListeners();
      });
    });

    this.checkStoryboard(() => {
      console.log('Storyboard initialized:', !!this.storyboard);
    });


    this.setupCanvas();
    this.calculateLayersListHeight = this.calculateLayersListHeight.bind(this);
    this.setupLayersObserver();
    setTimeout(() => this.calculateLayersListHeight(), 100);
    window.addEventListener("resize", this.calculateLayersListHeight);
    window.applyEditorPreferences = (prefs) => this.applyEditorPreferences(prefs);

    // this.fixZoomIssues();
  }


  getMapWidth() {
    // If using a background image, get its dimensions
    if (this.baseImage) {
      return this.baseImage.width;
    }
    
    // Alternative: Get the width from the map bounds
    const rooms = this.rooms || [];
    if (rooms.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      
      rooms.forEach(room => {
        const bounds = room.bounds;
        minX = Math.min(minX, bounds.x);
        maxX = Math.max(maxX, bounds.x + bounds.width);
      });
      
      return maxX - minX;
    }
    
    // Default fallback size
    return 1000;
  }
  
  getMapHeight() {
    // If using a background image, get its dimensions
    if (this.baseImage) {
      return this.baseImage.height;
    }
    
    // Alternative: Get the height from the map bounds
    const rooms = this.rooms || [];
    if (rooms.length > 0) {
      let minY = Infinity;
      let maxY = -Infinity;
      
      rooms.forEach(room => {
        const bounds = room.bounds;
        minY = Math.min(minY, bounds.y);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      });
      
      return maxY - minY;
    }
    
    // Default fallback size
    return 1000;
  }



  initShapeForge() {
    // Only initialize if ShapeForge class exists and we have the resourceManager
    if (window.ShapeForge && this.resourceManager) {
      // Check for ShaderEffectsManager
      if (window.ShaderEffectsManager) {
        // ShaderEffectsManager is globally available
        this.shaderEffectsManager = window.ShaderEffectsManager;
        this.createShapeForge();
      } else {
        // Try to load ShaderEffectsManager
        this.loadShaderEffectsManager(() => {
          this.createShapeForge();
        });
      }
    } else {
      console.warn('ShapeForge initialization skipped - missing dependencies');
    }

    // Debug code to check everything is working
console.log("ShapeForge status:", {
  isClassAvailable: !!window.ShapeForge,
  resourceManagerAvailable: !!this.resourceManager,
  shaderEffectsManagerAvailable: !!this.shaderEffectsManager,
  shapeForgeInstance: !!this.shapeForge
});

// Test ability to show ShapeForge directly
if (this.shapeForge) {
  console.log("ShapeForge instance created successfully");
  // Uncomment this to test direct showing without button click

  if (this.shapeForge) {
    const shapeForgeBtn = document.getElementById('shapeForgeBtn');
    shapeForgeBtn.addEventListener('click', () => {
      this.shapeForge.show();
        });
  }
  // this.shapeForge.show();
}

  }
  
  loadShaderEffectsManager(callback) {
    console.log("Attempting to load ShaderEffectsManager");
    const script = document.createElement('script');
    script.src = 'js/classes/ShaderEffectsManager.js';
    
    script.onload = () => {
      console.log("ShaderEffectsManager script loaded successfully");
      
      // Initialize ShaderEffectsManager if possible
      try {
        if (window.ShaderEffectsManager) {
          // If it requires a scene parameter, initialize it with scene3D
          if (this.scene3D && this.scene3D.scene) {
            this.shaderEffectsManager = new ShaderEffectsManager(this.scene3D);
          } else {
            this.shaderEffectsManager = new ShaderEffectsManager();
          }
          console.log("ShaderEffectsManager initialized");
        } else {
          console.warn("ShaderEffectsManager script loaded but class not found");
        }
      } catch (err) {
        console.error("Error initializing ShaderEffectsManager:", err);
      }
      
      if (callback) callback();
    };
    
    script.onerror = () => {
      console.warn('ShaderEffectsManager script not available');
      if (callback) callback();
    };
    
    document.head.appendChild(script);
  }
  
  createShapeForge() {
    // Create ShapeForge with available dependencies
    this.shapeForge = new ShapeForge(
      this.resourceManager, 
      this.shaderEffectsManager || null
    );
    console.log('ShapeForge initialized');

    
  }

/**
 * Modified checkStoryboard method to prevent double-loading
 */
checkStoryboard(callback) {
  const storyboardBtn = document.getElementById('storyboardTool');

  // First check if Storyboard already exists globally
  if (window.Storyboard) {
    console.log('Storyboard already loaded, initializing instance');
    this.storyboard = new window.Storyboard(this.scene3D, this.resourceManager);
    window.storyboard = this.storyboard;
    
    if (storyboardBtn) {
      storyboardBtn.setAttribute('data-tooltip', 'Story Editor [F11]');
      storyboardBtn.addEventListener('click', () => {
        this.storyboard.openEditor();
      });
    }
    
    if (callback) callback();
    return;
  }

  // Check if the script is already in the document
  if (document.querySelector('script[src="js/classes/Storyboard.js"]')) {
    console.log('Storyboard script tag already exists in document');
    // Wait a short time for the script to initialize if it hasn't already
    setTimeout(() => {
      if (window.Storyboard) {
        this.storyboard = new window.Storyboard(this.scene3D, this.resourceManager);
        window.storyboard = this.storyboard;
        
        if (storyboardBtn) {
          storyboardBtn.setAttribute('data-tooltip', 'Story Editor [F11]');
          storyboardBtn.addEventListener('click', () => {
            this.storyboard.openEditor();
          });
        }
      } else {
        console.warn('Storyboard script exists but class not defined');
      }
      
      if (callback) callback();
    }, 100);
    return;
  }

  // If we get here, we need to load the script
  console.log('Loading Storyboard script dynamically');
  const script = document.createElement('script');
  script.src = 'js/classes/Storyboard.js';
  script.onload = () => {
    // Storyboard loaded successfully
    console.log('Storyboard script loaded dynamically');
    this.storyboard = new window.Storyboard(this.scene3D, this.resourceManager);
    window.storyboard = this.storyboard;

    if (storyboardBtn) {
      storyboardBtn.setAttribute('data-tooltip', 'Story Editor [F11]');
      storyboardBtn.addEventListener('click', () => {
        this.storyboard.openEditor();
      });
    }
    if (callback) callback();
  };
  script.onerror = () => {
    console.warn('Storyboard not available');
    if (storyboardBtn) {
      storyboardBtn.style.opacity = '0.5';
      storyboardBtn.setAttribute('data-tooltip', 'Story Editor (not available)');
    }
    if (callback) callback();
  };
  document.head.appendChild(script);
}

  initStoryboard() {
    // Initialize storyboard if not already initialized
    if (!this.storyboard) {
      console.log('Initializing Storyboard from MapEditor');
      
      // Create new instance with reference to Scene3D and ResourceManager
      this.storyboard = new Storyboard(this.scene3D, this.resourceManager);
      
      // Store globally for potential access by other systems
      window.storyboard = this.storyboard;
      
      // Load any saved storyboard data
      this.storyboard.loadFromStorage();
    }
    
    return this.storyboard;
  }
  
  // Add as a method to the MapEditor class
  openStoryboardEditor() {
    // Initialize if needed
    const storyboard = this.initStoryboard();
    
    // Open the editor
    storyboard.openEditor();
  } 

    checkResourceManager(callback) {
    const resourceManagerBtn = document.getElementById('resourceManagerBtn');
  
    // Create a temporary script element to test loading
    const script = document.createElement('script');
    script.src = 'js/classes/resource-manager.js';
    script.onload = () => {
      // Resource manager loaded successfully
      this.resourceManager = new ResourceManager();
      
      // IMPORTANT: Make resourceManager available globally
      window.resourceManager = this.resourceManager;
      
      console.log("ResourceManager initialized and set globally");
  
      // Initialize MonsterManager in ResourceManager
      this.resourceManager.initializeMonsterManager(this);
      
      // Init Storyboard
      this.resourceManager.initStoryboard();
      storyboard.connectToResourceManager(this.resourceManager);
  
      if (resourceManagerBtn) {
        resourceManagerBtn.style.display = 'flex';
        resourceManagerBtn.innerHTML = `
          <span class="material-icons">palette</span>
        `;
  
        // Add click handler
        resourceManagerBtn.addEventListener('click', () => {
          const drawer = this.resourceManager.createResourceManagerUI();
          drawer.show();
        });
      }
      
      // If there's a partyManager already, connect it to resourceManager
      if (this.partyManager) {
        console.log("Connecting existing PartyManager to ResourceManager");
        this.partyManager.resourceManager = this.resourceManager;
      }
      
      if (callback) callback();
    };
    script.onerror = () => {
      console.warn('Resource manager not available');
      if (resourceManagerBtn) {
        resourceManagerBtn.style.display = 'none';
      }
      if (callback) callback();
    };
    document.head.appendChild(script);
  }

  

  checkTextureManager(callback) {
    const script = document.createElement('script');
    script.src = 'js/classes/texture-manager.js';
    script.onload = () => {
      console.log('TextureManager script loaded');
      if (this.resourceManager) {
        this.textureManager = new TextureManager(this);
        console.log('TextureManager created with ResourceManager');
      } else {
        console.warn('Creating TextureManager without ResourceManager');
        this.textureManager = new TextureManager(this);
      }
      if (callback) callback();
    };
    script.onerror = () => {
      console.warn('Texture manager not available');
      if (callback) callback();
    };
    document.head.appendChild(script);
  }


  snapToGrid(value, gridSize, snapThreshold = 0.25) {
    if (!gridSize) return value;
    
    // Check grid snapping preference
    const snappingMode = this.editorPreferences?.gridSnapping || 'soft';
    
    // If snapping is disabled, return original value
    if (snappingMode === 'none') return value;
    
    const gridPosition = Math.round(value / gridSize) * gridSize;
    
    // For soft snapping (allow some deviation)
    if (snappingMode === 'soft') {
      const offset = value - gridPosition;
      if (Math.abs(offset) < gridSize * snapThreshold) {
        return gridPosition;
      }
      return value;
    }
    
    // For strict snapping, always snap to grid
    return gridPosition;
  }

  calculateDockOffset(mainRoom, dockingRoom, position) {
    let newX = dockingRoom.bounds.x;  // Start with current position
    let newY = dockingRoom.bounds.y;

    switch (position) {
      // Right side positions
      case 'right-top':
        newX = mainRoom.bounds.x + mainRoom.bounds.width;
        newY = mainRoom.bounds.y;
        break;
      case 'right-middle':
        newX = mainRoom.bounds.x + mainRoom.bounds.width;
        newY = mainRoom.bounds.y + (mainRoom.bounds.height - dockingRoom.bounds.height) / 2;
        break;
      case 'right-bottom':
        newX = mainRoom.bounds.x + mainRoom.bounds.width;
        newY = mainRoom.bounds.y + mainRoom.bounds.height - dockingRoom.bounds.height;
        break;

      // Left side positions
      case 'left-top':
        newX = mainRoom.bounds.x - dockingRoom.bounds.width;
        newY = mainRoom.bounds.y;
        break;
      case 'left-middle':
        newX = mainRoom.bounds.x - dockingRoom.bounds.width;
        newY = mainRoom.bounds.y + (mainRoom.bounds.height - dockingRoom.bounds.height) / 2;
        break;
      case 'left-bottom':
        newX = mainRoom.bounds.x - dockingRoom.bounds.width;
        newY = mainRoom.bounds.y + mainRoom.bounds.height - dockingRoom.bounds.height;
        break;

      // Top side positions
      case 'top-left':
        newX = mainRoom.bounds.x;
        newY = mainRoom.bounds.y - dockingRoom.bounds.height;
        break;
      case 'top-center':
        newX = mainRoom.bounds.x + (mainRoom.bounds.width - dockingRoom.bounds.width) / 2;
        newY = mainRoom.bounds.y - dockingRoom.bounds.height;
        break;
      case 'top-right':
        newX = mainRoom.bounds.x + mainRoom.bounds.width - dockingRoom.bounds.width;
        newY = mainRoom.bounds.y - dockingRoom.bounds.height;
        break;

      // Bottom side positions
      case 'bottom-left':
        newX = mainRoom.bounds.x;
        newY = mainRoom.bounds.y + mainRoom.bounds.height;
        break;
      case 'bottom-center':
        newX = mainRoom.bounds.x + (mainRoom.bounds.width - dockingRoom.bounds.width) / 2;
        newY = mainRoom.bounds.y + mainRoom.bounds.height;
        break;
      case 'bottom-right':
        newX = mainRoom.bounds.x + mainRoom.bounds.width - dockingRoom.bounds.width;
        newY = mainRoom.bounds.y + mainRoom.bounds.height;
        break;
    }

    // Calculate the offset from current position
    return {
      x: newX - dockingRoom.bounds.x,
      y: newY - dockingRoom.bounds.y
    };
  }

  dockRooms(mainRoom, dockingRoom, position) {
    if (!mainRoom || !dockingRoom) return;

    // Calculate where dockingRoom should move to
    const offset = this.calculateDockOffset(mainRoom, dockingRoom, position);

    // Move the docking room
    dockingRoom.bounds.x += offset.x;
    dockingRoom.bounds.y += offset.y;

    // Store docking relationship
    if (!this.dockedRooms.has(dockingRoom.id)) {
      this.dockedRooms.set(dockingRoom.id, []);
    }

    this.dockedRooms.get(dockingRoom.id).push({
      room: mainRoom,
      position: position,
      offset: { ...offset }
    });

    // Update visual elements
    dockingRoom.updateElement();
    dockingRoom.element.classList.add('docked');
    mainRoom.element.classList.add('docked');

    console.log('Docking complete:', {
      mainRoomId: mainRoom.id,
      dockingRoomId: dockingRoom.id,
      position,
      newPosition: {
        x: dockingRoom.bounds.x,
        y: dockingRoom.bounds.y
      },
      offset
    });
  }


  undockRoom(room) {
    if (this.dockedRooms.has(room.id)) {
      // Get all docking relationships for this room
      const dockings = this.dockedRooms.get(room.id);

      dockings.forEach(({ room: targetRoom, offset }) => {
        // Remove visual indicators
        targetRoom.element.classList.remove('docked');

        // Remove any stored relationships where this room is the target
        this.dockedRooms.forEach((relationships, key) => {
          if (relationships.some(rel => rel.room.id === room.id)) {
            this.dockedRooms.delete(key);
          }
        });
      });

      // Remove visual indicator from source room
      room.element.classList.remove('docked');

      // Remove all docking relationships for this room
      this.dockedRooms.delete(room.id);

      console.log('Room undocked:', {
        roomId: room.id,
        previousDockings: dockings
      });
    }
  }


  showLockedMessage() {
    const toast = document.createElement('sl-dialog');
    toast.label = 'Layer Locked';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-icons" style="color: #f44336;">lock</span>
            <span>This layer is locked. Unlock it to make changes.</span>
        </div>
        <div slot="footer">
            <sl-button variant="primary" class="ok-btn">OK</sl-button>
        </div>
    `;
    document.body.appendChild(toast);

    const okBtn = toast.querySelector('.ok-btn');
    okBtn.addEventListener('click', () => toast.hide());
    toast.addEventListener('sl-after-hide', () => toast.remove());

    toast.show();
  }

  parseMapFilename(filename) {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Try to find grid dimensions (like 32x20)
    const gridMatch = nameWithoutExt.match(/(\d+)x(\d+)/i);

    // Try to find a map name
    let mapName = nameWithoutExt;

    // Remove any leading numbers and separators
    mapName = mapName.replace(/^[\d-_\s]+/, '');

    // Remove the grid dimensions if present
    mapName = mapName.replace(/\s*\d+x\d+\s*$/, '');

    // Clean up any remaining underscores or extra spaces
    mapName = mapName.replace(/_/g, ' ').trim();

    const result = {
      success: true,
      gridDimensions: gridMatch ? {
        width: parseInt(gridMatch[1]),
        height: parseInt(gridMatch[2])
      } : null,
      mapName: mapName || null
    };

    // Update the title if we have a valid map name
    if (result.success && result.mapName) {
      this.mapName = result.mapName;
      this.updateMapTitle();
    }

    return result;
  }

  // Add these new methods
  updateMapTitle() {
    const titleElement = document.getElementById('mapTitleText');
    if (titleElement) {
      if (this.mapName) {
        titleElement.textContent = this.mapName;
      } else {
        titleElement.textContent = 'Untitled Map';
      }
    }
  }

  setupTitleHandlers() {
    const titleContainer = document.getElementById('mapTitle');
    if (titleContainer) {
      titleContainer.addEventListener('click', async () => {
        const result = await this.showMapNameDialog();
        if (result) {
          this.updateMapTitle();
        }
      });
    }
  }

  async showMapNameDialog() {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'New Map';
    dialog.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <sl-input
        id="mapNameInput"
        label="Map Name"
        placeholder="Enter map name"
        help-text="This will be used in the saved file name"
        required
      ></sl-input>
    </div>
    <div slot="footer">
      <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
      <sl-button variant="primary" class="save-btn">Create</sl-button>
    </div>
  `;

    document.body.appendChild(dialog);

    return new Promise((resolve) => {
      const mapNameInput = dialog.querySelector('#mapNameInput');
      const saveBtn = dialog.querySelector('.save-btn');
      const cancelBtn = dialog.querySelector('.cancel-btn');

      const handleSave = () => {
        const mapName = mapNameInput.value.trim();
        if (mapName) {
          this.mapName = mapName; // Store map name in class
          dialog.hide();
          resolve(true);
        } else {
          mapNameInput.reportValidity();
        }
      };

      const handleCancel = () => {
        dialog.hide();
        resolve(false);
      };

      saveBtn.addEventListener('click', handleSave);
      cancelBtn.addEventListener('click', handleCancel);
      mapNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
      });

      dialog.addEventListener('sl-after-hide', () => {
        dialog.remove();
      });

      dialog.show();
      setTimeout(() => mapNameInput.focus(), 100);
    });
  }




  async saveMap() {
    // Show saving notification
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.backgroundColor = "#333";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "4px";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.innerHTML = `
      <span class="material-icons">save</span>
      <span>Saving map...</span>
  `;
    document.body.appendChild(toast);

    try {
      console.log("Starting map save...");
      // Create the save data structure
      const saveData = {
        version: "1.3", // Bump version for prop support
        timestamp: new Date().toISOString(),
        mapImage: null,
        gridSettings: {
          cellSize: this.cellSize,
          width: this.gridDimensions?.width,
          height: this.gridDimensions?.height
        },
        floorBackgroundColor: this.editorPreferences?.floorBackgroundColor || '#2e7d32', // Default green
        rooms: this.rooms.map((room) => {
          return {
            id: room.id,
            name: room.name,
            shape: room.shape,
            bounds: { ...room.bounds },
            points: room.points ? [...room.points] : null,
            isRaisedBlock: room.isRaisedBlock || false,
            blockHeight: room.blockHeight || 0,
            isWaterArea: room.isWaterArea || false,
            finalized: room.finalized,
            locked: room.locked,
            thumbnail: room.thumbnail,
            type: room.type,
            locked: room.locked
          };
        }),
        folders: this.layersPanel.folders.map(folder => {
          return {
            id: folder.id,
            name: folder.name,
            expanded: folder.expanded,
            locked: folder.locked,
            color: folder.color,
            rooms: folder.rooms.map(room => room.id) // Store just the room IDs
          };
        }),
        textureData: {
          assignments: this.resourceManager?.serializeTextureAssignments(),
          activeResourcePack: this.resourceManager?.activeResourcePack?.name
        },
        playerStart: this.playerStart ? {
          id: this.playerStart.id,
          type: this.playerStart.type,
          x: this.playerStart.x,
          y: this.playerStart.y,
          data: { ...this.playerStart.data }
        } : null,
        markers: this.markers.map((marker) => {
          // Create a clean copy of marker data
          const markerData = {
            id: marker.id,
            type: marker.type,
            x: marker.x,
            y: marker.y,
            data: {}
          };

          // Copy non-circular data
          if (marker.data) {
            Object.keys(marker.data).forEach((key) => {
              if (key !== "pairedMarker") {
                markerData.data[key] = marker.data[key];
              }
            });

            if (marker.data.parentWall) {
              markerData.data.parentWallId = marker.data.parentWall.id;
              delete markerData.data.parentWall;
            }
          }

          if (marker.type === "splash-art" && marker.data.splashArt) {
            markerData.data = {
              splashArt: {
                id: marker.data.splashArt.id,
                category: marker.data.splashArt.category,
                name: marker.data.splashArt.name,
                data: marker.data.splashArt.data,
                thumbnail: marker.data.splashArt.thumbnail
              },
              effects: marker.data.effects,
              orientation: marker.data.orientation,
              position: marker.data.position,
              scale: marker.data.scale,
              height: marker.data.height,
              inspectMessage: marker.data.inspectMessage
            };
          }

          // Special handling for different marker types
          if (marker.type === "encounter" && marker.data.monster) {
            markerData.data.monster = {
              basic: { ...marker.data.monster.basic },
              stats: {
                ac: marker.data.monster.stats.ac,
                hp: { ...marker.data.monster.stats.hp },
                speed: marker.data.monster.stats.speed
              },
              abilities: { ...marker.data.monster.abilities },
              traits: { ...marker.data.monster.traits },
              token: {
                data: marker.data.monster.token.data,
                url: marker.data.monster.token.url
              }
            };
          } else if (marker.type === "teleport" && marker.data.pairedMarker) {
            markerData.data.pairId = marker.data.pairedMarker.id;
            markerData.data.isPointA = marker.data.isPointA;
            markerData.data.hasPair = true;
          } // Improved prop handling in the saveMap function:

          // Find the prop-specific section in the markers part of saveMap:
          else if (marker.type === "prop") {
            // IMPROVED PROP DATA HANDLING
            console.log("Saving prop data:", {
              id: marker.id,
              hasTexture: !!marker.data.texture,
              textureName: marker.data.texture?.name,
              prop: marker.data.prop
            });

            // Save complete prop configuration
            markerData.data.prop = {
              scale: marker.data.prop?.scale || 1.0,
              height: marker.data.prop?.height || 1.0,
              isHorizontal: !!marker.data.prop?.isHorizontal, // Ensure boolean
              position: {
                rotation: marker.data.prop?.position?.rotation || 0
              }
            };

            // Directly embed complete texture data
            if (marker.data.texture) {
              // Save under embeddedTexture for v1.3+ format
              markerData.data.embeddedTexture = {
                id: marker.data.texture.id,
                name: marker.data.texture.name,
                category: marker.data.texture.category || "props",
                data: marker.data.texture.data, // The actual image data
                aspect: marker.data.texture.aspect || 1.0
              };

              // For backwards compatibility
              markerData.data.textureId = marker.data.texture.id;
              markerData.data.textureCategory = marker.data.texture.category || "props";
            }
          } else if (marker.type === "door") {
            if (marker.data.door) {
              markerData.data.door = { ...marker.data.door };
              if (marker.data.door.position) {
                markerData.data.door.position = { ...marker.data.door.position };
              }
            }

            // Also save texture for doors
            if (marker.data.texture) {
              markerData.data.textureId = marker.data.texture.id;
              markerData.data.textureCategory = marker.data.texture.category || "doors";
            }
          }

          return markerData;
        }),
        resourcePack: this.resourceManager?.activeResourcePack?.name || null
      };

      // Convert main map image to base64
      if (this.baseImage) {
        const canvas = document.createElement("canvas");
        canvas.width = this.baseImage.width;
        canvas.height = this.baseImage.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(this.baseImage, 0, 0);
        saveData.mapImage = canvas.toDataURL("image/webp");
      }

      // Create the file
      const blob = new Blob([JSON.stringify(saveData, null, 2)], {
        type: "application/json"
      });

      // Generate filename based on map name and timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const mapName = this.mapName || this.originalMapName || "untitled";
      const filename = `${mapName}.map.json`;  // New naming convention

      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      console.log("Map save completed");

      // Show success toast
      toast.style.backgroundColor = "#4CAF50";
      toast.innerHTML = `
          <span class="material-icons">check_circle</span>
          <span>Map saved successfully!</span>
      `;

      // Return the filename for potential project file creation
      return filename;
    } catch (error) {
      console.error("Error saving map:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
          <span class="material-icons">error</span>
          <span>Error saving map!</span>
      `;
      return null;
    } finally {
      // Remove toast after delay
      setTimeout(() => toast.remove(), 2000);
    }
  }

  // Updated loadMap function to handle props (version 1.3)
  async loadMap(file) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.backgroundColor = "#333";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "4px";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.innerHTML = `
      <span class="material-icons">hourglass_top</span>
      <span>Loading map...</span>
  `;
    document.body.appendChild(toast);

    try {
      console.log("Starting map load...");
      const text = await file.text();
      const saveData = JSON.parse(text);

      // Version check
      console.log("Loading map version:", saveData.version);
      const isVersion13OrHigher = saveData.version &&
        (saveData.version === "1.3" || parseFloat(saveData.version) >= 1.3);

      // Set map name if available
      if (saveData.name) {
        this.mapName = saveData.name;
        this.updateMapTitle();
      }

      // Clear existing rooms and markers first
      this.rooms.forEach(room => {
        room.element?.remove();
      });
      this.rooms = [];

      this.markers.forEach(marker => {
        marker.element?.remove();
      });
      this.markers = [];

      if (this.playerStart?.element) {
        this.playerStart.element.remove();
        this.playerStart = null;
      }

      // Restore texture assignments
      if (saveData.textureData?.assignments && this.resourceManager) {
        this.resourceManager.deserializeTextureAssignments(saveData.textureData.assignments);
      }

      // Load map image first and wait for it to complete
      if (saveData.mapImage) {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.baseImage = img;
            this.naturalWidth = img.naturalWidth;
            this.naturalHeight = img.naturalHeight;
            resolve();
          };
          img.onerror = reject;
          img.src = saveData.mapImage;
        });
      }

      // Initialize default grid settings
      const defaultGridSettings = {
        cellSize: 50,  // default cell size
        width: null,
        height: null
      };

      // Try to get grid settings from save data, fall back to defaults
      const gridSettings = saveData.gridSettings || defaultGridSettings;

      // Apply grid settings with fallback values
      this.cellSize = gridSettings.cellSize || defaultGridSettings.cellSize;
      this.gridDimensions = gridSettings.width && gridSettings.height
        ? {
          width: gridSettings.width,
          height: gridSettings.height
        }
        : null;

      console.log("Grid settings restored:", {
        cellSize: this.cellSize,
        dimensions: this.gridDimensions
      });

      // Store the floor background color in editor preferences
if (saveData.floorBackgroundColor) {
  if (!this.editorPreferences) {
    this.editorPreferences = {};
  }
  this.editorPreferences.floorBackgroundColor = saveData.floorBackgroundColor;
  
  // Save to localStorage to persist across sessions
  const allPrefs = JSON.parse(localStorage.getItem('editorPreferences') || '{}');
  allPrefs.floorBackgroundColor = saveData.floorBackgroundColor;
  localStorage.setItem('editorPreferences', JSON.stringify(allPrefs));
  
  // Apply immediately if in 3D mode
  if (this.scene3D) {
    this.scene3D.setFloorBackgroundColor(saveData.floorBackgroundColor);
  }
}

      // Restore rooms
      for (const roomData of saveData.rooms) {
        const room = Room.createFromSaved(roomData, this);
        // Restore raised block properties
        room.isRaisedBlock = roomData.isRaisedBlock || false;
        room.blockHeight = roomData.blockHeight || 0;
        room.isWaterArea = roomData.isWaterArea || false; // Add this line
  
        if (room.type === 'water' || room.isWaterArea) {
          room.element.classList.add('water-area');
          room.element.style.backgroundColor = "rgba(0, 100, 255, 0.3)";
          room.element.style.border = "1px solid rgba(0, 150, 255, 0.7)";
        }

        if (roomData.locked) {
          room.locked = true;
        }
        this.rooms.push(room);
        document.querySelector('.canvas-container').appendChild(room.element);
      }

      if (saveData.folders && Array.isArray(saveData.folders)) {
        console.log(`Restoring ${saveData.folders.length} folders`);

        // Clear existing folders
        this.layersPanel.folders = [];

        // Create new folders
        for (const folderData of saveData.folders) {
          // Create basic folder structure
          const folder = {
            id: folderData.id,
            name: folderData.name,
            expanded: folderData.expanded !== undefined ? folderData.expanded : true,
            locked: folderData.locked || false,
            color: folderData.color || null,
            rooms: [] // Will fill with room objects
          };

          // Find all the rooms for this folder
          if (folderData.rooms && Array.isArray(folderData.rooms)) {
            folder.rooms = folderData.rooms
              .map(roomId => this.rooms.find(room => room.id === roomId))
              .filter(room => room); // Remove any undefined (not found) rooms
          }

          // Add the folder
          this.layersPanel.folders.push(folder);
        }
      }

      // Restore player start marker if it exists
      if (saveData.playerStart) {
        console.log("Restoring player start marker:", saveData.playerStart);
        this.playerStart = this.addMarker(
          "player-start",
          saveData.playerStart.x,
          saveData.playerStart.y,
          saveData.playerStart.data || {}
        );
      }

      // Restore markers
      console.log("Starting marker restoration...");
      for (const markerData of saveData.markers) {
        console.log("Loading marker:", {
          type: markerData.type,
          data: markerData.data
        });

        // Check for URL-based tokens in encounter markers
        const hasUrlToken = markerData.type === "encounter" &&
          markerData.data?.monster?.token?.url &&
          !markerData.data.monster.token.data?.startsWith('data:');

        // Log and track URL token issues
        if (hasUrlToken) {
          console.warn("Found URL-based token in marker:", {
            type: markerData.type,
            monsterId: markerData.data.monster.basic.name,
            tokenUrl: markerData.data.monster.token.url
          });

          setTimeout(() => this.showTokenWarningToast(), 2000);

          // Set flag to show warning toast later
          this.hasUrlBasedTokens = true;
        }

        // Handle prop texture data - FIXED SECTION
        if (markerData.type === "prop") {
          console.log("Loading prop marker data:", markerData.data);

          // Ensure prop data structure exists with proper defaults
          if (!markerData.data.prop) {
            markerData.data.prop = {
              scale: 1.0,
              height: 1.0,
              isHorizontal: false,
              position: { rotation: 0 }
            };
          } else {
            // Ensure boolean value for isHorizontal
            markerData.data.prop.isHorizontal = !!markerData.data.prop.isHorizontal;

            // Ensure all prop properties exist
            markerData.data.prop.scale = markerData.data.prop.scale || 1.0;
            markerData.data.prop.height = markerData.data.prop.height || 1.0;
            if (!markerData.data.prop.position) {
              markerData.data.prop.position = { rotation: 0 };
            } else {
              markerData.data.prop.position.rotation = markerData.data.prop.position.rotation || 0;
            }
          }

          // First try to load from embedded texture data (v1.3+ format)
          if (markerData.data.embeddedTexture) {
            console.log("Using embedded texture data for prop");
            markerData.data.texture = { ...markerData.data.embeddedTexture };

            // Store this texture in resourceManager if it doesn't exist
            // This ensures the texture is available for future reference
            if (this.resourceManager &&
              !this.resourceManager.resources.textures.props.has(markerData.data.texture.id)) {
              console.log("Adding embedded texture to resource manager:", markerData.data.texture.name);
              this.resourceManager.resources.textures.props.set(
                markerData.data.texture.id,
                markerData.data.texture
              );
            }
          }
          // Then try the older textureData field (for compatibility)
          else if (markerData.data.textureData) {
            console.log("Using textureData field for prop");
            markerData.data.texture = {
              id: markerData.data.textureData.id,
              name: markerData.data.textureData.name,
              data: markerData.data.textureData.data,
              aspect: markerData.data.textureData.aspect || 1.0,
              category: "props"
            };
          }
          // Finally try to get texture from resource manager by ID
          else if (markerData.data.textureId && this.resourceManager) {
            const category = markerData.data.textureCategory || "props";
            console.log(`Attempting to load specific prop texture: ${markerData.data.textureId}`);

            // Use getSpecificTexture instead of direct lookup
            const texture = this.resourceManager.getSpecificTexture(category, markerData.data.textureId);

            if (texture) {
              console.log("Found texture in resource manager:", texture.name);
              markerData.data.texture = texture;
            } else {
              console.warn(`Could not find texture ${markerData.data.textureId} in category ${category}`);
              // Only use fallback if absolutely necessary
              console.warn("Will attempt to recreate prop with saved ID, visuals may be incorrect");
            }
          }

          console.log("Final prop data being used:", {
            prop: markerData.data.prop,
            texture: markerData.data.texture ? {
              id: markerData.data.texture.id,
              name: markerData.data.texture.name
            } : "No texture found"
          });
        }


        // Handle regular texture restoration for other marker types
        else if (markerData.data.textureId && this.resourceManager) {
          const category = markerData.data.textureCategory ||
            (markerData.type === "door" ? "doors" : "walls");

          const texture = this.resourceManager.resources.textures[category]?.get(markerData.data.textureId);
          if (texture) {
            markerData.data.texture = texture;
          }
        }

        // Handle parent wall restoration for doors
        if (markerData.data.parentWallId) {
          markerData.data.parentWall = this.rooms.find(r => r.id === markerData.data.parentWallId);
        }

        // Add the marker
        const marker = this.addMarker(
          markerData.type,
          markerData.x,
          markerData.y,
          markerData.data
        );

        if (marker.type === "splash-art" && markerData.data.splashArt) {
          // Get the actual splash art data from the resource manager
          const art = this.resourceManager.resources.splashArt[markerData.data.splashArt.category]?.get(markerData.data.splashArt.id);
          if (art) {
            marker.data.splashArt = {
              ...art,
              id: markerData.data.splashArt.id,
              category: markerData.data.splashArt.category
            };
            this.updateMarkerAppearance(marker);
          }
        }
        else if (marker) {
          if (marker.type === "encounter" && marker.data.monster) {
            this.updateMarkerAppearance(marker);
          }
          else if (marker.type === "prop") {
            // Force update the prop's appearance to reflect loaded settings
            this.updateMarkerAppearance(marker);

            // Apply horizontal class if needed
            if (marker.data.prop?.isHorizontal) {
              const propVisual = marker.element.querySelector('.prop-visual');
              if (propVisual) {
                propVisual.classList.add('horizontal-prop');
              }
            }
          }
          else if (marker.type === "door" && marker.data.door) {
            if (marker.data.door.position?.rotation) {
              marker.element.style.transform = `rotate(${marker.data.door.position.rotation}deg)`;
            }
          }
        }
      }

      // Restore teleport connections
      console.log("Restoring teleport connections...");
      const teleportMarkers = this.markers.filter(m => m.type === "teleport");
      for (const marker of teleportMarkers) {
        if (marker.data.pairId) {
          const pair = teleportMarkers.find(
            m => m.data.pairId === marker.data.pairId && m !== marker
          );
          if (pair) {
            console.log("Connecting teleport pair:", {
              markerA: marker.id,
              markerB: pair.id
            });

            marker.data.pairedMarker = pair;
            pair.data.pairedMarker = marker;
            marker.data.hasPair = true;
            pair.data.hasPair = true;

            if (marker.data.isPointA) {
              if (marker.connection) {
                marker.connection.remove();
              }
              marker.connection = this.createTeleportConnection(marker, pair);
              this.updateTeleportConnection(marker, pair);
            }
          }
        }
      }

      // Update all marker positions
      this.updateMarkerPositions();
      // Update display
      this.centerMap();

      this.render();
      this.layersPanel.updateLayersList();

      console.log("Map load completed");

      // Success notification
      toast.style.backgroundColor = "#4CAF50";
      toast.innerHTML = `
          <span class="material-icons">check_circle</span>
          <span>Map loaded successfully!</span>
      `;
    } catch (error) {
      console.error("Error loading map:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
          <span class="material-icons">error</span>
          <span>Error loading map!</span>
      `;
    }

    // Remove toast after delay
    setTimeout(() => {
      toast.remove();

      // Temporarily zoom out and back in to force marker updates
      const originalScale = this.scale;

      // Zoom out
      this.scale *= 0.9;
      this.rooms.forEach(room => room.updateElement());
      this.updateMarkerPositions();

      // Wait a frame then zoom back in
      requestAnimationFrame(() => {
        this.scale = originalScale;
        this.rooms.forEach(room => room.updateElement());
        this.updateMarkerPositions();
        this.render();
      });
    }, 1000);

    this.centerMap();
  }

  async saveProjectFile() {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.backgroundColor = "#333";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "4px";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.innerHTML = `
      <span class="material-icons">save</span>
      <span>Saving project...</span>
  `;
    document.body.appendChild(toast);

    try {
      // First save resource pack
      const mapName = this.mapName || this.originalMapName || "untitled";
      const resourceFilename = await this.resourceManager.saveResourcePack(mapName);

      // Then save map
      const mapFilename = await this.saveMap();

      if (!resourceFilename || !mapFilename) {
        throw new Error("Failed to save resource pack or map");
      }

      // Create project data with relative paths
      const projectData = {
        name: mapName,
        version: "1.0",
        timestamp: new Date().toISOString(),
        resources: {
          filename: resourceFilename,
          relativePath: "./", // Store relative path - same directory as project
          lastModified: new Date().toISOString()
        },
        map: {
          filename: mapFilename,
          relativePath: "./", // Store relative path - same directory as project
          lastModified: new Date().toISOString()
        },
        settings: {
          defaultView: "2D",
          autoSave: false
        }
      };

      // Create project file
      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: "application/json"
      });

      // Use project naming convention
      const projectFilename = `${mapName}.project.json`;

      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = projectFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      // Show success toast
      toast.style.backgroundColor = "#4CAF50";
      toast.innerHTML = `
        <span class="material-icons">check_circle</span>
        <span>Project saved successfully!</span>
    `;

      this.updateRecentProjects(projectData);

      return true;


    } catch (error) {
      console.error("Error saving project:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
        <span class="material-icons">error</span>
        <span>Error saving project: ${error.message}</span>
    `;
      return false;
    } finally {
      // Remove toast after delay
      setTimeout(() => toast.remove(), 3000);
    }
  }

  // Updated loadProjectFile method to try automatically loading files
  async loadProjectFile(file) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.backgroundColor = "#333";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "4px";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.innerHTML = `
      <span class="material-icons">hourglass_top</span>
      <span>Loading project...</span>
  `;
    document.body.appendChild(toast);

    try {
      // Parse project file
      const projectText = await file.text();
      const projectData = JSON.parse(projectText);

      // Check if this is a valid project file
      if (!projectData.resources || !projectData.map) {
        throw new Error("Invalid project file format");
      }

      // Extract filenames and paths
      const resourceFilename = projectData.resources.filename;
      const resourcePath = projectData.resources.relativePath || "./";
      const mapFilename = projectData.map.filename;
      const mapPath = projectData.map.relativePath || "./";

      let resourceFile = null;
      let mapFile = null;

      // This function attempts to load a file from a given path
      const tryLoadFile = async (path, filename) => {
        try {
          if (window.showDirectoryPicker) { // Modern File System Access API
            const handle = await window.showDirectoryPicker({
              id: 'project-dir',
              startIn: 'downloads',
              mode: 'read'
            });

            try {
              const fileHandle = await handle.getFileHandle(filename);
              return await fileHandle.getFile();
            } catch (e) {
              console.warn(`File not found at selected directory: ${filename}`);
              return null;
            }
          }
          return null; // Fallback: can't auto-load without File System Access API
        } catch (err) {
          console.warn(`Unable to auto-load file: ${filename}`, err);
          return null;
        }
      };

      // Show progress
      toast.innerHTML = `
        <span class="material-icons">hourglass_top</span>
        <span>Loading resources (1/2)...</span>
    `;

      // Try to auto-load the resource file
      resourceFile = await tryLoadFile(resourcePath, resourceFilename);

      // If auto-load failed, ask user to select the file
      if (!resourceFile) {
        resourceFile = await this.promptForFile(
          `Please select the resource file: ${resourceFilename}`
        );
      }

      if (!resourceFile) {
        throw new Error("Resource file selection cancelled");
      }

      // Load resource pack
      await this.resourceManager.loadResourcePack(resourceFile);

      // Update progress
      toast.innerHTML = `
        <span class="material-icons">hourglass_top</span>
        <span>Loading map (2/2)...</span>
    `;

      // Try to auto-load the map file
      mapFile = await tryLoadFile(mapPath, mapFilename);

      // If auto-load failed, ask user to select the file
      if (!mapFile) {
        mapFile = await this.promptForFile(
          `Please select the map file: ${mapFilename}`
        );
      }

      if (!mapFile) {
        throw new Error("Map file selection cancelled");
      }

      // Load map
      await this.loadMap(mapFile);

      // Set project name
      this.mapName = projectData.name;
      this.updateMapTitle();

      this.updateRecentProjects({
        name: projectData.name,
        resources: {
          filename: resourceFilename
        },
        map: {
          filename: mapFilename
        }
      });

      // Show success toast
      toast.style.backgroundColor = "#4CAF50";
      toast.innerHTML = `
        <span class="material-icons">check_circle</span>
        <span>Project "${projectData.name}" loaded successfully!</span>
    `;

      return true;
    } catch (error) {
      console.error("Error loading project:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
        <span class="material-icons">error</span>
        <span>Error loading project: ${error.message}</span>
    `;
      return false;
    } finally {
      // Remove toast after delay
      setTimeout(() => toast.remove(), 3000);
    }
  }

  // Enhanced promptForFile method
  async promptForFile(message, suggestedFilename = null) {
    // Try to use modern File System Access API first
    if (window.showOpenFilePicker) {
      try {
        const options = {
          types: [
            {
              description: 'JSON Files',
              accept: {
                'application/json': ['.json']
              }
            }
          ],
          excludeAcceptAllOption: false,
          multiple: false
        };

        // Add suggested name if provided
        if (suggestedFilename) {
          options.suggestedName = suggestedFilename;
        }

        const [fileHandle] = await window.showOpenFilePicker(options);
        return await fileHandle.getFile();
      } catch (e) {
        console.warn("File System Access API failed, falling back to traditional input", e);
        // Fall back to traditional input if modern API fails or is cancelled
      }
    }

    // Fallback to traditional file input
    return new Promise((resolve) => {
      // Create dialog
      const dialog = document.createElement("sl-dialog");
      dialog.label = "Select File";
      dialog.innerHTML = `
      <div>
        <p>${message}</p>
        <input type="file" accept=".json" style="margin-top: 10px; width: 100%;">
      </div>
      <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
      </div>
    `;

      // Add event handlers
      const fileInput = dialog.querySelector('input[type="file"]');
      const cancelBtn = dialog.querySelector('.cancel-btn');

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        dialog.hide();
        resolve(file);
      });

      cancelBtn.addEventListener('click', () => {
        dialog.hide();
        resolve(null);
      });

      // Show dialog
      document.body.appendChild(dialog);
      dialog.addEventListener('sl-after-hide', () => {
        dialog.remove();
      });

      dialog.show();
    });
  }


  updateRecentProjects(projectData) {
    try {
      // Get existing recent projects
      let recentProjects = JSON.parse(localStorage.getItem('recentProjects') || '[]');

      // Create entry for this project
      const projectEntry = {
        name: projectData.name,
        timestamp: new Date().toISOString(),
        resourceFilename: projectData.resources.filename,
        mapFilename: projectData.map.filename,
        projectFilename: `${projectData.name}.project.json`
      };

      // Add thumbnail if possible (mini screenshot of current map)
      if (this.canvas) {
        try {
          // Create a small thumbnail
          const thumbnailCanvas = document.createElement('canvas');
          thumbnailCanvas.width = 200;
          thumbnailCanvas.height = 150;
          const ctx = thumbnailCanvas.getContext('2d');
          ctx.drawImage(this.canvas, 0, 0, 200, 150);
          projectEntry.thumbnail = thumbnailCanvas.toDataURL('image/webp', 0.5);
        } catch (e) {
          console.warn('Could not create project thumbnail:', e);
        }
      }

      // Remove existing entry with the same name
      recentProjects = recentProjects.filter(p => p.name !== projectData.name);

      // Add new entry at the beginning
      recentProjects.unshift(projectEntry);

      // Keep only the 5 most recent
      recentProjects = recentProjects.slice(0, 5);

      // Save back to localStorage
      localStorage.setItem('recentProjects', JSON.stringify(recentProjects));

    } catch (e) {
      console.warn('Error updating recent projects:', e);
    }
  }

  // Show dialog with recent projects
  showRecentProjectsDialog() {
    try {
      // Get recent projects from localStorage
      const recentProjects = JSON.parse(localStorage.getItem('recentProjects') || '[]');

      if (recentProjects.length === 0) {
        this.showCustomToast('No recent projects found', 'warning');
        // alert('No recent projects found');
        return;
      }

      // Create dialog
      const dialog = document.createElement('sl-dialog');
      dialog.label = 'Recent Projects';

      // Generate content
      let content = '<div style="display: flex; flex-direction: column; gap: 16px;">';

      recentProjects.forEach((project, index) => {
        const date = new Date(project.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        content += `
          <div class="recent-project-card" data-index="${index}" style="
            display: flex;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px;
            gap: 16px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.backgroundColor='#f5f5f5'" 
             onmouseout="this.style.backgroundColor='transparent'">
            
            ${project.thumbnail ? `
              <div style="flex: 0 0 80px;">
                <img src="${project.thumbnail}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 4px;">
              </div>
            ` : `
              <div style="flex: 0 0 80px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons" style="color: #aaa; font-size: 32px;">map</span>
              </div>
            `}
            
            <div style="flex: 1; overflow: hidden;">
              <div style="font-weight: 500; font-size: 1.1em; margin-bottom: 4px;">${project.name}</div>
              <div style="color: #666; font-size: 0.9em;">Last opened: ${formattedDate}</div>
              <div style="color: #888; font-size: 0.8em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                Files: ${project.mapFilename}, ${project.resourceFilename}
              </div>
            </div>
            
            <div style="display: flex; align-items: center;">
              <sl-button class="load-btn" size="small" circle>
                <span class="material-icons">play_arrow</span>
              </sl-button>
            </div>
          </div>
        `;
      });

      content += '</div>';

      // Add option to clear history
      content += `
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <sl-button size="small" class="clear-history-btn" variant="text">
            <span class="material-icons" style="font-size: 16px;">delete</span>
            Clear History
          </sl-button>
        </div>
      `;

      dialog.innerHTML = content;

      // Add to document
      document.body.appendChild(dialog);

      // Add event handlers
      dialog.querySelectorAll('.recent-project-card').forEach(card => {
        card.addEventListener('click', () => {
          const index = parseInt(card.dataset.index);
          this.loadRecentProject(recentProjects[index]);
          dialog.hide();
        });
      });

      // Clear history button
      dialog.querySelector('.clear-history-btn')?.addEventListener('click', () => {
        if (confirm('Clear recent projects history?')) {
          localStorage.removeItem('recentProjects');
          dialog.hide();
        }
      });

      // Cleanup when closed
      dialog.addEventListener('sl-after-hide', () => {
        dialog.remove();
      });

      dialog.show();

    } catch (e) {
      console.error('Error showing recent projects:', e);
      this.showCustomToast('Could not load recent projects', 'error');
      // alert('Could not load recent projects');
    }
  }

  // Load a project from the recent list
  async loadRecentProject(projectEntry) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    toast.style.backgroundColor = "#333";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "4px";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.innerHTML = `
      <span class="material-icons">hourglass_top</span>
      <span>Loading project ${projectEntry.name}...</span>
    `;
    document.body.appendChild(toast);

    try {
      // Show helper message with expected filenames
      const helperMessage = document.createElement('div');
      helperMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 80%;
      `;
      helperMessage.innerHTML = `
        <h3 style="margin-top: 0;">Loading Project Files</h3>
        <p>Due to browser security restrictions, you'll need to select the project files manually.</p>
        <p>You will be prompted to select the following files in order:</p>
        <ol>
          <li>Project file: <strong>${projectEntry.projectFilename}</strong></li>
          <li>Resource file: <strong>${projectEntry.resourceFilename}</strong></li>
          <li>Map file: <strong>${projectEntry.mapFilename}</strong></li>
        </ol>
        <p style="text-align: center; margin-top: 20px;">
          <button class="continue-btn" style="padding: 8px 16px;">Continue</button>
        </p>
      `;
      document.body.appendChild(helperMessage);

      // Wait for user to continue
      await new Promise(resolve => {
        helperMessage.querySelector('.continue-btn').addEventListener('click', () => {
          helperMessage.remove();
          resolve();
        });
      });

      // First, prompt for project file
      const projectFile = await this.promptForFile(
        `Select the project file: ${projectEntry.projectFilename}`
      );

      if (!projectFile) {
        throw new Error("Project file selection cancelled");
      }

      // Now load the project as usual
      await this.loadProjectFile(projectFile);

      // Success toast
      toast.style.backgroundColor = "#4CAF50";
      toast.innerHTML = `
        <span class="material-icons">check_circle</span>
        <span>Project loaded successfully!</span>
      `;

    } catch (error) {
      console.error("Error loading recent project:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
        <span class="material-icons">error</span>
        <span>Error loading project: ${error.message}</span>
      `;
    } finally {
      setTimeout(() => toast.remove(), 3000);
    }
  }


  clearMap() {
    // Clear all rooms
    this.rooms.forEach((room) => {
      room.element?.remove();
    });
    this.rooms = [];

    // Clear all markers
    this.markers.forEach((marker) => {
      marker.element?.remove();
    });
    this.markers = [];

    // Clear player start
    if (this.playerStart?.element) {
      this.playerStart.element.remove();
      this.playerStart = null;
    }

    // Clear base image
    this.baseImage = null;

    // Reset view settings
    this.scale = 1;
    this.offset = { x: 0, y: 0 };

    // Update display
    this.render();
    this.layersPanel.updateLayersList();
  }

  calculateLayersListHeight() {
    const sidebar = document.querySelector(".sidebar");
    const sidebarContent = document.querySelector(".sidebar-content");
    const layersPanel = document.querySelector(".layers-panel");
    const mainHeader = document.querySelector(".header");

    if (sidebar && sidebarContent && layersPanel && mainHeader) {
      // Get toolbar sections height
      const toolSections = document.querySelectorAll(".tool-section");
      let toolbarHeight = 0;
      toolSections.forEach((section) => {
        if (!section.closest(".layers-panel")) {
          // Only count non-layers-panel sections
          toolbarHeight += section.offsetHeight;
        }
      });

      // Calculate available height
      const totalHeight = window.innerHeight;
      const headerHeight = mainHeader.offsetHeight;
      const availableHeight =
        totalHeight - headerHeight - toolbarHeight - 40; // 40px for padding


      // Set the panel height
      layersPanel.style.height = `${availableHeight}px`;
    }
  }

  setupLayersObserver() {
    const layersList = document.querySelector("#layersList");
    if (layersList) {
      const observer = new MutationObserver(
        this.calculateLayersListHeight
      );
      observer.observe(layersList, {
        childList: true,
        subtree: true
      });
    }
  }

  setupCanvas() {
    const updateCanvasSize = () => {
      const container = this.canvas.parentElement;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.render();
    };

    window.addEventListener("resize", updateCanvasSize);
    updateCanvasSize();
  }

  setupShapeSelector() {
    const splitButton = document.querySelector("sl-split-button");
    const menu = splitButton.querySelector("sl-menu");

    // Update the main button when a shape is selected
    const updateMainButton = (shape) => {
      const iconName = {
        rectangle: "square",
        circle: "circle",
        polygon: "pentagon"
      }[shape];

      const icon = splitButton.querySelector('sl-icon[slot="prefix"]');
      const label = splitButton.querySelector(".shape-label");

      icon.name = iconName;
      label.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
    };

    // Handle menu selection
    menu.addEventListener("sl-select", (event) => {
      const shape = event.detail.item.value;
      this.setShape(shape);
      updateMainButton(shape);
    });

    // Handle main button click
    splitButton.addEventListener("click", () => {
      // Start room creation with current shape
      if (this.currentShape === "rectangle") {
        this.startRoomCreation();
      } else if (this.currentShape === "circle") {
        this.startCircleRoom();
      } else if (this.currentShape === "polygon") {
        this.startPolygonRoom();
      }
    });
  }

  setShape(shape) {
    this.currentShape = shape;
    // Update any visual indicators or state
    //   console.log(`Shape set to: ${shape}`);
  }

  setupEventListeners() {
    // File handling
    const openMapBtn = document.getElementById("openMapBtn");

    if (openMapBtn) {
      openMapBtn.addEventListener("click", () => {
        const dialog = document.createElement("sl-dialog");
        dialog.label = "Open Map or Project";

        dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <sl-button size="large" class="new-map-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">add_circle</span>
              New Map
          </sl-button>

          <sl-button size="large" class="change-picture-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">image</span>
              Change Background
          </sl-button>
          
          <sl-divider></sl-divider>
          
          <!-- Add Recent Projects button -->
          <sl-button size="large" class="recent-projects-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">history</span>
              Recent Projects
          </sl-button>

          <sl-button size="large" class="load-project-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">folder_open</span>
              Open Project File
          </sl-button>

          <sl-button size="large" class="load-map-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">map</span>
              Open Map File
          </sl-button>
          
          <sl-button size="large" class="load-resource-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons md-24">texture</span>
              Open Resource Pack
          </sl-button>
      </div>
  `;

        // Create hidden file inputs
        const pictureInput = document.createElement("input");
        pictureInput.type = "file";
        pictureInput.accept = "image/*";
        pictureInput.style.display = "none";

        const projectInput = document.createElement("input");
        projectInput.type = "file";
        projectInput.accept = ".project.json";
        projectInput.style.display = "none";

        const mapInput = document.createElement("input");
        mapInput.type = "file";
        mapInput.accept = ".map.json,.json";
        mapInput.style.display = "none";

        const resourceInput = document.createElement("input");
        resourceInput.type = "file";
        resourceInput.accept = ".resource.json,.json";
        resourceInput.style.display = "none";

        document.body.appendChild(pictureInput);
        document.body.appendChild(projectInput);
        document.body.appendChild(mapInput);
        document.body.appendChild(resourceInput);

        // Fix the New Map handler
        // This is the important part that needs fixing
        pictureInput.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (file) {
            try {
              // Parse filename first (optional)
              const parseResult = this.parseMapFilename(file.name);
              let mapName = parseResult.mapName;

              // If we couldn't get a map name or user wants to change it, show dialog
              if (!mapName || !parseResult.success) {
                // Show name dialog
                const nameConfirmed = await this.showMapNameDialog();
                if (!nameConfirmed) {
                  dialog.hide();
                  return; // User cancelled
                }
              } else {
                // Found a name, confirm with the user
                const nameDialog = document.createElement('sl-dialog');
                nameDialog.label = 'Map Name';
                nameDialog.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <sl-input
                id="mapNameInput"
                label="Map Name"
                value="${mapName}"
                help-text="Parsed from filename. You can modify if needed."
              ></sl-input>
              ${parseResult.gridDimensions ? `
                <div style="color: #666;">
                  Grid Size: ${parseResult.gridDimensions.width}x${parseResult.gridDimensions.height}
                </div>
              ` : ''}
            </div>
            <div slot="footer">
              <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
              <sl-button variant="primary" class="save-btn">Continue</sl-button>
            </div>
          `;

                document.body.appendChild(nameDialog);

                // Get user confirmation
                const proceed = await new Promise((resolve) => {
                  const mapNameInput = nameDialog.querySelector('#mapNameInput');
                  const saveBtn = nameDialog.querySelector('.save-btn');
                  const cancelBtn = nameDialog.querySelector('.cancel-btn');

                  saveBtn.addEventListener('click', () => {
                    mapName = mapNameInput.value.trim();
                    this.mapName = mapName;
                    this.originalMapName = mapName;
                    nameDialog.hide();
                    resolve(true);
                  });

                  cancelBtn.addEventListener('click', () => {
                    nameDialog.hide();
                    resolve(false);
                  });

                  nameDialog.addEventListener('sl-after-hide', () => {
                    nameDialog.remove();
                  });

                  nameDialog.show();
                });

                if (!proceed) {
                  dialog.hide();
                  return; // User cancelled
                }
              }

              // Set grid dimensions if found
              if (parseResult.gridDimensions) {
                this.gridDimensions = parseResult.gridDimensions;
              }

              // Show loading notification
              const toast = document.createElement("div");
              toast.style.position = "fixed";
              toast.style.bottom = "20px";
              toast.style.right = "20px";
              toast.style.zIndex = "1000";
              toast.style.backgroundColor = "#333";
              toast.style.color = "white";
              toast.style.padding = "10px 20px";
              toast.style.borderRadius = "4px";
              toast.style.display = "flex";
              toast.style.alignItems = "center";
              toast.style.gap = "10px";
              toast.innerHTML = `
            <span class="material-icons">hourglass_top</span>
            <span>Loading ${file.name}...</span>
        `;
              document.body.appendChild(toast);

              // Clear existing map if this is a "New Map" request
              this.clearMap();

              // Load the image file
              const reader = new FileReader();
              await new Promise((resolve, reject) => {
                reader.onload = (event) => {
                  const img = new Image();
                  img.onload = () => {
                    this.baseImage = img;

                    // Calculate DPI if possible
                    if (this.gridDimensions) {
                      const cellWidth = img.width / this.gridDimensions.width;
                      const cellHeight = img.height / this.gridDimensions.height;
                      this.cellSize = Math.min(cellWidth, cellHeight);
                      console.log(`Calculated cell size: ${this.cellSize}px`);
                    } else {
                      // Set a default cell size if we couldn't calculate
                      this.cellSize = 50;
                    }

                    // Store the natural dimensions
                    this.naturalWidth = img.naturalWidth;
                    this.naturalHeight = img.naturalHeight;

                    // Center and render
                    this.centerMap();
                    this.render();
                    this.updateMapTitle(); // Update the title with the new map name
                    resolve();
                  };
                  img.onerror = reject;
                  img.src = event.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              // Success notification
              toast.style.backgroundColor = "#4CAF50";
              toast.innerHTML = `
            <span class="material-icons">check_circle</span>
            <span>Map loaded successfully!</span>
        `;
              setTimeout(() => toast.remove(), 2000);

              dialog.hide();
            } catch (error) {
              console.error("Error loading map:", error);
              // Error notification
              const toast = document.createElement("div");
              toast.style.position = "fixed";
              toast.style.bottom = "20px";
              toast.style.right = "20px";
              toast.style.zIndex = "1000";
              toast.style.backgroundColor = "#f44336";
              toast.style.color = "white";
              toast.style.padding = "10px 20px";
              toast.style.borderRadius = "4px";
              toast.innerHTML = `
            <span class="material-icons">error</span>
            <span>Error loading map: ${error.message}</span>
        `;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            }
          }
        });

        // Handle JSON file selection
        projectInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.loadProjectFile(file);
            dialog.hide();
          }
        });

        mapInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.loadMap(file);
            dialog.hide();
          }
        });

        resourceInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (file) {
            if (this.resourceManager) {
              const success = await this.resourceManager.loadResourcePack(file);
              if (success) {
                // alert("Resource pack loaded successfully");
                // this.showCustomToast("Resource pack loaded successfully", "success", 3000);
                this.showCustomToast("Resource pack loaded successfully", "success", 3000,"#333");
              } else {
                this.showCustomToast("Failed to load resource pack", "error", 3000);
                // this.showCustomToast("Failed to load resource pack", "error", 3000);
              }
            }
            // dialog.hide();
          }
        });


        // Button click handlers
        dialog.querySelector(".new-map-btn").addEventListener("click", () => {
          pictureInput.click();
          dialog.hide();
        });

        dialog.querySelector(".change-picture-btn").addEventListener("click", () => {
          pictureInput.click();
          dialog.hide();
        });

        dialog.querySelector(".load-project-btn").addEventListener("click", () => {
          projectInput.click();
        });

        dialog.querySelector(".load-map-btn").addEventListener("click", () => {
          mapInput.click();
        });

        dialog.querySelector(".load-resource-btn").addEventListener("click", () => {
          resourceInput.click();
        });



        // Add handler for recent projects button if it exists
        const recentProjectsBtn = dialog.querySelector('.recent-projects-btn');
        if (recentProjectsBtn) {
          recentProjectsBtn.addEventListener('click', () => {
            dialog.hide();
            this.showRecentProjectsDialog();
          });
        }

        // Clean up on close
        dialog.addEventListener("sl-after-hide", () => {
          dialog.remove();
          pictureInput.remove();
          projectInput.remove();
          mapInput.remove();
          resourceInput.remove();
        });

        // Show the dialog
        document.body.appendChild(dialog);
        dialog.show();
      });

      const saveProjectBtn = document.getElementById("saveProjectBtn");
      if (saveProjectBtn) {
        saveProjectBtn.addEventListener("click", () => {
          // Create dialog with save options
          const dialog = document.createElement("sl-dialog");
          dialog.label = "Save Options";
          dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <sl-button size="large" class="save-map-btnX" style="justify-content: flex-start;">
          <span slot="prefix" class="material-icons">map</span>
          Save Map Only
          <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
            Save only the map file (.map.json)
          </div>
        </sl-button>
        
        <sl-button size="large" class="save-project-btnX" style="justify-content: flex-start;">
          <span slot="prefix" class="material-icons">folder</span>
          Save Complete Project
          <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
            Save map, resources, and project file
          </div>
        </sl-button>
      </div>
    `;

          // Add event handlers for the dialog buttons
          dialog.querySelector(".save-map-btnX").addEventListener("click", async () => {
            await this.saveMap();
            dialog.hide();
          });

          dialog.querySelector(".save-project-btnX").addEventListener("click", async () => {
            await this.saveProjectFile();
            dialog.hide();
          });

          // Cleanup when dialog is closed
          dialog.addEventListener("sl-after-hide", () => {
            dialog.remove();
          });

          // Show the dialog
          document.body.appendChild(dialog);
          dialog.show();
        });
      }





    }

// Add preferences button handler
const preferencesBtn = document.getElementById("preferencesBtn");
if (preferencesBtn) {
  preferencesBtn.addEventListener("click", () => {
    this.showPreferencesDialog();
  });
}

// preferencesBtn.addEventListener("click", () => {
//   this.showPreferencesDialog();
// });

    // In MapEditor's event listener for create3d button
    const create3dBtn = document.getElementById("create3d");
    if (create3dBtn) {
      create3dBtn.addEventListener("click", () => {
        const sceneData = {
          rooms: this.rooms,
          textures: {
            wall: this.wallTextureRoom,
            room: this.roomTextureRoom
          },
          tokens: this.tokens,
          cellSize: this.cellSize,
          playerStart: this.playerStart,
          baseImage: this.baseImage,
          markers: this.markers,
          textureManager: this.textureManager  // Add this line
        };

        this.scene3D.initializeWithData(sceneData);
        this.scene3D.show3DView();
      });
    }

    const toolButtons = document.querySelectorAll(".tool-button");
    toolButtons.forEach((button) => {
      button.addEventListener("click", (e) => {

    //     if (e.target.closest('.room-controls') || 
    //     e.target.classList.contains('material-icons') ||
    //     e.target.classList.contains('confirm-btn') ||
    //     e.target.classList.contains('edit-btn') ||
    //     e.target.classList.contains('cancel-btn')) {
    //   console.log("Click on room control detected, ignoring");
    //   return; // Exit handler immediately
    // }


        switch (button.id) {
          case "selectionTool":
            this.setTool("selection");
            break;
          case "selectTool":
            this.setTool("rectangle");
            break;
          case "circleTool":
            this.setTool("circle");
            break;
          case "wallTool":
            this.setTool("wall");
            break;
          case "panTool":
            this.setTool("pan");
            break;
          case "centerMap":
            this.centerMap();
            break;
          case "zoomFit":
            this.zoomToFit();
            break;
          case "screenshotTool":
            this.takeScreenshot();
            break;
          case "freehandTool":
            this.setTool("freehand");
            break;
        // case "shapeForgeBtn":
        //   this.shapeForge.show();
        //   break;

        }
      });
    });

    this.setupMiddleClickHandlers();

    // Canvas events
    const wrapper = document.getElementById("canvasWrapper");
    if (wrapper) {
      wrapper.addEventListener(
        "mousedown",
        this.handleMouseDown.bind(this)
      );
      wrapper.addEventListener(
        "mousemove",
        this.handleMouseMove.bind(this)
      );
      wrapper.addEventListener("mouseup", this.handleMouseUp.bind(this));
      wrapper.addEventListener("wheel", this.handleWheel.bind(this));
    }

    document.getElementById("wallTool")?.addEventListener("click", () => {
      this.setTool("wall");
    });

    // First, get the marker tools container
    const markerToolsContainer = document.querySelector(".marker-tools");
    if (
      markerToolsContainer &&
      !document.getElementById("editMarkerTool")
    ) {
      const editMarkerBtn = document.createElement("div");
      editMarkerBtn.className = "tool-button";
      editMarkerBtn.id = "editMarkerTool";
      editMarkerBtn.setAttribute("data-tooltip", "Edit Markers [M]");
      editMarkerBtn.innerHTML = `<span class="material-icons">edit_location</span>`;
      markerToolsContainer.appendChild(editMarkerBtn);

      // Add edit marker button click handler
      editMarkerBtn.addEventListener("click", () => {
        this.toggleMarkerEditMode();
      });
    }

    // Add keyboard shortcut for marker edit mode
    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "m" &&
        !e.repeat &&
        e.target.tagName !== "INPUT"
      ) {
        this.toggleMarkerEditMode();
      }
    });

    document.addEventListener("keydown", (e) => {
      // Add escape key handler to cancel freehand drawing
      if (e.key === "Escape" && this.isFreehandDrawing) {
        this.cancelFreehandDrawing();
      }
    });

    // Marker tool type mapping
    const markerTools = {
      playerStartTool: "player-start",
      encounterTool: "encounter",
      treasureTool: "treasure",
      trapTool: "trap",
      teleportTool: "teleport",
      doorTool: "door",
      splashArtTool: "splash-art",       
      propTool: "prop",
      storyboardTriggerTool: "storyboard",
      dungeonTool: "dungeon"
    };

    Object.entries(markerTools).forEach(([toolId, markerType]) => {
      document.getElementById(toolId)?.addEventListener("click", () => {
        this.setTool(`marker-${markerType}`);
      });
    });

    // Add to your canvas click handler for marker placement
    document
      .getElementById("canvasWrapper")
      .addEventListener("click", (e) => {
        if (this.currentTool?.startsWith("marker-")) {
          const rect = this.canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left - this.offset.x) / this.scale;
          const y = (e.clientY - rect.top - this.offset.y) / this.scale;
          const markerType = this.currentTool.replace("marker-", "");
          this.addMarker(markerType, x, y);
        }
      });

    document.querySelector('.canvas-container').addEventListener('click', (e) => {

      if (e.target.closest('.room-controls') || 
      e.target.classList.contains('material-icons') ||
      e.target.tagName === 'BUTTON') {
    // Don't create markers when clicking controls
    return;
  }
      if (this.currentTool?.startsWith('marker-')) {
        // Prevent walls from blocking marker placement
        e.stopPropagation();

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;

        // Add the marker
        const markerType = this.currentTool.replace('marker-', '');
        this.addMarker(markerType, x, y);
      }
    }, true); // Use capture phase to handle click before walls

    // Modify the wall elements to allow click-through when placing markers
    const updateWallClickBehavior = () => {
      const walls = document.querySelectorAll('.room-block[data-type="wall"]');
      walls.forEach(wall => {
        wall.style.pointerEvents = this.currentTool?.startsWith('marker-') ? 'none' : 'auto';
      });
    };



    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault(); // Prevent opening dev tools
        this.takeScreenshot();
      }
    });

    window.addEventListener("resize", () => this.handleResize());
  }

  takeScreenshot() {
    // Show a loading indicator
    const loadingToast = document.createElement('div');
    loadingToast.textContent = 'Taking screenshot...';
    loadingToast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 10000;
    `;
    document.body.appendChild(loadingToast);

    // Determine if we're in 2D or 3D mode
    const is3DMode = !!document.querySelector('.drawer-3d-view[open]');

    if (is3DMode) {
      // 3D screenshot
      try {
        this.take3DScreenshot();
        loadingToast.remove();
      } catch (err) {
        console.error('Error taking 3D screenshot:', err);
        loadingToast.textContent = 'Error taking screenshot';
        setTimeout(() => loadingToast.remove(), 2000);
      }
    } else {
      // 2D screenshot
      if (typeof html2canvas !== 'undefined') {
        // Use html2canvas for 2D view
        const container = document.querySelector('.canvas-container');

        html2canvas(container, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: 1,
          logging: true,
        }).then(canvas => {
          this.processScreenshot(canvas, '2D_Map');
          loadingToast.remove();
        }).catch(err => {
          console.error('Error taking 2D screenshot:', err);
          loadingToast.textContent = 'Error taking screenshot';
          setTimeout(() => loadingToast.remove(), 2000);
        });
      } else {
        this.showCustomToast('Screenshot library not loaded, need html2canvas.', 'error', 3000);
        // alert('Screenshot library not loaded. Please add html2canvas to your project.');
        loadingToast.remove();
      }
    }
  }

  // For 3D screenshots
  take3DScreenshot() {
    // For 3D view, we capture the renderer output
    if (this.scene3D && this.scene3D.renderer) {
      // Make sure we're rendering the latest state
      this.scene3D.renderer.render(this.scene3D.scene, this.scene3D.camera);

      // Get the canvas and convert
      const canvas = this.scene3D.renderer.domElement;
      this.processScreenshot(canvas, '3D_View');
    } else {
      this.showCustomToast('3D view not initialized or renderer not available', 'error', 3000);
      // alert('3D view not initialized or renderer not available');
    }
  }

  // Process and download the screenshot
  processScreenshot(canvas, prefix) {
    try {
      // Create download link
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mapName = this.mapName || 'Map';
      link.download = `${mapName}_${prefix}_${timestamp}.png`;

      // Convert canvas to blob and trigger download
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success toast
        const toast = document.createElement('div');
        toast.textContent = 'Screenshot saved!';
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 10000;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('Error processing screenshot:', err);
      this.showCustomToast('Error saving screenshot: ' + err.message, 'error', 3000);
      // alert('Error saving screenshot: ' + err.message);
    }
  }


  // setTool(tool) {
  //   // First, clean up any active tool
  //   if (this.currentTool === "wall") {
  //     this.cleanupWallTool();
  //   } else if (this.currentTool === "freehand") {
  //     this.cleanupFreehandDrawing();
  //   }
    
  //   this.currentTool = tool;
  //   this.updateWallClickBehavior();
  
  //   // Update UI
  //   const toolButtons = document.querySelectorAll(".tool-button");
  //   toolButtons.forEach((button) => {
  //     button.classList.remove("active");
  //     if (
  //       (tool === "rectangle" && button.id === "selectTool") ||
  //       (tool === "circle" && button.id === "circleTool") ||
  //       (tool === "wall" && button.id === "wallTool") ||
  //       (tool === "freehand" && button.id === "freehandTool") ||
  //       (tool === "pan" && button.id === "panTool")
  //     ) {
  //       button.classList.add("active");
  //     }
  //   });
  
  //   if (tool === "wall") {
  //     this.startWallCreation();
  //   } else if (tool === "freehand") {
  //     this.startFreehandDrawing();
  //   }
  
  //   // Update cursor style
  //   const wrapper = document.getElementById("canvasWrapper");
  //   if (tool === "pan") {
  //     wrapper.style.cursor = "grab";
  //   } else if (["rectangle", "circle", "wall", "freehand"].includes(tool)) {
  //     wrapper.style.cursor = "crosshair";
  //   } else {
  //     wrapper.style.cursor = "default";
  //   }
  
  //   // Update room pointer events
  //   const rooms = document.querySelectorAll(".room-block");
  //   rooms.forEach((room) => {
  //     room.style.pointerEvents = tool.startsWith("marker-")
  //       ? "none"
  //       : "auto";
  //     room
  //       .querySelectorAll(".room-controls, .resize-handle")
  //       .forEach((element) => {
  //         element.style.pointerEvents = "auto";
  //       });
  //   });
  // }

  setTool(tool) {
    console.log(`Tool changing from "${this.currentTool}" to "${tool}"`);
    
    // Clean up any active tool
    if (this.currentTool === "wall") {
      this.cleanupWallTool();
    } else if (this.currentTool === "freehand") {
      this.cleanupFreehandDrawing();
    } else if (this.currentTool?.startsWith("marker-")) {
      // Clean up any marker tool state
      if (this.pendingTeleportPair && this.currentTool === "marker-teleport") {
        // Cleanup incomplete teleport pair
        console.log("Cleaning up incomplete teleport pair");
        if (this.pendingTeleportPair.element) {
          this.pendingTeleportPair.element.remove();
        }
        const index = this.markers.indexOf(this.pendingTeleportPair);
        if (index > -1) {
          this.markers.splice(index, 1);
        }
        this.pendingTeleportPair = null;
      }
    }
    
    this.currentTool = tool;
    
    // Update UI
    const toolButtons = document.querySelectorAll(".tool-button");
    toolButtons.forEach((button) => {
      button.classList.remove("active");
      
      // Add new selection tool to mappings
      if (
        (tool === "selection" && button.id === "selectionTool") ||
        (tool === "rectangle" && button.id === "selectTool") ||
        (tool === "circle" && button.id === "circleTool") ||
        (tool === "wall" && button.id === "wallTool") ||
        (tool === "freehand" && button.id === "freehandTool") ||
        (tool === "pan" && button.id === "panTool")
      ) {
        button.classList.add("active");
      }
    });
  
    // Tool-specific initialization
    if (tool === "wall") {
      this.startWallCreation();
    } else if (tool === "freehand") {
      this.startFreehandDrawing();
    }
  
    // Update cursor style
    const wrapper = document.getElementById("canvasWrapper");
    if (tool === "selection") {
      wrapper.style.cursor = "default"; // Default cursor for selection
    } else if (tool === "pan") {
      wrapper.style.cursor = "grab";
    } else if (["rectangle", "circle", "wall", "freehand"].includes(tool)) {
      wrapper.style.cursor = "crosshair";
    } else {
      wrapper.style.cursor = "default";
    }
  
    // Special handling for selection tool to make controls clickable
    const rooms = document.querySelectorAll(".room-block");
    rooms.forEach((room) => {
      // For selection tool, make sure controls are fully clickable
      if (tool === "selection") {
        room.style.pointerEvents = "auto";
        room.querySelectorAll(".room-controls, .room-controls *").forEach(el => {
          el.style.pointerEvents = "auto";
          el.style.cursor = "pointer";
        });
      } 
      // For marker tools, make rooms pass-through
      else if (tool.startsWith("marker-")) {
        room.style.pointerEvents = "none";
        room.querySelectorAll(".room-controls").forEach(el => {
          el.style.pointerEvents = "none";
        });
      }
      // Normal behavior for other tools
      else {
        room.style.pointerEvents = "auto";
        room.querySelectorAll(".room-controls, .resize-handle").forEach(el => {
          el.style.pointerEvents = "auto";
        });
      }
    });
  }

  updateWallClickBehavior() {
    const walls = document.querySelectorAll('.room-block[data-type="wall"]');
    walls.forEach(wall => {
      wall.style.pointerEvents = this.currentTool?.startsWith('marker-') ? 'none' : 'auto';
    });
  }

  handleResize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.render();
  }

  zoomToFit() {
    if (!this.baseImage) return;

    const container = this.canvas.parentElement;
    const scaleX = container.clientWidth / this.baseImage.width;
    const scaleY = container.clientHeight / this.baseImage.height;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.offset = {
      x: (container.clientWidth - this.baseImage.width * this.scale) / 2,
      y: (container.clientHeight - this.baseImage.height * this.scale) / 2
    };

    this.rooms.forEach((room) => room.updateElement());
    this.render();
  }

  startWallCreation() {
    if (!this.baseImage) {
      this.showCustomToast("Please load a map first", "warning", 3000);
      // alert("Please load a map first");
      return;
    }

    const wrapper = document.getElementById("canvasWrapper");

    // Remove any existing wall click handler
    if (this.wallClickHandler) {
      wrapper.removeEventListener("click", this.wallClickHandler);
    }

    // Create a new click handler
    this.wallClickHandler = (e) => {
      if (this.currentTool === "wall") {
        e.preventDefault();
        e.stopPropagation();
        this.handleWallClick(e);
      }
    };

    // Add the click handler
    wrapper.addEventListener("click", this.wallClickHandler);
  }

  handleWallClick(e) {
    // Similar to handlePolygonClick but creates wall areas
    const wrapper = document.getElementById("canvasWrapper");
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offset.x) / this.scale;
    const y = (e.clientY - rect.top - this.offset.y) / this.scale;

    if (!this.isDrawingPolygon) {
      // Start new wall polygon
      this.isDrawingPolygon = true;
      this.polygonPoints = [{ x, y }];

      // Create preview element
      this.polygonPreviewElement = document.createElement("div");
      this.polygonPreviewElement.className =
        "polygon-preview wall-preview";
      wrapper.appendChild(this.polygonPreviewElement);

      this.updatePolygonPreview();
    } else {
      // Check if near starting point to close wall
      const startPoint = this.polygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2)
      );

      if (distance < 20 / this.scale && this.polygonPoints.length > 2) {
        this.finalizeWall();
      } else {
        // Add new point
        this.polygonPoints.push({ x, y });
        this.updatePolygonPreview();
      }
    }
  }

  finalizeWall() {
    if (!this.isDrawingPolygon || this.polygonPoints.length < 3) return;

    // Calculate bounding box
    const xs = this.polygonPoints.map((p) => p.x);
    const ys = this.polygonPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Create wall room
    const wall = new Room(
      Date.now(),
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: this.polygonPoints.map((p) => ({
          x: p.x - minX,
          y: p.y - minY
        }))
      },
      "",
      "polygon",
      "wall" // Set type as wall
    );

    //   console.log("Created wall:", {
    //     id: wall.id,
    //     type: wall.type,
    //     name: wall.name
    //   });

    this.rooms.push(wall);
    const wallElement = wall.createDOMElement(this);
    document.querySelector(".canvas-container").appendChild(wallElement);
    this.layersPanel.updateLayersList();

    // Clean up
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    if (this.polygonPreviewElement) {
      this.polygonPreviewElement.remove();
      this.polygonPreviewElement = null;
    }
  }

  findNearestPointOnWall(x, y, wall) {
    // Rectangle walls - already working, just needs cleanup
    if (wall.shape === 'rectangle') {
      return this.findNearestPointOnRectangle(x, y, wall);
    }
    // Circle walls
    else if (wall.shape === 'circle') {
      return this.findNearestPointOnCircle(x, y, wall);
    }
    // Polygon walls
    else if (wall.shape === 'polygon' && wall.points && wall.points.length > 2) {
      return this.findNearestPointOnPolygon(x, y, wall);
    }
    
    // Fallback to current implementation
    return this.snapToStructure(x, y, wall);
  }

  findNearestPointOnRectangle(x, y, wall) {
    const rect = {
      left: wall.bounds.x,
      right: wall.bounds.x + wall.bounds.width,
      top: wall.bounds.y,
      bottom: wall.bounds.y + wall.bounds.height
    };
    
    // Find the closest point on the rectangle's perimeter
    let nearestX, nearestY, edge, rotation;
    
    // Determine closest edge
    const distToLeft = Math.abs(x - rect.left);
    const distToRight = Math.abs(x - rect.right);
    const distToTop = Math.abs(y - rect.top);
    const distToBottom = Math.abs(y - rect.bottom);
    
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    
    if (minDist === distToLeft) {
      nearestX = rect.left;
      nearestY = Math.max(rect.top, Math.min(rect.bottom, y));
      edge = 'left';
      rotation = 90; // Door faces left
    } else if (minDist === distToRight) {
      nearestX = rect.right;
      nearestY = Math.max(rect.top, Math.min(rect.bottom, y));
      edge = 'right';
      rotation = -90; // Door faces right
    } else if (minDist === distToTop) {
      nearestX = Math.max(rect.left, Math.min(rect.right, x));
      nearestY = rect.top;
      edge = 'top';
      rotation = 0; // Door faces up
    } else {
      nearestX = Math.max(rect.left, Math.min(rect.right, x));
      nearestY = rect.bottom;
      edge = 'bottom';
      rotation = 180; // Door faces down
    }
    
    return { x: nearestX, y: nearestY, edge, rotation };
  }
  
  findNearestPointOnCircle(x, y, wall) {
    // Calculate center of the circle
    const centerX = wall.bounds.x + wall.bounds.width / 2;
    const centerY = wall.bounds.y + wall.bounds.height / 2;
    
    // Calculate radius (assuming width and height are equal for circle)
    const radius = wall.bounds.width / 2;
    
    // Calculate angle from center to click point
    const dx = x - centerX;
    const dy = y - centerY;
    const angle = Math.atan2(dy, dx);
    
    // Find point on circle perimeter
    const nearestX = centerX + radius * Math.cos(angle);
    const nearestY = centerY + radius * Math.sin(angle);
    
    // Calculate rotation (perpendicular to radius)
    const rotation = (angle * 180 / Math.PI + 90) % 360;
    
    return { 
      x: nearestX, 
      y: nearestY, 
      edge: 'circle', 
      rotation: rotation 
    };
  }
  
  findNearestPointOnPolygon(x, y, wall) {
    // Adjust for polygon position
    const offsetX = x - wall.bounds.x;
    const offsetY = y - wall.bounds.y;
    
    let closestDist = Infinity;
    let closestPoint = null;
    let closestEdgeAngle = 0;
    
    // Check each edge of the polygon
    for (let i = 0; i < wall.points.length; i++) {
      const p1 = wall.points[i];
      const p2 = wall.points[(i + 1) % wall.points.length];
      
      // Find nearest point on this edge
      const result = this.pointToLineSegment(
        offsetX, offsetY, 
        p1.x, p1.y, 
        p2.x, p2.y
      );
      
      if (result.distance < closestDist) {
        closestDist = result.distance;
        closestPoint = {
          x: result.x + wall.bounds.x,
          y: result.y + wall.bounds.y
        };
        
        // Calculate edge angle for door rotation
        const edgeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        closestEdgeAngle = (edgeAngle * 180 / Math.PI + 90) % 360;
      }
    }
    
    return {
      x: closestPoint.x,
      y: closestPoint.y,
      edge: 'polygon',
      rotation: closestEdgeAngle
    };
  }
  
  // Helper function to find nearest point on a line segment
  pointToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return { x: xx, y: yy, distance: distance };
  }


  findNearestWall(x, y) {
    let nearest = null;
    let minDistance = Infinity;

    this.rooms.forEach(room => {
      if (room.type === 'wall') {
        const distance = this.getDistanceToWall(x, y, room);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = room;
        }
      }
    });

    return minDistance < this.cellSize ? nearest : null;
  }

  isNearWall(x, y, wall) {
    const threshold = this.cellSize;
    const dx = x - wall.bounds.x;
    const dy = y - wall.bounds.y;
    return dx >= -threshold && dx <= wall.bounds.width + threshold &&
      dy >= -threshold && dy <= wall.bounds.height + threshold;
  }

  getDistanceToWall(x, y, wall) {
    const rect = {
      left: wall.bounds.x,
      right: wall.bounds.x + wall.bounds.width,
      top: wall.bounds.y,
      bottom: wall.bounds.y + wall.bounds.height
    };

    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);

    return Math.sqrt(dx * dx + dy * dy);
  }

  snapToWall(x, y, wall) {
    const edges = {
      left: Math.abs(x - wall.bounds.x),
      right: Math.abs(x - (wall.bounds.x + wall.bounds.width)),
      top: Math.abs(y - wall.bounds.y),
      bottom: Math.abs(y - (wall.bounds.y + wall.bounds.height))
    };

    const closestEdge = Object.entries(edges).reduce((a, b) => a[1] < b[1] ? a : b)[0];

    switch (closestEdge) {
      case 'left': return { x: wall.bounds.x, y };
      case 'right': return { x: wall.bounds.x + wall.bounds.width, y };
      case 'top': return { x, y: wall.bounds.y };
      case 'bottom': return { x, y: wall.bounds.y + wall.bounds.height };
    }
  }

  findNearestStructure(x, y, type = 'both') {
    let nearest = null;
    let minDistance = Infinity;

    this.rooms.forEach(room => {
      // Check if we want this type of structure
      if (type === 'both' || type === room.type) {
        const distance = this.getDistanceToStructure(x, y, room);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = room;
        }
      }
    });

    // Return structure if within cell size distance
    return minDistance < this.cellSize ? nearest : null;
  }

  isNearStructure(x, y, structure) {
    const threshold = this.cellSize;
    const dx = x - structure.bounds.x;
    const dy = y - structure.bounds.y;
    return dx >= -threshold && dx <= structure.bounds.width + threshold &&
      dy >= -threshold && dy <= structure.bounds.height + threshold;
  }

  getDistanceToStructure(x, y, structure) {
    const rect = {
      left: structure.bounds.x,
      right: structure.bounds.x + structure.bounds.width,
      top: structure.bounds.y,
      bottom: structure.bounds.y + structure.bounds.height
    };

    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);

    return Math.sqrt(dx * dx + dy * dy);
  }

  snapToStructure(x, y, structure) {
    const edges = {
      left: Math.abs(x - structure.bounds.x),
      right: Math.abs(x - (structure.bounds.x + structure.bounds.width)),
      top: Math.abs(y - structure.bounds.y),
      bottom: Math.abs(y - (structure.bounds.y + structure.bounds.height))
    };

    // Find the closest edge
    const closestEdge = Object.entries(edges).reduce((a, b) => a[1] < b[1] ? a : b)[0];

    // Calculate snapped position and determine orientation
    const snappedPos = {
      x: x,
      y: y,
      edge: closestEdge,
      rotation: 0 // Add rotation property
    };

    switch (closestEdge) {
      case 'left':
        snappedPos.x = structure.bounds.x;
        snappedPos.y = y;
        snappedPos.rotation = 90; // Door faces left
        break;
      case 'right':
        snappedPos.x = structure.bounds.x + structure.bounds.width;
        snappedPos.y = y;
        snappedPos.rotation = -90; // Door faces right
        break;
      case 'top':
        snappedPos.x = x;
        snappedPos.y = structure.bounds.y;
        snappedPos.rotation = 0; // Door faces up
        break;
      case 'bottom':
        snappedPos.x = x;
        snappedPos.y = structure.bounds.y + structure.bounds.height;
        snappedPos.rotation = 180; // Door faces down
        break;
    }

    return snappedPos;
  }

  // startFreehandDrawing() {
  //   if (!this.baseImage) {
  //     this.showCustomToast("Please load a map first", "warning", 3000);
  //     return;
  //   }
  
  //   // Create preview element for freehand drawing
  //   this.freehandPreviewElement = document.createElement("div");
  //   this.freehandPreviewElement.className = "freehand-preview";
  //   document.querySelector(".canvas-container").appendChild(this.freehandPreviewElement);
    
  //   // Reset freehand points
  //   this.freehandPoints = [];
  //   this.lastFreehandPoint = null;
  //   this.isFreehandDrawing = true;
  //   this.freehandActive = false;
    
  //   // Set cursor
  //   const wrapper = document.getElementById("canvasWrapper");
  //   wrapper.style.cursor = "crosshair";
    
  //   // Add mouse handlers for freehand drawing
  //   this.setupFreehandMouseHandlers();
  // }
  
  // setupFreehandMouseHandlers() {
  //   const wrapper = document.getElementById("canvasWrapper");
    
  //   // Create mousedown handler
  //   this.freehandMouseDownHandler = (e) => {
  //     if (e.button !== 0) return; // Only respond to left mouse button
  //     e.preventDefault();
  //     e.stopPropagation();
      
  //     this.freehandActive = true;
  //     const rect = wrapper.getBoundingClientRect();
  //     const x = (e.clientX - rect.left - this.offset.x) / this.scale;
  //     const y = (e.clientY - rect.top - this.offset.y) / this.scale;
      
  //     // Add first point
  //     this.freehandPoints.push({ x, y });
  //     this.lastFreehandPoint = { x, y };
  //     this.updateFreehandPreview();
  //   };
    
  //   // Create mousemove handler
  //   this.freehandMouseMoveHandler = (e) => {
  //     if (!this.freehandActive) return;
      
  //     const rect = wrapper.getBoundingClientRect();
  //     const x = (e.clientX - rect.left - this.offset.x) / this.scale;
  //     const y = (e.clientY - rect.top - this.offset.y) / this.scale;
      
  //     // Only add points if we've moved far enough
  //     if (this.lastFreehandPoint) {
  //       const distance = Math.sqrt(
  //         Math.pow(x - this.lastFreehandPoint.x, 2) + 
  //         Math.pow(y - this.lastFreehandPoint.y, 2)
  //       );
        
  //       // Calculate minimum distance based on grid cell size
  //       const minDistance = this.cellSize ? this.cellSize / 4 : this.freehandMinDistance;
        
  //       if (distance >= minDistance) {
  //         this.freehandPoints.push({ x, y });
  //         this.lastFreehandPoint = { x, y };
  //         this.updateFreehandPreview();
  //       }
  //     }
  //   };
    
  //   // Create mouseup handler
  //   this.freehandMouseUpHandler = (e) => {
  //     if (e.button !== 0) return; // Only respond to left mouse button
      
  //     this.freehandActive = false;
      
  //     // If we have enough points and the path is almost closed, finalize it
  //     if (this.freehandPoints.length > 3) {
  //       const first = this.freehandPoints[0];
  //       const last = this.freehandPoints[this.freehandPoints.length - 1];
  //       const distance = Math.sqrt(
  //         Math.pow(last.x - first.x, 2) + 
  //         Math.pow(last.y - first.y, 2)
  //       );
        
  //       if (distance < this.cellSize / 2) {
  //         // Close the path
  //         this.finalizeFreehandDrawing();
  //       }
  //     }
  //   };
    
  //   // Add right click handler for cancellation
  //   this.freehandContextMenuHandler = (e) => {
  //     if (this.isFreehandDrawing) {
  //       e.preventDefault();
  //       this.showFreehandCancelDialog();
  //       return false;
  //     }
  //   };
    
  //   // Add handlers to wrapper
  //   wrapper.addEventListener("mousedown", this.freehandMouseDownHandler);
  //   wrapper.addEventListener("mousemove", this.freehandMouseMoveHandler);
  //   wrapper.addEventListener("mouseup", this.freehandMouseUpHandler);
  //   wrapper.addEventListener("contextmenu", this.freehandContextMenuHandler);
  // }
  
  // updateFreehandPreview() {
  //   if (!this.freehandPreviewElement || this.freehandPoints.length === 0) return;
    
  //   // Create SVG path string
  //   let pathData = "";
  //   this.freehandPoints.forEach((point, index) => {
  //     const x = point.x * this.scale + this.offset.x;
  //     const y = point.y * this.scale + this.offset.y;
  //     pathData += index === 0 ? `M ${x},${y} ` : `L ${x},${y} `;
  //   });
    
  //   // Update preview element
  //   this.freehandPreviewElement.style.cssText = `
  //     position: absolute;
  //     top: 0;
  //     left: 0;
  //     width: 100%;
  //     height: 100%;
  //     pointer-events: none;
  //   `;
    
  //   this.freehandPreviewElement.innerHTML = `
  //     <svg style="width: 100%; height: 100%;">
  //       <path d="${pathData}" 
  //             stroke="#4CAF50" 
  //             stroke-width="2" 
  //             fill="rgba(76, 175, 80, 0.2)" 
  //             stroke-dasharray="4 4"/>
  //     </svg>
  //   `;
    
  //   // Add point markers for visual feedback
  //   this.freehandPoints.forEach((point, index) => {
  //     // Only show every 3rd point to avoid clutter
  //     if (index % 3 === 0 || index === this.freehandPoints.length - 1) {
  //       const marker = document.createElement("div");
  //       marker.className = "freehand-point";
  //       marker.style.cssText = `
  //         position: absolute;
  //         width: 6px;
  //         height: 6px;
  //         background: #4CAF50;
  //         border: 1px solid white;
  //         border-radius: 50%;
  //         transform: translate(-50%, -50%);
  //         left: ${point.x * this.scale + this.offset.x}px;
  //         top: ${point.y * this.scale + this.offset.y}px;
  //         ${index === 0 ? "background: white; border-color: #4CAF50;" : ""}
  //       `;
  //       this.freehandPreviewElement.appendChild(marker);
  //     }
  //   });
  // }
  
  // finalizeFreehandDrawing() {
  //   if (!this.isFreehandDrawing || this.freehandPoints.length < 3) return;
  
  //   // Optional - simplify the polygon to reduce number of points
  //   const simplifiedPoints = this.simplifyFreehandPoints(this.freehandPoints);
    
  //   // Calculate bounding box
  //   const xs = simplifiedPoints.map((p) => p.x);
  //   const ys = simplifiedPoints.map((p) => p.y);
  //   const minX = Math.min(...xs);
  //   const maxX = Math.max(...xs);
  //   const minY = Math.min(...ys);
  //   const maxY = Math.max(...ys);
  
  //   // Create wall room
  //   const freehandWall = new Room(
  //     Date.now(),
  //     {
  //       x: minX,
  //       y: minY,
  //       width: maxX - minX,
  //       height: maxY - minY,
  //       points: simplifiedPoints.map((p) => ({
  //         x: p.x - minX,
  //         y: p.y - minY
  //       }))
  //     },
  //     "Freehand Wall",
  //     "polygon",
  //     "wall" // Set type as wall
  //   );
  
  //   console.log("Created freehand wall with", simplifiedPoints.length, "points");
  
  //   this.rooms.push(freehandWall);
  //   const wallElement = freehandWall.createDOMElement(this);
  //   document.querySelector(".canvas-container").appendChild(wallElement);
  //   this.layersPanel.updateLayersList();
  
  //   // Clean up
  //   this.cleanupFreehandDrawing();
  // }
  
  // Add these methods to the MapEditor class to implement the freehand drawing stabilizer

// Initialize the freehand drawing with stabilization support
startFreehandDrawing() {
  if (!this.baseImage) {
    this.showCustomToast("Please load a map first", "warning", 3000);
    return;
  }

  // Create preview element for freehand drawing
  this.freehandPreviewElement = document.createElement("div");
  this.freehandPreviewElement.className = "freehand-preview";
  document.querySelector(".canvas-container").appendChild(this.freehandPreviewElement);
  
  // Reset freehand points and state
  this.freehandPoints = [];
  this.stabilizedPoints = []; // New array for stabilized points
  this.lastFreehandPoint = null;
  this.isFreehandDrawing = true;
  this.freehandActive = false;
  
  // Get stabilizer settings from editor preferences
  const editorPrefs = JSON.parse(localStorage.getItem('editorPreferences') || '{}');
  this.useStabilizer = editorPrefs.freehandStabilizer || false;
  this.stabilizerStrength = editorPrefs.freehandSensitivity || 0.5;
  
  // Set cursor
  const wrapper = document.getElementById("canvasWrapper");
  wrapper.style.cursor = "crosshair";
  
  // Add mouse handlers for freehand drawing
  this.setupFreehandMouseHandlers();
}

// Modified setupFreehandMouseHandlers to support stabilization
setupFreehandMouseHandlers() {
  const wrapper = document.getElementById("canvasWrapper");
  
  // Create mousedown handler
  this.freehandMouseDownHandler = (e) => {
    if (e.button !== 0) return; // Only respond to left mouse button
    e.preventDefault();
    e.stopPropagation();
    
    this.freehandActive = true;
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offset.x) / this.scale;
    const y = (e.clientY - rect.top - this.offset.y) / this.scale;
    
    // Add first point
    this.freehandPoints.push({ x, y });
    this.stabilizedPoints.push({ x, y }); // Initial point is the same
    this.lastFreehandPoint = { x, y };
    this.updateFreehandPreview();
  };
  
  // Create mousemove handler with stabilization
  this.freehandMouseMoveHandler = (e) => {
    if (!this.freehandActive) return;
    
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offset.x) / this.scale;
    const y = (e.clientY - rect.top - this.offset.y) / this.scale;
    
    // Only add points if we've moved far enough
    if (this.lastFreehandPoint) {
      const distance = Math.sqrt(
        Math.pow(x - this.lastFreehandPoint.x, 2) + 
        Math.pow(y - this.lastFreehandPoint.y, 2)
      );
      
      // Calculate minimum distance based on grid cell size
      const minDistance = this.cellSize ? this.cellSize / 4 : this.freehandMinDistance;
      
      if (distance >= minDistance) {
        // Add the raw point
        this.freehandPoints.push({ x, y });
        this.lastFreehandPoint = { x, y };
        
        // Calculate stabilized point if stabilizer is enabled
        if (this.useStabilizer && this.freehandPoints.length > 1) {
          const newStabilizedPoint = this.calculateStabilizedPoint();
          this.stabilizedPoints.push(newStabilizedPoint);
        } else {
          // If stabilizer is off, just use the raw point
          this.stabilizedPoints.push({ x, y });
        }
        
        this.updateFreehandPreview();
      }
    }
  };
  
  // Create mouseup handler
  this.freehandMouseUpHandler = (e) => {
    if (e.button !== 0) return; // Only respond to left mouse button
    
    this.freehandActive = false;
    
    // If we have enough points and the path is almost closed, finalize it
    if (this.stabilizedPoints.length > 3) {
      const first = this.stabilizedPoints[0];
      const last = this.stabilizedPoints[this.stabilizedPoints.length - 1];
      const distance = Math.sqrt(
        Math.pow(last.x - first.x, 2) + 
        Math.pow(last.y - first.y, 2)
      );
      
      if (distance < this.cellSize / 2) {
        // Close the path
        this.finalizeFreehandDrawing();
      }
    }
  };
  
  // Add right click handler for cancellation
  this.freehandContextMenuHandler = (e) => {
    if (this.isFreehandDrawing) {
      e.preventDefault();
      this.showFreehandCancelDialog();
      return false;
    }
  };
  
  // Add handlers to wrapper
  wrapper.addEventListener("mousedown", this.freehandMouseDownHandler);
  wrapper.addEventListener("mousemove", this.freehandMouseMoveHandler);
  wrapper.addEventListener("mouseup", this.freehandMouseUpHandler);
  wrapper.addEventListener("contextmenu", this.freehandContextMenuHandler);
}

// New method to calculate stabilized points using weighted average
calculateStabilizedPoint() {
  const numPoints = this.freehandPoints.length;
  const rawPoint = this.freehandPoints[numPoints - 1];
  
  if (numPoints < 3) {
    return rawPoint; // Not enough points to stabilize yet
  }
  
  // Get the last stabilized point
  const lastStabilized = this.stabilizedPoints[this.stabilizedPoints.length - 1];
  
  // Calculate weighted average
  // Stabilizer strength determines how much weight to give to the previous point
  // Higher strength = smoother lines but less responsive
  const strength = this.stabilizerStrength;
  
  return {
    x: rawPoint.x * (1 - strength) + lastStabilized.x * strength,
    y: rawPoint.y * (1 - strength) + lastStabilized.y * strength
  };
}

// Modified updateFreehandPreview to use stabilized points
updateFreehandPreview() {
  if (!this.freehandPreviewElement || this.stabilizedPoints.length === 0) return;
  
  // Use stabilizedPoints for drawing
  const pointsToUse = this.stabilizedPoints;
  
  // Create SVG path string
  let pathData = "";
  pointsToUse.forEach((point, index) => {
    const x = point.x * this.scale + this.offset.x;
    const y = point.y * this.scale + this.offset.y;
    pathData += index === 0 ? `M ${x},${y} ` : `L ${x},${y} `;
  });
  
  // Update preview element
  this.freehandPreviewElement.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;
  
  this.freehandPreviewElement.innerHTML = `
    <svg style="width: 100%; height: 100%;">
      <path d="${pathData}" 
            stroke="#4CAF50" 
            stroke-width="2" 
            fill="rgba(76, 175, 80, 0.2)" 
            stroke-dasharray="4 4"/>
    </svg>
  `;
  
  // Add point markers for visual feedback (we'll show fewer points with stabilizer on)
  const skipInterval = this.useStabilizer ? 6 : 3; // Show fewer points when stabilizer is on
  pointsToUse.forEach((point, index) => {
    // Only show some points to avoid clutter
    if (index % skipInterval === 0 || index === pointsToUse.length - 1) {
      const marker = document.createElement("div");
      marker.className = "freehand-point";
      marker.style.cssText = `
        position: absolute;
        width: 6px;
        height: 6px;
        background: #4CAF50;
        border: 1px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        left: ${point.x * this.scale + this.offset.x}px;
        top: ${point.y * this.scale + this.offset.y}px;
        ${index === 0 ? "background: white; border-color: #4CAF50;" : ""}
      `;
      this.freehandPreviewElement.appendChild(marker);
    }
  });
}

// Modified finalizeFreehandDrawing to use stabilized points
finalizeFreehandDrawing() {
  if (!this.isFreehandDrawing || this.stabilizedPoints.length < 3) return;

  // Use simplified stabilized points
  const pointsToUse = this.simplifyFreehandPoints(this.stabilizedPoints);
  
  // Calculate bounding box
  const xs = pointsToUse.map((p) => p.x);
  const ys = pointsToUse.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Create wall room
  const freehandWall = new Room(
    Date.now(),
    {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: pointsToUse.map((p) => ({
        x: p.x - minX,
        y: p.y - minY
      }))
    },
    "Freehand Wall",
    "polygon",
    "wall" // Set type as wall
  );

  console.log("Created freehand wall with", pointsToUse.length, "points");

  this.rooms.push(freehandWall);
  const wallElement = freehandWall.createDOMElement(this);
  document.querySelector(".canvas-container").appendChild(wallElement);
  this.layersPanel.updateLayersList();

  // Clean up
  this.cleanupFreehandDrawing();
}

  // Simplify freehand points using a basic algorithm
  // original code
  simplifyFreehandPoints(points) {
    // Very basic simplification to remove points that are too close together
    // For a more advanced algorithm, Douglas-Peucker could be implemented
    
    // Use different tolerance based on zoom level
    const tolerance = this.cellSize ? this.cellSize / 10 : 5;
    
    if (points.length <= 3) return points;
    
    const result = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + 
        Math.pow(curr.y - prev.y, 2)
      );
      
      if (distance > tolerance) {
        result.push(curr);
      }
    }
    
    // If simplified too much, return original
    if (result.length < 3) return points;
    
    // Ensure the path is closed by adding the first point as the last one
    // if it's not already closed
    const first = result[0];
    const last = result[result.length - 1];
    const distance = Math.sqrt(
      Math.pow(last.x - first.x, 2) + 
      Math.pow(last.y - first.y, 2)
    );
    
    if (distance > tolerance) {
      result.push({ ...first });
    }
    
    return result;
  }
  
  cancelFreehandDrawing() {
    this.cleanupFreehandDrawing();
    this.showCustomToast("Freehand drawing cancelled", "info", 2000);
  }
  
  cleanupFreehandDrawing() {
    // Remove preview element
    if (this.freehandPreviewElement) {
      this.freehandPreviewElement.remove();
      this.freehandPreviewElement = null;
    }
    
    // Remove event handlers
    const wrapper = document.getElementById("canvasWrapper");
    if (this.freehandMouseDownHandler) {
      wrapper.removeEventListener("mousedown", this.freehandMouseDownHandler);
    }
    if (this.freehandMouseMoveHandler) {
      wrapper.removeEventListener("mousemove", this.freehandMouseMoveHandler);
    }
    if (this.freehandMouseUpHandler) {
      wrapper.removeEventListener("mouseup", this.freehandMouseUpHandler);
    }
    if (this.freehandContextMenuHandler) {
      wrapper.removeEventListener("contextmenu", this.freehandContextMenuHandler);
    }
    
    // Reset state
    this.isFreehandDrawing = false;
    this.freehandPoints = [];
    this.lastFreehandPoint = null;
    this.freehandActive = false;
    
    // Reset cursor
    wrapper.style.cursor = "default";
  }
  
  showFreehandCancelDialog() {
    // Create dialog to ask user if they want to quit or finalize
    const dialog = document.createElement("sl-dialog");
    dialog.label = "Freehand Drawing";
    
    dialog.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <p>What would you like to do with your current drawing?</p>
      </div>
      <div slot="footer" style="display: flex; gap: 10px; justify-content: flex-end;">
        <sl-button class="cancel-btn" variant="danger">
          <span class="material-icons" slot="prefix">delete</span>
          Cancel Drawing
        </sl-button>
        <sl-button class="finalize-btn" variant="success">
          <span class="material-icons" slot="prefix">check_circle</span>
          Complete Drawing
        </sl-button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add handlers
    dialog.querySelector(".cancel-btn").addEventListener("click", () => {
      this.cancelFreehandDrawing();
      dialog.hide();
    });
    
    dialog.querySelector(".finalize-btn").addEventListener("click", () => {
      this.finalizeFreehandDrawing();
      dialog.hide();
    });
    
    dialog.addEventListener("sl-after-hide", () => {
      dialog.remove();
    });
    
    dialog.show();
  }

  startCircleRoom() {
    if (!this.baseImage) {
      this.showCustomToast("Please load a map first", "warning", 3000);
      // alert("Please load a map first");
      return;
    }

    let roomSize;
    if (this.cellSize) {
      // Use one grid cell as the initial size
      roomSize = this.cellSize;
    } else {
      // Fallback to default size
      roomSize = 100;
    }

    const room = new Room(
      Date.now(),
      {
        x: this.canvas.width / 2 - roomSize / 2,
        y: this.canvas.height / 2 - roomSize / 2,
        width: roomSize,
        height: roomSize
      },
      "",
      "circle",
      "wall" // Set type as wall
    );

    this.rooms.push(room);
    const roomElement = room.createDOMElement(this);
    document.querySelector(".canvas-container").appendChild(roomElement);
    this.layersPanel.updateLayersList();
  }

  startRoomCreation() {
    if (!this.baseImage) {
      this.showCustomToast("Please load a map first", "warning", 3000);
      // alert("Please load a map first");
      return;
    }

    let roomSize;
    if (this.cellSize) {
      // Use one grid cell as the initial size
      roomSize = this.cellSize;
      // console.log("Room size:", roomSize);
      // console.log("Cell size:", this.cellSize);
    } else {
      // Fallback to default size
      roomSize = 100;
    }

    // Get mouse position
    const wrapper = document.getElementById("canvasWrapper");
    const rect = wrapper.getBoundingClientRect();

    // Snap to grid
    const x = this.snapToGrid(
      (event.clientX - rect.left - this.offset.x) / this.scale,
      this.cellSize
    );
    const y = this.snapToGrid(
      (event.clientY - rect.top - this.offset.y) / this.scale,
      this.cellSize
    );

    // If polygon tool is selected, set up click handling for points
    if (this.currentTool === "polygon") {
      // Start listening for clicks on the canvas wrapper
      const wrapper = document.getElementById("canvasWrapper");
      const clickHandler = (e) => {
        if (this.currentTool === "polygon") {
          this.handlePolygonClick(e);
        }
      };

      wrapper.addEventListener("click", clickHandler);

      // Store the handler so we can remove it later
      this.polygonClickHandler = clickHandler;
      return;
    }

    const room = new Room(
      Date.now(),
      {
        x: this.canvas.width / 2 - roomSize / 2,
        y: this.canvas.height / 2 - roomSize / 2,
        width: roomSize,
        height: roomSize
      },
      "",
      this.currentTool,
      "wall" // Set type as wall
    );

    // Add room to collection
    this.rooms.push(room);

    // Create and add the room element
    const roomElement = room.createDOMElement(this);
    document.querySelector(".canvas-container").appendChild(roomElement);

    // Immediately set room as editable
    room.updateEditState(true);

    // Update layers panel
    this.layersPanel.updateLayersList();

    // Set this as the selected room
    this.selectedRoomId = room.id;
  }

  handlePolygonClick(e) {
    const wrapper = document.getElementById("canvasWrapper");
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offset.x) / this.scale;
    const y = (e.clientY - rect.top - this.offset.y) / this.scale;

    if (!this.isDrawingPolygon) {
      // Start new polygon
      this.isDrawingPolygon = true;
      this.polygonPoints = [{ x, y }];

      // Create preview element
      this.polygonPreviewElement = document.createElement("div");
      this.polygonPreviewElement.className = "polygon-preview";
      wrapper.appendChild(this.polygonPreviewElement);

      this.updatePolygonPreview();
    } else {
      // Check if near starting point to close polygon
      const startPoint = this.polygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2)
      );

      if (distance < 20 / this.scale && this.polygonPoints.length > 2) {
        this.finalizePolygon();
        // Remove click handler when polygon is complete
        if (this.polygonClickHandler) {
          wrapper.removeEventListener("click", this.polygonClickHandler);
          this.polygonClickHandler = null;
        }
      } else {
        // Add new point
        this.polygonPoints.push({ x, y });
        this.updatePolygonPreview();
      }
    }
  }

  startPolygonRoom(e) {
    if (!this.baseImage) {
      this.showCustomToast("Please load a map first", "warning", 3000);
      // alert("Please load a map first");
      return;
    }

    const wrapper = document.getElementById("canvasWrapper");
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offset.x) / this.scale;
    const y = (e.clientY - rect.top - this.offset.y) / this.scale;

    if (!this.isDrawingPolygon) {
      // Start new polygon
      this.isDrawingPolygon = true;
      this.polygonPoints = [{ x, y }];

      // Create preview element
      this.polygonPreviewElement = document.createElement("div");
      this.polygonPreviewElement.className = "polygon-preview";
      wrapper.appendChild(this.polygonPreviewElement);

      // Add preview line
      const previewLine = document.createElement("div");
      previewLine.className = "preview-line";
      this.polygonPreviewElement.appendChild(previewLine);

      this.updatePolygonPreview();
    } else {
      // Check if near starting point to close polygon
      const startPoint = this.polygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2)
      );

      if (distance < 20 / this.scale && this.polygonPoints.length > 2) {
        this.finalizePolygon();
      } else {
        // Add new point
        this.polygonPoints.push({ x, y });
        this.updatePolygonPreview();
      }
    }
  }

  updatePolygonPreview() {
    if (!this.polygonPreviewElement) return;

    // Create SVG path string
    let pathData = "";
    this.polygonPoints.forEach((point, index) => {
      const x = point.x * this.scale + this.offset.x;
      const y = point.y * this.scale + this.offset.y;
      pathData += index === 0 ? `M ${x},${y} ` : `L ${x},${y} `;
    });

    // Add preview line to cursor if we have a preview point
    if (this.previewPoint && this.polygonPoints.length > 0) {
      const lastPoint = this.polygonPoints[this.polygonPoints.length - 1];
      const x = this.previewPoint.x * this.scale + this.offset.x;
      const y = this.previewPoint.y * this.scale + this.offset.y;
      pathData += `L ${x},${y}`;
    }

    // Update preview element
    this.polygonPreviewElement.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    `;

    this.polygonPreviewElement.innerHTML = `
        <svg style="width: 100%; height: 100%;">
            <path d="${pathData}" 
                  stroke="white" 
                  stroke-width="2" 
                  fill="none" 
                  stroke-dasharray="4 4"/>
        </svg>
    `;

    // Add point markers
    this.polygonPoints.forEach((point, index) => {
      const marker = document.createElement("div");
      marker.className = "polygon-point";
      marker.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: white;
            border: 1px solid #333;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            left: ${point.x * this.scale + this.offset.x}px;
            top: ${point.y * this.scale + this.offset.y}px;
            ${index === 0 ? "background: #4CAF50;" : ""}
        `;
      this.polygonPreviewElement.appendChild(marker);
    });
  }

  finalizePolygon() {
    if (!this.isDrawingPolygon || this.polygonPoints.length < 3) return;

    // Calculate bounding box
    const xs = this.polygonPoints.map((p) => p.x);
    const ys = this.polygonPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Create room with polygon points
    const room = new Room(
      Date.now(),
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: this.polygonPoints.map((p) => ({
          x: p.x - minX,
          y: p.y - minY
        }))
      },
      "",
      "polygon",
      "wall" // Set type as wall
    );

    this.rooms.push(room);
    const roomElement = room.createDOMElement(this);
    document.querySelector(".canvas-container").appendChild(roomElement);
    this.layersPanel.updateLayersList();

    // Clean up
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    if (this.polygonPreviewElement) {
      this.polygonPreviewElement.remove();
      this.polygonPreviewElement = null;
    }
  }

  cancelPolygonDrawing() {
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    if (this.polygonPreviewElement) {
      this.polygonPreviewElement.remove();
      this.polygonPreviewElement = null;
    }
  }

  cleanupPolygonTool() {
    if (this.polygonClickHandler) {
      const wrapper = document.getElementById("canvasWrapper");
      wrapper.removeEventListener("click", this.polygonClickHandler);
      this.polygonClickHandler = null;
    }
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    if (this.polygonPreviewElement) {
      this.polygonPreviewElement.remove();
      this.polygonPreviewElement = null;
    }
  }


  startDragging(room, e) {
    if (room.locked) {
      this.showLockedMessage();
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...room.bounds };

    // Get all connected rooms recursively
    const getAllConnectedRooms = (roomId, visited = new Set()) => {
      if (visited.has(roomId)) return [];
      visited.add(roomId);

      const connected = [];
      const directConnections = this.dockedRooms.get(roomId) || [];

      directConnections.forEach(({ room: dockedRoom }) => {
        connected.push(dockedRoom);
        // Get rooms docked to this room recursively
        const subConnected = getAllConnectedRooms(dockedRoom.id, visited);
        connected.push(...subConnected);
      });

      return connected;
    };

    // Get all connected rooms at the start
    const connectedRooms = getAllConnectedRooms(room.id);

    const moveHandler = (e) => {
      const dx = (e.clientX - startX) / this.scale;
      const dy = (e.clientY - startY) / this.scale;

      // Calculate new position with grid snapping
      const newX = this.snapToGrid(startBounds.x + dx, this.cellSize);
      const newY = this.snapToGrid(startBounds.y + dy, this.cellSize);

      // Move the main room
      room.bounds.x = newX;
      room.bounds.y = newY;
      room.updateElement();

      // Move all connected rooms while maintaining their relative positions
      connectedRooms.forEach(connectedRoom => {
        const docking = this.dockedRooms.get(connectedRoom.id)?.[0];
        if (docking) {
          const offset = this.calculateDockOffset(connectedRoom, docking.room, docking.position);
          connectedRoom.bounds.x = docking.room.bounds.x + offset.x;
          connectedRoom.bounds.y = docking.room.bounds.y + offset.y;
          connectedRoom.updateElement();
        }
      });
    };

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }



  startResizing(room, handle, e) {
    if (room.locked) {
      this.showLockedMessage();
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...room.bounds };
    // Store initial points with their absolute positions
    const startPoints = room.points ? room.points.map(p => ({
      x: p.x + startBounds.x, // Store absolute coordinates
      y: p.y + startBounds.y
    })) : null;

    const moveHandler = (e) => {
      const dx = (e.clientX - startX) / this.scale;
      const dy = (e.clientY - startY) / this.scale;

      // Calculate new bounds
      let newX = startBounds.x;
      let newY = startBounds.y;
      let newWidth = startBounds.width;
      let newHeight = startBounds.height;

      if (handle.includes('e')) {
        newWidth = this.snapToGrid(startBounds.width + dx, this.cellSize);
      }
      if (handle.includes('w')) {
        const snappedDx = this.snapToGrid(dx, this.cellSize);
        newX = startBounds.x + snappedDx;
        newWidth = startBounds.width - snappedDx;
      }
      if (handle.includes('s')) {
        newHeight = this.snapToGrid(startBounds.height + dy, this.cellSize);
      }
      if (handle.includes('n')) {
        const snappedDy = this.snapToGrid(dy, this.cellSize);
        newY = startBounds.y + snappedDy;
        newHeight = startBounds.height - snappedDy;
      }

      // Update room bounds
      room.bounds.x = newX;
      room.bounds.y = newY;

      if (room.name.startsWith("Prop-")) {
        // Props can be any size, just prevent negative values
        room.bounds.width = Math.max(newWidth, 1);
        room.bounds.height = Math.max(newHeight, 1);
      } else {
        // Regular rooms maintain minimum cell size
        room.bounds.width = Math.max(newWidth, this.cellSize || 20);
        room.bounds.height = Math.max(newHeight, this.cellSize || 20);
      }

      // Update polygon points if this is a polygon room
      if (room.shape === 'polygon' && startPoints) {
        // Calculate scale factors
        const scaleX = room.bounds.width / startBounds.width;
        const scaleY = room.bounds.height / startBounds.height;

        // Update points while maintaining relative positions
        room.points = startPoints.map(p => ({
          x: ((p.x - startBounds.x) * scaleX) + (room.bounds.x - startBounds.x),
          y: ((p.y - startBounds.y) * scaleY) + (room.bounds.y - startBounds.y)
        }));
      }

      room.updateElement();
    };

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }

  handleMouseDown(e) {
    // Middle mouse button (wheel) press for panning
    if (e.button === 1) {
      // 1 is middle mouse button
      e.preventDefault(); // Prevent default middle-click behavior
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      const wrapper = document.getElementById("canvasWrapper");
      wrapper.style.cursor = "grabbing";
      return;
    }

    // Handle regular tools (rectangle and circle)
    if (
      ["rectangle", "circle"].includes(this.currentTool) &&
      e.button === 0
    ) {
      const wrapper = document.getElementById("canvasWrapper");
      const rect = wrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.offset.x) / this.scale;
      const y = (e.clientY - rect.top - this.offset.y) / this.scale;

      let roomSize;
      if (this.cellSize) {
        roomSize = this.cellSize;
      } else {
        roomSize = 100;
      }

      const room = new Room(
        Date.now(),
        {
          x: x - roomSize / 2,
          y: y - roomSize / 2,
          width: roomSize,
          height: roomSize
        },
        "",
        this.currentTool
      );

      this.rooms.push(room);
      const roomElement = room.createDOMElement(this);
      document
        .querySelector(".canvas-container")
        .appendChild(roomElement);
      room.updateEditState(true);
      this.layersPanel.updateLayersList();
      this.selectedRoomId = room.id;
    }
  }

  cleanupWallTool() {
    const wrapper = document.getElementById("canvasWrapper");
    if (this.wallClickHandler) {
      wrapper.removeEventListener("click", this.wallClickHandler);
      this.wallClickHandler = null;
    }
    this.isDrawingPolygon = false;
    this.polygonPoints = [];
    if (this.polygonPreviewElement) {
      this.polygonPreviewElement.remove();
      this.polygonPreviewElement = null;
    }
  }

  handleMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;

      this.offset.x += dx;
      this.offset.y += dy;

      this.dragStart = { x: e.clientX, y: e.clientY };

      // Update room positions
      this.rooms.forEach((room) => {
        room.updateElement(this.scale, this.offset);
      });

      // Update marker positions
      this.updateMarkerPositions();

      // Handle polygon preview if active
      if (this.isDrawingPolygon) {
        const rect = e.target.getBoundingClientRect();
        this.previewPoint = {
          x: (e.clientX - rect.left - this.offset.x) / this.scale,
          y: (e.clientY - rect.top - this.offset.y) / this.scale
        };
        this.updatePolygonPreview();
      }

      this.render();
    }
  }

  // Update handleMouseUp to reset cursor
  handleMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      const wrapper = document.getElementById("canvasWrapper");
      wrapper.style.cursor =
        this.currentTool === "wall" ? "crosshair" : "default";
    }
  }

  // Add click handler for middle mouse button clicks
  setupMiddleClickHandlers() {
    const wrapper = document.getElementById("canvasWrapper");
    let lastClickTime = 0;
    const doubleClickDelay = 300; // milliseconds

    wrapper.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        // Middle mouse button
        e.preventDefault();
        const currentTime = new Date().getTime();

        if (currentTime - lastClickTime < doubleClickDelay) {
          // Double click - fit to view
          // this.zoomToFit();
          this.centerMap();
        }
        // else {
        //   // Single click - center map
        //   this.centerMap();
        // }

        lastClickTime = currentTime;
      }
    });
  }



  handleWheel(e) {
    e.preventDefault();

    // Adjust sensitivity - make the zoom effect more gradual
    const sensitivity = 0.0005;
    const delta = e.deltaY * -sensitivity;

    // Clamp the delta to prevent too rapid changes
    const clampedDelta = Math.max(Math.min(delta, 0.1), -0.1);

    // Calculate new scale with smoother transition
    const newScale = Math.min(Math.max(0.1, this.scale + clampedDelta), 4);

    // Only proceed if the scale actually changed
    if (newScale === this.scale) return;

    // Get mouse position relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the position under the mouse in image coordinates
    const imageX = (mouseX - this.offset.x) / this.scale;
    const imageY = (mouseY - this.offset.y) / this.scale;

    // Store previous scale for smooth transition
    const prevScale = this.scale;

    // Update the scale
    this.scale = newScale;

    // Calculate new offset to keep the same image position under the mouse
    const smoothing = 0.95;
    this.offset.x = mouseX - imageX * this.scale;
    this.offset.y = mouseY - imageY * this.scale;

    // Smooth the transition
    this.offset.x = this.offset.x * smoothing + (mouseX - imageX * prevScale) * (1 - smoothing);
    this.offset.y = this.offset.y * smoothing + (mouseY - imageY * prevScale) * (1 - smoothing);

    // Update room positions and transformations
    this.rooms.forEach(room => {
      if (room.element) {
        // Update position
        room.element.style.left = `${room.bounds.x * this.scale + this.offset.x}px`;
        room.element.style.top = `${room.bounds.y * this.scale + this.offset.y}px`;

        // Update size
        room.element.style.width = `${room.bounds.width * this.scale}px`;
        room.element.style.height = `${room.bounds.height * this.scale}px`;

        // If this is a polygon room, update the clip path
        if (room.shape === 'polygon' && room.points) {
          const clipPath = room.points
            .map(p => `${p.x * this.scale}px ${p.y * this.scale}px`)
            .join(', ');
          room.element.style.clipPath = `polygon(${clipPath})`;
        }
      }
    });

    // Update markers
    this.markers.forEach((marker) => {
      this.updateMarkerPosition(marker);
      if (marker.type === "encounter" && marker.data.monster) {
        // Additional zoom handling for encounter markers
        const token = marker.element.querySelector(".monster-token");
        if (token) {
          // Calculate monster size in squares (if available)
          const monsterSize = marker.data.monster.basic && marker.data.monster.basic.size
            ? this.getMonsterSizeInSquares(marker.data.monster.basic.size)
            : 1;

          // Set a fixed pixel size that we maintain regardless of zoom
          const baseSize = (this.cellSize || 32) * monsterSize;

          // Update token size to maintain apparent size
          token.style.width = `${baseSize}px`;
          token.style.height = `${baseSize}px`;
          token.style.left = `-${baseSize / 2}px`;
          token.style.top = `-${baseSize / 2}px`;

          // No scale transform needed - we're setting absolute size
          token.style.transform = 'none';
        }
      }

      // Handle prop markers
      const propVisual = marker.element.querySelector(".prop-visual");
      if (propVisual) {
        // For props, maintain apparent size regardless of zoom
        // But keep any rotation
        const currentTransform = propVisual.style.transform || "";
        const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
        const rotateVal = rotateMatch ? rotateMatch[1] : "0deg";

        // Calculate base size
        const baseSize = 48; // Default base size
        const scale = marker.data.prop?.scale || 1.0;
        const width = baseSize * scale;

        // Get aspect ratio if available
        let height = width;
        if (marker.data.texture?.aspect) {
          height = width / marker.data.texture.aspect;
        }

        // Update sizes to maintain apparent size
        propVisual.style.width = `${width}px`;
        propVisual.style.height = `${height}px`;
        propVisual.style.left = `-${width / 2}px`;
        propVisual.style.top = `-${height / 2}px`;

        // Apply only rotation, not scaling
        propVisual.style.transform = `rotate(${rotateVal})`;
      }

      // Handle teleport connections
      if (marker.type === 'teleport' && marker.data.isPointA && marker.data.pairedMarker) {
        this.updateTeleportConnection(marker, marker.data.pairedMarker);
      }
    });

    // Update player start marker if it exists
    if (this.playerStart) {
      this.updateMarkerPosition(this.playerStart);
    }

    this.render();
  }


  centerMap() {
    if (!this.baseImage) return;

    const container = this.canvas.parentElement;
    const scaleX = container.clientWidth / this.baseImage.width;
    const scaleY = container.clientHeight / this.baseImage.height;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.offset = {
      x: (container.clientWidth - this.baseImage.width * this.scale) / 2,
      y: (container.clientHeight - this.baseImage.height * this.scale) / 2
    };

    // Update all room positions
    this.rooms.forEach((room) => room.updateElement());
    this.render();
  }

  render() {
    if (!this.ctx || !this.baseImage) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw base image
    this.ctx.save();
    this.ctx.translate(this.offset.x, this.offset.y);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.drawImage(this.baseImage, 0, 0);

    // Draw grid
    if (this.cellSize) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.lineWidth = 0.5;

      for (let x = 0; x < this.baseImage.width; x += this.cellSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.baseImage.height);
        this.ctx.stroke();
      }

      for (let y = 0; y < this.baseImage.height; y += this.cellSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.baseImage.width, y);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  editRoom(room) {
    if (room.locked) {
      this.showLockedMessage();
      return;
    }
    this.rooms.forEach((r) => {
      if (r !== room) {
        r.updateEditState(false);
      }
    });

    // Enable editing for the selected room
    room.updateEditState(true);
    room.finalized = false;
    const roomElement = document.getElementById(`room-${room.id}`);
    if (roomElement) {
      roomElement.style.pointerEvents = "auto";
      roomElement.style.opacity = "1";
    }
    this.layersPanel.updateLayersList();
  }

  deleteRoom(room) {
    if (room.locked) {
      this.showLockedMessage();
      return;
    }
    const index = this.rooms.indexOf(room);
    if (index > -1) {
      this.rooms.splice(index, 1);
      const roomElement = document.getElementById(`room-${room.id}`);
      if (roomElement) {
        roomElement.remove();
      }
      this.layersPanel.updateLayersList();
    }
  }

  updateMarkerPositions() {
    // Update regular markers
    this.markers.forEach((marker) => {
      if (marker.element) {
        // Update position
        marker.element.style.left = `${marker.x * this.scale + this.offset.x}px`;
        marker.element.style.top = `${marker.y * this.scale + this.offset.y}px`;

        // Handle special marker types
        if (marker.type === "encounter" && marker.data.monster) {
          // For encounter markers, we need to COUNTERACT the zoom scale
          // When overall zoom is smaller, we need to make the token LARGER to maintain apparent size
          const token = marker.element.querySelector(".monster-token");
          if (token) {
            // Calculate monster size in squares (if available)
            const monsterSize = marker.data.monster.basic && marker.data.monster.basic.size
              ? this.getMonsterSizeInSquares(marker.data.monster.basic.size)
              : 1;

            // Set a fixed pixel size that we maintain regardless of zoom
            const baseSize = (this.cellSize || 32) * monsterSize;

            // Update token size to maintain apparent size
            token.style.width = `${baseSize}px`;
            token.style.height = `${baseSize}px`;
            token.style.left = `-${baseSize / 2}px`;
            token.style.top = `-${baseSize / 2}px`;

            // No scale transform needed - we're setting absolute size
            token.style.transform = 'none';
          }
        }

        // Handle prop markers
        const propVisual = marker.element.querySelector(".prop-visual");
        if (propVisual) {
          // For props, maintain apparent size regardless of zoom
          // But keep any rotation
          const currentTransform = propVisual.style.transform || "";
          const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
          const rotateVal = rotateMatch ? rotateMatch[1] : "0deg";

          // Calculate base size
          const baseSize = 48; // Default base size
          const scale = marker.data.prop?.scale || 1.0;
          const width = baseSize * scale;

          // Get aspect ratio if available
          let height = width;
          if (marker.data.texture?.aspect) {
            height = width / marker.data.texture.aspect;
          }

          // Update sizes to maintain apparent size
          propVisual.style.width = `${width}px`;
          propVisual.style.height = `${height}px`;
          propVisual.style.left = `-${width / 2}px`;
          propVisual.style.top = `-${height / 2}px`;

          // Apply only rotation, not scaling
          propVisual.style.transform = `rotate(${rotateVal})`;
        }

        // Handle teleport connections
        if (marker.type === "teleport" && marker.data.isPointA && marker.data.pairedMarker && marker.connection) {
          this.updateTeleportConnection(marker, marker.data.pairedMarker);
        }
      }
    });

    // Update player start marker if it exists
    if (this.playerStart && this.playerStart.element) {
      this.playerStart.element.style.left = `${this.playerStart.x * this.scale + this.offset.x}px`;
      this.playerStart.element.style.top = `${this.playerStart.y * this.scale + this.offset.y}px`;

      // Set fixed size for player start icon
      const playerIcon = this.playerStart.element.querySelector(".material-icons");
      if (playerIcon) {
        playerIcon.style.fontSize = '24px'; // Fixed size
        playerIcon.style.transform = 'none';
      }
    }
  }


  createTeleportConnection(pointA, pointB) {


    const connection = document.createElement("div");
    connection.className = "teleport-connection";
    connection.id = `teleport-connection-${pointA.id}`;
    document.querySelector(".canvas-container").appendChild(connection);
    return connection;
  }

  // Add method to update the visual connection
  updateTeleportConnection(pointA, pointB) {
    if (!pointA || !pointB || !pointA.connection) return;

    const connection = pointA.connection;
    const containerRect = document
      .querySelector(".canvas-container")
      .getBoundingClientRect();

    const x1 = pointA.x * this.scale + this.offset.x;
    const y1 = pointA.y * this.scale + this.offset.y;
    const x2 = pointB.x * this.scale + this.offset.x;
    const y2 = pointB.y * this.scale + this.offset.y;

    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

    connection.style.width = `${length}px`;
    connection.style.left = `${x1}px`;
    connection.style.top = `${y1}px`;
    connection.style.transform = `rotate(${angle}deg)`;
  }

  updateTeleportConnections() {
    //   console.log("Updating all teleport connections");
    this.markers.forEach((marker) => {
      if (marker.type === "teleport") {
        console.log("Checking marker:", {
          id: marker.id,
          isPointA: marker.data.isPointA,
          hasPair: marker.data.hasPair,
          hasPairedMarker: !!marker.data.pairedMarker,
          attribute: marker.element.getAttribute('data-teleport-point')
        });

        if (marker.data.pairedMarker && marker.data.isPointA) {
          if (marker.connection) {
            marker.connection.remove();
          }
          marker.connection = this.createTeleportConnection(
            marker,
            marker.data.pairedMarker
          );
          this.updateTeleportConnection(marker, marker.data.pairedMarker);
        }
      }
    });
  }

  // Add to MapEditor class
  async showStructureContextMenu(structure, event) {
    event.preventDefault();

    const dialog = document.createElement('sl-dialog');
    dialog.label = `${structure.type === 'wall' ? 'Wall' : 'Room'} Options`;

    dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <sl-button class="assign-texture-btn">
                <span class="material-icons" slot="prefix">texture</span>
                Assign Texture
            </sl-button>
            ${structure.textureAssignments?.size ? `
                <sl-button class="clear-texture-btn" variant="danger">
                    <span class="material-icons" slot="prefix">clear</span>
                    Clear Texture
                </sl-button>
            ` : ''}
        </div>
    `;

    document.body.appendChild(dialog);

    // Handle texture assignment
    dialog.querySelector('.assign-texture-btn').addEventListener('click', async () => {
      dialog.hide();
      const texture = await this.resourceManager.showTextureSelectionDialog(structure);
      if (texture) {
        // Handle texture assignment - we'll implement this next
        console.log('Selected texture:', texture);
        // await this.assignTexture(structure, texture);
      }
    });

    // Handle texture clearing if button exists
    dialog.querySelector('.clear-texture-btn')?.addEventListener('click', () => {
      if (structure.textureAssignments) {
        structure.textureAssignments.clear();
        // We'll implement visual updates in the next step
      }
      dialog.hide();
    });

    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    dialog.show();
  }


  addMarker(type, x, y, data = {}) {
    // Check if map is loaded
    if (!this.baseImage) {
      this.showCustomToast("Please load a map before placing markers");
      // alert("Please load a map before placing markers");
      return null;
    }


    if (type === "door") {
      console.log('Finding nearest wall for door placement');
      const nearestWall = this.rooms.find(room => {
        return room.type === 'wall' && this.isNearWall(x, y, room);
      });
    
      if (nearestWall) {
        // Use our new function to get precise placement
        const placement = this.findNearestPointOnWall(x, y, nearestWall);
        
        // Get texture from resource manager
        const textureCategory = "doors";
        const texture = this.resourceManager.getSelectedTexture(textureCategory);
    
        if (!texture) {
          this.showCustomToast('No door textures available. Please add some in the Resource Manager.');
          return null;
        }
    
        const marker = this.createMarker("door", placement.x, placement.y, {
          texture: texture,
          door: {
            position: {
              x: placement.x,
              y: placement.y,
              edge: placement.edge,
              rotation: placement.rotation
            },
            isOpen: false
          },
          parentWall: nearestWall
        });
        
        // Apply rotation immediately
        marker.element.style.transform = `rotate(${placement.rotation}deg)`;
        
        this.markers.push(marker);
        return marker;
      } else {
        this.showCustomToast('No nearby wall found for door placement. Please place it on a wall.');
        return null;
      }
    }

    // Handle player start point (only one allowed)
    if (type === "player-start") {
      if (this.playerStart) {
        this.removeMarker(this.playerStart);
      }
      this.playerStart = this.createMarker(type, x, y, data);
      return this.playerStart;
    }

    if (type === "prop") {
      // Get texture from resource manager - UPDATED CODE
      const textureCategory = "props";

      // If we have specific texture info in the data, use it
      let texture = null;

      if (data.texture) {
        // Keep existing texture object if it's already complete
        texture = data.texture;
        console.log("Using provided texture for prop:", texture.name);
      }
      else if (data.textureId && this.resourceManager) {
        // Try to get the specific texture by ID
        texture = this.resourceManager.getSpecificTexture(textureCategory, data.textureId);
        console.log("Retrieved texture by ID:", texture?.name);
      }
      else if (data.embeddedTexture) {
        // Use embedded texture data
        texture = data.embeddedTexture;
        console.log("Using embedded texture data:", texture.name);
      }

      // Fallback to default if needed
      if (!texture && this.resourceManager) {
        console.warn("No specific texture found, using default");
        texture = this.resourceManager.getSelectedTexture(textureCategory);
      }

      if (!texture) {
        console.error("No texture available for prop marker");
        // Return early or show error message
        return null;
      }

      console.log("Creating prop marker with texture:", {
        id: texture.id,
        name: texture.name
      });

      const marker = this.createMarker("prop", x, y, {
        texture: texture,
        prop: data.prop || {
          scale: 1.0,
          height: 1.0,
          isHorizontal: false,
          position: { rotation: 0 }
        }
      });

      this.markers.push(marker);
      return marker;
    }


    if (type === "teleport") {
      // Place Point A
      if (!this.pendingTeleportPair) {
        // console.log("Creating Point A");
        const teleportA = this.createMarker(type, x, y, {
          isPointA: true,
          pairId: Date.now()
        });
        console.log("Point A created:", {
          isPointA: teleportA.data.isPointA,
          attribute: teleportA.element.getAttribute('data-teleport-point')
        });
        this.pendingTeleportPair = teleportA;
        this.markers.push(teleportA);
        return teleportA;
      }
      // Place Point B
      else if (this.pendingTeleportPair && !this.pendingTeleportPair.data.hasPair) {
        // console.log("Creating Point B");
        const teleportB = this.createMarker(type, x, y, {
          isPointA: false,
          pairId: this.pendingTeleportPair.data.pairId
        });

        // Debug log right after creation
        console.log("Point B immediately after creation:", {
          isPointA: teleportB.data.isPointA,
          attribute: teleportB.element.getAttribute('data-teleport-point'),
          elementHTML: teleportB.element.outerHTML
        });

        // Create and store the connection line
        const connection = document.createElement("div");
        connection.className = "teleport-connection";
        connection.id = `teleport-connection-${this.pendingTeleportPair.data.pairId}`;
        document.querySelector(".canvas-container").appendChild(connection);

        // Link the pairs and store the connection
        this.pendingTeleportPair.data.pairedMarker = teleportB;
        this.pendingTeleportPair.data.hasPair = true;
        this.pendingTeleportPair.connection = connection;
        teleportB.data.pairedMarker = this.pendingTeleportPair;
        teleportB.data.hasPair = true;  // Add this line to ensure B knows it's paired

        // Debug log after connection setup
        console.log("After connection setup:", {
          pointA: {
            isPointA: this.pendingTeleportPair.data.isPointA,
            hasPair: this.pendingTeleportPair.data.hasPair,
            attribute: this.pendingTeleportPair.element.getAttribute('data-teleport-point')
          },
          pointB: {
            isPointA: teleportB.data.isPointA,
            hasPair: teleportB.data.hasPair,
            attribute: teleportB.element.getAttribute('data-teleport-point')
          }
        });

        // Update the connection line position
        this.updateTeleportConnection(this.pendingTeleportPair, teleportB);
        this.markers.push(teleportB);

        // Reset state for next pair
        this.pendingTeleportPair = null;

        // Reset tool to default teleport state
        this.setTool("marker-teleport");
        return teleportB;
      }
      return null;
    }

    if (type === "encounter" && data.monster?.image) {
      const marker = this.createTokenMarker(type, x, y, data);
      this.markers.push(marker);
      return marker;
    }

        // Inside addMarker method, when creating a marker:
    if (type === "dungeon") {
      const marker = this.createMarker(type, x, y, {
        name: data.name || "Mysterious Dungeon",
        difficulty: data.difficulty || "medium",
        dungeonId: data.dungeonId || Date.now().toString()
      });
      this.markers.push(marker);
      return marker;
    }

    // Regular markers
    const marker = this.createMarker(type, x, y, data);
    this.markers.push(marker);
    return marker;
  }

  // Add this new method to MapEditor class
  startMarkerDragging(marker, e) {
    if (!this.isMarkerEditMode) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startMarkerX = marker.x;
    const startMarkerY = marker.y;

    const moveHandler = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / this.scale;
      const dy = (moveEvent.clientY - startY) / this.scale;

      marker.x = startMarkerX + dx;
      marker.y = startMarkerY + dy;

      this.updateMarkerPosition(marker);

      // Update teleport connections if needed
      if (marker.type === "teleport") {
        // Update connection line
        this.updateTeleportConnections();

        // Update paired marker reference coordinates
        if (marker.data.pairedMarker) {
          if (marker.data.isPointA) {
            marker.connection = this.createTeleportConnection(marker, marker.data.pairedMarker);
            this.updateTeleportConnection(marker, marker.data.pairedMarker);
          } else if (marker.data.pairedMarker.connection) {
            this.updateTeleportConnection(marker.data.pairedMarker, marker);
          }
        }
      }
    };

    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
    };

    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  }

  toggleMarkerEditMode() {
    this.isMarkerEditMode = !this.isMarkerEditMode;

    // Update the button state
    const editMarkerBtn = document.getElementById("editMarkerTool");
    if (editMarkerBtn) {
      editMarkerBtn.classList.toggle("active", this.isMarkerEditMode);
    }

    // Update all markers
    this.markers.forEach((marker) => {
      if (marker.element) {
        marker.element.classList.toggle("editing", this.isMarkerEditMode);
        // Only allow dragging in edit mode
        marker.element.style.cursor = this.isMarkerEditMode
          ? "move"
          : "pointer";
      }
    });

    // Update player start marker if it exists
    if (this.playerStart && this.playerStart.element) {
      this.playerStart.element.classList.toggle(
        "editing",
        this.isMarkerEditMode
      );
      this.playerStart.element.style.cursor = this.isMarkerEditMode
        ? "move"
        : "pointer";
    }
  }

  getMonsterSizeInSquares(size) {
    // Add debug logging
    console.log("Getting monster size for:", size);

    // Handle undefined/null size
    if (!size) {
      console.log("Size undefined, defaulting to medium");
      return 1; // Default to medium size
    }

    const sizeMap = {
      tiny: 0.5, // 2.5ft
      small: 1, // 5ft
      medium: 1, // 5ft
      large: 2, // 10ft (2x2)
      huge: 3, // 15ft (3x3)
      gargantuan: 4 // 20ft (4x4)
    };

    const calculatedSize = sizeMap[size.toLowerCase()] || 1;
    console.log("Calculated size:", calculatedSize);
    return calculatedSize;
  }


  updateMarkerAppearance(marker) {

    if (marker.data.monster?.token) {
      const tokenSource = marker.data.monster.token.data || marker.data.monster.token.url;
      const monsterSize = this.getMonsterSizeInSquares(marker.data.monster.basic.size);

      // Check if token is on elevated surface
      const { elevation, insideWall } = this.checkTokenElevation(marker);

      // Store for 3D view
      marker.data.elevation = elevation;
      marker.data.insideWall = insideWall;

      // Use existing cellSize calculation
      const cellSize = this.cellSize || 32;
      const totalSize = cellSize * monsterSize;

      // Determine content based on token source
      const tokenContent = tokenSource ?
        `<img src="${tokenSource}" 
             style="width: 100%; height: 100%; object-fit: cover;"
             onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'material-icons\\' style=\\'font-size: ${totalSize * 0.75}px;\\'>local_fire_department</span>';" />` :
        `<span class="material-icons" style="font-size: ${totalSize * 0.75}px;">local_fire_department</span>`;

      // Create token HTML with elevation indicators
      marker.element.innerHTML = `
        <div class="monster-token" style="
            width: ${totalSize}px; 
            height: ${totalSize}px; 
            border-radius: 10%; 
            border: 2px solid ${insideWall ? '#ff9800' : '#f44336'}; 
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: -${totalSize / 2}px;
            top: -${totalSize / 2}px;
            transform-origin: center;
            ${elevation > 0 ? `box-shadow: 0 ${elevation * 2}px ${elevation * 3}px rgba(0,0,0,0.3);` : ''}
        ">
            ${tokenContent}
            ${elevation > 0 ? `
              <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; padding: 2px 4px; border-radius: 2px; font-size: 10px;">+${elevation}</div>
            ` : ''}
        </div>
      `;

      // Update position
      this.updateMarkerPosition(marker);
    }
    else if (marker.type === "prop" && marker.data.texture) {
      // Default prop settings
      const propSettings = marker.data.prop || {};
      const rotation = propSettings.position?.rotation || 0;
      const scale = propSettings.scale || 1.0;
      const height = propSettings.height || 1.0;
      const isHorizontal = !!propSettings.isHorizontal;

      console.log("Updating prop appearance:", {
        scale, height, isHorizontal, rotation,
        textureId: marker.data.texture.id,
        textureName: marker.data.texture.name
      });

      // Get texture aspect ratio
      let aspect = marker.data.texture.aspect || 1.0;

      // If we have the actual image data, calculate actual aspect
      if (!aspect && marker.data.texture.data) {
        const img = new Image();
        img.src = marker.data.texture.data;
        img.onload = () => {
          marker.data.texture.aspect = img.width / img.height;
          updatePropVisual(marker.data.texture.aspect);
        };
      } else {
        updatePropVisual(aspect);
      }

      function updatePropVisual(aspectRatio) {
        const baseSize = 48;
        const width = baseSize * scale;
        const height = baseSize * scale / aspectRatio;

        marker.element.innerHTML = `
          <div class="prop-visual" style="
            width: ${width}px;
            height: ${height}px;
            background-image: url('${marker.data.texture.data}');
            background-size: contain;
            background-repeat: no-repeat; 
            background-position: center;
            position: absolute;
            left: -${width / 2}px;
            top: -${height / 2}px;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            border: 2px solid #4CAF50;
            border-radius: 4px;
          "></div>
          ${marker.data.prop?.height > 0 ? `
            <div class="prop-height-indicator" style="
              position: absolute;
              bottom: -15px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0,0,0,0.6);
              color: white;
              padding: 2px 4px;
              border-radius: 2px;
              font-size: 10px;
              pointer-events: none;
            ">h: ${marker.data.prop.height}</div>
          ` : ''}
        `;

        // Apply horizontal class if needed
        if (isHorizontal) {
          const propVisual = marker.element.querySelector('.prop-visual');
          if (propVisual) {
            propVisual.classList.add('horizontal-prop');
          }
        }
      }
    } // Inside updateMarkerAppearance method, add this block:
    else if (marker.type === "storyboard") {
      // Basic marker appearance
      const radius = marker.data?.radius || 2;
      
      marker.element.innerHTML = `
        <div class="story-trigger-visual" style="
          width: ${radius * 2}em;
          height: ${radius * 2}em;
          background: rgba(103, 58, 183, 0.2);
          border: 2px solid #673AB7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          left: -${radius}em;
          top: -${radius}em;
          transform-origin: center;
        ">
          <span class="material-icons" style="
            color: #673AB7;
            font-size: 1.5em;
          ">auto_stories</span>
        </div>
        ${marker.data?.label ? `
          <div class="marker-label" style="
            position: absolute;
            top: ${radius * 2 + 0.5}em;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            white-space: nowrap;
          ">${marker.data.label}</div>
        ` : ''}
      `;
    }else if (marker.type === "door" && marker.data.texture) {
      // Update the door appearance with the texture
      const doorPanel = marker.element.querySelector('.door-panel');
      if (doorPanel) {
        doorPanel.style.backgroundImage = `url('${marker.data.texture.data}')`;
      }
      
      // Apply rotation if specified
      if (marker.data.door?.position?.rotation !== undefined) {
        marker.element.style.transform = `rotate(${marker.data.door.position.rotation}deg)`;
      }
      
      // Apply open/closed state if specified
      if (marker.data.door?.isOpen) {
        const doorPanel = marker.element.querySelector('.door-panel');
        if (doorPanel) {
          doorPanel.style.transform = 'rotateY(70deg)';
          doorPanel.style.transformOrigin = 'left';
          doorPanel.style.opacity = '0.7';
        }
      }
    }
    // this.fixZoomIssues();
  }

  checkTokenElevation(marker) {
    if (!marker || !marker.x || !marker.y) return { elevation: 0, insideWall: false };

    let elevation = 0;
    let insideWall = false;

    // Check each room for overlap
    this.rooms.forEach(room => {
      // Skip non-walls and non-raised blocks
      if (!room.isRaisedBlock && room.type !== 'wall') return;

      // Simple bounds check
      const isInBounds =
        marker.x >= room.bounds.x &&
        marker.x <= room.bounds.x + room.bounds.width &&
        marker.y >= room.bounds.y &&
        marker.y <= room.bounds.y + room.bounds.height;

      if (isInBounds) {
        // For raised blocks, use height
        if (room.isRaisedBlock && room.blockHeight) {
          elevation = Math.max(elevation, room.blockHeight);
        }
        // For regular walls, mark as inside
        else if (room.type === 'wall' && !room.isRaisedBlock) {
          insideWall = true;
        }
      }
    });

    return { elevation, insideWall };
  }


  // Helper method to create marker elements
  createMarker(type, x, y, data) {
    const marker = {
      id: Date.now(),
      type,
      x,
      y,
      data,
      element: null
    };

    const markerElement = document.createElement("div");
    markerElement.className = `map-marker marker-${type}`;
    markerElement.id = `marker-${marker.id}`;

    markerElement.addEventListener("mousedown", (e) => {
      if (!this.isMarkerEditMode) return; // Only allow dragging in edit mode
      if (e.button !== 0) return; // Only handle left click

      e.preventDefault();
      e.stopPropagation();

      this.startMarkerDragging(marker, e); // This calls the separate method with all the dragging logic
    });

    //   console.log("Creating marker with type:", type);
    // Handle encounter markers with monster data
    if (type === "encounter" && data.monster?.token) {
      const tokenSource =
        data.monster.token.data || data.monster.token.url;
      const monsterSize = this.getMonsterSizeInSquares(
        data.monster.basic.size
      );
      const baseSize = 32;
      const scaledSize = baseSize * monsterSize;

      markerElement.innerHTML = `
        <div class="monster-token" style="
            width: ${scaledSize}px !important;
            height: ${scaledSize}px !important;
            border-radius: 10%;
            border: 2px solid #f44336;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: -${scaledSize / 2}px;
            top: -${scaledSize / 2}px;
            transform-origin: center;
            transform: scale(${this.scale}); /* Add map scaling */
        ">
            <img src="${tokenSource}"
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'material-icons\\' style=\\'font-size: ${scaledSize * 0.75
        }px;\\'>local_fire_department</span>';" />
        </div>
    `;
    } else {
      // Add the default icon based on type
      const icon = {
        "player-start": "person_pin_circle",
        encounter: "local_fire_department",
        treasure: "workspace_premium",
        trap: "warning",
        teleport: "swap_calls",
        door: "door_front",
        prop: "category",
        "splash-art": "add_photo_alternate",
        storyboard: "auto_stories",
        dungeon: "fort",
      }[type] || "location_on";

      markerElement.innerHTML = `<span class="material-icons">${icon}</span>`;
    }

    // Set initial cursor based on edit mode
    markerElement.style.cursor = this.isMarkerEditMode
      ? "move"
      : "pointer";


    if (type === "teleport") {
      const pointType = data.isPointA ? "a" : "b";
      console.log("Before setting teleport point type:", {
        isPointA: data.isPointA,
        pointType: pointType
        // currentAttr: markerElement.getAttribute('data-teleport-point')
      });

      markerElement.setAttribute("data-teleport-point", pointType);

      console.log("After setting teleport point type:", {
        isPointA: data.isPointA,
        pointType: pointType,
        newAttr: markerElement.getAttribute('data-teleport-point'),
        element: markerElement.outerHTML
      });
    }

if (type === "door") {
  // Get door texture
  const textureUrl = data.texture ? data.texture.data : '';
  const rotation = data.door?.position?.rotation || 0;
  
  // Create proper door visuals
  markerElement.innerHTML = `
    <div class="door-visual" style="
      width: 24px;
      height: 40px;
      position: relative;
      transform-origin: center;
    ">
      <div class="door-frame" style="
        position: absolute;
        width: 100%;
        height: 100%;
        border: 2px solid #8B4513;
        background-color: rgba(139, 69, 19, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${textureUrl ? `
          <div class="door-panel" style="
            position: absolute;
            width: 80%;
            height: 90%;
            background-image: url('${textureUrl}');
            background-size: cover;
            background-position: center;
            border: 1px solid #5D4037;
          "></div>
        ` : `
          <div class="door-panel" style="
            position: absolute;
            width: 80%;
            height: 90%;
            background-color: #A1887F;
            border: 1px solid #5D4037;
          "></div>
        `}
      </div>
    </div>`;
  
  // Set rotation
  markerElement.style.transform = `rotate(${rotation}deg)`;
}


    else if (type === "prop" && data.texture) {
      // Default prop settings
      if (!data.prop) {
        data.prop = {
          scale: 1.0,
          height: 1.0,
          position: {
            rotation: 0
          }
        };
      }

      // Create a temporary image to get dimensions
      const img = new Image();
      img.src = data.texture.data;

      // Default size until image loads
      let width = 48;
      let height = 48;

      // Create initial visual
      markerElement.innerHTML = `
        <div class="prop-visual" style="
          width: ${width}px;
          height: ${height}px;
          background-image: url('${data.texture.data}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          position: absolute;
          left: -${width / 2}px;
          top: -${height / 2}px;
          transform: rotate(${data.prop?.position?.rotation || 0}deg);
          transform-origin: center;
          border: 2px solid #4CAF50;
          border-radius: 4px;
        "></div>
        ${data.prop?.height > 0 ? `
          <div class="prop-height-indicator" style="
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 10px;
            pointer-events: none;
          ">h: ${data.prop.height}</div>
        ` : ''}
      `;

      // Update visual when image loads to use correct aspect ratio
      img.onload = () => {
        const aspect = img.width / img.height;
        data.texture.aspect = aspect;

        const scale = data.prop?.scale || 1.0;
        const baseSize = 48;
        const actualWidth = baseSize * scale;
        const actualHeight = baseSize * scale / aspect;

        const propVisual = markerElement.querySelector('.prop-visual');
        if (propVisual) {
          propVisual.style.width = `${actualWidth}px`;
          propVisual.style.height = `${actualHeight}px`;
          propVisual.style.left = `-${actualWidth / 2}px`;
          propVisual.style.top = `-${actualHeight / 2}px`;
        }
      };
    }

    if (type === "prop" && data?.isWaterProp) {
      // Special handling for water props
      const propVisual = document.createElement('div');
      const isHorizontal = data.prop?.isHorizontal !== false; // Default to horizontal
      propVisual.className = `prop-visual water-prop ${isHorizontal ? 'horizontal-water' : 'vertical-water'}`;
      
      // Set dimensions based on scale
      const baseSize = 48;
      const scale = data.prop?.scale || 1.0;
      const width = baseSize * scale;
      const height = isHorizontal ? baseSize * scale / 3 : baseSize * scale;
      
      // Get water properties with defaults
      const waterColor = data.water?.color || '#4488aa';
      const transparency = data.water?.transparency || 0.7;
      const flowSpeed = data.water?.flowSpeed || 1.0;
      
      propVisual.style.cssText = `
        width: ${width}px;
        height: ${height}px;
        position: absolute;
        left: -${width / 2}px;
        top: -${height / 2}px;
        background-color: rgba(${this.hexToRgb(waterColor)}, ${transparency});
        border: 1px solid ${waterColor};
        transform: rotate(${data.prop?.position?.rotation || 0}deg);
        transform-origin: center;
        border-radius: ${isHorizontal ? '4px' : '0'};
        overflow: hidden;
      `;
      
      // Add flow speed attribute for CSS animations
      propVisual.setAttribute('data-flow-speed', flowSpeed);
      
      markerElement.appendChild(propVisual);
    }




    if (type === "storyboard") {
  // Initialize storyboard marker with defaults
  if (!data) data = {};
  
  // Set default properties if not provided
  data.radius = data.radius || 2; // Default trigger radius
  data.triggerOnce = data.triggerOnce !== false; // Default to true
  data.label = data.label || "Story Event"; // Default label
  data.storyId = data.storyId || null; // Story ID reference
  
  // Create special appearance
  markerElement.style.cursor = "pointer";
  markerElement.innerHTML = `
    <div class="story-trigger-visual" style="
      width: ${data.radius * 2}em;
      height: ${data.radius * 2}em;
      background: rgba(103, 58, 183, 0.2);
      border: 2px solid #673AB7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      left: -${data.radius}em;
      top: -${data.radius}em;
      transform-origin: center;
    ">
      <span class="material-icons" style="
        color: #673AB7;
        font-size: 1.5em;
      ">auto_stories</span>
    </div>
    ${data.label ? `
      <div class="marker-label" style="
        position: absolute;
        top: ${data.radius * 2 + 0.5}em;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8em;
        white-space: nowrap;
      ">${data.label}</div>
    ` : ''}
  `;
}

    // Add context menu handler
    markerElement.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // Prevent default context menu
      this.showMarkerContextMenu(marker, e);
    });

    // Position marker
    markerElement.style.left = `${x * this.scale + this.offset.x}px`;
    markerElement.style.top = `${y * this.scale + this.offset.y}px`;

    // Add hover effects
    markerElement.addEventListener("mouseenter", () => {
      markerElement.classList.add("highlighted");
      if (marker.data.pairedMarker) {
        // Highlight paired teleport point
        marker.data.pairedMarker.element.classList.add("highlighted");
      }
    });

    markerElement.addEventListener("mouseleave", () => {
      markerElement.classList.remove("highlighted");
      if (marker.data.pairedMarker) {
        marker.data.pairedMarker.element.classList.remove("highlighted");
      }
    });

    document
      .querySelector(".canvas-container")
      .appendChild(markerElement);
    marker.element = markerElement;

    markerElement.addEventListener("mouseover", (e) => {
      console.log("Mouse over marker:", marker.type);
    });

    return marker;
  }

  updateMarkerPosition(marker) {
    if (marker.element) {
      const x = marker.x * this.scale + this.offset.x;
      const y = marker.y * this.scale + this.offset.y;

      marker.element.style.left = `${x}px`;
      marker.element.style.top = `${y}px`;

      // Scale the token based on current zoom
      const token = marker.element.querySelector(".monster-token");
      if (token) {
        token.style.transform = `scale(${this.scale})`;
      }
    }
  }

  updateMarkerPositions() {
    this.markers.forEach((marker) => {
      if (marker.element) {
        marker.element.style.left = `${marker.x * this.scale + this.offset.x
          }px`;
        marker.element.style.top = `${marker.y * this.scale + this.offset.y
          }px`;

        // Update connection line if this is a teleport point A
        if (
          marker.type === "teleport" &&
          marker.data.isPointA &&
          marker.data.pairedMarker &&
          marker.connection
        ) {
          this.updateTeleportConnection(marker, marker.data.pairedMarker);
        }
      }
    });

    if (this.playerStart && this.playerStart.element) {
      this.playerStart.element.style.left = `${this.playerStart.x * this.scale + this.offset.x
        }px`;
      this.playerStart.element.style.top = `${this.playerStart.y * this.scale + this.offset.y
        }px`;
    }
  }

  createWaterProp(x, y, isHorizontal = true) {
    // Create data object for the prop
    const propData = {
      isWaterProp: true,
      prop: {
        scale: 1.0,
        height: isHorizontal ? 0.1 : 1.0,
        isHorizontal: isHorizontal,
        position: {
          rotation: 0
        }
      },
      water: {
        depth: 1.0,
        color: '#4488aa',
        flowSpeed: 1.0,
        transparency: 0.7
      }
    };
    
    // Create the marker using existing system
    return this.addMarker("prop", x, y, propData);
  }

  removeMarker(marker) {
    if (marker.element) {
      marker.element.remove();
    }

    // Special handling for teleport markers
    if (marker.type === 'teleport') {
      // Remove the connection line if it exists
      if (marker.connection) {
        marker.connection.remove();
      }
      // If this marker has a pair, clean up the pair's reference and connection
      if (marker.data.pairedMarker) {
        const pair = marker.data.pairedMarker;
        pair.data.pairedMarker = null;
        pair.data.hasPair = false;
        if (pair.connection) {
          pair.connection.remove();
          pair.connection = null;
        }
      }
      // Reset the pending teleport pair if this was point A
      if (this.pendingTeleportPair === marker) {
        this.pendingTeleportPair = null;
      }
    }

    // Remove from markers array or reset player start
    if (marker.type === 'player-start') {
      this.playerStart = null;
    } else {
      const index = this.markers.indexOf(marker);
      if (index > -1) {
        this.markers.splice(index, 1);
      }
    }
  }

  getMarkerTooltip(marker) {
    switch (marker.type) {
      case "player-start":
        return "Player Start Point";
      case "encounter":
        return marker.data.monster
          ? `Encounter: ${marker.data.monster.name} (CR ${marker.data.monster.cr})`
          : "Encounter Point";
      case "treasure":
        return marker.data.description || "Treasure";
      case "trap":
        return marker.data.description || "Trap";
      case "splash-art":
        return marker.data.splashArt?.name || "Splash Art Marker";  // Add this line
      default:
        return "Map Marker";
    }
  }


  async showMarkerContextMenu(marker, event) {
    event.preventDefault();

    const dialog = document.createElement('sl-dialog');
    dialog.label = `${marker.type.charAt(0).toUpperCase() + marker.type.slice(1)} Options`;

    // Generate marker-specific content
    dialog.innerHTML = this.generateMarkerHTML(marker);

    // Add common delete button to footer
    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.innerHTML = `
      <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
      <sl-button variant="danger" class="delete-btn">
          <span class="material-icons">delete</span>
          Remove ${marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
      </sl-button>
  `;
    dialog.appendChild(footer);

    document.body.appendChild(dialog);

    // Setup marker-specific event handlers
    switch (marker.type) {
      case 'prop':
          this.setupPropEventHandlers(dialog, marker);
          break;
      case 'encounter':
          this.setupEncounterEventHandlers(dialog, marker);
          break;
      case 'door':
          this.setupDoorEventHandlers(dialog, marker);
          break;
      case 'teleport':
          this.setupTeleportEventHandlers(dialog, marker);
          break;
      case 'splash-art':
          this.setupSplashArtEventHandlers(dialog, marker);
          break;
      case 'storyboard':
            this.setupStoryboardEventHandlers(dialog, marker);
            break;
      case 'dungeon':  // Add this case
            this.setupDungeonEventHandlers(dialog, marker);
            break;
      default:
          this.setupDefaultEventHandlers(dialog, marker);
  }

    // Setup common event handlers
    dialog.querySelector('.delete-btn')?.addEventListener('click', () => {
      this.removeMarker(marker);
      dialog.hide();
    });

    dialog.querySelector('.cancel-btn')?.addEventListener('click', () => {
      dialog.hide();
    });

    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    dialog.show();
  }

  generateMarkerHTML(marker) {
    switch (marker.type) {
      case 'prop':
        return this.generatePropMarkerHTML(marker);
      case 'encounter':
        return this.generateEncounterMarkerHTML(marker);
      case 'door':
        return this.generateDoorMarkerHTML(marker);
      case 'teleport':
        return this.generateTeleportMarkerHTML(marker);
      case 'splash-art':
        return this.generateSplashArtMarkerHTML(marker);
      case 'storyboard':
        return this.generateStoryboardMarkerHTML(marker);
      case 'dungeon':
        return this.generateDungeonMarkerHTML(marker);
      default:
        return this.generateDefaultMarkerHTML(marker);
    }
  }

    generateDungeonMarkerHTML(marker) {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 12px;">
          <span class="material-icons" style="font-size: 48px; color: #8B4513;">fort</span>
          <div style="margin-top: 8px; font-weight: bold;">Dungeon Entrance</div>
          <div style="font-size: 0.9em; color: #888; margin-top: 4px;">
            ${marker.data?.name || "Mysterious Dungeon"}
          </div>
        </div>
        
        <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
          <sl-input 
            id="dungeon-name" 
            label="Dungeon Name" 
            value="${marker.data?.name || "Mysterious Dungeon"}"
            placeholder="Enter dungeon name">
          </sl-input>
          
          <sl-select id="dungeon-difficulty" label="Difficulty Level" value="${marker.data?.difficulty || "medium"}" style="margin-top: 12px;">
            <sl-option value="easy">Easy</sl-option>
            <sl-option value="medium">Medium</sl-option>
            <sl-option value="hard">Hard</sl-option>
            <sl-option value="epic">Epic</sl-option>
          </sl-select>
          
          <sl-input 
            id="dungeon-id" 
            label="Dungeon ID" 
            value="${marker.data?.dungeonId || marker.id}"
            placeholder="Unique Dungeon Identifier"
            style="margin-top: 12px;">
          </sl-input>
        </div>
      </div>
    `;
  }

  generateDoorMarkerHTML(marker) {
    const textureCategory = 'doors';
    const hasTextures = this.resourceManager?.resources.textures[textureCategory]?.size > 0;

    let content = `
      <div style="display: flex; flex-direction: column; gap: 16px;">`;

    if (hasTextures) {
      content += `
          <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
              <label style="display: block; margin-bottom: 8px;">Door Type:</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
                  ${Array.from(this.resourceManager.resources.textures[textureCategory].entries()).map(([id, texture]) => `
                      <div class="texture-option" data-texture-id="${id}" 
                          style="cursor: pointer; border: 2px solid ${marker.data.texture?.id === id ? 'var(--sl-color-primary-600)' : 'transparent'
        }; padding: 4px; border-radius: 4px; position: relative;">
                          <img src="${texture.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 2px;">
                          <div style="font-size: 0.8em; text-align: center; margin-top: 4px;">
                              ${texture.name}
                          </div>
                          ${marker.data.texture?.id === id ? `
                              <span class="material-icons" style="position: absolute; top: 4px; right: 4px; color: #4CAF50; 
                                  background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px;">
                                  check_circle
                              </span>
                          ` : ''}
                      </div>
                  `).join('')}
              </div>
          </div>`;
    }

    // Door position and state controls
    content += `
      <div class="door-controls">
          <div class="door-control-row" style="margin-bottom: 16px;">
              <label>Rotation:</label>
              <sl-range min="0" max="359" step="45" value="${marker.data.door?.position?.rotation || 0}" id="door-rotation" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${marker.data.door?.position?.rotation || 0}°</div>
          </div>
          
          <sl-switch id="door-state" ${marker.data.door?.isOpen ? 'checked' : ''}>
              <span style="margin-right: 8px;">Door Open</span>
          </sl-switch>
      </div>

      <!-- Door Sound Selection -->
      <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
          <label style="display: block; margin-bottom: 8px;">Door Sound:</label>
          <div class="sound-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
              ${Array.from(this.resourceManager?.resources.sounds.effects.entries() || []).map(([id, sound]) => `
                  <div class="sound-option" data-sound-id="${id}" 
                       style="border: 1px solid #666; padding: 8px; border-radius: 4px; cursor: pointer;">
                      <div style="text-align: center;">
                          <span class="material-icons" style="font-size: 32px; color: #666;">volume_up</span>
                      </div>
                      <div style="text-align: center; margin-top: 4px; font-size: 0.9em;">
                          ${sound.name}
                      </div>
                      <div style="text-align: center; color: #666; font-size: 0.8em;">
                          ${sound.duration ? sound.duration.toFixed(1) + 's' : 'Unknown duration'}
                      </div>
                  </div>
              `).join('')}
          </div>
      </div>`;

    content += '</div>';
    return content;
  }

  generatePropMarkerHTML(marker) {
  
      // Check if this is a water prop
  const isWaterProp = marker.data?.isWaterProp === true;
  
  if (isWaterProp) {
    // Get water prop properties with defaults
    const isHorizontal = marker.data.prop?.isHorizontal ?? true;
    const waterColor = marker.data.water?.color || '#4488aa';
    const waterDepth = marker.data.water?.depth || 1.0;
    const flowSpeed = marker.data.water?.flowSpeed || 1.0;
    const transparency = marker.data.water?.transparency || 0.7;
    

        // Get size properties
        const scale = marker.data.prop?.scale || 1.0;
        const width = marker.data.prop?.width || 48 * scale;
        const height = marker.data.prop?.height || (isHorizontal ? Math.min(width/3, 16) : 48 * scale);
    
        
    return `
      <div style="display: flex; flex-direction: column;">
        <div style="text-align: center; padding: 12px;">
          <span class="material-icons" style="font-size: 48px; color: ${waterColor};">water_drop</span>
          <div style="margin-top: 8px; font-weight: bold;">Water Surface</div>
          <div style="font-size: 0.9em; color: #888; margin-top: 4px;">
            ${isHorizontal ? 'Horizontal Surface (pond/river)' : 'Vertical Surface (waterfall)'}
          </div>
        </div>
        
          <style>
            /* Preview styles */
            .water-preview {
              width: 100%;
              height: 60px;
              margin-bottom: 12px;
              border-radius: 4px;
              overflow: hidden;
              position: relative;
            }
            .horizontal-preview::before {
              content: "";
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="10" viewBox="0 0 30 10"><path d="M0,5 Q7.5,0 15,5 Q22.5,10 30,5" stroke="rgba(255,255,255,0.3)" fill="none"/></svg>');
              background-size: 30px 10px;
              animation: previewWaterAnim 2s linear infinite;
            }
            .vertical-preview::before {
              content: "";
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="30" viewBox="0 0 10 30"><path d="M5,0 Q0,7.5 5,15 Q10,22.5 5,30" stroke="rgba(255,255,255,0.3)" fill="none"/></svg>');
              background-size: 10px 30px;
              animation: previewWaterfallAnim 1.5s linear infinite;
            }
            @keyframes previewWaterAnim {
              from { background-position: 0 0; }
              to { background-position: 30px 0; }
            }
            @keyframes previewWaterfallAnim {
              from { background-position: 0 0; }
              to { background-position: 0 30px; }
            }
          </style>
          
          <!-- Water Preview -->
          <div id="water-preview" class="water-preview ${isHorizontal ? 'horizontal-preview' : 'vertical-preview'}" 
               style="background-color: rgba(${this.hexToRgb(waterColor)}, ${transparency});">
          </div>
          
<div style="display: flex; flex-direction: row; gap: 12px; align-items: center; margin-bottom: 12px;">
  <sl-switch id="water-orientation" ${isHorizontal ? 'checked' : ''} style="min-width: 0;">
    <span style="font-size: 0.9em;">Horizontal</span>
  </sl-switch>
  
  <sl-switch id="match-map-width" ${marker.data.water?.matchMapWidth ? 'checked' : ''} style="min-width: 0;">
    <span style="font-size: 0.9em;">Map Width</span>
  </sl-switch>
  
  <sl-switch id="match-map-height" ${marker.data.water?.matchMapHeight ? 'checked' : ''} style="min-width: 0;">
    <span style="font-size: 0.9em;">Map Height</span>
  </sl-switch>

</div>

  <div style="color: #666; font-size: 0.8em; margin-bottom: 0px;">
  Surface type and auto-sizing options
</div>

          
          <sl-color-picker id="water-color" label="Water Color" value="${waterColor}" 
                           style="margin-top: 12px; width: 100%;"></sl-color-picker>
          
          <sl-range id="water-depth" label="Water Depth" min="0.1" max="5" step="0.1" value="${waterDepth}"
                    style="margin-top: 12px;">
            <div slot="help-text">Controls depth appearance in 3D view</div>
          </sl-range>
          
          <sl-range id="water-flow" label="Flow Speed" min="0.5" max="2" step="0.5" value="${flowSpeed}"
                    style="margin-top: 12px;">
            <div slot="help-text">Controls animation speed</div>
          </sl-range>
          
          <sl-range id="water-transparency" label="Transparency" min="0.2" max="1" step="0.1" value="${transparency}"
                    style="margin-top: 12px;">
            <div slot="help-text">Controls water opacity</div>
          </sl-range>
      </div>

              <!-- Add size controls -->
          <h4 style="margin-top: 0; margin-bottom: 12px;">Size & Dimensions</h4>
          
          <sl-range id="water-width" label="Width" min="10" max="1000" step="10" value="${width}"
                  style="margin-top: 12px;">
            <div slot="help-text">Water surface width</div>
          </sl-range>
          
          <sl-range id="water-height" label="Height" min="5" max="300" step="5" value="${height}"
                  style="margin-top: 12px;">
            <div slot="help-text">${isHorizontal ? 'Depth appearance' : 'Waterfall height'}</div>
          </sl-range>
          
          <sl-range id="water-scale" label="Scale" min="0.5" max="25" step="0.1" value="${scale}"
                  style="margin-top: 12px;">
            <div slot="help-text">Overall scaling factor</div>
          </sl-range>
      </div>
    `;
  } else {
  
  
    const propTextures = this.resourceManager?.resources.textures.props;
    const envTextures = this.resourceManager?.resources.textures.environmental;
    const hasTextures = (propTextures && propTextures.size > 0) || (envTextures && envTextures.size > 0);

    let content = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
  `;

    if (hasTextures) {
      content += `
          <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
    <label style="display: block; margin-bottom: 8px;">Prop Type:</label>
    <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">  <!-- Added container with scroll -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
            ${(() => {
          let availableTextures = [];

          // Get prop textures
          if (propTextures && propTextures.size > 0) {
            availableTextures.push(...Array.from(propTextures.entries()));
          }

          // Get environmental textures
          if (envTextures && envTextures.size > 0) {
            availableTextures.push(...Array.from(envTextures.entries()));
          }

          //style="color: #666; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">

          return availableTextures.map(([id, texture]) => `
                          <div class="texture-option" data-texture-id="${id}" 
                              style="cursor: pointer; border: 2px solid ${marker.data.texture?.id === id ? 'var(--sl-color-primary-600)' : 'transparent'
            }; padding: 4px; border-radius: 4px; position: relative;">
                              <img src="${texture.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 2px;">
                              <div style="font-size: 0.8em; text-align: center; margin-top: 4px; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">
                                  ${texture.name}
                                  ${texture.category === 'environmental' ?
              `<span style="display: block; font-size: 0.9em; color: #666;">(Environmental)</span>` : ''}
                              </div>
                              ${marker.data.texture?.id === id ? `
                                  <span class="material-icons" style="position: absolute; top: 4px; right: 4px; color: #4CAF50; 
                                      background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px;">
                                      check_circle
                                  </span>
                              ` : ''}
                          </div>
                      `).join('')
        })()}
              </div>
          </div>
      `;
    }

    // Prop settings
    content += `
      <div class="prop-controls">
<div style="margin-bottom: 16px;">
    <div style="display: flex; align-items: center; gap: 8px;">
        <sl-switch id="prop-orientation" ${marker.data.prop?.isHorizontal ? 'checked' : ''}>
            <span style="margin-right: 8px;">Horizontal</span>
        </sl-switch>
        <span class="material-icons help-icon" 
              style="font-size: 16px; color: #666; cursor: help;"
              data-tooltip="prop-horizontal">help_outline</span>

                      <!-- Add the water toggle  -->
          <sl-switch id="water-prop-toggle">
            <span style="margin-right: 8px;">Water Surface</span>
          </sl-switch>

    </div>
</div>
</div>
          </div>
          
          <div class="prop-control-row">
              <label>Rotation:</label>
              <sl-range min="0" max="359" step="15" value="${marker.data.prop?.position?.rotation || 0}" id="prop-rotation" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${marker.data.prop?.position?.rotation || 0}°</div>
          </div>
          
          <div class="prop-control-row">
              <label>Scale:</label>
              <sl-range min="0.5" max="3" step="0.1" value="${marker.data.prop?.scale || 1.0}" id="prop-scale" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${marker.data.prop?.scale || 1.0}x</div>
          </div>
          
          <div class="prop-control-row">
              <label>Height:</label>
              <sl-range min="0" max="4" step="0.1" value="${marker.data.prop?.height || 1.0}" id="prop-height" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${marker.data.prop?.height || 1.0}</div>
          </div>
      </div>

      <div style="margin-top: 12px;">
          <div style="color: #666; font-size: 0.9em; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons" style="font-size: 16px;">info</span>
              <span>${marker.data.prop?.isHorizontal ?
        'Prop will lie flat on surfaces like a book, map, or scroll' :
        'Prop will appear as a vertical standing image in 3D view'}</span>
          </div>
      </div>
  `;

    content += '</div>';
    return content;
  }
  }




  hexToRgb(hex) {
    // Handle undefined or null cases
    if (!hex) {
      console.warn('Undefined hex color, using default');
      hex = '#4488aa'; // Default water color
    }
    
    // Remove the # if present
    hex = hex.replace('#', '');
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Handle invalid values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn('Invalid hex color, using default values');
      return '68, 136, 170'; // Default RGB values
    }
    
    return `${r}, ${g}, ${b}`;
  }

  generateEncounterMarkerHTML(marker) {
    let content = `
      <div style="display: flex; flex-direction: column; gap: 16px;">`;

    if (!marker.data.monster) {
      content += `
          <div style="margin-top: 8px;">
              <div class="mini-bestiary">
                  <div class="bestiary-search" style="margin-bottom: 8px;">
                      <sl-input placeholder="Search monsters..." size="small" id="mini-monster-search" clearable></sl-input>
                  </div>
                  <div class="mini-bestiary-grid" style="
                      display: grid;
                      grid-template-columns: repeat(3, 1fr);
                      gap: 8px;
                      max-height: 300px;
                      overflow-y: auto;
                      padding: 8px;
                      background: #f5f5f5;
                      border-radius: 4px;">
                      <div class="loading-indicator" style="grid-column: 1/-1; text-align: center; padding: 20px;">
                          <sl-spinner></sl-spinner>
                          <div>Loading monsters...</div>
                      </div>
                  </div>
              </div>
              
              <div style="margin-top: 12px;">
                  <sl-button id="linkMonster" size="small">
                      <span class="material-icons">link</span>
                      Paste Monster HTML
                  </sl-button>
              </div>
          </div>`;
    } else {
      content += `
          <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
              ${marker.data.monster.token?.data ? `
                  <div style="flex: 0 0 150px; text-align: center;">
                      <img src="${marker.data.monster.token.data}" style="width: 150px; height: 150px; object-fit: contain; border-radius: 5px;">
                  </div>
              ` : ''}
              
              <div style="flex: 1;">
                  <div style="font-style: italic; color: #666; margin-bottom: 8px;">
                      ${marker.data.monster.basic.size} ${marker.data.monster.basic.type}, ${marker.data.monster.basic.alignment}
                  </div>
                  
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                      <div>
                          <div style="font-weight: bold;">Armor Class</div>
                          <div>${marker.data.monster.stats.ac}</div>
                      </div>
                      <div>
                          <div style="font-weight: bold;">Hit Points</div>
                          <div>${marker.data.monster.stats.hp.average} (${marker.data.monster.stats.hp.roll})</div>
                      </div>
                      <div>
                          <div style="font-weight: bold;">Speed</div>
                          <div>${marker.data.monster.stats.speed}</div>
                      </div>
                  </div>
                  
                  <div>
                      <div style="font-weight: bold;">Challenge Rating:</div>
                      <div>${marker.data.monster.basic.cr} (${marker.data.monster.basic.xp} XP)</div>
                  </div>
              </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <sl-button id="cloneMonster" size="small">
                  <span class="material-icons">content_copy</span>
                  Clone
              </sl-button>
              <sl-button id="linkMonster" size="small">
                  <span class="material-icons">link</span>
                  Change Monster
              </sl-button>
          </div>`;
    }

    content += '</div>';
    return content;
  }

  generateTeleportMarkerHTML(marker) {
    let content = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="margin-bottom: 12px;">
              <div style="font-weight: bold; margin-bottom: 4px;">
                  Teleport Point ${marker.data.isPointA ? 'A' : 'B'}
              </div>
              <div style="color: #666;">
                  ${marker.data.hasPair ?
        `Connected to Point ${marker.data.isPointA ? 'B' : 'A'}` :
        'No connection - Place another point to connect'
      }
              </div>
          </div>`;

    // For paired teleports, add sound options
    if (marker.data.hasPair) {
      content += `
          <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
              <label style="display: block; margin-bottom: 8px;">Teleport Sound:</label>
              <div class="sound-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
                  ${Array.from(this.resourceManager?.resources.sounds.effects.entries() || []).map(([id, sound]) => `
                      <div class="sound-option" data-sound-id="${id}" 
                           style="border: 1px solid #666; padding: 8px; border-radius: 4px; cursor: pointer;">
                          <div style="text-align: center;">
                              <span class="material-icons" style="font-size: 32px; color: #666;">volume_up</span>
                          </div>
                          <div style="text-align: center; margin-top: 4px; font-size: 0.9em;">
                              ${sound.name}
                          </div>
                          <div style="text-align: center; color: #666; font-size: 0.8em;">
                              ${sound.duration ? sound.duration.toFixed(1) + 's' : 'Unknown duration'}
                          </div>
                      </div>
                  `).join('')}
              </div>
          </div>`;
    }

    content += '</div>';
    return content;
  }

  generateDefaultMarkerHTML(marker) {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="text-align: center; padding: 20px;">
              <span class="material-icons" style="font-size: 48px; color: #666;">place</span>
              <div style="margin-top: 8px;">${marker.type.charAt(0).toUpperCase() + marker.type.slice(1)} Marker</div>
          </div>
      </div>
  `;
  }

  // Add this method to MapEditor class
  generateSplashArtMarkerHTML(marker) {

    // Add this at the start of generateSplashArtMarkerHTML
    console.log('Resource Manager state:', {
      hasResourceManager: !!this.resourceManager,
      splashArtCategories: this.resourceManager ? Object.keys(this.resourceManager.resources.splashArt) : null,
      availableSplashArt: this.resourceManager ? Object.entries(this.resourceManager.resources.splashArt).map(([category, artMap]) => ({
        category,
        count: artMap.size,
        items: Array.from(artMap.entries()).map(([id, art]) => ({
          id,
          name: art.name
        }))
      })) : null
    });

    // Get splash art from all categories (title, loading, background)
    let allSplashArt = [];
    Object.entries(this.resourceManager?.resources.splashArt || {}).forEach(([category, artMap]) => {
      Array.from(artMap.entries()).forEach(([id, art]) => {
        allSplashArt.push([id, { ...art, category }]);
      });
    });

    let content = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Splash Art Selection -->
          <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
              <label style="display: block; margin-bottom: 8px;">Select Splash Art:</label>
              <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
                      ${allSplashArt.map(([id, art]) => `
                          <div class="splash-art-option" data-art-id="${id}" data-category="${art.category}"
                              style="cursor: pointer; border: 2px solid ${marker.data.splashArt?.id === id ? 'var(--sl-color-primary-600)' : 'transparent'
      }; padding: 4px; border-radius: 4px; position: relative;">
                              <img src="${art.thumbnail}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 2px;">
                              <div style="font-size: 0.8em; text-align: center; margin-top: 4px;">
                                  ${art.name}
                                  <span style="display: block; font-size: 0.9em; color: #666;">(${art.category})</span>
                              </div>
                              ${marker.data.splashArt?.id === id ? `
                                  <span class="material-icons" style="position: absolute; top: 4px; right: 4px; color: #4CAF50; 
                                      background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px;">
                                      check_circle
                                  </span>
                              ` : ''}
                          </div>
                      `).join('')}
                  </div>
              </div>
          </div>

          <!-- Display Settings -->
          <div class="splash-art-settings" style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
              <div style="margin-bottom: 16px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                      <sl-switch id="art-orientation" ${marker.data.orientation?.isHorizontal ? 'checked' : ''}>
                          <span style="margin-right: 8px;">Horizontal</span>
                      </sl-switch>
                      <span class="material-icons help-icon" 
                            style="font-size: 16px; color: #666; cursor: help;"
                            data-tooltip="art-horizontal">help_outline</span>
                  </div>
              </div>

              <!-- Position Controls -->
              <div class="position-controls">
                  <div class="control-row" style="margin-bottom: 16px;">
                      <label>Rotation:</label>
                      <sl-range min="0" max="359" step="15" value="${marker.data.position?.rotation || 0}" id="art-rotation" 
                               style="width: 100%;"></sl-range>
                      <div style="min-width: 40px; text-align: right;">${marker.data.position?.rotation || 0}°</div>
                  </div>

                  <div class="control-row" style="margin-bottom: 16px;">
                      <label>Scale:</label>
                      <sl-range min="0.5" max="3" step="0.1" value="${marker.data.scale || 1.0}" id="art-scale" 
                               style="width: 100%;"></sl-range>
                      <div style="min-width: 40px; text-align: right;">${marker.data.scale || 1.0}x</div>
                  </div>

                  <div class="control-row">
                      <label>Height:</label>
                      <sl-range min="0" max="4" step="0.1" value="${marker.data.height || 1.0}" id="art-height" 
                               style="width: 100%;"></sl-range>
                      <div style="min-width: 40px; text-align: right;">${marker.data.height || 1.0}</div>
                  </div>
              </div>
          </div>

          <!-- Interaction Settings -->
          <div class="interaction-settings" style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
              <sl-input 
                  type="text" 
                  label="Inspect Message" 
                  value="${marker.data.inspectMessage || 'Press E to inspect'}"
                  id="inspect-message">
              </sl-input>

              <!-- Add sound for inspection interaction -->
              <div style="margin-top: 12px;">
                  <label style="display: block; margin-bottom: 8px;">Inspection Sound:</label>
                  <div class="sound-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
                      ${Array.from(this.resourceManager?.resources.sounds.effects.entries() || []).map(([id, sound]) => `
                          <div class="sound-option" data-sound-id="${id}" 
                               style="border: 1px solid #666; padding: 8px; border-radius: 4px; cursor: pointer;">
                              <div style="text-align: center;">
                                  <span class="material-icons" style="font-size: 32px; color: #666;">volume_up</span>
                              </div>
                              <div style="text-align: center; margin-top: 4px; font-size: 0.9em;">
                                  ${sound.name}
                              </div>
                              <div style="text-align: center; color: #666; font-size: 0.8em;">
                                  ${sound.duration ? sound.duration.toFixed(1) + 's' : 'Unknown duration'}
                              </div>
                          </div>
                      `).join('')}
                  </div>
              </div>
          </div>
      </div>
  `;

    return content;
  }

  generateStoryboardMarkerHTML(marker) {
    // Get available stories for dropdown
    let storiesOptions = '';
    
    // Check if we have a storyboard with stories
    if (window.storyboard && window.storyboard.storyGraphs && window.storyboard.storyGraphs.size > 0) {
      // Create dropdown options
      const storyOptions = Array.from(window.storyboard.storyGraphs.entries()).map(([id, graph]) => {
        // Use the story name if available, otherwise fallback to ID-based name
        const displayName = graph.name || id.replace('graph_', 'Story ').replace(/(\d{13})/, s => s.substring(0, 4) + '...');
        return `<option value="${id}" ${marker.data?.storyId === id ? 'selected' : ''}>${displayName}</option>`;
      });
      
      storiesOptions = `
        <div style="margin-top: 12px;">
          <label style="display: block; margin-bottom: 4px;">Select Story:</label>
          <select id="story-id-select" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background-color: white;">
            <option value="">-- Select a story --</option>
            ${storyOptions.join('')}
          </select>
        </div>
      `;
    } else {
      storiesOptions = `
        <div style="margin-top: 12px; color: #888; text-align: center; padding: 12px;">
          <div class="material-icons" style="font-size: 32px; opacity: 0.5; margin-bottom: 8px;">info</div>
          <p>No stories available. Create a story in the Storyboard editor first.</p>
          <button id="open-storyboard-btn" style="padding: 8px 16px; display: inline-flex; align-items: center; gap: 8px; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-top: 8px;">
            <span class="material-icons" style="font-size: 16px;">auto_stories</span>
            Open Storyboard Editor
          </button>
        </div>
      `;
    }
  
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 12px;">
          <span class="material-icons" style="font-size: 48px; color: #673AB7;">auto_stories</span>
          <div style="margin-top: 8px; font-weight: bold;">Story Trigger</div>
          <div style="font-size: 0.9em; color: #888; margin-top: 4px;">
            Interact with this marker to start a story
          </div>
        </div>
        
        <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
          <div class="form-group">
            <label for="display-label">Display Label:</label>
            <input type="text" id="display-label" placeholder="Label shown in game" 
                   value="${marker.data?.label || 'Read Story'}" 
                   style="width: 100%; padding: 8px; margin-top: 4px; border-radius: 4px; border: 1px solid #ccc;">
          </div>
        </div>
        
        <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
          <div class="form-group">
            <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="trigger-once" ${marker.data?.triggerOnce !== false ? 'checked' : ''} 
                     style="width: 16px; height: 16px;">
              <span>Trigger Only Once</span>
            </label>
          </div>
        </div>
        
        ${storiesOptions}
      </div>
    `;
  }

  setupSplashArtEventHandlers(dialog, marker) {
    dialog.querySelectorAll('.splash-art-option').forEach(option => {
      option.addEventListener('click', () => {
        const artId = option.dataset.artId;
        const category = option.dataset.category;

        console.log('Splash art clicked:', {
          artId,
          category,
          element: option
        });

        const art = this.resourceManager.resources.splashArt[category]?.get(artId);

        console.log('Found art data:', {
          found: !!art,
          artData: art
        });

        if (art) {
          // Initialize marker data structure if needed
          if (!marker.data) marker.data = {};

          // Store the complete art data
          marker.data.splashArt = {
            ...art,
            id: artId,
            category: category
          };


          console.log('Updated marker data:', {
            markerData: marker.data,
            splashArt: marker.data.splashArt
          });

          // Update visual feedback in dialog
          dialog.querySelectorAll('.splash-art-option').forEach(opt => {
            opt.style.cssText = opt === option ? `
                  cursor: pointer;
                  border: 2px solid var(--sl-color-primary-600);
                  padding: 4px;
                  border-radius: 4px;
                  position: relative;
                  background-color: rgba(var(--sl-color-primary-600-rgb), 0.1);
              ` : `
                  cursor: pointer;
                  border: 2px solid transparent;
                  padding: 4px;
                  border-radius: 4px;
                  position: relative;
              `;
          });

          // Update marker visual if needed
          const markerElement = marker.element;
          if (markerElement) {
            const icon = markerElement.querySelector('.material-icons');
            if (icon) {
              icon.style.color = 'var(--sl-color-primary-600)';
            }
          }
        } else {
          console.warn('Could not find art data for selection:', {
            artId,
            category,
            availableCategories: Object.keys(this.resourceManager.resources.splashArt)
          });
        }
      });
    });

    // Orientation switch
    const orientationSwitch = dialog.querySelector('#art-orientation');
    if (orientationSwitch) {
      orientationSwitch.addEventListener('sl-change', (e) => {
        if (!marker.data.orientation) marker.data.orientation = {};
        marker.data.orientation.isHorizontal = e.target.checked;
        this.updateMarkerAppearance(marker);
      });
    }

    // Help icon
    const helpIcon = dialog.querySelector('[data-tooltip="art-horizontal"]');
    if (helpIcon) {
      helpIcon.addEventListener('mouseenter', () => {
        this.showCustomToast(
          'When enabled, art marker will lie flat on surfaces',
          'info-circle',
          3000,
          'info'
        );
      });
    }

    // Position controls
    const rotationSlider = dialog.querySelector('#art-rotation');
    if (rotationSlider) {
      rotationSlider.addEventListener('sl-input', (e) => {
        const rotation = parseInt(e.target.value);
        if (!marker.data.position) marker.data.position = {};
        marker.data.position.rotation = rotation;
        rotationSlider.nextElementSibling.textContent = `${rotation}°`;
        this.updateMarkerAppearance(marker);
      });
    }

    const scaleSlider = dialog.querySelector('#art-scale');
    if (scaleSlider) {
      scaleSlider.addEventListener('sl-input', (e) => {
        const scale = parseFloat(e.target.value);
        marker.data.scale = scale;
        scaleSlider.nextElementSibling.textContent = `${scale.toFixed(1)}x`;
        this.updateMarkerAppearance(marker);
      });
    }

    const heightSlider = dialog.querySelector('#art-height');
    if (heightSlider) {
      heightSlider.addEventListener('sl-input', (e) => {
        const height = parseFloat(e.target.value);
        marker.data.height = height;
        heightSlider.nextElementSibling.textContent = height.toFixed(1);
        this.updateMarkerAppearance(marker);
      });
    }

    // Inspect message
    const messageInput = dialog.querySelector('#inspect-message');
    if (messageInput) {
      messageInput.addEventListener('sl-change', (e) => {
        marker.data.inspectMessage = e.target.value;
      });
    }

    // Sound selection
    dialog.querySelectorAll('.sound-option').forEach(option => {
      option.addEventListener('click', () => {
        const soundId = option.dataset.soundId;
        const sound = this.resourceManager.resources.sounds.effects.get(soundId);
        if (sound) {
          // Preview the sound
          if (this.resourceManager.activeAudio) {
            this.resourceManager.stopSound(soundId);
          }
          this.resourceManager.playSound(soundId, 'effects');

          // Store the sound selection
          if (!marker.data.effects) marker.data.effects = {};
          marker.data.effects.inspectSound = sound;

          // Update selection in dialog
          dialog.querySelectorAll('.sound-option').forEach(opt =>
            opt.style.border = opt.dataset.soundId === soundId ?
              '2px solid var(--sl-color-primary-600)' : '1px solid #666'
          );
        }
      });
    });
  }

  setupPropEventHandlers(dialog, marker) {
    // First check if this is a water prop
    const isWaterProp = marker.data?.isWaterProp === true;
    
    if (isWaterProp) {
      // Set up event handlers for water prop specific controls
      const orientationSwitch = dialog.querySelector('#water-orientation');
      const colorPicker = dialog.querySelector('#water-color');
      const depthSlider = dialog.querySelector('#water-depth');
      const flowSlider = dialog.querySelector('#water-flow');
      const transparencySlider = dialog.querySelector('#water-transparency');
      const preview = dialog.querySelector('#water-preview');

      const widthSlider = dialog.querySelector('#water-width');
      const heightSlider = dialog.querySelector('#water-height');
      const scaleSlider = dialog.querySelector('#water-scale');
      

      const matchWidthToggle = dialog.querySelector('#match-map-width');
const matchHeightToggle = dialog.querySelector('#match-map-height');

      // Initialize water object if not present
      if (!marker.data.water) {
        marker.data.water = {
          color: '#4488aa',
          depth: 1.0,
          flowSpeed: 1.0,
          transparency: 0.7
        };
      }



      const updatePreview = () => {
        if (!preview) return;
        
        const isHorizontal = orientationSwitch?.checked || true;
        
        // Safety check for colorPicker
        let color = '#4488aa'; // Default fallback
        if (colorPicker && colorPicker.value) {
          color = colorPicker.value;
        }
        
        // Safety check for transparency
        let transparency = 0.7; // Default fallback
        if (transparencySlider && !isNaN(parseFloat(transparencySlider.value))) {
          transparency = parseFloat(transparencySlider.value);
        }
        
        preview.className = `water-preview ${isHorizontal ? 'horizontal-preview' : 'vertical-preview'}`;
        
        try {
          preview.style.backgroundColor = `rgba(${this.hexToRgb(color)}, ${transparency})`;
        } catch (error) {
          console.error('Error setting preview background:', error);
          preview.style.backgroundColor = 'rgba(68, 136, 170, 0.7)'; // Fallback
        }
        
        // Update animation speed based on flow speed
        let flowSpeed = 1.0; // Default
        if (flowSlider && !isNaN(parseFloat(flowSlider.value))) {
          flowSpeed = parseFloat(flowSlider.value);
        }
        preview.style.animationDuration = `${2/flowSpeed}s`;
        
        // Update preview height based on orientation
        if (isHorizontal) {
          preview.style.height = '30px';
        } else {
          preview.style.height = '100px';
        }
      };

      
      // Set up event handlers for each control
      if (orientationSwitch) {
        orientationSwitch.addEventListener('sl-change', () => {
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.isHorizontal = orientationSwitch.checked;
          updatePreview();
        });
      }
      
      if (colorPicker) {
        colorPicker.addEventListener('sl-change', () => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.color = colorPicker.value;
          updatePreview();
        });
      }
      
      if (depthSlider) {
        depthSlider.addEventListener('sl-input', () => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.depth = parseFloat(depthSlider.value);
        });
      }
      
      if (flowSlider) {
        flowSlider.addEventListener('sl-input', () => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.flowSpeed = parseFloat(flowSlider.value);
          updatePreview();
        });
      }
      
      if (transparencySlider) {
        transparencySlider.addEventListener('sl-input', () => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.transparency = parseFloat(transparencySlider.value);
          updatePreview();
        });
      }

      if (widthSlider) {
        widthSlider.addEventListener('sl-input', () => {
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.width = parseFloat(widthSlider.value);
          updatePreview();
        });
      }
      
      if (heightSlider) {
        heightSlider.addEventListener('sl-input', () => {
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.height = parseFloat(heightSlider.value);
          updatePreview();
        });
      }
      
      if (scaleSlider) {
        scaleSlider.addEventListener('sl-input', () => {
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.scale = parseFloat(scaleSlider.value);
          
          // If width/height not explicitly set, they should update with scale
          if (!marker.data.prop.width) {
            const baseWidth = 48;
            marker.data.prop.width = baseWidth * marker.data.prop.scale;
            if (widthSlider) widthSlider.value = marker.data.prop.width;
          }
          
          if (!marker.data.prop.height) {
            const baseHeight = marker.data.prop.isHorizontal ? 16 : 48;
            marker.data.prop.height = baseHeight * marker.data.prop.scale;
            if (heightSlider) heightSlider.value = marker.data.prop.height;
          }

          updatePreview();
        });
      }

      if (matchWidthToggle) {
        matchWidthToggle.addEventListener('sl-change', (e) => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.matchMapWidth = e.target.checked;
          
          // If enabled, set the width
          if (e.target.checked) {
            // Get map width (this depends on how your map dimensions are stored)
            const mapWidth = this.getMapWidth(); // You'll need to implement this function
            marker.data.prop.width = mapWidth;
            
            // Update width slider if present
            const widthSlider = dialog.querySelector('#water-width');
            if (widthSlider) {
              widthSlider.value = mapWidth;
              widthSlider.disabled = e.target.checked; // Disable slider when match is enabled
            }
          } else {
            // Re-enable width slider
            const widthSlider = dialog.querySelector('#water-width');
            if (widthSlider) {
              widthSlider.disabled = false;
            }
          }
        });
      }
      
      if (matchHeightToggle) {
        matchHeightToggle.addEventListener('sl-change', (e) => {
          if (!marker.data.water) marker.data.water = {};
          marker.data.water.matchMapHeight = e.target.checked;
          
          // If enabled, set the height
          if (e.target.checked) {
            // Get map height
            const mapHeight = this.getMapHeight(); // You'll need to implement this function
            marker.data.prop.height = mapHeight;
            
            // Update height slider if present
            const heightSlider = dialog.querySelector('#water-height');
            if (heightSlider) {
              heightSlider.value = mapHeight;
              heightSlider.disabled = e.target.checked;
            }
          } else {
            // Re-enable height slider
            const heightSlider = dialog.querySelector('#water-height');
            if (heightSlider) {
              heightSlider.disabled = false;
            }
          }
        });
      }


    } else {


      const waterToggle = dialog.querySelector('#water-prop-toggle');
      if (waterToggle) {
        waterToggle.addEventListener('sl-change', (e) => {
          if (e.target.checked) {
            // Convert to water prop
            marker.data.isWaterProp = true;
            
            // Initialize water properties
            marker.data.water = {
              color: '#4488aa',
              depth: 1.0,
              flowSpeed: 1.0,
              transparency: 0.7
            };
            
            // Initialize prop properties if needed
            if (!marker.data.prop) marker.data.prop = {};
            marker.data.prop.isHorizontal = true;
            marker.data.prop.height = 0.1;
            
            // Close current dialog and reopen with water props
            dialog.hide();
            
            // Slight delay to ensure dialog closes first
            setTimeout(() => {
              this.showMarkerContextMenu(marker, { preventDefault: () => {} });
            }, 100);
          }
        });
      }

    // Setup texture selection
    dialog.querySelectorAll('.texture-option').forEach(option => {
      option.addEventListener('click', () => {
        const textureId = option.dataset.textureId;
        const texture = this.resourceManager.resources.textures.props.get(textureId) ||
          this.resourceManager.resources.textures.environmental.get(textureId);
        if (texture) {
          marker.data.texture = texture;

          // Update visual appearance
          this.updateMarkerAppearance(marker);

          // Update selection in dialog
          dialog.querySelectorAll('.texture-option').forEach(opt =>
            opt.style.border = opt.dataset.textureId === textureId ?
              '2px solid var(--sl-color-primary-600)' : '2px solid transparent'
          );
        }
      });
    });

    // Setup rotation control
    const rotationSlider = dialog.querySelector('#prop-rotation');
    if (rotationSlider) {
      rotationSlider.addEventListener('sl-input', (e) => {
        const rotation = parseInt(e.target.value);
        // Update display
        rotationSlider.nextElementSibling.textContent = `${rotation}°`;

        // Update prop data
        if (!marker.data.prop) marker.data.prop = {};
        if (!marker.data.prop.position) marker.data.prop.position = {};
        marker.data.prop.position.rotation = rotation;

        // Update visual appearance
        const propVisual = marker.element?.querySelector('.prop-visual');
        if (propVisual) {
          propVisual.style.transform = `rotate(${rotation}deg)`;
        }
      });
    }

    // Setup scale control
    const scaleSlider = dialog.querySelector('#prop-scale');
    if (scaleSlider) {
      scaleSlider.addEventListener('sl-input', (e) => {
        const scale = parseFloat(e.target.value).toFixed(1);
        // Update display
        scaleSlider.nextElementSibling.textContent = `${scale}x`;

        // Update prop data
        if (!marker.data.prop) marker.data.prop = {};
        marker.data.prop.scale = parseFloat(scale);

        // Update visual appearance
        this.updateMarkerAppearance(marker);
      });
    }

    // Setup height control
    const heightSlider = dialog.querySelector('#prop-height');
    if (heightSlider) {
      heightSlider.addEventListener('sl-input', (e) => {
        const height = parseFloat(e.target.value).toFixed(1);
        // Update display
        heightSlider.nextElementSibling.textContent = `${height}`;

        // Update prop data
        if (!marker.data.prop) marker.data.prop = {};
        marker.data.prop.height = parseFloat(height);
        this.updateMarkerAppearance(marker);
      });
    }

    // Setup orientation switch
    const orientationSwitch = dialog.querySelector('#prop-orientation');
    if (orientationSwitch) {
      orientationSwitch.addEventListener('sl-change', (e) => {
        const isHorizontal = e.target.checked;

        // Update prop data
        if (!marker.data.prop) marker.data.prop = {};
        marker.data.prop.isHorizontal = isHorizontal;

        // Update visual appearance
        const propVisual = marker.element?.querySelector('.prop-visual');
        if (propVisual) {
          propVisual.classList.toggle('horizontal-prop', isHorizontal);
        }
      });
    }

    const helpIcon = dialog.querySelector('[data-tooltip="prop-horizontal"]');
    if (helpIcon) {
      helpIcon.addEventListener('mouseenter', () => {
        this.showCustomToast(
          'When enabled, prop will lie flat on surfaces',
          'info-circle',
          3000,
          'info'
        );
      });
    }

    dialog.addEventListener('sl-after-hide', () => {
      // If it was converted to a water prop, update its appearance
      if (marker.data?.isWaterProp) {
        this.updateWaterPropVisual(marker);
      }
    });

  }
}

  // updateWaterPropVisual(marker) {
  //   if (!marker.element) return;
    
  //   const propVisual = marker.element.querySelector('.prop-visual');
  //   if (!propVisual) return;
    
  //   // Make sure we have water data
  //   if (!marker.data.water) return;
    
  //   // Update classes based on orientation
  //   propVisual.className = `prop-visual water-prop ${marker.data.prop.isHorizontal ? 'horizontal-water' : 'vertical-water'}`;
    
  //   // Update styles based on water properties
  //   const color = marker.data.water.color;
  //   const transparency = marker.data.water.transparency;
  //   propVisual.style.backgroundColor = `rgba(${this.hexToRgb(color)}, ${transparency})`;
  //   propVisual.style.borderColor = color;
    
  //   // Update flow speed
  //   propVisual.setAttribute('data-flow-speed', marker.data.water.flowSpeed);
    
  //   // Update size based on orientation
  //   const baseSize = 48;
  //   const scale = marker.data.prop.scale || 1.0;
  //   const width = baseSize * scale;
  //   const height = marker.data.prop.isHorizontal ? baseSize * scale / 3 : baseSize * scale;
    
  //   propVisual.style.width = `${width}px`;
  //   propVisual.style.height = `${height}px`;
  //   propVisual.style.left = `-${width / 2}px`;
  //   propVisual.style.top = `-${height / 2}px`;
  //   propVisual.style.borderRadius = marker.data.prop.isHorizontal ? '4px' : '0';
  // }

  // Add this method to MapEditor

  updateWaterPropVisual(marker) {
  if (!marker.element || !marker.data?.isWaterProp) return;
  
  // Find or create the prop visual element
  let propVisual = marker.element.querySelector('.prop-visual');
  if (!propVisual) {
    propVisual = document.createElement('div');
    propVisual.className = 'prop-visual';
    marker.element.appendChild(propVisual);
  }
  
  // Get water properties
  const isHorizontal = marker.data.prop?.isHorizontal !== false;
  const waterColor = marker.data.water?.color || '#4488aa';
  const transparency = marker.data.water?.transparency || 0.7;
  const flowSpeed = marker.data.water?.flowSpeed || 1.0;
  const scale = marker.data.prop?.scale || 1.0;
  
  // Get dimensions - use stored dimensions if available, otherwise defaults
  const width = marker.data.prop?.width || 48 * scale;
  // const height = isHorizontal ? Math.min(width/3, 16 * scale) : 48 * scale;
  const height = marker.data.prop?.height || (isHorizontal ? 24 * scale : 48 * scale);
  
  // Update class for water animation
  propVisual.className = `prop-visual water-prop ${isHorizontal ? 'horizontal-water' : 'vertical-water'}`;
  
  // Update styles
  propVisual.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    position: absolute;
    left: -${width / 2}px;
    top: -${height / 2}px;
    background-color: rgba(${this.hexToRgb(waterColor)}, ${transparency});
    border: 1px solid ${waterColor};
    transform: rotate(${marker.data.prop?.position?.rotation || 0}deg);
    transform-origin: center;
    border-radius: ${isHorizontal ? '4px' : '0'};
    overflow: hidden;
  `;
  
  // Set flow speed for animation
  propVisual.setAttribute('data-flow-speed', flowSpeed);
  
  // Remove any previous texture images
  const img = propVisual.querySelector('img');
  if (img) img.remove();

  const propImg = propVisual.querySelector('img');
if (propImg) {
  propImg.style.display = 'none';
}
}


showCustomToast(message, icon = "info", timeout = 3000, bgColor = "#4CAF50", iconColor = "black") {
    // Create a container if it doesn't exist
    let container = document.querySelector('.custom-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'custom-toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    // Create the toast element
    const toast = document.createElement("div");
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 24px 16px;
        background-color: ${bgColor};
        color: white;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        box-shadow: 0px 4px 6px rgba(0,0,0,0.1);
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s, transform 0.3s;
    `;

    // Icon
    const iconElement = document.createElement("span");
    iconElement.className = "material-icons";
    iconElement.textContent = icon;
    iconElement.style.color = iconColor;
    toast.appendChild(iconElement);

    // Message
    const messageElement = document.createElement("span");
    messageElement.textContent = message;
    toast.appendChild(messageElement);

    // Close button
    const closeButton = document.createElement("span");
    closeButton.className = "material-icons";
    closeButton.textContent = "close";
    closeButton.style.cssText = "cursor: pointer; margin-left: auto; color: white;";
    closeButton.onclick = () => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => container.removeChild(toast), 300);
    };
    toast.appendChild(closeButton);

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    // Auto-remove after timeout
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => container.removeChild(toast), 300);
    }, timeout);
}

// Example usage
//showCustomToast("Map loaded successfully!", "check_circle", 3000, "#4CAF50", "white");


  setupEncounterEventHandlers(dialog, marker) {
    if (!marker.data.monster) {
      // Load mini bestiary if no monster selected
      this.loadMiniBestiary(dialog, marker);

      // Setup paste monster HTML button
      const linkMonsterBtn = dialog.querySelector('#linkMonster');
      if (linkMonsterBtn) {
        linkMonsterBtn.addEventListener('click', () => {
          dialog.hide();
          this.showMonsterSelector(marker);
        });
      }
    } else {
      // Setup clone button
      const cloneBtn = dialog.querySelector('#cloneMonster');
      if (cloneBtn) {
        cloneBtn.addEventListener('click', () => {
          if (this.monsterManager) {
            this.monsterManager.cloneEncounter(marker);
          }
          dialog.hide();
        });
      }

      // Setup change monster button
      const linkMonsterBtn = dialog.querySelector('#linkMonster');
      if (linkMonsterBtn) {
        linkMonsterBtn.addEventListener('click', () => {
          dialog.hide();
          this.showMonsterSelector(marker);
        });
      }
    }
  }

  setupDoorEventHandlers(dialog, marker) {
    // Setup texture selection
    dialog.querySelectorAll('.texture-option').forEach(option => {
      option.addEventListener('click', () => {
        const textureId = option.dataset.textureId;
        const texture = this.resourceManager.resources.textures.doors.get(textureId);
        if (texture) {
          marker.data.texture = texture;
          this.updateMarkerAppearance(marker);

          // Update selection in dialog
          dialog.querySelectorAll('.texture-option').forEach(opt =>
            opt.style.border = opt.dataset.textureId === textureId ?
              '2px solid var(--sl-color-primary-600)' : '2px solid transparent'
          );
        }
      });
    });

    // Setup rotation control
    const rotationSlider = dialog.querySelector('#door-rotation');
    if (rotationSlider) {
      rotationSlider.addEventListener('sl-input', (e) => {
        const rotation = parseInt(e.target.value);
        // Update display
        rotationSlider.nextElementSibling.textContent = `${rotation}°`;

        // Update door data
        if (!marker.data.door) marker.data.door = {};
        if (!marker.data.door.position) marker.data.door.position = {};
        marker.data.door.position.rotation = rotation;

        // Update visual appearance
        marker.element.style.transform = `rotate(${rotation}deg)`;
      });
    }

    // Setup door state toggle
    // Enhanced door state toggle
    const stateSwitch = dialog.querySelector('#door-state');
    if (stateSwitch) {
      stateSwitch.addEventListener('sl-change', (e) => {
        if (!marker.data.door) marker.data.door = {};
        const isOpen = e.target.checked;
        marker.data.door.isOpen = isOpen;

        // Visual feedback for door state
        const doorVisual = marker.element.querySelector('.door-visual');
        if (doorVisual) {
          doorVisual.classList.toggle('door-open', isOpen);
          doorVisual.style.opacity = isOpen ? '0.6' : '1'; // Make door look more "open"
        }

        // Play door sound if one is assigned
        if (marker.data.effects?.doorSound) {
          this.resourceManager.playSound(marker.data.effects.doorSound.id, 'effects');
        }
      });
    }

    // Sound selection handler
    dialog.querySelectorAll('.sound-option').forEach(option => {
      option.addEventListener('click', () => {
        const soundId = option.dataset.soundId;
        const sound = this.resourceManager.resources.sounds.effects.get(soundId);
        if (sound) {
          // Preview the sound
          if (this.resourceManager.activeAudio) {
            this.resourceManager.stopSound(soundId);
          }
          this.resourceManager.playSound(soundId, 'effects');

          // Store the sound selection
          if (!marker.data.effects) marker.data.effects = {};
          marker.data.effects.doorSound = sound;

          // Update selection in dialog
          dialog.querySelectorAll('.sound-option').forEach(opt =>
            opt.style.border = opt.dataset.soundId === soundId ?
              '2px solid var(--sl-color-primary-600)' : '1px solid #666'
          );
        }
      });
    });
  }

  setupTeleportEventHandlers(dialog, marker) {
    // Setup sound selection
    dialog.querySelectorAll('.sound-option').forEach(option => {
      option.addEventListener('click', () => {
        const soundId = option.dataset.soundId;
        const sound = this.resourceManager.resources.sounds.effects.get(soundId);
        if (sound) {
          // Preview the sound
          if (this.resourceManager.activeAudio) {
            this.resourceManager.stopSound(soundId);
          }
          this.resourceManager.playSound(soundId, 'effects');

          // Store the sound selection
          if (!marker.data.effects) marker.data.effects = {};
          marker.data.effects.teleportSound = sound;

          // Update selection in dialog
          dialog.querySelectorAll('.sound-option').forEach(opt =>
            opt.style.border = opt.dataset.soundId === soundId ?
              '2px solid var(--sl-color-primary-600)' : '1px solid #666'
          );
        }
      });
    });
  }

  

  setupStoryboardEventHandlers(dialog, marker) {
    // Handle story selection dropdown
    const storySelect = dialog.querySelector('#story-id-select');
    if (storySelect) {
      storySelect.addEventListener('change', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.storyId = e.target.value;
        console.log(`Selected story: ${marker.data.storyId}`);
      });
    }
    
    // Handle display label input
    const labelInput = dialog.querySelector('#display-label');
    if (labelInput) {
      labelInput.addEventListener('input', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.label = e.target.value;
      });
    }
    
    // Handle trigger once checkbox
    const triggerOnceCheckbox = dialog.querySelector('#trigger-once');
    if (triggerOnceCheckbox) {
      triggerOnceCheckbox.addEventListener('change', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.triggerOnce = e.target.checked;
      });
    }
    
    // Handle open storyboard editor button
    const openStoryboardBtn = dialog.querySelector('#open-storyboard-btn');
    if (openStoryboardBtn) {
      openStoryboardBtn.addEventListener('click', () => {
        dialog.hide();
        if (window.storyboard) {
          window.storyboard.openEditor();
        }
      });
    }
  }

  setupDefaultEventHandlers(dialog, marker) {
    // Add any default event handlers that should apply to all marker types
  }

    setupDungeonEventHandlers(dialog, marker) {
    // Handle dungeon name input
    const nameInput = dialog.querySelector('#dungeon-name');
    if (nameInput) {
      nameInput.addEventListener('sl-change', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.name = e.target.value;
      });
    }
    
    // Handle difficulty selection
    const difficultySelect = dialog.querySelector('#dungeon-difficulty');
    if (difficultySelect) {
      difficultySelect.addEventListener('sl-change', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.difficulty = e.target.value;
      });
    }
    
    // Handle dungeon ID input
    const dungeonIdInput = dialog.querySelector('#dungeon-id');
    if (dungeonIdInput) {
      dungeonIdInput.addEventListener('sl-change', (e) => {
        if (!marker.data) marker.data = {};
        marker.data.dungeonId = e.target.value;
      });
    }
  }

  // Method to load mini bestiary content 
  async loadMiniBestiary(dialog, marker) {
    const bestiaryGrid = dialog.querySelector('.mini-bestiary-grid');
    const searchInput = dialog.querySelector('#mini-monster-search');
    const loadingIndicator = dialog.querySelector('.loading-indicator');

    if (!bestiaryGrid) return;

    try {
      // Get monsters from resource manager or monster manager
      let monsters = [];
      if (this.resourceManager?.resources?.bestiary) {
        monsters = Array.from(this.resourceManager.resources.bestiary.values());
      } else if (this.monsterManager) {
        // If we only have monster manager, try to get monsters from there
        const database = this.monsterManager.loadDatabase();
        monsters = Object.values(database.monsters || {}).map(monster => ({
          id: monster.basic.name.toLowerCase().replace(/\s+/g, "_"),
          name: monster.basic.name,
          data: monster,
          thumbnail: monster.token?.data || this.generateMonsterThumbnail(monster),
          cr: monster.basic.cr,
          type: monster.basic.type,
          size: monster.basic.size
        }));
      }

      // If we have no monsters, show empty state
      if (monsters.length === 0) {
        bestiaryGrid.innerHTML = `
              <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
                  <span class="material-icons" style="font-size: 32px; opacity: 0.5;">pets</span>
                  <p>No monsters available in bestiary</p>
              </div>`;
        return;
      }

      // Filter and render monsters
      const renderMonsters = (filterText = '') => {
        const filteredMonsters = filterText ?
          monsters.filter(m => m.name.toLowerCase().includes(filterText.toLowerCase())) :
          monsters;

        if (filteredMonsters.length === 0) {
          bestiaryGrid.innerHTML = `
                  <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
                      <span class="material-icons" style="font-size: 24px; opacity: 0.5;">search_off</span>
                      <p>No monsters match your search</p>
                  </div>`;
          return;
        }

        // Sort by name
        filteredMonsters.sort((a, b) => a.name.localeCompare(b.name));

        // Create monster cards
        bestiaryGrid.innerHTML = filteredMonsters.map(monster => {
          const isTokenUrl = monster.data?.token?.url && !monster.data.token.data?.startsWith('data:');
          return `
                <div class="mini-monster-card" data-monster-id="${monster.id}" style="
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                    position: relative;
                    overflow: hidden;">
                    <div style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; 
                         border-radius: 8px; padding: 1px 4px; font-size: 0.7em;">
                        CR ${monster.cr || '?'}
                    </div>
                    ${isTokenUrl ? `
                        <div class="token-warning" style="position: absolute; top: 2px; left: 2px; background: rgba(244, 67, 54, 0.8); color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Token needs update">
                            <span class="material-icons" style="font-size: 10px;">warning</span>
                        </div>
                    ` : ''}
                    <img src="${monster.thumbnail}" style="width: 100%; aspect-ratio: 1; object-fit: cover;">
                    <div style="font-size: 0.8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
                        ${monster.name} ${isTokenUrl ? `<span class="material-icons" style="font-size: 10px; color: #f44336; vertical-align: middle;">warning</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        bestiaryGrid.querySelectorAll('.mini-monster-card').forEach(card => {
          card.addEventListener('click', async () => {
            const monsterId = card.dataset.monsterId;
            const selectedMonster = monsters.find(m => m.id === monsterId);
            if (selectedMonster) {
              // Ensure token is base64
              if (this.resourceManager && typeof this.resourceManager.ensureTokenIsBase64 === 'function') {
                selectedMonster.data = await this.resourceManager.ensureTokenIsBase64(selectedMonster.data);
              }

              // Assign monster to marker
              marker.data.monster = selectedMonster.data;
              this.updateMarkerAppearance(marker);
              dialog.hide();
            }
          });
        });
      };

      // Set up search
      if (searchInput) {
        searchInput.addEventListener('sl-input', (e) => {
          renderMonsters(e.target.value);
        });
      }

      // Render initial state
      loadingIndicator.remove();
      renderMonsters();

    } catch (error) {
      console.error('Error loading mini bestiary:', error);
      bestiaryGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
              <span class="material-icons" style="color: #f44336;">error</span>
              <p>Error loading monsters</p>
          </div>`;
    }
  }

  // Method to show mini bestiary in a standalone dialog
  async showMiniBestiaryDialog(marker) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Choose Monster';

    dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="bestiary-search" style="margin-bottom: 8px;">
              <sl-input placeholder="Search monsters..." size="small" id="dialog-monster-search" clearable></sl-input>
          </div>
          <div class="mini-bestiary-grid" style="
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              max-height: 400px;
              overflow-y: auto;
              padding: 8px;
              background: #f5f5f5;
              border-radius: 4px;">
              <div class="loading-indicator" style="grid-column: 1/-1; text-align: center; padding: 20px;">
                  <sl-spinner></sl-spinner>
                  <div>Loading monsters...</div>
              </div>
          </div>
          
          <div>
              <sl-button id="paste-html-btn" style="width: 100%">
                  <span class="material-icons" slot="prefix">code</span>
                  Paste Monster HTML Instead
              </sl-button>
          </div>
      </div>
      
      <div slot="footer">
          <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
      </div>
  `;

    document.body.appendChild(dialog);
    dialog.show();

    // Set up paste HTML button
    const pasteHtmlBtn = dialog.querySelector('#paste-html-btn');
    if (pasteHtmlBtn) {
      pasteHtmlBtn.addEventListener('click', () => {
        dialog.hide();
        // Show HTML paste dialog
        if (this.resourceManager?.monsterManager) {
          this.resourceManager.monsterManager.showMonsterSelector(marker);
        } else if (this.monsterManager) {
          this.monsterManager.showMonsterSelector(marker);
        }
      });
    }

    // Set up cancel button
    const cancelBtn = dialog.querySelector('.cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        dialog.hide();
      });
    }

    // Load mini bestiary content
    this.loadMiniBestiary(dialog, marker);

    dialog.addEventListener("sl-after-hide", () => {
      dialog.remove();
    });
  }

  // Helper method to generate monster thumbnail if needed
  generateMonsterThumbnail(monster) {
    // Create a canvas for the thumbnail
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Generate color based on monster name
    const hashCode = monster.basic.name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    const hue = Math.abs(hashCode) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fillRect(0, 0, size, size);

    // Add border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);

    // Add initial
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(monster.basic.name.charAt(0).toUpperCase(), size / 2, size / 2);

    return canvas.toDataURL('image/webp');
  }

  finalizeRoom(room) {
    room.finalized = true;
    room.updateEditState(false);

    // Generate new thumbnail after resizing
    room.createThumbnail();

    // Ensure room controls stay interactive
    const controls = room.element.querySelector('.room-controls');
    if (controls) {
      controls.style.pointerEvents = 'auto';
      controls.querySelectorAll('.material-icons').forEach(icon => {
        icon.style.pointerEvents = 'auto';
        icon.style.cursor = 'pointer';
      });
    }

    this.selectedRoomId = null;
    this.layersPanel.updateLayersList();
  }

  showTokenWarningToast() {
    const toast = document.createElement('div');
    toast.className = 'token-warning-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        z-index: 10000;
        max-width: 350px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
    `;

    toast.innerHTML = `
        <span class="material-icons" style="font-size: 24px;">warning</span>
        <div>
            <div style="font-weight: bold; margin-bottom: 4px;">Token Image Issue</div>
            <div>Some monsters use URL-based tokens which may not display in 3D view. Check the Resource Manager to fix affected monsters.</div>
        </div>
        <button class="close-toast" style="background: transparent; border: none; color: white; cursor: pointer; margin-left: 8px;">
            <span class="material-icons">close</span>
        </button>
    `;

    document.body.appendChild(toast);

    // Add close button handler
    toast.querySelector('.close-toast').addEventListener('click', () => {
      toast.remove();
    });

    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
      }
    }, 8000);

    return toast;
  }

// Add this method to the MapEditor class
showPreferencesDialog() {
  const dialog = document.createElement('sl-dialog');
  dialog.label = 'Application Preferences';
  dialog.style.setProperty('--width', '500px');
  
  // Create content for the dialog
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 8px;
  `;
  
  // 1. Graphics Performance Section
  const graphicsSection = document.createElement('div');
  graphicsSection.innerHTML = `
    <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Graphics Performance</h3>
    
    <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px;">
      <div>
        <p style="margin-bottom: 8px;">Detected Quality Level: 
          <span id="qualityLevel" style="font-weight: bold; color: #4CAF50;">Not Tested</span>
        </p>
        
        <sl-button id="detectHardwareBtn" variant="primary">
          <span slot="prefix" class="material-icons">speed</span>
          Run Hardware Test
        </sl-button>
        
        <div id="hardwareTestProgress" style="margin-top: 8px; display: none;">
          <sl-progress-bar indeterminate></sl-progress-bar>
          <div style="text-align: center; margin-top: 4px; font-size: 0.9em; color: #666;">
            Running performance test...
          </div>
        </div>

        <div style="margin-top: 8px; padding: 8px; background: #fff8e1; border-left: 3px solid #FFC107; color: #795548; font-size: 0.9em;">
          <strong>Note:</strong> For best results, run this test in 3D view mode. Changes will be applied when you enter 3D view.
        </div>
      </div>

      <sl-divider></sl-divider>

      <div>
<sl-select id="qualityPreset" label="Quality Preset" value="auto">
  <sl-option value="auto">Automatic (Based on Test)</sl-option>
  <sl-option value="ultra">Ultra</sl-option>
  <sl-option value="high">High</sl-option>
  <sl-option value="medium">Medium</sl-option>
  <sl-option value="low">Low</sl-option>
</sl-select>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <sl-switch id="shadowsEnabled" checked>Shadows</sl-switch>
      <sl-switch id="antialiasEnabled" checked>Anti-Aliasing</sl-switch>
      <sl-switch id="hqTextures" checked>High Quality Textures</sl-switch>
      <sl-switch id="ambientOcclusion">Ambient Occlusion</sl-switch>
    </div>

        <div style="margin-bottom: 16px;">
      <sl-select id="fpsLimit" label="FPS Limit" value="${this.fpsLimit || 0}">
        <sl-option value="0">No Limit</sl-option>
        <sl-option value="60">90 FPS</sl-option>
        <sl-option value="60">60 FPS</sl-option>
        <sl-option value="30">30 FPS</sl-option>
        <sl-option value="15">15 FPS</sl-option>
      </sl-select>
      <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
        Limiting FPS can improve performance on lower-end devices
      </div>
    </div>
  `;
  // In the graphicsSection of showPreferencesDialog method, add this after quality preset
const lightingControls = document.createElement('div');
lightingControls.innerHTML = `
  <sl-divider></sl-divider>
  
  <div style="margin-top: 16px;">
    <h4 style="margin-top: 0; margin-bottom: 8px;">Lighting Options</h4>
    
    <sl-switch id="disableLighting">Disable Advanced Lighting</sl-switch>
    <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
      Use simple lighting for better visibility (but less atmosphere)
    </div>
  </div>
`;
graphicsSection.appendChild(lightingControls);
  
  // 2. Display Settings
  const displaySection = document.createElement('div');
  displaySection.innerHTML = `
    <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Display Settings</h3>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <sl-switch id="showFps">Show FPS Counter</sl-switch>
      <sl-switch id="showStats">Show Stats</sl-switch>
    </div>
    
    <div style="margin-top: 16px;">
      <sl-range id="movementSpeed" min="0.5" max="2" step="0.1" value="1" label="Movement Speed"></sl-range>
      <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #666;">
        <span>Slow</span>
        <span>Default</span>
        <span>Fast</span>
      </div>
    </div>
  `;

  const environmentSection = document.createElement('div');
environmentSection.innerHTML = `
  <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Environment</h3>
  
  <div style="margin-bottom: 16px;">
    <sl-select id="timeOfDay" label="Default Time" value="${this.preferences?.timeOfDay || 12}">
      <sl-option value="0">Midnight (12 AM)</sl-option>
      <sl-option value="6">Dawn (6 AM)</sl-option>
      <sl-option value="9">Morning (9 AM)</sl-option>
      <sl-option value="12">Noon (12 PM)</sl-option>
      <sl-option value="15">Afternoon (3 PM)</sl-option>
      <sl-option value="18">Dusk (6 PM)</sl-option>
      <sl-option value="21">Night (9 PM)</sl-option>
    </sl-select>
  </div>
  
  <div>
    <sl-switch id="autoPlayDayNight" ${this.preferences?.autoPlayDayNight ? 'checked' : ''}>
      Auto-play Day/Night cycle
    </sl-switch>
  </div>
`;


  
  // Add sections to content
  content.appendChild(graphicsSection);
  content.appendChild(displaySection);
  content.appendChild(environmentSection);
  
  // Add content to dialog
  dialog.appendChild(content);
  
  // Footer with save/cancel buttons
  const footer = document.createElement('div');
  footer.slot = 'footer';
  footer.innerHTML = `
    <sl-button id="resetDefaults" variant="text">Reset to Defaults</sl-button>
    <sl-button id="cancelPrefs" variant="neutral">Cancel</sl-button>
    <sl-button id="savePrefs" variant="primary">Save Changes</sl-button>
  `;
  dialog.appendChild(footer);
  
  // Add to document body
  document.body.appendChild(dialog);
  
  // Load current settings
  this.loadPreferencesIntoDialog(dialog);
  
  // Hardware detection button handler
  const detectHardwareBtn = dialog.querySelector('#detectHardwareBtn');
  const hardwareTestProgress = dialog.querySelector('#hardwareTestProgress');
  const qualityLevelSpan = dialog.querySelector('#qualityLevel');
  
  detectHardwareBtn.addEventListener('click', async () => {
    detectHardwareBtn.disabled = true;
    hardwareTestProgress.style.display = 'block';
    qualityLevelSpan.textContent = 'Testing...';
    
    try {
      // Run hardware detection
      const result = await this.runHardwareTest();
      
      // Update UI with result
      qualityLevelSpan.textContent = result.qualityLevel.charAt(0).toUpperCase() + result.qualityLevel.slice(1);
      qualityLevelSpan.style.color = {
        ultra: '#9C27B0', // Use purple for ultra quality
        high: '#4CAF50',
        medium: '#2196F3',
        low: '#FF9800'
      }[result.qualityLevel] || '#4CAF50';
      
      // Update quality preset dropdown
      dialog.querySelector('#qualityPreset').value = 'auto';
    } catch (error) {
      console.error('Hardware test failed:', error);
      qualityLevelSpan.textContent = 'Test Failed';
      qualityLevelSpan.style.color = '#F44336';
    } finally {
      detectHardwareBtn.disabled = false;
      hardwareTestProgress.style.display = 'none';
    }
  });
  
  // Button handlers
  dialog.querySelector('#resetDefaults').addEventListener('click', () => {
    this.resetPreferencesToDefaults(dialog);
  });
  
  dialog.querySelector('#cancelPrefs').addEventListener('click', () => {
    dialog.hide();
  });
  
  dialog.querySelector('#savePrefs').addEventListener('click', () => {
    this.savePreferencesFromDialog(dialog);
    dialog.hide();
    
    // Apply settings
    this.applyPreferences();
  });
  
  // Show dialog
  dialog.show();
}

// Helper method to load current preferences into dialog
loadPreferencesIntoDialog(dialog) {
  // Load preferences from localStorage, with defaults
  const prefs = this.getPreferences();
  
  // Set form values based on preferences
  dialog.querySelector('#qualityPreset').value = prefs.qualityPreset;
  dialog.querySelector('#shadowsEnabled').checked = prefs.shadowsEnabled;
  dialog.querySelector('#antialiasEnabled').checked = prefs.antialiasEnabled;
  dialog.querySelector('#hqTextures').checked = prefs.hqTextures;
  dialog.querySelector('#ambientOcclusion').checked = prefs.ambientOcclusion;
  dialog.querySelector('#disableLighting').checked = prefs.disableLighting || false;
  dialog.querySelector('#showFps').checked = prefs.showFps;
  dialog.querySelector('#showStats').checked = prefs.showStats;
  dialog.querySelector('#movementSpeed').value = prefs.movementSpeed;
  
  // Set quality level display if previously tested
  if (prefs.detectedQuality) {
    const qualityLevelSpan = dialog.querySelector('#qualityLevel');
    qualityLevelSpan.textContent = prefs.detectedQuality.charAt(0).toUpperCase() + prefs.detectedQuality.slice(1);
    qualityLevelSpan.style.color = {
      ultra: '#9C27B0', // Use purple for ultra quality
      high: '#4CAF50',
      medium: '#2196F3',
      low: '#FF9800'
    }[prefs.detectedQuality] || '#4CAF50';
  }
}

// Helper method to save preferences from dialog
savePreferencesFromDialog(dialog) {
  const prefs = {
    qualityPreset: dialog.querySelector('#qualityPreset').value,
    shadowsEnabled: dialog.querySelector('#shadowsEnabled').checked,
    antialiasEnabled: dialog.querySelector('#antialiasEnabled').checked,
    hqTextures: dialog.querySelector('#hqTextures').checked,
    ambientOcclusion: dialog.querySelector('#ambientOcclusion').checked,
    disableLighting: dialog.querySelector('#disableLighting').checked,
    showFps: dialog.querySelector('#showFps').checked,
    showStats: dialog.querySelector('#showStats').checked,
    movementSpeed: parseFloat(dialog.querySelector('#movementSpeed').value),
    fpsLimit: parseInt(dialog.querySelector('#fpsLimit').value),
    detectedQuality: this.preferences?.detectedQuality || null
  };
  
  // Save to localStorage
  localStorage.setItem('appPreferences', JSON.stringify(prefs));
  this.preferences = prefs;
}

// Reset preferences to defaults
resetPreferencesToDefaults(dialog) {
  const defaults = {
    qualityPreset: 'auto',
    shadowsEnabled: true,
    antialiasEnabled: true,
    hqTextures: true,
    ambientOcclusion: false,
    disableLighting: false,
    showFps: false,
    showStats: false,
    movementSpeed: 1.0,
    fpsLimit: 0,  // No limit by default
    detectedQuality: null
  };
  
  // Update form
  dialog.querySelector('#qualityPreset').value = defaults.qualityPreset;
  dialog.querySelector('#shadowsEnabled').checked = defaults.shadowsEnabled;
  dialog.querySelector('#antialiasEnabled').checked = defaults.antialiasEnabled;
  dialog.querySelector('#hqTextures').checked = defaults.hqTextures;
  dialog.querySelector('#ambientOcclusion').checked = defaults.ambientOcclusion;
  dialog.querySelector('#disableLighting').checked = defaults.disableLighting;
  dialog.querySelector('#showFps').checked = defaults.showFps;
  dialog.querySelector('#showStats').checked = defaults.showStats;
  dialog.querySelector('#movementSpeed').value = defaults.movementSpeed;
  dialog.querySelector('#fpsLimit').value = defaults.fpsLimit;
}

// Get current preferences
getPreferences() {
  // Initialize if not already done
  if (!this.preferences) {
    const savedPrefs = localStorage.getItem('appPreferences');
    this.preferences = savedPrefs ? JSON.parse(savedPrefs) : {
      qualityPreset: 'auto',
      shadowsEnabled: true,
      antialiasEnabled: true,
      hqTextures: true,
      ambientOcclusion: false,
      disableLighting: false,
      showFps: false,
      showStats: false,
      movementSpeed: 1.0,
      fpsLimit: 0,  // Default to no FPS limit
      detectedQuality: null
    };
  }
  return this.preferences;
}

// Add to MapEditor class
// applyEditorPreferences(prefs) {
//   if (!prefs) {
//     // Load preferences if not provided
//     try {
//       const savedPrefs = localStorage.getItem('editorPreferences');
//       if (savedPrefs) {
//         prefs = JSON.parse(savedPrefs);
//       } else {
//         return; // No preferences to apply
//       }
//     } catch (e) {
//       console.error('Error loading editor preferences:', e);
//       return;
//     }
//   }
  
//   // Store for access by other methods (for snapToGrid, etc.)
//   this.editorPreferences = prefs;
  
//   // Apply grid settings
//   if (prefs.showGrid !== undefined) {
//     // Update grid visibility
//     this.showGrid = prefs.showGrid;
//     this.render(); // Re-render to show/hide grid
//   }
  
//   if (prefs.gridOpacity !== undefined) {
//     // Update grid opacity
//     this.gridOpacity = prefs.gridOpacity;
//     this.render(); // Re-render to update grid
//   }
  
//   // Setup auto-save if enabled
//   if (prefs.autoSaveInterval > 0) {
//     // Clear any existing auto-save interval
//     if (this._autoSaveInterval) {
//       clearInterval(this._autoSaveInterval);
//     }
    
//     // Set up new auto-save
//     this._autoSaveInterval = setInterval(() => {
//       // Only auto-save if map has been modified
//       if (this.mapModified) {
//         console.log('Auto-saving map...');
//         this.saveMap()
//           .then(() => {
//             console.log('Auto-save complete');
//             // Show a subtle notification
//             this.showToast('Map auto-saved', 'info', 2000);
//           })
//           .catch(err => {
//             console.error('Auto-save failed:', err);
//           });
//       }
//     }, prefs.autoSaveInterval * 1000);
    
//     console.log(`Auto-save enabled at ${prefs.autoSaveInterval} second intervals`);
//   } else if (this._autoSaveInterval) {
//     // Disable auto-save if it was previously enabled
//     clearInterval(this._autoSaveInterval);
//     this._autoSaveInterval = null;
//     console.log('Auto-save disabled');
//   }
  
//   // Update UI based on thumbnail preference
//   if (prefs.showThumbnails !== undefined) {
//     document.querySelectorAll('.room-thumbnail').forEach(thumb => {
//       thumb.style.display = prefs.showThumbnails ? 'block' : 'none';
//     });
//   }
  
//   console.log('Editor preferences applied:', prefs);
// }

applyEditorPreferences(prefs) {
  if (!prefs) {
    // Load preferences if not provided
    try {
      const savedPrefs = localStorage.getItem('editorPreferences');
      if (savedPrefs) {
        prefs = JSON.parse(savedPrefs);
      } else {
        return; // No preferences to apply
      }
    } catch (e) {
      console.error('Error loading editor preferences:', e);
      return;
    }
  }
  
  // Store for access by other methods (for snapToGrid, etc.)
  this.editorPreferences = prefs;
  
  // Apply grid settings
  if (prefs.showGrid !== undefined) {
    // Update grid visibility
    this.showGrid = prefs.showGrid;
    this.render(); // Re-render to show/hide grid
  }
  
  if (prefs.gridOpacity !== undefined) {
    // Update grid opacity
    this.gridOpacity = prefs.gridOpacity;
    this.render(); // Re-render to update grid
  }
  
  // Apply floor background color if set
  if (prefs.floorBackgroundColor && this.scene3D) {
    this.scene3D.setFloorBackgroundColor(prefs.floorBackgroundColor);
  }
  
  // Setup auto-save if enabled
  if (prefs.autoSaveInterval > 0) {
    // Clear any existing auto-save interval
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
    }
    
    // Set up new auto-save
    this._autoSaveInterval = setInterval(() => {
      // Only auto-save if map has been modified
      if (this.mapModified) {
        console.log('Auto-saving map...');
        this.saveMap()
          .then(() => {
            console.log('Auto-save complete');
            // Show a subtle notification
            this.showToast('Map auto-saved', 'info', 2000);
          })
          .catch(err => {
            console.error('Auto-save failed:', err);
          });
      }
    }, prefs.autoSaveInterval * 1000);
    
    console.log(`Auto-save enabled at ${prefs.autoSaveInterval} second intervals`);
  } else if (this._autoSaveInterval) {
    // Disable auto-save if it was previously enabled
    clearInterval(this._autoSaveInterval);
    this._autoSaveInterval = null;
    console.log('Auto-save disabled');
  }
  
  // Update UI based on thumbnail preference
  if (prefs.showThumbnails !== undefined) {
    document.querySelectorAll('.room-thumbnail').forEach(thumb => {
      thumb.style.display = prefs.showThumbnails ? 'block' : 'none';
    });
  }
  
  console.log('Editor preferences applied:', prefs);
}


// Modify the applyPreferences method
applyPreferences() {
  const prefs = this.getPreferences();
  
  // Check if we have an active Scene3D instance
  if (this.scene3D) {
    // Apply quality level through Scene3DController
    const qualityLevel = prefs.qualityPreset === 'auto' ? 
      prefs.detectedQuality || 'medium' : prefs.qualityPreset;
    
    this.scene3D.setQualityLevel(qualityLevel, {
      shadows: prefs.shadowsEnabled,
      antialias: prefs.antialiasEnabled, 
      highQualityTextures: prefs.hqTextures,
      ambientOcclusion: prefs.ambientOcclusion
    });
    
    // Apply lighting toggle
    this.scene3D.setLightingEnabled(!prefs.disableLighting);
    
    // Apply FPS counter visibility
    if (prefs.showFps && !this.scene3D.showStats) {
      this.scene3D.toggleStats();
    } else if (!prefs.showFps && this.scene3D.showStats) {
      this.scene3D.toggleStats();
    }
    
    // Apply FPS limit
    this.scene3D.setFPSLimit(prefs.fpsLimit);
    
    // Apply movement speed
    if (this.scene3D.moveState) {
      this.scene3D.moveState.baseSpeed = 0.025 * (prefs.movementSpeed || 1.0);
      this.scene3D.moveState.speed = this.scene3D.moveState.sprint ? 
        this.scene3D.moveState.baseSpeed * 2 : this.scene3D.moveState.baseSpeed;
    }
    
    // Apply day/night cycle settings if applicable
    if (this.scene3D.dayNightCycle && prefs.timeOfDay !== undefined) {
      this.scene3D.dayNightCycle.setTime(prefs.timeOfDay);
      if (prefs.autoPlayDayNight) {
        this.scene3D.dayNightCycle.start();
      } else {
        this.scene3D.dayNightCycle.pause();
      }
    }
  }
}


async runHardwareTest() {
  return new Promise((resolve, reject) => {
    // If no 3D view exists yet, create a temporary one for testing
    if (!this.scene3D || !this.scene3D.renderer) {
      try {
        // Create dialog to test in
        const testContainer = document.createElement('div');
        testContainer.style.cssText = `
          position: fixed;
          top: -9999px;
          left: -9999px;
          width: 512px;
          height: 512px;
          opacity: 0;
          pointer-events: none;
        `;
        document.body.appendChild(testContainer);
        
        // Create temporary scene
        const testScene3D = new Scene3DController();
        testScene3D.initialize(testContainer, 512, 512);
        
        // Run test with a callback to handle results
        testScene3D.detectHardwareCapabilities((result) => {
          // Clean up
          testContainer.remove();
          testScene3D.cleanup();
          
          // Store result
          this.preferences.detectedQuality = result.qualityLevel;
          localStorage.setItem('appPreferences', JSON.stringify(this.preferences));
          
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    } else {
      // Use existing 3D view
      try {
        // Run test with a callback to handle results
        this.scene3D.detectHardwareCapabilities((result) => {
          // Store result
          this.preferences.detectedQuality = result.qualityLevel;
          localStorage.setItem('appPreferences', JSON.stringify(this.preferences));
          
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    }
  });
}



// Add this method to MapEditor class
createWaterArea() {
  if (!this.baseImage) {
    this.showCustomToast("Please load a map first", "warning", 3000);
    return;
  }

  let roomSize;
  if (this.cellSize) {
    roomSize = this.cellSize * 2; // Default to 2x2 grid cells
  } else {
    roomSize = 100;
  }

  const room = new Room(
    Date.now(),
    {
      x: this.canvas.width / 2 - roomSize / 2,
      y: this.canvas.height / 2 - roomSize / 2,
      width: roomSize,
      height: roomSize
    },
    "Water Area",
    "rectangle", // Use rectangle shape for simplicity
    "water" // New room type
  );

  this.rooms.push(room);
  const roomElement = room.createDOMElement(this);
  document.querySelector(".canvas-container").appendChild(roomElement);
  
  // Style the water area differently
  roomElement.style.backgroundColor = "rgba(0, 100, 255, 0.3)";
  roomElement.style.border = "1px solid rgba(0, 150, 255, 0.7)";
  
  // Mark it for special handling in Scene3D
  room.isWaterArea = true;
  
  this.layersPanel.updateLayersList();
  
  // Set as selected for immediate editing
  this.selectedRoomId = room.id;
  room.updateEditState(true);
}





}

// Add this to the bottom of your MapEditor.js file

// Debug helper to show current tool state
// You can toggle this with a keyboard shortcut
MapEditor.prototype.toggleDebugInfo = function() {
  // Remove existing debug overlay if it exists
  let debugOverlay = document.getElementById('map-editor-debug');
  if (debugOverlay) {
    debugOverlay.remove();
    return;
  }
  
  // Create debug overlay
  debugOverlay = document.createElement('div');
  debugOverlay.id = 'map-editor-debug';
  debugOverlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    max-width: 300px;
    pointer-events: auto;
  `;
  
  // Update function to refresh debug info
  const updateDebugInfo = () => {
    debugOverlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">MapEditor Debug</div>
      <div>Current Tool: <span style="color: #4CAF50;">${this.currentTool || 'none'}</span></div>
      <div>Selection: <span style="color: #2196F3;">${this.selectedRoomId || 'none'}</span></div>
      <div>Marker Edit Mode: <span style="color: ${this.isMarkerEditMode ? '#4CAF50' : '#F44336'};">${this.isMarkerEditMode}</span></div>
      <div>Teleport Pending: <span style="color: ${this.pendingTeleportPair ? '#FFC107' : '#ccc'};">${this.pendingTeleportPair ? 'Yes' : 'No'}</span></div>
      <div>Markers: ${this.markers.length}</div>
      <div>Rooms: ${this.rooms.length}</div>
      <div style="margin-top: 5px; font-size: 10px;">Press Alt + X again to close</div>
    `;
  };
  
  // Add to document and set up interval
  document.body.appendChild(debugOverlay);
  updateDebugInfo();
  debugOverlay.updateInterval = setInterval(updateDebugInfo, 500);
  
  // Add keyboard shortcut
  document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'd' && e.altKey) {
      const editor = window.mapEditor; // Assuming your editor instance is accessible
      if (editor) {
        editor.toggleDebugInfo();
      }
    }
  });
};

// Add a keyboard shortcut to toggle the debug overlay
document.addEventListener('keydown', function(e) {
  if (e.key.toLowerCase() === 'x' && e.altKey) {
    const editor = window.mapEditor; // You might need to adjust this to access your editor instance
    if (editor) {
      editor.toggleDebugInfo();
    }
  }
});

// Add this to the end of your MapEditor.js file

// Click visualizer for debugging
MapEditor.prototype.enableClickVisualizer = function() {
  const wrapper = document.getElementById("canvasWrapper");
  
  // Add click visualizer elements
  const clickInfo = document.createElement('div');
  clickInfo.id = 'click-info';
  clickInfo.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(clickInfo);
  
  // Function to show click information
  const visualizeClick = (e) => {
    // Create a visual marker at click position
    const marker = document.createElement('div');
    marker.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      background: rgba(255, 0, 0, 0.5);
      border: 2px solid red;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 9999;
    `;
    marker.style.left = `${e.clientX}px`;
    marker.style.top = `${e.clientY}px`;
    document.body.appendChild(marker);
    
    // Fade out and remove after 1 second
    setTimeout(() => {
      marker.style.transition = 'opacity 0.5s ease';
      marker.style.opacity = '0';
      setTimeout(() => marker.remove(), 500);
    }, 1000);
    
    // Show click info
    let targetInfo = '';
    for (let el = e.target; el && el !== document.body; el = el.parentElement) {
      targetInfo += `<div>${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${
        Array.from(el.classList).map(c => '.'+c).join('')
      }</div>`;
      if (targetInfo.split('<div>').length > 5) break; // Limit to 5 levels
    }
    
    clickInfo.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">Click Detected</div>
      <div>Tool: ${this.currentTool || 'none'}</div>
      <div>Target:</div>
      ${targetInfo}
    `;
    
    // Clear info after 3 seconds
    setTimeout(() => {
      clickInfo.innerHTML = '';
    }, 3000);
  };
  
  // Add a capturing event listener to see all clicks
  document.addEventListener('click', visualizeClick, true);
  
  // Show info that visualizer is enabled
  const notice = document.createElement('div');
  notice.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px;
    border-radius: 4px;
    z-index: 9999;
  `;
  notice.textContent = 'Click Visualizer Enabled';
  document.body.appendChild(notice);
  setTimeout(() => {
    notice.style.transition = 'opacity 0.5s ease';
    notice.style.opacity = '0';
    setTimeout(() => notice.remove(), 500);
  }, 2000);
  
  return () => {
    // Return a function to disable the visualizer
    document.removeEventListener('click', visualizeClick, true);
    clickInfo.remove();
  };
};

// Add a keyboard shortcut to toggle the click visualizer
// Press Alt+V to enable/disable
let clickVisualizerDisable = null;

document.addEventListener('keydown', function(e) {
  if (e.key.toLowerCase() === 'c' && e.altKey) {
    const editor = window.mapEditor; // Adjust if your editor instance is named differently
    if (editor) {
      if (clickVisualizerDisable) {
        clickVisualizerDisable();
        clickVisualizerDisable = null;
        
        // Show disabled message
        const notice = document.createElement('div');
        notice.style.cssText = `
          position: fixed;
          top: 10px;
          left: 10px;
          background: #F44336;
          color: white;
          padding: 8px;
          border-radius: 4px;
          z-index: 9999;
        `;
        notice.textContent = 'Click Visualizer Disabled';
        document.body.appendChild(notice);
        setTimeout(() => {
          notice.style.transition = 'opacity 0.5s ease';
          notice.style.opacity = '0';
          setTimeout(() => notice.remove(), 500);
        }, 2000);
      } else {
        clickVisualizerDisable = editor.enableClickVisualizer();
      }
    }
  }
});