class ShapeForgeParser {
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

        // Core properties
        this.objects = [];

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
        console.log('ShapeForgeParser initialized with:', {
            hasScene: !!scene,
            hasResourceManager: !!resourceManager,
            hasShapeForge: !!this.shapeForge,
            hasShaderEffects: !!this.shaderEffects
        });
    }



    /**
     * Check and load necessary dependencies
     */
    checkDependencies() {
        console.log("ShapeForge checking dependencies...");

        // Check if THREE.js is available
        if (!window.THREE) {
            console.error("THREE.js not available! ShapeForgeParser requires THREE.js to function.");
            return false;
        }

        // Try to get ResourceManager from window if not provided
        if (!this.resourceManager && window.resourceManager) {
            this.resourceManager = window.resourceManager;
            console.log("Using global ResourceManager");
        }

        // Try to get ShaderEffectsManager from window if not provided
        if (!this.shaderEffectsManager && window.shaderEffectsManager) {
            this.shaderEffectsManager = window.shaderEffectsManager;
            console.log("Using global ShaderEffectsManager");
        }

        return true;
    }

    newProject() {
        // Confirm with user if there are existing objects

        this.cleanupAllShaderEffects();

        // Clear all objects
        this.objects.forEach(obj => {
            if (obj.mesh && obj.mesh.parent) {
                obj.mesh.parent.remove(obj.mesh);
            }
        });

        this.objects = [];
        this.selectedObject = null;
        this.history = [];
        this.historyIndex = -1;

        console.log('Created new project from Parser');
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

    loadProjectFromJson(jsonData) {
        // Validate project data
        if (!jsonData || !jsonData.objects || !Array.isArray(jsonData.objects)) {
            throw new Error('Invalid project data');
        }

        console.log('JsonData:', jsonData);

        console.log("Loading project using Parser loadProjectFromJson w/ texture");

        this.cleanupAllShaderEffects();
        // Clear current project
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


        console.log(`Project loaded with ${this.objects.length} objects and ${objectsNeedingTextures.length} textures`);

        setTimeout(() => {
            this.objects.forEach((obj, index) => {
                if (obj.pendingEffect) {
                    this.selectObject(index);
                    this.applyShaderEffect(obj.pendingEffect);
                    delete obj.pendingEffect;
                }
            });
        }, 500);

        return true;
    };

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
                    geometry = new THREE.CylinderGeometry(0, 0.5, 1, 5, 1);
                    const vertices = geometry.attributes.position.array;
                    for (let i = 0; i < vertices.length; i += 3) {
                        if (vertices[i + 1] < 0) {
                            vertices[i] *= 0.6;
                            vertices[i + 2] *= 0.6;
                        }
                    }
                    geometry.attributes.position.needsUpdate = true;
                    break;
                default:
                    console.warn(`Unknown geometry type: ${objData.type}`);
                    return;
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

        // Check for texture data - do this AFTER the object is added to the scene
        console.log("Checking for texture data:",
            !!objData.material,
            !!objData.material?.texture,
            !!objData.material?.texture?.data?.substring(0, 30)
        );

        if (objData.material && objData.material.texture && objData.material.texture.data) {
            console.log("Found texture data for", objData.name, "- attempting to load...");
            this.loadAndApplyTextureToObject(objectData, objData.material.texture);
        } else {
            console.log("No texture data for", objData.name);
        }

        // mesh.userData.shapeforgeObjectData = {
        //   id: objData.id,
        //   type: objData.type
        // };


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
     * Apply shader effect (completely self-contained version)
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

            if (this.shaderEffectsManager && this.shaderEffectsManager.effectDefinitions) {
                const definition = this.shaderEffectsManager.effectDefinitions.get(effectType);
                if (definition) {
                    effectOptions = { ...effectOptions, ...definition };
                }
            }

            // Create the effect using our LOCAL implementations only - NEVER try to use ShaderEffectsManager methods
            let effectData;

            // Use correct method based on effect type
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
                default:
                    // Fallback to glow effect for any unknown types
                    console.log(`Using fallback glow effect for unknown type: ${effectType}`);
                    effectData = this.createPropGlowEffect(object.mesh, effectOptions);
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
    };

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
    };

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
    };

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
    };

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
    };

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
    };

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
    };

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
    };

    /**
     * Update a shader effect property
     * @param {string} property - Property name
     * @param {any} value - New property value
     */
    updateEffectProperty(property, value) {
        if (this.selectedObject === null ||
            !this.objects[this.selectedObject].effect ||
            !this.shaderEffectsManager) return;

        const obj = this.objects[this.selectedObject];
        const effectType = obj.effect.type;

        // Update the effect data
        const definition = this.shaderEffectsManager.effectDefinitions.get(effectType);
        if (!definition) return;

        // Update definition property
        definition[property] = value;

        // Re-apply the effect
        this.applyShaderEffect(effectType);

        console.log(`Updated effect ${effectType} property ${property} to:`, value);
    };

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
    };

    selectObject(index) {
        if (index < 0 || index >= this.objects.length) return;
        this.selectedObject = index;
        return this.objects[index];
    }


    dispose() {
        // Clean up resources
        this.cleanupAllShaderEffects();

        // Clear references
        this.objects = [];
        this.scene = null;
        this.resourceManager = null;
        this.shaderEffects = null;

        console.log("ShapeForgeParser resources disposed");
    }

    // from here own down idk if we need or not, so including just in case.
    // these may be formatted wrong, again, not sure.

    createObjectFromJson(objData) {
        let geometry;

        // Handle merged objects specially
        if (objData.type === 'merged' && objData.geometryData) {
            // Create a new BufferGeometry
            geometry = new THREE.BufferGeometry();

            const geometryData = objData.geometryData;

            // Add vertex positions
            if (geometryData.vertices && geometryData.vertices.length > 0) {
                geometry.setAttribute('position',
                    new THREE.Float32BufferAttribute(geometryData.vertices, 3));
            }

            // Add normals
            if (geometryData.normals && geometryData.normals.length > 0) {
                geometry.setAttribute('normal',
                    new THREE.Float32BufferAttribute(geometryData.normals, 3));
            }

            // Add UVs
            if (geometryData.uvs && geometryData.uvs.length > 0) {
                geometry.setAttribute('uv',
                    new THREE.Float32BufferAttribute(geometryData.uvs, 2));
            }

            // Add indices
            if (geometryData.indices && geometryData.indices.length > 0) {
                geometry.setIndex(geometryData.indices);
            }

            // Compute normals if missing
            if (!geometryData.normals || geometryData.normals.length === 0) {
                geometry.computeVertexNormals();
            }
        } else {
            // Create geometry based on type (existing code for primitives)
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
                case 'd10':
                    // Use PolyhedronGeometry for D10
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

                // new shapes
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

        // Create material
        let material;
        if (objData.material) {
            const materialData = objData.material;
            const color = materialData.color !== undefined ? materialData.color : 0x3388ff;

            // Create material based on type
            switch (materialData.type) {
                case 'MeshBasicMaterial':
                    material = new THREE.MeshBasicMaterial({ color });
                    break;
                case 'MeshStandardMaterial':
                    material = new THREE.MeshStandardMaterial({
                        color,
                        roughness: materialData.roughness !== undefined ? materialData.roughness : 0.5,
                        metalness: materialData.metalness !== undefined ? materialData.metalness : 0
                    });
                    break;
                case 'MeshPhongMaterial':
                    material = new THREE.MeshPhongMaterial({ color });
                    break;
                case 'MeshLambertMaterial':
                    material = new THREE.MeshLambertMaterial({ color });
                    break;
                default:
                    material = new THREE.MeshStandardMaterial({ color });
            }

            // Set common properties
            if (materialData.wireframe) material.wireframe = true;
            if (materialData.transparent) material.transparent = true;
            if (materialData.opacity !== undefined) material.opacity = materialData.opacity;

            // For merged objects, use DoubleSide to prevent culling issues
            if (objData.type === 'merged') {
                material.side = THREE.DoubleSide;
            }
        } else {
            // Default material
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

        // Create object data
        const objectData = {
            type: objData.type,
            name: objData.name || `${objData.type} ${this.objects.length + 1}`,
            geometry: geometry,
            material: material,
            mesh: mesh,
            parameters: objData.parameters || {},
            position: objData.position || { x: 0, y: 0, z: 0 },
            rotation: objData.rotation || { x: 0, y: 0, z: 0 },
            scale: objData.scale || { x: 1, y: 1, z: 1 }
        };

        // Add to scene
        this.scene.add(mesh);

        // Add to objects array
        this.objects.push(objectData);

        // Store effect data for later application
        if (objData.effect) {
            objectData.pendingEffect = objData.effect;
        }

        return objectData;
    };

    /**
     * Apply any pending effects after project load
     */
    applyPendingEffects() {
        console.log(`Applying effects to ${this.objects.length} objects`);

        this.objects.forEach((obj, index) => {
            if (obj.pendingEffect) {
                console.log(`Applying ${typeof obj.pendingEffect === 'string' ? obj.pendingEffect : obj.pendingEffect.type} effect to ${obj.name}`);

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
    };

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

            case 'holy': // added in, unsure if needed here
            case 'glow':
                // Apply glow-specific parameters
                break;

            case 'magic':
            case 'coldMagic':
                // Apply magic-specific parameters
                break;
        }
    };






}

// Make parser globally available
window.ShapeForgeParser = ShapeForgeParser;