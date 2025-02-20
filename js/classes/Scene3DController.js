class Scene3DController {
  constructor() {
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false
    };
    this.PLAYER_EYE_HEIGHT = 1.7;
    this.teleporters = [];
    this.clear();
  }

  clear() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrameId = null;
    this.isActive = false;
    this.keyHandlers = {
      keydown: null,
      keyup: null
    };
    this.keys = {};
  }

  initialize(container, width, height) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 6, 50); // Adjusted starting position

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new THREE.PointerLockControls(this.camera, container);

    // Setup key handlers
    this.keyHandlers.keydown = (e) =>
      (this.keys[e.key.toLowerCase()] = true);
    this.keyHandlers.keyup = (e) =>
      (this.keys[e.key.toLowerCase()] = false);

    document.addEventListener("keydown", this.keyHandlers.keydown);
    document.addEventListener("keyup", this.keyHandlers.keyup);

    this.isActive = true;
  }

  cleanup() {
    this.isActive = false;
  
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  
    // Clean up teleport prompt
    if (this.teleportPrompt) {
      this.teleportPrompt.remove();
      this.teleportPrompt = null;
    }
    this.activeTeleporter = null;
  
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement?.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  
    if (this.controls) {
      this.controls.dispose();
    }
  
    if (this.keyHandlers.keydown) {
      document.removeEventListener("keydown", this.keyHandlers.keydown);
    }
    if (this.keyHandlers.keyup) {
      document.removeEventListener("keyup", this.keyHandlers.keyup);
    }
  
    // Clean up all scene objects
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  
    this.clear();
  }

  initializeWithData(data) {
    if (!data) return;

    // Store references to essential data
    this.rooms = data.rooms || [];  // Keep rooms terminology
    this.textures = data.textures || {};
    this.tokens = data.tokens || [];
    this.cellSize = data.cellSize || 50;
    this.playerStart = data.playerStart || null;
    this.baseImage = data.baseImage || null;
    this.markers = data.markers || [];
    this.textureManager = data.textureManager;
    this.props = data.props || [];

    // Initialize physics
    this.physics = new PhysicsController(this);

    // Get texture rooms if they exist
    this.wallTextureRoom = this.rooms.find(room => room.name === "WallTexture");
    this.roomTextureRoom = this.rooms.find(room => room.name === "RoomTexture");

    // Create textures from the texture rooms
    if (this.wallTextureRoom) {
      this.wallTexture = this.createTextureFromRoom(this.wallTextureRoom);
    }
    if (this.roomTextureRoom) {
      this.roomTexture = this.createTextureFromRoom(this.roomTextureRoom);
    }

    // Store dimensions for calculations
    this.boxWidth = this.baseImage ? this.baseImage.width / 50 : 20;
    this.boxDepth = this.baseImage ? this.baseImage.height / 50 : 20;
    this.boxHeight = 4.5;

    // Setup render state
    this.renderState = {
      clippingEnabled: false
    };

    // Initialize movement state
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false,
      shiftHeld: false
    };

    return true;
  }

// Updated createPropMesh method for Scene3DController.js
createPropMesh(propData) {
  console.log("Creating prop mesh:", {
    position: `${propData.x}, ${propData.y}`,
    texture: !!propData.image,
    rotation: propData.rotation || 0,
    scale: propData.scale || 1.0,
    height: propData.height || 1.0
  });

  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      propData.image,
      (texture) => {
        // Calculate dimensions based on texture aspect ratio
        let width, height;
        
        if (texture.image) {
          const aspectRatio = texture.image.width / texture.image.height;
          width = propData.scale || 1;
          height = width / aspectRatio;
        } else {
          // Fallback if image dimensions aren't available
          width = propData.scale || 1;
          height = propData.scale || 1;
        }
        
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          alphaTest: 0.1 // Help with transparency sorting
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position in world space
        const x = propData.x / 50 - this.boxWidth / 2;
        const z = propData.y / 50 - this.boxDepth / 2;
        
        // Get elevation at this point
        const { elevation } = this.getElevationAtPoint(x, z);
        
        // The height value should determine vertical position from the ground or elevation
        // Add elevation to the specified height - divide height by 2 since the plane's origin is at its center
        const y = elevation + ((height / 2) * (propData.height || 1.0));
        
        mesh.position.set(x, y, z);
        
        // Rotate based on provided rotation
        const rotationRad = (propData.rotation || 0) * Math.PI / 180;
        mesh.rotation.y = rotationRad;
        
        // Add metadata
        mesh.userData = {
          type: 'prop',
          id: propData.id
        };
        
        resolve(mesh);
      },
      undefined,
      (error) => {
        console.error("Error loading prop texture:", error);
        reject(error);
      }
    );
  });
}

  createTextureFromArea(room) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = room.bounds.width;
    canvas.height = room.bounds.height;

    // Draw the portion of the map that contains the texture
    ctx.drawImage(
      this.baseImage,  // Changed from this.mapEditor.baseImage
      room.bounds.x,
      room.bounds.y,
      room.bounds.width,
      room.bounds.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
  }

  createTextureFromRoom(textureRoom) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = textureRoom.bounds.width;
    canvas.height = textureRoom.bounds.height;

    // Draw the portion of the map that contains the texture
    ctx.drawImage(
      this.baseImage,
      textureRoom.bounds.x,
      textureRoom.bounds.y,
      textureRoom.bounds.width,
      textureRoom.bounds.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Calculate repeats based on grid cell size
    const horizontalRepeats = Math.round(
      textureRoom.bounds.width / this.cellSize
    );
    const verticalRepeats = Math.round(
      textureRoom.bounds.height / this.cellSize
    );

    texture.repeat.set(horizontalRepeats, verticalRepeats);
    texture.needsUpdate = true;

    return texture;
  }


  // Modify the createTokenMesh method to handle elevation
  createTokenMesh(token) {
    // Debug token data
    console.log("Creating token mesh for:", {
      name: token.name,
      position: `${token.x}, ${token.y}`,
      size: token.size || 1,
      height: token.height || 2
    });
  
    // Create billboard material  
    const spriteMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load(token.image),
      transparent: true,
      sizeAttenuation: true
    });
  
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Scale based on token size and grid
    const scale = token.size * (this.cellSize / 50);
    const aspectRatio = 1; // Assume square for now
    sprite.scale.set(scale * aspectRatio, scale, 1);
  
    // Calculate world position  
    const x = token.x / 50 - this.boxWidth / 2;
    const z = token.y / 50 - this.boxDepth / 2;
    
    // Get elevation at token position
    const { elevation, isInside } = this.getElevationAtPoint(x, z);
    
    // Set y position - tokens inside walls stay at normal height,
    // tokens on raised blocks get placed on top
    let y = token.height || 2;
    if (!isInside && elevation > 0) {
      y = elevation + (token.size || 1);
    }

    if (token.type === "prop") {
      // Create billboard material with the prop texture
      const spriteMaterial = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load(token.image),
        transparent: true,
        sizeAttenuation: true
      });
    
      const sprite = new THREE.Sprite(spriteMaterial);
      
      // Scale based on prop size
      const scale = token.scale || 1;
      const aspectRatio = token.aspect || 1;
      sprite.scale.set(scale * aspectRatio, scale, 1);
    
      // Position at grid location
      const x = token.x / 50 - this.boxWidth / 2;
      const z = token.y / 50 - this.boxDepth / 2;
      const { elevation } = this.getElevationAtPoint(x, z);
      
      // Base height plus elevation
      const y = (token.height || 2) + elevation;
      
      sprite.position.set(x, y, z);
      sprite.rotation.y = (token.rotation || 0) * Math.PI / 180;
      
      return sprite;
    }

    
    sprite.position.set(x, y, z);



    console.log(`Positioned token at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    
    return sprite;
  }

  createRoomShape(room) {
    let geometry;

    switch (room.shape) {
      case "circle":
        const radius =
          Math.max(room.bounds.width, room.bounds.height) / 100;
        geometry = new THREE.CylinderGeometry(radius, radius, 4, 32);
        break;

      case "polygon":
        if (!room.points || room.points.length < 3) return null;

        const shape = new THREE.Shape();
        room.points.forEach((point, index) => {
          const x = point.x / 50;
          const y = point.y / 50;
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();

        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 4,
          bevelEnabled: false
        });
        break;

      default: // rectangle
        geometry = new THREE.BoxGeometry(
          room.bounds.width / 50,
          4,
          room.bounds.height / 50
        );
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0 // Make it invisible
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position the room correctly
    mesh.position.set(
      room.bounds.x / 50,
      2, // Half of height
      room.bounds.y / 50
    );

    return mesh;
  }

  // create room geometry



  //  createRaisedBlockGeometry 


  setupDrawer() {
    const drawer = document.createElement("sl-drawer");
    drawer.label = "3D View";
    drawer.placement = "end";
    drawer.classList.add("drawer-3d-view");

    // Calculate width based on viewport and sidebar
    const sidebar = document.querySelector(".sidebar");
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
    const availableWidth = window.innerWidth - sidebarWidth;
    const drawerWidth = `${Math.floor(availableWidth)}px`; // Use pixels instead of vw

    // Set drawer width
    drawer.style.setProperty("--size", drawerWidth);

    // Container for Three.js
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden"; // Prevent scrollbars
    drawer.appendChild(container);

    // Progress indicator
    const progress = document.createElement("sl-progress-bar");
    progress.style.display = "none";
    drawer.appendChild(progress);

    document.body.appendChild(drawer);
    return { drawer, container, progress };
  }

  handleKeyDown(event) {
    switch (event.code) {
        case "ArrowUp":
        case "KeyW":
            this.moveState.forward = true;
            break;
        case "ArrowDown":
        case "KeyS":
            this.moveState.backward = true;
            break;
        case "ArrowLeft":
        case "KeyA":
            this.moveState.left = true;
            break;
        case "ArrowRight":
        case "KeyD":
            this.moveState.right = true;
            break;
        case "ShiftLeft":
            this.moveState.shiftHeld = true;
            this.moveState.sprint = true;
            this.moveState.speed = 0.05;
            break;
        case "Space":
            // Initiate jump if not already jumping
            if (this.physics && !event.repeat) {
                const jumpStarted = this.physics.startJump();
                if (jumpStarted) {
                    // Play jump sound if available
                    if (this.jumpSound) {
                        this.jumpSound.play();
                    }
                }
            }
            break;
        case "KeyC":
            if (!event.repeat) {
                this.renderState.clippingEnabled = !this.renderState.clippingEnabled;
                this.updateWallClipping();
            }
            break;
    }
}

  handleKeyUp(event) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveState.forward = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveState.backward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveState.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveState.right = false;
        break;
      case "ShiftLeft":
        this.moveState.shiftHeld = false;
        if (!this.moveState.mouseRightDown) {
          this.moveState.sprint = false;
          this.moveState.speed = 0.025;
        }
        break;
    }
  }

  updateWallClipping() {
    this.scene.traverse((object) => {
      if (object.material && object.userData.isWall) {
        object.material.transparent = !this.renderState.clippingEnabled;
        object.material.opacity = this.renderState.clippingEnabled ? 1.0 : 0.8;
        object.material.side = this.renderState.clippingEnabled ? THREE.FrontSide : THREE.DoubleSide;
        object.material.needsUpdate = true;
      }
    });
  }

  setupMouseControls() {
    this.renderer.domElement.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    this.renderer.domElement.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        this.moveState.mouseRightDown = true;
        this.moveState.sprint = true;
        this.moveState.speed = 0.05;
      }
    });

    this.renderer.domElement.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.moveState.mouseRightDown = false;
        if (!this.moveState.shiftHeld) {
          this.moveState.sprint = false;
          this.moveState.speed = 0.025;
        }
      }
    });

    this.renderer.domElement.addEventListener("click", () => {
      this.controls.lock();
    });

    this.controls.addEventListener("lock", () => {
      this.renderer.domElement.style.cursor = "none";
    });

    this.controls.addEventListener("unlock", () => {
      this.renderer.domElement.style.cursor = "auto";
    });
  }

  createRoomGeometry(room) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Add at the start of createRoomGeometry:
    const isWall = room.type === "wall";
    console.log("Room geometry creation:", {
      roomName: room.name,
      roomType: room.type,
      isWall: isWall
    });

    switch (room.shape) {
      case "circle": {
        const segments = 32;
        const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
        const centerX = (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2;
        const centerZ = (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2;
        
        if (isWall) {
          // For walls, create solid cylinder including top and bottom
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta);
            const z = Math.sin(theta);

            // Bottom vertices
            positions.push(
              centerX + radius * x,
              0,
              centerZ + radius * z
            );
            normals.push(x, 0, z);
            uvs.push(i / segments, 0);

            // Top vertices
            positions.push(
              centerX + radius * x,
              this.boxHeight,
              centerZ + radius * z
            );
            normals.push(x, 0, z);
            uvs.push(i / segments, 1);
          }

          // Create faces for cylinder walls
          for (let i = 0; i < segments; i++) {
            const base = i * 2;
            indices.push(
              base, base + 1, base + 2,
              base + 1, base + 3, base + 2
            );
          }

          // Add center vertices for top and bottom caps
          const bottomCenterIndex = positions.length / 3;
          positions.push(centerX, 0, centerZ);
          normals.push(0, -1, 0);
          uvs.push(0.5, 0.5);

          const topCenterIndex = positions.length / 3;
          positions.push(centerX, this.boxHeight, centerZ);
          normals.push(0, 1, 0);
          uvs.push(0.5, 0.5);

          // Add cap faces
          for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = ((i + 1) % segments) * 2;
            // Bottom cap
            indices.push(bottomCenterIndex, current, next);
            // Top cap
            indices.push(topCenterIndex, next + 1, current + 1);
          }
        } else {
          // Original hollow room code
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = centerX + radius * Math.cos(theta);
            const z = centerZ + radius * Math.sin(theta);

            positions.push(x, 0, z);
            positions.push(x, this.boxHeight, z);

            const normal = [Math.cos(theta), 0, Math.sin(theta)];
            normals.push(...normal, ...normal);

            uvs.push(i / segments, 0, i / segments, 1);
          }

          for (let i = 0; i < segments; i++) {
            const base = i * 2;
            indices.push(
              base, base + 1, base + 2,
              base + 1, base + 3, base + 2
            );
          }
        }
        break;
      }

      case "polygon": {
        if (!room.points || room.points.length < 3) return null;

        const baseZ = room.bounds.y / 50 - this.boxDepth / 2;
        const baseX = room.bounds.x / 50 - this.boxWidth / 2;

        if (isWall) {
          // Calculate scaling like rectangle case
          const heightRatio = 1.0;
          const scaleU = this.wallTexture
            ? room.bounds.width / this.wallTextureRoom.bounds.width
            : 1;
          const scaleV = this.wallTexture
            ? heightRatio * (this.boxHeight / this.wallTextureRoom.bounds.height)
            : 1;

          // Use texture repeats for vertical surfaces
          const textureRepeatsU = this.wallTexture
            ? this.wallTexture.repeat.x
            : 1;
          const textureRepeatsV = this.wallTexture
            ? this.wallTexture.repeat.y
            : 1;

          // Create points for the walls
          for (let i = 0; i < room.points.length; i++) {
            const point = room.points[i];
            const nextPoint = room.points[(i + 1) % room.points.length];
            const x1 = point.x / 50 + baseX;
            const z1 = point.y / 50 + baseZ;
            const x2 = nextPoint.x / 50 + baseX;
            const z2 = nextPoint.y / 50 + baseZ;

            // Add vertices for this wall segment
            positions.push(
              x1,
              0,
              z1, // bottom left
              x2,
              0,
              z2, // bottom right
              x2,
              this.boxHeight,
              z2, // top right
              x1,
              this.boxHeight,
              z1 // top left
            );

            // Calculate wall segment length for UV scaling
            const segmentLength = Math.sqrt(
              Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2)
            );
            const segmentScaleU =
              (segmentLength / (this.wallTextureRoom.bounds.width / 50)) *
              textureRepeatsU;

            // Add UVs for this segment, incorporating texture repeats
            uvs.push(
              0,
              0, // bottom left
              segmentScaleU,
              0, // bottom right
              segmentScaleU,
              textureRepeatsV, // top right
              0,
              textureRepeatsV // top left
            );

            // Add normals
            const dx = x2 - x1;
            const dz = z2 - z1;
            const length = Math.sqrt(dx * dx + dz * dz);
            const nx = dz / length;
            const nz = -dx / length;

            for (let j = 0; j < 4; j++) {
              normals.push(nx, 0, nz);
            }

            // Add indices for this segment
            const base = i * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }
        } else {
          // Original hollow room code
          room.points.forEach((point, i) => {
            const x = point.x / 50 + baseX;
            const z = point.y / 50 + baseZ;

            positions.push(x, 0, z);
            positions.push(x, this.boxHeight, z);

            normals.push(0, 0, 1, 0, 0, 1);

            uvs.push(i / room.points.length, 0);
            uvs.push(i / room.points.length, 1);
          });

          for (let i = 0; i < room.points.length; i++) {
            const next = (i + 1) % room.points.length;
            const base = i * 2;
            const nextBase = next * 2;

            indices.push(
              base,
              base + 1,
              nextBase,
              base + 1,
              nextBase + 1,
              nextBase
            );
          }
        }
        break;
      }

      default: {
        // rectangle
        const x1 = room.bounds.x / 50 - this.boxWidth / 2;
        const x2 = x1 + room.bounds.width / 50;
        const z1 = room.bounds.y / 50 - this.boxDepth / 2;
        const z2 = z1 + room.bounds.height / 50;

        if (isWall) {
          // Create solid box vertices
          positions.push(
            // Bottom face
            x1,
            0,
            z1,
            x2,
            0,
            z1,
            x2,
            0,
            z2,
            x1,
            0,
            z2,
            // Top face
            x1,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            // Front and back
            x1,
            0,
            z1,
            x2,
            0,
            z1,
            x2,
            this.boxHeight,
            z1,
            x1,
            this.boxHeight,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            // Left and right
            x1,
            0,
            z1,
            x1,
            0,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x2,
            this.boxHeight,
            z1
          );

          // Add corresponding normals for each face
          for (let i = 0; i < 4; i++) normals.push(0, -1, 0); // Bottom
          for (let i = 0; i < 4; i++) normals.push(0, 1, 0); // Top
          for (let i = 0; i < 4; i++) normals.push(0, 0, -1); // Front
          for (let i = 0; i < 4; i++) normals.push(0, 0, 1); // Back
          for (let i = 0; i < 4; i++) normals.push(-1, 0, 0); // Left
          for (let i = 0; i < 4; i++) normals.push(1, 0, 0); // Right

          const heightRatio = 1.0;
          const scaleU = this.wallTexture
            ? room.bounds.width / this.wallTextureRoom.bounds.width
            : 1;
          const scaleV = this.wallTexture
            ? heightRatio * (this.boxHeight / this.wallTextureRoom.bounds.height)
            : 1;

          // Get texture repeats
          const textureRepeatsU = this.wallTexture
            ? this.wallTexture.repeat.x
            : 1;
          const textureRepeatsV = this.wallTexture
            ? this.wallTexture.repeat.y
            : 1;

          // Bottom face
          uvs.push(
            0,
            0,
            textureRepeatsU,
            0,
            textureRepeatsU,
            textureRepeatsU,
            0,
            textureRepeatsU
          );
          // Top face
          uvs.push(
            0,
            0,
            textureRepeatsU,
            0,
            textureRepeatsU,
            textureRepeatsU,
            0,
            textureRepeatsU
          );

          // Front face (use width for U repeat)
          const widthRepeats =
            (Math.abs(x2 - x1) / (this.wallTextureRoom.bounds.width / 50)) *
            textureRepeatsU;
          uvs.push(
            0,
            0,
            widthRepeats,
            0,
            widthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );
          // Back face
          uvs.push(
            0,
            0,
            widthRepeats,
            0,
            widthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );

          // Left face (use depth for U repeat)
          const depthRepeats =
            (Math.abs(z2 - z1) / (this.wallTextureRoom.bounds.width / 50)) *
            textureRepeatsU;
          uvs.push(
            0,
            0,
            depthRepeats,
            0,
            depthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );
          // Right face
          uvs.push(
            0,
            0,
            depthRepeats,
            0,
            depthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );

          // Add indices for each face (6 faces, 2 triangles each)
          for (let face = 0; face < 6; face++) {
            const base = face * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }
        } else {
          // Original hollow room code
          const wallVertices = [
            x1,
            0,
            z1,
            x1,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            0,
            z1,
            x1,
            0,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z2,
            x2,
            0,
            z2
          ];
          positions.push(...wallVertices);

          for (let i = 0; i < 4; i++) {
            const base = i * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }

          for (let i = 0; i < wallVertices.length / 3; i++) {
            normals.push(0, 0, 1);
            uvs.push(i % 2, Math.floor(i / 2) % 2);
          }
        }
        break;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    geometry.setIndex(indices);

    const material = room.type === "wall"
      ? this.textureManager.createMaterial(room, this.wallTextureRoom)
      : this.textureManager.createMaterial(room, this.roomTextureRoom);

    return new THREE.Mesh(geometry, material);
  }

  createRaisedBlockGeometry(room) {
    let geometry;
    const materials = [];

    // Side material (using wall texture)
    const sideMaterial = room.type === "wall" ?
      this.textureManager.createMaterial(room, this.wallTextureRoom) :
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
    materials.push(sideMaterial);
    // Create and configure top texture
    const topTexture = this.createTextureFromArea(room);
    topTexture.center.set(0.5, 0.5); // Set rotation center to middle
    // Remove the rotation line
    topTexture.repeat.set(1, 1); // Ensure 1:1 mapping
    topTexture.needsUpdate = true;

    // Create top material with the configured texture
    const topMaterial = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    materials.push(topMaterial);

    // Bottom material (use same as sides)
    materials.push(sideMaterial);


    switch (room.shape) {


      case "circle": {
        topTexture.rotation = Math.PI / 2;
        topTexture.needsUpdate = true;
        
        const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
        geometry = new THREE.CylinderGeometry(radius, radius, room.blockHeight, 32);
        geometry.rotateZ(0);  // Keep it horizontal
        
        // Move up by half the block height
        geometry.translate(0, room.blockHeight / 2, 0);
        break;
    }

      case "polygon": {
        if (!room.points || room.points.length < 3) return null;

        // Swap materials first
        const tempMaterial = materials[0];
        materials[0] = materials[1];
        materials[1] = tempMaterial;

        const shape = new THREE.Shape();

        // Calculate bounds for UV mapping
        const minX = Math.min(...room.points.map(p => p.x));
        const maxX = Math.max(...room.points.map(p => p.x));
        const minY = Math.min(...room.points.map(p => p.y));
        const maxY = Math.max(...room.points.map(p => p.y));
        const width = maxX - minX;
        const height = maxY - minY;

        // Create shape with normalized coordinates
        room.points.forEach((point, index) => {
          const x = (point.x - minX) / 50;
          const y = -(point.y - minY) / 50;  // Flip Y and normalize
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();

        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: room.blockHeight,
          bevelEnabled: false,
          UVGenerator: {
            generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
              const vA = new THREE.Vector3(vertices[indexA * 3], vertices[indexA * 3 + 1], vertices[indexA * 3 + 2]);
              const vB = new THREE.Vector3(vertices[indexB * 3], vertices[indexB * 3 + 1], vertices[indexB * 3 + 2]);
              const vC = new THREE.Vector3(vertices[indexC * 3], vertices[indexC * 3 + 1], vertices[indexC * 3 + 2]);

              return [
                new THREE.Vector2(vA.x / width * 50, vA.y / height * 50),
                new THREE.Vector2(vB.x / width * 50, vB.y / height * 50),
                new THREE.Vector2(vC.x / width * 50, vC.y / height * 50)
              ];
            },
            generateSideWallUV: function (geometry, vertices, indexA, indexB, indexC, indexD) {
              return [
                new THREE.Vector2(0, 0),
                new THREE.Vector2(1, 0),
                new THREE.Vector2(1, 1),
                new THREE.Vector2(0, 1)
              ];
            }
          }
        });

        geometry.rotateX(-Math.PI / 2);

        const topBottomFaces = room.points.length - 2;
        const sideFaces = room.points.length * 2;

        geometry.clearGroups();
        geometry.addGroup(0, sideFaces * 3, 0);
        geometry.addGroup(sideFaces * 3, topBottomFaces * 3, 1);
        geometry.addGroup((sideFaces + topBottomFaces) * 3, topBottomFaces * 3, 2);

        break;
      }

      default: {
        // Rectangle case
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        // Keep track of where each face starts for material mapping
        const materialGroups = [];
        let faceCount = 0;

        const x1 = room.bounds.x / 50 - this.boxWidth / 2;
        const x2 = x1 + room.bounds.width / 50;
        const z1 = room.bounds.y / 50 - this.boxDepth / 2;
        const z2 = z1 + room.bounds.height / 50;
        const height = room.blockHeight;

        // Create and configure top texture
        topTexture.repeat.set(1, -1);  // Flip vertically by setting Y to negative
        topTexture.needsUpdate = true;

        // All vertices remain the same
        positions.push(
          // Bottom face
          x1, 0, z1,
          x2, 0, z1,
          x2, 0, z2,
          x1, 0, z2,
          // Top face
          x1, height, z1,
          x2, height, z1,
          x2, height, z2,
          x1, height, z2,
          // Front
          x1, 0, z1,
          x2, 0, z1,
          x2, height, z1,
          x1, height, z1,
          // Back
          x1, 0, z2,
          x2, 0, z2,
          x2, height, z2,
          x1, height, z2,
          // Left
          x1, 0, z1,
          x1, 0, z2,
          x1, height, z2,
          x1, height, z1,
          // Right
          x2, 0, z1,
          x2, 0, z2,
          x2, height, z2,
          x2, height, z1
        );

        // Normals stay the same
        for (let i = 0; i < 4; i++) normals.push(0, -1, 0);  // Bottom
        for (let i = 0; i < 4; i++) normals.push(0, 1, 0);   // Top
        for (let i = 0; i < 4; i++) normals.push(0, 0, -1);  // Front
        for (let i = 0; i < 4; i++) normals.push(0, 0, 1);   // Back
        for (let i = 0; i < 4; i++) normals.push(-1, 0, 0);  // Left
        for (let i = 0; i < 4; i++) normals.push(1, 0, 0);   // Right

        // UVs for each face
        const textureRepeatsU = this.wallTexture ? this.wallTexture.repeat.x : 1;
        const textureRepeatsV = this.wallTexture ? this.wallTexture.repeat.y : 1;

        // Add UVs for each face
        for (let face = 0; face < 6; face++) {
          uvs.push(
            0, 0,
            textureRepeatsU, 0,
            textureRepeatsU, textureRepeatsV,
            0, textureRepeatsV
          );
        }

        // Add indices with material groups
        // Bottom face (material index 2)
        materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 2 });
        indices.push(0, 1, 2, 0, 2, 3);
        faceCount += 2;

        // Top face (material index 1)
        materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 1 });
        indices.push(4, 5, 6, 4, 6, 7);
        faceCount += 2;

        // Side faces (material index 0)
        materialGroups.push({ startIndex: faceCount * 3, count: 24, materialIndex: 0 });
        for (let face = 2; face < 6; face++) {
          const base = face * 4;
          indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
          );
          faceCount += 2;
        }

        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        // Add material groups to geometry
        materialGroups.forEach(group => {
          geometry.addGroup(group.startIndex, group.count, group.materialIndex);
        });

        break;
      }
    }

    const mesh = new THREE.Mesh(geometry, materials);

    // Position mesh correctly based on room bounds
    if (room.shape === "polygon") {
      mesh.position.set(
        room.bounds.x / 50 - this.boxWidth / 2,  // Use absolute position
        0,
        room.bounds.y / 50 - this.boxDepth / 2
      );
    } else if (room.shape === "circle") {
      mesh.position.set(
        (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2,
        0,
        (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2
      );

    } else {
      mesh.position.set(0, 0, 0);
    }

    return mesh;
  }


  getMonsterTokenData(marker) {
  
    if (!marker || !marker.data || !marker.data.monster) {
      console.log("Invalid marker data");
      return null;
    }
  
    // Get token info - ensure we always have a valid token source
    let tokenSource = null;
    
    if (marker.data.monster.token) {
      tokenSource = marker.data.monster.token.data || marker.data.monster.token.url;
    }
    
    // If no token source available, generate a default placeholder image
    if (!tokenSource) {
      console.log("No token source found, generating placeholder image");
      
      // Create a placeholder canvas
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      // Fill with a color based on monster name
      const monsterName = marker.data.monster.basic?.name || "Unknown Monster";
      const hashCode = monsterName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      // Generate a color from the hash
      const hue = Math.abs(hashCode) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(0, 0, 64, 64);
      
      // Add border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 60, 60);
      
      // Add text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(monsterName.charAt(0).toUpperCase(), 32, 32);
      
      // Convert to data URL
      tokenSource = canvas.toDataURL('image/webp');
    }
  
    // console.log("Token image source type:", {
    //   isBase64: tokenSource.startsWith('data:'),
    //   length: tokenSource.length,
    //   preview: tokenSource.substring(0, 100) + '...'
    // });
  
    const monsterSize = this.getMonsterSizeInSquares(marker.data.monster.basic?.size || "medium");
    const tokenData = {
      x: marker.x,
      y: marker.y,
      size: monsterSize,
      image: tokenSource,
      type: "monster",
      name: marker.data.monster.basic?.name || "Unknown Monster",
      height: 2 * monsterSize
    };
  
    console.log("Created token data:", {
      position: `${tokenData.x}, ${tokenData.y}`,
      size: tokenData.size,
      height: tokenData.height,
      hasImage: !!tokenData.image
    });
  
    return tokenData;
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

  getHighestElevationAtPoint(x, z) {
    let maxElevation = 0;
    let insideWall = false;
    let elevationSource = null;
    
    console.log("Checking elevation at:", { x, z });
    
    this.rooms.forEach(room => {
      const roomX = room.bounds.x / 50 - this.boxWidth / 2;
      const roomZ = room.bounds.y / 50 - this.boxDepth / 2;
      const roomWidth = room.bounds.width / 50;
      const roomDepth = room.bounds.height / 50;
      
      if (x >= roomX && x <= roomX + roomWidth && 
          z >= roomZ && z <= roomZ + roomDepth) {
        
        if (room.isRaisedBlock && room.blockHeight) {
          const blockHeight = room.blockHeight;
          if (blockHeight > maxElevation) {
            maxElevation = blockHeight;
            elevationSource = 'raised block';
            console.log("New max height from raised block:", blockHeight);
          }
        }
        
        if (room.type === 'wall' && !room.isRaisedBlock) {
          const wallHeight = this.boxHeight || 4;
          if (wallHeight > maxElevation) {
            maxElevation = wallHeight;
            elevationSource = 'wall';
            insideWall = true;
            console.log("New max height from wall:", wallHeight);
          }
        }
      }
    });
    
    console.log("Final elevation calculation:", {
      height: maxElevation,
      source: elevationSource || 'ground level',
      insideWall
    });
    
    return { 
      elevation: maxElevation, 
      insideWall,
      source: elevationSource || 'ground level'
    };
  }

  getElevationAtPoint(x, z) {
    let elevation = 0;
    let isInside = false;
    
    // Check all rooms/walls
    this.rooms.forEach(room => {
        // Skip non-wall and non-raised blocks
        if (!room.isRaisedBlock && room.type !== 'wall') return;
        
        // Check if point is within bounds
        const roomX = room.bounds.x / 50 - this.boxWidth / 2;
        const roomZ = room.bounds.y / 50 - this.boxDepth / 2;
        const roomWidth = room.bounds.width / 50;
        const roomDepth = room.bounds.height / 50;
        
        const isPointInside = this.isPointInRectangle(
            x, z,
            roomX, roomZ,
            roomX + roomWidth, roomZ + roomDepth
        );
        
        if (isPointInside) {
            if (room.isRaisedBlock) {
                // For raised blocks, we increase elevation
                elevation = Math.max(elevation, room.blockHeight || 0);
            } else if (room.isRegularWall) {
                // For regular walls, consider top surface at boxHeight
                // but only if the current elevation is near the top
                const wallHeight = this.boxHeight || 4;
                if (Math.abs(elevation - wallHeight) < 0.3) {
                    elevation = wallHeight;
                } else {
                    // Inside wall but not on top
                    isInside = true;
                }
            } else if (room.type === 'wall' && !room.isRaisedBlock) {
                // For regular walls (backward compatibility), mark as inside
                isInside = true;
            }
        }
    });
    
    return { elevation, isInside };
}


  
  
  isPointInRectangle(px, pz, x1, z1, x2, z2) {
    return px >= x1 && px <= x2 && pz >= z1 && pz <= z2;
  }
  
  isPointInPolygon(px, pz, vertices) {
    // Ray-casting algorithm
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, zi = vertices[i].y;
      const xj = vertices[j].x, zj = vertices[j].y;
      
      const intersect = ((zi > pz) !== (zj > pz)) && 
          (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }



  

  async init3DScene(updateStatus) {
    const renderState = {
      clippingEnabled: false // true
    };
    // const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x222222);

    this.tokens = [];

    // brad sync and edit test from downstairs

    // Add encounter markers to tokens array
    console.log("Starting to process markers for tokens:", this.markers.length);
    this.markers.forEach((marker, index) => {
      console.log(`Processing marker ${index}:`, {
        type: marker.type,
        hasMonster: !!marker.data?.monster
      });

      if (marker.type === "encounter" && marker.data?.monster) {
        console.log("Processing encounter marker for 3D:", {
          name: marker.data.monster.basic?.name,
          hasToken: !!marker.data.monster.token
        });

        const tokenData = this.getMonsterTokenData(marker);
        if (tokenData) {
          this.tokens.push(tokenData);
          console.log("Successfully added token data:", {
            name: tokenData.name,
            position: `${tokenData.x}, ${tokenData.y}`,
            size: tokenData.size
          });
        } else {
          console.log("Failed to get token data for marker");
        }
      }
    });



    console.log("Finished processing Token markers, total tokens:", this.tokens.length);



// Process prop markers
console.log("Processing prop markers for 3D view");
const propMarkers = this.markers.filter(m => m.type === 'prop' && m.data?.texture);
const propPromises = [];

propMarkers.forEach(marker => {
  // Create prop data object
  const propData = {
    id: marker.id,
    x: marker.x,
    y: marker.y,
    image: marker.data.texture.data,
    rotation: marker.data.prop?.position?.rotation || 0,
    scale: marker.data.prop?.scale || 1,
    height: marker.data.prop?.height || 0  // Use 0 as default height instead of 1
  };
  
  // Create and add prop mesh
  propPromises.push(
    this.createPropMesh(propData)
      .then(mesh => {
        this.scene.add(mesh);
        return mesh;
      })
      .catch(error => {
        console.error(`Error creating prop ${marker.id}:`, error);
        return null;
      })
  );
});

// Wait for all props to be created
if (propPromises.length > 0) {
  Promise.all(propPromises)
    .then(propMeshes => {
      console.log(`Added ${propMeshes.filter(m => m !== null).length} prop meshes to scene`);
    })
    .catch(error => {
      console.error("Error adding props to scene:", error);
    });
}

const teleportMarkers = this.markers.filter(m => m.type === 'teleport');
// In Scene3DController.js, modify the teleport marker processing:
teleportMarkers.forEach(marker => {
  const x = marker.x / 50 - this.boxWidth / 2;
  const z = marker.y / 50 - this.boxDepth / 2;
  const { elevation, insideWall } = this.getHighestElevationAtPoint(x, z);
  // const { elevation, insideWall } = this.getElevationAtPoint(x, z);
  
  // Store elevation data with marker
  marker.data.elevation = elevation;
  marker.data.insideWall = insideWall;
  
  // Create teleporter visual
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
  const material = new THREE.MeshBasicMaterial({
    color: marker.data.isPointA ? 0x4CAF50 : 0x2196F3,
    transparent: true,
    opacity: 0.5
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  
  // Position at highest elevation
  const finalHeight = elevation + 0.05; // Slightly above surface
  mesh.position.set(x, finalHeight, z);
  
  const teleporterInfo = {
    mesh,
    marker,
    pairedMarker: marker.data.pairedMarker,
    isPointA: marker.data.isPointA,
    position: new THREE.Vector3(x, finalHeight, z)
  };
  
  this.teleporters.push(teleporterInfo);
  this.scene.add(mesh);
  
  // Add particles at correct height
  const particles = this.createTeleporterParticles(x, finalHeight, z);
  this.scene.add(particles);
});

    const wallTextureRoom = this.rooms.find(
      (room) => room.name === "WallTexture"
    );
    const roomTextureRoom = this.rooms.find(
      (room) => room.name === "RoomTexture"
    );

    let wallTexture = null;
    let roomTexture = null;

    if (this.wallTextureRoom) {
      // console.log("Creating wall texture from room:", wallTextureRoom);
      this.wallTexture = this.createTextureFromRoom(this.wallTextureRoom);
    }

    // Create room texture if defined
    if (this.roomTextureRoom) {
      // console.log("Creating room texture from room:", roomTextureRoom);
      this.roomTexture = this.createTextureFromRoom(this.roomTextureRoom);
    }

    // Create floor texture
    const texture = new THREE.Texture(this.baseImage);
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Create main block dimensions
    const boxWidth = this.baseImage.width / 50;
    const boxHeight = 4.5; // 4; // Wall height
    const boxDepth = this.baseImage.height / 50;

    // Handle doors with textures
    this.markers.forEach(marker => {
      if (marker.type === 'door' && marker.data.texture) {
        console.log('Creating 3D door with texture:', marker.data);
        const doorMesh = this.textureManager.createDoorMesh(
          marker,
          this.boxWidth,
          this.boxHeight,
          this.boxDepth
        );
        if (doorMesh) {
          this.scene.add(doorMesh);
          console.log('Door mesh added to scene');
        }
      }
    });


  this.rooms.forEach((room) => {
    if (room.name === "WallTexture" || room.name === "RoomTexture") {
        return;
    }
   
    let roomMesh;
    if (room.isRaisedBlock && room.blockHeight) {
        roomMesh = this.createRaisedBlockGeometry(room);
        if (roomMesh) {
            roomMesh.userData = {
                isWall: true,
                blockHeight: room.blockHeight,
                isRaisedBlock: true
            };
        }
    } else {
        roomMesh = this.createRoomGeometry(room);
        if (roomMesh) {
            roomMesh.userData = {
                isWall: room.type === "wall",
                isRegularWall: room.isRegularWall || false,  // Add the regular wall flag
                type: room.type
            };
        }
    }
    
    if (roomMesh) {
        this.scene.add(roomMesh);
    }
});


    const materials = [
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide
      }),
      new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.7,
        side: THREE.DoubleSide
      })
    ];

    updateStatus(20);
    this.rooms.forEach((room, index) => {
      // Skip the WallTexture room in 3D view
      if (room.name === "WallTexture" || room.name === "RoomTexture") {
        return;
      }

      let roomMesh;
      if (room.isRaisedBlock && room.blockHeight) {
        roomMesh = this.createRaisedBlockGeometry(room);
        if (roomMesh) {
          roomMesh.userData.isWall = true;
        }
      } else {
        roomMesh = this.createRoomGeometry(room);
        if (roomMesh) {
          roomMesh.userData.isWall = room.type === "wall";
        }
      }

      if (roomMesh) {
        if (roomMesh.userData.isWall) {
          // console.log("Creating wall mesh:", {
          //     roomName: room.name,
          //     hasTexture: !!roomMesh.material.map,
          //     isTransparent: roomMesh.material.transparent,
          //     opacity: roomMesh.material.opacity
          // });
        }
        this.scene.add(roomMesh);
      }
      updateStatus(20 + 60 * (index / this.rooms.length));
    });


    // Add floor
    const floorGeometry = new THREE.PlaneGeometry(this.boxWidth, this.boxDepth);
    const floor = new THREE.Mesh(floorGeometry, materials[0]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01; // Slightly above ground to prevent z-fighting
    this.scene.add(floor);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Position this.camera at player start if available
    if (this.playerStart) {
        this.camera.position.set(
        this.playerStart.x / 50 - this.boxWidth / 2,
        1.7, // Eye level
        this.playerStart.y / 50 - this.boxDepth / 2
      );
    }



    const createTokenMesh = (token) => {
      // Debug log the token data
      // console.log("Creating token mesh with data:", token);

      return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();

        textureLoader.load(
          token.image,
          (texture) => {
            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              sizeAttenuation: true
            });

            const sprite = new THREE.Sprite(spriteMaterial);
            const scale = token.size * (this.cellSize / 25);
            const aspectRatio = texture.image.width / texture.image.height;
            sprite.scale.set(scale * aspectRatio, scale, 1);

            // Position at grid location
            const x = token.x / 50 - this.boxWidth / 2;
            const z = token.y / 50 - this.boxDepth / 2;
            const y = token.size * (this.cellSize / 50); // Height adjustment

            sprite.position.set(x, y, z);

            console.log("Token sprite created:", {
              position: sprite.position,
              scale: sprite.scale,
              aspectRatio
            });

            resolve(sprite);
          },
          undefined,
          (error) => {
            console.error("Error loading token texture:", error);
            reject(error);
          }
        );
      });
    };

// token mesh processing
    if (this.tokens && this.tokens.length > 0) {
      console.log("Processing tokens for 3D view:", this.tokens.length);
      
      // Debug first token
      if (this.tokens[0]) {
        console.log("Example token data:", {
          name: this.tokens[0].name,
          position: `(${this.tokens[0].x}, ${this.tokens[0].y})`,
          size: this.tokens[0].size
        });
      }
    
      const tokenMeshes = [];
      
      // Process tokens one by one
      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];
        
        try {
          // Look for elevation data from the marker
          const matchingMarker = this.markers?.find(m => 
            m.type === 'encounter' && 
            m.data?.monster?.basic?.name === token.name &&
            m.x === token.x && 
            m.y === token.y
          );
          
          if (matchingMarker?.data?.elevation > 0 && !matchingMarker.data.insideWall) {
            console.log(`Token ${token.name} at elevation ${matchingMarker.data.elevation}`);
            // Add elevation to token height
            token.height = (token.size || 1) + matchingMarker.data.elevation;
          }
          
          // Create and add token mesh
          const mesh = this.createTokenMesh(token);
          if (mesh) {
            this.scene.add(mesh);
            tokenMeshes.push(mesh);
          }
        } catch (err) {
          console.error(`Error creating token ${i}:`, err);
        }
      }
      
      console.log(`Added ${tokenMeshes.length} token meshes to scene`);
    }

// Process prop markers
this.markers.forEach(marker => {
  if (marker.type === "prop" && marker.data?.texture) {
    const propData = {
      x: marker.x,
      y: marker.y,
      image: marker.data.texture.data,
      type: "prop",
      scale: marker.data.prop?.scale || 1,
      aspect: marker.data.texture.aspect || 1,
      rotation: marker.data.prop?.position?.rotation || 0,
      height: marker.data.prop?.height || 1 // Use the height value from prop settings
    };
    this.tokens.push(propData);
  }
});


    this.controls = new THREE.PointerLockControls(
      this.camera,
      this.renderer.domElement
    );

    const moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false
    };

    // Instead of all the inline event handlers, use:
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));
    this.setupMouseControls();


    updateStatus(100);



  this.cleanup = () => {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);

    // Dispose of renderer
    this.renderer.dispose();

    // Dispose of geometries and materials
    this.scene.traverse((object) => {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach((material) => material.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
};

// Return with all class method references
return {
    scene: this.scene,
    camera: this.camera,
    renderer: this.renderer,
    animate: this.animate.bind(this),  // Ensure 'this' binding
    controls: this.controls,
    cleanup: this.cleanup.bind(this)   // Ensure 'this' binding
};
}


animate = () => {
  const currentSpeed = this.moveState.speed;
  let canMove = true;

  if (this.moveState.forward || this.moveState.backward) {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      if (this.moveState.backward) direction.negate();
      
      canMove = this.physics.checkCollision(direction, currentSpeed);
  }

  if (canMove) {
      if (this.moveState.forward) this.controls.moveForward(currentSpeed);
      if (this.moveState.backward) this.controls.moveForward(-currentSpeed);
  }

  if (this.moveState.left) this.controls.moveRight(-currentSpeed);
  if (this.moveState.right) this.controls.moveRight(currentSpeed);

  const playerPosition = this.camera.position.clone();
  let nearestTeleporter = null;
  let shortestDistance = Infinity;
  
  this.teleporters.forEach(teleporter => {
    const distance = playerPosition.distanceTo(teleporter.position);
    if (distance < 2 && distance < shortestDistance) {  // Within 2 units
      shortestDistance = distance;
      nearestTeleporter = teleporter;
    }
  });
  
  // Show/hide teleport prompt based on proximity
  this.updateTeleportPrompt(nearestTeleporter);
  
  // Animate teleporter particles
  this.scene.children.forEach(child => {
    if (child instanceof THREE.Points && child.userData.animate) {
      const positions = child.geometry.attributes.position.array;
      for(let i = 0; i < positions.length; i += 3) {
        // Circular motion
        const time = Date.now() * 0.001;
        const radius = 0.5;
        positions[i] = Math.cos(time + i) * radius;
        positions[i + 1] = Math.sin(time * 0.5) * 0.2;  // Vertical wobble
        positions[i + 2] = Math.sin(time + i) * radius;
      }
      child.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Update physics and camera height
  this.camera.position.y = this.physics.update();
  this.renderer.render(this.scene, this.camera);
};

loadJumpSound() {
  const listener = new THREE.AudioListener();
  this.camera.add(listener);
  
  this.jumpSound = new THREE.Audio(listener);
  const audioLoader = new THREE.AudioLoader();
  
  audioLoader.load('sounds/jump.mp3', (buffer) => {
      this.jumpSound.setBuffer(buffer);
      this.jumpSound.setVolume(0.5);
  }, 
  // Progress callback
  (xhr) => {
      console.log(`Jump sound: ${(xhr.loaded / xhr.total * 100)}% loaded`);
  },
  // Error callback
  (error) => {
      console.warn('Could not load jump sound:', error);
  });
}

// Optional: Add dust particle effect when landing
createLandingEffect(position) {
  // Create a particle system for dust effect
  const particleCount = 20;
  const particles = new THREE.BufferGeometry();
  
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  
  // Set up particles in a small radius around landing position
  for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Position within small radius
      const radius = 0.2 + Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      
      positions[i3] = position.x + Math.cos(angle) * radius;
      positions[i3 + 1] = position.y + 0.05;  // Just above ground
      positions[i3 + 2] = position.z + Math.sin(angle) * radius;
      
      // Dust color (light brown/gray)
      colors[i3] = 0.8 + Math.random() * 0.2;
      colors[i3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i3 + 2] = 0.6 + Math.random() * 0.2;
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  // Material with particle texture
  const particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.7
  });
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  this.scene.add(particleSystem);
  
  // Animate particles rising and fading
  const startTime = Date.now();
  const duration = 1000;  // 1 second
  
  const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
          // Update particles
          for (let i = 0; i < particleCount; i++) {
              const i3 = i * 3;
              // Move upward slowly
              particles.attributes.position.array[i3 + 1] += 0.003;
          }
          
          particles.attributes.position.needsUpdate = true;
          
          // Fade out
          particleMaterial.opacity = 0.7 * (1 - progress);
          
          requestAnimationFrame(animateParticles);
      } else {
          // Remove when done
          this.scene.remove(particleSystem);
          particleSystem.geometry.dispose();
          particleMaterial.dispose();
      }
  };
  
  animateParticles();
}

  async show3DView() {
    const { drawer, container, progress } = this.setupDrawer();

    progress.style.display = "block";
    progress.value = 0;

    const updateStatus = (percent) => {
      progress.value = percent;
      progress.innerHTML = `Processing... ${Math.round(percent)}%`;
    };


    const hasUrlTokens = this.markers.some(marker => 
      marker.type === "encounter" && 
      marker.data?.monster?.token?.url && 
      !marker.data.monster.token.data?.startsWith('data:')
  );
  
  if (hasUrlTokens) {
      // Show warning toast before proceeding
      const toast = document.createElement('div');
      toast.className = 'token-warning-toast';
      toast.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 16px;
          border-radius: 4px;
          z-index: 10000;
          max-width: 400px;
          text-align: center;
      `;
      
      toast.innerHTML = `
          <span class="material-icons" style="font-size: 24px; display: block; margin: 0 auto 8px auto;">warning</span>
          <div>
              <div style="font-weight: bold; margin-bottom: 8px;">3D Token Warning</div>
              <div>Some monsters use URL-based tokens which won't display correctly in 3D view.</div>
              <div style="margin-top: 8px;">Please update monsters in the Resource Manager first.</div>
          </div>
      `;
      
      document.body.appendChild(toast);
      
      // Auto-remove after showing for a bit
      setTimeout(() => toast.remove(), 5000);
  }

    try {
      drawer.show();

      // Initialize core Three.js components
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x222222);

      // Calculate dimensions
      const sidebar = document.querySelector(".sidebar");
      const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
      const availableWidth = window.innerWidth - sidebarWidth;

      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(availableWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;

      // Create camera
      this.camera = new THREE.PerspectiveCamera(
        75,
        availableWidth / window.innerHeight,
        0.1,
        1000
      );
      this.camera.position.set(0, 2, 5);

      // Create controls
      this.controls = new THREE.PointerLockControls(this.camera, this.renderer.domElement);

      // Add renderer to container
      container.appendChild(this.renderer.domElement);

      const { cleanup } = this.init3DScene(updateStatus);

      // Initialize scene with components
      // const { animate, controls, cleanup } = this.init3DScene(updateStatus);
      const { animate, controls } = this.init3DScene(updateStatus);

      // Instructions overlay
      const instructions = document.createElement("div");
      instructions.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 20px;
            width: 75vw;
            border-radius: 5px;
            text-align: center;
            pointer-events: none;
        `;
      instructions.innerHTML = `
            Click to start<br>
            WASD or Arrow Keys to move<br>
            Hold Shift to sprint<br>
            C to toggle wall clipping<br>
            ESC to exit
        `;
      container.appendChild(instructions);

      // Controls event listeners
      this.controls.addEventListener("lock", () => {
        instructions.style.display = "none";
      });

      this.controls.addEventListener("unlock", () => {
        instructions.style.display = "block";
      });

      // Animation loop
      let animationFrameId;
      const animationLoop = () => {
        if (drawer.open) {
          animationFrameId = requestAnimationFrame(animationLoop);
          this.animate();
        }
      };
      animationLoop();

      // Window resize handler
      const handleResize = () => {
        const sidebar = document.querySelector(".sidebar");
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const availableWidth = window.innerWidth - sidebarWidth;

        this.renderer.setSize(availableWidth, window.innerHeight);
        this.camera.aspect = availableWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      };

      window.addEventListener('resize', handleResize);

      // Cleanup on drawer close
      drawer.addEventListener("sl-after-hide", () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        this.cleanup();
        container.innerHTML = "";
      }, { once: true });

    } catch (error) {
      console.error("Error creating 3D view:", error);
      container.innerHTML = `
            <div style="color: red; padding: 20px;">
                Error creating 3D view: ${error.message}
            </div>
        `;
    } finally {
      progress.style.display = "none";
    }
  }

  async processRooms(scene, mainBox, updateStatus) {
    let result = mainBox;
    const totalRooms = this.rooms.length;

    for (let i = 0; i < totalRooms; i++) {
      const room = this.rooms[i];
      const roomMesh = this.createRoomShape(room);

      if (roomMesh) {
        try {
          // Perform CSG subtraction
          const bspA = CSG.fromMesh(result);
          const bspB = CSG.fromMesh(roomMesh);
          const bspResult = bspA.subtract(bspB);
          result = CSG.toMesh(bspResult, result.matrix, result.material);
        } catch (error) {
          console.error(`Error processing room ${room.id}:`, error);
        }
      }

      if (updateStatus) {
        updateStatus(20 + 60 * (i / totalRooms));
      }
    }

    this.scene.add(result);
    return result;
  }

  async assignTexture(structure, textureData, position = null) {
    if (!structure || !textureData) return null;

    const assignment = {
      id: Date.now(),
      textureId: textureData.id,
      structureId: structure.id,
      structureType: structure.type,
      position: position || null, // For specific placement on walls/rooms
      dateAssigned: new Date().toISOString()
    };

    // Initialize texture assignments if needed
    if (!structure.textureAssignments) {
      structure.textureAssignments = new Map();
    }

    structure.textureAssignments.set(assignment.id, assignment);

    // If this is a door texture, handle it specially
    if (textureData.category === 'doors') {
      return this.createDoor(structure, assignment);
    }

    // If this is a prop (like a torch), handle placement
    if (textureData.category === 'props') {
      return this.createProp(structure, assignment);
    }

    return assignment;
  }

  createProp(structure, assignment) {
    const prop = {
      id: assignment.id,
      parentId: structure.id,
      textureId: assignment.textureId,
      position: assignment.position,
      rotation: 0
    };

    // Add visual representation
    const propElement = document.createElement('div');
    propElement.className = 'prop';
    propElement.style.cssText = `
        position: absolute;
        pointer-events: all;
        cursor: pointer;
        width: ${this.cellSize}px;
        height: ${this.cellSize}px;
    `;

    // Add to structure
    if (!structure.props) structure.props = new Map();
    structure.props.set(prop.id, prop);

    return prop;
  }

  createTeleporterParticles(x, y, z) {
    const geometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    
    for(let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;     // X
      positions[i * 3 + 1] = 0; // Y
      positions[i * 3 + 2] = 0; // Z
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.6
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.position.set(x, y, z);
    
    // Store initial positions for animation
    particles.userData.initialPositions = [...positions];
    particles.userData.animate = true;
    
    return particles;
  }

  updateTeleportPrompt(nearestTeleporter) {
    if (!this.teleportPrompt) {
      // Create prompt if it doesn't exist
      this.teleportPrompt = document.createElement('div');
      this.teleportPrompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        display: none;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(this.teleportPrompt);
      
      // Add keypress listener for teleportation
      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE' && this.teleportPrompt.style.display === 'block') {
          this.executeTeleport();
        }
      });
    }
    
    if (nearestTeleporter) {
      this.teleportPrompt.textContent = 'Press E to teleport';
      this.teleportPrompt.style.display = 'block';
      this.activeTeleporter = nearestTeleporter;
    } else {
      this.teleportPrompt.style.display = 'none';
      this.activeTeleporter = null;
    }
  }
  
  // Add method to handle the actual teleportation
  // executeTeleport() {

  //   const PLAYER_HEIGHT = 1.7;  // Total height from feet to eyes
  //   const PLAYER_FEET_OFFSET = 0.1;  // Small offset to keep feet above ground

  //   if (!this.activeTeleporter || !this.activeTeleporter.pairedMarker) return;
    
  //   const destination = this.teleporters.find(t => 
  //     t.marker.id === this.activeTeleporter.pairedMarker.id
  //   );
    
  //   if (destination) {
  //     const destX = destination.position.x;
  //     const destZ = destination.position.z;
      
  //     // Get elevation info
  //     const elevationInfo = this.getHighestElevationAtPoint(destX, destZ);
  //     console.log("Teleport destination elevation:", elevationInfo);
      
  //     // Calculate exact foot position
  //     const feetPosition = elevationInfo.elevation + PLAYER_FEET_OFFSET;
  //     // Calculate eye/camera position
  //     const eyePosition = feetPosition + PLAYER_HEIGHT;
      
  //     console.log("Height calculation:", {
  //       surfaceElevation: elevationInfo.elevation,
  //       feetPosition: feetPosition,
  //       eyePosition: eyePosition,
  //       playerTotalHeight: PLAYER_HEIGHT
  //     });
      
  //     // Create flash effect
  //     const flash = document.createElement('div');
  //     flash.style.cssText = `
  //       position: fixed;
  //       top: 0;
  //       left: 0;
  //       right: 0;
  //       bottom: 0;
  //       background: white;
  //       opacity: 0;
  //       pointer-events: none;
  //       transition: opacity 0.3s ease;
  //       z-index: 9999;
  //     `;
  //     document.body.appendChild(flash);
      
  //     // Animate teleportation
  //     requestAnimationFrame(() => {
  //       flash.style.opacity = '1';
  //       setTimeout(() => {
  //         // Move camera to eye position
  //         this.camera.position.set(destX, eyePosition, destZ);
          
  //         // Log final position for debugging
  //         const { x, y, z } = this.camera.position;
  //         console.log("Final camera position:", {
  //           x,
  //           y,
  //           z,
  //           feetAt: y - PLAYER_HEIGHT,
  //           surfaceAt: elevationInfo.elevation
  //         });
          
  //         // Fade out
  //         flash.style.opacity = '0';
  //         setTimeout(() => flash.remove(), 300);
  //       }, 150);
  //     });
  //   }
  // }


  // Replace the executeTeleport method with this version
// This should be added to Scene3DController.js



// Replace the executeTeleport method in Scene3DController.js
executeTeleport() {
  if (!this.activeTeleporter || !this.activeTeleporter.pairedMarker) return;
  
  // Find the paired teleporter
  const destination = this.teleporters.find(t => 
    t.marker.id === this.activeTeleporter.pairedMarker.id
  );
  
  if (destination) {
    // Get destination coordinates from teleporter
    const destX = destination.position.x;
    const destZ = destination.position.z;
    
    // The teleporter circle is already at the correct height
    // Get its Y position which accounts for elevation
    const destY = destination.position.y;
    
    console.log("Teleport destination:", {
      x: destX,
      y: destY,
      z: destZ,
      teleporterPosition: destination.position
    });
    
    // Create flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 9999;
    `;
    document.body.appendChild(flash);
    
    // Animate teleportation
    requestAnimationFrame(() => {
      flash.style.opacity = '1';
      setTimeout(() => {
        // Update the physics controller's ground height directly
        if (this.physics) {
          // Update the physics ground height to match destination elevation
          // Subtract the small offset that's added to teleporter position (0.05)
          this.physics.currentGroundHeight = destY - 0.05;
          console.log("Setting physics ground height:", this.physics.currentGroundHeight);
          
          // Reset any jumping or falling state
          this.physics.isJumping = false;
          this.physics.isFalling = false;
        }
        
        // Move the player - position + physics-controlled player height
        const playerHeight = this.physics ? this.physics.playerHeight : 1.7;
        this.camera.position.set(
          destX,
          destY - 0.05 + playerHeight, // Adjust to player eye level
          destZ
        );
        
        console.log("Final position:", {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z,
          groundHeight: this.physics ? this.physics.currentGroundHeight : "No physics",
          playerHeight: playerHeight
        });
        
        // Fade out
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 300);
      }, 150);
    });
  }
}


}
