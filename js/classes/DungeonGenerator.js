/**
 * DungeonGenerator.js - Creates procedurally generated 3D dungeons
 * Compatible with Scene3DController and PhysicsController
 * 
 * we are using  using cellular automata and multi-stage generation
 */

class DungeonGenerator {
    constructor(scene3D, resourceManager) {
        this.scene3D = scene3D;
        this.resourceManager = resourceManager;
        this.physics = scene3D.physics;

          // If resource manager is provided, load textures immediately
  if (this.resourceManager) {
    console.log("ResourceManager provided in constructor, loading textures");
    this.loadTextures();
  }
        

        // Dungeon parameters
        this.difficultyLevel = 'medium'; // Default difficulty
        this.dungeonSize = 20; // Base size (in 3D world units)
        this.cellSize = 1; // Size of each grid cell
        this.wallHeight = 4.5; // Match the standard wall height

        // Room generation parameters
        this.roomSizeMin = 4;
        this.roomSizeMax = 8;
        this.numRooms = 6;
        this.corridorWidth = 2;
        this.enemyDensity = 0.05; // Enemies per square unit

        // Grid for layout planning (0=empty, 1=wall, 2=floor)
        this.grid = [];

        // Track dungeon elements
        this.rooms = [];
        this.corridors = [];
        this.playerSpawnPoint = null;
        this.exitPoint = null;
        this.enemySpawnPoints = [];

        // Cache created textures
        this.floorTextures = [];
        this.wallTextures = [];

        // Track all created objects for cleanup
        this.dungeonElements = [];
    }

    connectToResourceManager(resourceManager) {
        if (!resourceManager) {
          console.error("DungeonGenerator - Invalid ResourceManager provided");
          return false;
        }
  
        this.resourceManager = resourceManager;
        console.log("DungeonGenerator is Connected to ResourceManager");
        return true;
      }

    /**
     * Set the difficulty level for the dungeon
     * @param {string} difficulty - 'easy', 'medium', 'hard', or 'epic'
     */
    configureDifficulty(difficulty) {
        console.log(`Setting dungeon difficulty to: ${difficulty}`);
        this.difficultyLevel = difficulty.toLowerCase();
        
        // Scale dungeon size with difficulty
        const baseSize = 20; // Base size for easy (in 3D world units)
        
        switch(this.difficultyLevel) {
            case 'easy':
                this.dungeonSize = baseSize;
                this.numRooms = 4;
                this.roomSizeMax = 6;
                this.enemyDensity = 0.03;
                break;
                
            case 'medium':
                this.dungeonSize = baseSize * 2; // 40 units
                this.numRooms = 8;
                this.roomSizeMax = 8;
                this.enemyDensity = 0.05;
                break;
                
            case 'hard':
                this.dungeonSize = baseSize * 3; // 60 units
                this.numRooms = 12;
                this.roomSizeMax = 10;
                this.enemyDensity = 0.08;
                break;
                
            case 'epic':
                this.dungeonSize = baseSize * 4; // 80 units
                this.numRooms = 16;
                this.roomSizeMax = 12;
                this.enemyDensity = 0.1;
                break;
                
            default:
                // Default to medium
                this.dungeonSize = baseSize * 2;
                this.numRooms = 8;
                this.enemyDensity = 0.05;
                break;
        }
        
        // Apply additional scaling if needed
        // this.dungeonSize = this.dungeonSize * 2; // Double all dungeon sizes
        this.dungeonSize = this.dungeonSize + this.dungeonSize /2; // 1.5x all dungeon sizes

        
        console.log(`Dungeon configured: size=${this.dungeonSize}, rooms=${this.numRooms}, maxRoomSize=${this.roomSizeMax}`);
    }

    /**
     * Create a new dungeon
     * @returns {Object} Information about the generated dungeon
     */
    createNew() {
        console.log("Generating new dungeon...");
        
        try {
            // Clear any existing dungeon elements
            this.clearExistingDungeon();
            
            // Initialize grid
            this.initializeGrid();
            
            // Pre-load textures
            this.loadTextures();
            
            // Generate rooms
            this.generateRooms();
            
            // Create corridors between rooms
            this.connectRooms();
            
            // Extend floors around walls
            this.extendFloorsAroundWalls();
            
            // Determine player spawn and exit points
            this.placePlayerAndExit();
            
            // Build the 3D representation
            this.buildDungeon3D();
            
            console.log("Dungeon generation complete");
            
            return {
                playerSpawnPoint: this.playerSpawnPoint,
                exitPoint: this.exitPoint,
                enemySpawnPoints: this.enemySpawnPoints,
                rooms: this.rooms.length,
                size: this.dungeonSize
            };
        } catch (error) {
            console.error("Error generating dungeon:", error);
            // Ensure we at least have a valid player spawn point
            if (!this.playerSpawnPoint) {
                this.playerSpawnPoint = new THREE.Vector3(0, 0, 0);
            }
            return {
                playerSpawnPoint: this.playerSpawnPoint,
                error: error.message
            };
        }
    }

    /**
     * Clear any existing dungeon elements
     */
    clearExistingDungeon() {
        console.log("Clearing existing dungeon elements");
        
        // Remove all objects with isDungeonElement tag
        const objectsToRemove = [];
        
        this.scene3D.scene.traverse(obj => {
            // Remove dungeon elements plus any teleport markers
            if ((obj.userData && (obj.userData.isDungeonElement || obj.userData.isTeleportMarker)) ||
                (obj.name && obj.name.toLowerCase().includes('teleport'))) {
                objectsToRemove.push(obj);
            }
        });
        
        // Remove objects
        objectsToRemove.forEach(obj => {
            if (obj.parent) {
                obj.parent.remove(obj);
                
                // Clean up resources
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            }
        });
        
        // Reset tracking arrays
        this.rooms = [];
        this.corridors = [];
        this.enemySpawnPoints = [];
        this.dungeonElements = [];
        this.playerSpawnPoint = null;
        this.exitPoint = null;
    }

    /**
     * Initialize the grid used for dungeon generation
     */
    initializeGrid() {
        // Create a grid twice the resolution of world units for finer detail
        const gridSize = this.dungeonSize * 2;
        this.grid = [];

        for (let x = 0; x < gridSize; x++) {
            this.grid[x] = [];
            for (let z = 0; z < gridSize; z++) {
                this.grid[x][z] = 0; // 0 = empty space
            }
        }

        console.log(`Grid initialized with size ${gridSize}x${gridSize}`);
    }

/**
 * Connect to an existing resource manager instance
 * @param {ResourceManager} resourceManager - The resource manager instance
 */
connectToResourceManager(resourceManager) {
    if (!resourceManager) {
      console.warn("Cannot connect to null resource manager");
      return;
    }
    
    console.log("Connecting DungeonGenerator to ResourceManager");
    this.resourceManager = resourceManager;
    
    // Load textures now that we have access to the resource manager
    this.loadTextures();
  }
  
  /**
   * Load textures from the resource manager with precise targeting
   */
  loadTextures() {
    console.log("Loading dungeon textures from resource manager");
    const floorTextures = [];
    const wallTextures = [];
    
    try {
      // Check if resource manager is available
      if (!this.resourceManager) {
        console.warn("⚠️ No resource manager available for texture loading");
        throw new Error("Resource manager not available");
      }
      
      // Check if we have resources
      if (!this.resourceManager.resources || !this.resourceManager.resources.textures) {
        console.warn("No texture resources found in resource manager");
        throw new Error("No texture resources available");
      }
      
      // Debug log to check structure
      console.log("Resource manager structure:", {
        hasTextures: !!this.resourceManager.resources.textures,
        wallsCategory: !!this.resourceManager.resources.textures.walls,
        isMap: this.resourceManager.resources.textures.walls instanceof Map,
        wallsType: typeof this.resourceManager.resources.textures.walls
      });
      
      // Get the walls category - check if it's a Map or a regular object
      const wallsCategory = this.resourceManager.resources.textures.walls;
      
      if (wallsCategory) {
        // Handle both Map and regular object cases
        const isMapObject = wallsCategory instanceof Map;
        
        // Try to use specific dungeon textures
        const textureNames = [
          "DungeonFloor1.png", "DungeonFloor2.png", 
          "DungeonWall1.png", "DungeonWall2.png"
        ];
        
        if (isMapObject) {
          // If it's a Map, we use Map methods
          wallsCategory.forEach((texture, id) => {
            if (texture && texture.name) {
              if (textureNames.includes(texture.name)) {
                try {
                  const loadedTexture = this.resourceManager.getTexture(texture.name, "walls");
                  if (loadedTexture) {
                    if (texture.name.toLowerCase().includes("floor")) {
                      floorTextures.push(loadedTexture);
                      console.log(`✅ Found floor texture: ${texture.name}`);
                    } else {
                      wallTextures.push(loadedTexture);
                      console.log(`✅ Found wall texture: ${texture.name}`);
                    }
                  }
                } catch (err) {
                  console.warn(`Error loading texture ${texture.name}:`, err);
                }
              }
            }
          });
        } else {
          // It's a regular object, use object iteration
          for (const id in wallsCategory) {
            const texture = wallsCategory[id];
            if (texture && texture.name) {
              if (textureNames.includes(texture.name)) {
                try {
                  const loadedTexture = this.resourceManager.getTexture(texture.name, "walls");
                  if (loadedTexture) {
                    if (texture.name.toLowerCase().includes("floor")) {
                      floorTextures.push(loadedTexture);
                      console.log(`✅ Found floor texture: ${texture.name}`);
                    } else {
                      wallTextures.push(loadedTexture);
                      console.log(`✅ Found wall texture: ${texture.name}`);
                    }
                  }
                } catch (err) {
                  console.warn(`Error loading texture ${texture.name}:`, err);
                }
              }
            }
          }
        }
      }
      
      // If we still don't have textures, try direct access
      if (floorTextures.length === 0 && wallTextures.length === 0) {
        console.log("Trying direct access to texture data...");
        
        const directTextures = [
          { name: "DungeonFloor1.png", type: "floor" },
          { name: "DungeonFloor2.png", type: "floor" },
          { name: "DungeonWall1.png", type: "wall" },
          { name: "DungeonWall2.png", type: "wall" }
        ];
        
        for (const textureInfo of directTextures) {
          try {
            // Try to directly access texture data
            const data = this.resourceManager.resources.textures.walls[`walls_${textureInfo.name.replace('.png', '')}`];
            if (data && data.data) {
              // Create a THREE.js texture from the data
              const loader = new THREE.TextureLoader();
              const texture = loader.load(data.data);
              
              if (textureInfo.type === "floor") {
                floorTextures.push(texture);
                console.log(`✅ Direct access: Found floor texture ${textureInfo.name}`);
              } else {
                wallTextures.push(texture);
                console.log(`✅ Direct access: Found wall texture ${textureInfo.name}`);
              }
            }
          } catch (err) {
            console.warn(`Direct access failed for ${textureInfo.name}:`, err);
          }
        }
      }
    } catch (e) {
      console.error("Error loading textures:", e);
    }
    
    // Create fallbacks if needed (your existing code)
    if (floorTextures.length === 0) {
      console.warn("⚠️ No floor textures found - creating fallbacks");
      floorTextures.push(this.createDefaultTexture('floor', 0x555555));
      floorTextures.push(this.createDefaultTexture('floor', 0x666666));
    }
    
    if (wallTextures.length === 0) {
      console.warn("⚠️ No wall textures found - creating fallbacks");
      wallTextures.push(this.createDefaultTexture('wall', 0x777777));
      wallTextures.push(this.createDefaultTexture('wall', 0x888888));
    }
    
    // Process textures for tiling
    floorTextures.forEach(texture => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
    
    wallTextures.forEach(texture => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, this.wallHeight / 4);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
    
    this.floorTextures = floorTextures;
    this.wallTextures = wallTextures;
    
    console.log(`Texture loading complete: ${floorTextures.length} floor textures and ${wallTextures.length} wall textures`);
  }

  /**
 * Create a material with proper texture settings
 * @param {string} type - 'floor' or 'wall'
 * @returns {THREE.Material} - Material with properly configured texture
 */
createMaterial(type) {
    let texture;
    let color;
    
    // Get appropriate texture based on type
    if (type === 'floor') {
      texture = this.floorTextures.length > 0 ? this.floorTextures[0] : null;
      color = 0x777777; // Gray fallback
    } else {
      texture = this.wallTextures.length > 0 ? this.wallTextures[0] : null;
      color = 0x555555; // Darker gray fallback
    }
    
    // Create material with texture if available
    let material;
    
    if (texture) {
      material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
      
      console.log(`Created ${type} material with texture`);
    } else {
      // Fallback to colored material
      material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
      
      console.log(`Created ${type} material WITHOUT texture (color fallback)`);
    }
    
    return material;
  }

/**
 * Create a single large floor for the entire dungeon
 */
// Modified createLargeFloor method to align with wall coordinates
createLargeFloor() {
    console.log("Creating large unified floor with aligned coordinates");
    
    // Determine the bounds of the dungeon
    let minX = this.dungeonSize;
    let maxX = 0;
    let minZ = this.dungeonSize;
    let maxZ = 0;
    
    // Scan grid to find actual dungeon boundaries
    for (let x = 0; x < this.grid.length; x++) {
      for (let z = 0; z < this.grid[0].length; z++) {
        if (this.grid[x][z] === 2) { // If floor
          minX = Math.min(minX, x / 2);
          maxX = Math.max(maxX, x / 2);
          minZ = Math.min(minZ, z / 2);
          maxZ = Math.max(maxZ, z / 2);
        }
      }
    }
    
    // Convert to the same world coordinate system as walls
    minX = minX - this.dungeonSize / 2;
    maxX = maxX - this.dungeonSize / 2;
    minZ = minZ - this.dungeonSize / 2;
    maxZ = maxZ - this.dungeonSize / 2;
    
    console.log(`Floor bounds in world coordinates: X(${minX.toFixed(2)} to ${maxX.toFixed(2)}), Z(${minZ.toFixed(2)} to ${maxZ.toFixed(2)})`);
    
    // Add margin to ensure coverage
    minX = minX - 2;
    minZ = minZ - 2;
    maxX = maxX + 2;
    maxZ = maxZ + 2;
    
    const floorWidth = maxX - minX;
    const floorDepth = maxZ - minZ;
    
    if (floorWidth <= 0 || floorDepth <= 0) {
      console.error("Invalid floor dimensions:", floorWidth, floorDepth);
      return;
    }
    
    const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
    
    // Create material with visible color for debugging
    // const floorMaterial = new THREE.MeshStandardMaterial({
    //   map: this.floorTextures[0],
    //   color: 0x888888, // Add a gray tint for visibility
    //   roughness: 0.8,
    //   side: THREE.DoubleSide
    // });

    const floorMaterial = this.createMaterial('floor');
    
    // Set texture repeat based on floor size
    if (floorMaterial.map) {
      floorMaterial.map.wrapS = THREE.RepeatWrapping;
      floorMaterial.map.wrapT = THREE.RepeatWrapping;
      floorMaterial.map.repeat.set(floorWidth / 2, floorDepth / 2);
    }
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    
    // Position floor center with consistent world coordinate system
    floor.position.set(
      minX + floorWidth / 2,
      0, // Exact floor level
      minZ + floorDepth / 2
    );
    
    floor.userData = {
      isDungeonElement: true,
      isFloor: true,
      isLargeFloor: true
    };
    
    this.scene3D.scene.add(floor);
    this.dungeonElements.push(floor);
    
    console.log(`Created large floor: ${floorWidth.toFixed(1)}x${floorDepth.toFixed(1)} at position (${floor.position.x.toFixed(2)}, ${floor.position.y.toFixed(2)}, ${floor.position.z.toFixed(2)})`);
    
    // Add a visible floor grid for debugging
    const gridHelper = new THREE.GridHelper(Math.max(floorWidth, floorDepth), 20, 0xff0000, 0x444444);
    gridHelper.position.set(floor.position.x, 0.02, floor.position.z);
    this.scene3D.scene.add(gridHelper);
    this.dungeonElements.push(gridHelper);
    
    return floor;
  }
/**
 * Extend floors beyond walls to prevent visible gaps
 */
extendFloorsAroundWalls() {
    console.log("Extending floors beyond walls");
    
    // Create a copy of the current grid
    const originalGrid = [];
    for (let x = 0; x < this.grid.length; x++) {
        originalGrid[x] = [...this.grid[x]];
    }
    
    // Extension amount (in grid cells)
    const extendAmount = 3;
    
    // For each wall cell, extend floor around it
    for (let x = 0; x < this.grid.length; x++) {
        for (let z = 0; z < this.grid[0].length; z++) {
            // If this is a wall
            if (originalGrid[x][z] === 1) {
                // Extend floor in all directions
                for (let dx = -extendAmount; dx <= extendAmount; dx++) {
                    for (let dz = -extendAmount; dz <= extendAmount; dz++) {
                        // Skip the wall itself
                        if (dx === 0 && dz === 0) continue;
                        
                        // Check bounds
                        const nx = x + dx;
                        const nz = z + dz;
                        
                        if (nx >= 0 && nx < this.grid.length && 
                            nz >= 0 && nz < this.grid[0].length) {
                            
                            // If empty space, make it extended floor
                            if (this.grid[nx][nz] === 0) {
                                this.grid[nx][nz] = 3; // 3 = extended floor (will render as floor but not allow objects)
                            }
                        }
                    }
                }
            }
        }
    }
}

    /**
     * Create a default texture when no textures are available
     * @param {string} type - 'floor' or 'wall'
     * @param {number} color - Base color for the texture
     * @returns {THREE.Texture} Generated texture
     */
    createDefaultTexture(type, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 128, 128);

        if (type === 'floor') {
            // Add grid pattern
            ctx.strokeStyle = '#' + (color - 0x111111).toString(16).padStart(6, '0');
            ctx.lineWidth = 1;
            for (let i = 0; i < 128; i += 16) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(128, i);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 128);
                ctx.stroke();
            }
        } else {
            // Add brick pattern for walls
            ctx.strokeStyle = '#' + (color - 0x222222).toString(16).padStart(6, '0');
            ctx.lineWidth = 2;
            for (let i = 0; i < 128; i += 32) {
                for (let j = 0; j < 128; j += 16) {
                    // Offset every other row
                    const offset = (j % 32 === 0) ? 0 : 16;
                    ctx.strokeRect(i + offset, j, 32, 16);
                }
            }
        }

        return new THREE.CanvasTexture(canvas);
    }


/**
 * Generate rooms for the dungeon with content placement
 */
generateRooms() {
    console.log("Generating dungeon rooms with grid-based content");
    
    this.rooms = [];
    
    // Center of the dungeon
    const center = Math.floor(this.dungeonSize / 2);
    
    // Room density - higher values create more room attempts
    const roomDensity = {
        easy: 0.55,
        medium: 0.65,
        hard: 0.75,
        epic: 0.85
    }[this.difficultyLevel] || 0.65;
    
    // Create room candidates
    const candidateRooms = [];
    const maxRoomAttempts = this.dungeonSize * 2;
    
    // Generate potential room placements
    for (let i = 0; i < maxRoomAttempts; i++) {
        // Random room size based on difficulty
        const roomWidth = Math.floor(Math.random() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
        const roomHeight = Math.floor(Math.random() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
        
        // Random position with bias toward center
        const distFromCenter = Math.random() * this.dungeonSize * 0.4;
        const angle = Math.random() * Math.PI * 2;
        
        const worldX = center + Math.cos(angle) * distFromCenter - roomWidth/2;
        const worldZ = center + Math.sin(angle) * distFromCenter - roomHeight/2;
        
        // Add to candidates
        candidateRooms.push({
            x: worldX,
            z: worldZ,
            width: roomWidth,
            height: roomHeight,
            size: roomWidth * roomHeight
        });
    }
    
    // Sort room candidates by size (largest first)
    candidateRooms.sort((a, b) => b.size - a.size);
    
    // Take the largest ones first that don't overlap
    const buffer = 3;
    for (const candidate of candidateRooms) {
        // Skip if we have enough rooms
        if (this.rooms.length >= this.numRooms) break;
        
        // Check for overlap
        let overlaps = false;
        for (const room of this.rooms) {
            if (
                candidate.x - buffer < room.x + room.width + buffer &&
                candidate.x + candidate.width + buffer > room.x - buffer &&
                candidate.z - buffer < room.z + room.height + buffer &&
                candidate.z + candidate.width + buffer > room.z - buffer
            ) {
                overlaps = true;
                break;
            }
        }
        
        // Check bounds
        const inBounds = (
            candidate.x >= 0 && 
            candidate.x + candidate.width < this.dungeonSize &&
            candidate.z >= 0 && 
            candidate.z + candidate.height < this.dungeonSize
        );
        
        // Add if valid - using our new method with content placement
        if (!overlaps && inBounds) {
            const room = this.generateRoomWithContent(
                candidate.x, candidate.z, 
                candidate.width, candidate.height
            );
            
            console.log(`Created room ${this.rooms.length}: ${candidate.width}x${candidate.height} at (${candidate.x.toFixed(1)}, ${candidate.z.toFixed(1)})`);
        }
    }
    
    console.log(`Generated ${this.rooms.length} rooms`);
    
    // Create a default room if none were created
    if (this.rooms.length === 0) {
        console.warn("Failed to generate any rooms - creating default room");
        
        const defaultWidth = 8;
        const defaultHeight = 8;
        
        this.generateRoomWithContent(
            center - defaultWidth/2,
            center - defaultHeight/2,
            defaultWidth,
            defaultHeight
        );
    }
}



    /**
 * Connect rooms with corridors using improved pathfinding
 */
connectRooms() {
    console.log("Connecting rooms with optimized corridors");
    
    // No rooms to connect
    if (this.rooms.length <= 1) {
        console.log("No corridors needed (only one room)");
        return;
    }
    
    // Sort rooms by distance to center for more natural layouts
    const center = this.dungeonSize / 2;
    this.rooms.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.centerX - center, 2) + Math.pow(a.centerZ - center, 2));
        const distB = Math.sqrt(Math.pow(b.centerX - center, 2) + Math.pow(b.centerZ - center, 2));
        return distA - distB;
    });
    
    // Connect each room to nearest visible room
    const connectedRooms = [this.rooms[0]]; // Start with first room
    
    // Function to get direct line visibility between room centers
    const hasVisibility = (roomA, roomB) => {
        const steps = 10; // Check multiple points along line
        const dx = (roomB.centerX - roomA.centerX) / steps;
        const dz = (roomB.centerZ - roomA.centerZ) / steps;
        
        for (let i = 1; i < steps; i++) {
            const x = roomA.centerX + dx * i;
            const z = roomA.centerZ + dz * i;
            
            // Convert to grid coords
            const gridX = Math.floor(x * 2);
            const gridZ = Math.floor(z * 2);
            
            // Skip if out of bounds
            if (gridX < 0 || gridX >= this.grid.length || 
                gridZ < 0 || gridZ >= this.grid[0].length) {
                continue;
            }
            
            // If we hit a wall, no visibility
            if (this.grid[gridX][gridZ] === 1) {
                return false;
            }
        }
        return true;
    };
    
    // Connect each remaining room
    for (let i = 1; i < this.rooms.length; i++) {
        const room = this.rooms[i];
        let bestRoom = null;
        let bestDistance = Infinity;
        
        // Find nearest already-connected room with visibility
        for (const connectedRoom of connectedRooms) {
            const dist = Math.sqrt(
                Math.pow(room.centerX - connectedRoom.centerX, 2) +
                Math.pow(room.centerZ - connectedRoom.centerZ, 2)
            );
            
            if (dist < bestDistance && hasVisibility(room, connectedRoom)) {
                bestDistance = dist;
                bestRoom = connectedRoom;
            }
        }
        
        // If no visible room found, just use nearest
        if (!bestRoom) {
            for (const connectedRoom of connectedRooms) {
                const dist = Math.sqrt(
                    Math.pow(room.centerX - connectedRoom.centerX, 2) +
                    Math.pow(room.centerZ - connectedRoom.centerZ, 2)
                );
                
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestRoom = connectedRoom;
                }
            }
        }
        
        if (bestRoom) {
            // Create corridor between rooms
            this.createOptimizedCorridor(room, bestRoom);
            connectedRooms.push(room);
        }
    }
    
    // Add a few extra connections for loops (about 20% of total rooms)
    const extraCorridors = Math.floor(this.rooms.length * 0.2);
    for (let i = 0; i < extraCorridors; i++) {
        // Pick two random rooms
        const roomA = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        const roomB = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        
        // Only connect if not already directly connected and not the same room
        if (roomA !== roomB && !roomA.connections.includes(roomB)) {
            this.createOptimizedCorridor(roomA, roomB);
        }
    }
}

/**
 * Create an optimized corridor between two rooms
 */
createOptimizedCorridor(roomA, roomB) {
    // Record connection
    roomA.connections.push(roomB);
    roomB.connections.push(roomA);
    
    // Decide corridor type based on relative room positions
    const dx = Math.abs(roomA.centerX - roomB.centerX);
    const dz = Math.abs(roomA.centerZ - roomB.centerZ);
    
    // Create straight corridor if rooms are well-aligned
    if (dx < roomA.width/2 || dz < roomA.height/2) {
        this.createStraightCorridor(roomA, roomB);
    } else {
        // Create L-shaped corridor with varying corner position
        const meandering = 0.3; // 30% chance to offset the corner
        
        if (Math.random() < meandering) {
            // Offset the corner for more natural look
            const offset = (Math.random() - 0.5) * Math.min(dx, dz) * 0.5;
            this.createCustomLShapedCorridor(roomA, roomB, offset);
        } else {
            this.createLShapedCorridor(roomA, roomB);
        }
    }
}



/**
 * Create a custom L-shaped corridor between rooms with an offset for meandering
 */
createCustomLShapedCorridor(roomA, roomB, offset) {
    // Convert room centers to grid coordinates
    const startX = Math.floor(roomA.centerX * 2);
    const startZ = Math.floor(roomA.centerZ * 2);
    const endX = Math.floor(roomB.centerX * 2);
    const endZ = Math.floor(roomB.centerZ * 2);
    
    // Corridor width in grid units
    const corridorWidth = this.corridorWidth * 2;
    const halfWidth = Math.floor(corridorWidth / 2);
    
    // Choose corner position with offset for meandering
    let cornerX, cornerZ;
    
    if (Math.random() < 0.5) {
        // Horizontal first, then vertical
        cornerX = endX + Math.floor(offset * 2); // Apply offset to corner
        cornerZ = startZ;
    } else {
        // Vertical first, then horizontal
        cornerX = startX;
        cornerZ = endZ + Math.floor(offset * 2); // Apply offset to corner
    }
    
    // Create first segment
    this.createCorridorSegment(startX, startZ, cornerX, cornerZ, halfWidth);
    
    // Create second segment
    this.createCorridorSegment(cornerX, cornerZ, endX, endZ, halfWidth);
    
    // Add walls around all floor tiles
    this.addCorridorWalls();
}

/**
 * Create a corridor segment between two points
 */
createCorridorSegment(x1, z1, x2, z2, halfWidth) {
    // Determine if corridor is more horizontal or vertical
    const isHorizontal = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    
    if (isHorizontal) {
        // Horizontal corridor segment
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            for (let z = Math.min(z1, z2) - halfWidth; z <= Math.max(z1, z2) + halfWidth; z++) {
                if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                    // Only overwrite empty or wall, don't overwrite floor
                    if (this.grid[x][z] !== 2) {
                        this.grid[x][z] = 2; // Floor
                    }
                }
            }
        }
    } else {
        // Vertical corridor segment
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
            for (let x = Math.min(x1, x2) - halfWidth; x <= Math.max(x1, x2) + halfWidth; x++) {
                if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                    // Only overwrite empty or wall, don't overwrite floor
                    if (this.grid[x][z] !== 2) {
                        this.grid[x][z] = 2; // Floor
                    }
                }
            }
        }
    }
}

    /**
     * Create a corridor between two rooms
     * @param {Object} roomA - First room
     * @param {Object} roomB - Second room
     */
    createCorridor(roomA, roomB) {
        // Record that rooms are connected
        roomA.connections.push(roomB);
        roomB.connections.push(roomA);

        // Create either an L-shaped or straight corridor
        if (Math.random() > 0.5) {
            this.createLShapedCorridor(roomA, roomB);
        } else {
            this.createStraightCorridor(roomA, roomB);
        }
    }

    /**
     * Create an L-shaped corridor between two rooms
     */
    createLShapedCorridor(roomA, roomB) {
        // Grid coordinates
        const startX = Math.floor(roomA.gridX + roomA.gridWidth / 2);
        const startZ = Math.floor(roomA.gridZ + roomA.gridHeight / 2);
        const endX = Math.floor(roomB.gridX + roomB.gridWidth / 2);
        const endZ = Math.floor(roomB.gridZ + roomB.gridHeight / 2);

        // Create horizontal then vertical corridor
        const cornerX = endX;
        const cornerZ = startZ;

        // Corridor width in grid units
        const corridorWidth = this.corridorWidth * 2;
        const halfWidth = Math.floor(corridorWidth / 2);

        // Create horizontal segment
        for (let x = Math.min(startX, cornerX); x <= Math.max(startX, cornerX); x++) {
            for (let z = startZ - halfWidth; z <= startZ + halfWidth; z++) {
                if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                    // Only overwrite empty or wall, don't overwrite floor
                    if (this.grid[x][z] !== 2) {
                        this.grid[x][z] = 2; // Floor
                    }
                }
            }
        }

        // Create vertical segment
        for (let z = Math.min(cornerZ, endZ); z <= Math.max(cornerZ, endZ); z++) {
            for (let x = cornerX - halfWidth; x <= cornerX + halfWidth; x++) {
                if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                    // Only overwrite empty or wall, don't overwrite floor
                    if (this.grid[x][z] !== 2) {
                        this.grid[x][z] = 2; // Floor
                    }
                }
            }
        }

        // Add walls around corridors
        this.addCorridorWalls();
    }

    /**
     * Create a straight corridor between two rooms
     */
    createStraightCorridor(roomA, roomB) {
        // Grid coordinates
        const startX = Math.floor(roomA.gridX + roomA.gridWidth / 2);
        const startZ = Math.floor(roomA.gridZ + roomA.gridHeight / 2);
        const endX = Math.floor(roomB.gridX + roomB.gridWidth / 2);
        const endZ = Math.floor(roomB.gridZ + roomB.gridHeight / 2);

        // Determine if corridor is more horizontal or vertical
        const dx = Math.abs(endX - startX);
        const dz = Math.abs(endZ - startZ);

        // Corridor width in grid units
        const corridorWidth = this.corridorWidth * 2;
        const halfWidth = Math.floor(corridorWidth / 2);

        if (dx > dz) {
            // Horizontal corridor
            for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
                for (let z = Math.min(startZ, endZ) - halfWidth; z <= Math.max(startZ, endZ) + halfWidth; z++) {
                    if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                        // Only overwrite empty or wall, don't overwrite floor
                        if (this.grid[x][z] !== 2) {
                            this.grid[x][z] = 2; // Floor
                        }
                    }
                }
            }
        } else {
            // Vertical corridor
            for (let z = Math.min(startZ, endZ); z <= Math.max(startZ, endZ); z++) {
                for (let x = Math.min(startX, endX) - halfWidth; x <= Math.max(startX, endX) + halfWidth; x++) {
                    if (x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length) {
                        // Only overwrite empty or wall, don't overwrite floor
                        if (this.grid[x][z] !== 2) {
                            this.grid[x][z] = 2; // Floor
                        }
                    }
                }
            }
        }

        // Add walls around corridors
        this.addCorridorWalls();
    }

    /**
     * Add walls around all floor tiles that border empty space
     */
/**
 * Create corridor walls more robustly
 */
addCorridorWalls() {
    // Create a temporary grid copy to avoid modification conflicts
    const floorGrid = [];
    for (let x = 0; x < this.grid.length; x++) {
        floorGrid[x] = [];
        for (let z = 0; z < this.grid[0].length; z++) {
            floorGrid[x][z] = this.grid[x][z] === 2 ? 2 : 0; // Only copy floors
        }
    }
    
    // For every floor cell, add walls around it if there's empty space
    for (let x = 1; x < this.grid.length - 1; x++) {
        for (let z = 1; z < this.grid[0].length - 1; z++) {
            // If this is a floor tile
            if (floorGrid[x][z] === 2) {
                // Check all 8 surrounding tiles
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        // Skip the center tile
                        if (dx === 0 && dz === 0) continue;
                        
                        // If adjacent tile is empty, make it a wall
                        const nx = x + dx;
                        const nz = z + dz;
                        
                        if (nx >= 0 && nx < this.grid.length && 
                            nz >= 0 && nz < this.grid[0].length && 
                            this.grid[nx][nz] === 0) {
                            
                            this.grid[nx][nz] = 1; // Wall
                        }
                    }
                }
            }
        }
    }
    
    // Extra step - make sure there are no isolated walls
    for (let x = 1; x < this.grid.length - 1; x++) {
        for (let z = 1; z < this.grid[0].length - 1; z++) {
            // If this is a wall
            if (this.grid[x][z] === 1) {
                // Count adjacent floors
                let floorCount = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const nx = x + dx;
                        const nz = z + dz;
                        
                        if (nx >= 0 && nx < this.grid.length && 
                            nz >= 0 && nz < this.grid[0].length && 
                            (this.grid[nx][nz] === 2 || this.grid[nx][nz] === 3)) {
                            
                            floorCount++;
                        }
                    }
                }
                
                // If no adjacent floors, remove this wall
                if (floorCount === 0) {
                    this.grid[x][z] = 0;
                }
            }
        }
    }
}

    /**
     * Determine player spawn and exit locations
     */
    // placePlayerAndExit() {
    //     console.log("Determining player spawn and exit locations");

    //     if (this.rooms.length === 0) {
    //         console.error("No rooms to place player or exit");
    //         return;
    //     }

    //     // Sort rooms by distance from center
    //     const sortedRooms = [...this.rooms].sort((a, b) => {
    //         const distA = Math.sqrt(Math.pow(a.centerX, 2) + Math.pow(a.centerZ, 2));
    //         const distB = Math.sqrt(Math.pow(b.centerX, 2) + Math.pow(b.centerZ, 2));
    //         return distA - distB;
    //     });

    //     // Place player in room closest to center
    //     const startRoom = sortedRooms[0];
    //     this.playerSpawnPoint = new THREE.Vector3(
    //         startRoom.centerX,
    //         0, // Will be adjusted by height when teleporting
    //         startRoom.centerZ
    //     );

    //     // Place exit in room farthest from center with a valid path
    //     const endRoom = sortedRooms[sortedRooms.length - 1];
    //     this.exitPoint = new THREE.Vector3(
    //         endRoom.centerX,
    //         0.1, // Slightly above ground level for visibility
    //         endRoom.centerZ
    //     );

    //     console.log(`Player spawn set to (${this.playerSpawnPoint.x.toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)})`);
    //     console.log(`Exit set to (${this.exitPoint.x.toFixed(2)}, ${this.exitPoint.z.toFixed(2)})`);
    // }

    /**
 * Designate a safe starting room and an exit location
 */
placePlayerAndExit() {
  console.log("Determining player spawn (safe room) and exit locations");

  if (this.rooms.length === 0) {
    console.error("No rooms to place player or exit");
    return;
  }

  // Sort rooms by distance from center
  const sortedRooms = [...this.rooms].sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.centerX, 2) + Math.pow(a.centerZ, 2));
    const distB = Math.sqrt(Math.pow(b.centerX, 2) + Math.pow(b.centerZ, 2));
    return distA - distB;
  });

  // Mark the closest room as the safe spawn room
  const startRoom = sortedRooms[0];
  startRoom.isSafeRoom = true;  // Add this flag
  startRoom.hasEnemy = false;   // Ensure no enemies in start room
  startRoom.hasItem = false;    // Also no items (optional, remove if you want items)
  
  // Clear any existing enemies in this room (just in case they were placed earlier)
  this.clearRoomContents(startRoom);

  // Create a more welcoming spawn point
  this.playerSpawnPoint = new THREE.Vector3(
    startRoom.centerX,
    0, // Will be adjusted by height when teleporting
    startRoom.centerZ
  );

  // Place exit in room farthest from center with a valid path
  const endRoom = sortedRooms[sortedRooms.length - 1];
  this.exitPoint = new THREE.Vector3(
    endRoom.centerX,
    0.1, // Slightly above ground level for visibility
    endRoom.centerZ
  );

  console.log(`Safe spawn room set at (${this.playerSpawnPoint.x.toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)})`);
  console.log(`Exit set to (${this.exitPoint.x.toFixed(2)}, ${this.exitPoint.z.toFixed(2)})`);
}

/**
 * Clear any existing content from a room (typically the safe room)
 */
clearRoomContents(room) {
  // Remove any enemies or items already placed in this room
  const elementsToRemove = [];
  
  this.dungeonElements.forEach(element => {
    if (element.userData && element.userData.roomId === room.id) {
      if (element.userData.isEnemyMarker || element.userData.isItem) {
        elementsToRemove.push(element);
      }
    }
  });
  
  // Remove them from the scene and dungeonElements array
  elementsToRemove.forEach(element => {
    this.scene3D.scene.remove(element);
    const index = this.dungeonElements.indexOf(element);
    if (index !== -1) {
      this.dungeonElements.splice(index, 1);
    }
  });
  
  // Also remove from enemySpawnPoints if needed
  this.enemySpawnPoints = this.enemySpawnPoints.filter(point => point.roomId !== room.id);
  
  console.log(`Cleared ${elementsToRemove.length} objects from safe room`);
}


    buildDungeon3D() {
        console.log("Building 3D dungeon meshes with improved debugging");
      
        // Create floor material
        const floorMaterial = new THREE.MeshStandardMaterial({
          map: this.floorTextures[0],
          roughness: 0.8,
          side: THREE.DoubleSide
        });
      
        // Create wall material
        const wallMaterial = new THREE.MeshStandardMaterial({
          map: this.wallTextures[0],
          roughness: 0.6,
          side: THREE.DoubleSide
        });

        // const wallMaterial = this.createMaterial('wall');
      
        // Inspect wall material to debug texture issues
        console.log("Wall material:", {
          hasTexture: !!wallMaterial.map,
          transparent: wallMaterial.transparent,
          opacity: wallMaterial.opacity,
          visible: wallMaterial.visible
        });
      
        // First create the large unified floor
        this.createLargeFloor();
      
        // Create optimized walls
        console.log("Attempting to create optimized walls...");
        this.wallBlocks = this.createOptimizedWalls(wallMaterial);
      
        // If no walls were created with the optimizer, fall back to grid-based walls
        if (!this.wallBlocks || this.wallBlocks.length === 0) {
          console.warn("Wall optimization failed, falling back to grid-based walls");
          this.createGridBasedWalls(wallMaterial);
        }
      
        // Display dungeon stats
        console.log("Dungeon stats:", {
          size: this.dungeonSize,
          roomCount: this.rooms.length,
          gridSize: this.grid.length,
          wallCount: this.wallBlocks ? this.wallBlocks.length : "unknown",
          playerPosition: this.playerSpawnPoint ? 
            `(${this.playerSpawnPoint.x.toFixed(2)}, ${this.playerSpawnPoint.y.toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)})` : 
            "unknown"
        });
      
        // Add exit marker
        this.createExitMarker();
      
        // Add lighting
        this.createDungeonLighting();
      
        // Add debug visualizers to help locate elements
        this.createDebugVisualizers();
      
        // Add enemies and props
        this.rooms.forEach(room => {
          if (room.width >= 4 && room.height >= 4) {
            // Add an enemy to each larger room
            this.placeEnemyAt(room, room.centerX, room.centerZ);
          }
        });
      
        console.log("Dungeon 3D build complete");
      }
      
// Modified createOptimizedWalls to use colored materials as fallback
createOptimizedWalls(inputMaterial) {
    console.log("Creating optimized wall blocks");
    
    // Create a fallback material that doesn't rely on textures
    const fallbackMaterial = new THREE.MeshStandardMaterial({
      color: 0x8866aa, // Purple color - very visible
      emissive: 0x441144, // Add emissive light to ensure visibility
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
  
    const wallMaterial = this.createMaterial('wall');

    // The size of the grid
    const gridSize = this.grid.length;
    
    // Create a visited grid to track which cells we've processed
    const visited = Array(gridSize).fill().map(() => Array(gridSize).fill(false));
    
    // Track created wall blocks
    const wallBlocks = [];
    
    // Look for rectangular blocks of walls
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Skip if not a wall or already visited
        if (this.grid[x][z] !== 1 || visited[x][z]) continue;
        
        // Found the start of a potential wall block - try to expand it
        let width = 1;
        let depth = 1;
        
        // Expand width (along X axis) as far as possible
        while (x + width < gridSize && this.grid[x + width][z] === 1 && !visited[x + width][z]) {
          width++;
        }
        
        // Expand depth (along Z axis) as far as possible
        let canExpandDepth = true;
        while (canExpandDepth && z + depth < gridSize) {
          // Check if the entire next row is walls and not visited
          for (let dx = 0; dx < width; dx++) {
            if (this.grid[x + dx][z + depth] !== 1 || visited[x + dx][z + depth]) {
              canExpandDepth = false;
              break;
            }
          }
          if (canExpandDepth) depth++;
        }
        
        // Mark all cells in this block as visited
        for (let dx = 0; dx < width; dx++) {
          for (let dz = 0; dz < depth; dz++) {
            visited[x + dx][z + dz] = true;
          }
        }
        
        // Create the wall block
        const worldX = x / 2 - this.dungeonSize / 2;  // Convert to world coordinates
        const worldZ = z / 2 - this.dungeonSize / 2;  // Convert to world coordinates
        
        const blockWidth = width / 2;  // Convert grid units to world units
        const blockDepth = depth / 2;  // Convert grid units to world units
        
        const wallGeometry = new THREE.BoxGeometry(blockWidth, this.wallHeight, blockDepth);
        
        // Try the texture material first, but fall back to the colored material if needed
        let material;
        try {
          material = wallMaterial.clone();
          // If texture is missing or transparent, use fallback
          if (!material.map || material.transparent) {
            material = fallbackMaterial;
          }
        } catch (e) {
          console.warn("Error with wall material, using fallback:", e);
          material = fallbackMaterial;
        }
        
        const wall = new THREE.Mesh(wallGeometry, material);
        
        // Position wall at center of block
        wall.position.set(
          worldX + blockWidth / 2,
          this.wallHeight / 2,  // Half the wall height
          worldZ + blockDepth / 2
        );
        
        console.log(`Created wall block at (${wall.position.x.toFixed(2)}, ${wall.position.y.toFixed(2)}, ${wall.position.z.toFixed(2)}) with size ${blockWidth.toFixed(2)}x${this.wallHeight}x${blockDepth.toFixed(2)}`);
        
        // Add to scene
        wall.userData = {
          isDungeonElement: true,
          isWall: true,
          isWallBlock: true
        };
        
        this.scene3D.scene.add(wall);
        this.dungeonElements.push(wall);
        
        wallBlocks.push({
          startX: x,
          startZ: z,
          width: width,
          depth: depth,
          worldX: worldX,
          worldZ: worldZ,
          mesh: wall
        });
      }
    }
    
    console.log(`Created ${wallBlocks.length} optimized wall blocks instead of individual grid cells`);
    return wallBlocks;
  }
  
  // Modified createGridBasedWalls to use colored materials as fallback
  createGridBasedWalls(inputMaterial) {
    console.log("Creating grid-based walls as fallback");
    
    // Create a fallback material that doesn't rely on textures
    const fallbackMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5500, // Bright orange - very visible
      emissive: 0x551100, // Add emissive light to ensure visibility
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    
    const gridSize = this.grid.length;
    let wallCount = 0;
    
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Skip non-wall cells
        if (this.grid[x][z] !== 1) continue;
        
        // Convert grid coordinates to world coordinates
        const worldX = (x / 2) - (this.dungeonSize / 2);
        const worldZ = (z / 2) - (this.dungeonSize / 2);
        
        // Always create a wall for debugging (remove the adjacency check)
        const wallGeometry = new THREE.BoxGeometry(this.cellSize / 2, this.wallHeight, this.cellSize / 2);
        
        // Try texture material first, fallback to colored
        let material;
        try {
          material = wallMaterial.clone();
          if (!material.map || material.transparent) {
            material = fallbackMaterial;
          }
        } catch (e) {
          material = fallbackMaterial;
        }
        
        const wall = new THREE.Mesh(wallGeometry, material);
        
        // Position at floor level, half height up
        wall.position.set(
          worldX + (this.cellSize / 4), 
          this.wallHeight / 2, 
          worldZ + (this.cellSize / 4)
        );
        
        // Add to scene with metadata
        wall.userData = {
          isDungeonElement: true,
          isWall: true
        };
        
        this.scene3D.scene.add(wall);
        this.dungeonElements.push(wall);
        wallCount++;
      }
    }
    
    console.log(`Created ${wallCount} individual wall segments`);
  }
  
  // Add this new debug visualization method
  createDebugVisualizers() {
    console.log("Creating debug visualizers to help locate dungeon elements");
    
    // Add tall sight poles at room centers
    this.rooms.forEach((room, index) => {
      // Create a tall pole at each room center
      const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
      const poleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, // Green for room centers
        transparent: true,
        opacity: 0.7
      });
      
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(room.centerX, 5, room.centerZ); // Position above room center
      
      this.scene3D.scene.add(pole);
      this.dungeonElements.push(pole);
      
      // Replace TextGeometry with a simple sprite for room label
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 128;
      
      // Draw text on canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '48px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Room ${index}`, canvas.width/2, canvas.height/2);
      
      // Create sprite from canvas
      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({ map: texture });
      const label = new THREE.Sprite(labelMaterial);
      label.position.set(room.centerX, 6, room.centerZ);
      label.scale.set(2, 1, 1);
      
      this.scene3D.scene.add(label);
      this.dungeonElements.push(label);
      
      console.log(`Added debug visualizer for room ${index} at (${room.centerX.toFixed(2)}, ${room.centerZ.toFixed(2)})`);
    });
    
    // Add debug visualizer at spawn point
    if (this.playerSpawnPoint) {
      const spawnGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const spawnMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, // Red for spawn point
        transparent: true,
        opacity: 0.7
      });
      
      const spawnMarker = new THREE.Mesh(spawnGeometry, spawnMaterial);
      spawnMarker.position.set(
        this.playerSpawnPoint.x,
        1, // Just above ground
        this.playerSpawnPoint.z
      );
      
      this.scene3D.scene.add(spawnMarker);
      this.dungeonElements.push(spawnMarker);
      
      console.log(`Added debug visualizer for spawn point at (${this.playerSpawnPoint.x.toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)})`);
    }
    
    // Create a floor grid to help visualize the coordinate system
    const gridHelper = new THREE.GridHelper(this.dungeonSize, this.dungeonSize, 0xffffff, 0x888888);
    gridHelper.position.y = 0.02; // Slightly above floor to avoid z-fighting
    
    this.scene3D.scene.add(gridHelper);
    this.dungeonElements.push(gridHelper);
  }

    /**
     * Teleport player to the dungeon starting point
     * @returns {boolean} Whether teleport was successful
     */
    // teleportPlayerToDungeon() {
    //     if (!this.playerSpawnPoint) {
    //       console.error("No player spawn point defined");
    //       return false;
    //     }
        
    //     // Get the exact player height from physics
    //     const playerHeight = this.physics?.playerHeight || 1.7;
        
    //     // Tell Scene3DController to skip its lighting
    //     if (this.scene3D) {
    //       this.scene3D._skipDungeonLighting = true;
    //     }
        
    //     // Get elevation at spawn point
    //     const { elevation } = this.getElevationAtPoint(
    //       this.playerSpawnPoint.x,
    //       this.playerSpawnPoint.z
    //     );
        
    //     // Set player position to spawn point with correct height
    //     this.scene3D.camera.position.set(
    //       this.playerSpawnPoint.x,
    //       elevation + playerHeight,  // Position at correct elevation plus eye height
    //       this.playerSpawnPoint.z
    //     );
        
    //     // Reset physics state to avoid falling or clipping
    //     if (this.scene3D.physics) {
    //       this.scene3D.physics.currentGroundHeight = elevation;
    //       this.scene3D.physics.isJumping = false;
    //       this.scene3D.physics.isFalling = false;
          
    //       // Ensure good collision detection
    //       this.scene3D.physics.update(0.1);
    //     }
        
    //     console.log(`Player teleported to (${this.playerSpawnPoint.x.toFixed(2)}, ${(elevation + playerHeight).toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)}) with ground at ${elevation.toFixed(2)}`);
    //     return true;
    //   }

    /**
 * Teleport player to the dungeon starting point with improved spawn logic
 */
teleportPlayerToDungeon() {
  if (!this.playerSpawnPoint) {
    console.error("No player spawn point defined");
    return false;
  }
  
  // Get the exact player height from physics
  const playerHeight = this.physics?.playerHeight || 1.7;
  
  // Tell Scene3DController to skip its lighting
  if (this.scene3D) {
    this.scene3D._skipDungeonLighting = true;
  }
  
  // Get elevation at spawn point
  const { elevation } = this.getElevationAtPoint(
    this.playerSpawnPoint.x,
    this.playerSpawnPoint.z
  );
  
  // Set player position to spawn point with correct height
  this.scene3D.camera.position.set(
    this.playerSpawnPoint.x,
    elevation + playerHeight,  // Position at correct elevation plus eye height
    this.playerSpawnPoint.z
  );
  
  // Reset player look direction to face into the dungeon
  this.scene3D.camera.lookAt(
    this.playerSpawnPoint.x, 
    elevation + playerHeight,
    this.playerSpawnPoint.z - 1 // Look slightly forward
  );
  
  // Reset physics state to avoid falling or clipping
  if (this.scene3D.physics) {
    this.scene3D.physics.currentGroundHeight = elevation;
    this.scene3D.physics.isJumping = false;
    this.scene3D.physics.isFalling = false;
    
    // Ensure good collision detection
    this.scene3D.physics.update(0.1);
  }
  
  // Set up atmospheric effects for the dungeon
  this.setupDungeonAtmosphere();
  
  console.log(`Player teleported to safe room at (${this.playerSpawnPoint.x.toFixed(2)}, ${(elevation + playerHeight).toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)}) with ground at ${elevation.toFixed(2)}`);
  return true;
}

/**
 * Set up atmospheric lighting and effects for the dungeon
 */
setupDungeonAtmosphere() {
  console.log("Setting up dungeon atmosphere");
  
  // Check if we have access to the ShaderEffectsManager
  const hasShaderEffects = this.scene3D && this.scene3D.shaderEffectsManager;
  
  // Reduce ambient lighting to create a darker mood
  this.adjustDungeonLighting();
  
  // Add torch effects at key locations
  this.addTorchesToDungeon();
  
  // Add atmospheric particles if ShaderEffectsManager is available
  if (hasShaderEffects) {
    this.addAtmosphericEffects();
  }
}

/**
 * Adjust the dungeon lighting to be darker and more atmospheric
 */
adjustDungeonLighting() {
  // Reduce ambient light intensity
  this.dungeonElements.forEach(element => {
    if (element instanceof THREE.AmbientLight) {
      element.intensity = 0.2; // Reduced from 0.5 to create a darker atmosphere
    }
  });
  
  // Add a slight fog effect
  this.scene3D.scene.fog = new THREE.FogExp2(0x000000, 0.025);
}

/**
 * Add torch lighting to the dungeon to create atmosphere
 */
addTorchesToDungeon() {
  console.log("Adding atmospheric torch lighting to dungeon");
  
  // Add torch in each room corner for better lighting
  this.rooms.forEach(room => {
    // Skip the safe room - it will have its own lighting
    if (room.isSafeRoom) return;
    
    // Add torches in each corner of larger rooms
    if (room.width >= 4 && room.height >= 4) {
      // Calculate corner positions
      const corners = [
        { x: room.x + 1, z: room.z + 1 },  // Top-left
        { x: room.x + room.width - 1, z: room.z + 1 },  // Top-right
        { x: room.x + 1, z: room.z + room.height - 1 },  // Bottom-left
        { x: room.x + room.width - 1, z: room.z + room.height - 1 }  // Bottom-right
      ];
      
      // Add a torch in each corner (with some randomness)
      corners.forEach(corner => {
        if (Math.random() < 0.7) {  // 70% chance for each corner
          this.createTorchLight(corner.x, corner.z);
        }
      });
    }
  });
  
  // Add special lighting to the safe room
  const safeRoom = this.rooms.find(room => room.isSafeRoom);
  if (safeRoom) {
    // Create a welcoming, brighter light in the safe room
    const safeLight = new THREE.PointLight(0xffcc88, 1.5, 10);
    safeLight.position.set(safeRoom.centerX, 2, safeRoom.centerZ);
    safeLight.userData = { isDungeonElement: true };
    this.scene3D.scene.add(safeLight);
    this.dungeonElements.push(safeLight);
  }
}

/**
 * Add atmospheric effects using ShaderEffectsManager
 */
addAtmosphericEffects() {
  // Only continue if ShaderEffectsManager is available
  if (!this.scene3D.shaderEffectsManager) return;
  
  const shaderManager = this.scene3D.shaderEffectsManager;
  
  // Add dust particles in larger rooms
  this.rooms.forEach(room => {
    if (room.width * room.height > 25) {  // Only in larger rooms
      const position = {
        x: room.centerX,
        y: 1.5,
        z: room.centerZ
      };
      
      // Create dust effect
      shaderManager.createDustEffect(position, {
        count: 20,
        color: 0xaaaaaa,
        size: 0.03,
        lifetime: 5
      });
    }
  });
  
  // If the safe room has been marked
  const safeRoom = this.rooms.find(room => room.isSafeRoom);
  if (safeRoom) {
    // Add a landing effect when the player teleports in
    const landingPosition = {
      x: this.playerSpawnPoint.x,
      y: 0.1,
      z: this.playerSpawnPoint.z
    };
    
    shaderManager.createLandingEffect(landingPosition, 1.2);
  }
}

    /**
 * Create the exit marker for the dungeon
 */
    createExitMarker() {
        if (!this.exitPoint) return;

        // Create a glowing cylinder as the exit marker
        const exitGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const exitMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });

        const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
        exitMarker.position.set(this.exitPoint.x, 0.05, this.exitPoint.z);
        exitMarker.userData = {
            isDungeonElement: true,
            isExitMarker: true,
            isInteractive: true,
            interactionType: 'exit'
        };

        this.scene3D.scene.add(exitMarker);
        this.dungeonElements.push(exitMarker);

        // Add a point light to make it glow
        const exitLight = new THREE.PointLight(0xff0000, 1, 5);
        exitLight.position.set(this.exitPoint.x, 0.5, this.exitPoint.z);
        exitLight.userData = { isDungeonElement: true };
        this.scene3D.scene.add(exitLight);
        this.dungeonElements.push(exitLight);
    }


    /**
     * Create lighting for the dungeon
     */
createDungeonLighting() {
    console.log("Creating dungeon lighting");
    
    // Skip Scene3DController's lighting
    if (this.scene3D) {
        this.scene3D._skipDungeonLighting = true;
    }
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
    ambientLight.userData = { 
        isDungeonElement: true,
        isDungeonLighting: true 
    };
    this.scene3D.scene.add(ambientLight);
    this.dungeonElements.push(ambientLight);
    
    // Add torch lights throughout the dungeon
    const maxLights = Math.min(20, this.rooms.length * 2);
    let lightsPlaced = 0;
    
    // Add a light to each room
    for (const room of this.rooms) {
        if (lightsPlaced >= maxLights) break;
        
        // Add a torch in the center of the room
        this.createTorchLight(room.centerX, room.centerZ);
        lightsPlaced++;
    }
}

createOptimizedLighting() {
    console.log("Creating optimized dungeon lighting");
    
    // Skip Scene3DController's lighting
    if (this.scene3D) {
      this.scene3D._skipDungeonLighting = true;
    }
    
    // Add ambient light - much more efficient than many point lights
    const ambientLight = new THREE.AmbientLight(0x444444, 0.7);
    ambientLight.userData = { 
      isDungeonElement: true,
      isDungeonLighting: true 
    };
    this.scene3D.scene.add(ambientLight);
    this.dungeonElements.push(ambientLight);
    
    // Add a few strategic lights instead of many small ones
    // Place lights only in the largest rooms or critical locations
    const maxLights = Math.min(5, this.rooms.length); 
    
    // Sort rooms by size and only light the largest ones
    const largestRooms = [...this.rooms].sort((a, b) => 
      (b.width * b.height) - (a.width * a.height)
    ).slice(0, maxLights);
    
    largestRooms.forEach(room => {
      this.createTorchLight(room.centerX, room.centerZ);
    });
  }

    /**
     * Create a torch light at the specified location
     */
    createTorchLight(x, z) {
        // Color variations for torches
        const colors = [0xffcc88, 0xff8866, 0xffaa66];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Create a point light
        const light = new THREE.PointLight(color, 1, 10, 2);
        light.position.set(x, this.wallHeight - 1, z);
        light.userData = { isDungeonElement: true };
        this.scene3D.scene.add(light);
        this.dungeonElements.push(light);

        // Try to get the torch from resource manager
        let torchTexture = null;
        try {
            if (this.resourceManager.resources &&
                this.resourceManager.resources.textures &&
                this.resourceManager.resources.textures.props) {

                // Find a torch texture
                const propsTextures = this.resourceManager.resources.textures.props;
                for (const id in propsTextures) {
                    const texture = propsTextures[id];
                    if (texture.name.toLowerCase().includes('torch')) {
                        torchTexture = this.resourceManager.getTexture(texture.name, 'props');
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn("Error loading torch texture:", e);
        }

        // Create torch mesh if texture found
        if (torchTexture) {
            const torchGeometry = new THREE.PlaneGeometry(1, 1);
            const torchMaterial = new THREE.MeshBasicMaterial({
                map: torchTexture,
                transparent: true,
                side: THREE.DoubleSide
            });

            const torch = new THREE.Mesh(torchGeometry, torchMaterial);
            torch.position.set(x, this.wallHeight - 1, z);

            // Rotate to face center
            const center = new THREE.Vector3(0, 0, 0);
            torch.lookAt(center);

            torch.userData = {
                isDungeonElement: true,
                isProp: true,
                name: "Torch"
            };

            this.scene3D.scene.add(torch);
            this.dungeonElements.push(torch);
        }
    }

/**
 * Generate room with grid-based content placement
 * @param {number} worldX - Room's X position in world coordinates
 * @param {number} worldZ - Room's Z position in world coordinates
 * @param {number} roomWidth - Width of room in world units
 * @param {number} roomHeight - Height of room in world units
 */
generateRoomWithContent(worldX, worldZ, roomWidth, roomHeight) {
    // Apply the same coordinate transformation for consistency with the floor/walls
    const adjustedX = worldX - this.dungeonSize / 2;
    const adjustedZ = worldZ - this.dungeonSize / 2;
    
    // Create the room object with correct coordinates
    const room = {
      id: Date.now() + Math.floor(Math.random() * 1000), // Unique ID
      x: adjustedX,  // Using the adjusted coordinates
      z: adjustedZ,  // Using the adjusted coordinates
      width: roomWidth,
      height: roomHeight,
      gridX: Math.floor(worldX * 2),  // Keep grid coordinates for dungeon generation
      gridZ: Math.floor(worldZ * 2),  // Keep grid coordinates for dungeon generation
      gridWidth: Math.floor(roomWidth * 2),
      gridHeight: Math.floor(roomHeight * 2),
      centerX: adjustedX + roomWidth/2,  // Center uses adjusted coordinates
      centerZ: adjustedZ + roomHeight/2,  // Center uses adjusted coordinates
      connections: [],
      hasEnemy: false,
      hasItem: false
    };
    
    this.rooms.push(room);
    
    // Mark room in grid (using original grid coordinates)
    for (let rx = 0; rx < room.gridWidth; rx++) {
      for (let rz = 0; rz < room.gridHeight; rz++) {
        const gridX = room.gridX + rx;
        const gridZ = room.gridZ + rz;
        
        if (gridX >= 0 && gridX < this.grid.length &&
            gridZ >= 0 && gridZ < this.grid[0].length) {
          
          // Inside is floor
          this.grid[gridX][gridZ] = 2;
          
          // Edges are walls
          if (rx === 0 || rx === room.gridWidth - 1 || 
              rz === 0 || rz === room.gridHeight - 1) {
            this.grid[gridX][gridZ] = 1;
          }
        }
      }
    }
    
// Calculate content placement density based on room size
const roomSize = roomWidth * roomHeight;
const contentDensity = Math.min(0.2, 5 / roomSize); // Larger rooms get more sparse content

// Add content to the room using adjusted coordinates
const numContentSpots = Math.max(1, Math.floor(roomSize * contentDensity));

// Always ensure at least one enemy OR one item per room, UNLESS it's a safe room
const hasLargeRoom = roomWidth >= 5 && roomHeight >= 5;

// Only place enemies if this isn't marked as a safe room
if (!room.isSafeRoom) {
  // Place enemy in center of room if it's large enough
  if (hasLargeRoom && Math.random() < 0.7) {
    this.placeEnemyAt(room, room.centerX, room.centerZ);
    room.hasEnemy = true;
  }
  
  // Add additional content spots with adjusted coordinates
  for (let i = 0; i < numContentSpots; i++) {
    // Calculate a position within the room (avoiding edges)
    const padding = 1.0;
    const contentX = adjustedX + padding + Math.random() * (roomWidth - padding * 2);
    const contentZ = adjustedZ + padding + Math.random() * (roomHeight - padding * 2);
    
    // Decide what to place
    if (!room.hasEnemy && Math.random() < 0.6) {
      this.placeEnemyAt(room, contentX, contentZ);
      room.hasEnemy = true;
    } else if (!room.hasItem && Math.random() < 0.4) {
      this.placeItemAt(room, contentX, contentZ);
      room.hasItem = true;
    }
  }
}
    
    console.log(`Created room at (${adjustedX.toFixed(2)}, ${adjustedZ.toFixed(2)}) with size ${roomWidth.toFixed(2)}x${roomHeight.toFixed(2)}`);
    return room;
  }

/**
 * Place a room event (enemy or item) at the specified location
 * @param {Object} room - The room object
 * @param {number} x - X coordinate in world units
 * @param {number} z - Z coordinate in world units
 * @param {string} [forcedType] - Optional type to force ('enemy' or 'item')
 */
placeRoomEvent(room, x, z, forcedType = null) {
    // Determine what to place
    let eventType = forcedType;
    
    // If no forced type, decide randomly based on what's already in the room
    if (!eventType) {
        if (!room.hasEnemy && !room.hasItem) {
            // Room has nothing yet, 70% chance for enemy, 30% for item
            eventType = Math.random() < 0.7 ? 'enemy' : 'item';
        } else if (!room.hasEnemy) {
            // Room already has an item, place an enemy
            eventType = 'enemy';
        } else if (!room.hasItem) {
            // Room already has an enemy, place an item
            eventType = 'item';
        } else {
            // Room already has both, don't place anything
            return;
        }
    }
    
    // Place the event
    if (eventType === 'enemy' && !room.hasEnemy) {
        this.placeEnemyAt(room, x, z);
        room.hasEnemy = true;
    } else if (eventType === 'item' && !room.hasItem) {
        this.placeItemAt(room, x, z);
        room.hasItem = true;
    }
}

/**
 * Place an enemy at specific coordinates
 */
placeEnemyAt(room, x, z) {
    // Enemy types based on difficulty
    const enemyTypes = {
        easy: ['goblin', 'skeleton', 'rat'],
        medium: ['orc', 'zombie', 'wolf'],
        hard: ['troll', 'demon', 'wraith'],
        epic: ['dragon', 'lich', 'elder_demon']
      };
      
      const availableEnemies = enemyTypes[this.difficultyLevel] || enemyTypes.medium;
      const enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
      
      // Log placement information for debugging
      console.log(`Placing ${enemyType} in room at world coords (${x.toFixed(2)}, ${z.toFixed(2)})`);
      
      // Get elevation at this point
      const { elevation } = this.getElevationAtPoint(x, z);
      
      // Create marker for enemy
      const enemyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
      
    
    // Color based on enemy type
    let color;
    switch (enemyType) {
      case 'goblin':
      case 'rat':
        color = 0x00ff00; // Green for easy enemies
        break;
      case 'skeleton':
      case 'zombie':
      case 'wolf':
        color = 0xffff00; // Yellow for medium enemies
        break;
      case 'orc':
      case 'troll':
      case 'wraith':
        color = 0xff8800; // Orange for hard enemies
        break;
      case 'demon':
      case 'lich':
      case 'dragon':
      case 'elder_demon':
        color = 0xff0000; // Red for epic enemies
        break;
      default:
        color = 0xcccccc; // Gray for unknown
    }
    
    const enemyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9
    });
    
    const enemyMarker = new THREE.Mesh(enemyGeometry, enemyMaterial);
  
    // Set position with correct elevation
    enemyMarker.position.set(x, elevation + 0.15, z);
    
    enemyMarker.userData = {
      isDungeonElement: true,
      isEnemyMarker: true,
      enemyType: enemyType,
      difficulty: this.difficultyLevel,
      roomId: room.id
    };
    
    this.scene3D.scene.add(enemyMarker);
    this.dungeonElements.push(enemyMarker);
    this.enemySpawnPoints.push({ 
      x, 
      z, 
      y: elevation, // Store elevation for physics
      type: enemyType,
      roomId: room.id // Store room association 
    });
    
    console.log(`Placed ${enemyType} at world coords (${x.toFixed(2)}, ${z.toFixed(2)}) at elevation ${elevation.toFixed(2)}`);
    
    return enemyMarker;
  }

/**
 * Place an item at specific coordinates
 */

placeItemAt(room, x, z) {
    // Item types
    const itemTypes = [
        { name: 'chest', color: 0xffcc00 },
        { name: 'torch', color: 0xff6600 },
        { name: 'potion', color: 0xff00ff },
        { name: 'key', color: 0xdddddd }
    ];
    
    const item = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    
    // Try to get texture from resource manager
    let itemTexture = null;
    try {
        if (this.resourceManager.resources && 
            this.resourceManager.resources.textures && 
            this.resourceManager.resources.textures.props) {
            
            const propsTextures = this.resourceManager.resources.textures.props;
            for (const id in propsTextures) {
                const texture = propsTextures[id];
                if (texture.name.toLowerCase().includes(item.name)) {
                    itemTexture = this.resourceManager.getTexture(texture.name, 'props');
                    break;
                }
            }
        }
    } catch (e) {
        console.warn("Error loading item texture:", e);
    }
    
    // Get elevation at this point for proper placement
    const { elevation } = this.getElevationAtPoint(x, z);
    
    // Create marker
    let itemMarker;
    
    if (itemTexture) {
        // If we have a texture, use a textured plane
        const itemGeometry = new THREE.PlaneGeometry(1, 1);
        const itemMaterial = new THREE.MeshBasicMaterial({
            map: itemTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        itemMarker = new THREE.Mesh(itemGeometry, itemMaterial);
        itemMarker.position.set(x, elevation + 0.5, z); // Position at correct elevation
        itemMarker.rotation.x = -Math.PI / 2; // Horizontal
    } else {
        // Otherwise use a colored marker
        const itemGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
        const itemMaterial = new THREE.MeshStandardMaterial({
            color: item.color,
            emissive: item.color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });
        
        itemMarker = new THREE.Mesh(itemGeometry, itemMaterial);
        itemMarker.position.set(x, elevation + 0.1, z); // Position at correct elevation
    }
    
    itemMarker.userData = {
        isDungeonElement: true,
        isItem: true,
        itemType: item.name,
        roomId: room.id
    };
    
    this.scene3D.scene.add(itemMarker);
    this.dungeonElements.push(itemMarker);
    
    console.log(`Placed ${item.name} at (${x.toFixed(2)}, ${z.toFixed(2)}) in room at elevation ${elevation.toFixed(2)}`);
}

getElevationAtPoint(x, z) {
    let elevation = 0;
    let isInside = false;
    
    // Check grid to determine elevation at this point
    const gridX = Math.round(x * 2);
    const gridZ = Math.round(z * 2);
    
    // Make sure coordinates are within grid bounds
    if (gridX >= 0 && gridX < this.grid.length && 
        gridZ >= 0 && gridZ < this.grid[0].length) {
      
      // Check if we're in a raised area
      if (this.grid[gridX][gridZ] === 2) { // Regular floor
        elevation = 0;
      } else if (this.grid[gridX][gridZ] === 1) { // Wall
        // Check if we're inside or on top of a wall
        if (this.physics && this.physics.insideRoomWall) {
          isInside = true;
        } else if (this.physics && this.physics.onTopOfWall) {
          elevation = this.wallHeight;
        }
      }
    }
    
    return { 
      elevation, 
      isInside 
    };
  }



}

// Make it globally available
window.DungeonGenerator = DungeonGenerator;