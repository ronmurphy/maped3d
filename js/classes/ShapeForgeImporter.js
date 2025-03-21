class ShapeForgeImporter {
  constructor(scene, resourceManager, shaderEffectsManager = null) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.shaderEffectsManager = shaderEffectsManager;
    this.modelsCache = new Map(); // Optional cache for already loaded models
  }

  /**
   * Loads a ShapeForge model from ResourceManager or IndexedDB
   * @param {string} modelId - The ID of the model to load
   * @returns {Promise<Object>} - The model data
   */
  // async loadModel(modelId) {
  //   // Try memory cache first
  //   if (this.modelsCache.has(modelId)) {
  //     return this.modelsCache.get(modelId);
  //   }
    
  //   // Try ResourceManager
  //   if (this.resourceManager?.resources?.shapeforge) {
  //     const model = this.resourceManager.resources.shapeforge.get(modelId);
  //     if (model) {
  //       this.modelsCache.set(modelId, model);
  //       return model;
  //     }
  //   }
    
  //   // Try IndexedDB as last resort
  //   try {
  //     const db = await this.openModelDatabase();
  //     const tx = db.transaction(['models'], 'readonly');
  //     const store = tx.objectStore('models');
  //     const model = await store.get(modelId);
      
  //     if (model) {
  //       this.modelsCache.set(modelId, model);
  //       return model;
  //     }
  //   } catch (e) {
  //     console.error('Error loading model from IndexedDB:', e);
  //   }
    
  //   return null;
  // }
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


  // createMeshFromObject(objData) {

  //   if (!objData.shape) {
  //     console.warn("Object missing shape property:", objData);
      
  //     // Create a default cube as fallback
  //     const geometry = new THREE.BoxGeometry(1, 1, 1);
  //     const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  //     const mesh = new THREE.Mesh(geometry, material);
      
  //     // Apply position, rotation, scale if available
  //     if (objData.position) {
  //       mesh.position.set(
  //         objData.position.x || 0,
  //         objData.position.y || 0,
  //         objData.position.z || 0
  //       );
  //     }
      
  //     return mesh;
  //   }

  //   // Create geometry based on shape type
  //   let geometry;
    
  //   switch(objData.shape) {
  //     case 'box':
  //       geometry = new THREE.BoxGeometry(
  //         objData.dimensions.width, 
  //         objData.dimensions.height, 
  //         objData.dimensions.depth
  //       );
  //       break;
        
  //     case 'sphere':
  //       geometry = new THREE.SphereGeometry(
  //         objData.dimensions.radius, 
  //         32, 16
  //       );
  //       break;
        
  //     case 'cylinder':
  //       geometry = new THREE.CylinderGeometry(
  //         objData.dimensions.radiusTop || objData.dimensions.radius, 
  //         objData.dimensions.radiusBottom || objData.dimensions.radius, 
  //         objData.dimensions.height, 
  //         32
  //       );
  //       break;
        
  //     case 'plane':
  //       geometry = new THREE.PlaneGeometry(
  //         objData.dimensions.width,
  //         objData.dimensions.height
  //       );
  //       break;
        
  //     case 'cone':
  //       geometry = new THREE.ConeGeometry(
  //         objData.dimensions.radius,
  //         objData.dimensions.height,
  //         32
  //       );
  //       break;
        
  //     default:
  //       console.warn(`Unsupported shape type: ${objData.shape}`);
  //       return null;
  //   }
    
  //   // Create material
  //   const material = this.createMaterialFromObject(objData);
    
  //   // Create mesh and set transformation
  //   const mesh = new THREE.Mesh(geometry, material);
    
  //   // Apply position, rotation, scale
  //   if (objData.position) {
  //     mesh.position.set(
  //       objData.position.x || 0,
  //       objData.position.y || 0,
  //       objData.position.z || 0
  //     );
  //   }
    
  //   if (objData.rotation) {
  //     // Convert from degrees to radians if needed
  //     const radiansX = objData.rotation.x * (Math.PI/180);
  //     const radiansY = objData.rotation.y * (Math.PI/180);
  //     const radiansZ = objData.rotation.z * (Math.PI/180);
      
  //     mesh.rotation.set(radiansX, radiansY, radiansZ);
  //   }
    
  //   if (objData.scale) {
  //     mesh.scale.set(
  //       objData.scale.x || 1,
  //       objData.scale.y || 1,
  //       objData.scale.z || 1
  //     );
  //   }
    
  //   // Add name if available
  //   if (objData.name) {
  //     mesh.name = objData.name;
  //   }
    
  //   // Store reference to original data
  //   mesh.userData.shapeforgeObjectData = {
  //     id: objData.id,
  //     type: objData.shape
  //   };
    
  //   return mesh;
  // }
  
  /**
   * Create a Three.js material from a ShapeForge object
   */

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
      
      // Store mesh and object data for later reference
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
    
    setTimeout(() => {
      objectsWithEffects.forEach(({mesh, effect}) => {
        try {
          const effectType = typeof effect === 'string' ? effect : effect.type;
          
          console.log(`Applying ${effectType} effect to mesh`);
          
          // Apply effect via ShaderEffectsManager
          if (window.shaderEffectsManager && window.shaderEffectsManager.applyEffect) {
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
          } else if (this.shaderEffects && this.shaderEffects.applyEffect) {
            // Alternative shader effects manager (from Scene3DController)
            this.shaderEffects.applyEffect(mesh, effectType);
            
            // Apply parameters if available
            if (typeof effect === 'object' && effect.parameters) {
              this.applyEffectParameters(mesh, effect.parameters);
            }
          }
        } catch (error) {
          console.error("Error applying effect:", error);
        }
      });
    }, 500);
  }
  
  return group;
}

/**
 * Apply shader effects to meshes
 */
applyShaderEffects(meshes) {
  // If ShaderEffectsManager isn't available, skip effects
  if (!window.shaderEffectsManager) return;
  
  meshes.forEach(({mesh, objData}) => {
    if (objData.effect) {
      try {
        const effectType = typeof objData.effect === 'string' ? 
          objData.effect : objData.effect.type;
          
        console.log(`Applying ${effectType} effect to ${objData.name}`);
        
        // Create the effect - we'll need to access the ShaderEffectsManager
        if (window.shaderEffectsManager.applyEffect) {
          window.shaderEffectsManager.applyEffect(mesh, effectType);
          
          // Apply effect parameters if available
          if (typeof objData.effect === 'object' && objData.effect.parameters) {
            this.applyEffectParameters(mesh, objData.effect.parameters);
          }
        }
      } catch (error) {
        console.error(`Error applying effect to ${objData.name}:`, error);
      }
    }
  });
}

/**
 * Apply effect parameters
 */
// applyEffectParameters(mesh, parameters) {
//   if (!window.shaderEffectsManager) return;
  
//   // Get effect data
//   const effectData = window.shaderEffectsManager.effects.get(mesh.id);
//   if (!effectData) return;
  
//   // Apply common parameters
//   if (parameters.intensity !== undefined && effectData.light) {
//     effectData.light.intensity = parameters.intensity;
//   }
  
//   if (parameters.color !== undefined) {
//     // Apply to light if available
//     if (effectData.light) {
//       effectData.light.color.setHex(parameters.color);
//     }
    
//     // Apply to emissive material if available
//     if (mesh.material && mesh.material.emissive) {
//       mesh.material.emissive.setHex(parameters.color);
//     }
    
//     // Apply to particle colors if available
//     if (effectData.particles &&
//       effectData.particles.material &&
//       effectData.particles.material.color) {
//       effectData.particles.material.color.setHex(parameters.color);
//     }
//   }
  
//   // Set other effect parameters as needed
//   if (parameters.particleCount !== undefined && effectData.animationData) {
//     effectData.animationData.particleCount = parameters.particleCount;
//   }
  
//   if (parameters.speed !== undefined && effectData.animationData) {
//     effectData.animationData.speed = parameters.speed;
//   }
  
//   console.log("Applied effect parameters:", parameters);
// }

/**
 * Apply effect parameters to a mesh with effect
 */
applyEffectParameters(mesh, parameters) {
  // Get effect data from ShaderEffectsManager
  const effectData = window.shaderEffectsManager.effects.get(mesh.id);
  if (!effectData) {
    console.warn("No effect data found for mesh:", mesh.name);
    return;
  }
  
  console.log("Applying effect parameters:", parameters);
  
  // Apply intensity parameter
  if (parameters.intensity !== undefined && effectData.light) {
    effectData.light.intensity = parameters.intensity;
  }
  
  // Apply color parameter
  if (parameters.color !== undefined) {
    // Apply to light if available
    if (effectData.light && effectData.light.color) {
      effectData.light.color.set(parameters.color);
    }
    
    // Apply to emissive material if available
    if (effectData.definition && effectData.definition.emissive) {
      effectData.definition.emissive = parameters.color;
    }
  }
  
  // Apply particle count if available
  if (parameters.particleCount !== undefined && 
      effectData.particles && 
      effectData.particles.geometry) {
    // This may need custom handling depending on shader implementation
    console.log("Particle count parameter not yet implemented");
  }
  
  // Apply animation speed if available
  if (parameters.speed !== undefined && effectData.animationData) {
    effectData.animationData.speed = parameters.speed;
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