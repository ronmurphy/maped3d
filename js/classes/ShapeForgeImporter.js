// ShapeForgeImporter.js

class ShapeForgeImporter {
  constructor(scene, resourceManager) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.modelsCache = new Map(); // Optional cache for already loaded models
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
        this.modelsCache.set(modelId, model);
        return model;
      }
    } catch (e) {
      console.error('Error loading model from IndexedDB:', e);
    }
    
    return null;
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
    modelData.data.objects.forEach(obj => {
      try {
        // Create mesh from object data
        const mesh = this.createMeshFromObject(obj);
        if (mesh) {
          group.add(mesh);
        }
      } catch (e) {
        console.warn(`Error creating object ${obj.name || 'unnamed'}:`, e);
      }
    });
    
    // Apply global scale if provided
    if (options.scale) {
      if (typeof options.scale === 'number') {
        group.scale.set(options.scale, options.scale, options.scale);
      } else {
        group.scale.copy(options.scale);
      }
    }
    
    // Apply global position if provided
    if (options.position) {
      group.position.copy(options.position);
    }
    
    // Apply global rotation if provided
    if (options.rotation) {
      group.rotation.copy(options.rotation);
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
    // Create geometry based on shape type
    let geometry;
    
    switch(objData.shape) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          objData.dimensions.width, 
          objData.dimensions.height, 
          objData.dimensions.depth
        );
        break;
        
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          objData.dimensions.radius, 
          32, 16
        );
        break;
        
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          objData.dimensions.radiusTop || objData.dimensions.radius, 
          objData.dimensions.radiusBottom || objData.dimensions.radius, 
          objData.dimensions.height, 
          32
        );
        break;
        
      case 'plane':
        geometry = new THREE.PlaneGeometry(
          objData.dimensions.width,
          objData.dimensions.height
        );
        break;
        
      case 'cone':
        geometry = new THREE.ConeGeometry(
          objData.dimensions.radius,
          objData.dimensions.height,
          32
        );
        break;
        
      default:
        console.warn(`Unsupported shape type: ${objData.shape}`);
        return null;
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
      // Convert from degrees to radians if needed
      const radiansX = objData.rotation.x * (Math.PI/180);
      const radiansY = objData.rotation.y * (Math.PI/180);
      const radiansZ = objData.rotation.z * (Math.PI/180);
      
      mesh.rotation.set(radiansX, radiansY, radiansZ);
    }
    
    if (objData.scale) {
      mesh.scale.set(
        objData.scale.x || 1,
        objData.scale.y || 1,
        objData.scale.z || 1
      );
    }
    
    // Add name if available
    if (objData.name) {
      mesh.name = objData.name;
    }
    
    // Store reference to original data
    mesh.userData.shapeforgeObjectData = {
      id: objData.id,
      type: objData.shape
    };
    
    return mesh;
  }
  
  /**
   * Create a Three.js material from a ShapeForge object
   */
  createMaterialFromObject(objData) {
    // Default material properties
    const materialProps = {
      color: new THREE.Color(objData.color || '#cccccc'),
      roughness: 0.5,
      metalness: 0.2
    };
    
    // Apply custom material properties if available
    if (objData.material) {
      if (objData.material.roughness !== undefined) {
        materialProps.roughness = objData.material.roughness;
      }
      
      if (objData.material.metalness !== undefined) {
        materialProps.metalness = objData.material.metalness;
      }
      
      if (objData.material.emissive) {
        materialProps.emissive = new THREE.Color(objData.material.emissive);
        materialProps.emissiveIntensity = objData.material.emissiveIntensity || 1.0;
      }
      
      if (objData.material.transparent) {
        materialProps.transparent = true;
        materialProps.opacity = objData.material.opacity !== undefined ? 
          objData.material.opacity : 0.8;
      }
    }
    
    // Create the material
    return new THREE.MeshStandardMaterial(materialProps);
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