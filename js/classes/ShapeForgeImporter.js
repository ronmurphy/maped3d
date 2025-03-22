class ShapeForgeImporter {
  constructor(scene, resourceManager, effectsManager = null) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.modelsCache = new Map(); // Optional cache for already loaded models
    
    // Safely assign the shader effects manager
    this.shaderEffects = effectsManager;
    
    // Log initialization state for debugging
    console.log('ShapeForgeImporter initialized with:', {
      hasScene: !!scene,
      hasResourceManager: !!resourceManager,
      hasEffectsManager: !!effectsManager
    });
    
    // Make this instance globally available for cross-reference
    if (!window.shapeForgeImporter) {
      window.shapeForgeImporter = this;
    }
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
            
            // We don't need to do anything with the image,
            // just load it into browser cache
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
 * Process shader effects on objects ---  new
 * @param {Array} objects - Array of model objects with potential effects
 */
processEffects(objects) {
  if (!this.shaderEffectsManager && !window.shaderEffectsManager) {
    console.warn("ShaderEffectsManager not available, skipping effects");
    return;
  }
  
  // Get the correct shader effects manager instance
  const manager = this.shaderEffectsManager || window.shaderEffectsManager;
  
  console.log(`Processing ${objects.length} objects with effects using manager:`, manager);
  
  objects.forEach(({mesh, effect}) => {
    try {
      const effectType = typeof effect === 'string' ? effect : effect.type;
      
      console.log(`Applying ${effectType} effect to mesh`);
      
      // Apply effect using ShaderEffectsManager
      const success = manager.applyEffect(mesh, effectType);
      
      if (success) {
        console.log(`Successfully applied ${effectType} effect`);
        
        // Apply parameters if available
        if (typeof effect === 'object' && effect.parameters) {
          const effectData = manager.effects.get(mesh.id);
          if (effectData && effectData.light) {
            // Apply intensity
            if (effect.parameters.intensity !== undefined) {
              effectData.light.intensity = effect.parameters.intensity;
            }
            
            // Apply color
            if (effect.parameters.color !== undefined) {
              effectData.light.color.set(effect.parameters.color);
            }
          }
        }
      } else {
        console.warn(`Failed to apply ${effectType} effect`);
      }
    } catch (error) {
      console.error("Error applying effect:", error);
    }
  });
}
  
  /**
   * Create a Three.js mesh from a ShapeForge object
   */
/**
 * Create a Three.js mesh from a ShapeForge object
 */
createMeshFromObject(objData) {

  if (!objData.type) {
    console.warn("Object missing shape property:", objData);
    
    // Create a default cube as fallback
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply position, rotation, scale if available
    if (objData.position) {
      mesh.position.set(
        objData.position.x || 0,
        objData.position.y || 0,
        objData.position.z || 0
      );
    }
    
    return mesh;
  }
  
  // Create geometry based on type
  let geometry;
  
  switch(objData.type) {
    case 'cube':
      geometry = new THREE.BoxGeometry(
        objData.parameters.width, 
        objData.parameters.height, 
        objData.parameters.depth
      );
      break;
        
    case 'sphere':
      geometry = new THREE.SphereGeometry(
        objData.parameters.radius,
        objData.parameters.widthSegments,
        objData.parameters.heightSegments
      );
      break;
        
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        objData.parameters.radiusTop,
        objData.parameters.radiusBottom,
        objData.parameters.height,
        objData.parameters.radialSegments
      );
      break;
        
    case 'cone':
      geometry = new THREE.ConeGeometry(
        objData.parameters.radius,
        objData.parameters.height,
        objData.parameters.radialSegments
      );
      break;
        
    case 'torus':
      geometry = new THREE.TorusGeometry(
        objData.parameters.radius,
        objData.parameters.tube,
        objData.parameters.radialSegments,
        objData.parameters.tubularSegments
      );
      break;
      
    case 'plane':
      geometry = new THREE.PlaneGeometry(
        objData.parameters.width,
        objData.parameters.height,
        objData.parameters.widthSegments,
        objData.parameters.heightSegments
      );
      break;
        
    case 'tetrahedron':
      geometry = new THREE.TetrahedronGeometry(
        objData.parameters.radius,
        objData.parameters.detail
      );
      break;
        
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(
        objData.parameters.radius,
        objData.parameters.detail
      );
      break;
        
    case 'dodecahedron':
      geometry = new THREE.DodecahedronGeometry(
        objData.parameters.radius,
        objData.parameters.detail
      );
      break;
        
    case 'icosahedron':
      geometry = new THREE.IcosahedronGeometry(
        objData.parameters.radius,
        objData.parameters.detail
      );
      break;
      
    case 'd10':
      // For D10, we need the special code from ShapeForge.createD10
      geometry = this.createD10Geometry(objData.parameters);
      break;
      
    case 'merged':
      // For merged geometry, we need to handle it specially
      if (objData.geometryData) {
        geometry = this.createMergedGeometry(objData.geometryData);
      } else {
        geometry = new THREE.BoxGeometry(1, 1, 1); // Fallback
      }
      break;
      
    default:
      console.warn(`Unsupported shape type: ${objData.type}`);
      geometry = new THREE.BoxGeometry(1, 1, 1); // Fallback
  }
  
  // Create material
  const material = this.createMaterialFromObject(objData);
  
  // Create mesh and set transformation
  const mesh = new THREE.Mesh(geometry, material);
  
  // Apply position, rotation, scale
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
  
  // Name the mesh
  if (objData.name) {
    mesh.name = objData.name;
  }
  
  return mesh;
}

/**
 * Create a D10 geometry based on ShapeForge's method
 */
createD10Geometry(parameters) {
  const sides = parameters.sides || 10;
  const radius = parameters.radius || 0.5;
  
  // Define the vertices for a pentagonal trapezohedron (D10)
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
 * Create a geometry from merged data
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
 * Apply shader effects to meshes
 */
applyShaderEffects(meshes) {
  // Only proceed if ShaderEffectsManager is available
  if (!window.shaderEffectsManager) {
    console.warn("ShaderEffectsManager not available, skipping effects");
    return;
  }
  
  // Log available effect types for debugging
  if (window.shaderEffectsManager.effectDefinitions) {
    console.log("Available effect types:", 
      Array.from(window.shaderEffectsManager.effectDefinitions.keys()));
  }
  
  meshes.forEach(({mesh, objData}) => {
    if (!objData.effect) return;
    
    try {
      // Determine effect type from the object data
      let effectType;
      if (typeof objData.effect === 'string') {
        effectType = objData.effect;
      } else if (objData.effect.type) {
        effectType = objData.effect.type;
      } else {
        console.warn(`Invalid effect data for ${objData.name}:`, objData.effect);
        return;
      }
      
      console.log(`Applying ${effectType} effect to ${objData.name}`);
      
      // Set userData to help ShaderEffectsManager
      if (!mesh.userData) mesh.userData = {};
      
      // Set name for debugging
      mesh.userData.name = objData.name;
      
      // Apply effect keywords if needed
      if (effectType === 'fire') {
        mesh.userData.name += " fire"; // Add keyword to trigger detection
      } else if (effectType === 'magic') {
        mesh.userData.name += " magic";
      } else if (effectType === 'lava') {
        mesh.userData.name += " lava";
      } else if (effectType === 'holy') {
        mesh.userData.name += " holy";
      } else if (effectType === 'waterProp') {
        mesh.userData.isWaterProp = true; // Special flag for water
      }
      
      // Use the actual applyEffect method from ShaderEffectsManager
      const success = window.shaderEffectsManager.applyEffect(mesh, effectType);
      
      if (success) {
        console.log(`Successfully applied ${effectType} effect to ${objData.name}`);
        
        // Apply additional parameters if available
        if (typeof objData.effect === 'object' && objData.effect.parameters) {
          const effectData = window.shaderEffectsManager.effects.get(mesh.id);
          if (effectData) {
            // Apply intensity if specified
            if (objData.effect.parameters.intensity !== undefined && effectData.light) {
              effectData.light.intensity = objData.effect.parameters.intensity;
            }
            
            // Apply color if specified
            if (objData.effect.parameters.color !== undefined && effectData.light) {
              effectData.light.color.set(objData.effect.parameters.color);
            }
          }
        }
      } else {
        console.warn(`Failed to apply ${effectType} effect to ${objData.name}`);
      }
    } catch (error) {
      console.error(`Error applying effect to ${objData.name}:`, error);
    }
  });
}



  /**
 * Create a Three.js material from a ShapeForge object
 */
createMaterialFromObject(objData) {
  // Default material properties
  const materialProps = {
    color: new THREE.Color(0xffffff), // Default to white for textures
    roughness: objData.material?.roughness !== undefined ? objData.material.roughness : 0.5,
    metalness: objData.material?.metalness !== undefined ? objData.material.metalness : 0.2
  };
  
  // Set color if specified and no texture
  if (objData.material?.color && !objData.material?.texture) {
    materialProps.color = new THREE.Color(objData.material.color);
  }
  
  // Handle transparency
  if (objData.material?.transparent) {
    materialProps.transparent = true;
    materialProps.opacity = objData.material.opacity !== undefined ? objData.material.opacity : 0.8;
  }
  
  // Handle wireframe
  if (objData.material?.wireframe) {
    materialProps.wireframe = true;
  }
  
  // Handle emissive
  if (objData.material?.emissive) {
    materialProps.emissive = new THREE.Color(objData.material.emissive);
    
    if (objData.material.emissiveIntensity !== undefined) {
      materialProps.emissiveIntensity = objData.material.emissiveIntensity;
    }
  }
  
  // Create the material
  const material = new THREE.MeshStandardMaterial(materialProps);
  
  // Handle texture if present
  if (objData.material?.texture) {
    this.applyTextureToMaterial(material, objData.material.texture);
  }
  
  return material;
}

/**
 * Apply texture to a material
 */
applyTextureToMaterial(material, textureData) {
  if (!textureData || !textureData.data) return;
  
  // Create a texture loader
  const loader = new THREE.TextureLoader();
  
  // Load the texture (we need to work with the promise)
  loader.loadAsync(textureData.data)
    .then(texture => {
      // Configure texture parameters
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
      material.map = texture;
      material.needsUpdate = true;
      
      console.log("Applied texture to material");
    })
    .catch(error => {
      console.error("Error loading texture:", error);
    });
}



/**
 * Convert ShapeForge model data into a Three.js Group with effects
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
  
  // Keep a reference to 'this' for callbacks
  const self = this; 
  
  // Track meshes and objects with effects
  const meshes = [];
  const objectsWithEffects = [];
  
  // Process each object in the model
  modelData.data.objects.forEach(obj => {
    try {
      // Skip null or undefined objects
      if (!obj) return;
      
      // Create mesh from object data
      const mesh = this.createMeshFromObject(obj);
      if (!mesh) return;
      
      // Store mesh and object data
      meshes.push({mesh, objData: obj});
      
      // Track effects for later application if present
      if (obj.effect) {
        objectsWithEffects.push({
          mesh: mesh, 
          effect: obj.effect
        });
      }
      
      // Add to the group
      group.add(mesh);
      
    } catch (e) {
      console.warn(`Error creating object ${obj?.name || 'unnamed'}:`, e);
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
  
  // Apply effects after a delay to ensure everything is initialized
  if (objectsWithEffects.length > 0) {
    console.log(`Will apply ${objectsWithEffects.length} effects after delay`);
    
    // First try immediate application
    objectsWithEffects.forEach(({mesh, effect}) => {
      self.applyShaderEffect(mesh, effect);
    });
    
    // Also use a short delay for safety
    setTimeout(() => {
      objectsWithEffects.forEach(({mesh, effect}) => {
        self.applyShaderEffect(mesh, effect);
      });
    }, 50);
    
    // Try a longer delay as well
    setTimeout(() => {
      objectsWithEffects.forEach(({mesh, effect}) => {
        self.applyShaderEffect(mesh, effect);
      });
    }, 500);
  }
  
  return group;
}

/**
 * Helper method to apply shader effects to a list of objects
 * @param {Array} objectsWithEffects - Array of {mesh, effect} objects
 */
applyShaderEffectsToObjects(objectsWithEffects) {
  if (!objectsWithEffects || objectsWithEffects.length === 0) return;
  
  console.log(`Attempting to apply ${objectsWithEffects.length} shader effects`);
  
  // Check for global shader effects manager
  const hasGlobalManager = window.shaderEffectsManager && 
                          typeof window.shaderEffectsManager.applyEffect === 'function';
  
  // Check for instance shader effects
  const hasInstanceManager = this.shaderEffects && 
                           typeof this.shaderEffects.applyEffect === 'function';
  
  console.log('Shader managers available:', {
    global: hasGlobalManager, 
    instance: hasInstanceManager
  });
  
  if (!hasGlobalManager && !hasInstanceManager) {
    console.warn('No shader effects manager available to apply effects');
    
    // As a fallback, try to get the shader effects from Scene3DController
    if (window.scene3D && window.scene3D.shaderEffects) {
      console.log('Found shader effects manager on window.scene3D');
      this.shaderEffects = window.scene3D.shaderEffects;
    }
  }
  
  objectsWithEffects.forEach(({mesh, effect}) => {
    try {
      const effectType = typeof effect === 'string' ? effect : effect.type;
      
      console.log(`Applying ${effectType} effect to mesh:`, mesh.name || 'unnamed');
      
      let effectApplied = false;
      
      // First try window.shaderEffectsManager (global)
      if (hasGlobalManager) {
        console.log('Using global shader manager');
        window.shaderEffectsManager.applyEffect(mesh, effectType);
        
        // Apply parameters if available
        if (typeof effect === 'object' && effect.parameters) {
          const effectData = window.shaderEffectsManager.effects.get(mesh.id);
          if (effectData && effectData.light) {
            // Apply intensity
            if (effect.parameters.intensity !== undefined) {
              effectData.light.intensity = effect.parameters.intensity;
            }
            
            // Apply color
            if (effect.parameters.color !== undefined) {
              effectData.light.color.set(effect.parameters.color);
            }
          }
        }
        
        effectApplied = true;
      }
      // Then try this.shaderEffects (instance)
      else if (hasInstanceManager) {
        console.log('Using instance shader manager');
        this.shaderEffects.applyEffect(mesh, effectType);
        
        // Apply parameters if available
        if (typeof effect === 'object' && effect.parameters) {
          this.applyEffectParameters(mesh, effect.parameters);
        }
        
        effectApplied = true;
      }
      // Try scene3D fallback if we found it
      else if (window.scene3D && window.scene3D.shaderEffects) {
        console.log('Using scene3D shader manager fallback');
        window.scene3D.shaderEffects.applyEffect(mesh, effectType);
        effectApplied = true;
      }
      
      // Log success or failure
      if (effectApplied) {
        console.log(`Successfully applied ${effectType} effect to mesh`);
        
        // Add a small visual indicator to confirm effect was applied
        mesh.userData.hasShaderEffect = true;
      } else {
        console.warn(`No suitable shader manager found to apply ${effectType} effect`);
      }
      
    } catch (error) {
      console.error("Error applying effect:", error);
    }
  });
}


/**
 * Apply a shader effect to a mesh
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
  
//   console.log(`[ShapeForgeImporter] Applying ${effectType} effect to mesh:`, mesh.name || 'unnamed');
  
//   // Try different ways to apply the effect
//   let effectApplied = false;
  
//   // 1. Try using our instance shader effects manager
//   if (this.shaderEffects && typeof this.shaderEffects.applyEffect === 'function') {
//     try {
//       console.log('Using instance shader effects manager');
//       this.shaderEffects.applyEffect(mesh, effectType);
//       effectApplied = true;
//     } catch (error) {
//       console.error('Error using instance shader effects manager:', error);
//     }
//   }
  
//   // 2. Try using global shader effects manager
//   if (!effectApplied && window.shaderEffectsManager && 
//       typeof window.shaderEffectsManager.applyEffect === 'function') {
//     try {
//       console.log('Using global shader effects manager');
//       window.shaderEffectsManager.applyEffect(mesh, effectType);
//       effectApplied = true;
//     } catch (error) {
//       console.error('Error using global shader effects manager:', error);
//     }
//   }
  
//   // 3. Try using Scene3D's shader effects manager
//   if (!effectApplied && window.scene3D && window.scene3D.shaderEffects &&
//       typeof window.scene3D.shaderEffects.applyEffect === 'function') {
//     try {
//       console.log('Using scene3D shader effects manager');
//       window.scene3D.shaderEffects.applyEffect(mesh, effectType);
//       effectApplied = true;
//     } catch (error) {
//       console.error('Error using scene3D shader effects manager:', error);
//     }
//   }
  
//   // Apply effect parameters if effect was applied and parameters exist
//   if (effectApplied && typeof effect === 'object' && effect.parameters) {
//     this.applyEffectParameters(mesh, effect.parameters);
//   }
  
//   return effectApplied;
// }

/**
 * Apply a shader effect to a mesh based on ShapeForge's implementation
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
  
  // Find the appropriate shader effects manager
  const effectsManager = this.findShaderEffectsManager();
  if (!effectsManager) {
    console.warn('No shader effects manager available');
    return false;
  }
  
  try {
    // CRITICAL: Get the world matrix and position before applying effect
    // This ensures we capture the correct position/rotation
    mesh.updateMatrixWorld(true);
    const worldMatrix = mesh.matrixWorld.clone();
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
    
    console.log('Mesh world position before effect:', worldPosition);
    console.log('Mesh rotation:', mesh.rotation);
    
    // Use the exact approach from ShapeForge (createPropGlowEffect, etc.)
    let effectData = null;
    
    // Call effect creation method based on type
    if (effectType === 'glow' && effectsManager.createPropGlowEffect) {
      console.log('Creating glow effect');
      effectData = effectsManager.createPropGlowEffect(mesh, {
        color: effect.parameters?.color || 0x66ccff,
        intensity: effect.parameters?.intensity || 1.0,
        particleCount: effect.parameters?.particleCount || 15
      });
    }
    else if (effectType === 'fire' && effectsManager.createFireEffect) {
      console.log('Creating fire effect');
      effectData = effectsManager.createFireEffect(mesh, 'medium', {
        color: effect.parameters?.color || 0xff6600,
        intensity: effect.parameters?.intensity || 1.0
      });
    }
    else if (effectType === 'holy' && effectsManager.createHolyEffect) {
      console.log('Creating holy effect');
      effectData = effectsManager.createHolyEffect(mesh, {
        color: effect.parameters?.color || 0xffdd88,
        intensity: effect.parameters?.intensity || 1.0
      });
    }
    else if (effectType === 'portalEffect' && effectsManager.createPortalEffect) {
      console.log('Creating portal effect');
      effectData = effectsManager.createPortalEffect(mesh, {
        color: effect.parameters?.color || 0x8800ff,
        intensity: effect.parameters?.intensity || 1.0
      });
      
      // From ShapeForge: Special handling for portal rings
      if (mesh.name.toLowerCase().includes('portal') && mesh.rotation.x > 1.0) {
        console.log('Applying horizontal orientation for portal ring');
        if (effectData.portalRing) {
          effectData.portalRing.rotation.x = Math.PI / 2; // 90 degrees
        }
        if (effectData.vortex) {
          effectData.vortex.rotation.x = Math.PI / 2; // 90 degrees
        }
      }
    }
    else if (effectType === 'magic' && effectsManager.createMagicEffect) {
      console.log('Creating magic effect');
      effectData = effectsManager.createMagicEffect(mesh, 'medium', {
        color: effect.parameters?.color || 0x8800ff,
        intensity: effect.parameters?.intensity || 1.0
      });
    }
    // Fallback to generic apply method
    else if (effectsManager.applyEffect) {
      console.log('Using generic applyEffect method');
      effectsManager.applyEffect(mesh, effectType);
      
      // Get the effect data that was created
      if (effectsManager.effects && effectsManager.effects.get) {
        effectData = effectsManager.effects.get(mesh.id);
      }
    }
    
    // If effect was created successfully
    if (effectData) {
      console.log('Effect created successfully:', effectData);
      
      // From ShapeForge.js: Apply special custom container
      if (!effectData.container) {
        effectData.container = new THREE.Group();
        this.scene.add(effectData.container);
      }
      
      // Apply the world position and rotation from the mesh
      effectData.container.position.copy(worldPosition);
      effectData.container.quaternion.copy(worldQuaternion);
      
      // From ShapeForge.js: Apply any parameters to the effect
      if (typeof effect === 'object' && effect.parameters) {
        this.applyEffectParameters(mesh, effectData, effect.parameters);
      }
      
      // Store effect data for later tracking
      if (!mesh.userData) mesh.userData = {};
      mesh.userData.effectData = effectData;
      
      // Install animation updater to ensure effects continue to be animated
      this.installAnimationUpdater();
      
      return true;
    }
    
    console.warn('Failed to create effect:', effectType);
    return false;
  } catch (error) {
    console.error('Error creating effect:', error);
    return false;
  }
}

/**
 * Find an available shader effects manager
 * @returns {Object|null} - The shader effects manager or null if not found
 */
findShaderEffectsManager() {
  // Try all possible locations
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
 * Install animation system to ensure effects are animated
 * @param {Object} effectsManager - The shader effects manager
 */
installAnimationSystem(effectsManager) {
  if (!effectsManager) return false;
  
  // Don't install twice
  if (effectsManager._animationSystemInstalled) return true;
  
  console.log('Installing animation system in shader effects manager');
  
  // Make sure the update method is properly hooked into Scene3DController.animate
  this.hookAnimationIntoScene3D();
  
  // Ensure effect updater gets called in main loop
  this.installEffectPositionUpdater();
  
  // Store original update method
  const originalUpdate = effectsManager.update;
  const self = this;
  
  // Replace with our enhanced version that ensures animations work
  effectsManager.update = function(deltaTime) {
    // Safety in case no deltaTime provided
    deltaTime = deltaTime || 0.016;
    
    // Call original update method
    if (originalUpdate && typeof originalUpdate === 'function') {
      originalUpdate.call(this, deltaTime);
    }
    
    // Process each effect for animation and positioning
    if (this.effects && this.effects.size > 0) {
      this.effects.forEach((effectData, meshId) => {
        if (!effectData) return;
        
        // Get the mesh by id
        let mesh = null;
        if (self.scene) {
          mesh = self.scene.getObjectById(meshId);
        }
        
        if (!mesh) return;
        
        // First ensure proper rotation if we have stored it
        if (effectData.meshRotation) {
          // Keep mesh rotation correct
          mesh.rotation.copy(effectData.meshRotation);
          
          // Special case for portal effects
          if (effectData.type === 'portalEffect') {
            if (effectData.portalRing) {
              effectData.portalRing.rotation.x = Math.PI / 2; // Keep horizontal
            }
            
            if (effectData.vortex) {
              effectData.vortex.rotation.x = Math.PI / 2; // Keep horizontal
            }
          }
        }
        
        // Animate specific effect types
        switch (effectData.type) {
          case 'fire':
          case 'flame':
            // Animate fire particles
            if (effectData.particles && effectData.particles.material) {
              // Random flicker for emissive intensity
              if (effectData.light) {
                const flicker = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
                effectData.light.intensity = (effectData.baseIntensity || 1.0) * flicker;
              }
              
              // Animate particles if they have a local animate method
              if (effectData.particles.animate && typeof effectData.particles.animate === 'function') {
                effectData.particles.animate(deltaTime);
              }
            }
            break;
            
          case 'portalEffect':
            // Animate portal
            if (effectData.portalRing) {
              // Rotate portal ring for swirling effect
              effectData.portalRing.rotation.z += deltaTime * 0.5;
            }
            
            if (effectData.vortex) {
              // Counter-rotate vortex for dramatic effect
              effectData.vortex.rotation.z -= deltaTime * 0.3;
            }
            
            // Pulse light
            if (effectData.light) {
              const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
              effectData.light.intensity = (effectData.baseIntensity || 1.5) * pulse;
            }
            break;
            
          case 'holy':
            // Animate holy effect
            if (effectData.light) {
              const pulse = Math.sin(Date.now() * 0.002) * 0.3 + 0.7;
              effectData.light.intensity = (effectData.baseIntensity || 1.0) * pulse;
            }
            
            // Animate particles
            if (effectData.particles && effectData.particles.material) {
              // Subtle color shifts for heavenly effect
              const hue = (Date.now() * 0.0001) % 1;
              const color = new THREE.Color().setHSL(hue, 0.5, 0.7);
              
              if (effectData.particles.material.color) {
                effectData.particles.material.color.lerp(color, deltaTime * 0.5);
              }
            }
            break;
        }
        
        // Call any custom animation handlers
        if (effectData.animationData) {
          // First try update method directly on animationData
          if (effectData.animationData.update && 
              typeof effectData.animationData.update === 'function') {
            effectData.animationData.update(deltaTime);
          }
          
          // Then try effect-specific custom updates
          self.updateSpecialEffectPositions(effectData.type, effectData, mesh);
        }
      });
    }
  };
  
  // Mark as installed to prevent multiple installations
  effectsManager._animationSystemInstalled = true;
  
  // Store base intensity for each effect for animation reference
  if (effectsManager.effects) {
    effectsManager.effects.forEach(effectData => {
      if (effectData.light) {
        effectData.baseIntensity = effectData.light.intensity;
      }
    });
  }
  
  return true;
}

/**
 * Install the animation updater to ensure effects are animated
 */
installAnimationUpdater() {
  // Find the effects manager
  const effectsManager = this.findShaderEffectsManager();
  if (!effectsManager) return false;
  
  // Don't install twice
  if (effectsManager._animationUpdaterInstalled) return true;
  
  // Hook into Scene3D's animation loop if available
  if (window.scene3D && typeof window.scene3D.animate === 'function') {
    const originalAnimate = window.scene3D.animate;
    
    window.scene3D.animate = function() {
      // Call original first
      originalAnimate.call(this);
      
      // Call shader effects update if available
      if (effectsManager.update) {
        const now = performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
        this.lastFrameTime = now;
        
        effectsManager.update(deltaTime);
      }
    };
    
    console.log('Installed animation updater in Scene3D.animate');
  }
  
  // Enhance the update method to ensure animations work
  if (typeof effectsManager.update === 'function') {
    const originalUpdate = effectsManager.update;
    
    effectsManager.update = function(deltaTime) {
      // Default deltaTime if not provided
      deltaTime = deltaTime || 0.016;
      
      // Call original update
      originalUpdate.call(this, deltaTime);
      
      // Process each effect for animation
      if (this.effects && this.effects.size > 0) {
        this.effects.forEach((effectData, meshId) => {
          if (!effectData) return;
          
          // From ShapeForge.js: Call custom update method if available
          if (effectData.update && typeof effectData.update === 'function') {
            effectData.update(deltaTime);
          }
          
          // Animate specific effect types based on ShapeForge.js
          switch (effectData.type) {
            case 'fire':
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
    
    console.log('Enhanced shader effects update method with animations');
  }
  
  // Mark as installed
  effectsManager._animationUpdaterInstalled = true;
  
  return true;
}

/**
 * Hook our animation system into Scene3DController.animate
 */
hookAnimationIntoScene3D() {
  // Only try if we have scene3D
  if (!window.scene3D) return false;
  
  // Don't hook twice
  if (window.scene3D._shaderAnimationHooked) return true;
  
  // Check if we have an animate method to hook into
  if (typeof window.scene3D.animate !== 'function') return false;
  
  console.log('Hooking shader animations into Scene3DController.animate');
  
  // Store original animate method
  const originalAnimate = window.scene3D.animate;
  
  // Replace with our enhanced version
  window.scene3D.animate = function() {
    // Call original animate first
    originalAnimate.call(this);
    
    // Ensure shader effect updates are called
    if (this.shaderEffects && typeof this.shaderEffects.update === 'function') {
      // Calculate delta time if possible
      let deltaTime = 0.016; // Default ~60fps
      
      if (this.deltaTime) {
        deltaTime = this.deltaTime; // Use scene3D's delta time if available
      } else if (this.lastFrameTime) {
        const now = performance.now();
        deltaTime = (now - this.lastFrameTime) / 1000;
      }
      
      // Call shader effects update with delta time
      this.shaderEffects.update(deltaTime);
    }
  };
  
  // Mark as hooked
  window.scene3D._shaderAnimationHooked = true;
  
  return true;
}

/**
 * Ensure effect is correctly positioned while preserving rotation
 * @param {THREE.Mesh} mesh - The mesh the effect is applied to
 * @param {Object} effectsManager - The manager that applied the effect
 * @param {string} effectType - The type of effect applied
 */
ensureEffectPosition(mesh, effectsManager, effectType) {
  // Verify we have what we need
  if (!mesh || !effectsManager) return;
  
  // Wait a frame to ensure effect is created
  setTimeout(() => {
    try {
      // Get the effect data attached to this mesh
      let effectData = null;
      
      if (effectsManager.effects && effectsManager.effects.get) {
        effectData = effectsManager.effects.get(mesh.id);
      }
      
      if (!effectData) {
        console.warn('No effect data found for mesh:', mesh.id);
        return;
      }
      
      console.log('Found effect data:', effectData);
      
      // Store the mesh's rotation for reference
      effectData.meshRotation = mesh.rotation.clone();
      
      // Store base intensity for animation
      if (effectData.light) {
        effectData.baseIntensity = effectData.light.intensity;
      }
      
      // Get effect elements that need positioning
      const elementsToPosition = [];
      
      // Get light if it exists
      if (effectData.light && effectData.light !== mesh) {
        elementsToPosition.push(effectData.light);
      }
      
      // Get particles if they exist
      if (effectData.particles && effectData.particles !== mesh) {
        elementsToPosition.push(effectData.particles);
      }
      
      // Get portalRing if it exists
      if (effectData.portalRing && effectData.portalRing !== mesh) {
        elementsToPosition.push(effectData.portalRing);
      }
      
      // Get vortex if it exists
      if (effectData.vortex && effectData.vortex !== mesh) {
        elementsToPosition.push(effectData.vortex);
      }
      
      // Get container if it exists
      if (effectData.container && 
          effectData.container !== mesh && 
          !elementsToPosition.includes(effectData.container)) {
        elementsToPosition.push(effectData.container);
      }
      
      // Fix positioning by making elements follow the mesh
      elementsToPosition.forEach(element => {
        if (!element) return;
        
        // CRITICAL CHECK: Make sure we're not trying to add an object to itself
        if (element === mesh || element.uuid === mesh.uuid) {
          console.warn('Skipping attempt to add object to itself:', element.name || element.uuid);
          return;
        }
        
        console.log('Positioning effect element for mesh:', mesh.name || mesh.id);
        
        // Get the world position of the mesh
        const worldPosition = new THREE.Vector3();
        mesh.getWorldPosition(worldPosition);
        
        // Position element
        element.position.copy(worldPosition);
        
        // Apply type-specific positioning and rotation
        if (effectType === 'fire' || effectType === 'flame') {
          element.position.y += 0.5; // Position on top of the mesh
        } else if (effectType === 'magic' || effectType === 'arcane') {
          element.position.y += 0.75; // Position slightly higher
        } else if (effectType === 'holy') {
          element.position.y += 1.0; // Position above for holy effects
        } else if (effectType === 'portalEffect') {
          element.position.y += 0.3; // Position slightly above for portals
          
          // Special case for portal elements
          if (element === effectData.portalRing || element === effectData.vortex) {
            element.rotation.x = Math.PI / 2; // Horizontal orientation
          }
        }
        
        console.log('Effect element positioned for mesh:', mesh.name);
      });
      
    } catch (error) {
      console.error('Error ensuring effect position:', error);
    }
  }, 100); // Wait a bit to ensure effect is fully created
}

/**
 * Apply a custom position update for special effect types
 * This gets called during animation updates to continuously
 * fix positions for complex effects like portals
 * 
 * @param {string} effectType - The type of effect
 * @param {Object} effectData - The effect data
 * @param {THREE.Object3D} mesh - The mesh with the effect
 */
updateSpecialEffectPositions(effectType, effectData, mesh) {
  if (!effectData || !mesh) return;
  
  // Get mesh world position
  const worldPosition = new THREE.Vector3();
  mesh.getWorldPosition(worldPosition);
  
  // Handle different effect types
  switch (effectType) {
    case 'portalEffect':
      // For portal effects, position specific elements
      if (effectData.portalRing && effectData.portalRing !== mesh) {
        effectData.portalRing.position.copy(worldPosition);
        effectData.portalRing.position.y += 0.3; // Slightly above ground
      }
      
      if (effectData.vortex && effectData.vortex !== mesh) {
        effectData.vortex.position.copy(worldPosition);
        effectData.vortex.position.y += 0.5; // Position in the center
      }
      
      if (effectData.particles && effectData.particles !== mesh) {
        effectData.particles.position.copy(worldPosition);
        effectData.particles.position.y += 0.6; // Above the portal
      }
      break;
      
    case 'fire':
    case 'flame':
      // For fire effects
      if (effectData.particles && effectData.particles !== mesh) {
        effectData.particles.position.copy(worldPosition);
        effectData.particles.position.y += 0.4; // Above the object
      }
      
      if (effectData.light && effectData.light !== mesh) {
        effectData.light.position.copy(worldPosition);
        effectData.light.position.y += 0.5; // Light above
      }
      break;
      
    case 'holy':
      // For holy effects
      if (effectData.particles && effectData.particles !== mesh) {
        effectData.particles.position.copy(worldPosition);
        effectData.particles.position.y += 1.0; // Well above
      }
      
      if (effectData.light && effectData.light !== mesh) {
        effectData.light.position.copy(worldPosition);
        effectData.light.position.y += 0.8; // Light above
      }
      break;
      
    default:
      // Generic handling for other effects
      if (effectData.container && effectData.container !== mesh) {
        effectData.container.position.copy(worldPosition);
      }
      
      // Position light slightly above object
      if (effectData.light && effectData.light !== mesh) {
        effectData.light.position.copy(worldPosition);
        effectData.light.position.y += 0.3; // Default light height
      }
  }
}

/**
 * Apply our custom update method to the shader effects manager
 * This adds a hook into the update cycle to keep fixing positions
 */
installEffectPositionUpdater() {
  // Try to find our effects manager
  const effectsManager = this.shaderEffects || 
                        window.shaderEffectsManager ||
                        (window.scene3D ? window.scene3D.shaderEffects : null);
  
  if (!effectsManager) {
    console.warn('No shader effects manager found for position updater');
    return false;
  }
  
  // Don't install twice
  if (effectsManager._positionUpdaterInstalled) {
    return true;
  }
  
  // Store original update method
  const originalUpdate = effectsManager.update;
  const self = this;
  
  // Replace with our enhanced version
  effectsManager.update = function(deltaTime) {
    // Call original first
    if (originalUpdate) {
      originalUpdate.call(this, deltaTime);
    }
    
    // Now add our position updates for all effects
    if (this.effects && this.effects.size > 0) {
      this.effects.forEach((effectData, meshId) => {
        if (effectData && effectData.type) {
          // Find the mesh by ID
          let mesh = null;
          
          // First try looking by ID in the scene
          if (self.scene) {
            mesh = self.scene.getObjectById(meshId);
          }
          
          // If found, update its effects
          if (mesh) {
            self.updateSpecialEffectPositions(effectData.type, effectData, mesh);
          }
        }
      });
    }
  };
  
  // Mark as installed
  effectsManager._positionUpdaterInstalled = true;
  console.log('Installed effect position updater in shader effects manager');
  return true;
}

/**
 * Apply parameters to an effect
 * @param {THREE.Mesh} mesh - The mesh with the effect
 * @param {Object} parameters - The parameters to apply
 */
// applyEffectParameters(mesh, parameters) {
//   // Find the effects manager that has the effect data
//   let effectsManager = null;
//   let effectData = null;
  
//   // Try all possible managers
//   if (this.shaderEffects && this.shaderEffects.effects) {
//     effectData = this.shaderEffects.effects.get(mesh.id);
//     if (effectData) effectsManager = this.shaderEffects;
//   }
  
//   if (!effectData && window.shaderEffectsManager && window.shaderEffectsManager.effects) {
//     effectData = window.shaderEffectsManager.effects.get(mesh.id);
//     if (effectData) effectsManager = window.shaderEffectsManager;
//   }
  
//   if (!effectData && window.scene3D && window.scene3D.shaderEffects && 
//       window.scene3D.shaderEffects.effects) {
//     effectData = window.scene3D.shaderEffects.effects.get(mesh.id);
//     if (effectData) effectsManager = window.scene3D.shaderEffects;
//   }
  
//   // If we found effect data, apply parameters
//   if (effectData && effectData.light) {
//     console.log('Applying effect parameters:', parameters);
    
//     // Apply intensity parameter
//     if (parameters.intensity !== undefined) {
//       effectData.light.intensity = parameters.intensity;
//     }
    
//     // Apply color parameter
//     if (parameters.color !== undefined) {
//       effectData.light.color.set(parameters.color);
//     }
//   } 
//   else if (effectsManager && typeof effectsManager.applyEffectParameters === 'function') {
//     // Try using the manager's method if available
//     effectsManager.applyEffectParameters(mesh, parameters);
//   }
// }

/**
 * Apply parameters to effect data directly
 * @param {THREE.Mesh} mesh - The mesh with the effect
 * @param {Object} effectData - The effect data
 * @param {Object} parameters - Parameters to apply
 */
applyEffectParameters(mesh, effectData, parameters) {
  console.log('Applying effect parameters:', parameters);
  
  // Common parameters
  if (parameters.intensity !== undefined && effectData.light) {
    effectData.light.intensity = parameters.intensity;
    effectData.baseIntensity = parameters.intensity; // For animation
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
  
  // Effect-specific parameters
  if (effectData.type === 'portalEffect') {
    // Special handling for portal parameters
    if (parameters.size !== undefined && effectData.portalRing) {
      effectData.portalRing.scale.set(
        parameters.size,
        parameters.size,
        parameters.size
      );
    }
  }
  else if (effectData.type === 'fire') {
    // Fire-specific parameters
    if (parameters.height !== undefined && effectData.container) {
      effectData.container.scale.y = parameters.height;
    }
  }
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
}