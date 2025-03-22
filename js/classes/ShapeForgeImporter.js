/**
 * ShapeForgeImporter.js - Imports ShapeForge models into Scene3D
 * Uses the original ShapeForge methods for effects
 */
class ShapeForgeImporter {
  /**
   * Create a new ShapeForgeImporter
   * @param {THREE.Scene} scene - The THREE.js scene to add models to
   * @param {Object} resourceManager - Reference to the resource manager
   * @param {Object} shapeForge - Reference to ShapeForge (optional)
   */
  constructor(scene, resourceManager, shapeForge = null) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.modelsCache = new Map(); // Cache for loaded models
    
    // Try to get ShapeForge instance
    this.shapeForge = shapeForge;
    
    if (!this.shapeForge) {
      // Try global instance
      if (window.shapeForge) {
        this.shapeForge = window.shapeForge;
      }
    }
    
    // Get shader effects manager
    this.shaderEffects = null;
    if (window.shaderEffectsManager) {
      this.shaderEffects = window.shaderEffectsManager;
    } else if (window.scene3D && window.scene3D.shaderEffects) {
      this.shaderEffects = window.scene3D.shaderEffects;
    }
    
    // Log initialization state
    console.log('ShapeForgeImporter initialized with:', {
      hasScene: !!scene,
      hasResourceManager: !!resourceManager,
      hasShapeForge: !!this.shapeForge,
      hasShaderEffects: !!this.shaderEffects
    });
  }

  /**
   * Loads a ShapeForge model from ResourceManager or IndexedDB
   * @param {string} modelId - The ID of the model to load
   * @returns {Promise<Object>} - The model data
   */
  async loadModel(modelId) {
    // Try memory cache first
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
    
    // Try IndexedDB as last resort
    try {
      const db = await this.openModelDatabase();
      const tx = db.transaction(['models'], 'readonly');
      const store = tx.objectStore('models');
      const model = await store.get(modelId);
      
      if (model) {
        // Pre-load textures if any
        if (model.data?.objects) {
          model.data.objects.forEach(obj => {
            if (obj.material?.texture?.data) {
              // Create an Image to preload the texture
              const img = new Image();
              img.src = obj.material.texture.data;
            }
          });
        }
        
        this.modelsCache.set(modelId, model);
        return model;
      }
    } catch (e) {
      console.error('Error loading model from IndexedDB:', e);
    }
    
    return null;
  }
  
  /**
   * Open the IndexedDB database for ShapeForge models
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

  /**
   * Convert ShapeForge model data into a Three.js Group
   * @param {Object} modelData - ShapeForge model data
   * @param {Object} options - Additional options (scale, position, etc)
   * @returns {THREE.Group} - The Three.js group containing the model
   */
  createThreeJsModel(modelData, options = {}) {
    if (!modelData || !modelData.data || !modelData.data.objects) {
      console.error('Invalid model data:', modelData);
      return null;
    }
    
    // Create a group to hold all objects
    const group = new THREE.Group();
    
    // Apply name
    group.name = modelData.name || 'ShapeForge Model';
    
    // Process each object in the model
    modelData.data.objects.forEach(objData => {
      try {
        // Skip null or undefined objects
        if (!objData) return;
        
        // Create mesh from object data
        const mesh = this.createMeshFromObject(objData);
        if (!mesh) return;
        
        // Add to the group
        group.add(mesh);
        
        // Apply shader effect if present using ShapeForge's methods
        if (objData.effect) {
          this.applyShaderEffect(mesh, objData.effect);
        }
      } catch (e) {
        console.warn(`Error creating object ${objData?.name || 'unnamed'}:`, e);
      }
    });
    
    // Apply transforms
    if (options.position) group.position.copy(options.position);
    if (options.rotation) group.rotation.copy(options.rotation);
    if (options.scale) {
      if (typeof options.scale === 'number') {
        group.scale.set(options.scale, options.scale, options.scale);
      } else {
        group.scale.copy(options.scale);
      }
    }
    
    // Store reference to original data
    group.userData.shapeforgeData = {
      id: modelData.id,
      name: modelData.name
    };
    
    return group;
  }

  /**
   * Create a Three.js mesh from a ShapeForge object
   */
  createMeshFromObject(objData) {
    if (!objData.type) {
      console.warn("Object missing type property:", objData);
      return null;
    }
    
    // Create geometry based on type
    let geometry;
    
    // Special handling for merged objects with geometryData
    if (objData.type === 'merged' && objData.geometryData) {
      geometry = this.createMergedGeometry(objData.geometryData);
    } else {
      switch(objData.type) {
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
          
        case 'd10':
          // For D10, use the special createD10Geometry method
          geometry = this.createD10Geometry(objData.parameters);
          break;
          
        default:
          console.warn(`Unsupported shape type: ${objData.type}`);
          return null;
      }
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
    
    // Apply texture if present
    if (objData.material && objData.material.texture && objData.material.texture.data) {
      this.loadAndApplyTextureToObject(mesh, objData.material.texture);
    }
    
    return mesh;
  }
  
  /**
   * Create a D10 geometry
   */
  createD10Geometry(parameters) {
    const sides = parameters.sides || 10;
    const radius = parameters.radius || 0.5;
    
    // Define vertices for a pentagonal trapezohedron (D10)
    const vertices = [];
    
    // Top and bottom vertices
    vertices.push(0, 0, 1);   // Top vertex
    vertices.push(0, 0, -1);  // Bottom vertex
    
    // Add vertices around the "equator" with slight offsets
    for (let i = 0; i < sides; ++i) {
      const b = (i * Math.PI * 2) / sides;
      vertices.push(-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1));
    }
    
    // Define the faces
    const indices = [];
    
    // Top faces (connecting top vertex to equator)
    for (let i = 0; i < sides; i++) {
      indices.push(0, 2 + i, 2 + ((i + 1) % sides));
    }
    
    // Bottom faces (connecting bottom vertex to equator)
    for (let i = 0; i < sides; i++) {
      indices.push(1, 2 + ((i + 1) % sides), 2 + i);
    }
    
    // Create the geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Create geometry from merged data
   */
  createMergedGeometry(geometryData) {
    if (!geometryData) return new THREE.BoxGeometry(1, 1, 1);
    
    const geometry = new THREE.BufferGeometry();
    
    if (geometryData.vertices && geometryData.vertices.length > 0) {
      geometry.setAttribute('position', 
        new THREE.Float32BufferAttribute(geometryData.vertices, 3));
    }
    
    if (geometryData.normals && geometryData.normals.length > 0) {
      geometry.setAttribute('normal',
        new THREE.Float32BufferAttribute(geometryData.normals, 3));
    }
    
    if (geometryData.uvs && geometryData.uvs.length > 0) {
      geometry.setAttribute('uv',
        new THREE.Float32BufferAttribute(geometryData.uvs, 2));
    }
    
    if (geometryData.indices && geometryData.indices.length > 0) {
      geometry.setIndex(geometryData.indices);
    }
    
    if (!geometryData.normals || geometryData.normals.length === 0) {
      geometry.computeVertexNormals();
    }
    
    return geometry;
  }
  
  /**
   * Load and apply a texture to an object
   */
  loadAndApplyTextureToObject(mesh, textureData) {
    if (!mesh || !textureData || !textureData.data) {
      return;
    }
    
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
        console.error(`Error loading texture:`, error);
      }
    );
  }

  /**
   * Apply a shader effect to a mesh using ShapeForge's methods directly
   * @param {THREE.Mesh} mesh - The mesh to apply the effect to
   * @param {string|Object} effect - The effect type or effect data
   * @returns {boolean} - Whether the effect was successfully applied
   */
  // applyShaderEffect(mesh, effect) {
  //   // Do nothing if mesh is invalid
  //   if (!mesh) return false;
    
  //   // Extract effect type
  //   const effectType = typeof effect === 'string' ? effect : (effect.type || null);
  //   if (!effectType) return false;
    
  //   console.log(`Applying ${effectType} effect to mesh: ${mesh.name || 'unnamed'}`);
    
  //   // First approach: Use ShapeForge if available
  //   if (this.shapeForge) {
  //     console.log('Using ShapeForge for effect creation');
      
  //     try {
  //       // Update mesh world matrix to get correct position/rotation
  //       mesh.updateMatrixWorld(true);
        
  //       // Use ShapeForge's createEffectFromType method if available
  //       if (typeof this.shapeForge.createEffectFromType === 'function') {
  //         const parameters = typeof effect === 'object' ? effect.parameters : undefined;
  //         const effectData = this.shapeForge.createEffectFromType(effectType, mesh, parameters);
          
  //         if (effectData) {
  //           console.log('Effect created successfully with ShapeForge');
            
  //           // Special handling for portal rings - force horizontal orientation if needed
  //           if (effectType === 'portalEffect' && mesh.name?.toLowerCase().includes('portal')) {
  //             // Check if the torus is oriented horizontally (X rotation close to 90 degrees)
  //             const isHorizontal = Math.abs(mesh.rotation.x - Math.PI/2) < 0.1;
              
  //             if (isHorizontal && effectData.portalRing) {
  //               console.log('Enforcing horizontal orientation for portal ring');
  //               effectData.portalRing.rotation.x = Math.PI/2;
                
  //               // Also adjust vortex if present
  //               if (effectData.vortex) {
  //                 effectData.vortex.rotation.x = Math.PI/2;
  //               }
  //             }
  //           }
            
  //           return true;
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Error using ShapeForge to create effect:', error);
  //     }
  //   }
    
  //   // Second approach: Use shader effects manager directly
  //   const effectsManager = this.findShaderEffectsManager();
  //   if (!effectsManager) {
  //     console.warn('No shader effects manager available');
  //     return false;
  //   }
    
  //   try {
  //     // Create effect container first to ensure proper positioning
  //     const container = new THREE.Group();
  //     container.position.copy(mesh.position);
  //     container.rotation.copy(mesh.rotation);
  //     this.scene.add(container);
      
  //     // Use specific creation method based on effect type
  //     let effectData = null;
      
  //     if (effectType === 'glow' && effectsManager.createPropGlowEffect) {
  //       effectData = effectsManager.createPropGlowEffect(mesh, {
  //         color: effect.parameters?.color || 0x66ccff,
  //         intensity: effect.parameters?.intensity || 1.0
  //       });
  //     }
  //     else if (effectType === 'fire' && effectsManager.createFireEffect) {
  //       effectData = effectsManager.createFireEffect(mesh, 'medium', {
  //         color: effect.parameters?.color || 0xff6600,
  //         intensity: effect.parameters?.intensity || 1.0
  //       });
  //     }
  //     else if (effectType === 'holy' && effectsManager.createHolyEffect) {
  //       effectData = effectsManager.createHolyEffect(mesh, {
  //         color: effect.parameters?.color || 0xffdd88,
  //         intensity: effect.parameters?.intensity || 1.0
  //       });
  //     }
  //     else if (effectType === 'portalEffect' && effectsManager.createPortalEffect) {
  //       effectData = effectsManager.createPortalEffect(mesh, {
  //         color: effect.parameters?.color || 0x8800ff,
  //         intensity: effect.parameters?.intensity || 1.0
  //       });
        
  //       // Special case for portal rings - ensure horizontal orientation
  //       if (mesh.name.toLowerCase().includes('portal')) {
  //         const isHorizontal = Math.abs(mesh.rotation.x - Math.PI/2) < 0.1;
          
  //         if (isHorizontal && effectData.portalRing) {
  //           console.log('Setting horizontal orientation for portal ring');
  //           effectData.portalRing.rotation.x = Math.PI/2;
            
  //           if (effectData.vortex) {
  //             effectData.vortex.rotation.x = Math.PI/2;
  //           }
  //         }
  //       }
  //     }
  //     else if (effectType === 'magic' && effectsManager.createMagicEffect) {
  //       effectData = effectsManager.createMagicEffect(mesh, 'medium', {
  //         color: effect.parameters?.color || 0x8800ff,
  //         intensity: effect.parameters?.intensity || 1.0
  //       });
  //     }
  //     // Fallback to generic apply method
  //     else if (effectsManager.applyEffect) {
  //       effectsManager.applyEffect(mesh, effectType);
        
  //       // Try to get the created effect data
  //       if (effectsManager.effects) {
  //         effectData = effectsManager.effects.get(mesh.id);
  //       }
  //     }
      
  //     // If effect was created and has parameters, apply them
  //     if (effectData && typeof effect === 'object' && effect.parameters) {
  //       this.applyEffectParameters(effectData, effect.parameters);
  //     }
      
  //     // Ensure effect elements are properly positioned
  //     if (effectData) {
  //       // Move effect elements to the container for proper positioning
  //       this.organizeEffectElements(effectData, container, mesh);
  //     }
      
  //     // Ensure effects are animated
  //     this.ensureAnimationSystem();
      
  //     return !!effectData;
  //   } catch (error) {
  //     console.error('Error creating effect:', error);
  //     return false;
  //   }
  // }

  /**
 * Apply a shader effect to a mesh
 * @param {THREE.Mesh} mesh - The mesh to apply the effect to
 * @param {string|Object} effect - The effect type or effect data
 * @returns {boolean} - Whether the effect was successfully applied
 */
applyShaderEffect(mesh, effect) {
  // Do nothing if mesh is invalid
  if (!mesh) return false;
  
  // Extract effect type
  const effectType = typeof effect === 'string' ? effect : (effect.type || null);
  if (!effectType) return false;
  
  console.log(`Applying ${effectType} effect to mesh: ${mesh.name || 'unnamed'}`);
  
  // Special handling for portal effects in rings
  if (effectType === 'portalEffect' && mesh.name.toLowerCase().includes('portal')) {
    console.log('Using special portal effect handler');
    return this.createPortalEffect(mesh, effect.parameters);
  }
  
  // Special handling for fire effects
  if (effectType === 'fire') {
    console.log('Using special fire effect handler');
    return this.createFireEffect(mesh, effect.parameters);
  }
  
  // Try using ShapeForge if available
  if (this.shapeForge) {
    console.log('Attempting to use ShapeForge for effect creation');
    
    try {
      // Update mesh world matrix
      mesh.updateMatrixWorld(true);
      
      // Check if ShapeForge has dedicated creation methods
      if (typeof this.shapeForge.createEffectFromType === 'function') {
        const parameters = typeof effect === 'object' ? effect.parameters : undefined;
        const effectData = this.shapeForge.createEffectFromType(effectType, mesh, parameters);
        
        if (effectData) {
          console.log('Effect created successfully with ShapeForge');
          return true;
        }
      }
    } catch (error) {
      console.error('Error using ShapeForge to create effect:', error);
    }
  }
  
  // Fall back to shader effects manager
  const effectsManager = this.findShaderEffectsManager();
  if (!effectsManager) {
    console.warn('No shader effects manager available');
    return false;
  }
  
  try {
    // Create effect with the manager
    let effectApplied = false;
    
    if (effectType === 'glow' && effectsManager.createPropGlowEffect) {
      effectsManager.createPropGlowEffect(mesh, {
        color: effect.parameters?.color || 0x66ccff,
        intensity: effect.parameters?.intensity || 1.0
      });
      effectApplied = true;
    }
    else if (effectType === 'holy' && effectsManager.createHolyEffect) {
      effectsManager.createHolyEffect(mesh, {
        color: effect.parameters?.color || 0xffdd88,
        intensity: effect.parameters?.intensity || 1.0
      });
      effectApplied = true;
    }
    else if (effectType === 'magic' && effectsManager.createMagicEffect) {
      effectsManager.createMagicEffect(mesh, 'medium', {
        color: effect.parameters?.color || 0x8800ff,
        intensity: effect.parameters?.intensity || 1.0
      });
      effectApplied = true;
    }
    // Generic method as last resort
    else if (effectsManager.applyEffect) {
      effectsManager.applyEffect(mesh, effectType);
      effectApplied = true;
    }
    
    // Ensure animation system is installed
    if (effectApplied) {
      this.ensureAnimationSystem();
    }
    
    return effectApplied;
  } catch (error) {
    console.error('Error creating effect:', error);
    return false;
  }
}

/**
 * Create a fire effect with proper positioning and particles
 * @param {THREE.Mesh} mesh - The mesh to apply effect to
 * @param {Object} parameters - Effect parameters
 * @returns {boolean} - Whether the effect was created successfully
 */
createFireEffect(mesh, parameters = {}) {
  if (!mesh) return false;
  
  // Log what we're working with
  console.log('Creating fire effect for:', mesh.name);
  console.log('Mesh position:', mesh.position);
  
  // Get world matrix
  mesh.updateMatrixWorld(true);
  const worldPosition = new THREE.Vector3();
  mesh.getWorldPosition(worldPosition);
  
  try {
    // Create a container for the fire effect
    const container = new THREE.Group();
    container.position.copy(worldPosition);
    this.scene.add(container);
    
    // Set default parameters
    const fireParams = {
      color: parameters?.color || 0xff6600,
      intensity: parameters?.intensity || 1.2,
      height: parameters?.height || 0.8,
      particleCount: parameters?.particleCount || 30
    };
    
    // Create light
    const light = new THREE.PointLight(
      fireParams.color,
      fireParams.intensity,
      parameters?.distance || 3
    );
    light.position.y = fireParams.height * 0.5; // Position above the base
    container.add(light);
    
    // Create particle system for flames
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(fireParams.particleCount * 3);
    const particleSizes = new Float32Array(fireParams.particleCount);
    
    // Initialize particles in a cone shape
    for (let i = 0; i < fireParams.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.3;
      const height = Math.random() * fireParams.height;
      
      const i3 = i * 3;
      particlePositions[i3] = Math.cos(angle) * radius * (1 - height/fireParams.height);
      particlePositions[i3 + 1] = height;
      particlePositions[i3 + 2] = Math.sin(angle) * radius * (1 - height/fireParams.height);
      
      // Vary particle sizes - larger at bottom, smaller at top
      particleSizes[i] = 0.08 + (0.12 * (1 - height/fireParams.height));
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create fire material with custom shaders for better flame effect
    const fireVertexShader = `
      attribute float size;
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / length(mvPosition.xyz));
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
    
    const fireFragmentShader = `
      uniform vec3 fireColor;
      varying vec3 vPosition;
      void main() {
        float intensity = smoothstep(0.0, 0.7, 1.0 - length(gl_PointCoord - vec2(0.5)));
        intensity *= smoothstep(0.0, 1.0, vPosition.y);
        gl_FragColor = vec4(fireColor, 1.0) * intensity;
      }
    `;
    
    const fireMaterial = new THREE.ShaderMaterial({
      uniforms: {
        fireColor: { value: new THREE.Color(fireParams.color) }
      },
      vertexShader: fireVertexShader,
      fragmentShader: fireFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // Fallback to simpler material if shader compilation fails
    let particles;
    try {
      particles = new THREE.Points(particleGeometry, fireMaterial);
    } catch (e) {
      console.warn("Shader compilation failed, using basic material:", e);
      const basicMaterial = new THREE.PointsMaterial({
        color: fireParams.color,
        size: 0.1,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.7
      });
      particles = new THREE.Points(particleGeometry, basicMaterial);
    }
    
    container.add(particles);
    
    // Create update function for animation
    const updateFire = function(deltaTime) {
      // Animate fire particles
      const positions = particles.geometry.attributes.position.array;
      
      for (let i = 0; i < fireParams.particleCount; i++) {
        const i3 = i * 3;
        
        // Move particles upward
        positions[i3 + 1] += deltaTime * (0.5 + Math.random() * 0.5);
        
        // Add some sideways motion
        positions[i3] += (Math.random() - 0.5) * 0.05;
        positions[i3 + 2] += (Math.random() - 0.5) * 0.05;
        
        // Reset particles when they go too high
        if (positions[i3 + 1] > fireParams.height) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.3;
          
          positions[i3] = Math.cos(angle) * radius;
          positions[i3 + 1] = 0;
          positions[i3 + 2] = Math.sin(angle) * radius;
        }
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Flickering light effect
      const flicker = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
      light.intensity = fireParams.intensity * flicker;
    };
    
    // Create effect data structure
    const effectData = {
      type: 'fire',
      container: container,
      light: light,
      particles: particles,
      update: updateFire,
      baseIntensity: fireParams.intensity,
      originalObject: mesh
    };
    
    // Store in mesh userData
    if (!mesh.userData) mesh.userData = {};
    mesh.userData.effectData = effectData;
    
    // Install animation system
    this.installFireAnimation(effectData);
    
    console.log('Fire effect created successfully!');
    return true;
  } catch (error) {
    console.error('Error creating fire effect:', error);
    return false;
  }
}

/**
 * Install fire animation into the loop
 */
installFireAnimation(effectData) {
  if (!effectData || !effectData.update) return;
  
  // Try to hook into Scene3D's animation loop
  if (window.scene3D && typeof window.scene3D.animate === 'function') {
    // Only install once
    if (window.scene3D._fireAnimationInstalled) {
      // Just add this effect to the existing system
      if (window.scene3D.addFireEffect) {
        window.scene3D.addFireEffect(effectData);
      }
      return;
    }
    
    const originalAnimate = window.scene3D.animate;
    const fireEffects = [effectData]; // Start with this effect
    
    window.scene3D.animate = function() {
      // Call original first
      originalAnimate.call(this);
      
      // Calculate delta time
      const now = performance.now();
      const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
      this.lastFrameTime = now;
      
      // Update all fire effects
      fireEffects.forEach(effect => {
        if (effect && effect.update) {
          effect.update(deltaTime);
        }
      });
    };
    
    // Allow adding more fire effects later
    window.scene3D.addFireEffect = function(effect) {
      if (effect && !fireEffects.includes(effect)) {
        fireEffects.push(effect);
      }
    };
    
    window.scene3D._fireAnimationInstalled = true;
    console.log('Fire animation system installed');
  }
}
  
  /**
   * Find an available shader effects manager
   */
  findShaderEffectsManager() {
    if (this.shaderEffects) {
      return this.shaderEffects;
    }
    
    if (window.shaderEffectsManager) {
      return window.shaderEffectsManager;
    }
    
    if (window.scene3D && window.scene3D.shaderEffects) {
      return window.scene3D.shaderEffects;
    }
    
    return null;
  }
  
  /**
   * Apply parameters to an effect
   */
  applyEffectParameters(effectData, parameters) {
    if (!effectData) return;
    
    // Apply common parameters
    if (parameters.intensity !== undefined && effectData.light) {
      effectData.light.intensity = parameters.intensity;
      effectData.baseIntensity = parameters.intensity; // Store for animation
    }
    
    if (parameters.color !== undefined) {
      // Apply to light
      if (effectData.light && effectData.light.color) {
        effectData.light.color.set(parameters.color);
      }
      
      // Apply to particles
      if (effectData.particles && 
          effectData.particles.material && 
          effectData.particles.material.color) {
        effectData.particles.material.color.set(parameters.color);
      }
    }
    
    // Other specific parameters
    if (parameters.distance !== undefined && effectData.light) {
      effectData.light.distance = parameters.distance;
    }
  }
  
  /**
   * Organize effect elements for proper positioning and parent-child relationships
   */
  organizeEffectElements(effectData, container, mesh) {
    if (!effectData || !container) return;
    
    // Get all the effect elements
    const elements = [];
    
    // Check for common effect elements
    if (effectData.light) elements.push(effectData.light);
    if (effectData.particles) elements.push(effectData.particles);
    if (effectData.portalRing) elements.push(effectData.portalRing);
    if (effectData.vortex) elements.push(effectData.vortex);
    
    // For each element, remove from current parent and add to container
    elements.forEach(element => {
      if (element && element !== mesh) {
        // Remove from current parent
        if (element.parent) {
          element.parent.remove(element);
        }
        
        // Get element's world position
        const worldPosition = new THREE.Vector3();
        if (element.getWorldPosition) {
          element.getWorldPosition(worldPosition);
        } else {
          worldPosition.copy(element.position);
        }
        
        // Add to container
        container.add(element);
        
        // Handle special positioning
        if (effectData.type === 'portalEffect') {
          // For portal effects, adjust position and orientation
          if (element === effectData.portalRing || element === effectData.vortex) {
            // Check if the mesh is oriented horizontally
            const isHorizontal = Math.abs(mesh.rotation.x - Math.PI/2) < 0.1;
            
            if (isHorizontal) {
              element.rotation.x = Math.PI/2; // Horizontal orientation
              element.position.y = 0; // Centered on the ring
            }
          }
        }
        else if (effectData.type === 'fire') {
          // For fire, position above the object
          element.position.y = 0.5;
        }
        else if (effectData.type === 'holy') {
          // For holy effects, position well above
          element.position.y = 1.0;
        }
      }
    });
    
    // Store the container in effectData for reference
    effectData.container = container;
    
    // Store effectData in mesh userData for reference
    if (!mesh.userData) mesh.userData = {};
    mesh.userData.effectData = effectData;
  }
  
  /**
   * Ensure animations are running for shader effects
   */
  ensureAnimationSystem() {
    const effectsManager = this.findShaderEffectsManager();
    if (!effectsManager) return;
    
    // Don't install twice
    if (effectsManager._animationSystemInstalled) return;
    
    // Hook into Scene3D's animation loop if available
    if (window.scene3D && typeof window.scene3D.animate === 'function') {
      const originalAnimate = window.scene3D.animate;
      
      window.scene3D.animate = function() {
        // Call original first
        originalAnimate.call(this);
        
        // Update shader effects
        if (effectsManager.update) {
          const deltaTime = this.deltaTime || 0.016;
          effectsManager.update(deltaTime);
        }
      };
    }
    
    // Enhance the update method if needed
    if (typeof effectsManager.update !== 'function') {
      // Create a basic update method
      effectsManager.update = function(deltaTime) {
        deltaTime = deltaTime || 0.016;
        
        // Process each effect for animation
        if (this.effects) {
          this.effects.forEach(effectData => {
            if (!effectData) return;
            
            // Call update method if exists
            if (effectData.update && typeof effectData.update === 'function') {
              effectData.update(deltaTime);
            }
            
            // Type-specific animations
            switch (effectData.type) {
              case 'fire':
              case 'lava':
              case 'flame':
                if (effectData.light) {
                  const flicker = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
                  effectData.light.intensity = (effectData.baseIntensity || 1.0) * flicker;
                }
                break;
                
              case 'portalEffect':
                if (effectData.portalRing) {
                  effectData.portalRing.rotation.z += deltaTime * 0.5;
                }
                if (effectData.vortex) {
                  effectData.vortex.rotation.z -= deltaTime * 0.3;
                }
                break;
                
              case 'holy':
              case 'glow':
                if (effectData.light) {
                  const pulse = Math.sin(Date.now() * 0.002) * 0.3 + 0.7;
                  effectData.light.intensity = (effectData.baseIntensity || 1.0) * pulse;
                }
                break;
            }
          });
        }
      };
    }
    
    // Mark as installed
    effectsManager._animationSystemInstalled = true;
  }

  /**
 * Apply a portal effect with correct orientation
 * @param {THREE.Mesh} mesh - The portal ring mesh
 * @param {Object} parameters - Effect parameters
 * @returns {boolean} - Whether the effect was created successfully
 */
createPortalEffect(mesh, parameters = {}) {
  if (!mesh) return false;
  
  // Log what we're working with
  console.log('Creating portal effect for:', mesh.name);
  console.log('Portal mesh rotation:', mesh.rotation);
  console.log('Portal mesh position:', mesh.position);
  
  // Get world matrix to determine true position/orientation in the scene
  mesh.updateMatrixWorld(true);
  const worldMatrix = mesh.matrixWorld.clone();
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
  
  // Get shader effects manager
  const effectsManager = this.findShaderEffectsManager();
  if (!effectsManager) {
    console.error('No shader effects manager available');
    return false;
  }
  
  try {
    // Create effect directly in the scene with world position
    // Don't pass the mesh itself as some implementations use it incorrectly
    let effectData = null;
    
    // Create a special container for portal effect
    const container = new THREE.Group();
    this.scene.add(container);
    
    // Position container at mesh's world position
    container.position.copy(worldPosition);
    
    // Apply rotation - handle both quaternion and euler representations
    if (worldQuaternion) {
      container.quaternion.copy(worldQuaternion);
    } else {
      container.rotation.copy(mesh.rotation);
    }
    
    // Set default parameters for portal
    const portalParams = {
      color: parameters?.color || 0x8800ff,
      intensity: parameters?.intensity || 1.5,
      distance: parameters?.distance || 2,
      scale: worldScale.x * 1.05 // Slightly larger than the ring
    };
    
    // Create portal ring - directly positionable
    const portalRingGeometry = new THREE.TorusGeometry(
      0.7 * portalParams.scale, 
      0.1 * portalParams.scale, 
      16, 
      32
    );
    const portalRingMaterial = new THREE.MeshBasicMaterial({
      color: portalParams.color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const portalRing = new THREE.Mesh(portalRingGeometry, portalRingMaterial);
    container.add(portalRing);
    
    // Create vortex - slightly smaller to fit inside ring
    const vortexGeometry = new THREE.CircleGeometry(
      0.6 * portalParams.scale, 
      32
    );
    const vortexMaterial = new THREE.MeshBasicMaterial({
      color: portalParams.color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
    container.add(vortex);
    
    // Create light 
    const light = new THREE.PointLight(
      portalParams.color, 
      portalParams.intensity, 
      portalParams.distance
    );
    
    // Position light slightly in front of the portal
    light.position.set(0, 0, 0.1);
    container.add(light);
    
    // Create particle system for sparkles
    const particleCount = 20;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    // Create particles in a ring formation
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.7 * portalParams.scale;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = (Math.random() - 0.5) * 0.2; // Slight z-variation
      
      const i3 = i * 3;
      particlePositions[i3] = x;
      particlePositions[i3 + 1] = y;
      particlePositions[i3 + 2] = z;
    }
    
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: portalParams.color,
      size: 0.05,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    container.add(particles);
    
    // Create animation update function
    let time = 0;
    const updatePortal = function(deltaTime) {
      time += deltaTime;
      
      // Rotate the vortex
      vortex.rotation.z += deltaTime * 0.5;
      
      // Pulse the light
      const pulse = Math.sin(time * 2) * 0.3 + 0.7;
      light.intensity = portalParams.intensity * pulse;
      
      // Animate particles
      const positions = particles.geometry.attributes.position.array;
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.7 * portalParams.scale;
        
        // Orbit around the ring with some variation
        const orbitSpeed = 0.3;
        const posX = Math.cos(angle + time * orbitSpeed) * radius;
        const posY = Math.sin(angle + time * orbitSpeed) * radius;
        
        positions[i3] = posX;
        positions[i3 + 1] = posY;
        positions[i3 + 2] = Math.sin(time * 2 + i) * 0.05; // Slight z wobble
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    };
    
    // Setup effect data similar to what shaderEffectsManager would create
    effectData = {
      type: 'portalEffect',
      container: container,
      portalRing: portalRing,
      vortex: vortex,
      light: light,
      particles: particles,
      update: updatePortal,
      baseIntensity: portalParams.intensity,
      originalObject: mesh
    };
    
    // Store in mesh userData
    if (!mesh.userData) mesh.userData = {};
    mesh.userData.effectData = effectData;
    
    // Hook into animation system
    this.installPortalAnimation(effectData);
    
    console.log('Portal effect created successfully!');
    return true;
  } catch (error) {
    console.error('Error creating portal effect:', error);
    return false;
  }
}

/**
 * Install portal animation into the loop
 */
installPortalAnimation(effectData) {
  if (!effectData || !effectData.update) return;
  
  // Try to hook into Scene3D's animation loop
  if (window.scene3D && typeof window.scene3D.animate === 'function') {
    // Only install once
    if (window.scene3D._portalAnimationInstalled) return;
    
    const originalAnimate = window.scene3D.animate;
    const portalEffects = [effectData]; // Start with this effect
    
    window.scene3D.animate = function() {
      // Call original first
      originalAnimate.call(this);
      
      // Calculate delta time
      const now = performance.now();
      const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
      this.lastFrameTime = now;
      
      // Update all portal effects
      portalEffects.forEach(effect => {
        if (effect && effect.update) {
          effect.update(deltaTime);
        }
      });
    };
    
    // Allow adding more portal effects later
    window.scene3D.addPortalEffect = function(effect) {
      if (effect && !portalEffects.includes(effect)) {
        portalEffects.push(effect);
      }
    };
    
    window.scene3D._portalAnimationInstalled = true;
    console.log('Portal animation system installed');
  }
}



}