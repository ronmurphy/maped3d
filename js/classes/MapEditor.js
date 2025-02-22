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

    // Initialize managers in correct order
    this.resourceManager = null;  // Initialize to null first
    this.textureManager = null;   // Initialize to null first

    // Setup in correct order
    this.setupTitleHandlers();
    this.updateMapTitle();
    this.checkResourceManager(() => {
      console.log('ResourceManager initialized:', !!this.resourceManager);
      this.checkTextureManager(() => {
        console.log('TextureManager initialized:', !!this.textureManager);
        this.setupEventListeners();
      });
    });

    this.setupCanvas();
    this.calculateLayersListHeight = this.calculateLayersListHeight.bind(this);
    this.setupLayersObserver();
    setTimeout(() => this.calculateLayersListHeight(), 100);
    window.addEventListener("resize", this.calculateLayersListHeight);

    this.fixZoomIssues();
  }

  checkResourceManager(callback) {
    const resourceManagerBtn = document.getElementById('resourceManagerBtn');
  
    // Create a temporary script element to test loading
    const script = document.createElement('script');
    script.src = 'js/classes/resource-manager.js';
    script.onload = () => {
      // Resource manager loaded successfully
      this.resourceManager = new ResourceManager();
      
      // Initialize MonsterManager in ResourceManager
      this.resourceManager.initializeMonsterManager(this);
      
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

    const gridPosition = Math.round(value / gridSize) * gridSize;
    const offset = value - gridPosition;

    // Only snap if within threshold (25% of grid size by default)
    if (Math.abs(offset) < gridSize * snapThreshold) {
      return gridPosition;
    }

    return value;
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
      rooms: this.rooms.map((room) => {
        return {
          id: room.id,
          name: room.name,
          shape: room.shape,
          bounds: { ...room.bounds },
          points: room.points ? [...room.points] : null,
          isRaisedBlock: room.isRaisedBlock || false,
          blockHeight: room.blockHeight || 0,
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

    // Restore rooms
    for (const roomData of saveData.rooms) {
      const room = Room.createFromSaved(roomData, this);
      // Restore raised block properties
      room.isRaisedBlock = roomData.isRaisedBlock || false;
      room.blockHeight = roomData.blockHeight || 0;

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

      // Update appearance for special marker types
      if (marker) {
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
    // this.markers.forEach(marker => {
    //   this.updateMarkerPosition(marker);
    // });
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
  }, 2000);

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
        alert('No recent projects found');
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
      alert('Could not load recent projects');
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
      // openMapBtn.addEventListener("click", () => {
      //   const dialog = document.createElement("sl-dialog");
      //   dialog.label = "Open Map";

      //   dialog.innerHTML = `
      //       <div style="display: flex; flex-direction: column; gap: 16px;">
      //           <sl-button size="large" class="new-map-btn" style="justify-content: flex-start;">
      //               <span slot="prefix" class="material-icons">add_circle</span>
      //               New Map
      //               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
      //                   Start fresh with a new map (clears everything)
      //               </div>
      //           </sl-button>

      //           <sl-button size="large" class="change-picture-btn" style="justify-content: flex-start;">
      //               <span slot="prefix" class="material-icons">image</span>
      //               Change Background
      //               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
      //                   Change map background while keeping rooms and markers
      //               </div>
      //           </sl-button>

      //           <sl-button size="large" class="load-project-btn" style="justify-content: flex-start;">
      //               <span slot="prefix" class="material-icons">folder_open</span>
      //               Load Project
      //               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
      //                   Open a previously saved map project
      //               </div>
      //           </sl-button>
      //       </div>
      //   `;

      //   // Create hidden file inputs
      //   const pictureInput = document.createElement("input");
      //   pictureInput.type = "file";
      //   pictureInput.accept = "image/*";
      //   pictureInput.style.display = "none";

      //   const jsonInput = document.createElement("input");
      //   jsonInput.type = "file";
      //   jsonInput.accept = ".json";
      //   jsonInput.style.display = "none";

      //   document.body.appendChild(pictureInput);
      //   document.body.appendChild(jsonInput);

      //   // Handle picture file selection

      //   pictureInput.addEventListener('change', async e => {
      //     const file = e.target.files[0];
      //     if (file) {
      //       // Parse filename first
      //       const parseResult = this.parseMapFilename(file.name);


      //       // If we couldn't get a map name or user wants to change it, show dialog
      //       let mapName = parseResult.mapName;


      //       if (!mapName || !parseResult.success) {
      //         // Show name dialog as fallback
      //         const nameConfirmed = await this.showMapNameDialog();
      //         if (!nameConfirmed) {
      //           return; // User cancelled
      //         }
      //       } else {
      //         // Found a name, but let's confirm with the user
      //         const dialog = document.createElement('sl-dialog');
      //         dialog.label = 'Map Name';
      //         dialog.innerHTML = `
      //   <div style="display: flex; flex-direction: column; gap: 16px;">
      //     <sl-input
      //       id="mapNameInput"
      //       label="Map Name"
      //       value="${mapName}"
      //       help-text="Parsed from filename. You can modify if needed."
      //     ></sl-input>
      //     ${parseResult.gridDimensions ? `
      //       <div style="color: #666;">
      //         Grid Size: ${parseResult.gridDimensions.width}x${parseResult.gridDimensions.height}
      //       </div>
      //     ` : ''}
      //   </div>
      //   <div slot="footer">
      //     <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
      //     <sl-button variant="primary" class="save-btn">Continue</sl-button>
      //   </div>
      // `;

      //         document.body.appendChild(dialog);

      //         // Return a promise that resolves when the dialog is handled
      //         await new Promise((resolve) => {
      //           const mapNameInput = dialog.querySelector('#mapNameInput');
      //           const saveBtn = dialog.querySelector('.save-btn');
      //           const cancelBtn = dialog.querySelector('.cancel-btn');

      //           saveBtn.addEventListener('click', () => {
      //             mapName = mapNameInput.value.trim();
      //             this.mapName = mapName;
      //             this.originalMapName = mapName;
      //             dialog.hide();
      //             resolve(true);
      //           });

      //           cancelBtn.addEventListener('click', () => {
      //             dialog.hide();
      //             resolve(false);
      //           });

      //           dialog.addEventListener('sl-after-hide', () => {
      //             dialog.remove();
      //           });

      //           dialog.show();
      //         });
      //       }

      //       // Set grid dimensions if found
      //       if (parseResult.gridDimensions) {
      //         this.gridDimensions = parseResult.gridDimensions;
      //       }
      //       // Show loading notification
      //       const toast = document.createElement("div");
      //       toast.style.position = "fixed";
      //       toast.style.bottom = "20px";
      //       toast.style.right = "20px";
      //       toast.style.zIndex = "1000";
      //       toast.style.backgroundColor = "#333";
      //       toast.style.color = "white";
      //       toast.style.padding = "10px 20px";
      //       toast.style.borderRadius = "4px";
      //       toast.style.display = "flex";
      //       toast.style.alignItems = "center";
      //       toast.style.gap = "10px";
      //       toast.innerHTML = `
      //               <span class="material-icons">hourglass_top</span>
      //               <span>Loading ${file.name}...</span>
      //           `;
      //       document.body.appendChild(toast);

      //       try {
      //         // Parse grid dimensions from filename
      //         const mapDimensions = parseMapDimensions(file.name);
      //         if (mapDimensions) {
      //           this.gridDimensions = mapDimensions;
      //         }

      //         const reader = new FileReader();
      //         await new Promise((resolve, reject) => {
      //           reader.onload = (event) => {
      //             const img = new Image();
      //             img.onload = () => {
      //               this.baseImage = img;

      //               // Calculate DPI if possible
      //               if (this.gridDimensions) {
      //                 const cellWidth =
      //                   img.width / this.gridDimensions.width;
      //                 const cellHeight =
      //                   img.height / this.gridDimensions.height;
      //                 this.cellSize = Math.min(cellWidth, cellHeight);
      //                 // console.log(
      //                 //   `Calculated cell size: ${this.cellSize}px`
      //                 // );
      //               }

      //               // Store the natural dimensions
      //               this.naturalWidth = img.naturalWidth;
      //               this.naturalHeight = img.naturalHeight;

      //               this.centerMap();
      //               this.render();
      //               resolve();
      //             };
      //             img.onerror = reject;
      //             img.src = event.target.result;
      //           };
      //           reader.onerror = reject;
      //           reader.readAsDataURL(file);
      //         });

      //         // Success notification
      //         toast.style.backgroundColor = "#4CAF50";
      //         toast.innerHTML = `
      //                   <span class="material-icons">check_circle</span>
      //                   <span>Map loaded successfully!</span>
      //               `;
      //         setTimeout(() => toast.remove(), 2000);
      //       } catch (error) {
      //         console.error("Error loading map:", error);
      //         // Error notification
      //         toast.style.backgroundColor = "#f44336";
      //         toast.innerHTML = `
      //                   <span class="material-icons">error</span>
      //                   <span>Error loading map!</span>
      //               `;
      //         setTimeout(() => toast.remove(), 2000);
      //       }
      //       dialog.hide();
      //     }
      //   });

      //   // Handle JSON file selection
      //   jsonInput.addEventListener("change", async (e) => {
      //     const file = e.target.files[0];
      //     if (file) {
      //       await this.loadMap(file);
      //       dialog.hide();
      //     }
      //   });

      //   // Add button click handlers
      //   dialog
      //     .querySelector(".new-map-btn")
      //     .addEventListener("click", () => {
      //       pictureInput.click();
      //       this.clearMap(); // Clear everything before loading new picture
      //       dialog.hide();
      //     });

      //   // Change Picture button handler
      //   dialog
      //     .querySelector(".change-picture-btn")
      //     .addEventListener("click", () => {
      //       pictureInput.click();
      //       dialog.hide();
      //     });

      //   // Load Project button handler
      //   dialog
      //     .querySelector(".load-project-btn")
      //     .addEventListener("click", () => {
      //       jsonInput.click();
      //       dialog.hide();
      //     });

      //   // Clean up on close
      //   dialog.addEventListener("sl-after-hide", () => {
      //     dialog.remove();
      //     pictureInput.remove();
      //     jsonInput.remove();
      //   });

      //   // Show the dialog
      //   document.body.appendChild(dialog);
      //   dialog.show();
      // });
    
    // Update the setupEventListeners method in MapEditor.js
// Modify the openMapBtn click handler:

// openMapBtn.addEventListener("click", () => {
//   const dialog = document.createElement("sl-dialog");
//   dialog.label = "Open Map or Project";

//   dialog.innerHTML = `
//       <div style="display: flex; flex-direction: column; gap: 16px;">
//           <sl-button size="large" class="new-map-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">add_circle</span>
//               New Map
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Start fresh with a new map (clears everything)
//               </div>
//           </sl-button>

//           <sl-button size="large" class="change-picture-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">image</span>
//               Change Background
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Change map background while keeping rooms and markers
//               </div>
//           </sl-button>
          
//           <sl-divider></sl-divider>
          
//           <!-- Add Recent Projects button -->
//           <sl-button size="large" class="recent-projects-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">history</span>
//               Recent Projects
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Open a recently saved project
//               </div>
//           </sl-button>

//           <sl-button size="large" class="load-project-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">folder_open</span>
//               Open Project File
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Open a complete project with resources and map
//               </div>
//           </sl-button>

//           <sl-button size="large" class="load-map-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">map</span>
//               Open Map File
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Open only a map file (.map.json)
//               </div>
//           </sl-button>
          
//           <sl-button size="large" class="load-resource-btn" style="justify-content: flex-start;">
//               <span slot="prefix" class="material-icons">texture</span>
//               Open Resource Pack
//               <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//                   Open only a resource pack (.resource.json)
//               </div>
//           </sl-button>
//       </div>
//   `;

//   // Create hidden file inputs
//   const pictureInput = document.createElement("input");
//   pictureInput.type = "file";
//   pictureInput.accept = "image/*";
//   pictureInput.style.display = "none";

//   const projectInput = document.createElement("input");
//   projectInput.type = "file";
//   projectInput.accept = ".project.json";
//   projectInput.style.display = "none";

//   const mapInput = document.createElement("input");
//   mapInput.type = "file";
//   mapInput.accept = ".map.json,.json";
//   mapInput.style.display = "none";
  
//   const resourceInput = document.createElement("input");
//   resourceInput.type = "file";
//   resourceInput.accept = ".resource.json,.json";
//   resourceInput.style.display = "none";

//   document.body.appendChild(pictureInput);
//   document.body.appendChild(projectInput);
//   document.body.appendChild(mapInput);
//   document.body.appendChild(resourceInput);

//   // Add handler for recent projects button
//   dialog.querySelector('.recent-projects-btn').addEventListener('click', () => {
//     dialog.hide();
//     this.showRecentProjectsDialog();
//   });

//   // Handle picture file selection
//   pictureInput.addEventListener('change', async e => {
//     const file = e.target.files[0];
//     if (file) {
//       // Existing picture handling code...
//       dialog.hide();
//     }
//   });

//   // Handle project file selection
//   projectInput.addEventListener("change", async (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       await this.loadProjectFile(file);
//       dialog.hide();
//     }
//   });

//   // Handle map file selection
//   mapInput.addEventListener("change", async (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       await this.loadMap(file);
//       dialog.hide();
//     }
//   });
  
//   // Handle resource file selection
//   resourceInput.addEventListener("change", async (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       if (this.resourceManager) {
//         const success = await this.resourceManager.loadResourcePack(file);
//         if (success) {
//           alert("Resource pack loaded successfully");
//         } else {
//           alert("Failed to load resource pack");
//         }
//       }
//       dialog.hide();
//     }
//   });

//   // Button click handlers
//   dialog.querySelector(".new-map-btn").addEventListener("click", () => {
//     pictureInput.click();
//     this.clearMap();
//     dialog.hide();
//   });

//   dialog.querySelector(".change-picture-btn").addEventListener("click", () => {
//     pictureInput.click();
//     dialog.hide();
//   });

//   dialog.querySelector(".load-project-btn").addEventListener("click", () => {
//     projectInput.click();
//   });
  
//   dialog.querySelector(".load-map-btn").addEventListener("click", () => {
//     mapInput.click();
//   });
  
//   dialog.querySelector(".load-resource-btn").addEventListener("click", () => {
//     resourceInput.click();
//   });

//   // Clean up on close
//   dialog.addEventListener("sl-after-hide", () => {
//     dialog.remove();
//     pictureInput.remove();
//     projectInput.remove();
//     mapInput.remove();
//     resourceInput.remove();
//   });

//   // Show the dialog
//   document.body.appendChild(dialog);
//   dialog.show();
// });

// Also update the saveProjectBtn click handler or add a new one


// The issue is likely in the openMapBtn click handler where the "New Map" button 
// creates the file input and handles the file selection

// Here's the fixed version of the relevant code in the openMapBtn click handler:

openMapBtn.addEventListener("click", () => {
  const dialog = document.createElement("sl-dialog");
  dialog.label = "Open Map or Project";

  dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <sl-button size="large" class="new-map-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">add_circle</span>
              New Map
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Start fresh with a new map (clears everything)
              </div>
          </sl-button>

          <sl-button size="large" class="change-picture-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">image</span>
              Change Background
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Change map background while keeping rooms and markers
              </div>
          </sl-button>
          
          <sl-divider></sl-divider>
          
          <!-- Add Recent Projects button -->
          <sl-button size="large" class="recent-projects-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">history</span>
              Recent Projects
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Open a recently saved project
              </div>
          </sl-button>

          <sl-button size="large" class="load-project-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">folder_open</span>
              Open Project File
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Open a complete project with resources and map
              </div>
          </sl-button>

          <sl-button size="large" class="load-map-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">map</span>
              Open Map File
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Open only a map file (.map.json)
              </div>
          </sl-button>
          
          <sl-button size="large" class="load-resource-btn" style="justify-content: flex-start;">
              <span slot="prefix" class="material-icons">texture</span>
              Open Resource Pack
              <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                  Open only a resource pack (.resource.json)
              </div>
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
          alert("Resource pack loaded successfully");
        } else {
          alert("Failed to load resource pack");
        }
      }
      dialog.hide();
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

// const saveProjectBtn = document.getElementById("saveProjectBtn");
// if (saveProjectBtn) {
//   saveProjectBtn.addEventListener("click", () => {
//     const dialog = document.createElement("sl-dialog");
//     dialog.label = "Save Options";
//     dialog.innerHTML = `
//       <div style="display: flex; flex-direction: column; gap: 16px;">
//         <sl-button size="large" class="save-map-btn" style="justify-content: flex-start;">
//           <span slot="prefix" class="material-icons">map</span>
//           Save Map Only
//           <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//             Save only the map file (.map.json)
//           </div>
//         </sl-button>
        
//         <sl-button size="large" class="save-project-btn" style="justify-content: flex-start;">
//           <span slot="prefix" class="material-icons">folder</span>
//           Save Complete Project
//           <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
//             Save map, resources, and project file
//           </div>
//         </sl-button>
//       </div>
//     `;
    
//     dialog.querySelector(".save-map-btn").addEventListener("click", async () => {
//       await this.saveMap();
//       dialog.hide();
//     });
    
//     dialog.querySelector(".save-project-btn").addEventListener("click", async () => {
//       await this.saveProjectFile();
//       dialog.hide();
//     });
    
//     dialog.addEventListener("sl-after-hide", () => {
//       dialog.remove();
//     });
    
//     document.body.appendChild(dialog);
//     dialog.show();
//   });
// }
    

//  fixed version:

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
      button.addEventListener("click", () => {
        switch (button.id) {
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

    // Marker tool type mapping
    const markerTools = {
      playerStartTool: "player-start",
      encounterTool: "encounter",
      treasureTool: "treasure",
      trapTool: "trap",
      teleportTool: "teleport",
      doorTool: "door",
      propTool: "prop"
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
        alert('Screenshot library not loaded. Please add html2canvas to your project.');
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
      alert('3D view not initialized or renderer not available');
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
      alert('Error saving screenshot: ' + err.message);
    }
  }

  setTool(tool) {
    if (this.currentTool === "wall") {
      this.cleanupWallTool();
    }
    this.currentTool = tool;
    this.updateWallClickBehavior();

    // Update UI
    const toolButtons = document.querySelectorAll(".tool-button");
    toolButtons.forEach((button) => {
      button.classList.remove("active");
      if (
        (tool === "rectangle" && button.id === "selectTool") ||
        (tool === "circle" && button.id === "circleTool") ||
        (tool === "wall" && button.id === "wallTool") ||
        (tool === "pan" && button.id === "panTool")
      ) {
        button.classList.add("active");
      }
    });

    if (tool === "wall") {
      this.startWallCreation();
    }

    // Update cursor style
    const wrapper = document.getElementById("canvasWrapper");
    if (tool === "pan") {
      wrapper.style.cursor = "grab";
    } else if (["rectangle", "circle", "wall"].includes(tool)) {
      wrapper.style.cursor = "crosshair";
    } else {
      wrapper.style.cursor = "default";
    }

    // Update room pointer events
    const rooms = document.querySelectorAll(".room-block");
    rooms.forEach((room) => {
      room.style.pointerEvents = tool.startsWith("marker-")
        ? "none"
        : "auto";
      room
        .querySelectorAll(".room-controls, .resize-handle")
        .forEach((element) => {
          element.style.pointerEvents = "auto";
        });
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
      alert("Please load a map first");
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

  createDoor(roomOrWall) {
    const door = {
      id: Date.now(),
      parentId: roomOrWall.id,
      width: this.cellSize, // Default 1 grid cell
      height: this.cellSize * 2, // Default door height
      position: { x: 0, y: 0 }, // Will be set when placing
      isOpen: false,
      rotation: 0 // 0 or 90 degrees
    };

    // Add visual representation
    const doorElement = document.createElement('div');
    doorElement.className = 'door';
    doorElement.innerHTML = `
    <div class="door-frame"></div>
    <div class="door-panel"></div>
  `;

    // Add to room/wall
    roomOrWall.doors = roomOrWall.doors || [];
    roomOrWall.doors.push(door);

    return door;
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

  startCircleRoom() {
    if (!this.baseImage) {
      alert("Please load a map first");
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
      alert("Please load a map first");
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
      alert("Please load a map first");
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
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.1, this.scale + delta), 4);

    // Get mouse position relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the position under the mouse in image coordinates
    const imageX = (mouseX - this.offset.x) / this.scale;
    const imageY = (mouseY - this.offset.y) / this.scale;

    // Update the scale
    this.scale = newScale;

    // Calculate new offset to keep the same image position under the mouse
    this.offset.x = mouseX - imageX * this.scale;
    this.offset.y = mouseY - imageY * this.scale;

    // Update all room positions when zooming
    this.rooms.forEach((room) => room.updateElement());

    // Update all markers
    this.markers.forEach((marker) => {
      this.updateMarkerPosition(marker);
      if (marker.type === "encounter" && marker.data.monster) {
        // Additional zoom handling for encounter markers
        const token = marker.element.querySelector(".monster-token");
        if (token) {
          token.style.transform = `scale(${this.scale})`;
          token.style.transformOrigin = "center";
        }
      }

      const propToken = marker.element.querySelector(".prop-visual");
      if (propToken) {
        propToken.style.transform = `scale(${this.scale})`;
        propToken.style.transformOrigin = "center";
      }
    });

    // Update player start marker if it exists
    if (this.playerStart) {
      this.updateMarkerPosition(this.playerStart);
    }

    // In handleWheel method, after updating markers
    this.markers.forEach(marker => {
      if (marker.type === 'teleport' && marker.data.isPointA && marker.data.pairedMarker) {
        this.updateTeleportConnection(marker, marker.data.pairedMarker);
      }
    });

    this.render();
  }

  fixMarkerScaling() {
    console.log("Applying marker scaling fix");
    
    // Fix encounter markers
    document.querySelectorAll('.marker-encounter .monster-token').forEach(token => {
      // Extract current transform to check for rotation
      const currentTransform = token.style.transform || '';
      
      // Remove any scaling transforms
      if (currentTransform.includes('scale')) {
        // If there's rotation, preserve it
        const rotateMatch = currentTransform.match(/rotate\([^)]+\)/);
        const rotation = rotateMatch ? rotateMatch[0] : '';
        
        // Apply only rotation, no scaling
        token.style.transform = rotation;
      }
    });
    
    // Fix prop markers
    document.querySelectorAll('.marker-prop .prop-visual').forEach(prop => {
      // Extract current transform to check for rotation
      const currentTransform = prop.style.transform || '';
      
      // Remove any scaling transforms
      if (currentTransform.includes('scale')) {
        // If there's rotation, preserve it
        const rotateMatch = currentTransform.match(/rotate\([^)]+\)/);
        const rotation = rotateMatch ? rotateMatch[0] : '';
        
        // Apply only rotation, no scaling
        prop.style.transform = rotation;
      }
    });
    
    console.log("Marker scaling fix applied");
  }







  fixZoomIssues() {
    console.log("Fixing zoom issues for overlapping elements");
    
    // 1. Make the canvas wrapper capture all wheel events in its area
    const wrapper = document.getElementById("canvasWrapper");
    
    // Use a capturing event listener that runs before regular listeners
    wrapper.addEventListener("wheel", (e) => {
      // Only handle wheel events if we're in the canvas area
      const rect = wrapper.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && 
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        
        // Stop propagation to prevent other elements from handling it
        e.stopPropagation();
        
        // Call our zoom handler
        this.handleWheel(e);
      }
    }, {capture: true}); // The capture: true is critical - it runs before other handlers
    
    // 2. Fix any existing room elements
    const fixRoomElements = () => {
      document.querySelectorAll('.room-block').forEach(element => {
        // Disable pointer events on wheel to let it reach the wrapper
        element.addEventListener('wheel', (e) => {
          e.stopPropagation();
          // Forward the event to the wrapper
          const newEvent = new WheelEvent('wheel', e);
          wrapper.dispatchEvent(newEvent);
        });
      });
    };
    
    // 3. Fix any existing marker elements
    const fixMarkerElements = () => {
      document.querySelectorAll('.map-marker').forEach(element => {
        // Disable pointer events on wheel to let it reach the wrapper
        element.addEventListener('wheel', (e) => {
          e.stopPropagation();
          // Forward the event to the wrapper
          const newEvent = new WheelEvent('wheel', e);
          wrapper.dispatchEvent(newEvent);
        });
      });
    };
    
    // Run immediately
    fixRoomElements();
    fixMarkerElements();
    
    // Create a mutation observer to fix new elements as they're added
    const observer = new MutationObserver((mutations) => {
      let needsFix = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.classList) {
              if (node.classList.contains('room-block') || 
                  node.classList.contains('map-marker')) {
                needsFix = true;
              }
            }
          });
        }
      });
      
      if (needsFix) {
        fixRoomElements();
        fixMarkerElements();
      }
    });
    
    // Observe the canvas container for new elements
    observer.observe(document.querySelector('.canvas-container'), {
      childList: true,
      subtree: true
    });
    
    console.log("Zoom fix applied");
    this.centerMap();
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

  // updateMarkerPositions() {
  //   this.markers.forEach((marker) => {
  //     if (marker.element) {
  //       // Update position
  //       marker.element.style.left = `${marker.x * this.scale + this.offset.x
  //         }px`;
  //       marker.element.style.top = `${marker.y * this.scale + this.offset.y
  //         }px`;

  //       // Update zoom scale
  //       this.updateMarkerZoom(marker);

  //       // Handle teleport connections if present
  //       if (
  //         marker.type === "teleport" &&
  //         marker.data.isPointA &&
  //         marker.data.pairedMarker &&
  //         marker.connection
  //       ) {
  //         this.updateTeleportConnection(marker, marker.data.pairedMarker);
  //       }
  //     }
  //   });

  //   if (this.playerStart && this.playerStart.element) {
  //     this.playerStart.element.style.left = `${this.playerStart.x * this.scale + this.offset.x
  //       }px`;
  //     this.playerStart.element.style.top = `${this.playerStart.y * this.scale + this.offset.y
  //       }px`;
  //     this.updateMarkerZoom(this.playerStart);
  //   }
  // }

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

  // updateMarkerPositions() {
  //   // Update regular markers
  //   this.markers.forEach((marker) => {
  //     if (marker.element) {
  //       // Update position
  //       marker.element.style.left = `${marker.x * this.scale + this.offset.x}px`;
  //       marker.element.style.top = `${marker.y * this.scale + this.offset.y}px`;
  
  //       // Handle special marker types
  //       if (marker.type === "encounter" && marker.data.monster) {
  //         // Additional zoom handling for encounter markers
  //         const token = marker.element.querySelector(".monster-token");
  //         if (token) {
  //           token.style.transform = `scale(${this.scale})`;
  //           token.style.transformOrigin = "center";
  //         }
  //       }
        
  //       // Handle prop markers
  //       const propVisual = marker.element.querySelector(".prop-visual");
  //       if (propVisual) {
  //         // For props, we want to preserve the rotation
  //         const currentTransform = propVisual.style.transform || "";
  //         const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
  //         const rotateVal = rotateMatch ? rotateMatch[1] : "0deg";
          
  //         // Apply both scale and rotation
  //         propVisual.style.transform = `scale(${this.scale}) rotate(${rotateVal})`;
  //         propVisual.style.transformOrigin = "center";
  //       }
  
  //       // Handle teleport connections
  //       if (marker.type === "teleport" && marker.data.isPointA && marker.data.pairedMarker && marker.connection) {
  //         this.updateTeleportConnection(marker, marker.data.pairedMarker);
  //       }
  //     }
  //   });
  
  //   // Update player start marker if it exists
  //   if (this.playerStart && this.playerStart.element) {
  //     this.playerStart.element.style.left = `${this.playerStart.x * this.scale + this.offset.x}px`;
  //     this.playerStart.element.style.top = `${this.playerStart.y * this.scale + this.offset.y}px`;
      
  //     // Apply scaling to player start marker visuals if needed
  //     const playerIcon = this.playerStart.element.querySelector(".material-icons");
  //     if (playerIcon) {
  //       playerIcon.style.transform = `scale(${this.scale * 0.8})`;
  //       playerIcon.style.transformOrigin = "center";
  //     }
  //   }
  // }


  getElevationAtPoint(x, z) {
    let elevation = 0;
    let isInside = false;
    
    // Check each room for overlap
    for (const room of this.rooms) {
        // Skip non-walls and non-raised blocks early
        if (!room.isRaisedBlock && room.type !== 'wall') continue;
        
        // Quick bounds check
        const roomX = room.bounds.x / 50 - this.boxWidth / 2;
        const roomZ = room.bounds.y / 50 - this.boxDepth / 2;
        const roomWidth = room.bounds.width / 50;
        const roomDepth = room.bounds.height / 50;
        
        if (x >= roomX && x <= roomX + roomWidth && 
            z >= roomZ && z <= roomZ + roomDepth) {
            
            if (room.isRaisedBlock) {
                elevation = Math.max(elevation, room.blockHeight || 0);
            } else if (room.type === 'wall') {
                isInside = true;
            }
        }
    }
    
    return { elevation, isInside };
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
      alert("Please load a map before placing markers");
      return null;
    }


    if (type === "door") {
      console.log('Finding nearest structure for door placement');
      const nearestStructure = this.rooms.find(room => {
        return this.isNearWall(x, y, room);  // Keep using isNearWall since it works for both
      });

      if (nearestStructure) {
        // console.log('Found nearest structure:', nearestStructure);
        // Use snapToStructure instead of snapToWall to get rotation info
        const snappedPosition = this.snapToStructure(x, y, nearestStructure);
        // console.log('Snapped position:', snappedPosition);

        // Get texture from resource manager
        const textureCategory = "doors";
        // console.log('Getting door texture from resource manager');
        const texture = this.resourceManager.getSelectedTexture(textureCategory);

        if (!texture) {
          // console.warn('No door texture available');
          alert('No door textures available. Please add some in the Resource Manager.');
          return null;
        }

        // console.log('Creating door marker with texture:', texture);
        const marker = this.createMarker("door", snappedPosition.x, snappedPosition.y, {
          texture: texture,
          door: {
            position: snappedPosition,  // This now includes edge and rotation
            isOpen: false
          },
          parentStructure: nearestStructure
        });
        this.markers.push(marker);
        return marker;
      } else {
        // console.warn('No nearby structure found for door placement');
        alert("Doors must be placed on a wall or room");
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
    // if (marker.data.monster?.token) {
    //   const tokenSource = marker.data.monster.token.data || marker.data.monster.token.url;
    //   const monsterSize = this.getMonsterSizeInSquares(marker.data.monster.basic.size);
      
    //   // Check if token is on elevated surface
    //   const { elevation, insideWall } = this.checkTokenElevation(marker);
      
    //   // Store for 3D view
    //   marker.data.elevation = elevation;
    //   marker.data.insideWall = insideWall;
      
    //   // Use existing cellSize calculation
    //   const cellSize = this.cellSize || 32;
    //   const totalSize = cellSize * monsterSize;
      
    //   // Create token HTML with elevation indicators
    //   marker.element.innerHTML = `
    //     <div class="monster-token" style="
    //         width: ${totalSize}px; 
    //         height: ${totalSize}px; 
    //         border-radius: 10%; 
    //         border: 2px solid ${insideWall ? '#ff9800' : '#f44336'}; 
    //         overflow: hidden;
    //         display: flex;
    //         align-items: center;
    //         justify-content: center;
    //         position: absolute;
    //         left: -${totalSize / 2}px;
    //         top: -${totalSize / 2}px;
    //         transform-origin: center;
    //         transform: scale(${this.scale});
    //         ${elevation > 0 ? `box-shadow: 0 ${elevation * 2}px ${elevation * 3}px rgba(0,0,0,0.3);` : ''}
    //     ">
    //         <img src="${tokenSource}" 
    //             style="width: 100%; height: 100%; object-fit: cover;"
    //             onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'material-icons\\' style=\\'font-size: ${totalSize * 0.75}px;\\'>local_fire_department</span>';" />
    //         ${elevation > 0 ? `
    //           <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; padding: 2px 4px; border-radius: 2px; font-size: 10px;">+${elevation}</div>
    //         ` : ''}
    //     </div>
    //   `;
  
    //   // Update position
    //   this.updateMarkerPosition(marker);
    // }  
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
            left: -${width/2}px;
            top: -${height/2}px;
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
    }
    this.fixZoomIssues();
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

  // Add new method to handle zoom scaling
  updateMarkerZoom(marker) {
    if (!marker.element) return;

    const token = marker.element.querySelector(".monster-token");
    if (token) {
      token.style.transform = `scale(${this.scale})`;
      token.style.transformOrigin = "center";
    }

    const propToken = marker.element.querySelector(".prop-visual");
    if (propToken) {
      propToken.style.transform = `scale(${this.scale})`;
      propToken.style.transformOrigin = "center";
    }


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

    // if (data.texture) {
    //   console.log('Applying texture to marker:', data.texture);
    //   // You might want to add custom styling here based on the texture
    // }

    // Set up drag handling with edit mode check

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
        door: "door_front",  // Add this line
        prop: "category"
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
      markerElement.style.transform = `rotate(${data.door?.position?.rotation || 0}deg)`;
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
          left: -${width/2}px;
          top: -${height/2}px;
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
          propVisual.style.left = `-${actualWidth/2}px`;
          propVisual.style.top = `-${actualHeight/2}px`;
        }
      };
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
      default:
        return "Map Marker";
    }
  }

  showMarkerContextMenu(marker, event) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Marker Options';

    // const canChangeTexture = (marker.type === 'door' || marker.type === 'prop') && this.resourceManager;
    const canChangeTexture = marker.type === 'door' && this.resourceManager;

    let content = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    if (canChangeTexture) {
      const textureCategory = marker.type === 'door' ? 'doors' : 'props';
      content += `
        <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
            <label>Texture:</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-top: 8px;">
                ${Array.from(this.resourceManager.resources.textures[textureCategory].entries()).map(([id, texture]) => `
                    <div class="texture-option" data-texture-id="${id}" 
                        style="cursor: pointer; border: 2px solid ${marker.data.texture?.id === id ? 'var(--sl-color-primary-600)' : 'transparent'}; 
                        padding: 4px; border-radius: 4px; position: relative;">
                        <img src="${texture.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 2px;">
                        <div style="font-size: 0.8em; text-align: center; margin-top: 4px;">${texture.name}</div>
                        ${marker.data.texture?.id === id ? `
                            <span class="material-icons" style="position: absolute; top: 4px; right: 4px; color: #4CAF50; 
                                background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px;">
                                check_circle
                            </span>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    if (marker.type === 'teleport') {
      content += `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px;">Teleport Point ${marker.data.isPointA ? 'A' : 'B'}</div>
                <div style="color: #666;">
                    ${marker.data.hasPair ?
          `Connected to Point ${marker.data.isPointA ? 'B' : 'A'}` :
          'No connection - Place another point to connect'}
                </div>
            </div>
        `;
    } else if (marker.type === 'encounter') {
// Inside showMarkerContextMenu, in the encounter marker section:
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
}

      // Buttons always show for encounter markers
      content += `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${marker.data.monster ? `
                <sl-button id="cloneMonster" size="small">
                    <span class="material-icons">content_copy</span>
                    Clone
                </sl-button>
            ` : ''}
            <sl-button id="linkMonster" size="small" style="grid-column: ${marker.data.monster ? 'auto' : '1 / -1'}">
                <span class="material-icons">link</span>
                ${marker.data.monster ? "Change" : "Add"} Monster
            </sl-button>
        </div>
    `;
    } else if (["treasure", "trap"].includes(marker.type)) {
      content += `
        <sl-input id="markerDescription"
                 label="Description"
                 value="${marker.data.description || ""}">
        </sl-input>
    `;
    } 
    else if (marker.type === "prop") {
      // Get current prop settings
      const propSettings = marker.data.prop || {};
      const rotation = propSettings.position?.rotation || 0;
      const scale = propSettings.scale || 1.0;
      const height = propSettings.height || 1.0;
      const isHorizontal = propSettings.isHorizontal || false;
      
      content += `
        <div style="margin-top: 8px;">
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
            <label>Prop Type:</label>
            <div class="prop-texture-grid" style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
              gap: 8px;
              margin-top: 8px;
              max-height: 200px;
              overflow-y: auto;
            ">
              ${Array.from(this.resourceManager.resources.textures.props?.entries() || []).map(([id, texture]) => `
                <div class="prop-texture-option ${marker.data.texture?.id === id ? 'selected' : ''}" data-texture-id="${id}">
                  <img src="${texture.data}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 2px;">
                  <div style="font-size: 0.7em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; margin-top: 4px;">
                    ${texture.name}
                  </div>
                  ${marker.data.texture?.id === id ? `
                    <span class="material-icons" style="position: absolute; top: 2px; right: 2px; color: #4CAF50; background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px; font-size: 14px;">
                      check_circle
                    </span>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
    
          <div class="prop-controls">
            <div style="margin-bottom: 16px;">
              <sl-switch id="prop-orientation" ${isHorizontal ? 'checked' : ''}>
                <span style="margin-right: 8px;">Horizontal</span>
                <sl-tooltip content="When enabled, prop will lie flat on surfaces">
                  <span class="material-icons" style="font-size: 16px; color: #666;">help_outline</span>
                </sl-tooltip>
              </sl-switch>
            </div>
            
            <div class="prop-control-row">
              <label>Rotation:</label>
              <sl-range min="0" max="359" step="15" value="${rotation}" id="prop-rotation" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${rotation}°</div>
            </div>
            
            <div class="prop-control-row">
              <label>Scale:</label>
              <sl-range min="0.5" max="3" step="0.1" value="${scale}" id="prop-scale" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${scale}x</div>
            </div>
            
            <div class="prop-control-row">
              <label>Height:</label>
              <sl-range min="0" max="4" step="0.1" value="${height}" id="prop-height" 
                       style="width: 100%;"></sl-range>
              <div style="min-width: 40px; text-align: right;">${height}</div>
            </div>
          </div>
          
          <div style="margin-top: 12px;">
            <div style="color: #666; font-size: 0.9em; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons" style="font-size: 16px;">info</span>
              <span>${isHorizontal ? 
                'Prop will lie flat on surfaces like a book, map, or scroll' : 
                'Prop will appear as a vertical standing image in 3D view'}</span>
            </div>
          </div>
        </div>
      `;
    }

    content += "</div>";

    // Add standardized footer with delete button
    content += `
    <div slot="footer" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="flex-spacer"></div>
        <sl-button class="delete-marker-btn" variant="danger">
            <span class="material-icons" style="margin-right: 4px;">delete</span>
            Remove ${marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
        </sl-button>
    </div>
`;

    dialog.innerHTML = content;


    if (marker.type === "prop") {
      // Setup texture selection
      dialog.querySelectorAll('.prop-texture-option').forEach(option => {
        option.addEventListener('click', () => {
          const textureId = option.dataset.textureId;
          const texture = this.resourceManager.resources.textures.props.get(textureId);
          if (texture) {
            marker.data.texture = texture;
            
            // Update visual appearance
            this.updateMarkerAppearance(marker);
            
            // Update selection in dialog
            dialog.querySelectorAll('.prop-texture-option').forEach(opt => 
              opt.classList.toggle('selected', opt.dataset.textureId === textureId)
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
          const propVisual = marker.element?.querySelector('.prop-visual');
          if (propVisual) {
            const size = 48 * scale;
            propVisual.style.width = `${size}px`;
            propVisual.style.height = `${size}px`;
            propVisual.style.left = `-${size/2}px`;
            propVisual.style.top = `-${size/2}px`;
          }
        });
      }
      
      // Add height control
      const heightSlider = dialog.querySelector('#prop-height');
      if (heightSlider) {
        heightSlider.addEventListener('sl-input', (e) => {
          const height = parseFloat(e.target.value).toFixed(1);
          // Update display
          heightSlider.nextElementSibling.textContent = `${height}`;
          
          // Update prop data
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.height = parseFloat(height);
        });
      }

      const orientationSwitch = dialog.querySelector('#prop-orientation');
      if (orientationSwitch) {
        orientationSwitch.addEventListener('sl-change', (e) => {
          const isHorizontal = e.target.checked;
          
          // Update prop data
          if (!marker.data.prop) marker.data.prop = {};
          marker.data.prop.isHorizontal = isHorizontal;
          
          // Update help text
          const helpText = dialog.querySelector('.prop-controls + div span:last-child');
          if (helpText) {
            helpText.textContent = isHorizontal ? 
              'Prop will lie flat on surfaces like a book, map, or scroll' : 
              'Prop will appear as a vertical standing image in 3D view';
          }
          
          // Update visual appearance if needed
          const propVisual = marker.element?.querySelector('.prop-visual');
          if (propVisual) {
            // Could add a small indicator for horizontal props in 2D view
            propVisual.classList.toggle('horizontal-prop', isHorizontal);
          }
        });
      }

    }



    document.body.appendChild(dialog);


    // Add texture selection handler
    const textureOptions = dialog.querySelectorAll('.texture-option');
    textureOptions.forEach(option => {
      option.addEventListener('click', () => {
        const textureId = option.dataset.textureId;
        const textureCategory = marker.type === 'door' ? 'doors' : 'props';
        const texture = this.resourceManager.resources.textures[textureCategory].get(textureId);
        if (texture) {
          marker.data.texture = texture;
          this.updateMarkerAppearance(marker);
          textureOptions.forEach(opt => opt.style.border = '2px solid transparent');
          option.style.border = '2px solid var(--sl-color-primary-600)';
        }
      });
    });


    // dialog.show();

    const deleteBtn = dialog.querySelector('.delete-marker-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.removeMarker(marker);
        dialog.hide();
      });
    }

    // Add other existing event handlers
    const changeTextureBtn = dialog.querySelector('.change-texture-btn');
    if (changeTextureBtn) {
      changeTextureBtn.addEventListener('click', async () => {
        dialog.hide();
        const texture = await this.resourceManager.showTextureSelectionDialog({
          type: marker.type === 'door' ? 'door' : 'prop'
        });
        if (texture) {
          marker.data.texture = texture;
          this.updateMarkerAppearance(marker);
        }
      });
    }

    const cloneBtn = dialog.querySelector("#cloneMonster");
    if (cloneBtn) {
      cloneBtn.addEventListener("click", () => {
        this.monsterManager.cloneEncounter(marker);
        dialog.hide();
      });
    }


        const linkBtn = dialog.querySelector("#linkMonster");
    if (linkBtn) {
      linkBtn.addEventListener("click", () => {
        dialog.hide();
        this.showMiniBestiaryDialog(marker);
      });
    }


    const descInput = dialog.querySelector("#markerDescription");
    if (descInput) {
      descInput.addEventListener("sl-change", (e) => {
        marker.data.description = e.target.value;
      });
    }

    dialog.addEventListener("sl-after-hide", () => {
      dialog.remove();
    });

        // After creating dialog but before dialog.show():
    if (marker.type === "encounter" && !marker.data.monster) {
      this.loadMiniBestiary(dialog, marker);
    }

    dialog.show();
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
  ctx.strokeRect(2, 2, size-4, size-4);
  
  // Add initial
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(monster.basic.name.charAt(0).toUpperCase(), size/2, size/2);
  
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


}
