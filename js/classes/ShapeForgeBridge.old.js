window.ShapeForgeBridge = class ShapeForgeBridge {
    /**
     * Create a new ShapeForgeBridge
     * @param {THREE.Scene} targetScene - The Scene3D scene to add objects to
     * @param {Object} resourceManager - Reference to the ResourceManager
     */
    constructor(targetScene, resourceManager) {
      this.targetScene = targetScene;
      this.resourceManager = resourceManager;
      this.modelsCache = new Map();
      this.animatedObjects = new Set();
      
      // Try to get the ShapeForge instance
      this.shapeForge = window.shapeForge || null;
      
      // Log initialization state
      console.log('ShapeForgeBridge initialized with:', {
        hasTargetScene: !!targetScene,
        hasResourceManager: !!resourceManager,
        hasShapeForge: !!this.shapeForge
      });
    }
  
  /**
   * Get ShapeForge instance or load it if needed
   * @returns {Promise<Object>} - ShapeForge instance
   */
  async getShapeForge() {
    // Return existing reference if available
    if (this.shapeForge) {
      return this.shapeForge;
    }
    
    // Try global reference
    if (window.shapeForge) {
      this.shapeForge = window.shapeForge;
      return this.shapeForge;
    }
    
    // If ShapeForge isn't available, try to load it
    return new Promise((resolve, reject) => {
      console.log('Attempting to load ShapeForge dynamically');
      
      // Check if ShapeForge class exists but isn't instantiated
      if (window.ShapeForge) {
        console.log('ShapeForge class found, creating instance');
        try {
          // Create minimal ShapeForge instance
          this.shapeForge = new ShapeForge(this.resourceManager);
          window.shapeForge = this.shapeForge; // Make globally available
          resolve(this.shapeForge);
        } catch (error) {
          console.error('Error creating ShapeForge instance:', error);
          reject(error);
        }
        return;
      }
      
      // If class isn't available, we're out of options
      reject(new Error('ShapeForge not available and cannot be loaded dynamically'));
    });
  }
  
  /**
   * Create a ShapeForge model for the Scene3D world using ShapeForge's own methods
   * @param {string|Object} modelData - Model ID or model data object
   * @param {Object} options - Position, rotation, etc. for the model
   * @returns {Promise<THREE.Group>} - The created model group
   */
  async createModel(modelData, options = {}) {
    try {
      // Get ShapeForge instance
      const shapeForge = await this.getShapeForge();
      if (!shapeForge) {
        throw new Error('ShapeForge unavailable');
      }
      
      // Determine if we received an ID or the data directly
      let modelJson;
      if (typeof modelData === 'string') {
        // It's an ID, load from ResourceManager
        modelJson = await this.loadModelFromResource(modelData);
        if (!modelJson) {
          throw new Error(`Model with ID ${modelData} not found`);
        }
      } else {
        // It's already the model data
        modelJson = modelData;
      }
      
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
      
      // Create and setup a unique temporary scene for ShapeForge to build in
      const tempScene = new THREE.Scene();
      
      // Tell ShapeForge to build the model
      const builtModel = await this.buildModelWithShapeForge(shapeForge, modelJson, tempScene);
      
      // Transfer objects from temp scene to container
      this.transferObjectsFromScene(tempScene, container);
      
      // Register with Scene3DController for animations
      if (builtModel.animations && builtModel.animations.length > 0) {
        container.userData.animations = builtModel.animations;
        this.registerForAnimation(container);
      }
      
      // Add completed container to target scene
      this.targetScene.add(container);
      
      // Return the container for any further manipulation
      return container;
      
    } catch (error) {
      console.error('Error creating ShapeForge model:', error);
      return null;
    }
  }
  
  /**
   * Load a model from ResourceManager by ID
   * @param {string} modelId - The ID of the model
   * @returns {Promise<Object>} - The model data
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
    
    // Try IndexedDB as fallback
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
   * Open the IndexedDB database for models
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
 * Use ShapeForge to build the model in a temporary scene
 * This uses ShapeForge's own methods to ensure consistency
 * @param {Object} shapeForge - ShapeForge instance
 * @param {Object} modelJson - Model data
 * @param {THREE.Scene} tempScene - Temporary scene to build in
 * @returns {Object} - Built model with extracted animations
 */
async buildModelWithShapeForge(shapeForge, modelJson, tempScene) {
    // Store original scene
    const originalScene = shapeForge.previewScene;
    
    // Temporarily replace with our scene
    shapeForge.previewScene = tempScene;
    
    // Store original objects for restoration
    const originalObjects = [...shapeForge.objects];
    const originalSelectedObject = shapeForge.selectedObject;
    
    try {
      // Use our no-UI version of loadProjectFromJson
      this.loadProjectWithoutUI(shapeForge, modelJson.data);
      
      // Extract animations from objects
      const animations = [];
      shapeForge.objects.forEach(obj => {
        if (obj.effect) {
          animations.push({
            objectId: obj.mesh.id,
            effectType: obj.effect.type,
            updateFn: obj.effect.update || 
                     (obj.effect.data && obj.effect.data.update) || 
                     null
          });
        }
      });
      
      // Return the built model
      return {
        objects: [...shapeForge.objects],
        animations: animations
      };
    } finally {
      // Restore ShapeForge's original state
      shapeForge.previewScene = originalScene;
      shapeForge.objects = originalObjects;
      shapeForge.selectedObject = originalSelectedObject;
    }
  }

  /**
 * A version of ShapeForge's loadProjectFromJson that doesn't use UI components
 * @param {Object} shapeForge - The ShapeForge instance
 * @param {Object} jsonData - The project data to load
 * @returns {boolean} - Whether loading was successful
 */
loadProjectWithoutUI(shapeForge, jsonData) {
    // Validate project data
    if (!jsonData || !jsonData.objects || !Array.isArray(jsonData.objects)) {
      throw new Error('Invalid project data');
    }
    
    console.log('Loading ShapeForge model data without UI:', jsonData.name);
    
    // Clean up any existing effects
    if (typeof shapeForge.cleanupAllShaderEffects === 'function') {
      shapeForge.cleanupAllShaderEffects();
    }
    
    // Clear current objects - simplified version of newProject
    shapeForge.objects.forEach(obj => {
      if (obj.mesh && obj.mesh.parent) {
        obj.mesh.parent.remove(obj.mesh);
      }
    });
    
    // Reset ShapeForge state
    shapeForge.objects = [];
    shapeForge.selectedObject = null;
    
    // Skip the drawer part:
    // const projectNameInput = this.drawer.querySelector('#project-name');
    // if (projectNameInput && jsonData.name) {
    //    projectNameInput.value = jsonData.name;
    // }
    
    // Keep track of created objects that need textures
    const objectsNeedingTextures = [];
    
    // Load objects
    console.log(`Loading ${jsonData.objects.length} objects from JSON`);
    jsonData.objects.forEach(objData => {
      // Create the object
      const createdObject = shapeForge.createObjectFromData(objData);
      
      // If object has texture data, queue it for texture loading
      if (objData.material && objData.material.texture && objData.material.texture.data) {
        objectsNeedingTextures.push({
          object: createdObject,
          textureData: objData.material.texture
        });
      }
    });
    
    // Load textures for objects that need them
    console.log(`Applying textures to ${objectsNeedingTextures.length} objects`);
    objectsNeedingTextures.forEach(item => {
      // Create a texture loader
      const loader = new THREE.TextureLoader();
      
      // Make sure the material color is white to avoid tinting
      if (item.object && item.object.material) {
        item.object.material.color.set(0xffffff);
      }
      
      // Load the texture
      loader.load(
        item.textureData.data,
        // Success callback
        (texture) => {
          console.log(`Texture loaded for ${item.object.name}`);
          
          // Configure texture settings
          if (item.textureData.repeat && item.textureData.repeat.length === 2) {
            texture.repeat.set(
              item.textureData.repeat[0],
              item.textureData.repeat[1]
            );
          }
          
          if (item.textureData.offset && item.textureData.offset.length === 2) {
            texture.offset.set(
              item.textureData.offset[0],
              item.textureData.offset[1]
            );
          }
          
          if (item.textureData.rotation !== undefined) {
            texture.rotation = item.textureData.rotation;
          }
          
          // Set wrapping modes
          texture.wrapS = item.textureData.wrapS || THREE.RepeatWrapping;
          texture.wrapT = item.textureData.wrapT || THREE.RepeatWrapping;
          
          // Apply texture to material
          if (item.object.material) {
            item.object.material.map = texture;
            item.object.material.needsUpdate = true;
            console.log(`Applied texture to ${item.object.name}`);
          }
        },
        // Progress callback
        undefined,
        // Error callback
        (error) => {
          console.error(`Error loading texture for ${item.object.name}:`, error);
        }
      );
    });
    
    // Skip the selection and UI updates:
    // if (this.objects.length > 0) {
    //    this.selectObject(0);
    // }
    // this.updateObjectsList();
    
    console.log(`Model loaded with ${shapeForge.objects.length} objects and ${objectsNeedingTextures.length} textures`);
    
    // Apply any pending effects
    setTimeout(() => {
      shapeForge.objects.forEach((obj, index) => {
        if (obj.pendingEffect) {
          // Skip the selection step
          // shapeForge.selectObject(index);
          
          // Apply effect directly
          if (typeof shapeForge.applyShaderEffect === 'function') {
            shapeForge.applyShaderEffect(obj, obj.pendingEffect);
          }
          delete obj.pendingEffect;
        }
      });
    }, 500);
    
    return true;
  }
  
  /**
   * Transfer objects from temporary scene to container
   * @param {THREE.Scene} scene - Source scene
   * @param {THREE.Group} container - Target container
   */
  transferObjectsFromScene(scene, container) {
    // Clone scene children to container
    scene.children.forEach(child => {
      scene.remove(child);
      container.add(child);
    });
  }
  
  /**
   * Register an object for animation updates in Scene3DController
   * @param {THREE.Object3D} object - Object to animate
   */
  registerForAnimation(object) {
    // Add to tracking set
    this.animatedObjects.add(object);
    
    // Install animation system if needed
    this.installAnimationSystem();
  }
  
  /**
   * Install animation system into Scene3DController
   */
  installAnimationSystem() {
    // Only install once
    if (window.scene3D && !window.scene3D._shapeForgeBridgeAnimationInstalled) {
      const originalAnimate = window.scene3D.animate;
      const animatedObjects = this.animatedObjects; // Reference to our tracked objects
      
      window.scene3D.animate = function() {
        // Call original first
        originalAnimate.call(this);
        
        // Calculate delta time
        const now = performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
        this.lastFrameTime = now;
        
        // Update all ShapeForge animated objects
        animatedObjects.forEach(obj => {
          if (obj.userData && obj.userData.animations) {
            obj.userData.animations.forEach(anim => {
              if (anim.updateFn && typeof anim.updateFn === 'function') {
                try {
                  anim.updateFn(deltaTime);
                } catch (error) {
                  console.warn('Error in animation update:', error);
                }
              }
            });
          }
        });
      };
      
      // Mark as installed
      window.scene3D._shapeForgeBridgeAnimationInstalled = true;
      console.log('ShapeForgeBridge animation system installed in Scene3DController');
    }
  }
  
  /**
   * Clean up references when done
   */
  dispose() {
    this.animatedObjects.clear();
    this.modelsCache.clear();
  }
}