// DungeonGenerator.js
class DungeonGenerator {
    constructor(scene3D, resourceManager) {
        this.scene3D = scene3D;
        this.resourceManager = resourceManager;
        this.physics = scene3D.physics;
        
        // Dungeon parameters
        this.roomSizeMin = 5;
        this.roomSizeMax = 12;
        this.corridorWidth = 2;
        this.maxRooms = 8;
        this.dungeonSize = 50; // Size of the overall dungeon area
        this.cellSize = 1; // Size of each grid cell in world units
        this.wallHeight = 4;
        
        // Key locations
        this.playerSpawnPoint = null;
        this.exitPoint = null;
        this.enemySpawnPoints = [];
        
        // Grid representation of dungeon (0 = empty, 1 = wall, 2 = floor)
        this.grid = [];
        
        // Keep track of rooms for enemy placement
        this.rooms = [];
    }

    // Add this method to DungeonGenerator class (around line 28)
configureDifficulty(difficulty) {
    console.log(`Setting dungeon difficulty to: ${difficulty}`);
    
    // Adjust dungeon parameters based on difficulty
    switch(difficulty.toLowerCase()) {
      case 'easy':
        this.maxRooms = 6;
        this.roomSizeMax = 10;
        this.enemyCount = 3;
        break;
        
      case 'medium':
        this.maxRooms = 8;
        this.roomSizeMax = 12;
        this.enemyCount = 5;
        break;
        
      case 'hard':
        this.maxRooms = 10;
        this.roomSizeMax = 15;
        this.enemyCount = 8;
        break;
        
      case 'epic':
        this.maxRooms = 12;
        this.roomSizeMax = 18;
        this.enemyCount = 12;
        break;
        
      default:
        // Use default settings
        this.maxRooms = 8;
        this.enemyCount = 5;
    }
  }
    
    // Main creation method
    createNew() {
        this.clearExistingDungeon();
        this.initializeGrid();
        this.generateRooms();
        this.connectRooms();
        this.finalizeLayout();
        this.buildDungeon3D();
        this.placeDungeonElements();
        
        return {
            playerSpawnPoint: this.playerSpawnPoint,
            exitPoint: this.exitPoint,
            enemySpawnPoints: this.enemySpawnPoints
        };
    }
    
    clearExistingDungeon() {
        // Remove any existing dungeon elements from scene
        const dungeonObjects = this.scene3D.scene.children.filter(obj => 
            obj.userData && obj.userData.isDungeonElement);
        
        dungeonObjects.forEach(obj => {
            this.scene3D.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
    
    initializeGrid() {
        // Initialize the grid with empty space
        this.grid = [];
        for (let x = 0; x < this.dungeonSize; x++) {
            this.grid[x] = [];
            for (let z = 0; z < this.dungeonSize; z++) {
                this.grid[x][z] = 0; // 0 = empty
            }
        }
    }
    
    generateRooms() {
        console.log('Generating dungeon rooms...');
        this.rooms = [];
        const center = Math.floor(this.dungeonSize / 2);
        
        // Ensure we create at least 3 rooms
        let roomsCreated = 0;
        const minRequiredRooms = 3;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (roomsCreated < minRequiredRooms && attempts < maxAttempts) {
            attempts++;
            const roomWidth = Math.floor(Math.random() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
            const roomHeight = Math.floor(Math.random() * (this.roomSizeMax - this.roomSizeMin)) + this.roomSizeMin;
            
            // Start with rooms more centered, then spread outward
            const spreadFactor = (i / this.maxRooms) * 0.7 + 0.3;
            const maxOffset = Math.floor((this.dungeonSize - Math.max(roomWidth, roomHeight)) / 2 * spreadFactor);
            
            const x = center + Math.floor(Math.random() * maxOffset * 2) - maxOffset;
            const z = center + Math.floor(Math.random() * maxOffset * 2) - maxOffset;
            
            // Check for overlap with existing rooms (with buffer space)
            let overlaps = false;
            const buffer = 2; // Buffer space between rooms
            
            for (const room of this.rooms) {
                if (
                    x - buffer < room.x + room.width + buffer &&
                    x + roomWidth + buffer > room.x - buffer &&
                    z - buffer < room.z + room.height + buffer &&
                    z + roomHeight + buffer > room.z - buffer
                ) {
                    overlaps = true;
                    break;
                }
            }
            
            if (!overlaps && 
                x > 0 && x + roomWidth < this.dungeonSize && 
                z > 0 && z + roomHeight < this.dungeonSize) {
                
                roomsCreated++;
                console.log(`Created room ${roomsCreated}: ${roomWidth}x${roomHeight} at (${x},${z})`);
               
                
                // Add the room to our list
                const room = {
                    x, 
                    z, 
                    width: roomWidth, 
                    height: roomHeight,
                    centerX: x + Math.floor(roomWidth / 2),
                    centerZ: z + Math.floor(roomHeight / 2)
                };
                this.rooms.push(room);
                
                // Mark this room in our grid
                for (let rx = 0; rx < roomWidth; rx++) {
                    for (let rz = 0; rz < roomHeight; rz++) {
                        // Floor
                        this.grid[x + rx][z + rz] = 2;
                        
                        // Mark walls around the room
                        if (rx === 0 || rx === roomWidth - 1 || rz === 0 || rz === roomHeight - 1) {
                            // Skip corners for more natural corridor intersections
                            if (!((rx === 0 && rz === 0) || 
                                 (rx === 0 && rz === roomHeight - 1) || 
                                 (rx === roomWidth - 1 && rz === 0) || 
                                 (rx === roomWidth - 1 && rz === roomHeight - 1))) {
                                this.grid[x + rx][z + rz] = 1; // Wall
                            }
                        }
                    }
                }
            }
        }
    }
    
    connectRooms() {
        // Connect rooms with corridors
        if (this.rooms.length <= 1) return;
        
        // Sort rooms by distance from center
        const center = Math.floor(this.dungeonSize / 2);
        this.rooms.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.centerX - center, 2) + Math.pow(a.centerZ - center, 2));
            const distB = Math.sqrt(Math.pow(b.centerX - center, 2) + Math.pow(b.centerZ - center, 2));
            return distA - distB;
        });
        
        // Connect each room to the next closest one
        for (let i = 0; i < this.rooms.length - 1; i++) {
            const roomA = this.rooms[i];
            const roomB = this.rooms[i + 1];
            
            // Create an L-shaped corridor between rooms
            this.createCorridor(roomA, roomB);
        }
        
        // Add a few random connections for more interesting layouts
        if (this.rooms.length > 3) {
            const extraConnections = Math.min(3, Math.floor(this.rooms.length / 2));
            
            for (let i = 0; i < extraConnections; i++) {
                const idxA = Math.floor(Math.random() * this.rooms.length);
                let idxB = Math.floor(Math.random() * this.rooms.length);
                
                // Make sure we're not connecting a room to itself
                while (idxB === idxA) {
                    idxB = Math.floor(Math.random() * this.rooms.length);
                }
                
                this.createCorridor(this.rooms[idxA], this.rooms[idxB]);
            }
        }
    }
    
    createCorridor(roomA, roomB) {
        // Create an L-shaped corridor between rooms
        const startX = roomA.centerX;
        const startZ = roomA.centerZ;
        const endX = roomB.centerX;
        const endZ = roomB.centerZ;
        
        // Decide whether to go X then Z, or Z then X
        const goXFirst = Math.random() > 0.5;
        
        // Helper to carve corridor sections
        const carveCorridor = (x1, z1, x2, z2) => {
            const w = this.corridorWidth;
            const isHorizontal = z1 === z2;
            
            if (isHorizontal) {
                const minX = Math.min(x1, x2);
                const maxX = Math.max(x1, x2);
                
                for (let x = minX; x <= maxX; x++) {
                    // Carve the main corridor
                    for (let offset = 0; offset < w; offset++) {
                        const z = z1 - Math.floor(w/2) + offset;
                        if (this.isInBounds(x, z)) {
                            // Don't override existing floors
                            if (this.grid[x][z] !== 2) {
                                this.grid[x][z] = 2; // Floor
                            }
                        }
                    }
                    
                    // Add walls along the corridor
                    for (let offset = 0; offset < w + 2; offset++) {
                        const z = z1 - Math.floor(w/2) - 1 + offset;
                        if (this.isInBounds(x, z) && 
                            (offset === 0 || offset === w + 1) && 
                            this.grid[x][z] !== 2) {
                            this.grid[x][z] = 1; // Wall
                        }
                    }
                }
            } else {
                const minZ = Math.min(z1, z2);
                const maxZ = Math.max(z1, z2);
                
                for (let z = minZ; z <= maxZ; z++) {
                    // Carve the main corridor
                    for (let offset = 0; offset < w; offset++) {
                        const x = x1 - Math.floor(w/2) + offset;
                        if (this.isInBounds(x, z)) {
                            // Don't override existing floors
                            if (this.grid[x][z] !== 2) {
                                this.grid[x][z] = 2; // Floor
                            }
                        }
                    }
                    
                    // Add walls along the corridor
                    for (let offset = 0; offset < w + 2; offset++) {
                        const x = x1 - Math.floor(w/2) - 1 + offset;
                        if (this.isInBounds(x, z) && 
                            (offset === 0 || offset === w + 1) && 
                            this.grid[x][z] !== 2) {
                            this.grid[x][z] = 1; // Wall
                        }
                    }
                }
            }
        };
        
        // Create the L-shaped corridor
        if (goXFirst) {
            carveCorridor(startX, startZ, endX, startZ);
            carveCorridor(endX, startZ, endX, endZ);
        } else {
            carveCorridor(startX, startZ, startX, endZ);
            carveCorridor(startX, endZ, endX, endZ);
        }
    }
    
    isInBounds(x, z) {
        return x >= 0 && x < this.dungeonSize && z >= 0 && z < this.dungeonSize;
    }
    
    finalizeLayout() {
        // Ensure walls around all floor tiles
        for (let x = 0; x < this.dungeonSize; x++) {
            for (let z = 0; z < this.dungeonSize; z++) {
                if (this.grid[x][z] === 2) { // Floor tile
                    // Check all 8 surrounding tiles
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (dx === 0 && dz === 0) continue;
                            
                            const nx = x + dx;
                            const nz = z + dz;
                            
                            if (this.isInBounds(nx, nz) && this.grid[nx][nz] === 0) {
                                this.grid[nx][nz] = 1; // Wall
                            }
                        }
                    }
                }
            }
        }
        
        // Choose spawn point (first room)
        if (this.rooms.length > 0) {
            const spawnRoom = this.rooms[0];
            this.playerSpawnPoint = new THREE.Vector3(
                (spawnRoom.centerX - this.dungeonSize / 2) * this.cellSize,
                0,
                (spawnRoom.centerZ - this.dungeonSize / 2) * this.cellSize
            );
            
            // Choose exit point (last room)
            const exitRoom = this.rooms[this.rooms.length - 1];
            this.exitPoint = new THREE.Vector3(
                (exitRoom.centerX - this.dungeonSize / 2) * this.cellSize,
                0,
                (exitRoom.centerZ - this.dungeonSize / 2) * this.cellSize
            );
        }
    }
    
    buildDungeon3D() {
        // Create merged geometry for better performance
        const floorGeometry = new THREE.BoxGeometry(this.cellSize, 0.1, this.cellSize);
        const wallGeometry = new THREE.BoxGeometry(this.cellSize, this.wallHeight, this.cellSize);
        
// Load textures with fallbacks
let floorTextures = [];
let wallTextures = [];

// Try to load from resource manager, use fallbacks if not available
try {
    // Try to get floor textures
    const floor1 = this.resourceManager.getTexture('DungeonFloor1.png');
    const floor2 = this.resourceManager.getTexture('DungeonFloor2.png');
    
    // Check if textures were found
    if (floor1 && floor2) {
        floorTextures = [floor1, floor2];
        console.log('Found dungeon floor textures in resource manager');
    } else {
        // Create default textures if not found
        console.log('Creating default floor textures');
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Floor texture 1 - simple gray grid
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 2;
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
        const defaultFloor1 = new THREE.CanvasTexture(canvas);
        
        // Floor texture 2 - different pattern
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = '#666666';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#555555';
        for (let i = 0; i < 128; i += 32) {
            for (let j = 0; j < 128; j += 32) {
                if ((i + j) % 64 === 0) {
                    ctx.fillRect(i, j, 16, 16);
                }
            }
        }
        const defaultFloor2 = new THREE.CanvasTexture(canvas);
        
        floorTextures = [defaultFloor1, defaultFloor2];
    }
    
    // Try to get wall textures
    const wall1 = this.resourceManager.getTexture('DungeonWall1.png');
    const wall2 = this.resourceManager.getTexture('DungeonWall2.png');
    
    // Check if textures were found
    if (wall1 && wall2) {
        wallTextures = [wall1, wall2];
        console.log('Found dungeon wall textures in resource manager');
    } else {
        // Create default textures if not found
        console.log('Creating default wall textures');
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Wall texture 1 - stone blocks
        ctx.fillStyle = '#777777';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 4;
        for (let i = 0; i < 128; i += 32) {
            for (let j = 0; j < 128; j += 32) {
                ctx.strokeRect(i, j, 32, 32);
            }
        }
        const defaultWall1 = new THREE.CanvasTexture(canvas);
        
        // Wall texture 2 - different pattern
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        for (let i = 0; i < 128; i += 16) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(128, i);
            ctx.stroke();
        }
        const defaultWall2 = new THREE.CanvasTexture(canvas);
        
        wallTextures = [defaultWall1, defaultWall2];
    }
} catch (e) {
    console.warn('Error loading textures:', e);
    // Create very simple fallback textures
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Simple floor texture
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, 64, 64);
    const simpleFloor = new THREE.CanvasTexture(canvas);
    
    // Simple wall texture
    ctx.fillStyle = '#777777';
    ctx.fillRect(0, 0, 64, 64);
    const simpleWall = new THREE.CanvasTexture(canvas);
    
    floorTextures = [simpleFloor, simpleFloor];
    wallTextures = [simpleWall, simpleWall];
}

// Process all textures for proper tiling
floorTextures.forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
});

wallTextures.forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, this.wallHeight / this.cellSize);
});

// Create floor and walls using instanced meshes for better performance
const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTextures[0],
    roughness: 0.8
});

const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTextures[0],
    roughness: 0.6
});
        
        // Draw dungeon in 3D
        for (let x = 0; x < this.dungeonSize; x++) {
            for (let z = 0; z < this.dungeonSize; z++) {
                const worldX = (x - this.dungeonSize / 2) * this.cellSize;
                const worldZ = (z - this.dungeonSize / 2) * this.cellSize;
                
                if (this.grid[x][z] === 2) {
                    // Create floor
                    const floorMesh = new THREE.Mesh(
                        floorGeometry,
                        new THREE.MeshStandardMaterial({
                            map: floorTextures[Math.floor(Math.random() * floorTextures.length)],
                            roughness: 0.8
                        })
                    );
                    floorMesh.position.set(worldX, 0, worldZ);
                    floorMesh.receiveShadow = true;
                    floorMesh.userData = { 
                        isDungeonElement: true,
                        isFloor: true
                    };
                    this.scene3D.scene.add(floorMesh);
                    
                    // Add collider if needed
                    if (this.physics) {
                        this.physics.addFloor(worldX, 0, worldZ, this.cellSize, this.cellSize);
                    }
                } 
                else if (this.grid[x][z] === 1) {
                    // Create wall
                    const wallMesh = new THREE.Mesh(
                        wallGeometry,
                        new THREE.MeshStandardMaterial({
                            map: wallTextures[Math.floor(Math.random() * wallTextures.length)],
                            roughness: 0.6
                        })
                    );
                    wallMesh.position.set(worldX, this.wallHeight / 2, worldZ);
                    wallMesh.castShadow = true;
                    wallMesh.receiveShadow = true;
                    wallMesh.userData = { 
                        isDungeonElement: true,
                        isWall: true,
                        isRegularWall: true,
                        blockHeight: this.wallHeight
                    };
                    this.scene3D.scene.add(wallMesh);
                    
                    // Add collider
                    // if (this.physics) {
                    //     this.physics.addWall(worldX, 0, worldZ, this.cellSize, this.wallHeight);
                    // }

                    if (this.physics) {
                        if (typeof this.physics.addWall === 'function') {
                            this.physics.addWall(worldX, 0, worldZ, this.cellSize, this.wallHeight);
                        } else {
                            // Log warning only once
                            if (!this._physicsFunctionsWarningLogged) {
                                console.warn('Physics system missing addWall method - using alternative collision detection');
                                this._physicsFunctionsWarningLogged = true;
                            }
                            
                            // Alternative: Use checkCollision method if available
                            if (typeof this.physics.addCollisionBox === 'function') {
                                this.physics.addCollisionBox(worldX, this.wallHeight/2, worldZ, this.cellSize, this.wallHeight, this.cellSize);
                            }
                        }
                    }
                }
            }
        }
    }
    
    placeDungeonElements() {
        // Place enemies in rooms, except the first and last rooms
        const enemyRooms = [...this.rooms];
        enemyRooms.shift(); // Remove first room (player spawn)
        enemyRooms.pop(); // Remove last room (exit)
        
        this.enemySpawnPoints = [];
        
        // Place 1-3 enemies per room depending on size
        enemyRooms.forEach(room => {
            const roomArea = room.width * room.height;
            const enemyCount = Math.min(3, Math.max(1, Math.floor(roomArea / 15)));
            
            for (let i = 0; i < enemyCount; i++) {
                // Find a valid position within the room (not too close to walls)
                const offsetX = Math.floor(Math.random() * (room.width - 4)) + 2;
                const offsetZ = Math.floor(Math.random() * (room.height - 4)) + 2;
                
                const worldX = (room.x + offsetX - this.dungeonSize / 2) * this.cellSize;
                const worldZ = (room.z + offsetZ - this.dungeonSize / 2) * this.cellSize;
                
                this.enemySpawnPoints.push(new THREE.Vector3(worldX, 0, worldZ));
            }
        });
        
        // Create visual markers for spawn and exit
        this.createSpawnMarker();
        this.createExitMarker();
        
        // Place enemy markers for visualization
        this.createEnemyMarkers();
    }
    
    createSpawnMarker() {
        if (!this.playerSpawnPoint) return;
        
        // Create a visual indicator for the player spawn point
        const spawnGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const spawnMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        
        const spawnMarker = new THREE.Mesh(spawnGeometry, spawnMaterial);
        spawnMarker.position.set(
            this.playerSpawnPoint.x, 
            0.05, 
            this.playerSpawnPoint.z
        );
        spawnMarker.userData = { isDungeonElement: true, isSpawnMarker: true };
        this.scene3D.scene.add(spawnMarker);
    }
    
    createExitMarker() {
        if (!this.exitPoint) return;
        
        // Create a visual indicator for the exit point
        const exitGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const exitMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        
        const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
        exitMarker.position.set(
            this.exitPoint.x, 
            0.05, 
            this.exitPoint.z
        );
        exitMarker.userData = { 
            isDungeonElement: true, 
            isExitMarker: true,
            isInteractive: true,
            interactionType: 'exit'
        };
        this.scene3D.scene.add(exitMarker);
    }
    
    createEnemyMarkers() {
        // Create visual indicators for enemy spawn points
        this.enemySpawnPoints.forEach(point => {
            const enemyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
            const enemyMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xff9900,
                emissive: 0xff9900,
                emissiveIntensity: 0.5
            });
            
            const enemyMarker = new THREE.Mesh(enemyGeometry, enemyMaterial);
            enemyMarker.position.set(point.x, 0.05, point.z);
            enemyMarker.userData = { 
                isDungeonElement: true, 
                isEnemyMarker: true,
                isInteractive: true,
                interactionType: 'enemy'
            };
            this.scene3D.scene.add(enemyMarker);
        });
    }
    
    // Helper method to test if a position is walkable
    isPositionWalkable(worldX, worldZ) {
        const gridX = Math.floor(worldX / this.cellSize + this.dungeonSize / 2);
        const gridZ = Math.floor(worldZ / this.cellSize + this.dungeonSize / 2);
        
        if (!this.isInBounds(gridX, gridZ)) return false;
        
        return this.grid[gridX][gridZ] === 2; // Floor is walkable
    }
    
    // Method to teleport player to the dungeon
    teleportPlayerToDungeon() {
        if (!this.playerSpawnPoint) return false;
        
        // Set player position to spawn point
        this.scene3D.camera.position.set(
            this.playerSpawnPoint.x,
            this.scene3D.physics.playerHeight,
            this.playerSpawnPoint.z
        );
        
        // Reset any physics state
        this.scene3D.physics.currentGroundHeight = 0;
        this.scene3D.physics.isJumping = false;
        this.scene3D.physics.isFalling = false;
        
        return true;
    }




}

window.DungeonGenerator = DungeonGenerator;
// export default DungeonGenerator;