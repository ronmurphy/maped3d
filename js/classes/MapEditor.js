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
        version: "1.2", // Bump version for texture support
        timestamp: new Date().toISOString(),
        mapImage: null,
        gridSettings: {
          cellSize: this.cellSize,
          width: this.gridDimensions?.width,
          height: this.gridDimensions?.height
        },
        rooms: this.rooms.map((room) => {
          console.log("Saving room:", {
            id: room.id,
            shape: room.shape,
            bounds: room.bounds
          });
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
        textureData: {
          assignments: this.resourceManager?.serializeTextureAssignments(),
          activeResourcePack: this.resourceManager?.activeResourcePack?.name
        },

        // Add player start marker if it exists
        playerStart: this.playerStart ? {
          id: this.playerStart.id,
          type: this.playerStart.type,
          x: this.playerStart.x,
          y: this.playerStart.y,
          data: { ...this.playerStart.data }
        } : null,
        markers: this.markers.map((marker) => {
          console.log("Saving marker:", {
            type: marker.type,
            id: marker.id
          });

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
              // Skip the pairedMarker object reference
              if (key !== "pairedMarker") {
                markerData.data[key] = marker.data[key];
              }
            });

            // Handle parent wall reference for doors
            if (marker.data.parentWall) {
              markerData.data.parentWallId = marker.data.parentWall.id;
              delete markerData.data.parentWall;
            }

            // Save texture data if present
            if (marker.data.texture) {
              markerData.data.textureId = marker.data.texture.id;
              markerData.data.textureCategory = marker.data.texture.category;
            }
          }

          // Special handling for different marker types
          if (marker.type === "encounter" && marker.data.monster) {
            // Keep existing monster data handling
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
          }

          return markerData;
        }),
        // Add reference to resource pack if one is loaded
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

      console.log("Map data prepared, creating file...");

      // Create the file
      const blob = new Blob([JSON.stringify(saveData, null, 2)], {
        type: "application/json"
      });

      // Generate filename based on map name and timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const mapName = this.mapName || this.originalMapName || "untitled";
      const filename = `${mapName}-${timestamp}.json`;

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
    } catch (error) {
      console.error("Error saving map:", error);
      toast.style.backgroundColor = "#f44336";
      toast.innerHTML = `
            <span class="material-icons">error</span>
            <span>Error saving map!</span>
        `;
    }

    // Remove toast after delay
    setTimeout(() => toast.remove(), 2000);
  }

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
        // console.log("Creating room:", {
        //   id: roomData.id,
        //   shape: roomData.shape,
        //   type: roomData.type,
        //   bounds: roomData.bounds
        // });

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

      // Restore markers
      console.log("Starting marker restoration...");
      for (const markerData of saveData.markers) {
        console.log("Loading marker:", {
          type: markerData.type,
          data: markerData.data
        });

        if (saveData.playerStart) {
          console.log("Restoring player start marker:", saveData.playerStart);
          this.playerStart = this.addMarker(
            "player-start",
            saveData.playerStart.x,
            saveData.playerStart.y,
            saveData.playerStart.data || {}
          );
        }

        // Handle texture restoration
        if (markerData.data.textureId && this.resourceManager) {
          const texture = this.resourceManager.resources.textures[markerData.data.textureCategory]?.get(markerData.data.textureId);
          if (texture) {
            markerData.data.texture = texture;
          }
        }

        // Handle parent wall restoration for doors
        if (markerData.data.parentWallId) {
          markerData.data.parentWall = this.rooms.find(r => r.id === markerData.data.parentWallId);
        }

        const marker = this.addMarker(
          markerData.type,
          markerData.x,
          markerData.y,
          markerData.data
        );

        if (marker.type === "encounter" && marker.data.monster) {
          this.updateMarkerAppearance(marker);
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
      this.markers.forEach(marker => {
        this.updateMarkerPosition(marker);
      });

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
        dialog.label = "Open Map";

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

                <sl-button size="large" class="load-project-btn" style="justify-content: flex-start;">
                    <span slot="prefix" class="material-icons">folder_open</span>
                    Load Project
                    <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                        Open a previously saved map project
                    </div>
                </sl-button>
            </div>
        `;

        // Create hidden file inputs
        const pictureInput = document.createElement("input");
        pictureInput.type = "file";
        pictureInput.accept = "image/*";
        pictureInput.style.display = "none";

        const jsonInput = document.createElement("input");
        jsonInput.type = "file";
        jsonInput.accept = ".json";
        jsonInput.style.display = "none";

        document.body.appendChild(pictureInput);
        document.body.appendChild(jsonInput);

        // Handle picture file selection

        pictureInput.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (file) {
            // Parse filename first
            const parseResult = this.parseMapFilename(file.name);


            // If we couldn't get a map name or user wants to change it, show dialog
            let mapName = parseResult.mapName;


            if (!mapName || !parseResult.success) {
              // Show name dialog as fallback
              const nameConfirmed = await this.showMapNameDialog();
              if (!nameConfirmed) {
                return; // User cancelled
              }
            } else {
              // Found a name, but let's confirm with the user
              const dialog = document.createElement('sl-dialog');
              dialog.label = 'Map Name';
              dialog.innerHTML = `
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

              document.body.appendChild(dialog);

              // Return a promise that resolves when the dialog is handled
              await new Promise((resolve) => {
                const mapNameInput = dialog.querySelector('#mapNameInput');
                const saveBtn = dialog.querySelector('.save-btn');
                const cancelBtn = dialog.querySelector('.cancel-btn');

                saveBtn.addEventListener('click', () => {
                  mapName = mapNameInput.value.trim();
                  this.mapName = mapName;
                  this.originalMapName = mapName;
                  dialog.hide();
                  resolve(true);
                });

                cancelBtn.addEventListener('click', () => {
                  dialog.hide();
                  resolve(false);
                });

                dialog.addEventListener('sl-after-hide', () => {
                  dialog.remove();
                });

                dialog.show();
              });
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

            try {
              // Parse grid dimensions from filename
              const mapDimensions = parseMapDimensions(file.name);
              if (mapDimensions) {
                this.gridDimensions = mapDimensions;
              }

              const reader = new FileReader();
              await new Promise((resolve, reject) => {
                reader.onload = (event) => {
                  const img = new Image();
                  img.onload = () => {
                    this.baseImage = img;

                    // Calculate DPI if possible
                    if (this.gridDimensions) {
                      const cellWidth =
                        img.width / this.gridDimensions.width;
                      const cellHeight =
                        img.height / this.gridDimensions.height;
                      this.cellSize = Math.min(cellWidth, cellHeight);
                      // console.log(
                      //   `Calculated cell size: ${this.cellSize}px`
                      // );
                    }

                    // Store the natural dimensions
                    this.naturalWidth = img.naturalWidth;
                    this.naturalHeight = img.naturalHeight;

                    this.centerMap();
                    this.render();
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
            } catch (error) {
              console.error("Error loading map:", error);
              // Error notification
              toast.style.backgroundColor = "#f44336";
              toast.innerHTML = `
                        <span class="material-icons">error</span>
                        <span>Error loading map!</span>
                    `;
              setTimeout(() => toast.remove(), 2000);
            }
            dialog.hide();
          }
        });

        // Handle JSON file selection
        jsonInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.loadMap(file);
            dialog.hide();
          }
        });

        // Add button click handlers
        dialog
          .querySelector(".new-map-btn")
          .addEventListener("click", () => {
            pictureInput.click();
            this.clearMap(); // Clear everything before loading new picture
            dialog.hide();
          });

        // Change Picture button handler
        dialog
          .querySelector(".change-picture-btn")
          .addEventListener("click", () => {
            pictureInput.click();
            dialog.hide();
          });

        // Load Project button handler
        dialog
          .querySelector(".load-project-btn")
          .addEventListener("click", () => {
            jsonInput.click();
            dialog.hide();
          });

        // Clean up on close
        dialog.addEventListener("sl-after-hide", () => {
          dialog.remove();
          pictureInput.remove();
          jsonInput.remove();
        });

        // Show the dialog
        document.body.appendChild(dialog);
        dialog.show();
      });
    }

    const saveProjectBtn = document.getElementById("saveProjectBtn");
    if (saveProjectBtn) {
      saveProjectBtn.addEventListener("click", () => this.saveMap());
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
      doorTool: "door"
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

    window.addEventListener("resize", () => this.handleResize());
  }

  setTool(tool) {
    if (this.currentTool === "wall") {
      this.cleanupWallTool();
    }
    this.currentTool = tool;

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
      // room.bounds.x = newX;
      // room.bounds.y = newY;
      // room.bounds.width = Math.max(newWidth, this.cellSize || 20);
      // room.bounds.height = Math.max(newHeight, this.cellSize || 20);

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
    this.markers.forEach((marker) => {
      if (marker.element) {
        // Update position
        marker.element.style.left = `${marker.x * this.scale + this.offset.x
          }px`;
        marker.element.style.top = `${marker.y * this.scale + this.offset.y
          }px`;

        // Update zoom scale
        this.updateMarkerZoom(marker);

        // Handle teleport connections if present
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
      this.updateMarkerZoom(this.playerStart);
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
    // Changed name from startDragging to startMarkerDragging
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
        this.updateTeleportConnections();
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
      const tokenSource =
        marker.data.monster.token.data || marker.data.monster.token.url;
      const monsterSize = this.getMonsterSizeInSquares(
        marker.data.monster.basic.size
      );

      // Use the existing cellSize property
      const cellSize = this.cellSize || 32; // Fallback to 32 if cellSize not calculated yet
      const totalSize = cellSize * monsterSize; // This will be both width and height

      // Make the token square and centered
      marker.element.innerHTML = `
            <div class="monster-token" style="
                width: ${totalSize}px; 
                height: ${totalSize}px; 
                border-radius: 10%; 
                border: 2px solid #f44336; 
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                position: absolute;
                left: -${totalSize / 2}px;
                top: -${totalSize / 2}px;
                transform-origin: center;
                transform: scale(${this.scale}); /* Add map scaling */
            ">
                <img src="${tokenSource}" 
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'material-icons\' style=\'font-size: ${totalSize * 0.75
        }px;\'>local_fire_department</span>';" />
            </div>
        `;

      // Update position with current scale and offset
      this.updateMarkerPosition(marker);
    }
  }

  // Add new method to handle zoom scaling
  updateMarkerZoom(marker) {
    if (!marker.element) return;

    const token = marker.element.querySelector(".monster-token");
    if (token) {
      token.style.transform = `scale(${this.scale})`;
      token.style.transformOrigin = "center";
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
        door: "door_front"  // Add this line
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

    const canChangeTexture = (marker.type === 'door' || marker.type === 'prop') && this.resourceManager;

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
      if (marker.data.monster) {
        // Create monster URL using name and source
        const baseUrl = "https://5e.tools/bestiary.html";
        const monsterName = marker.data.monster.basic.name
          .toLowerCase()
          .replace(/\s+/g, "_");
        const sourceCode = "xphb"; // We could extract this from source data if available
        const monsterUrl = `${baseUrl}#${monsterName}_${sourceCode}`;

        content += `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                    ${marker.data.monster.token ? `
                        <div style="width: 100px; height: 100px; border-radius: 8px; border: 2px solid #f44336; overflow: hidden;">
                            <img src="${marker.data.monster.token.data || marker.data.monster.token.url}" 
                                 style="width: 100%; height: 100%; object-fit: cover;" />
                        </div>
                    ` : ""}
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 4px 0; font-size: 1.2em;">
                            <a href="${monsterUrl}" target="_blank" style="color: #2196F3; text-decoration: none;">
                                ${marker.data.monster.basic.name}
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">open_in_new</span>
                            </a>
                        </h3>
                        <div style="color: #666; font-style: italic; margin-bottom: 8px;">
                            ${marker.data.monster.basic.size} ${marker.data.monster.basic.type}, 
                            ${marker.data.monster.basic.alignment}
                        </div>
                        <div style="color: #666;">
                            CR ${marker.data.monster.basic.cr} (${marker.data.monster.basic.xp} XP)
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
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

                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: bold;">STR</div>
                        <div>${marker.data.monster.abilities.str.score} (${marker.data.monster.abilities.str.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.str.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">DEX</div>
                        <div>${marker.data.monster.abilities.dex.score} (${marker.data.monster.abilities.dex.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.dex.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CON</div>
                        <div>${marker.data.monster.abilities.con.score} (${marker.data.monster.abilities.con.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.con.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">INT</div>
                        <div>${marker.data.monster.abilities.int.score} (${marker.data.monster.abilities.int.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.int.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">WIS</div>
                        <div>${marker.data.monster.abilities.wis.score} (${marker.data.monster.abilities.wis.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.wis.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CHA</div>
                        <div>${marker.data.monster.abilities.cha.score} (${marker.data.monster.abilities.cha.modifier >= 0 ? "+" : ""}${marker.data.monster.abilities.cha.modifier})</div>
                    </div>
                </div>
            </div>
        `;
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
    document.body.appendChild(dialog);

  //   if (marker.data.monster.token) {
  //     const img = new Image();
  //     img.crossOrigin = "anonymous";
  //     img.onload = () => {
  //         const canvas = document.createElement('canvas');
  //         canvas.width = img.width;
  //         canvas.height = img.height;
  //         const ctx = canvas.getContext('2d');
  //         ctx.drawImage(img, 0, 0);
          
  //         try {
  //             const base64Data = canvas.toDataURL('image/webp');
  //             marker.data.monster.token.data = base64Data;
  //             console.log('Token image captured successfully');
  //         } catch (error) {
  //             console.error('Error capturing token image:', error);
  //         }
  //     };
  //     img.onerror = (error) => {
  //         console.error('Error loading token image:', error);
  //     };
  //     img.src = marker.data.monster.token.url;
  // }

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
        this.monsterManager.showMonsterSelector(marker);
        dialog.hide();
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

    dialog.show();
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




}
