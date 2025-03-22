/**
 * Modified ShapeForgeBridge.js to focus on proper effect handling
 */
window.ShapeForgeBridge = class ShapeForgeBridge {
  constructor(targetScene, resourceManager) {
    this.targetScene = targetScene;
    this.resourceManager = resourceManager;
    this.modelsCache = new Map();
    this.animatedObjects = new Set();
    
    // Try to get the ShapeForge instance
    this.shapeForge = window.shapeForge || null;
    
    // Get shader effects manager
    this.shaderEffects = null;
    if (window.shaderEffectsManager) {
      this.shaderEffects = window.shaderEffectsManager;
    } else if (window.scene3D && window.scene3D.shaderEffects) {
      this.shaderEffects = window.scene3D.shaderEffects;
    }
    
    console.log('ShapeForgeBridge initialized with:', {
      hasTargetScene: !!targetScene,
      hasResourceManager: !!resourceManager,
      hasShapeForge: !!this.shapeForge,
      hasShaderEffects: !!this.shaderEffects
    });
  }
  
  /**
   * Create a ShapeForge model directly using a much simpler approach
   */
  async createModel(modelId, options = {}) {
    try {
      // Load model data
      let modelJson;
      if (typeof modelId === 'string') {
        modelJson = await this.loadModelFromResource(modelId);
        if (!modelJson) {
          throw new Error(`Model with ID ${modelId} not found`);
        }
      } else {
        modelJson = modelId;
      }
      
      console.log('Creating model:', modelJson.name);
      
      // Create a container group for the model
      const container = new THREE.Group();
      container.name = modelJson.name || 'ShapeForge Model';
      
      // Apply transforms from options
      if (options.position) container.position.copy(options.position);
      if (options.rotation) container.rotation.copy(options.rotation);
      if (options.scale) {
        if (typeof options.scale === 'number') {
          container.scale.set(options.scale, options.scale, options.scale);
        } else {
          container.scale.copy(options.scale);
        }
      }
      
      // SIMPLER APPROACH: Create the objects and effects manually
      // without trying to use ShapeForge internals
      
      // Track objects with effects for animation
      const objectsWithEffects = [];
      
      // Process each object in the model data
      modelJson.data.objects.forEach(objData => {
        try {
          // Create the mesh
          const mesh = this.createMeshFromObjectData(objData);
          if (!mesh) return;
          
          // Add to container
          container.add(mesh);
          
          // Apply texture if present
          if (objData.material && objData.material.texture && objData.material.texture.data) {
            this.applyTexture(mesh, objData.material.texture);
          }
          
          // Apply effect if present
          if (objData.effect) {
            console.log(`Object ${objData.name} has effect:`, objData.effect.type);
            
            // Apply the effect directly
            const effectData = this.applyEffect(mesh, objData.effect);
            
            // Track for animation if it has an update function
            if (effectData && effectData.update) {
              objectsWithEffects.push({
                mesh,
                effectData
              });
            }
          }
        } catch (e) {
          console.warn(`Error creating object ${objData.name}:`, e);
        }
      });
      
      // Register for animation if needed
      if (objectsWithEffects.length > 0) {
        console.log(`Registering ${objectsWithEffects.length} objects for animation`);
        container.userData.effectObjects = objectsWithEffects;
        this.registerForAnimation(container);
      }
      
      // Add container to scene
      this.targetScene.add(container);
      return container;
      
    } catch (error) {
      console.error('Error creating model:', error);
      return null;
    }
  }
  
  /**
   * Create a mesh from object data
   */
  createMeshFromObjectData(objData) {
    // Create geometry based on type
    let geometry;
    
    switch (objData.type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(
          objData.parameters.width || 1,
          objData.parameters.height || 1,
          objData.parameters.depth || 1,
          objData.parameters.widthSegments || 1,
          objData.parameters.heightSegments || 1,
          objData.parameters.depthSegments || 1
        );
        break;
        
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.widthSegments || 32,
          objData.parameters.heightSegments || 16
        );
        break;
        
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          objData.parameters.radiusTop || 0.5,
          objData.parameters.radiusBottom || 0.5,
          objData.parameters.height || 1,
          objData.parameters.radialSegments || 32
        );
        break;
        
      case 'cone':
        geometry = new THREE.ConeGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.height || 1,
          objData.parameters.radialSegments || 32
        );
        break;
        
      case 'torus':
        geometry = new THREE.TorusGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.tube || 0.2,
          objData.parameters.radialSegments || 16,
          objData.parameters.tubularSegments || 48
        );
        break;
        
      case 'plane':
        geometry = new THREE.PlaneGeometry(
          objData.parameters.width || 1,
          objData.parameters.height || 1,
          objData.parameters.widthSegments || 1,
          objData.parameters.heightSegments || 1
        );
        break;
        
      case 'tetrahedron':
        geometry = new THREE.TetrahedronGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.detail || 0
        );
        break;
        
      case 'octahedron':
        geometry = new THREE.OctahedronGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.detail || 0
        );
        break;
        
      case 'dodecahedron':
        geometry = new THREE.DodecahedronGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.detail || 0
        );
        break;
        
      case 'icosahedron':
        geometry = new THREE.IcosahedronGeometry(
          objData.parameters.radius || 0.5,
          objData.parameters.detail || 0
        );
        break;
        
      default:
        console.warn(`Unsupported shape type: ${objData.type}`);
        return null;
    }
    
    // Create material
    let material;
    
    if (objData.material) {
      const materialParams = {
        color: objData.material.color !== undefined ? objData.material.color : 0x3388ff,
        wireframe: objData.material.wireframe || false
      };
      
      if (objData.material.transparent) {
        materialParams.transparent = true;
        materialParams.opacity = objData.material.opacity !== undefined ? objData.material.opacity : 1;
      }
      
      switch (objData.material.type) {
        case 'MeshBasicMaterial':
          material = new THREE.MeshBasicMaterial(materialParams);
          break;
        case 'MeshStandardMaterial':
          materialParams.roughness = objData.material.roughness !== undefined ? objData.material.roughness : 0.5;
          materialParams.metalness = objData.material.metalness !== undefined ? objData.material.metalness : 0;
          material = new THREE.MeshStandardMaterial(materialParams);
          break;
        case 'MeshPhongMaterial':
          material = new THREE.MeshPhongMaterial(materialParams);
          break;
        case 'MeshLambertMaterial':
          material = new THREE.MeshLambertMaterial(materialParams);
          break;
        default:
          material = new THREE.MeshStandardMaterial(materialParams);
      }
    } else {
      material = new THREE.MeshStandardMaterial({
        color: 0x3388ff,
        roughness: 0.5,
        metalness: 0
      });
    }
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply transforms
    if (objData.position) {
      mesh.position.set(
        objData.position.x || 0,
        objData.position.y || 0,
        objData.position.z || 0
      );
    }
    
    if (objData.rotation) {
      mesh.rotation.set(
        objData.rotation.x || 0,
        objData.rotation.y || 0,
        objData.rotation.z || 0
      );
    }
    
    if (objData.scale) {
      mesh.scale.set(
        objData.scale.x || 1,
        objData.scale.y || 1,
        objData.scale.z || 1
      );
    }
    
    // Set name
    if (objData.name) {
      mesh.name = objData.name;
    }
    
    return mesh;
  }
  
  /**
   * Apply a texture to a mesh
   */
  applyTexture(mesh, textureData) {
    if (!mesh || !textureData || !textureData.data) return;
    
    // Create a texture loader
    const loader = new THREE.TextureLoader();
    
    // Make sure the material color is white to avoid tinting
    if (mesh.material) {
      mesh.material.color.set(0xffffff);
    }
    
    // Load the texture
    loader.load(
      textureData.data,
      // Success callback
      (texture) => {
        console.log(`Texture loaded for ${mesh.name}`);
        
        // Configure texture settings
        if (textureData.repeat && textureData.repeat.length === 2) {
          texture.repeat.set(textureData.repeat[0], textureData.repeat[1]);
        }
        
        if (textureData.offset && textureData.offset.length === 2) {
          texture.offset.set(textureData.offset[0], textureData.offset[1]);
        }
        
        if (textureData.rotation !== undefined) {
          texture.rotation = textureData.rotation;
        }
        
        // Set wrapping modes
        texture.wrapS = textureData.wrapS || THREE.RepeatWrapping;
        texture.wrapT = textureData.wrapT || THREE.RepeatWrapping;
        
        // Apply texture to material
        if (mesh.material) {
          mesh.material.map = texture;
          mesh.material.needsUpdate = true;
        }
      },
      undefined,
      (error) => {
        console.error(`Error loading texture for ${mesh.name}:`, error);
      }
    );
  }
  
  /**
   * Apply an effect to a mesh
   */
  applyEffect(mesh, effect) {
    const effectType = typeof effect === 'string' ? effect : effect.type;
    const parameters = typeof effect === 'object' ? effect.parameters : {};
    
    console.log(`Applying ${effectType} effect to ${mesh.name} with parameters:`, parameters);
    
    // Get shader effects manager
    let effectsManager = this.shaderEffects;
    if (!effectsManager) {
      effectsManager = window.shaderEffectsManager || 
                       (window.scene3D ? window.scene3D.shaderEffects : null);
    }
    
    if (!effectsManager) {
      console.warn('No shader effects manager available');
      return null;
    }
    
    // Apply effect based on type
    let effectData = null;
    
    try {
      // Make sure we have mesh's world position correct
      mesh.updateMatrixWorld(true);
      
      // Create container for effect
      const container = new THREE.Group();
      container.position.copy(mesh.position);
      container.rotation.copy(mesh.rotation);
      mesh.parent.add(container);
      
      if (effectType === 'fire') {
        effectData = this.createFireEffect(mesh, parameters);
      }
      else if (effectType === 'portalEffect') {
        effectData = this.createPortalEffect(mesh, parameters);
      }
      else if (effectType === 'holy') {
        effectData = this.createHolyEffect(mesh, parameters);
      }
      else if (effectType === 'glow') {
        effectData = this.createGlowEffect(mesh, parameters);
      }
      else if (effectsManager.applyEffect) {
        // Use manager's generic method
        effectsManager.applyEffect(mesh, effectType);
        
        // Try to get the created effect
        if (effectsManager.effects && typeof effectsManager.effects.get === 'function') {
          effectData = effectsManager.effects.get(mesh.id);
        }
      }
      
      if (effectData) {
        console.log(`Effect ${effectType} created for ${mesh.name}`);
        return effectData;
      }
    } catch (error) {
      console.error(`Error applying ${effectType} effect:`, error);
    }
    
    return null;
  }
  
  /**
   * Create a fire effect
   */
  createFireEffect(mesh, parameters = {}) {
    // Create a container for the fire effect
    const container = new THREE.Group();
    container.position.copy(mesh.position);
    container.rotation.copy(mesh.rotation);
    mesh.parent.add(container);
    
    // Default parameters
    const fireParams = {
      color: parameters.color || 0xff6600,
      intensity: parameters.intensity || 1.2,
      particleCount: 30
    };
    
    // Create light
    const light = new THREE.PointLight(
      fireParams.color,
      fireParams.intensity,
      parameters.distance || 3
    );
    light.position.y = 0.5; // Position above the base
    container.add(light);
    
    // Create particle system for flames
    const particleGeometry = new THREE.BufferGeometry();
    const vertices = [];
    
    // Create particles in cone shape
    for (let i = 0; i < fireParams.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.3;
      const height = Math.random() * 0.8;
      
      vertices.push(
        Math.cos(angle) * radius * (1 - height/0.8),
        height,
        Math.sin(angle) * radius * (1 - height/0.8)
      );
    }
    
    particleGeometry.setAttribute('position', 
      new THREE.Float32BufferAttribute(vertices, 3));
    
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: fireParams.color,
      size: 0.1,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    container.add(particles);
    
    // Create update function
    const update = function(deltaTime) {
      // Animate particles
      const positions = particles.geometry.attributes.position.array;
      
      for (let i = 0; i < fireParams.particleCount; i++) {
        const i3 = i * 3;
        
        // Move particles upward
        positions[i3 + 1] += deltaTime * 0.5;
        
        // Add some random movement
        positions[i3] += (Math.random() - 0.5) * 0.02;
        positions[i3 + 2] += (Math.random() - 0.5) * 0.02;
        
        // Reset particles that get too high
        if (positions[i3 + 1] > 0.8) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.3;
          
          positions[i3] = Math.cos(angle) * radius;
          positions[i3 + 1] = 0;
          positions[i3 + 2] = Math.sin(angle) * radius;
        }
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Flicker light
      light.intensity = fireParams.intensity * (0.8 + Math.sin(Date.now() * 0.01) * 0.2);
    };
    
    return {
      container,
      light,
      particles,
      update,
      type: 'fire'
    };
  }
  
  /**
   * Create a portal effect
   */
  createPortalEffect(mesh, parameters = {}) {
    // Create container
    const container = new THREE.Group();
    container.position.copy(mesh.position);
    container.rotation.copy(mesh.rotation);
    mesh.parent.add(container);
    
    // Default parameters
    const portalParams = {
      color: parameters.color || 0x8800ff,
      intensity: parameters.intensity || 1.5
    };
    
    // Check if this is a horizontal portal (rotated around X axis)
    const isHorizontal = Math.abs(mesh.rotation.x - Math.PI/2) < 0.1;
    
    // Create portal ring
    const ringGeometry = new THREE.TorusGeometry(0.7, 0.1, 16, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: portalParams.color,
      transparent: true,
      opacity: 0.8
    });
    const portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Set orientation
    if (isHorizontal) {
      console.log('Setting horizontal orientation for portal ring');
      portalRing.rotation.x = Math.PI/2;
    }
    
    container.add(portalRing);
    
    // Create vortex
    const vortexGeometry = new THREE.CircleGeometry(0.6, 32);
    const vortexMaterial = new THREE.MeshBasicMaterial({
      color: portalParams.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
    
    // Set orientation
    if (isHorizontal) {
      vortex.rotation.x = Math.PI/2;
    }
    
    container.add(vortex);
    
    // Create light
    const light = new THREE.PointLight(
      portalParams.color,
      portalParams.intensity,
      parameters.distance || 3
    );
    container.add(light);
    
    // Create update function
    const update = function(deltaTime) {
      // Rotate portal ring
      portalRing.rotation.z += deltaTime * 0.5;
      
      // Counter-rotate vortex
      vortex.rotation.z -= deltaTime * 0.3;
      
      // Pulse light
      light.intensity = portalParams.intensity * (0.7 + Math.sin(Date.now() * 0.003) * 0.3);
    };
    
    return {
      container,
      portalRing,
      vortex,
      light,
      update,
      type: 'portalEffect'
    };
  }
  
  /**
   * Create a holy effect
   */
  createHolyEffect(mesh, parameters = {}) {
    // Create container
    const container = new THREE.Group();
    container.position.copy(mesh.position);
    mesh.parent.add(container);
    
    // Default parameters
    const holyParams = {
      color: parameters.color || 0xffdd88,
      intensity: parameters.intensity || 1.0
    };
    
    // Create light
    const light = new THREE.PointLight(
      holyParams.color,
      holyParams.intensity,
      parameters.distance || 3
    );
    light.position.y = 1.0; // Position above the object
    container.add(light);
    
    // Create particles
    const particleGeometry = new THREE.BufferGeometry();
    const vertices = [];
    
    // Create particles in sphere shape
    for (let i = 0; i < 20; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      
      vertices.push(
        Math.cos(angle1) * Math.sin(angle2) * radius,
        Math.sin(angle1) * Math.sin(angle2) * radius + 1.0, // Above object
        Math.cos(angle2) * radius
      );
    }
    
    particleGeometry.setAttribute('position', 
      new THREE.Float32BufferAttribute(vertices, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: holyParams.color,
      size: 0.1,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    container.add(particles);
    
    // Create update function
    const update = function(deltaTime) {
      // Animate particles
      const positions = particles.geometry.attributes.position.array;
      const time = Date.now() * 0.001;
      
      for (let i = 0; i < 20; i++) {
        const i3 = i * 3;
        const angle = time + i * 0.2;
        
        // Orbit motion
        positions[i3] = Math.cos(angle) * 0.3 + Math.cos(angle * 0.5) * 0.2;
        positions[i3 + 2] = Math.sin(angle) * 0.3 + Math.sin(angle * 0.5) * 0.2;
        
        // Gentle bob up and down
        positions[i3 + 1] = Math.sin(time * 0.5 + i * 0.1) * 0.1 + 1.0;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Pulse light
      light.intensity = holyParams.intensity * (0.7 + Math.sin(time * 2) * 0.3);
    };
    
    return {
      container,
      light,
      particles,
      update,
      type: 'holy'
    };
  }
  
  /**
   * Create a glow effect
   */
  createGlowEffect(mesh, parameters = {}) {
    // Create container
    const container = new THREE.Group();
    container.position.copy(mesh.position);
    mesh.parent.add(container);
    
    // Default parameters
    const glowParams = {
      color: parameters.color || 0x66ccff,
      intensity: parameters.intensity || 1.0
    };
    
    // Create light
    const light = new THREE.PointLight(
      glowParams.color,
      glowParams.intensity,
      parameters.distance || 3
    );
    container.add(light);
    
    // Create particles
    const particleGeometry = new THREE.BufferGeometry();
    const vertices = [];
    
    // Create particles around the object
    for (let i = 0; i < 15; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.3;
      
      vertices.push(
        Math.cos(angle1) * Math.sin(angle2) * radius,
        Math.sin(angle1) * Math.sin(angle2) * radius,
        Math.cos(angle2) * radius
      );
    }
    
    particleGeometry.setAttribute('position', 
      new THREE.Float32BufferAttribute(vertices, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: glowParams.color,
      size: 0.07,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    container.add(particles);
    
    // Create update function
    const update = function(deltaTime) {
      // Gentle particle movement
      const positions = particles.geometry.attributes.position.array;
      const time = Date.now() * 0.001;
      
      for (let i = 0; i < 15; i++) {
        const i3 = i * 3;
        const angle = time * 0.5 + i * 0.3;
        
        // Slight orbital motion
        const originalX = positions[i3];
        const originalZ = positions[i3 + 2];
        
        positions[i3] = originalX * Math.cos(angle * 0.1) - originalZ * Math.sin(angle * 0.1);
        positions[i3 + 2] = originalX * Math.sin(angle * 0.1) + originalZ * Math.cos(angle * 0.1);
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Pulse light
      light.intensity = glowParams.intensity * (0.8 + Math.sin(time * 3) * 0.2);
    };
    
    return {
      container,
      light,
      particles,
      update,
      type: 'glow'
    };
  }
  
  /**
   * Register an object for animation updates
   */
  registerForAnimation(object) {
    // Add to tracking set
    this.animatedObjects.add(object);
    
    // Install animation system
    this.installAnimationSystem();
    
    console.log(`Registered object for animation: ${object.name}`);
  }
  
  /**
   * Install animation system
   */
  installAnimationSystem() {
    // Only install once
    if (window.scene3D && !window.scene3D._effectAnimationInstalled) {
      const originalAnimate = window.scene3D.animate;
      const animatedObjects = this.animatedObjects;
      
      window.scene3D.animate = function() {
        // Call original animate
        originalAnimate.call(this);
        
        // Calculate delta time
        const now = performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
        this.lastFrameTime = now;
        
        // Update all objects with effects
        animatedObjects.forEach(obj => {
          if (obj.userData && obj.userData.effectObjects) {
            obj.userData.effectObjects.forEach(({mesh, effectData}) => {
              if (effectData && effectData.update) {
                effectData.update(deltaTime);
              }
            });
          }
        });
      };
      
      window.scene3D._effectAnimationInstalled = true;
      console.log('Effect animation system installed');
    }
  }
  
  /**
   * Load a model from ResourceManager
   */
  async loadModelFromResource(modelId) {
    // Check cache first
    if (this.modelsCache.has(modelId)) {
      return this.modelsCache.get(modelId);
    }
    
    // Try ResourceManager
    if (this.resourceManager?.resources?.shapeforge) {
      const model = this.resourceManager.resources.shapeforge.get(modelId);
      if (model) {
        this.modelsCache.set(modelId, model);
        return model;
      }
    }
    
    // Try IndexedDB
    try {
      const db = await this.openModelDatabase();
      const tx = db.transaction(['models'], 'readonly');
      const store = tx.objectStore('models');
      const model = await store.get(modelId);
      
      if (model) {
        this.modelsCache.set(modelId, model);
        return model;
      }
    } catch (e) {
      console.error('Error loading model from IndexedDB:', e);
    }
    
    return null;
  }
  
  /**
   * Open IndexedDB database
   */
  openModelDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ShapeForgeModels', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
        }
      };
    });
  }
}