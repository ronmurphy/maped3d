class ShapeForgeParser {
    /**
     * Create a new ShapeForgeParser
     * @param {THREE.Scene} scene - The THREE.js scene to add models to
     * @param {Object} resourceManager - Reference to the resource manager
     * @param {Object} shaderEffects - Reference to the shader effects manager (optional)
     */
    constructor(scene, resourceManager, shaderEffects = null) {
        this.scene = scene;
        this.resourceManager = resourceManager;
        this.objects = [];
        this.selectedObject = null;

        // Try to get shader effects manager
        this.shaderEffects = shaderEffects;
        if (!this.shaderEffects) {
            if (window.shaderEffectsManager) {
                this.shaderEffects = window.shaderEffectsManager;
            } else if (window.scene3D && window.scene3D.shaderEffects) {
                this.shaderEffects = window.scene3D.shaderEffects;
            }
        }

        // Log initialization state
        console.log('ShapeForgeParser initialized with:', {
            hasScene: !!scene,
            hasResourceManager: !!resourceManager,
            hasShaderEffects: !!this.shaderEffects
        });
    }

    /**
     * Check if THREE.js is available
     * @returns {boolean} Whether THREE.js is available
     */
    checkDependencies() {
        if (!window.THREE) {
            console.error("THREE.js not available! ShapeForgeParser requires THREE.js to function.");
            return false;
        }
        return true;
    }

    /**
     * Clear current project
     */
    newProject() {
        this.cleanupAllShaderEffects();

        // Clear all objects
        this.objects.forEach(obj => {
            if (obj.mesh && obj.mesh.parent) {
                obj.mesh.parent.remove(obj.mesh);
            }
        });

        this.objects = [];
        this.selectedObject = null;

        console.log('Created new project');
    }

    /**
     * Load a ShapeForge model from raw JSON data
     * @param {Object|string} jsonData - JSON data or string to parse
     * @returns {Array} - Array of created objects
     */
    loadModelFromJson(jsonData) {
        // Parse string if needed
        if (typeof jsonData === 'string') {
            try {
                jsonData = JSON.parse(jsonData);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                throw error;
            }
        }
        
        // Load the project
        this.loadProjectFromJson(jsonData);
        
        // Return objects for placement
        return this.objects;
    }

    /**
     * Load a ShapeForge project from JSON
     * @param {Object} jsonData - Project data
     * @returns {boolean} Success
     */
    loadProjectFromJson(jsonData) {
        // Validate project data
        if (!jsonData || !jsonData.objects || !Array.isArray(jsonData.objects)) {
            throw new Error('Invalid project data');
        }

        console.log("Loading project using loadProjectFromJson");

        this.cleanupAllShaderEffects();
        this.newProject();

        // Keep track of created objects that need textures
        const objectsNeedingTextures = [];

        // Load objects
        console.log(`Loading ${jsonData.objects.length} objects from JSON`);
        jsonData.objects.forEach(objData => {
            // Create the object
            const createdObject = this.createObjectFromData(objData);

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
            this.loadAndApplyTextureToObject(item.object, item.textureData);
        });

        console.log(`Project loaded with ${this.objects.length} objects and ${objectsNeedingTextures.length} textures`);

        // Apply pending effects after a short delay to ensure all objects are loaded
        setTimeout(() => {
            this.applyPendingEffects();
        }, 500);

        return true;
    }

    /**
     * Load a ShapeForge model from IndexedDB
     * @param {string} modelId - ID of the model to load
     * @returns {Promise<Object>} - Promise resolving to the loaded objects
     */
    async loadModelFromIndexedDB(modelId) {
        if (!this.resourceManager) {
            throw new Error("ResourceManager not available");
        }
        
        try {
            // Get the model data from resourceManager
            let model;
            
            // Check if the model exists in memory first
            if (this.resourceManager.resources.shapeforge) {
                model = this.resourceManager.resources.shapeforge.get(modelId);
            }
            
            // If not in memory, try loading from IndexedDB
            if (!model && typeof this.resourceManager.loadModelFromIndexedDB === 'function') {
                model = await this.resourceManager.loadModelFromIndexedDB(modelId);
            }
            
            if (!model) {
                throw new Error(`Model with ID ${modelId} not found`);
            }
            
            console.log('Loading model:', model.name);
            
            // Parse the model data
            let jsonData;
            if (typeof model.data === 'object' && model.data !== null) {
                jsonData = model.data;
            } else if (typeof model.data === 'string') {
                jsonData = JSON.parse(model.data);
            } else {
                throw new Error('Invalid model data format');
            }
            
            // Load the project data
            this.loadProjectFromJson(jsonData);
            
            // Return the loaded objects for further processing
            return this.objects;
        } catch (error) {
            console.error('Error loading model from IndexedDB:', error);
            throw error;
        }
    }

    /**
     * Create an object from JSON data
     * @param {Object} objData - Object data
     * @returns {Object} Created object
     */
    createObjectFromData(objData) {
        console.log("Creating object from data:", objData.name, objData.type);
        
        // Create geometry based on type
        let geometry;
        
        // Special handling for merged objects with geometryData
        if (objData.type === 'merged' && objData.geometryData) {
            console.log("Creating merged geometry from geometryData");
            
            // Create a BufferGeometry from the saved vertex data
            geometry = new THREE.BufferGeometry();
            
            // Add attributes from geometryData
            if (objData.geometryData.vertices && objData.geometryData.vertices.length > 0) {
                const vertices = new Float32Array(objData.geometryData.vertices);
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            }
            
            if (objData.geometryData.normals && objData.geometryData.normals.length > 0) {
                const normals = new Float32Array(objData.geometryData.normals);
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }
            
            if (objData.geometryData.uvs && objData.geometryData.uvs.length > 0) {
                const uvs = new Float32Array(objData.geometryData.uvs);
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            }
            
            if (objData.geometryData.indices && objData.geometryData.indices.length > 0) {
                geometry.setIndex(objData.geometryData.indices);
            }
        } else {
            switch (objData.type) {
                case 'cube':
                    geometry = new THREE.BoxGeometry(
                        objData.parameters.width,
                        objData.parameters.height,
                        objData.parameters.depth,
                        objData.parameters.widthSegments,
                        objData.parameters.heightSegments,
                        objData.parameters.depthSegments
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
                    // Since THREE.js doesn't have a built-in D10 shape, recreate it as in createD10
                    const sides = objData.parameters.sides || 10;
                    const d10Radius = objData.parameters.radius || 0.5;
                    
                    // Define vertices
                    const vertices = [
                        [0, 0, 1],   // Top vertex
                        [0, 0, -1],  // Bottom vertex
                    ];
                    
                    // Add vertices around the "equator"
                    for (let i = 0; i < sides; ++i) {
                        const b = (i * Math.PI * 2) / sides;
                        vertices.push([-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1)]);
                    }
                    
                    // Define faces
                    const faces = [
                        [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 6], [0, 6, 7],
                        [0, 7, 8], [0, 8, 9], [0, 9, 10], [0, 10, 11], [0, 11, 2],
                        [1, 3, 2], [1, 4, 3], [1, 5, 4], [1, 6, 5], [1, 7, 6],
                        [1, 8, 7], [1, 9, 8], [1, 10, 9], [1, 11, 10], [1, 2, 11]
                    ];
                    
                    // Flatten arrays
                    const flatVertices = [];
                    vertices.forEach(v => {
                        if (Array.isArray(v)) {
                            flatVertices.push(v[0], v[1], v[2]);
                        } else {
                            flatVertices.push(v);
                        }
                    });
                    
                    const flatFaces = [];
                    faces.forEach(f => flatFaces.push(...f));
                    
                    // Create geometry
                    geometry = new THREE.PolyhedronGeometry(
                        flatVertices,
                        flatFaces,
                        d10Radius,
                        0
                    );
                    break;
                    
                // New shapes
                case 'torusKnot':
                    geometry = new THREE.TorusKnotGeometry(
                        objData.parameters.radius || 0.4,
                        objData.parameters.tube || 0.1,
                        objData.parameters.tubularSegments || 64,
                        objData.parameters.radialSegments || 8,
                        objData.parameters.p || 2,
                        objData.parameters.q || 3
                    );
                    break;
                
                case 'pyramid':
                    geometry = new THREE.ConeGeometry(
                        objData.parameters.radius || 0.5,
                        objData.parameters.height || 1,
                        objData.parameters.radialSegments || 3,
                        objData.parameters.heightSegments || 1
                    );
                    break;
                
                case 'capsule':
                    geometry = new THREE.CapsuleGeometry(
                        objData.parameters.radius || 0.3,
                        objData.parameters.length || 0.6,
                        objData.parameters.capSegments || 4,
                        objData.parameters.radialSegments || 8
                    );
                    break;
                
                case 'hemisphere':
                    geometry = new THREE.SphereGeometry(
                        objData.parameters.radius || 0.5,
                        objData.parameters.widthSegments || 32,
                        objData.parameters.heightSegments || 16,
                        objData.parameters.phiStart || 0,
                        objData.parameters.phiLength || Math.PI * 2,
                        objData.parameters.thetaStart || 0,
                        objData.parameters.thetaLength || Math.PI / 2
                    );
                    break;
                
                case 'tube':
                    // Create a curved path for the tube to follow
                    let curve;
                    
                    if (objData.parameters.path === 'circle') {
                        curve = new THREE.CatmullRomCurve3([
                            new THREE.Vector3(-0.5, 0, 0),
                            new THREE.Vector3(0, 0.5, 0.5),
                            new THREE.Vector3(0.5, 0, 0),
                            new THREE.Vector3(0, -0.5, -0.5)
                        ]);
                        curve.closed = true;
                    } else {
                        // Create a default curve if path type not recognized
                        curve = new THREE.CatmullRomCurve3([
                            new THREE.Vector3(-0.5, 0, 0),
                            new THREE.Vector3(0, 0.5, 0),
                            new THREE.Vector3(0.5, 0, 0)
                        ]);
                    }
                    
                    geometry = new THREE.TubeGeometry(
                        curve,
                        objData.parameters.tubularSegments || 32,
                        objData.parameters.tube || 0.1,
                        objData.parameters.radialSegments || 8,
                        true
                    );
                    break;
                
                case 'star':
                    // Get parameters
                    const points = objData.parameters.points || 5;
                    const outerRadius = objData.parameters.outerRadius || 0.5;
                    const innerRadius = objData.parameters.innerRadius || 0.2;
                    const depth = objData.parameters.depth || 0.2;
                    const bevelThickness = objData.parameters.bevelThickness || 0.05;
                    const bevelSize = objData.parameters.bevelSize || 0.05;
                    
                    // Create a star shape
                    const shape = new THREE.Shape();
                    
                    for (let i = 0; i < points * 2; i++) {
                        // Alternate between outer and inner radius
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (Math.PI / points) * i;
                        
                        const x = Math.sin(angle) * radius;
                        const y = Math.cos(angle) * radius;
                        
                        if (i === 0) {
                            shape.moveTo(x, y);
                        } else {
                            shape.lineTo(x, y);
                        }
                    }
                    
                    shape.closePath();
                    
                    // Extrude the shape to create a 3D star
                    const extrudeSettings = {
                        depth: depth,
                        bevelEnabled: true,
                        bevelThickness: bevelThickness,
                        bevelSize: bevelSize,
                        bevelSegments: 3
                    };
                    
                    geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    break;
                
                default:
                    console.warn(`Unknown geometry type: ${objData.type}`);
                    return null;
            }
        }
    
        let material;
        if (objData.material) {
            console.log("Creating material of type:", objData.material.type);
            
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
            console.log("No material data, creating default material");
            material = this.createDefaultMaterial();
        }
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Create object data
        const objectData = {
            type: objData.type,
            name: objData.name || `${objData.type} ${this.objects.length + 1}`,
            geometry: geometry,
            material: material,
            mesh: mesh,
            parameters: objData.parameters,
            position: objData.position || { x: 0, y: 0, z: 0 },
            rotation: objData.rotation || { x: 0, y: 0, z: 0 },
            scale: objData.scale || { x: 1, y: 1, z: 1 }
        };
        
        // Add to scene
        this.scene.add(mesh);
        
        // Apply transforms
        mesh.position.set(
            objectData.position.x,
            objectData.position.y,
            objectData.position.z
        );
        
        mesh.rotation.set(
            objectData.rotation.x,
            objectData.rotation.y,
            objectData.rotation.z
        );
        
        mesh.scale.set(
            objectData.scale.x,
            objectData.scale.y,
            objectData.scale.z
        );
        
        // Add to objects array
        this.objects.push(objectData);
        
        // Store effect data for later application
        if (objData.effect) {
            objectData.pendingEffect = objData.effect;
        }
        
        return objectData;
    }

    /**
     * Load and apply a texture to an object
     * @param {Object} objectData - The object data to apply the texture to
     * @param {Object} textureData - The texture data
     */
    loadAndApplyTextureToObject(objectData, textureData) {
        console.log("loadAndApplyTextureToObject called for:", objectData.name);
            
        if (!objectData || !textureData || !textureData.data) {
            console.warn("Cannot apply texture: Invalid data");
            return;
        }
        
        console.log("Texture data exists, starting loader...");
        
        // Create a texture loader
        const loader = new THREE.TextureLoader();
        
        // Set the color to white first to avoid tinting during loading
        if (objectData.material) {
            objectData.material.color.set(0xffffff);
        }
        
        // Load the texture from the data URL
        loader.load(
            textureData.data, 
            // Success callback
            (texture) => {
                console.log("Texture loaded successfully for", objectData.name);
                
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
                
                // Apply the texture to the object's material
                if (objectData.material) {
                    objectData.material.map = texture;
                    objectData.material.needsUpdate = true;
                    
                    console.log("Applied texture to", objectData.name);
                }
            },
            // Progress callback
            undefined,
            // Error callback
            (error) => {
                console.error("Error loading texture for", objectData.name, error);
            }
        );
    }

    /**
     * Create a default material for new objects
     * @returns {THREE.Material} The created material
     */
    createDefaultMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x3388ff,
            roughness: 0.5,
            metalness: 0.0
        });
    }

    /**
     * Apply pending effects to objects
     */
    applyPendingEffects() {
        console.log(`Applying effects to ${this.objects.length} objects`);

        this.objects.forEach((obj, index) => {
            if (obj.pendingEffect) {
                console.log(`Applying ${typeof obj.pendingEffect === 'string' ? 
                    obj.pendingEffect : obj.pendingEffect.type} effect to ${obj.name}`);

                // Select the object first
                this.selectObject(index);

                // Handle both string-only and object format
                const effectType = typeof obj.pendingEffect === 'string' ?
                    obj.pendingEffect : obj.pendingEffect.type;

                // Apply the effect
                this.applyShaderEffect(effectType);

                // Apply any specific effect parameters if available
                if (typeof obj.pendingEffect === 'object' && obj.pendingEffect.parameters) {
                    this.applyEffectParameters(obj, obj.pendingEffect.parameters);
                }

                // Clear pending effect
                delete obj.pendingEffect;
            }
        });
    }

    /**
     * Apply effect parameters to an object's effect
     * @param {Object} obj - The object with the effect
     * @param {Object} parameters - Effect parameters to apply
     */
    applyEffectParameters(obj, parameters) {
        if (!obj.effect || !obj.effect.data) return;

        // Apply common parameters
        if (parameters.intensity !== undefined && obj.effect.data.light) {
            obj.effect.data.light.intensity = parameters.intensity;
        }

        if (parameters.color !== undefined) {
            // Apply to light if available
            if (obj.effect.data.light) {
                obj.effect.data.light.color.setHex(parameters.color);
            }

            // Apply to emissive material if available
            if (obj.mesh.material && obj.mesh.material.emissive) {
                obj.mesh.material.emissive.setHex(parameters.color);
            }

            // Apply to particle colors if available
            if (obj.effect.data.particles &&
                obj.effect.data.particles.material &&
                obj.effect.data.particles.material.color) {
                obj.effect.data.particles.material.color.setHex(parameters.color);
            }
        }

        // Apply effect-specific parameters
        switch (obj.effect.type) {
            case 'fire':
            case 'lava':
                // Apply fire-specific parameters
                break;

            case 'glow':
            case 'holy':
                // Apply glow-specific parameters
                break;

            case 'magic':
            case 'coldMagic':
                // Apply magic-specific parameters
                break;
        }
    }

    /**
     * Select an object by index
     * @param {number} index - Index of object to select
     * @returns {Object} Selected object
     */
    selectObject(index) {
        if (index < 0 || index >= this.objects.length) return;
        this.selectedObject = index;
        return this.objects[index];
    }

    /**
     * Apply shader effect to the selected object
     * @param {string} effectType - Type of effect to apply
     */
    // applyShaderEffect(effectType) {
    //     if (this.selectedObject === null) {
    //         console.warn('No object selected, cannot apply shader effect');
    //         return;
    //     }

    //     // Handle 'none' case - remove current effect
    //     if (effectType === 'none') {
    //         const object = this.objects[this.selectedObject];
    //         if (object.effect) {
    //             console.log('Removing shader effect from object');
    //             // Remove existing effect if any
    //             if (object.effect.container && object.effect.container.parent) {
    //                 this.scene.remove(object.effect.container);
    //             }

    //             if (object.effect.light && object.effect.light.parent) {
    //                 this.scene.remove(object.effect.light);
    //             }

    //             if (object.effect.particles && object.effect.particles.parent) {
    //                 this.scene.remove(object.effect.particles);
    //             }

    //             // Reset emissive if it was changed
    //             if (object.mesh.material && object.mesh.material.emissive !== undefined &&
    //                 object.mesh.userData.originalEmissive) {
    //                 object.mesh.material.emissive.copy(object.mesh.userData.originalEmissive);
    //                 if (object.mesh.userData.originalEmissiveIntensity !== undefined) {
    //                     object.mesh.material.emissiveIntensity = object.mesh.userData.originalEmissiveIntensity;
    //                 }
    //             }

    //             // Clear effect data
    //             delete object.effect;
    //         }
    //         return;
    //     }

    //     const object = this.objects[this.selectedObject];

    //     try {
    //         // Remove existing effect if any
    //         if (object.effect) {
    //             // Remove from scene first
    //             if (object.effect.container && object.effect.container.parent) {
    //                 this.scene.remove(object.effect.container);
    //             }

    //             if (object.effect.light && object.effect.light.parent) {
    //                 this.scene.remove(object.effect.light);
    //             }

    //             if (object.effect.particles && object.effect.particles.parent) {
    //                 this.scene.remove(object.effect.particles);
    //             }

    //             // Reset emissive if it was changed
    //             if (object.mesh.material && object.mesh.material.emissive !== undefined &&
    //                 object.mesh.userData.originalEmissive) {
    //                 object.mesh.material.emissive.copy(object.mesh.userData.originalEmissive);
    //                 if (object.mesh.userData.originalEmissiveIntensity !== undefined) {
    //                     object.mesh.material.emissiveIntensity = object.mesh.userData.originalEmissiveIntensity;
    //                 }
    //             }

    //             delete object.effect;
    //         }

    //         // Get effect options from ShaderEffectsManager if available
    //         let effectOptions = {
    //             color: 0x66ccff,
    //             intensity: 1.0
    //         };

    //         if (this.shaderEffects && this.shaderEffects.effectDefinitions) {
    //             const definition = this.shaderEffects.effectDefinitions.get(effectType);
    //             if (definition) {
    //                 effectOptions = { ...effectOptions, ...definition };
    //             }
    //         }

    //         // Create the effect using our LOCAL implementations only
    //         let effectData;

    //         // Use correct method based on effect type
    //         switch (effectType) {
    //             case 'glow':
    //                 effectData = this.createPropGlowEffect(object.mesh, effectOptions);
    //                 break;
    //             case 'fire':
    //                 effectData = this.createSimpleFireEffect(object.mesh, effectOptions);
    //                 break;
    //             case 'magic':
    //                 effectData = this.createSimpleMagicEffect(object.mesh, effectOptions);
    //                 break;
    //             case 'lava':
    //                 // Use a special fire effect with lava colors
    //                 effectOptions.color = 0xff3300;
    //                 effectOptions.intensity = 1.3;
    //                 effectData = this.createSimpleFireEffect(object.mesh, effectOptions);
    //                 break;
    //             case 'holy':
    //                 // Use a special glow effect with holy colors
    //                 effectOptions.color = 0xffe599;
    //                 effectOptions.intensity = 1.0;
    //                 effectData = this.createPropGlowEffect(object.mesh, effectOptions);
    //                 break;
    //             case 'coldMagic':
    //                 // Use a special magic effect with cold colors
    //                 effectOptions.color = 0x88ccff;
    //                 effectOptions.intensity = 0.6;
    //                 effectData = this.createSimpleMagicEffect(object.mesh, effectOptions);
    //                 break;
    //             default:
    //                 // Fallback to glow effect for any unknown types
    //                 console.log(`Using fallback glow effect for unknown type: ${effectType}`);
    //                 effectData = this.createPropGlowEffect(object.mesh, effectOptions);
    //         }

    //         // Store effect data with object
    //         if (effectData) {
    //             object.effect = {
    //                 type: effectType,
    //                 data: effectData
    //             };

    //             console.log(`Applied ${effectType} effect to ${object.name}`);
    //         }
    //     } catch (error) {
    //         console.error(`Error applying ${effectType} effect:`, error);
    //     }
    // }

    /**
 * Apply shader effect to the selected object
 * @param {string} effectType - Type of effect to apply
 */
applyShaderEffect(effectType) {
    if (this.selectedObject === null) {
        console.warn('No object selected, cannot apply shader effect');
        return;
    }

    // Handle 'none' case - remove current effect
    if (effectType === 'none') {
        const object = this.objects[this.selectedObject];
        if (object.effect) {
            console.log('Removing shader effect from object');
            // Remove existing effect if any
            if (object.effect.container && object.effect.container.parent) {
                this.scene.remove(object.effect.container);
            }

            if (object.effect.light && object.effect.light.parent) {
                this.scene.remove(object.effect.light);
            }

            if (object.effect.particles && object.effect.particles.parent) {
                this.scene.remove(object.effect.particles);
            }

            // Reset emissive if it was changed
            if (object.mesh.material && object.mesh.material.emissive !== undefined &&
                object.mesh.userData.originalEmissive) {
                object.mesh.material.emissive.copy(object.mesh.userData.originalEmissive);
                if (object.mesh.userData.originalEmissiveIntensity !== undefined) {
                    object.mesh.material.emissiveIntensity = object.mesh.userData.originalEmissiveIntensity;
                }
            }

            // Clear effect data
            delete object.effect;
        }
        return;
    }

    const object = this.objects[this.selectedObject];

    try {
        // Remove existing effect if any
        if (object.effect) {
            // Remove from scene first
            if (object.effect.container && object.effect.container.parent) {
                this.scene.remove(object.effect.container);
            }

            if (object.effect.light && object.effect.light.parent) {
                this.scene.remove(object.effect.light);
            }

            if (object.effect.particles && object.effect.particles.parent) {
                this.scene.remove(object.effect.particles);
            }

            // Reset emissive if it was changed
            if (object.mesh.material && object.mesh.material.emissive !== undefined &&
                object.mesh.userData.originalEmissive) {
                object.mesh.material.emissive.copy(object.mesh.userData.originalEmissive);
                if (object.mesh.userData.originalEmissiveIntensity !== undefined) {
                    object.mesh.material.emissiveIntensity = object.mesh.userData.originalEmissiveIntensity;
                }
            }

            delete object.effect;
        }

        // Get effect options from ShaderEffectsManager if available
        let effectOptions = {
            color: 0x66ccff,
            intensity: 1.0
        };

        if (this.shaderEffects && this.shaderEffects.effectDefinitions) {
            const definition = this.shaderEffects.effectDefinitions.get(effectType);
            if (definition) {
                effectOptions = { ...effectOptions, ...definition };
            }
        }

        // Create the effect using our LOCAL implementations or ShaderEffectsManager
        let effectData;

        // First try to use ShaderEffectsManager if available
        if (this.shaderEffects && typeof this.shaderEffects.createPortalEffect === 'function' && 
            effectType === 'portalEffect') {
            effectData = this.shaderEffects.createPortalEffect(object.mesh, effectOptions);
        } else {
            // Otherwise use our own implementations
            switch (effectType) {
                case 'glow':
                    effectData = this.createPropGlowEffect(object.mesh, effectOptions);
                    break;
                case 'fire':
                    effectData = this.createSimpleFireEffect(object.mesh, effectOptions);
                    break;
                case 'magic':
                    effectData = this.createSimpleMagicEffect(object.mesh, effectOptions);
                    break;
                case 'lava':
                    // Use a special fire effect with lava colors
                    effectOptions.color = 0xff3300;
                    effectOptions.intensity = 1.3;
                    effectData = this.createSimpleFireEffect(object.mesh, effectOptions);
                    break;
                case 'holy':
                    // Use a special glow effect with holy colors
                    effectOptions.color = 0xffe599;
                    effectOptions.intensity = 1.0;
                    effectData = this.createPropGlowEffect(object.mesh, effectOptions);
                    break;
                case 'coldMagic':
                    // Use a special magic effect with cold colors
                    effectOptions.color = 0x88ccff;
                    effectOptions.intensity = 0.6;
                    effectData = this.createSimpleMagicEffect(object.mesh, effectOptions);
                    break;
                case 'portalEffect':
                    // Fallback implementation if ShaderEffectsManager isn't available
                    console.log('Using fallback portal effect implementation');
                    effectData = this.createSimplePortalEffect(object.mesh, effectOptions);
                    break;
                default:
                    // Fallback to glow effect for any unknown types
                    console.log(`Using fallback glow effect for unknown type: ${effectType}`);
                    effectData = this.createPropGlowEffect(object.mesh, effectOptions);
            }
        }

        // IMPORTANT: Make sure all containers respect the original object's orientation
        if (effectData && effectData.container) {
            // Copy rotation from the object to the effect container
            effectData.container.rotation.copy(object.mesh.rotation);
        }

        // Store effect data with object
        if (effectData) {
            object.effect = {
                type: effectType,
                data: effectData
            };

            console.log(`Applied ${effectType} effect to ${object.name}`);
        }
    } catch (error) {
        console.error(`Error applying ${effectType} effect:`, error);
    }
}

/**
 * Simple fallback portal effect implementation if ShaderEffectsManager isn't available
 */
createSimplePortalEffect(prop, options) {
    const defaults = {
        color: options.color || 0x66ccff,
        intensity: options.intensity || 1.2
    };

    // Create container for portal effect
    const container = new THREE.Group();
    container.position.copy(prop.position);
    this.scene.add(container);

    // Add portal light
    const light = new THREE.PointLight(defaults.color, defaults.intensity, 4);
    light.position.y = 0.1; // Slightly above center
    container.add(light);

    // Create simple portal ring effect
    const portalGeometry = new THREE.TorusGeometry(0.7, 0.1, 16, 32);
    const portalMaterial = new THREE.MeshStandardMaterial({
        color: defaults.color,
        emissive: defaults.color,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8
    });
    
    const portalRing = new THREE.Mesh(portalGeometry, portalMaterial);
    portalRing.rotation.x = Math.PI / 2; // Lay flat
    container.add(portalRing);

    // Create center disk
    const centerGeometry = new THREE.CircleGeometry(0.6, 32);
    const centerMaterial = new THREE.MeshBasicMaterial({
        color: defaults.color,
        transparent: true,
        opacity: 0.5
    });
    
    const centerDisk = new THREE.Mesh(centerGeometry, centerMaterial);
    centerDisk.rotation.x = Math.PI / 2; // Lay flat
    centerDisk.position.y = 0.01; // Slightly above ring
    container.add(centerDisk);

    return {
        container,
        light,
        originalObject: prop,
        portalRing,
        animationData: {
            time: 0,
            speed: 1.0
        },
        update: function(deltaTime) {
            this.animationData.time += deltaTime;
            const time = this.animationData.time;
            
            // Pulse the light
            if (light) {
                light.intensity = defaults.intensity * (0.8 + Math.sin(time * 2) * 0.2);
            }
            
            // Rotate the portal ring slowly
            if (portalRing) {
                portalRing.rotation.z = time * 0.2;
            }
        }
    };
}

    /**
     * Simple glow effect that doesn't depend on ShaderEffectsManager
     */
    createPropGlowEffect(prop, options) {
        const defaults = {
            color: options.color || 0x66ccff,
            intensity: options.intensity || 0.5
        };

        // Make prop material emit light
        if (prop.material && prop.material.emissive !== undefined) {
            // Store original emissive color
            if (!prop.userData.originalEmissive) {
                prop.userData.originalEmissive = prop.material.emissive.clone();
                prop.userData.originalEmissiveIntensity = prop.material.emissiveIntensity || 1.0;
            }

            // Apply glow effect
            prop.material.emissive = new THREE.Color(defaults.color);
            prop.material.emissiveIntensity = defaults.intensity;
        }

        // Create a point light
        const light = new THREE.PointLight(defaults.color, defaults.intensity, 2);
        light.position.copy(prop.position);
        this.scene.add(light);

        return {
            light: light,
            container: null,
            particles: null,
            originalObject: prop
        };
    }

    /**
     * Simple fire effect that works without complex ShaderEffectsManager
     */
    createSimpleFireEffect(prop, options) {
        const defaults = {
            color: options.color || 0xff6600,
            intensity: options.intensity || 1.2
        };

        // Create container for fire effect
        const container = new THREE.Group();
        container.position.copy(prop.position);
        this.scene.add(container);

        // Add fire light
        const light = new THREE.PointLight(defaults.color, defaults.intensity, 3);
        light.position.y += 0.5; // Position above object
        container.add(light);

        // Create simple particle system for fire
        const particleCount = 15;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);

        // Fire color
        const fireColor = new THREE.Color(defaults.color);

        // Create random particles in cone shape
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.2;

            particlePositions[i3] = Math.cos(angle) * radius;
            particlePositions[i3 + 1] = Math.random() * 0.5 + 0.2; // Height
            particlePositions[i3 + 2] = Math.sin(angle) * radius;

            // Colors: start yellow-orange, fade to red
            const mixFactor = Math.random();
            particleColors[i3] = fireColor.r;
            particleColors[i3 + 1] = fireColor.g * mixFactor;
            particleColors[i3 + 2] = 0;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        container.add(particles);

        // Store original positions for animation
        particles.userData = {
            positions: [...particlePositions],
            time: 0
        };

        return {
            container: container,
            light: light,
            particles: particles,
            originalObject: prop,
            animationData: {
                time: 0,
                speed: 1.0
            },
            update: function (deltaTime) {
                // Animate particles
                this.animationData.time += deltaTime;
                const time = this.animationData.time;

                // Get position data
                const positions = particles.geometry.attributes.position.array;

                // Animate each particle
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;

                    // Move up slowly
                    positions[i3 + 1] += 0.01;

                    // Reset if too high
                    if (positions[i3 + 1] > 0.8) {
                        positions[i3 + 1] = 0.2;
                    }

                    // Add some "flickering"
                    positions[i3] += (Math.random() - 0.5) * 0.01;
                    positions[i3 + 2] += (Math.random() - 0.5) * 0.01;
                }

                // Update geometry
                particles.geometry.attributes.position.needsUpdate = true;

                // Flicker the light
                light.intensity = defaults.intensity * (0.8 + Math.sin(time * 10) * 0.1 + Math.random() * 0.1);
            }
        };
    }

    /**
     * Simple magic effect that works without complex ShaderEffectsManager
     */
    createSimpleMagicEffect(prop, options) {
        const defaults = {
            color: options.color || 0x8800ff,
            intensity: options.intensity || 0.8
        };

        // Create container for magic effect
        const container = new THREE.Group();
        container.position.copy(prop.position);
        this.scene.add(container);

        // Add magic light
        const light = new THREE.PointLight(defaults.color, defaults.intensity, 3);
        light.position.y += 0.3; // Position above object
        container.add(light);

        // Create simple particle system for magic
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);

        // Magic color
        const magicColor = new THREE.Color(defaults.color);

        // Create random particles in sphere shape
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.3 + 0.1;

            particlePositions[i3] = Math.cos(angle1) * Math.sin(angle2) * radius;
            particlePositions[i3 + 1] = Math.sin(angle1) * Math.sin(angle2) * radius;
            particlePositions[i3 + 2] = Math.cos(angle2) * radius;

            // Colors
            particleColors[i3] = magicColor.r;
            particleColors[i3 + 1] = magicColor.g;
            particleColors[i3 + 2] = magicColor.b;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        container.add(particles);

        // Store original positions for animation
        particles.userData = {
            positions: [...particlePositions],
            time: 0
        };

        return {
            container: container,
            light: light,
            particles: particles,
            originalObject: prop,
            animationData: {
                time: 0,
                speed: 0.7
            },
            update: function (deltaTime) {
                // Animate particles
                this.animationData.time += deltaTime;
                const time = this.animationData.time;

                // Get position data
                const positions = particles.geometry.attributes.position.array;
                const origPositions = particles.userData.positions;

                // Animate each particle in orbital pattern
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    const angle = time + i * 0.2;

                    positions[i3] = origPositions[i3] * Math.cos(angle * 0.5);
                    positions[i3 + 1] = origPositions[i3 + 1] * Math.sin(angle * 0.5);
                    positions[i3 + 2] = origPositions[i3 + 2] * Math.cos(angle * 0.3);
                }

                // Update geometry
                particles.geometry.attributes.position.needsUpdate = true;

                // Pulse the light
                light.intensity = defaults.intensity * (0.7 + Math.sin(time * 2) * 0.3);
            }
        };
    }

    /**
     * Update all effects in the scene
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateEffects(deltaTime) {
        if (!deltaTime) return; // Skip if no deltaTime provided

        // Update object effects
        this.objects.forEach(object => {
            if (object.effect && object.effect.data) {
                // If the effect has its own update method, call it
                if (typeof object.effect.data.update === 'function') {
                    try {
                        object.effect.data.update(deltaTime);
                    } catch (error) {
                        console.warn(`Error updating effect for ${object.name}:`, error);
                    }
                }
                // Otherwise, provide basic updates for different effect types
                else if (object.effect.type) {
                    switch (object.effect.type) {
                        case 'glow':
                            this.updateGlowEffect(object, deltaTime);
                            break;
                        case 'fire':
                        case 'lava':
                            this.updateFireEffect(object, deltaTime);
                            break;
                        case 'magic':
                        case 'coldMagic':
                            this.updateMagicEffect(object, deltaTime);
                            break;
                    }
                }
            }
        });
    }

    /**
     * Update glow effect animation
     * @param {Object} object - Object with the effect
     * @param {number} deltaTime - Time since last frame
     */
    updateGlowEffect(object, deltaTime) {
        if (!object.effect || !object.effect.data || !object.effect.data.light) return;

        const light = object.effect.data.light;
        const time = Date.now() * 0.001; // Current time in seconds

        // Simple pulsing animation
        light.intensity = 0.5 + Math.sin(time * 2) * 0.2;
    }

    /**
     * Update fire effect animation
     * @param {Object} object - Object with the effect
     * @param {number} deltaTime - Time since last frame
     */
    updateFireEffect(object, deltaTime) {
        if (!object.effect || !object.effect.data) return;

        const data = object.effect.data;
        const light = data.light;
        const particles = data.particles;

        if (!light || !particles) return;

        const time = Date.now() * 0.001; // Current time in seconds

        // Flicker the light
        light.intensity = 1.2 * (0.8 + Math.sin(time * 10) * 0.1 + Math.random() * 0.1);

        // Animate particles if they have position attribute
        if (particles.geometry && particles.geometry.attributes && particles.geometry.attributes.position) {
            const positions = particles.geometry.attributes.position.array;
            const count = positions.length / 3;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;

                // Move up slowly
                positions[i3 + 1] += 0.01;

                // Reset if too high
                if (positions[i3 + 1] > 0.8) {
                    positions[i3 + 1] = 0.2;
                }

                // Add some "flickering"
                positions[i3] += (Math.random() - 0.5) * 0.01;
                positions[i3 + 2] += (Math.random() - 0.5) * 0.01;
            }

            // Update geometry
            particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Update magic effect animation
     * @param {Object} object - Object with the effect
     * @param {number} deltaTime - Time since last frame
     */
    updateMagicEffect(object, deltaTime) {
        if (!object.effect || !object.effect.data) return;

        const data = object.effect.data;
        const light = data.light;
        const particles = data.particles;

        if (!light || !particles) return;

        const time = Date.now() * 0.001; // Current time in seconds

        // Pulse the light
        light.intensity = 0.8 * (0.7 + Math.sin(time * 2) * 0.3);

        // Animate particles if they have position attribute
        if (particles.geometry && particles.geometry.attributes && particles.geometry.attributes.position) {
            const positions = particles.geometry.attributes.position.array;
            const count = positions.length / 3;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;

                // Orbital motion around original position
                const angle = time + i * 0.2;
                const radius = 0.05;

                positions[i3] += Math.cos(angle) * radius * deltaTime;
                positions[i3 + 1] += Math.sin(angle) * radius * deltaTime;
                positions[i3 + 2] += Math.cos(angle * 0.7) * radius * deltaTime;

                // Keep particles from drifting too far
                if (Math.abs(positions[i3]) > 0.4) positions[i3] *= 0.95;
                if (Math.abs(positions[i3 + 1]) > 0.4) positions[i3 + 1] *= 0.95;
                if (Math.abs(positions[i3 + 2]) > 0.4) positions[i3 + 2] *= 0.95;
            }

            // Update geometry
            particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Clean up all shader effects
     */
    cleanupAllShaderEffects() {
        if (!this.scene) return;

        // 1. Clean up known effects associated with objects
        this.objects.forEach(obj => {
            if (obj.effect && obj.effect.data) {
                if (obj.effect.data.container && obj.effect.data.container.parent) {
                    this.scene.remove(obj.effect.data.container);
                }

                // Remove lights and particles if they're not part of container
                if (obj.effect.data.light &&
                    (!obj.effect.data.container || obj.effect.data.light.parent !== obj.effect.data.container)) {
                    this.scene.remove(obj.effect.data.light);
                }

                if (obj.effect.data.particles &&
                    (!obj.effect.data.container || obj.effect.data.particles.parent !== obj.effect.data.container)) {
                    this.scene.remove(obj.effect.data.particles);
                }
            }
        });

        // 2. Clean up "orphaned" effects by checking scene children
        const itemsToRemove = [];

        this.scene.traverse(object => {
            // Look for typical effect objects
            if (object.type === 'PointLight' ||
                object.type === 'Points' ||
                (object.type === 'Group' && object.name === '') || // Container groups are usually unnamed
                (object.userData && object.userData.isShaderEffect)) {

                // Check if this is an "orphaned" effect (not a child of a mesh in objects array)
                let isOrphaned = true;
                this.objects.forEach(obj => {
                    if (obj.mesh === object ||
                        (obj.effect &&
                            (obj.effect.data.light === object ||
                                obj.effect.data.particles === object ||
                                obj.effect.data.container === object))) {
                        isOrphaned = false;
                    }
                });

                if (isOrphaned) {
                    itemsToRemove.push(object);
                }
            }
        });

        // Remove all orphaned effects
        itemsToRemove.forEach(item => {
            this.scene.remove(item);

            // Dispose of any materials and geometries
            if (item.material) item.material.dispose();
            if (item.geometry) item.geometry.dispose();
        });

        if (itemsToRemove.length > 0) {
            console.log(`Cleaned up ${itemsToRemove.length} orphaned shader effects`);
        }
    }

    /**
     * Dispose of resources
     */
    dispose() {
        // Clean up resources
        this.cleanupAllShaderEffects();

        // Dispose geometries and materials
        this.objects.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            if (obj.mesh && obj.mesh.parent) {
                obj.mesh.parent.remove(obj.mesh);
            }
        });

        // Clear references
        this.objects = [];
        this.scene = null;
        this.resourceManager = null;
        this.shaderEffects = null;

        console.log("ShapeForgeParser resources disposed");
    }
}

// Make parser globally available
window.ShapeForgeParser = ShapeForgeParser;