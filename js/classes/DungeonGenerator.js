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
      
      // Initialize seed system
      this.seed = Date.now(); // Default seed
      this.initialSeed = this.seed;
      
      // Track monster tokens
      this.monsterTokens = [];
      this.animatedTokens = [];
  }



    /**
 * Connect to the resource manager to access bestiary data
 * @param {ResourceManager} resourceManager - The resource manager instance
 * @returns {boolean} Success status
 */
connectToResourceManager(resourceManager) {
  if (!resourceManager) {
    console.error("DungeonGenerator - Invalid ResourceManager provided");
    return false;
  }

  this.resourceManager = resourceManager;
  console.log("DungeonGenerator is Connected to ResourceManager");
  
  // Check if the bestiary is available
  if (this.resourceManager.resources?.bestiary) {
    const monsterCount = this.resourceManager.resources.bestiary.size || 0;
    console.log(`Found ${monsterCount} monsters in bestiary`);
  } else {
    console.warn("Connected to ResourceManager but no bestiary found");
  }
  
  return true;
}



/**
 * Initialize the seed generator for deterministic random generation
 * @param {number|string|Array|Object} seed - Seed value or source
 */
initializeSeed(seed) {
  let finalSeed;

  if (!seed) {
    // Default to current time
    finalSeed = Date.now();
    console.log(`Using default time-based seed: ${finalSeed}`);
  } else if (Array.isArray(seed)) {
    // Using array of values (like party stats)
    finalSeed = this.combineSeedValues(seed);
    console.log(`Using combined seed from array: ${finalSeed}`);
  } else if (typeof seed === 'string') {
    // Convert string to number seed
    finalSeed = this.hashString(seed);
    console.log(`Using string seed "${seed}" hashed to: ${finalSeed}`);
  } else if (typeof seed === 'object') {
    // Convert object to seed - this is what we need to fix
    try {
      // If it's party data, extract values from it
      if (seed.members && Array.isArray(seed.members)) {
        finalSeed = this.generateSeedFromParty(seed);
        console.log(`Generated seed ${finalSeed} from party with ${seed.members.length} members`);
      } else {
        // Try to stringify and hash the object
        const objString = JSON.stringify(seed);
        finalSeed = this.hashString(objString);
        console.log(`Converted object seed to: ${finalSeed}`);
      }
    } catch (e) {
      console.error("Error processing object seed:", e);
      finalSeed = Date.now();
      console.log(`Falling back to time-based seed: ${finalSeed}`);
    }
  } else {
    // Assume it's already a number
    finalSeed = Number(seed);
    if (isNaN(finalSeed)) {
      finalSeed = Date.now();
      console.log(`Invalid seed, using time-based seed: ${finalSeed}`);
    } else {
      console.log(`Using numeric seed: ${finalSeed}`);
    }
  }

  // Store seed for reference
  this.seed = finalSeed;
  this.initialSeed = finalSeed;
  
  // Initialize the random state
  this.resetSeed();
  
  console.log(`Dungeon seed initialized: ${this.seed}`);
  return this.seed;
}

/**
 * Reset the seed to its initial value
 */
resetSeed() {
  this.seed = this.initialSeed || Date.now();
}

/**
 * Generate a deterministic random number based on the seed
 * Uses a simple but effective LCG (Linear Congruential Generator)
 * @returns {number} Random number between 0 and 1
 */
seededRandom() {
  // Constants for the LCG algorithm
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  // Update the seed
  this.seed = (a * this.seed + c) % m;
  
  // Return a value between 0 and 1
  return this.seed / m;
}

/**
 * Hash a string to a numeric seed value
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Combine multiple values into a single seed
 * @param {Array} values - Array of values to combine
 * @returns {number} Combined seed value
 */
combineSeedValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return Date.now();
  }
  
  // Convert all values to numbers and combine
  let seed = 0;
  values.forEach((value, index) => {
    let numValue = 0;
    
    if (typeof value === 'number') {
      numValue = value;
    } else if (typeof value === 'string') {
      numValue = this.hashString(value);
    } else {
      numValue = this.hashString(String(value));
    }
    
    // Different weights for different positions
    seed += numValue * (index + 1) * 1000;
  });
  
  return Math.abs(seed);
}

/**
 * Generate a seed from party member stats if available
 * @param {Object} partyData - Data about the player's party
 * @returns {number} Generated seed
 */
generateSeedFromParty(partyData) {
  if (!partyData || !partyData.members || partyData.members.length === 0) {
    console.log("No party data available, using time-based seed");
    return Date.now();
  }
  
  // Collect stats from party members
  const seedValues = [];
  partyData.members.forEach(member => {
    // Add some distinctive values that would create different seeds
    if (member.hp) seedValues.push(member.hp);
    if (member.level) seedValues.push(member.level * 100);
    if (member.ac) seedValues.push(member.ac * 10);
    if (member.exp) seedValues.push(member.exp);
    
    // Add name for additional uniqueness
    if (member.name) seedValues.push(this.hashString(member.name));
  });
  
  // Add the party size as another factor
  seedValues.push(partyData.members.length * 1000);
  
  // Combine all values into a seed
  return this.combineSeedValues(seedValues);
}

/**
 * Initialize the dungeon with proper seed
 * @param {Object} config - Configuration options
 * @param {string} config.difficulty - Dungeon difficulty
 * @param {number|string|Array|Object} config.seed - Seed value or party data
 */
initialize(config = {}) {
  // Set difficulty first
  this.configureDifficulty(config.difficulty || 'medium');
  
  // Determine seed source
  let seed;
  if (config.seed) {
    if (config.seed.members) {
      // It's party data
      seed = this.generateSeedFromParty(config.seed);
    } else {
      // It's a direct seed value
      seed = config.seed;
    }
  } else {
    // No seed provided, use default
    seed = Date.now();
  }
  
  // Initialize the seed
  this.initializeSeed(seed);
  
  console.log(`Dungeon initialized with difficulty: ${this.difficultyLevel}, seed: ${this.seed}`);
  return this;
}

/**
 * Configure difficulty settings
 * @param {string} level - Difficulty level: 'easy', 'medium', 'hard', or 'epic'
 */
configureDifficulty(level) {
  // Normalize input
  const difficulty = String(level).toLowerCase();
  this.difficultyLevel = difficulty;
  
  // Configure dungeon parameters based on difficulty
  switch (difficulty) {
    case 'easy':
      // FIXED: More generous room parameters for easy difficulty
      this.dungeonSize = 40;
      this.numRooms = 4;
      this.roomSizeMin = 4;
      this.roomSizeMax = 6;
      this.enemyDensity = 0.03;
      break;
      
    case 'medium':
      this.dungeonSize = 60;
      this.numRooms = 6; 
      this.roomSizeMin = 4;
      this.roomSizeMax = 8;
      this.enemyDensity = 0.05;
      break;
      
    case 'hard':
      this.dungeonSize = 80;
      this.numRooms = 8;
      this.roomSizeMin = 3;
      this.roomSizeMax = 10;
      this.enemyDensity = 0.08;
      break;
      
    case 'epic':
      this.dungeonSize = 100;
      this.numRooms = 10;
      this.roomSizeMin = 3;
      this.roomSizeMax = 12;
      this.enemyDensity = 0.1;
      break;
      
    default:
      // Default to medium
      this.dungeonSize = 60;
      this.numRooms = 6;
      this.roomSizeMin = 4;
      this.roomSizeMax = 8;
      this.enemyDensity = 0.05;
      break;
  }
  
  console.log(`Setting dungeon difficulty to: ${difficulty}`);
  console.log(`Dungeon configured: size=${this.dungeonSize}, rooms=${this.numRooms}, maxRoomSize=${this.roomSizeMax}`);
}

    /**
 * Modified createNew method to use seeded randomness
 * @param {Object} config - Optional configuration
 * @returns {Object} Information about the generated dungeon
 */
createNew(config = {}) {
  console.log("Generating new dungeon...");
  
  // Initialize with config if provided
  if (config.difficulty || config.seed) {
    this.initialize(config);
  } else if (!this.seed) {
    // Make sure we have a seed initialized
    this.initializeSeed(Date.now());
  }
  
  try {
    // Rest of createNew method remains the same
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
      size: this.dungeonSize,
      seed: this.seed // Return the seed used
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
 * Load textures from resource manager using the correct access patterns
 */
loadTextures() {
  console.log("Loading dungeon textures using LayersPanel pattern");
  const floorTextures = [];
  const wallTextures = [];
  
  try {
    // Check if resource manager is available
    if (!this.resourceManager) {
      console.warn("⚠️ No resource manager available for texture loading");
      throw new Error("Resource manager not available");
    }
    
    // Get wall textures using the CORRECT pattern from LayersPanel.js
    const wallTexturesCollection = this.resourceManager?.resources?.textures?.walls;
    
    if (wallTexturesCollection) {
      console.log("Found wall textures collection:", {
        isMap: wallTexturesCollection instanceof Map,
        size: wallTexturesCollection instanceof Map ? wallTexturesCollection.size : Object.keys(wallTexturesCollection).length
      });
      
      // Handle both Map and regular object cases
      if (wallTexturesCollection instanceof Map) {
        // It's a Map object (as in LayersPanel)
        for (const [id, texture] of wallTexturesCollection.entries()) {
          console.log(`Processing texture: ${id} (${texture.name})`);
          
          if (texture && texture.data) {
            try {
              // Create THREE.js texture directly from texture data
              const loader = new THREE.TextureLoader();
              const threeTexture = loader.load(texture.data);
              
              // Determine if it's a floor or wall texture based on name
              const textureName = texture.name.toLowerCase();
              if (textureName.includes('floor')) {
                floorTextures.push(threeTexture);
                console.log(`✅ Added floor texture: ${texture.name}`);
              } else if (textureName.includes('wall')) {
                wallTextures.push(threeTexture);
                console.log(`✅ Added wall texture: ${texture.name}`);
              } else {
                // Default to wall texture if unclear
                wallTextures.push(threeTexture);
                console.log(`✅ Added generic texture as wall: ${texture.name}`);
              }
            } catch (err) {
              console.warn(`Error loading texture ${texture.name}:`, err);
            }
          }
        }
      } else {
        // It's a regular object (handle as fallback)
        for (const id in wallTexturesCollection) {
          const texture = wallTexturesCollection[id];
          console.log(`Processing texture: ${id} (${texture.name})`);
          
          if (texture && texture.data) {
            try {
              // Create THREE.js texture directly from texture data
              const loader = new THREE.TextureLoader();
              const threeTexture = loader.load(texture.data);
              
              // Determine if it's a floor or wall texture based on name
              const textureName = texture.name.toLowerCase();
              if (textureName.includes('floor')) {
                floorTextures.push(threeTexture);
                console.log(`✅ Added floor texture: ${texture.name}`);
              } else if (textureName.includes('wall')) {
                wallTextures.push(threeTexture);
                console.log(`✅ Added wall texture: ${texture.name}`);
              } else {
                // Default to wall texture if unclear
                wallTextures.push(threeTexture);
                console.log(`✅ Added generic texture as wall: ${texture.name}`);
              }
            } catch (err) {
              console.warn(`Error loading texture ${texture.name}:`, err);
            }
          }
        }
      }
    } else {
      console.warn("No wall textures found in resource manager");
    }
  } catch (e) {
    console.error("Error loading textures:", e);
  }
  
  // Create fallbacks if needed
  if (floorTextures.length === 0) {
    console.warn("⚠️ No floor textures found - creating fallbacks");
    floorTextures.push(this.createDefaultTexture('floor', 0x555555));
  }
  
  if (wallTextures.length === 0) {
    console.warn("⚠️ No wall textures found - creating fallbacks");
    wallTextures.push(this.createDefaultTexture('wall', 0x777777));
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
  

  // Modified wall texture processing to fix tiling issues
wallTextures.forEach(texture => {
  if (!texture) return;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  // Instead of tiling horizontally, make it fit once per wall segment
  // A typical wall segment might be around 4 units wide
  // Set horizontal repeat to a small value to prevent excessive repetition
  const horizontalRepeat = 0.25; // Makes texture wider (fewer repeats horizontally)
  
  // For vertical tiling, we want to set a height that looks natural
  // For a 4.5 unit high wall, a repeat of 1 might be too small
  // Let's make it visible but not too stretched
  const verticalRepeat = 0.5; // Makes texture taller (fewer repeats vertically)
  
  texture.repeat.set(horizontalRepeat, verticalRepeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
});
  
  this.floorTextures = floorTextures;
  this.wallTextures = wallTextures;
  
  console.log(`Texture loading complete: ${floorTextures.length} floor textures and ${wallTextures.length} wall textures`);
  return true;
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
 * Create a large ceiling over the dungeon
 */
createLargeCeiling() {
  console.log("Creating unified dungeon ceiling");
  
  // Determine the bounds of the dungeon (same as floor bounds)
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
  
  // Add margin to ensure coverage
  minX = minX - 2;
  minZ = minZ - 2;
  maxX = maxX + 2;
  maxZ = maxZ + 2;
  
  const ceilingWidth = maxX - minX;
  const ceilingDepth = maxZ - minZ;
  
  if (ceilingWidth <= 0 || ceilingDepth <= 0) {
    console.error("Invalid ceiling dimensions:", ceilingWidth, ceilingDepth);
    return;
  }
  
  const ceilingGeometry = new THREE.PlaneGeometry(ceilingWidth, ceilingDepth);
  
  // Create ceiling material - use wall texture or a darker version of floor
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    // map: this.wallTextures[0] || this.floorTextures[0],
    map: this.floorTextures[0] || this.wallTextures[0],
    color: 0x444444, // Darker than normal to simulate shadow
    roughness: 0.9,
    side: THREE.DoubleSide
  });
  
  // Set texture repeat based on ceiling size
  if (ceilingMaterial.map) {
    ceilingMaterial.map.wrapS = THREE.RepeatWrapping;
    ceilingMaterial.map.wrapT = THREE.RepeatWrapping;
    ceilingMaterial.map.repeat.set(ceilingWidth / 3, ceilingDepth / 3); // Larger repeat for ceiling
  }
  
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2; // Rotate to be facing down
  
  // Position ceiling at the top of the walls
  ceiling.position.set(
    minX + ceilingWidth / 2,
    this.wallHeight,  // Set at the wall height
    minZ + ceilingDepth / 2
  );
  
  // Mark with userData
  ceiling.userData = {
    isDungeonElement: true,
    isCeiling: true
  };
  
  // Add to scene
  this.scene3D.scene.add(ceiling);
  this.dungeonElements.push(ceiling);
  
  console.log(`Created ceiling: ${ceilingWidth.toFixed(1)}x${ceilingDepth.toFixed(1)} at height ${this.wallHeight.toFixed(1)}`);
  
  return ceiling;
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
 * Uses seeded random for deterministic but varied layouts
 */
generateRooms() {
  console.log("Generating dungeon rooms with seeded randomness");
  
  this.rooms = [];
  
  // Center of the dungeon
  const center = Math.floor(this.dungeonSize / 2);
  
  // FIXED: Adjust room density to ensure we get enough valid rooms
  const roomDensity = {
    easy: 0.75,  // Increased from 0.55
    medium: 0.65,
    hard: 0.75,
    epic: 0.85
  }[this.difficultyLevel] || 0.65;
  
  // FIXED: Create more room candidates, especially for easy mode
  const maxRoomAttempts = this.dungeonSize * roomDensity * 2;
  console.log(`Will attempt to create up to ${maxRoomAttempts} room candidates`);
  
  // Track how many rooms were rejected and why
  let rejections = {
    overlap: 0,
    outOfBounds: 0
  };
  
  // Generate potential room placements using seeded random
  const candidateRooms = [];
  for (let i = 0; i < maxRoomAttempts; i++) {
    // Random room size based on difficulty
    const roomWidth = Math.floor(this.seededRandom() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
    const roomHeight = Math.floor(this.seededRandom() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
    
    // Random position with bias toward center
    const distFromCenter = this.seededRandom() * this.dungeonSize * 0.4;
    const angle = this.seededRandom() * Math.PI * 2;
    
    const worldX = center + Math.cos(angle) * distFromCenter - roomWidth/2;
    const worldZ = center + Math.sin(angle) * distFromCenter - roomHeight/2;
    
    // Add some variation to room shapes based on seed
    let isIrregular = this.seededRandom() < 0.3; // 30% chance for irregular rooms
    let irregularityFactor = 0;
    
    if (isIrregular) {
      irregularityFactor = 0.2 + this.seededRandom() * 0.2; // 20-40% irregularity
    }
    
    // Add to candidates
    candidateRooms.push({
      x: worldX,
      z: worldZ,
      width: roomWidth,
      height: roomHeight,
      isIrregular: isIrregular,
      irregularityFactor: irregularityFactor,
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
        rejections.overlap++;
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
    
    if (!inBounds) {
      rejections.outOfBounds++;
    }
    
    // Add if valid - using our new method with content placement
    if (!overlaps && inBounds) {
      const room = this.generateRoomWithContent(
        candidate.x, candidate.z, 
        candidate.width, candidate.height,
        candidate.isIrregular, candidate.irregularityFactor
      );
      
      console.log(`Created room ${this.rooms.length}: ${candidate.width}x${candidate.height} at (${candidate.x.toFixed(1)}, ${candidate.z.toFixed(1)})`);
    }
  }
  
  console.log(`Generated ${this.rooms.length} rooms, rejected ${rejections.overlap} for overlap, ${rejections.outOfBounds} out of bounds`);
  
  // FIXED: More rooms if we don't have enough
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
  else if (this.rooms.length < 2) {
    console.warn("Only generated one room - adding a second room");
    
    // Create a second room adjacent to the first
    const firstRoom = this.rooms[0];
    const secondWidth = 6;
    const secondHeight = 6;
    
    // Place it to the right of the first room
    const x = firstRoom.x + firstRoom.width + buffer;
    const z = firstRoom.z;
    
    // Make sure it's in bounds
    if (x + secondWidth < this.dungeonSize && z + secondHeight < this.dungeonSize) {
      this.generateRoomWithContent(x, z, secondWidth, secondHeight);
    } 
    // If not, try to the left
    else if (firstRoom.x - secondWidth - buffer >= 0) {
      this.generateRoomWithContent(firstRoom.x - secondWidth - buffer, z, secondWidth, secondHeight);
    }
    // If not, try below
    else if (firstRoom.z + firstRoom.height + buffer + secondHeight < this.dungeonSize) {
      this.generateRoomWithContent(firstRoom.x, firstRoom.z + firstRoom.height + buffer, secondWidth, secondHeight);
    }
    // Last resort - create a room at a specific position
    else {
      this.generateRoomWithContent(
        this.dungeonSize / 4,
        this.dungeonSize / 4,
        secondWidth,
        secondHeight
      );
    }
  }
}


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
    const roomA = this.rooms[Math.floor(this.seededRandom() * this.rooms.length)];
    const roomB = this.rooms[Math.floor(this.seededRandom() * this.rooms.length)];
    
    // Only connect if not already directly connected and not the same room
    if (roomA !== roomB && !roomA.connections.includes(roomB)) {
      this.createOptimizedCorridor(roomA, roomB);
    }
  }
}


/**
 * Connect rooms with corridors using improved pathfinding
 * Uses seeded random for deterministic but varied corridor layouts
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
    const roomA = this.rooms[Math.floor(this.seededRandom() * this.rooms.length)];
    const roomB = this.rooms[Math.floor(this.seededRandom() * this.rooms.length)];
    
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
    
    if (this.seededRandom() < meandering) {
      // Offset the corner for more natural look
      const offset = (this.seededRandom() - 0.5) * Math.min(dx, dz) * 0.5;
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
  
  if (this.seededRandom() < 0.5) {
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

  // Place exit in room farthest from start room that has a valid path
  // Find farthest room with path to entrance
  const exitRoom = this.findExitRoom(startRoom, sortedRooms);
  
  // Create exit point in the center of the farthest room
  this.exitPoint = new THREE.Vector3(
    exitRoom.centerX,
    0.1, // Slightly above ground level for visibility
    exitRoom.centerZ
  );
  
  // Mark room as exit room
  exitRoom.isExitRoom = true;
  
  // Create visible exit marker
  this.createExitMarker(this.exitPoint, exitRoom);

  console.log(`Safe spawn room set at (${this.playerSpawnPoint.x.toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)})`);
  console.log(`Exit set to (${this.exitPoint.x.toFixed(2)}, ${this.exitPoint.z.toFixed(2)}) in room ${exitRoom.id}`);
}

/**
 * Find appropriate room for dungeon exit
 * @param {Object} startRoom - The starting room
 * @param {Array} sortedRooms - All rooms sorted by distance
 * @returns {Object} Selected exit room
 */
findExitRoom(startRoom, sortedRooms) {
  // Try to use the farthest room from start
  let exitRoom = sortedRooms[sortedRooms.length - 1];
  
  // If there's only one room, we have no choice
  if (sortedRooms.length === 1) {
    return startRoom;
  }
  
  // If start room and exit room are the same, pick another
  if (exitRoom === startRoom && sortedRooms.length > 1) {
    exitRoom = sortedRooms[sortedRooms.length - 2];
  }
  
  // Check for path connectivity
  const hasPath = this.checkRoomConnectivity(startRoom, exitRoom);
  
  if (!hasPath && sortedRooms.length > 2) {
    // Try other rooms if no path exists
    console.log("No direct path to farthest room, finding alternative exit location");
    
    // Try to find a room with a path, starting from farthest and working inward
    for (let i = sortedRooms.length - 1; i >= 0; i--) {
      const candidateRoom = sortedRooms[i];
      if (candidateRoom !== startRoom && this.checkRoomConnectivity(startRoom, candidateRoom)) {
        console.log(`Found valid exit room: ${candidateRoom.id}`);
        return candidateRoom;
      }
    }
  }
  
  return exitRoom;
}

/**
 * Check if there's a valid path between two rooms
 * @param {Object} roomA - First room
 * @param {Object} roomB - Second room 
 * @returns {boolean} Whether a path exists
 */
checkRoomConnectivity(roomA, roomB) {  // placeholder code
  // Simple check for direct connection
  if (roomA.connections.includes(roomB) || roomB.connections.includes(roomA)) {
    return true;
  }
  
  // For complex dungeons, could implement path-finding here
  // For now, we'll assume if they're both connected to the graph, there's a path
  return true;
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

          // Add ceiling for enclosed dungeon feel
        this.createLargeCeiling();
      
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
        // this.createDebugVisualizers();
      
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
        
        // Replace with this enhanced texture handling code:
const wallGeometry = new THREE.BoxGeometry(blockWidth, this.wallHeight, blockDepth);
let wall;

// Handle texture scaling for better appearance
if (wallMaterial.map) {
  // Calculate texture repeats based on wall dimensions
  const horizontalRepeatX = Math.max(1, Math.round(blockWidth / 4));
  const horizontalRepeatZ = Math.max(1, Math.round(blockDepth / 4));
  
  // Create materials for each face with proper texture scaling
  const materials = [
    wallMaterial.clone(), // right side (+X)
    wallMaterial.clone(), // left side (-X)
    wallMaterial.clone(), // top (+Y)
    wallMaterial.clone(), // bottom (-Y)
    wallMaterial.clone(), // front (+Z)
    wallMaterial.clone()  // back (-Z)
  ];
  
  // Set texture repeats for all materials
  materials.forEach(mat => {
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.wrapS = THREE.RepeatWrapping;
      mat.map.wrapT = THREE.RepeatWrapping;
    }
  });
  
  // X-facing sides
  if (materials[0].map) materials[0].map.repeat.set(horizontalRepeatZ, 1);
  if (materials[1].map) materials[1].map.repeat.set(horizontalRepeatZ, 1);
  
  // Y-facing sides (top/bottom)
  if (materials[2].map) materials[2].map.repeat.set(horizontalRepeatX, horizontalRepeatZ);
  if (materials[3].map) materials[3].map.repeat.set(horizontalRepeatX, horizontalRepeatZ);
  
  // Z-facing sides
  if (materials[4].map) materials[4].map.repeat.set(horizontalRepeatX, 1);
  if (materials[5].map) materials[5].map.repeat.set(horizontalRepeatX, 1);
  
  wall = new THREE.Mesh(wallGeometry, materials);
} else {
  // Fallback to single material if no texture
  wall = new THREE.Mesh(wallGeometry, wallMaterial.clone());
}

// Position wall at center of block
wall.position.set(
  worldX + blockWidth / 2,
  this.wallHeight / 2,
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
 * Enhanced teleport player method with monster options
 */
teleportPlayerToDungeon(options = {}) {
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
  
  // Reset physics state to avoid falling or clipping
  if (this.scene3D.physics) {
    this.scene3D.physics.currentGroundHeight = elevation;
    this.scene3D.physics.isJumping = false;
    this.scene3D.physics.isFalling = false;
    
    // Ensure good collision detection
    this.scene3D.physics.update(0.1);
  }
  
  // Set up atmospheric lighting and effects
  this.setupDungeonAtmosphere();
  
  // Store dungeon ID for monsters to reference back to this dungeon
  this.dungeonId = `dungeon-${Date.now()}`;
  
  // Spawn monsters if requested (default to true)
  const spawnMonsters = options.spawnMonsters !== false;
  if (spawnMonsters) {
    this.instantiateMonsters({
      animated: options.animatedMonsters !== false, // Default to true
      withAI: options.withAI !== false // Default to true
    });
  }
  
  console.log(`Player teleported to (${this.playerSpawnPoint.x.toFixed(2)}, ${(elevation + playerHeight).toFixed(2)}, ${this.playerSpawnPoint.z.toFixed(2)}) with ground at ${elevation.toFixed(2)}`);
  return true;
}


/**
 * Exit the dungeon and return to the main world
 */
exitDungeon() {
  console.log("Exiting dungeon and returning to main world");
  
  // Clean up monsters before exiting
  this.cleanupMonsters();
  
  // Resume day/night cycle
  if (this.scene3D.dayNightCycle) {
    this.scene3D.dayNightCycle.start();
  }
  
  // Teleport player back to original position if saved
  if (this.scene3D._prevWorldState && this.scene3D._prevWorldState.cameraPosition) {
    // Get the position to return to
    const returnPos = this.scene3D._prevWorldState.cameraPosition;
    
    // Teleport back
    this.scene3D.camera.position.copy(returnPos);
    
    // Reset physics if available
    if (this.scene3D.physics) {
      this.scene3D.physics.currentGroundHeight = 0;
      this.scene3D.physics.update(0.1);
    }
  }
  
  // Remove all dungeon elements
  this.clearDungeonElements();
  
  // Remove fog
  if (this.scene3D.scene.fog) {
    this.scene3D.scene.fog = null;
  }
  
  // Show a notification
  if (this.scene3D.showNotification) {
    this.scene3D.showNotification('Returned to world');
  }
  
  // Clear dungeon state
  this.scene3D.currentLocation = null;
  
  // Resume controls
  this.scene3D.resumeControls();
  
  return true;
}



/**
 * Set up atmospheric lighting and effects for the dungeon
 */
setupDungeonAtmosphere() {
  console.log("Setting up dungeon atmosphere");
  
  // Get the current quality level from Scene3DController
  const qualityLevel = this.scene3D.qualityLevel || 'medium';
  console.log(`Setting up dungeon atmosphere for quality level: ${qualityLevel}`);
  
  // Pause day/night cycle when entering dungeon
  this.pauseDayNightCycle();
  
  // Reduce ambient lighting to create a darker mood
  this.adjustDungeonLighting();
  
  // Add strategic lights throughout the dungeon
  this.addStrategicLighting(qualityLevel);
  
  // Add atmospheric particles if quality permits
  if (qualityLevel !== 'low' && this.scene3D.shaderEffectsManager) {
    this.addAtmosphericEffects(qualityLevel);
  }
}

/**
 * Pause day/night cycle when entering dungeon
 */
pauseDayNightCycle() {
  // Store current state to restore when exiting
  if (this.scene3D.dayNightCycle) {
    this._dayNightCyclePaused = this.scene3D.dayNightCycle.isPlaying;
    
    // Pause if it's playing
    if (this._dayNightCyclePaused) {
      console.log("Pausing day/night cycle while in dungeon");
      this.scene3D.dayNightCycle.pause();
    }
  }
}

/**
 * Resume day/night cycle when exiting dungeon (to be called by exit method)
 */
resumeDayNightCycle() {
  // Restore previous state
  if (this.scene3D.dayNightCycle && this._dayNightCyclePaused) {
    console.log("Resuming day/night cycle");
    this.scene3D.dayNightCycle.start();
  }
}

/**
 * Adjust the dungeon lighting to be darker and more atmospheric
 */
adjustDungeonLighting() {
  // Remove any existing ambient lights
  const existingLights = this.dungeonElements.filter(el => 
    el instanceof THREE.AmbientLight || 
    (el instanceof THREE.Light && el.userData && el.userData.isDungeonLighting)
  );
  
  existingLights.forEach(light => {
    this.scene3D.scene.remove(light);
    const index = this.dungeonElements.indexOf(light);
    if (index !== -1) {
      this.dungeonElements.splice(index, 1);
    }
  });
  
  // Add a dim ambient light
  const ambientLight = new THREE.AmbientLight(0x222222, 0.3);
  ambientLight.userData = { 
    isDungeonElement: true,
    isDungeonLighting: true 
  };
  this.scene3D.scene.add(ambientLight);
  this.dungeonElements.push(ambientLight);
  
  // Add a slight fog effect
  this.scene3D.scene.fog = new THREE.FogExp2(0x000000, 0.03);
  
  console.log("Adjusted dungeon lighting to be darker and more atmospheric");
}

/**
 * Add strategic lighting throughout the dungeon (room centers and paths)
 */
addStrategicLighting(qualityLevel = 'medium') {
  console.log("Adding strategic lighting based on quality level:", qualityLevel);
  
  // Add room center lights
  this.rooms.forEach(room => {
    if (!room || room.centerX === undefined || room.centerZ === undefined) {
      console.warn("Invalid room data for lighting:", room);
      return;
    }
    
    // Get elevation at room center
    const { elevation } = this.getElevationAtPoint(room.centerX, room.centerZ);
    
    // Create light at room center
    const light = new THREE.PointLight(
      0xff9944,  // Warm orange light
      1.2,      // Intensity
      8,        // Distance
      2         // Decay
    );
    
    // Position light at proper height
    light.position.set(
      room.centerX, 
      elevation + 2.0,  // Light from above, not floating
      room.centerZ
    );
    
    light.userData = { 
      isDungeonElement: true,
      isRoomLight: true
    };
    
    this.scene3D.scene.add(light);
    this.dungeonElements.push(light);
    
    // Add animated glow effect for medium+ quality
    if (qualityLevel !== 'low' && this.scene3D.shaderEffectsManager) {
      this.addGlowEffect(room.centerX, elevation, room.centerZ, qualityLevel);
    }
  });
  
  // Add path lighting between rooms for better navigation
  this.addPathLighting(qualityLevel);
}

/**
 * Add animated fire effects using ShaderEffectsManager
 */
addFireEffect(x, y, z, qualityLevel) {
  // Skip if ShaderEffectsManager is not available
  if (!this.scene3D.shaderEffects) {
    console.warn("ShaderEffectsManager not available for fire effects");
    return null;
  }
  
  // Safely check for the method
  if (typeof this.scene3D.shaderEffects.createFireEffect !== 'function') {
    console.warn("createFireEffect method not available in ShaderEffectsManager");
    return null;
  }
  
  // Safety check for parameters
  if (x === undefined || y === undefined || z === undefined) {
    console.warn("Invalid coordinates for fire effect:", x, y, z);
    return null;
  }
  
  // Set fire effect properties based on quality
  const fireSize = qualityLevel === 'ultra' ? 0.5 : 
                   qualityLevel === 'high' ? 0.4 : 0.3;
  
  try {
    // Use position object instead of Vector3
    const position = { x: x, y: y + 0.1, z: z };
    
    const fireEffect = this.scene3D.shaderEffects.createFireEffect(
      position,  // Use plain object instead of Vector3
      qualityLevel === 'low' ? 'small' : 'medium',
      {
        height: fireSize,
        width: fireSize * 0.8,
        color: 0xff6622,
        intensity: qualityLevel === 'ultra' ? 1.0 : 0.8
      }
    );
    
    if (fireEffect && fireEffect.mesh) {
      // Ensure it's marked as a dungeon element for cleanup
      fireEffect.mesh.userData = { 
        ...fireEffect.mesh.userData,
        isDungeonElement: true 
      };
      
      this.dungeonElements.push(fireEffect.mesh);
      return fireEffect;
    }
  } catch (err) {
    console.error("Error creating fire effect:", err);
  }
  
  return null;
}

/**
 * Add glow effects using ShaderEffectsManager (to replace problematic fire effects)
 */
addGlowEffect(x, y, z, qualityLevel) {
  // Skip if ShaderEffectsManager is not available
  if (!this.scene3D.shaderEffectsManager) {
    console.warn("ShaderEffectsManager not available for glow effects");
    return null;
  }
  
  // Safely check for the method
  if (typeof this.scene3D.shaderEffectsManager.createPropGlowEffect !== 'function') {
    console.warn("createPropGlowEffect method not available in ShaderEffectsManager");
    return null;
  }
  
  try {
    // Create a fake prop object with position
    const fakeProp = {
      position: { x: x, y: y + 0.1, z: z },
      userData: {
        name: 'torch',
        type: 'prop'
      }
    };
    
    // Set glow options based on quality level
    const glowIntensity = qualityLevel === 'ultra' ? 1.0 : 
                         qualityLevel === 'high' ? 0.8 : 0.6;
                         
    const particleCount = qualityLevel === 'ultra' ? 20 : 
                          qualityLevel === 'high' ? 15 : 10;
    
    // Use createPropGlowEffect which is more stable than createFireEffect
    const effectData = this.scene3D.shaderEffectsManager.createPropGlowEffect(
      fakeProp,
      {
        color: 0xff6600,        // Orange-red for fire 
        intensity: glowIntensity,
        particleCount: particleCount,
        particleSize: 0.04,
        height: 0.3,
        radius: 0.2,
        blending: THREE.AdditiveBlending
      }
    );
    
    // Add to dungeon elements for cleanup
    if (effectData && effectData.container) {
      effectData.container.userData.isDungeonElement = true;
      this.dungeonElements.push(effectData.container);
      return effectData;
    }
  } catch (err) {
    console.error("Error creating glow effect:", err);
  }
  
  return null;
}

/**
 * Add lighting along paths between rooms
 */
addPathLighting(qualityLevel) {
  // Only add for medium quality and above
  if (qualityLevel === 'low') return;
  
  // Map all room centers
  const roomCenters = this.rooms.map(room => ({
    x: room.centerX,
    z: room.centerZ
  }));
  
  // Skip if fewer than 2 rooms
  if (roomCenters.length < 2) return;
  
  // For each pair of adjacent rooms, place lights along the connection path
  for (let i = 0; i < roomCenters.length - 1; i++) {
    const startPoint = roomCenters[i];
    const endPoint = roomCenters[i + 1];
    
    // Calculate direction vector
    const dirX = endPoint.x - startPoint.x;
    const dirZ = endPoint.z - startPoint.z;
    const distance = Math.sqrt(dirX * dirX + dirZ * dirZ);
    
    // Skip if rooms are very close
    if (distance < 4) continue;
    
    // Normalize direction
    const normalizedDirX = dirX / distance;
    const normalizedDirZ = dirZ / distance;
    
    // Determine number of lights based on distance and quality
    let numLights;
    switch (qualityLevel) {
      case 'ultra':
      case 'high':
        numLights = Math.floor(distance / 3) + 1; // Every 3 units
        break;
      case 'medium':
      default:
        numLights = Math.floor(distance / 5) + 1; // Every 5 units
    }
    
    // Place lights along path
    for (let j = 1; j < numLights; j++) {
      const t = j / numLights; // Interpolation factor
      const lightX = startPoint.x + dirX * t;
      const lightZ = startPoint.z + dirZ * t;
      
      // Get elevation at this point
      const { elevation } = this.getElevationAtPoint(lightX, lightZ);
      
      // Create subtle guide light
      const light = new THREE.PointLight(0x6688cc, 0.6, 4, 2);
      
      // Position at proper height above floor
      light.position.set(lightX, elevation + 1.5, lightZ);
      
      light.userData = { 
        isDungeonElement: true,
        isPathLight: true
      };
      
      // Add light to scene
      this.scene3D.scene.add(light);
      this.dungeonElements.push(light);
    }
  }
}

/**
 * Add atmospheric effects like dust particles
 */

addAtmosphericEffects(qualityLevel) {
  // Only add these effects for medium quality and above with shader support
  if (qualityLevel === 'low' || !this.scene3D.shaderEffectsManager) return;
  
  console.log(`Adding atmospheric effects for quality level: ${qualityLevel}`);
  
  // Add dust particles in rooms
  this.rooms.forEach(room => {
    // Skip small rooms
    if (room.width * room.height < 16) return;
    
    // Determine particle count based on quality and room size
    let particleCount;
    switch (qualityLevel) {
      case 'ultra':
        particleCount = Math.min(30, Math.floor(room.width * room.height / 4));
        break;
      case 'high':
        particleCount = Math.min(20, Math.floor(room.width * room.height / 6));
        break;
      case 'medium':
      default:
        particleCount = Math.min(10, Math.floor(room.width * room.height / 8));
    }
    
    // Skip if particle count is too low
    if (particleCount < 5) return;
    
    // Create dust effect
    const position = {
      x: room.centerX,
      y: 1.5,
      z: room.centerZ
    };
    
    // Use ShaderEffectsManager to create dust
    if (typeof this.scene3D.shaderEffectsManager.createDustEffect === 'function') {
      try {
        const dustEffect = this.scene3D.shaderEffectsManager.createDustEffect(
          position, 
          {
            count: particleCount,
            size: 0.03,
            color: 0xaaaaaa,
            lifetime: 15
          }
        );
        
        if (dustEffect && dustEffect.mesh) {
          // Ensure it's marked as a dungeon element for cleanup
          dustEffect.mesh.userData = { 
            ...dustEffect.mesh.userData,
            isDungeonElement: true 
          };
          
          this.dungeonElements.push(dustEffect.mesh);
        }
      } catch (err) {
        console.error("Error creating dust effect:", err);
      }
    }
  });
}


/**
 * Clear all dungeon elements from the scene
 */
clearDungeonElements() {
  // Remove all elements marked as dungeon elements
  this.dungeonElements.forEach(element => {
    if (element && element.parent) {
      element.parent.remove(element);
    }
  });
  
  // Clear the array
  this.dungeonElements = [];
}


/**
 * Create a visible exit marker for the player to interact with
 * @param {THREE.Vector3} position - Position for the exit marker
 * @param {Object} room - The room containing the exit
 */
createExitMarker(position, room) {
  // Get elevation at this point
  const { elevation } = this.getElevationAtPoint(position.x, position.z);
  const markerY = elevation + 0.1; // Slightly above ground
  
  // Create exit visuals
  
  // 1. Create a base platform
  const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x6699cc, 
    roughness: 0.7,
    transparent: true,
    opacity: 0.9
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.set(position.x, markerY, position.z);
  
  // 2. Create a glowing portal effect
  const portalGeometry = new THREE.TorusGeometry(1, 0.2, 16, 48);
  const portalMaterial = new THREE.MeshStandardMaterial({
    color: 0x66ccff,
    emissive: 0x3399ff,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.8
  });
  const portal = new THREE.Mesh(portalGeometry, portalMaterial);
  portal.position.set(position.x, markerY + 1.0, position.z);
  portal.rotation.x = Math.PI / 2; // Horizontal orientation
  
  // 3. Create steps leading to the portal
  const stepsGeometry = new THREE.CylinderGeometry(1.2, 1.5, 0.5, 16);
  const stepsMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5588bb,
    roughness: 0.6
  });
  const steps = new THREE.Mesh(stepsGeometry, stepsMaterial);
  steps.position.set(position.x, markerY + 0.25, position.z);
  
  // 4. Create a point light to illuminate the exit
  const light = new THREE.PointLight(0x66ccff, 1.5, 10);
  light.position.set(position.x, markerY + 1.0, position.z);
  
  // 5. Create particle effect for portal
  const particles = this.createExitPortalParticles();
  particles.position.set(position.x, markerY + 1.0, position.z);
  
  // Create a group to hold all exit elements
  const exitGroup = new THREE.Group();
  exitGroup.add(base);
  exitGroup.add(steps);
  exitGroup.add(portal);
  exitGroup.add(light);
  exitGroup.add(particles);
  
  // Add metadata for interaction
  exitGroup.userData = {
    isDungeonElement: true,
    type: 'dungeon-exit',
    interactive: true,
    exitPosition: position.clone(),
    roomId: room.id
  };
  
  // Add animation
  this.animateExitMarker(portal, particles);
  
  // Add to scene
  this.scene3D.scene.add(exitGroup);
  this.dungeonElements.push(exitGroup);
  
  // Store reference for easy access
  this.exitMarker = exitGroup;
  
  console.log(`Created exit marker at (${position.x.toFixed(2)}, ${markerY.toFixed(2)}, ${position.z.toFixed(2)})`);
  return exitGroup;
}

/**
 * Create particles for exit portal
 */
createExitPortalParticles() {
  const geometry = new THREE.BufferGeometry();
  const particleCount = 50;
  const positions = new Float32Array(particleCount * 3);
  
  // Create particles in a ring pattern
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 0.9 + (this.seededRandom() * 0.3);
    positions[i * 3] = Math.cos(angle) * radius;     // x
    positions[i * 3 + 1] = (this.seededRandom() - 0.5) * 0.5; // y (height variation)
    positions[i * 3 + 2] = Math.sin(angle) * radius;     // z
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const material = new THREE.PointsMaterial({
    color: 0x66ccff,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending
  });
  
  const particles = new THREE.Points(geometry, material);
  particles.userData = {
    animate: true,
    initialPositions: [...positions],
    type: 'exitParticles'
  };
  
  return particles;
}

/**
 * Animate exit marker for visual appeal
 * @param {THREE.Mesh} portal - Portal ring object
 * @param {THREE.Points} particles - Particle system object
 */
animateExitMarker(portal, particles) {
  // Register for animation
  if (!this.animatedElements) {
    this.animatedElements = [];
    
    // Start animation loop if not already running
    if (!this.animationFrameId) {
      const animate = () => {
        const time = performance.now() * 0.001; // Convert to seconds
        
        // Update all animated elements
        if (this.animatedElements && this.animatedElements.length > 0) {
          this.animatedElements.forEach(elem => {
            if (elem.object && elem.update) {
              elem.update(time);
            }
          });
        }
        
        this.animationFrameId = requestAnimationFrame(animate);
      };
      
      this.animationFrameId = requestAnimationFrame(animate);
    }
  }
  
  // Add portal rotation animation
  this.animatedElements.push({
    object: portal,
    update: (time) => {
      if (portal) {
        portal.rotation.z = time * 0.5; // Slow rotation
        
        // Pulsing scale
        const pulse = 1 + Math.sin(time * 2) * 0.05;
        portal.scale.set(pulse, pulse, pulse);
      }
    }
  });
  
  // Add particle animation
  this.animatedElements.push({
    object: particles,
    update: (time) => {
      if (particles && particles.geometry) {
        const positions = particles.geometry.attributes.position.array;
        const initialPositions = particles.userData.initialPositions;
        
        for (let i = 0; i < positions.length; i += 3) {
          // Create swirling motion
          const idx = i / 3;
          const angle = time + idx * 0.2;
          const radius = Math.sqrt(
            initialPositions[i] * initialPositions[i] + 
            initialPositions[i + 2] * initialPositions[i + 2]
          );
          
          positions[i] = Math.cos(angle) * radius;
          positions[i + 1] = Math.sin(time * 2 + idx) * 0.2; // Bobbing up and down
          positions[i + 2] = Math.sin(angle) * radius;
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
      }
    }
  });
}


/**
 * Update monster animations
 * @param {number} deltaTime - Time since last frame
 */
updateMonsterAnimations(deltaTime) {
  if (!this.monsterTokens || this.monsterTokens.length === 0) return;
  
  const time = performance.now() * 0.001;
  
  this.monsterTokens.forEach(monster => {
    if (monster && monster.userData && monster.userData.animation) {
      const anim = monster.userData.animation;
      
      // Apply gentle floating motion
      monster.position.y = anim.startY + Math.sin(time * anim.floatSpeed) * anim.floatDistance;
    }
  });
}

/**
 * Update method for DungeonGenerator - called from Scene3DController's animate loop
 * @param {number} deltaTime - Time since last frame in seconds
 */
update(deltaTime) {
  // Update any animations for dungeon elements
  this.updateAnimations(deltaTime);
  
  // Animate exit portal if it exists
  this.animateExitPortal(deltaTime);
  
  // Update monster animations
  this.updateMonsterAnimations(deltaTime);
}

/**
 * Update animations for various dungeon elements
 * @param {number} deltaTime - Time since last frame
 */
updateAnimations(deltaTime) {
  // Update animated elements if they exist
  if (this.animatedElements && this.animatedElements.length > 0) {
    const time = performance.now() * 0.001; // Convert to seconds
    
    this.animatedElements.forEach(elem => {
      if (elem.object && elem.update) {
        elem.update(time);
      }
    });
  }
}

/**
 * Animate the exit portal
 * @param {number} deltaTime - Time since last frame
 */
animateExitPortal(deltaTime) {
  if (!this.exitMarker) return;
  
  const time = performance.now() * 0.001;
  
  // Make the portal float gently
  const originalY = this.exitPoint ? this.exitPoint.y : this.exitMarker.position.y;
  this.exitMarker.position.y = originalY + Math.sin(time) * 0.05;
  
  // Animate the portal's components
  this.exitMarker.children.forEach(child => {
    // Rotate any torus/ring shapes (portal rings)
    if (child.geometry && child.geometry.type === 'TorusGeometry') {
      child.rotation.z = time * 0.5; // Gentle rotation
      
      // Pulse size
      const pulse = 1 + Math.sin(time * 2) * 0.05;
      child.scale.set(pulse, pulse, pulse);
    }
    
    // Make lights pulse
    if (child.isLight) {
      child.intensity = 1.5 + Math.sin(time * 3) * 0.5;
    }
    
    // Update emissive materials
    if (child.material && child.material.emissive) {
      child.material.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.2;
    }
  });
  
  // Animate particles if they exist
  this.exitMarker.children.forEach(child => {
    if (child instanceof THREE.Points && child.geometry) {
      const positions = child.geometry.attributes.position.array;
      
      for (let i = 0; i < positions.length; i += 3) {
        // Create swirling motion
        const idx = i / 3;
        const angle = time + idx * 0.2;
        
        // Calculate base radius from original position
        let radius = 0.9;
        if (child.userData && child.userData.initialPositions) {
          const initialX = child.userData.initialPositions[i];
          const initialZ = child.userData.initialPositions[i + 2];
          radius = Math.sqrt(initialX * initialX + initialZ * initialZ);
        }
        
        // Update position with swirling motion
        positions[i] = Math.cos(angle) * radius;
        positions[i + 1] = Math.sin(time * 2 + idx) * 0.2; // Bobbing up and down
        positions[i + 2] = Math.sin(angle) * radius;
      }
      
      // Mark for update
      child.geometry.attributes.position.needsUpdate = true;
    }
  });
}

/**
 * Handle player interaction with the exit
 * Called from Scene3DController when player presses F near exit
 */
handleExitInteraction() {
  console.log("Player is exiting the dungeon");
  
  // Pause controls during transition
  this.scene3D.pauseControls();
  
  // Create visual transition effect
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #66ccff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s ease;
    z-index: 9999;
  `;
  document.body.appendChild(flash);
  
  // Execute exit animation
  requestAnimationFrame(() => {
    // Fade in blue portal effect
    flash.style.opacity = '1';
    
    // Wait then execute actual exit
    setTimeout(() => {
      // Call our exit function
      this.exitDungeon();
      
      // Wait for exit, then fade out
      setTimeout(() => {
        flash.style.opacity = '0';
        
        // Remove the DOM element after fade
        setTimeout(() => {
          flash.remove();
        }, 800);
      }, 400);
    }, 500);
  });
  
  return true;
}

/**
 * Enhanced isPlayerNearExit to ensure it only checks against the actual exit marker
 * @returns {boolean} Whether player is near exit
 */
isPlayerNearExit() {
  // Check for valid exit marker and camera
  if (!this.exitMarker || !this.scene3D.camera) return false;
  
  // Don't trigger at spawn point
  if (this.playerSpawnPoint) {
    const distToSpawn = this.scene3D.camera.position.distanceTo(this.playerSpawnPoint);
    if (distToSpawn < 3) {
      // Too close to spawn, not valid exit interaction
      if (this._exitPromptShown) {
        this.hideExitPrompt();
        this._exitPromptShown = false;
      }
      return false;
    }
  }
  
  // Get positions for distance calculation
  const playerPos = this.scene3D.camera.position;
  const exitPos = this.exitMarker.position;
  
  // Calculate distance to exit
  const distance = playerPos.distanceTo(exitPos);
  
  // Consider player near exit if within 3 units
  const isNear = distance < 3;
  
  // Show or hide prompt based on distance
  if (isNear && !this._exitPromptShown) {
    this.showExitPrompt();
    this._exitPromptShown = true;
  } else if (!isNear && this._exitPromptShown) {
    this.hideExitPrompt();
    this._exitPromptShown = false;
  }
  
  return isNear;
}

/**
 * Show exit prompt
 */
showExitPrompt() {
  if (!this.scene3D.showInteractivePrompt) return;
  
  this.scene3D.showInteractivePrompt(
    'Return to world',
    'exit_to_app',
    'F',
    'dungeon-exit'
  );
  this._exitPromptShown = true;
}

/**
 * Hide exit prompt
 */
hideExitPrompt() {
  if (!this.scene3D.hideInteractivePrompt) return;
  
  this.scene3D.hideInteractivePrompt('dungeon-exit');
  this._exitPromptShown = false;
}

/**
 * Check for player interaction with exit in update loop
 */
checkExitInteraction(deltaTime) {
  // Skip if no exit marker
  if (!this.exitMarker) return;
  
  // Check if player is near exit
  if (this.isPlayerNearExit()) {
    // Check for F key press
    if (this.scene3D.keys && this.scene3D.keys.f) {
      // Consume key press
      this.scene3D.keys.f = false;
      
      // Handle exit interaction
      this.handleExitInteraction();
    }
  }
  
  // Animate exit marker
  if (this.exitMarker) {
    // Apply gentle floating motion
    const time = performance.now() * 0.001;
    this.exitMarker.position.y = this.exitPoint.y + Math.sin(time) * 0.05;
  }
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
 * Adjust the dungeon lighting to be darker and more atmospheric
 */
adjustDungeonLighting() {
  // Remove any existing ambient lights
  const existingLights = this.dungeonElements.filter(el => 
    el instanceof THREE.AmbientLight || 
    (el instanceof THREE.Light && el.userData && el.userData.isDungeonLighting)
  );
  
  existingLights.forEach(light => {
    this.scene3D.scene.remove(light);
    const index = this.dungeonElements.indexOf(light);
    if (index !== -1) {
      this.dungeonElements.splice(index, 1);
    }
  });
  
  // Add a dim ambient light
  const ambientLight = new THREE.AmbientLight(0x222222, 0.3);
  ambientLight.userData = { 
    isDungeonElement: true,
    isDungeonLighting: true 
  };
  this.scene3D.scene.add(ambientLight);
  this.dungeonElements.push(ambientLight);
  
  // Add a slight fog effect
  this.scene3D.scene.fog = new THREE.FogExp2(0x000000, 0.03);
  
  console.log("Adjusted dungeon lighting to be darker and more atmospheric");
}

/**
 * Add torch lighting to the dungeon to create atmosphere
 * @param {string} qualityLevel - The current quality setting (low, medium, high, ultra)
 */
addTorchesToDungeon(qualityLevel = 'medium') {
  console.log("Adding torch lighting based on quality level:", qualityLevel);
  
  // Check if we can use shader effects
  const hasShaderEffects = this.scene3D.shaderEffects && 
                          typeof this.scene3D.shaderEffects.createPropGlowEffect === 'function';
  
  // Add torch in room corners
  this.rooms.forEach(room => {
    // Skip very small rooms
    if (room.width < 4 || room.height < 4) return;
    
    // Calculate corner positions with some offset from walls
    const corners = [
      { x: room.x + 1, z: room.z + 1 },  // Top-left
      { x: room.x + room.width - 1, z: room.z + 1 },  // Top-right
      { x: room.x + 1, z: room.z + room.height - 1 },  // Bottom-left
      { x: room.x + room.width - 1, z: room.z + room.height - 1 }  // Bottom-right
    ];
    
    // Determine how many torches to add based on quality level
    let torchProbability;
    switch (qualityLevel) {
      case 'ultra':
        torchProbability = 0.9; // Almost all corners
        break;
      case 'high':
        torchProbability = 0.7; // Most corners
        break;
      case 'medium':
        torchProbability = 0.5; // Half the corners
        break;
      case 'low':
      default:
        torchProbability = 0.3; // Fewer corners
    }
    
    // Add torches based on probability
    corners.forEach(corner => {
      if (Math.random() < torchProbability) {
        if (hasShaderEffects && qualityLevel !== 'low') {
          // Use shader effects for medium, high, ultra
          this.createEnhancedTorch(corner.x, corner.z, qualityLevel);
        } else {
          // Use simple torch for low quality
          this.createSimpleTorch(corner.x, corner.z);
        }
      }
    });
  });
  
  // Add special lighting to corridors to guide the way
  this.addCorridorLighting(qualityLevel);
}

/**
 * Create a simple torch light (for low quality)
 */
createSimpleTorch(x, z) {
  // Get elevation at torch position
  const { elevation } = this.getElevationAtPoint(x, z);
  
  // Create a simple point light
  const light = new THREE.PointLight(0xff8844, 1.0, 6, 2);
  light.position.set(x, elevation + 1.5, z);
  light.userData = { 
    isDungeonElement: true,
    isTorch: true
  };
  
  // Add light to scene
  this.scene3D.scene.add(light);
  this.dungeonElements.push(light);
  
  // Create simple torch visual
  const torchGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
  const torchMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x885533,
    roughness: 0.9
  });
  
  const torch = new THREE.Mesh(torchGeometry, torchMaterial);
  torch.position.set(x, elevation + 1.2, z);
  torch.userData = { isDungeonElement: true };
  
  this.scene3D.scene.add(torch);
  this.dungeonElements.push(torch);
  
  // Create flame on top
  const flameGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const flameMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 1
  });
  
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.position.set(x, elevation + 1.5, z);
  flame.userData = { 
    isDungeonElement: true,
    isFlame: true
  };
  
  this.scene3D.scene.add(flame);
  this.dungeonElements.push(flame);
  
  return { light, torch, flame };
}

/**
 * Create an enhanced torch using ShaderEffectsManager
 */
createEnhancedTorch(x, z, qualityLevel) {
  // Get elevation at torch position
  const { elevation } = this.getElevationAtPoint(x, z);
  
  // Create a base point light
  const light = new THREE.PointLight(0xff8844, 1.2, 8, 2);
  light.position.set(x, elevation + 1.5, z);
  light.userData = { 
    isDungeonElement: true,
    isTorch: true
  };
  
  // Add light to scene
  this.scene3D.scene.add(light);
  this.dungeonElements.push(light);
  
  // Create torch visual
  const torchGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
  const torchMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x885533,
    roughness: 0.9
  });
  
  const torch = new THREE.Mesh(torchGeometry, torchMaterial);
  torch.position.set(x, elevation + 1.2, z);
  torch.userData = { isDungeonElement: true };
  
  this.scene3D.scene.add(torch);
  this.dungeonElements.push(torch);
  
  // Use ShaderEffectsManager for the flame effect
  if (this.scene3D.shaderEffects) {
    // Create a fake prop object for the ShaderEffectsManager
    const fakeProp = {
      position: new THREE.Vector3(x, elevation + 1.5, z),
      userData: {
        name: 'torch',
        type: 'prop'
      }
    };
    
    // Determine particle count based on quality level
    let particleCount, intensity;
    switch (qualityLevel) {
      case 'ultra':
        particleCount = 20;
        intensity = 1.0;
        break;
      case 'high':
        particleCount = 15;
        intensity = 0.8;
        break;
      case 'medium':
      default:
        particleCount = 10;
        intensity = 0.6;
    }
    
    // Create the flame effect
    const effectData = this.scene3D.shaderEffects.createPropGlowEffect(
      fakeProp,
      {
        color: 0xff6600,
        intensity: intensity,
        particleCount: particleCount,
        particleSize: 0.05,
        position: new THREE.Vector3(x, elevation + 1.5, z),
        height: 0.2,
        radius: 0.15
      }
    );
    
    // Store effect data for cleanup
    if (effectData) {
      this.dungeonElements.push(effectData.container);
    }
  }
  
  return { light, torch };
}

/**
 * Add corridor lighting to guide the player
 */
addCorridorLighting(qualityLevel) {
  // Only add corridor lighting for medium quality and above
  if (qualityLevel === 'low') return;
  
  // Map all room centers
  const roomCenters = this.rooms.map(room => ({
    x: room.centerX,
    z: room.centerZ
  }));
  
  // Skip if fewer than 2 rooms
  if (roomCenters.length < 2) return;
  
  // For each pair of adjacent rooms, place lights along the connection path
  for (let i = 0; i < roomCenters.length - 1; i++) {
    const startPoint = roomCenters[i];
    const endPoint = roomCenters[i + 1];
    
    // Calculate direction vector
    const dirX = endPoint.x - startPoint.x;
    const dirZ = endPoint.z - startPoint.z;
    const distance = Math.sqrt(dirX * dirX + dirZ * dirZ);
    
    // Skip if rooms are very close
    if (distance < 4) continue;
    
    // Normalize direction
    const normalizedDirX = dirX / distance;
    const normalizedDirZ = dirZ / distance;
    
    // Determine number of lights based on distance and quality
    let numLights;
    switch (qualityLevel) {
      case 'ultra':
      case 'high':
        numLights = Math.floor(distance / 3); // Every 3 units
        break;
      case 'medium':
      default:
        numLights = Math.floor(distance / 5); // Every 5 units
    }
    
    // Place lights along path
    for (let j = 1; j < numLights; j++) {
      const t = j / numLights; // Interpolation factor
      const lightX = startPoint.x + dirX * t;
      const lightZ = startPoint.z + dirZ * t;
      
      // Get elevation
      const { elevation } = this.getElevationAtPoint(lightX, lightZ);
      
      // Create subtle guide light
      const light = new THREE.PointLight(0x6688aa, 0.5, 4, 2);
      light.position.set(lightX, elevation + 0.5, lightZ);
      light.userData = { 
        isDungeonElement: true,
        isCorridorLight: true
      };
      
      this.scene3D.scene.add(light);
      this.dungeonElements.push(light);
    }
  }
}

/**
 * Add atmospheric effects like dust particles
 */
addAtmosphericEffects(qualityLevel) {
  // Only add these effects for medium quality and above
  if (qualityLevel === 'low' || !this.scene3D.shaderEffects) return;
  
  console.log(`Adding atmospheric effects for quality level: ${qualityLevel}`);
  
  // Add dust particles in rooms
  this.rooms.forEach(room => {
    // Skip small rooms
    if (room.width * room.height < 16) return;
    
    // Determine particle count based on quality and room size
    let particleCount;
    switch (qualityLevel) {
      case 'ultra':
        particleCount = Math.min(30, Math.floor(room.width * room.height / 4));
        break;
      case 'high':
        particleCount = Math.min(20, Math.floor(room.width * room.height / 6));
        break;
      case 'medium':
      default:
        particleCount = Math.min(10, Math.floor(room.width * room.height / 8));
    }
    
    // Skip if particle count is too low
    if (particleCount < 5) return;
    
    // Create dust effect
    const position = {
      x: room.centerX,
      y: 1.5,
      z: room.centerZ
    };
    
    // Use ShaderEffectsManager to create dust
    if (this.scene3D.shaderEffects.createDustEffect) {
      const dustEffect = this.scene3D.shaderEffects.createDustEffect(
        position, 
        {
          count: particleCount,
          size: 0.03,
          color: 0xaaaaaa,
          lifetime: 15
        }
      );
      
      if (dustEffect && dustEffect.mesh) {
        // Ensure it's marked as a dungeon element for cleanup
        dustEffect.mesh.userData = { 
          ...dustEffect.mesh.userData,
          isDungeonElement: true 
        };
        
        this.dungeonElements.push(dustEffect.mesh);
      }
    }
  });
}


/**
 * Generate room with grid-based content placement
 * @param {number} worldX - Room's X position in world coordinates
 * @param {number} worldZ - Room's Z position in world coordinates
 * @param {number} roomWidth - Width of room in world units
 * @param {number} roomHeight - Height of room in world units
 * @param {boolean} isIrregular - Whether to create an irregular room shape
 * @param {number} irregularityFactor - How irregular the room should be (0-1)
 */
generateRoomWithContent(worldX, worldZ, roomWidth, roomHeight, isIrregular = false, irregularityFactor = 0) {
  // Apply the same coordinate transformation for consistency with the floor/walls
  const adjustedX = worldX - this.dungeonSize / 2;
  const adjustedZ = worldZ - this.dungeonSize / 2;
  
  // Create the room object with correct coordinates
  const room = {
    id: Date.now() + Math.floor(this.seededRandom() * 1000), // Unique ID
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
    hasItem: false,
    isIrregular: isIrregular
  };
  
  this.rooms.push(room);
  
  // Mark room in grid (using original grid coordinates)
  if (isIrregular) {
    // Generate an irregular room shape
    this.generateIrregularRoomGrid(room, irregularityFactor);
  } else {
    // Regular rectangular room
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
    if (hasLargeRoom && this.seededRandom() < 0.7) {
      this.placeEnemyAt(room, room.centerX, room.centerZ);
      room.hasEnemy = true;
    }
    
    // Add additional content spots with adjusted coordinates
    for (let i = 0; i < numContentSpots; i++) {
      // Calculate a position within the room (avoiding edges)
      const padding = 1.0;
      const contentX = adjustedX + padding + this.seededRandom() * (roomWidth - padding * 2);
      const contentZ = adjustedZ + padding + this.seededRandom() * (roomHeight - padding * 2);
      
      // Decide what to place
      if (!room.hasEnemy && this.seededRandom() < 0.6) {
        this.placeEnemyAt(room, contentX, contentZ);
        room.hasEnemy = true;
      } else if (!room.hasItem && this.seededRandom() < 0.4) {
        this.placeItemAt(room, contentX, contentZ);
        room.hasItem = true;
      }
    }
  }
  
  console.log(`Created room at (${adjustedX.toFixed(2)}, ${adjustedZ.toFixed(2)}) with size ${roomWidth.toFixed(2)}x${roomHeight.toFixed(2)}`);
  return room;
}

/**
 * Generate an irregular room shape using cellular automata
 * @param {Object} room - Room object with grid coordinates
 * @param {number} irregularityFactor - How irregular the room should be (0-1)
 */
generateIrregularRoomGrid(room, irregularityFactor) {
  // Create a temporary grid for the room
  const roomGrid = [];
  for (let rx = 0; rx < room.gridWidth; rx++) {
    roomGrid[rx] = [];
    for (let rz = 0; rz < room.gridHeight; rz++) {
      // Walls around the perimeter
      if (rx === 0 || rx === room.gridWidth - 1 || rz === 0 || rz === room.gridHeight - 1) {
        roomGrid[rx][rz] = 1; // Wall
      } else {
        // Random wall placement inside based on irregularity factor
        roomGrid[rx][rz] = this.seededRandom() < irregularityFactor ? 1 : 2; // 1=wall, 2=floor
      }
    }
  }
  
  // Apply cellular automata to smooth the shape
  const iterations = 2;
  for (let i = 0; i < iterations; i++) {
    this.smoothRoomGrid(roomGrid);
  }
  
  // Ensure the center of the room is walkable
  const centerX = Math.floor(room.gridWidth / 2);
  const centerZ = Math.floor(room.gridHeight / 2);
  const centerArea = 2; // Size of guaranteed walkable area at center
  
  for (let rx = centerX - centerArea; rx <= centerX + centerArea; rx++) {
    for (let rz = centerZ - centerArea; rz <= centerZ + centerArea; rz++) {
      if (rx > 0 && rx < room.gridWidth - 1 && rz > 0 && rz < room.gridHeight - 1) {
        roomGrid[rx][rz] = 2; // Set to floor
      }
    }
  }
  
  // Transfer to the main grid
  for (let rx = 0; rx < room.gridWidth; rx++) {
    for (let rz = 0; rz < room.gridHeight; rz++) {
      const gridX = room.gridX + rx;
      const gridZ = room.gridZ + rz;
      
      if (gridX >= 0 && gridX < this.grid.length && gridZ >= 0 && gridZ < this.grid[0].length) {
        this.grid[gridX][gridZ] = roomGrid[rx][rz];
      }
    }
  }
}

/**
 * Apply cellular automata smoothing to a room grid
 * @param {Array} roomGrid - 2D grid to smooth
 */
smoothRoomGrid(roomGrid) {
  const width = roomGrid.length;
  const height = roomGrid[0].length;
  const newGrid = [];
  
  // Initialize new grid
  for (let x = 0; x < width; x++) {
    newGrid[x] = [];
    for (let z = 0; z < height; z++) {
      newGrid[x][z] = roomGrid[x][z];
    }
  }
  
  // Apply smoothing rule
  for (let x = 1; x < width - 1; x++) {
    for (let z = 1; z < height - 1; z++) {
      // Count walls in 3x3 neighborhood
      let wallCount = 0;
      for (let nx = -1; nx <= 1; nx++) {
        for (let nz = -1; nz <= 1; nz++) {
          if (roomGrid[x + nx][z + nz] === 1) {
            wallCount++;
          }
        }
      }
      
      // Apply cellular automata rule
      if (wallCount >= 5) {
        newGrid[x][z] = 1; // Become a wall
      } else if (wallCount <= 3) {
        newGrid[x][z] = 2; // Become a floor
      }
    }
  }
  
  // Keep the perimeter as walls
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {
      if (x === 0 || x === width - 1 || z === 0 || z === height - 1) {
        newGrid[x][z] = 1;
      }
    }
  }
  
  // Copy back to original grid
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {
      roomGrid[x][z] = newGrid[x][z];
    }
  }
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
 * Get monsters from the Bestiary appropriate for the difficulty level
 * @param {string} difficultyLevel - 'easy', 'medium', 'hard', or 'epic'
 * @returns {Array} Array of suitable monsters
 */
getAppropriateMonsters(difficultyLevel) {
  // Map difficulty levels to CR ranges
  const crRanges = {
    'easy': { min: 0, max: 2 },
    'medium': { min: 3, max: 5 },
    'hard': { min: 6, max: 10 },
    'epic': { min: 11, max: 30 }
  };
  
  // Default to medium if not found
  const range = crRanges[difficultyLevel.toLowerCase()] || crRanges['medium'];
  
  // Return empty array if no resource manager
  if (!this.resourceManager || !this.resourceManager.resources?.bestiary) {
    console.warn("No resource manager or bestiary available for monster selection");
    return [];
  }
  
  // Filter monsters by CR range
  const appropriateMonsters = [];
  this.resourceManager.resources.bestiary.forEach((entry, key) => {
    // Get the CR from the entry
    let cr = entry.cr;
    if (typeof cr === 'string') {
      if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(Number);
        cr = num / denom;
      } else {
        cr = parseFloat(cr);
      }
    }
    
    // Check if in range
    if (!isNaN(cr) && cr >= range.min && cr <= range.max) {
      // Add the full entry
      appropriateMonsters.push(entry);
    }
  });
  
  console.log(`Found ${appropriateMonsters.length} monsters suitable for ${difficultyLevel} difficulty (CR ${range.min}-${range.max})`);
  return appropriateMonsters;
}


/**
 * Modified placeEnemyAt method to prevent visual duplication
 * This only creates spawn data without visual markers, avoiding duplication
 */
placeEnemyAt(room, x, z) {
  // Skip if this is marked as a safe room
  if (room.isSafeRoom) {
    console.log(`Skipping enemy placement in safe room ${room.id}`);
    return null;
  }

  // Enemy types based on difficulty
  const enemyTypes = {
    easy: ['goblin', 'skeleton', 'rat'],
    medium: ['orc', 'zombie', 'wolf'],
    hard: ['troll', 'demon', 'wraith'],
    epic: ['dragon', 'lich', 'elder_demon']
  };
  
  const availableEnemies = enemyTypes[this.difficultyLevel] || enemyTypes.medium;
  const enemyType = availableEnemies[Math.floor(this.seededRandom() * availableEnemies.length)];
  
  // Try to get appropriate monsters from Bestiary if resource manager is available
  let monsterEntry = null;
  if (this.resourceManager && this.resourceManager.resources?.bestiary) {
    try {
      // Get monsters suitable for this difficulty level
      const bestiaryMonsters = this.getAppropriateMonsters(this.difficultyLevel);
      
      if (bestiaryMonsters.length > 0) {
        // Use a random monster from the bestiary
        monsterEntry = bestiaryMonsters[Math.floor(this.seededRandom() * bestiaryMonsters.length)];
        console.log(`Selected ${monsterEntry.name} (CR ${monsterEntry.cr}) from bestiary`);
      } else {
        console.log(`No suitable bestiary monsters for difficulty ${this.difficultyLevel}, using fallback: ${enemyType}`);
      }
    } catch (error) {
      console.error("Error selecting monster from bestiary:", error);
    }
  }
  
  // Log placement information for debugging
  console.log(`Recording enemy spawn point: ${monsterEntry ? monsterEntry.name : enemyType} in room at world coords (${x.toFixed(2)}, ${z.toFixed(2)})`);
  
  // Get elevation at this point
  const { elevation } = this.getElevationAtPoint(x, z);
  
  // *** IMPORTANT CHANGE: Instead of creating a visible marker, just record the spawn point data ***
  
  // Record that this room has an enemy
  room.hasEnemy = true;
  
  // Add to spawn points without creating a visible marker
  const spawnPoint = { 
    x, 
    z, 
    y: elevation, // Store elevation for physics
    type: enemyType,
    monsterEntry: monsterEntry, // Store full monster data if available
    monster: monsterEntry?.data, // Direct link to monster data for easy access
    roomId: room.id // Store room association 
  };
  
  // Add to spawn points array
  this.enemySpawnPoints.push(spawnPoint);
  
  console.log(`Recorded enemy spawn point for ${monsterEntry ? monsterEntry.name : enemyType} at (${x.toFixed(2)}, ${z.toFixed(2)}) at elevation ${elevation.toFixed(2)}`);
  
  return spawnPoint;
}


/**
 * Create a token mesh for a monster using its data from the bestiary
 * Configured to work with the encounter system
 * @param {Object} spawnPoint - Enemy spawn point with monster data
 * @returns {THREE.Object3D} The monster token mesh
 */
createMonsterTokenMesh(spawnPoint) {
  if (!spawnPoint) return null;
  
  const monsterEntry = spawnPoint.monsterEntry;
  
  // Construct token data
  const token = {
    x: spawnPoint.x * 50, // Convert to expected coordinate system
    y: spawnPoint.z * 50, // Using z for y in the coordinate conversion
    height: 1.5, // Default height of token above ground
    image: monsterEntry?.thumbnail || '', // Use monster thumbnail if available
    name: monsterEntry?.name || spawnPoint.type || 'Unknown Monster',
    size: monsterEntry?.size ? this.getMonsterSizeMultiplier(monsterEntry.size) : 1
  };
  
  // Debug token data
  console.log("Creating monster token mesh for:", {
    name: token.name,
    position: `${token.x}, ${token.y}`,
    size: token.size || 1,
    height: token.height || 1.5
  });
  
  // Create billboard material  
  let spriteMaterial;
  
  if (token.image) {
    try {
      spriteMaterial = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load(token.image),
        transparent: true,
        sizeAttenuation: true
      });
    } catch (error) {
      console.error("Error loading monster image:", error);
      // Create a colored material as fallback
      spriteMaterial = new THREE.SpriteMaterial({
        color: 0xff0000,
        transparent: true,
        sizeAttenuation: true
      });
    }
  } else {
    // Fallback material if no image available
    spriteMaterial = new THREE.SpriteMaterial({
      color: 0xff0000,
      transparent: true,
      sizeAttenuation: true
    });
  }
  
  const sprite = new THREE.Sprite(spriteMaterial);
  
  // Scale based on token size and grid
  const scale = token.size * (this.cellSize / 2);
  const aspectRatio = 1; // Assume square for now
  sprite.scale.set(scale * aspectRatio, scale, 1);
  
  // Calculate world position with elevation
  const x = spawnPoint.x;
  const z = spawnPoint.z;
  const y = spawnPoint.y + token.height;
  
  sprite.position.set(x, y, z);
  
  // *** IMPORTANT CHANGE: Set up as an encounter type for Scene3DController ***
  sprite.userData = {
    isDungeonElement: true,
    isMonsterToken: true,
    // Use 'encounter' type to work with Scene3DController.animate()
    type: 'encounter',
    // Include monster data in format Scene3DController.handleEncounter() expects
    monster: monsterEntry?.data || this.createMonsterData(spawnPoint.type, this.difficultyLevel),
    // Keep original properties as well
    monsterEntry: monsterEntry,
    enemyType: spawnPoint.type,
    // Add dungeon context
    fromDungeon: true,
    dungeonId: this.dungeonId,
    roomId: spawnPoint.roomId
  };
  
  console.log(`Positioned monster token at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  console.log('Monster token configured for encounter system');
  
  return sprite;
}

/**
 * Create fallback monster data when no bestiary entry is available
 * @param {string} enemyType - Type of enemy
 * @param {string} difficulty - Dungeon difficulty
 * @returns {Object} Monster data object
 */
createMonsterData(enemyType, difficulty) {
  // Basic fallback monster with type-specific properties
  const difficultyMultipliers = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    epic: 3
  };
  
  const multiplier = difficultyMultipliers[difficulty] || 1;
  
  // Create monster template based on type
  const monsterTemplates = {
    goblin: {
      basic: {
        name: "Goblin",
        type: "humanoid",
        size: "small",
        ac: 15,
        hp: 7 * multiplier,
        speed: 30,
        cr: "1/4"
      }
    },
    skeleton: {
      basic: {
        name: "Skeleton",
        type: "undead",
        size: "medium",
        ac: 13,
        hp: 13 * multiplier,
        speed: 30,
        cr: "1/4"
      }
    },
    zombie: {
      basic: {
        name: "Zombie",
        type: "undead",
        size: "medium",
        ac: 8,
        hp: 22 * multiplier,
        speed: 20,
        cr: "1/4"
      }
    },
    orc: {
      basic: {
        name: "Orc",
        type: "humanoid",
        size: "medium",
        ac: 13,
        hp: 15 * multiplier,
        speed: 30,
        cr: "1/2"
      }
    },
    wolf: {
      basic: {
        name: "Wolf",
        type: "beast",
        size: "medium",
        ac: 13,
        hp: 11 * multiplier,
        speed: 40,
        cr: "1/4"
      }
    },
    troll: {
      basic: {
        name: "Troll",
        type: "giant",
        size: "large",
        ac: 15,
        hp: 84 * multiplier,
        speed: 30,
        cr: "5"
      }
    },
    demon: {
      basic: {
        name: "Demon",
        type: "fiend",
        size: "large",
        ac: 15,
        hp: 65 * multiplier,
        speed: 40,
        cr: "4"
      }
    },
    wraith: {
      basic: {
        name: "Wraith",
        type: "undead",
        size: "medium",
        ac: 13,
        hp: 67 * multiplier,
        speed: 0,
        cr: "5"
      }
    },
    dragon: {
      basic: {
        name: "Dragon",
        type: "dragon",
        size: "huge",
        ac: 18,
        hp: 178 * multiplier,
        speed: 40,
        cr: "13"
      }
    },
    lich: {
      basic: {
        name: "Lich",
        type: "undead",
        size: "medium",
        ac: 17,
        hp: 135 * multiplier,
        speed: 30,
        cr: "21"
      }
    }
  };
  
  // Use specific template or generate generic if not found
  const template = monsterTemplates[enemyType] || {
    basic: {
      name: enemyType.charAt(0).toUpperCase() + enemyType.slice(1),
      type: "unknown",
      size: "medium",
      ac: 12,
      hp: 20 * multiplier,
      speed: 30,
      cr: "1"
    }
  };
  
  // Add combat-related properties to be compatible with combat system
  template.combat = {
    abilities: {
      str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
    },
    hitDice: `${Math.ceil(template.basic.hp / 7)}d8`,
    attacks: [
      {
        name: "Attack",
        toHit: Math.floor(multiplier * 3), 
        damage: `1d6+${Math.floor(multiplier)}`
      }
    ]
  };
  
  // Add a unique ID
  template.id = `dungeon-monster-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  return template;
}

/**
 * Get size multiplier for a monster based on its size category
 * @param {string} size - Size category (tiny, small, medium, large, huge, gargantuan)
 * @returns {number} Size multiplier
 */
getMonsterSizeMultiplier(size) {
  const sizeMap = {
    'tiny': 0.5,
    'small': 0.7,
    'medium': 1.0, 
    'large': 1.5,
    'huge': 2.0,
    'gargantuan': 3.0
  };
  
  return sizeMap[size.toLowerCase()] || 1.0;
}

/**
 * Instantiate all monsters in the dungeon based on spawn points
 * This can be called when the player enters the dungeon
 * @param {Object} options - Options for monster instantiation
 * @param {boolean} options.animated - Whether to add animation to monsters
 * @param {boolean} options.withAI - Whether to attach AI controllers to monsters
 * @returns {Array} Array of instantiated monster tokens
 */
instantiateMonsters(options = {}) {
  const enemyCount = this.enemySpawnPoints.length;
  console.log(`Instantiating ${enemyCount} monsters in the dungeon`);
  
  // Clear any existing monster tokens
  if (this.monsterTokens) {
    this.monsterTokens.forEach(token => {
      if (token && token.parent) {
        token.parent.remove(token);
      }
    });
  }
  
  this.monsterTokens = [];
  
  // Create monster tokens with appropriate spacing
  this.enemySpawnPoints.forEach((spawnPoint, index) => {
    try {
      // Create the monster token mesh
      const monsterToken = this.createMonsterTokenMesh(spawnPoint);
      
      if (monsterToken) {
        // Add to scene
        this.scene3D.scene.add(monsterToken);
        this.monsterTokens.push(monsterToken);
        this.dungeonElements.push(monsterToken);
        
        // Add animation if requested
        if (options.animated) {
          this.addMonsterAnimation(monsterToken, spawnPoint);
        }
        
        // Add AI controller if requested and available
        if (options.withAI && this.scene3D.aiController) {
          this.attachAIController(monsterToken, spawnPoint);
        }
        
        console.log(`Instantiated monster #${index+1}: ${spawnPoint.monsterEntry?.name || spawnPoint.type}`);
      }
    } catch (error) {
      console.error(`Error instantiating monster at spawn point #${index}:`, error);
    }
  });
  
  console.log(`Successfully instantiated ${this.monsterTokens.length} of ${enemyCount} monsters`);
  return this.monsterTokens;
}

/**
 * Add animation to a monster token
 * @param {THREE.Object3D} token - The monster token object
 * @param {Object} spawnPoint - The spawn point data
 */
addMonsterAnimation(token, spawnPoint) {
  // Skip if token is invalid
  if (!token) return;
  
  // Simple floating animation
  const startY = token.position.y;
  const floatDistance = 0.1;
  const floatSpeed = 0.5 + Math.random() * 0.5; // Random speed variation
  
  // Store animation data on the token
  token.userData.animation = {
    startY: startY,
    floatDistance: floatDistance,
    floatSpeed: floatSpeed,
    time: Math.random() * Math.PI * 2 // Random start phase
  };
  
  // Add to animation loop if not already present
  if (!this.animatedTokens) {
    this.animatedTokens = [];
    
    // Create animation loop
    const animateTokens = () => {
      const time = performance.now() * 0.001; // Convert to seconds
      
      this.animatedTokens.forEach(animToken => {
        if (animToken && animToken.userData.animation) {
          const anim = animToken.userData.animation;
          animToken.position.y = anim.startY + Math.sin(time * anim.floatSpeed) * anim.floatDistance;
        }
      });
      
      // Continue animation loop
      this.animationFrameId = requestAnimationFrame(animateTokens);
    };
    
    // Start animation loop
    this.animationFrameId = requestAnimationFrame(animateTokens);
  }
  
  // Add token to animated tokens list
  this.animatedTokens.push(token);
}


/**
 * Handles monster encounter completion
 * Called from Scene3DController when a dungeon encounter is completed
 * @param {Object} monsterObj - Monster that was defeated
 * @param {boolean} success - Whether encounter was successful
 */
handleEncounterComplete(monsterObj, success) {
  if (!monsterObj || !success) return;
  
  if (!monsterObj.userData?.fromDungeon) {
    // Not a dungeon monster, ignore
    return;
  }
  
  console.log("Dungeon monster defeated, generating drops");
  
  // Handle the monster's defeat by generating drops
  this.handleMonsterDefeat(monsterObj, monsterObj.position);
  
  // IMPORTANT: Force resume controls after combat with a slight delay
  // This ensures player can move again even if dialog check fails
  setTimeout(() => {
    if (this.scene3D && typeof this.scene3D.resumeControls === 'function') {
      console.log("Forcing controls resume after combat");
      this.scene3D.resumeControls();
      
      // Make sure physics is properly updated
      if (this.scene3D.physics) {
        this.scene3D.physics.update(0.1);
      }
    }
  }, 500); // Half second delay to let other processes complete
}

/**
 * Handle monster defeat and generate loot drops
 * @param {Object} monster - The defeated monster object
 * @param {THREE.Vector3} position - Position where monster was defeated
 * @returns {Array} Array of dropped items
 */
handleMonsterDefeat(monster, position) {
  console.log(`Monster defeated: ${monster.userData?.monster?.basic?.name || 'Unknown Monster'}`);
  
  // Get the position where loot should be dropped
  const dropPosition = position || 
    (monster.position ? monster.position.clone() : new THREE.Vector3(0, 0, 0));
  
  // Keep track of all dropped items
  const droppedItems = [];
  
  // Remove monster from the scene
  if (monster.parent) {
    monster.parent.remove(monster);
  }
  
  // Remove from our tracking arrays
  if (this.monsterTokens) {
    const index = this.monsterTokens.indexOf(monster);
    if (index !== -1) {
      this.monsterTokens.splice(index, 1);
    }
  }
  
  // Add to defeated monsters count
  if (!this.defeatedMonsters) this.defeatedMonsters = [];
  this.defeatedMonsters.push({
    type: monster.userData?.enemyType || 'unknown',
    position: dropPosition.clone(),
    timestamp: Date.now()
  });
  
  // Generate loot based on monster difficulty/type
  this.generateMonsterLoot(monster, dropPosition).forEach(item => {
    if (item) {
      droppedItems.push(item);
    }
  });
  
  return droppedItems;
}

/**
 * Generate appropriate loot for a defeated monster
 * @param {Object} monster - The defeated monster
 * @param {THREE.Vector3} position - Position where loot should spawn
 * @returns {Array} Array of created loot items
 */
generateMonsterLoot(monster, position) {
  // Calculate drop chances based on monster strength
  const challengeRating = this.getMonsterCR(monster);
  const dropChances = {
    remains: 0.9,    // 90% chance of dropping remains
    weapon: 0.1 + (challengeRating * 0.02),  // Base 10% + CR bonus
    armor: 0.05 + (challengeRating * 0.01),  // Base 5% + CR bonus
    valuable: 0.03 + (challengeRating * 0.03) // Base 3% + CR bonus
  };
  
  // Debug drop chances
  console.log(`Monster CR: ${challengeRating}, Drop chances:`, dropChances);
  
  const lootItems = [];
  
  // Try to access resource manager for prop textures
  let propTextures = [];
  if (this.resourceManager && this.resourceManager.resources?.textures?.props) {
    propTextures = Array.from(this.resourceManager.resources.textures.props.values());
    console.log(`Found ${propTextures.length} prop textures for potential loot`);
  }
  
  // Always create remains with high probability (90%)
  if (this.seededRandom() < dropChances.remains) {
    const remainsProp = this.createRemainsProp(position, propTextures);
    if (remainsProp) {
      lootItems.push(remainsProp);
    }
  }
  
  // Check for weapon drop
  if (this.seededRandom() < dropChances.weapon) {
    const weaponProp = this.createWeaponProp(position, propTextures);
    if (weaponProp) {
      lootItems.push(weaponProp);
    }
  }
  
  // Check for armor drop
  if (this.seededRandom() < dropChances.armor) {
    const armorProp = this.createArmorProp(position, propTextures);
    if (armorProp) {
      lootItems.push(armorProp);
    }
  }
  
  return lootItems;
}

/**
 * Create remains prop (bones, body, etc)
 * @param {THREE.Vector3} position - Where to place the remains
 * @param {Array} propTextures - Available prop textures
 * @returns {Object} Created prop object
 */
createRemainsProp(position, propTextures) {
  // Names of remain-type props to look for
  const remainsNames = ['bones', 'deceased', 'corpse', 'remains', 'skull', 'skeleton'];
  
  // Find matching props
  const matchingProps = propTextures.filter(prop => {
    const propName = (prop.name || '').toLowerCase();
    return remainsNames.some(name => propName.includes(name));
  });
  
  // If no matches found, create generic remains
  if (matchingProps.length === 0) {
    return this.createGenericProp('Remains', position, 0xaaaaaa);
  }
  
  // Pick random matching prop
  const selectedProp = matchingProps[Math.floor(this.seededRandom() * matchingProps.length)];
  
  // Create the prop at the position
  const propData = {
    id: `drop-${Date.now()}-${Math.floor(this.seededRandom() * 1000)}`,
    x: position.x * 50 + this.boxWidth * 25,  // Convert to grid coordinates
    y: position.z * 50 + this.boxDepth * 25,
    image: selectedProp.data,
    name: selectedProp.name || 'Remains',
    scale: 1,
    height: 0.05,  // Place at ground level
    isHorizontal: true,  // Lay flat on ground
    rotation: Math.floor(this.seededRandom() * 360),  // Random rotation
    description: "The remains of a fallen creature."
  };
  
  // Create and add the prop to the scene
  return this.createDroppedPropMesh(propData);
}

/**
 * Create weapon prop drop
 * @param {THREE.Vector3} position - Where to place the weapon
 * @param {Array} propTextures - Available prop textures
 * @returns {Object} Created prop object
 */
createWeaponProp(position, propTextures) {
  // Names of weapon-type props to look for
  const weaponTypes = [
    'sword', 'axe', 'hammer', 'club', 'bow', 'dagger', 
    'staff', 'greatsword', 'mace', 'spear', 'wand'
  ];
  
  // Find matching props
  const matchingProps = propTextures.filter(prop => {
    const propName = (prop.name || '').toLowerCase();
    return weaponTypes.some(type => propName.includes(type));
  });
  
  // If no matches found, create generic weapon
  if (matchingProps.length === 0) {
    return this.createGenericProp('Weapon', position, 0x8888ff);
  }
  
  // Pick random matching prop
  const selectedProp = matchingProps[Math.floor(this.seededRandom() * matchingProps.length)];
  
  // Create the prop at the position
  const propData = {
    id: `drop-${Date.now()}-${Math.floor(this.seededRandom() * 1000)}`,
    x: position.x * 50 + this.boxWidth * 25,
    y: position.z * 50 + this.boxDepth * 25,
    image: selectedProp.data,
    name: selectedProp.name || 'Weapon',
    scale: 1,
    height: 0.05,
    isHorizontal: true,
    rotation: Math.floor(this.seededRandom() * 360),
    description: "A weapon dropped by a defeated enemy."
  };
  
  // Create and add the prop to the scene
  return this.createDroppedPropMesh(propData);
}

/**
 * Create armor prop drop
 * @param {THREE.Vector3} position - Where to place the armor
 * @param {Array} propTextures - Available prop textures
 * @returns {Object} Created prop object
 */
createArmorProp(position, propTextures) {
  // Names of armor-type props to look for
  const armorTypes = [
    'shield', 'armor', 'helmet', 'plate', 'mail', 
    'leather', 'gauntlet', 'glove', 'boot'
  ];
  
  // Find matching props
  const matchingProps = propTextures.filter(prop => {
    const propName = (prop.name || '').toLowerCase();
    return armorTypes.some(type => propName.includes(type));
  });
  
  // If no matches found, create generic armor
  if (matchingProps.length === 0) {
    return this.createGenericProp('Shield', position, 0x88ff88);
  }
  
  // Pick random matching prop
  const selectedProp = matchingProps[Math.floor(this.seededRandom() * matchingProps.length)];
  
  // Create the prop at the position
  const propData = {
    id: `drop-${Date.now()}-${Math.floor(this.seededRandom() * 1000)}`,
    x: position.x * 50 + this.boxWidth * 25,
    y: position.z * 50 + this.boxDepth * 25,
    image: selectedProp.data,
    name: selectedProp.name || 'Armor',
    scale: 1,
    height: 0.05,
    isHorizontal: true,
    rotation: Math.floor(this.seededRandom() * 360),
    description: "Armor dropped by a defeated enemy."
  };
  
  // Create and add the prop to the scene
  return this.createDroppedPropMesh(propData);
}

/**
 * Create a generic prop when no specific textures are available
 * @param {string} name - Name for the prop
 * @param {THREE.Vector3} position - Where to place the prop
 * @param {number} color - Color for the generic prop
 * @returns {Object} Created prop object
 */
createGenericProp(name, position, color) {
  // Create a simple colored plane as fallback
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: color || 0xaaaaaa,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // Lay flat
  
  // Position at provided location
  mesh.position.set(
    position.x,
    position.y + 0.01, // Slightly above ground
    position.z
  );
  
  // Add standard prop information
  mesh.userData = {
    type: 'prop',
    id: `generic-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name,
    description: `A ${name.toLowerCase()} from a defeated monster.`,
    isHorizontal: true
  };
  
  // Add to scene and tracking
  this.scene3D.scene.add(mesh);
  this.dungeonElements.push(mesh);
  
  return mesh;
}

/**
 * Create a dropped prop using the existing prop creation system
 * @param {Object} propData - Prop data
 * @returns {Promise<Object>} Created prop mesh
 */
createDroppedPropMesh(propData) {
  // Adjust position for slight randomness
  propData.x += (this.seededRandom() - 0.5) * 25; // +/- 25 grid units randomness
  propData.y += (this.seededRandom() - 0.5) * 25;
  
  // Use Scene3DController's existing prop creation system if available
  if (this.scene3D.createPropMesh) {
    return this.scene3D.createPropMesh(propData)
      .then(mesh => {
        if (mesh) {
          this.scene3D.scene.add(mesh);
          this.dungeonElements.push(mesh);
          
          // Make sure it's horizontal
          mesh.rotation.x = -Math.PI / 2;
          
          // Auto-add to tracking
          return mesh;
        }
        return null;
      })
      .catch(error => {
        console.error("Error creating dropped prop:", error);
        return null;
      });
  }
  
  // Fallback - create generic prop
  return Promise.resolve(this.createGenericProp(propData.name, 
    new THREE.Vector3(propData.x / 50 - this.boxWidth / 2, 0.01, propData.y / 50 - this.boxDepth / 2)));
}

/**
 * Get monster's challenge rating for loot calculation
 * @param {Object} monster - Monster object
 * @returns {number} Numeric challenge rating
 */
getMonsterCR(monster) {
  let cr = 0;
  
  try {
    // Try to get CR from different possible locations
    const monsterData = monster.userData?.monster;
    
    if (monsterData?.basic?.cr) {
      cr = this.parseCR(monsterData.basic.cr);
    } else if (monsterData?.cr) {
      cr = this.parseCR(monsterData.cr);
    } else {
      // Estimate from level or HP
      cr = (monsterData?.basic?.level || 1) / 4;
      
      // If has HP, use that as fallback calculation
      if (monsterData?.basic?.hp) {
        cr = Math.max(cr, monsterData.basic.hp / 30);
      }
    }
  } catch (e) {
    console.warn("Error calculating monster CR:", e);
    cr = 1; // Default CR for simplicity
  }
  
  return Math.max(0.1, cr); // Ensure minimal CR of 0.1
}

/**
 * Parse challenge rating from string or number format
 * @param {string|number} cr - Challenge rating
 * @returns {number} Numeric challenge rating
 */
parseCR(cr) {
  if (typeof cr === 'number') return cr;
  
  // Handle string formats like "1/4", "1/2", "13", etc.
  if (typeof cr === 'string') {
    if (cr.includes('/')) {
      // Fractional CR
      const [num, denom] = cr.split('/').map(Number);
      return num / denom;
    } else {
      // Regular numeric CR
      return parseFloat(cr);
    }
  }
  
  return 1; // Default
}

/**
 * Attach AI controller to monster if available
 * @param {THREE.Object3D} token - The monster token object
 * @param {Object} spawnPoint - The spawn point data
 */
attachAIController(token, spawnPoint) {
  // Skip if no AI controller available
  if (!this.scene3D.aiController) return;
  
  // Get monster data from spawn point
  const monsterData = spawnPoint.monsterEntry?.data || {
    type: spawnPoint.type,
    difficulty: this.difficultyLevel
  };
  
  // Create AI controller parameters based on monster type
  const aiParams = {
    position: new THREE.Vector3(token.position.x, token.position.y, token.position.z),
    patrolRadius: 2 + Math.random() * 3, // Random patrol radius 2-5 units
    aggroRadius: 8, // Distance at which monster detects player
    monster: monsterData,
    tokenObject: token
  };
  
  // Attach AI controller
  try {
    const aiController = this.scene3D.aiController.createMonsterAI(aiParams);
    if (aiController) {
      token.userData.aiController = aiController;
      console.log(`AI controller attached to ${spawnPoint.monsterEntry?.name || spawnPoint.type}`);
    }
  } catch (error) {
    console.error("Failed to attach AI controller:", error);
  }
}

/**
 * Clean up all monster-related resources
 */
cleanupMonsters() {
  // Cancel animation loop if running
  if (this.animationFrameId) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
  
  // Clear animation data
  this.animatedTokens = [];
  
  // Remove all monster tokens from scene
  if (this.monsterTokens) {
    this.monsterTokens.forEach(token => {
      if (token && token.parent) {
        // Cleanup AI controller if present
        if (token.userData.aiController && token.userData.aiController.cleanup) {
          token.userData.aiController.cleanup();
        }
        
        // Remove from scene
        token.parent.remove(token);
        
        // Dispose of resources
        if (token.material) {
          if (Array.isArray(token.material)) {
            token.material.forEach(m => m.dispose());
          } else {
            token.material.dispose();
          }
        }
        
        if (token.geometry) {
          token.geometry.dispose();
        }
      }
    });
  }
  
  this.monsterTokens = [];
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