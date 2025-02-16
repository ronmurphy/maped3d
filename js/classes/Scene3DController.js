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
    this.clear();
    // Make animate a class method
    this.animate = () => {
      const currentSpeed = this.moveState.speed;

      // Handle movement
      if (this.moveState.forward) this.controls.moveForward(currentSpeed);
      if (this.moveState.backward) this.controls.moveForward(-currentSpeed);
      if (this.moveState.left) this.controls.moveRight(-currentSpeed);
      if (this.moveState.right) this.controls.moveRight(currentSpeed);

      // Keep player at constant height
      this.camera.position.y = 1.7;

      // Render the scene
      this.renderer.render(this.scene, this.camera);
    };

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

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement?.parentNode) {
        this.renderer.domElement.parentNode.removeChild(
          this.renderer.domElement
        );
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

  createTokenMesh(token) {
    // Create billboard material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load(token.image),
      transparent: true,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    // Scale based on token size and grid
    const scale = token.size * (this.cellSize / 50);
    sprite.scale.set(scale, scale, 1);

    // Position in world space
    const x = token.x / this.cellSize - this.boxWidth / 2;
    const z = token.y / this.cellSize - this.boxDepth / 2;
    sprite.position.set(x, token.height, z);

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

        // Remove the translate line - let mesh positioning handle it
        // geometry.translate(minX / 50, 0, minY / 50);

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
      // mesh.position.set(
      //     (room.bounds.x + room.bounds.width/2) / 50 - boxWidth / 2,
      //     0,
      //     (room.bounds.y + room.bounds.height/2) / 50 - boxDepth / 2
      // );

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
    console.log("Processing marker:", {
      type: marker.type,
      data: marker.data,
      hasMonster: !!marker.data?.monster,
      hasToken: !!marker.data?.monster?.token,
      tokenData: marker.data?.monster?.token?.data,
      tokenUrl: marker.data?.monster?.token?.url
    });

    if (!marker || !marker.data || !marker.data.monster) {
      console.log("Invalid marker data");
      return null;
    }

    if (!marker.data.monster.token || (!marker.data.monster.token.data && !marker.data.monster.token.url)) {
      console.log("No valid token data found");
      return null;
    }

    // Get correct token image source
    const tokenSource = marker.data.monster.token.data || marker.data.monster.token.url;
    console.log("Token image source type:", {
      isBase64: tokenSource.startsWith('data:'),
      length: tokenSource.length,
      preview: tokenSource.substring(0, 100) + '...'
    });

    const monsterSize = this.getMonsterSizeInSquares(marker.data.monster.basic.size || "medium");
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

    console.log("Finished processing markers, total tokens:", this.tokens.length);

    // const camera = new THREE.PerspectiveCamera(
    //         75,
    //         (window.innerWidth * 0.75) / window.innerHeight,
    //         0.1,
    //         1000
    //       );
    //       camera.position.set(0, 2, 5);

    //  const sidebarContentWidth = document.querySelector(".sidebar-content");

    // const renderer = new THREE.WebGLRenderer({ antialias: true });
    // renderer.setSize(window.innerWidth * 0.95, window.innerHeight);
    // renderer.shadowMap.enabled = true;

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
        return; // Skip these special texture rooms
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
      camera.position.set(
        this.playerStart.x / 50 - this.boxWidth / 2,
        1.7, // Eye level
        this.playerStart.y / 50 - this.boxDepth / 2
      );
    }



    const createTokenMesh = (token) => {
      // Debug log the token data
      console.log("Creating token mesh with data:", token);

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

    // Then when creating tokens:
    if (this.tokens && this.tokens.length > 0) {
      console.log("Processing tokens for 3D view:", this.tokens);

      Promise.all(this.tokens.map(token => createTokenMesh(token)))
        .then(sprites => {
          sprites.forEach(sprite => this.scene.add(sprite));
          console.log("All token sprites added to scene");
        })
        .catch(error => {
          console.error("Error creating token sprites:", error);
        });
    }


    // const controls = new THREE.PointerLockControls(
    //   this.camera,
    //   this.renderer.domElement
    // );

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

    // Animation loop
    const animate = () => {
      const currentSpeed = moveState.speed;

      // Handle movement
      if (moveState.forward) this.controls.moveForward(currentSpeed);
      if (moveState.backward) this.controls.moveForward(-currentSpeed);
      if (moveState.left) this.controls.moveRight(-currentSpeed);
      if (moveState.right) this.controls.moveRight(currentSpeed);

      // Keep player at constant height (no jumping/falling)
      this.camera.position.y = 1.7;

      // Render the scene
      this.renderer.render(this.scene, this.camera);
    };

    // Return all necessary objects and cleanup function
    const cleanup = () => {
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

    return {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      animate: this.animate,
      controls: this.controls,
      cleanup: cleanup  // Assign the cleanup function
    };
  }



  async show3DView() {
    const { drawer, container, progress } = this.setupDrawer();

    progress.style.display = "block";
    progress.value = 0;

    const updateStatus = (percent) => {
      progress.value = percent;
      progress.innerHTML = `Processing... ${Math.round(percent)}%`;
    };



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


}
