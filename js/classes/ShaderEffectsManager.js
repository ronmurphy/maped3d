/**
 * ShaderEffectsManager handles special visual effects throughout the scene
 * Supports both prop-based effects and area/zone effects
 */
class ShaderEffectsManager {
  /**
   * Create a new ShaderEffectsManager
   * @param {Scene3DController} scene3D - Reference to the main scene controller
   */
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.effects = new Map(); // Maps object ID to its effects
    this.effectDefinitions = new Map(); // Maps effect type to its definition
    this.zoneEffects = new Map(); // For area/zone effects
    this.enabled = true; // Global toggle
    this.qualityLevel = 'medium'; // performance setting (low, medium, high)
    this.debug = false;
    
    // Register built-in effects
    this.registerEffectDefinitions();
  }
  
  /**
   * Register all available effect definitions
   */
  registerEffectDefinitions() {
    // Light sources with particles
    this.registerEffectType('fire', {
      keywords: ['fire', 'torch', 'flame', 'candle', 'lantern', 'campfire'],
      color: 0xff6600,
      intensity: 1.5, 
      distance: 8,
      decay: 2,
      particleCount: 20,
      particleSize: 0.05,
      particleColor: 0xff8844,
      animationSpeed: 1.0,
      create: this.createFireEffect.bind(this)
    });
    
    this.registerEffectType('magic', {
      keywords: ['crystal', 'gem', 'magic', 'arcane', 'rune', 'glow'],
      color: 0x66ccff,
      intensity: 1.2,
      distance: 6,
      decay: 1.5,
      particleCount: 15,
      particleSize: 0.03,
      particleColor: 0x88ccff,
      animationSpeed: 0.7,
      create: this.createMagicEffect.bind(this)
    });
    
    this.registerEffectType('lava', {
      keywords: ['lava', 'magma', 'ember'],
      color: 0xff3300,
      intensity: 1.3,
      distance: 7,
      decay: 2,
      particleCount: 25,
      particleSize: 0.04,
      particleColor: 0xff5500,
      animationSpeed: 0.8,
      create: this.createLavaEffect.bind(this)
    });
    
    this.registerEffectType('holy', {
      keywords: ['radiant', 'holy', 'divine', 'sacred', 'blessed'],
      color: 0xffe599,
      intensity: 1.2,
      distance: 6,
      decay: 1.5,
      particleCount: 15,
      particleSize: 0.04,
      particleColor: 0xffffaa,
      animationSpeed: 0.5,
      create: this.createHolyEffect.bind(this)
    });
    
    // Area effects
    this.registerEffectType('water', {
      keywords: ['water', 'ocean', 'sea', 'lake', 'pond', 'river', 'stream', 'shoreline'],
      create: this.createWaterEffect.bind(this),
      isAreaEffect: true,
      low: {
        waveHeight: 0.05,
        waveSpeed: 0.5,
        detailLevel: 1
      },
      medium: {
        waveHeight: 0.1,
        waveSpeed: 1.0,
        detailLevel: 2
      },
      high: {
        waveHeight: 0.2,
        waveSpeed: 1.5,
        detailLevel: 3
      }
    });
    
    this.registerEffectType('fog', {
      keywords: ['fog', 'mist', 'haze', 'smoke'],
      create: this.createFogEffect.bind(this),
      isAreaEffect: true,
      color: 0xcccccc,
      density: 0.03,
      low: { particleCount: 50 },
      medium: { particleCount: 100 },
      high: { particleCount: 200 }
    });
    
    // Add more effect types as needed
  }
  
  /**
   * Register a new effect type
   * @param {string} type - Effect type identifier
   * @param {Object} definition - Effect definition object
   */
  registerEffectType(type, definition) {
    this.effectDefinitions.set(type, definition);
    if (this.debug) {
      console.log(`Registered effect type: ${type} with keywords:`, definition.keywords);
    }
  }
  
  /**
   * Set quality level for all effects
   * @param {string} level - 'low', 'medium', or 'high'
   */
  setQualityLevel(level) {
    if (['low', 'medium', 'high'].includes(level)) {
      this.qualityLevel = level;
      console.log(`Set shader effects quality to ${level}`);
      
      // Update existing effects
      this.effects.forEach((effectData, objectId) => {
        this.updateEffectQuality(objectId, effectData);
      });
      
      // Update zone effects
      this.zoneEffects.forEach((effectData, zoneId) => {
        this.updateEffectQuality(zoneId, effectData, true);
      });
    }
  }
  
  /**
   * Enable or disable all effects
   * @param {boolean} enabled - Whether effects should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // Toggle visibility of all effects
    this.effects.forEach((effectData) => {
      if (effectData.container) {
        effectData.container.visible = enabled;
      }
      if (effectData.light) {
        effectData.light.visible = enabled;
      }
    });
    
    this.zoneEffects.forEach((effectData) => {
      if (effectData.mesh) {
        effectData.mesh.visible = enabled;
      }
    });
    
    console.log(`Shader effects ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Process a new object and apply effects if needed
   * @param {Object3D} object - Object to process
   * @returns {boolean} - Whether an effect was applied
   */
  processObject(object) {
    if (!this.enabled || !object || !object.userData) return false;
    
    // Check if it's a prop
    const isProp = object.userData.type === 'prop';
    const name = object.userData.name || '';
    
    if (!name) return false;
    
    // Check which effect applies to this object
    const effectType = this.getEffectTypeForName(name);
    if (!effectType) return false;
    
    // Create and apply the effect
    return this.applyEffect(object, effectType);
  }
  
  /**
   * Find what effect type applies to a given name
   * @param {string} name - Name to check for keywords
   * @returns {string|null} - Effect type or null if no match
   */
  getEffectTypeForName(name) {
    const lowerName = name.toLowerCase();
    
    for (const [type, definition] of this.effectDefinitions) {
      if (definition.keywords && definition.keywords.some(keyword => lowerName.includes(keyword))) {
        return type;
      }
    }
    
    return null;
  }
  
  /**
   * Apply an effect to an object
   * @param {Object3D} object - Object to apply effect to
   * @param {string} effectType - Type of effect to apply
   * @returns {boolean} - Whether the effect was successfully applied
   */
  applyEffect(object, effectType) {
    if (this.effects.has(object.id)) {
      // Effect already applied
      return false;
    }
    
    const definition = this.effectDefinitions.get(effectType);
    if (!definition || !definition.create) {
      console.warn(`No definition or creator for effect type: ${effectType}`);
      return false;
    }
    
    try {
      // Call the create function from the definition
      const effectData = definition.create(object, definition, this.qualityLevel);
      
      if (!effectData) return false;
      
      // Store the effect data
      this.effects.set(object.id, {
        object,
        type: effectType,
        ...effectData
      });
      
      if (this.debug) {
        console.log(`Applied ${effectType} effect to object:`, object.userData.name);
      }
      
      return true;
    } catch (error) {
      console.error(`Error applying ${effectType} effect:`, error);
      return false;
    }
  }
  
  /**
   * Create a water effect for a surface area
   * @param {Object3D} object - The object representing the water surface
   * @param {Object} definition - The effect definition
   * @param {string} qualityLevel - Current quality setting
   * @returns {Object} Effect data
   */
  createWaterEffect(object, definition, qualityLevel = 'medium') {
    const settings = definition[qualityLevel] || definition.medium;

    // Create water shader material
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x0066aa) },
        waveHeight: { value: settings.waveHeight },
        waveSpeed: { value: settings.waveSpeed }
      },
      vertexShader: `
        uniform float time;
        uniform float waveHeight;
        uniform float waveSpeed;
        
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          
          // Create wave effect
          float wave = sin(position.x * 2.0 + time * waveSpeed) * 
                      cos(position.z * 2.0 + time * waveSpeed * 0.8);
                      
          // Apply wave only near edges for shoreline effect
          float edgeFactor = 1.0 - smoothstep(0.0, 0.4, abs(uv.y - 0.5) * 2.0);
          
          // Move vertices up/down based on wave
          vec3 newPosition = position;
          newPosition.y += wave * waveHeight * edgeFactor;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float time;
        
        varying vec2 vUv;
        
        void main() {
          // Basic water color
          vec3 waterColor = color;
          
          // Add some variation based on waves
          float foam = smoothstep(0.4, 0.5, sin(vUv.x * 20.0 + time) * 0.5 + 0.5);
          
          // Edge detection for shore foam
          float edge = smoothstep(0.0, 0.2, abs(vUv.y - 0.5) * 2.0);
          foam *= (1.0 - edge) * 0.5;
          
          // Combine water color with foam
          vec3 finalColor = mix(waterColor, vec3(1.0), foam);
          
          // Add transparency
          float alpha = mix(0.7, 0.9, edge);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    // Use the object's existing geometry
    const existingMaterial = object.material;
    object.material = waterMaterial;
    
    // Store original material for cleanup
    const effectData = {
      originalMaterial: existingMaterial,
      material: waterMaterial
    };
    
    return effectData;
  }
  
  /**
   * Create a fog effect for an area
   * @param {Object3D} object - The object marking the fog area
   * @param {Object} definition - The effect definition
   * @param {string} qualityLevel - Current quality setting
   * @returns {Object} Effect data
   */
  createFogEffect(object, definition, qualityLevel = 'medium') {
    const settings = definition[qualityLevel] || definition.medium;
    
    // Calculate bounds from object
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    
    // Create particle system for volumetric fog
    const particleCount = settings.particleCount;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    // Distribute particles in the volume
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      particlePositions[i3] = center.x + (Math.random() - 0.5) * size.x;
      particlePositions[i3 + 1] = center.y + (Math.random() - 0.5) * size.y * 0.5;
      particlePositions[i3 + 2] = center.z + (Math.random() - 0.5) * size.z;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    // Create fog material
    const particleMaterial = new THREE.PointsMaterial({
      color: definition.color || 0xcccccc,
      size: 0.5,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    
    // Hide the original object
    object.visible = false;
    
    // Add particles to scene
    this.scene3D.scene.add(particles);
    
    return {
      particles,
      originalObject: object,
      animationData: {
        time: 0
      }
    };
  }
  
  /**
   * Create a fire effect for an object
   * @param {Object3D} object - Object to add effect to
   * @param {Object} definition - Effect definition
   * @param {string} qualityLevel - Quality level
   * @returns {Object} Effect data
   */
  createFireEffect(object, definition, qualityLevel = 'medium') {
    // Create container for effects
    const container = new THREE.Group();
    container.position.copy(object.position);
    
    // Add to scene
    this.scene3D.scene.add(container);
    
    // Create light
    const particleCount = this.getQualityAdjustedValue(definition.particleCount, qualityLevel);
    const light = new THREE.PointLight(
      definition.color,
      definition.intensity,
      definition.distance,
      definition.decay
    );
    
    // Position light slightly above object
    light.position.y += 0.5;
    container.add(light);
    
    // Create fire particles
    const particles = this.createParticles(
      particleCount, 
      definition.particleSize,
      definition.particleColor
    );
    
    container.add(particles);
    
    // Return data for tracking
    return {
      container,
      light,
      particles,
      originalObject: object,
      definition,
      animationData: {
        time: 0,
        speed: definition.animationSpeed
      }
    };
  }
  
  /**
   * Create a magic effect for an object
   * @param {Object3D} object - Object to add effect to
   * @param {Object} definition - Effect definition
   * @param {string} qualityLevel - Quality level
   * @returns {Object} Effect data
   */
  createMagicEffect(object, definition, qualityLevel = 'medium') {
    // Similar to fire effect but with different animation pattern
    const container = new THREE.Group();
    container.position.copy(object.position);
    
    this.scene3D.scene.add(container);
    
    const particleCount = this.getQualityAdjustedValue(definition.particleCount, qualityLevel);
    const light = new THREE.PointLight(
      definition.color,
      definition.intensity,
      definition.distance,
      definition.decay
    );
    
    light.position.y += 0.3;
    container.add(light);
    
    const particles = this.createParticles(
      particleCount, 
      definition.particleSize,
      definition.particleColor
    );
    
    container.add(particles);
    
    return {
      container,
      light,
      particles,
      originalObject: object,
      definition,
      animationData: {
        time: 0,
        speed: definition.animationSpeed,
        pattern: 'orbit' // Different animation pattern
      }
    };
  }
  
  /**
   * Create a lava effect
   * @param {Object3D} object - Object to add effect to
   * @param {Object} definition - Effect definition
   * @param {string} qualityLevel - Quality level
   * @returns {Object} Effect data
   */
  createLavaEffect(object, definition, qualityLevel = 'medium') {
    // Similar structure to fire but with different particles and animation
    const container = new THREE.Group();
    container.position.copy(object.position);
    
    this.scene3D.scene.add(container);
    
    const particleCount = this.getQualityAdjustedValue(definition.particleCount, qualityLevel);
    const light = new THREE.PointLight(
      definition.color,
      definition.intensity,
      definition.distance,
      definition.decay
    );
    
    // Lava light positioned lower than fire
    light.position.y += 0.2;
    container.add(light);
    
    const particles = this.createParticles(
      particleCount, 
      definition.particleSize,
      definition.particleColor,
      true // Slower particles for lava
    );
    
    container.add(particles);
    
    return {
      container,
      light,
      particles,
      originalObject: object,
      definition,
      animationData: {
        time: 0,
        speed: definition.animationSpeed * 0.5 // Slower animation
      }
    };
  }
  
  /**
   * Create a holy/radiant effect
   * @param {Object3D} object - Object to add effect to
   * @param {Object} definition - Effect definition
   * @param {string} qualityLevel - Quality level
   * @returns {Object} Effect data
   */
  createHolyEffect(object, definition, qualityLevel = 'medium') {
    const container = new THREE.Group();
    container.position.copy(object.position);
    
    this.scene3D.scene.add(container);
    
    const particleCount = this.getQualityAdjustedValue(definition.particleCount, qualityLevel);
    const light = new THREE.PointLight(
      definition.color,
      definition.intensity,
      definition.distance,
      definition.decay
    );
    
    // Position light
    light.position.y += 0.4;
    container.add(light);
    
    // Holy particles with wider spread
    const particles = this.createParticles(
      particleCount, 
      definition.particleSize,
      definition.particleColor,
      false,
      0.8 // Wider spread
    );
    
    container.add(particles);
    
    return {
      container,
      light,
      particles,
      originalObject: object,
      definition,
      animationData: {
        time: 0,
        speed: definition.animationSpeed,
        pattern: 'pulse' // Pulse pattern
      }
    };
  }
  
  /**
   * Helper to create particles
   * @param {number} count - Number of particles
   * @param {number} size - Particle size
   * @param {number} color - Particle color
   * @param {boolean} slow - Whether particles should move slowly
   * @param {number} spread - Particle spread factor
   * @returns {Points} Particle system
   */
  createParticles(count, size, color, slow = false, spread = 0.3) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    // Convert hex color to RGB
    const particleColor = new THREE.Color(color);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Randomize positions in a small area
      const radius = Math.random() * spread;
      const angle = Math.random() * Math.PI * 2;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.random() * 0.5; // Height
      positions[i3 + 2] = Math.sin(angle) * radius;
      
      // Randomize colors slightly
      colors[i3] = particleColor.r * (0.9 + Math.random() * 0.2);
      colors[i3 + 1] = particleColor.g * (0.9 + Math.random() * 0.2);
      colors[i3 + 2] = particleColor.b * (0.9 + Math.random() * 0.2);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create particle material
    const material = new THREE.PointsMaterial({
      size: size, 
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    // Create and return particle system
    const particles = new THREE.Points(geometry, material);
    
    // Add custom properties for animation
    particles.userData.positions = positions.slice(); // Store original positions
    particles.userData.slow = slow;
    
    return particles;
  }
  
  /**
   * Remove effect from an object
   * @param {string} objectId - ID of object to remove effect from
   * @returns {boolean} - Whether removal was successful
   */
  removeEffect(objectId) {
    const effectData = this.effects.get(objectId);
    if (!effectData) return false;
    
    try {
      // Remove container and all children
      if (effectData.container) {
        this.scene3D.scene.remove(effectData.container);
      }
      
      // Or remove individual components
      if (effectData.light && !effectData.container) {
        this.scene3D.scene.remove(effectData.light);
      }
      
      if (effectData.particles && !effectData.container) {
        this.scene3D.scene.remove(effectData.particles);
      }
      
      // Clean up materials
      if (effectData.material) {
        effectData.material.dispose();
        
        // Restore original material if available
        if (effectData.originalObject && effectData.originalMaterial) {
          effectData.originalObject.material = effectData.originalMaterial;
        }
      }
      
      // Remove from tracking
      this.effects.delete(objectId);
      
      if (this.debug) {
        console.log(`Removed effect from object ${objectId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error removing effect:', error);
      return false;
    }
  }
  
  /**
   * Add a water effect zone (special case for large areas)
   * @param {Object} areaData - Data describing the area
   * @param {number} areaData.x - X position
   * @param {number} areaData.z - Z position
   * @param {number} areaData.width - Width of area
   * @param {number} areaData.depth - Depth of area
   * @param {string} areaData.type - Effect type ('water', 'fog', etc)
   * @returns {string} - ID of the created zone effect
   */
  addWaterZone(areaData) {
    const { x, z, width, depth, type = 'water' } = areaData;
    const zoneId = `zone-${Date.now()}`;
    
    // Create a plane for the water surface
    const geometry = new THREE.PlaneGeometry(width, depth, 32, 16);
    
    // Rotate to horizontal position
    geometry.rotateX(-Math.PI / 2);
    
    // Create initial basic material
    const material = new THREE.MeshBasicMaterial({
      color: 0x0066aa,
      transparent: true,
      opacity: 0.6
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, areaData.y || 0.1, z); // Slight elevation
    
    // Add to scene
    this.scene3D.scene.add(mesh);
    
    // Get effect definition
    const definition = this.effectDefinitions.get(type);
    if (!definition) {
      console.warn(`No definition for zone effect type: ${type}`);
      return zoneId;
    }
    
    // Apply the effect
    const effectData = definition.create(mesh, definition, this.qualityLevel);
    
    // Store for tracking
    this.zoneEffects.set(zoneId, {
      mesh,
      type,
      ...effectData,
      areaData
    });
    
    if (this.debug) {
      console.log(`Created ${type} zone effect at (${x}, ${z})`);
    }
    
    return zoneId;
  }
  
  /**
   * Update effects quality based on performance
   * @param {string} objectId - ID of object to update
   * @param {Object} effectData - Effect data
   * @param {boolean} isZone - Whether this is a zone effect
   */
  updateEffectQuality(objectId, effectData, isZone = false) {
    // Skip if no definition available
    if (!effectData.type) return;
    
    const definition = this.effectDefinitions.get(effectData.type);
    if (!definition) return;
    
    // Different handling for different effect types
    if (effectData.particles) {
      // Update particle count
      const newCount = this.getQualityAdjustedValue(
        definition.particleCount, 
        this.qualityLevel
      );
      
      // Only recreate if significant difference
      if (Math.abs(effectData.particles.geometry.attributes.position.count - newCount) > 3) {
        // Remove old particles
        if (effectData.container) {
          effectData.container.remove(effectData.particles);
        } else {
          this.scene3D.scene.remove(effectData.particles);
        }
        
        // Create new particles
        const newParticles = this.createParticles(
          newCount,
          definition.particleSize,
          definition.particleColor,
          effectData.particles.userData.slow
        );
        
        // Add to container
        if (effectData.container) {
          effectData.container.add(newParticles);
        } else {
          this.scene3D.scene.add(newParticles);
        }
        
        // Update reference
        effectData.particles = newParticles;
      }
    }
    
    // Update shader parameters if applicable
    if (effectData.material && effectData.material.isShaderMaterial) {
      const settings = definition[this.qualityLevel] || definition.medium;
      
      // Update uniforms based on effect type
      if (effectData.type === 'water' && effectData.material.uniforms) {
        effectData.material.uniforms.waveHeight.value = settings.waveHeight;
        effectData.material.uniforms.waveSpeed.value = settings.waveSpeed;
      }
    }
  }
  
  /**
   * Scale a value based on quality level
   * @param {number} baseValue - Base value at medium quality
   * @param {string} qualityLevel - Current quality level
   * @returns {number} - Adjusted value
   */
  getQualityAdjustedValue(baseValue, qualityLevel) {
    switch (qualityLevel) {
      case 'low':
        return Math.floor(baseValue * 0.5);
      case 'high':
        return Math.ceil(baseValue * 1.5);
      case 'medium':
      default:
        return baseValue;
    }
  }
  
  /**
   * Update all effects - call in animation loop
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.enabled) return;
    
    // Update all standard effects
    this.effects.forEach((effectData, objectId) => {
      this.updateEffect(effectData, deltaTime);
    });
    
    // Update zone effects
    this.zoneEffects.forEach((effectData, zoneId) => {
      this.updateZoneEffect(effectData, deltaTime);
    });
  }
  
  /**
   * Update a specific effect
   * @param {Object} effectData - Effect data
   * @param {number} deltaTime - Time since last frame
   */
  updateEffect(effectData, deltaTime) {
    if (!effectData.animationData) return;
    
    // Update animation time
    effectData.animationData.time += deltaTime * (effectData.animationData.speed || 1.0);
    
    // Animate particles if present
    if (effectData.particles) {
      const positions = effectData.particles.geometry.attributes.position.array;
      const originalPositions = effectData.particles.userData.positions;
      const count = positions.length / 3;
      const time = effectData.animationData.time;
      const pattern = effectData.animationData.pattern || 'default';
      
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Apply different animation patterns
        switch (pattern) {
          case 'orbit':
            // Orbital pattern around center
            const angle = time + i * 0.1;
            const radius = 0.2 + Math.sin(time * 0.5 + i) * 0.1;
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = originalPositions[i3 + 1] + Math.sin(time * 0.7 + i * 0.3) * 0.1;
            positions[i3 + 2] = Math.sin(angle) * radius;
            break;
            
          case 'pulse':
            // Pulsing pattern
            const pulseRadius = (0.2 + Math.sin(time * 0.8) * 0.15) * (1 + i % 3 * 0.1);
            const pulseAngle = originalPositions[i3 + 2] * 10 + time;
            positions[i3] = Math.cos(pulseAngle) * pulseRadius;
            positions[i3 + 1] = originalPositions[i3 + 1] + Math.sin(time + i) * 0.05;
            positions[i3 + 2] = Math.sin(pulseAngle) * pulseRadius;
            break;
            
          default:
            // Default fire-like movement
            positions[i3] = originalPositions[i3] + Math.sin(time * 2 + i) * 0.03;
            positions[i3 + 1] = originalPositions[i3 + 1] + Math.sin(time * 3 + i * 2) * 0.05;
            positions[i3 + 2] = originalPositions[i3 + 2] + Math.cos(time * 2 + i) * 0.03;
            break;
        }
      }
      
      // Update geometry
      effectData.particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate light flickering if applicable
    if (effectData.light) {
      // Apply subtle flicker to light intensity
      const originalIntensity = effectData.definition.intensity;
      effectData.light.intensity = originalIntensity * (0.9 + Math.sin(effectData.animationData.time * 5) * 0.1);
    }
  }
  
  /**
   * Update a zone effect
   * @param {Object} effectData - Zone effect data
   * @param {number} deltaTime - Time since last frame
   */
  updateZoneEffect(effectData, deltaTime) {
    // Update water shader uniforms
    if (effectData.type === 'water' && effectData.material && effectData.material.uniforms) {
      effectData.material.uniforms.time.value += deltaTime;
    }
    
    // Update fog particles
    if (effectData.type === 'fog' && effectData.particles) {
      const positions = effectData.particles.geometry.attributes.position.array;
      const count = positions.length / 3;
      
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Slight drift movement
        positions[i3] += (Math.random() - 0.5) * 0.01;
        positions[i3 + 1] += (Math.random() - 0.5) * 0.005;
        positions[i3 + 2] += (Math.random() - 0.5) * 0.01;
        
        // Keep within bounds
        const bounds = effectData.areaData;
        const halfWidth = bounds.width * 0.5;
        const halfDepth = bounds.depth * 0.5;
        
        if (Math.abs(positions[i3] - bounds.x) > halfWidth) {
          positions[i3] = bounds.x + (Math.random() - 0.5) * bounds.width;
        }
        
        if (Math.abs(positions[i3 + 2] - bounds.z) > halfDepth) {
          positions[i3 + 2] = bounds.z + (Math.random() - 0.5) * bounds.depth;
        }
      }
      
      effectData.particles.geometry.attributes.position.needsUpdate = true;
    }
  }
  
  /**
   * Scan the scene for objects that might need effects
   */
  scanScene() {
    if (!this.scene3D || !this.scene3D.scene) return;
    
    console.log('Scanning scene for potential effect objects...');
    
    let effectsAdded = 0;
    
    // Process all scene objects
    this.scene3D.scene.traverse(object => {
      // Only process objects with userData and names
      if (object.userData && object.userData.name) {
        if (this.processObject(object)) {
          effectsAdded++;
        }
      }
    });
    
    console.log(`Scan complete. Added effects to ${effectsAdded} objects.`);
  }
  
  /**
   * Dispose all effects and clean up resources
   */
  dispose() {
    console.log('Disposing ShaderEffectsManager...');
    
    // Clean up standard effects
    this.effects.forEach((effectData, objectId) => {
      this.removeEffect(objectId);
    });
    
    // Clean up zone effects
    this.zoneEffects.forEach((effectData, zoneId) => {
      if (effectData.mesh) {
        this.scene3D.scene.remove(effectData.mesh);
        
        if (effectData.mesh.geometry) {
          effectData.mesh.geometry.dispose();
        }
        
        if (effectData.mesh.material) {
          effectData.mesh.material.dispose();
        }
      }
    });
    
    // Clear collections
    this.effects.clear();
    this.zoneEffects.clear();
    
    console.log('ShaderEffectsManager disposed.');
  }
}

// Export the class
export default ShaderEffectsManager;