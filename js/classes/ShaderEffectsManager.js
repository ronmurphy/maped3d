/**
 * ShaderEffectsManager handles special visual effects throughout the scene
 * Supports both prop-based effects and area/zone effects
 */
if (!window.ShaderEffectsManager) {
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
    this.temporaryEffects = new Map();
    this.maxTempEffects = 20; // Maximum number of temporary effects like dust
    this.effectCleanupInterval = null;
    
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
      // Use different creation method based on quality
      create: (object, definition, qualityLevel) => {
        // Use enhanced effects for medium and high quality
        if (qualityLevel === 'high' || qualityLevel === 'ultra' || qualityLevel === 'medium') {
          return this.createEnhancedFireEffect(object, definition, qualityLevel);
        } else {
          // Use basic effect for low quality
          return this.createFireEffect(object, definition, qualityLevel);
        }
      }
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

    this.registerEffectType('coldMagic', {
      keywords: ['ice', 'frost', 'chill', 'freeze', 'snow', 'winter'],
      color: 0x88ccff, // Ice blue color
      intensity: 0.6, 
      distance: 4,
      decay: 1.5,
      particleCount: 12,
      particleSize: 0.03,
      particleColor: 0xaaddff,
      animationSpeed: 0.5,
      create: this.createPropGlowEffect.bind(this)
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
 * Create an enhanced fire effect with advanced shaders
 * @param {Object3D} object - Object to add effect to
 * @param {Object} definition - Effect definition
 * @param {string} qualityLevel - Quality level
 * @returns {Object} Effect data
 */
createEnhancedFireEffect(object, definition, qualityLevel = 'medium') {
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
  
  // Create enhanced fire particles with shader
  const particles = this.createEnhancedParticles(
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
 * Create particles with advanced shader effects
 * @param {number} count - Number of particles
 * @param {number} size - Base particle size
 * @param {number} color - Particle color
 * @returns {Points} Enhanced particle system
 */
createEnhancedParticles(count, size, color) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  
  // Convert hex color to RGB
  const particleColor = new THREE.Color(color);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Randomize positions in a small area
    const radius = Math.random() * 0.3;
    const angle = Math.random() * Math.PI * 2;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.random() * 0.5; // Height
    positions[i3 + 2] = Math.sin(angle) * radius;
    
    // Randomize colors slightly
    colors[i3] = particleColor.r * (0.9 + Math.random() * 0.2);
    colors[i3 + 1] = particleColor.g * (0.9 + Math.random() * 0.2);
    colors[i3 + 2] = particleColor.b * (0.9 + Math.random() * 0.2);
    
    // Randomize sizes
    sizes[i] = size * (0.7 + Math.random() * 0.6);
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('particleColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Advanced shader material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 particleColor;
      varying vec3 vColor;
      uniform float time;
      
      void main() {
        vColor = particleColor;
        
        // Animate position
        vec3 pos = position;
        pos.y += sin(time * 2.0 + position.x * 10.0) * 0.05;
        pos.x += sin(time * 3.0 + position.z * 10.0) * 0.05;
        pos.z += cos(time * 2.5 + position.x * 10.0) * 0.05;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      
      void main() {
        // Create circular particle
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) discard;
        
        // Smooth edge and fade center for glow effect
        float alpha = 0.9 * (1.0 - r * 1.9);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    vertexColors: true
  });
  
  // Create particle system
  const particles = new THREE.Points(geometry, material);
  
  // Store original positions for animation
  particles.userData.positions = positions.slice();
  particles.userData.time = 0;
  
  return particles;
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
 * Create a glow effect for props (like torches, lanterns, magic items)
 * @param {Object3D} prop - The prop object to add effect to
 * @param {Object} options - Configuration options
 * @returns {Object} Effect data for tracking
 */
createPropGlowEffect(prop, options = {}) {
  // Default options
  const defaults = {
    color: options.color || 0xff6600,
    intensity: options.intensity || 0.5,
    particleCount: options.particleCount || 15,
    particleSize: options.particleSize || 0.1,
    position: prop.position.clone(),
    height: options.height || 0.2,
    radius: options.radius || 0.3,
    blending: THREE.AdditiveBlending
  };
  
  // Skip if disabled
  if (!this.enabled) return null;
  
  // Create container for effects
  const container = new THREE.Group();
  container.position.copy(defaults.position);
  
  // Add to scene
  this.scene3D.scene.add(container);
  
  // Create glowing particle effect
  const particleCount = this.getQualityAdjustedValue(defaults.particleCount, this.qualityLevel);
  const positions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  // Convert color to RGB components
  const colorObj = new THREE.Color(defaults.color);
  const r = colorObj.r;
  const g = colorObj.g;
  const b = colorObj.b;
  
  // Create random particles around the prop
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // Position particles in small sphere around the prop's upper part
    const radius = defaults.radius;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = defaults.height + Math.random() * 0.2; // Slightly above
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    
    // Colors - base color with some variation
    particleColors[i3] = r * (0.8 + Math.random() * 0.4); // Red with variation
    particleColors[i3 + 1] = g * (0.8 + Math.random() * 0.4); // Green with variation
    particleColors[i3 + 2] = b * (0.8 + Math.random() * 0.4); // Blue with variation
    
    // Random sizes
    sizes[i] = defaults.particleSize * (0.5 + Math.random() * 1.0);
  }
  
  // Create geometry and set attributes
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('particleColor', new THREE.BufferAttribute(particleColors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Create shader material for better looking particles
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: new THREE.Color(defaults.color) }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 particleColor;
      varying vec3 vColor;
      uniform float time;
      
      void main() {
        vColor = particleColor;
        
        // Animate position
        vec3 pos = position;
        pos.y += sin(time * 2.0 + position.x * 10.0) * 0.05;
        pos.x += sin(time * 3.0 + position.z * 10.0) * 0.05;
        pos.z += cos(time * 2.5 + position.x * 10.0) * 0.05;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      
      void main() {
        // Create circular particle
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) discard;
        
        // Smooth edge and fade center for glow effect
        float alpha = 0.9 * (1.0 - r * 1.9);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    blending: defaults.blending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    vertexColors: true
  });
  
  // Create particle system
  const particles = new THREE.Points(geometry, material);
  
  // Add to container
  container.add(particles);
  
  // Try to modify original prop material if available
  if (prop.material && prop.material.isMeshStandardMaterial) {
    // Store original material properties if they don't exist yet
    if (!prop.userData.originalEmissive) {
      prop.userData.originalEmissive = prop.material.emissive.clone();
      prop.userData.originalEmissiveIntensity = prop.material.emissiveIntensity || 0;
    }
    
    // Make the prop itself glow
    prop.material.emissive = new THREE.Color(defaults.color);
    prop.material.emissiveIntensity = defaults.intensity;
    
    // Create reference to emissive mesh
    const emissiveMesh = prop;
    
    // Return effect data including the emissive mesh
    return {
      container,
      particles,
      emissiveMesh,
      originalObject: prop,
      definition: {
        color: defaults.color,
        emissiveIntensity: defaults.intensity
      },
      animationData: {
        time: 0,
        speed: 1.0,
        pattern: 'glow'
      }
    };
  }
  
  // Return effect data without emissive mesh
  return {
    container,
    particles,
    originalObject: prop,
    definition: {
      color: defaults.color,
      emissiveIntensity: defaults.intensity
    },
    animationData: {
      time: 0,
      speed: 1.0,
      pattern: 'glow'
    }
  };
}

/**
 * Scan a loaded model for props that might need effects
 * @param {THREE.Group} model - The 3D model to scan
 * @returns {number} Number of effects added
 */
scanModelForEffects(model) {
  if (!model || !this.enabled) {
    console.log('Model scanning skipped: model not provided or effects disabled');
    return 0;
  }
  
  console.log('Scanning model for props that might need effects...');
  let effectsAdded = 0;
  
  // Process all objects in the model
  model.traverse(object => {
    // Skip objects without a mesh or that are not visible
    if (!object.isMesh || !object.visible) return;
    
    // Check if object name suggests it should have effects
    const name = object.name.toLowerCase();
    const userData = object.userData || {};
    
    // Skip if object has a "noEffect" flag in userData
    if (userData.noEffect) return;
    
    let effectType = null;
    
    // Check against all registered effect keywords
    for (const [type, definition] of this.effectDefinitions) {
      if (definition.keywords && definition.keywords.some(keyword => name.includes(keyword))) {
        effectType = type;
        break;
      }
    }
    
    // Skip if no matching effect type
    if (!effectType) return;
    
    // Skip if already has effects
    const effectId = `prop-${object.id}`;
    if (this.effects.has(effectId)) return;
    
    console.log(`Applying ${effectType} effect to prop: ${object.name}`);
    
    try {
      // Get effect definition and create effect
      const definition = this.effectDefinitions.get(effectType);
      if (!definition || !definition.create) return;
      
      const effectData = definition.create(object, definition, this.qualityLevel);
      if (!effectData) return;
      
      // Store effect
      this.effects.set(effectId, {
        object,
        type: effectType,
        ...effectData
      });
      
      effectsAdded++;
      
      if (this.debug) {
        console.log(`Added ${effectType} effect to ${object.name}`);
      }
    } catch (error) {
      console.error(`Error applying ${effectType} effect to ${object.name}:`, error);
    }
  });
  
  console.log(`Added effects to ${effectsAdded} props in model`);
  return effectsAdded;
}

/**
 * Apply appropriate effects to a prop based on its name and properties
 * @param {THREE.Object3D} prop - The prop to add effects to
 * @returns {boolean} Whether an effect was applied
 */
applyPropEffects(prop) {
  if (!this.enabled || !prop) return false;
  
  // Check name to determine the appropriate effect
  const name = prop.name || prop.userData?.name || '';
  if (!name) return false;
  
  // Find matching effect type
  const effectType = this.getEffectTypeForName(name);
  if (!effectType) return false;
  
  // Create and apply the effect
  const effectId = `prop-${prop.id}`;
  if (this.effects.has(effectId)) {
    return false; // Effect already applied
  }
  
  try {
    // Get effect definition
    const definition = this.effectDefinitions.get(effectType);
    if (!definition || !definition.create) {
      console.warn(`No definition or creator for effect type: ${effectType}`);
      return false;
    }
    
    // Create the effect
    const effectData = definition.create(prop, definition, this.qualityLevel);
    if (!effectData) return false;
    
    // Store the effect
    this.effects.set(effectId, {
      object: prop,
      type: effectType,
      ...effectData
    });
    
    if (this.debug) {
      console.log(`Applied ${effectType} effect to prop: ${name}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error applying ${effectType} effect to prop:`, error);
    return false;
  }
}

/**
 * Clean up all effects for a model when unloading
 * @param {THREE.Group} model - The model to clean up effects for
 */
cleanupModelEffects(model) {
  if (!model) return;
  
  const effectsToRemove = [];
  
  // Find all effects belonging to objects in this model
  model.traverse(object => {
    this.effects.forEach((effectData, effectId) => {
      if (effectData.object === object || effectData.originalObject === object) {
        effectsToRemove.push(effectId);
      }
    });
  });
  
  // Remove all identified effects
  effectsToRemove.forEach(effectId => {
    this.removeEffect(effectId);
  });
  
  if (this.debug) {
    console.log(`Cleaned up ${effectsToRemove.length} effects for model`);
  }
}

/**
 * Auto-detect and apply appropriate effects to props
 * @param {Object3D} prop - The prop to analyze and apply effects to
 * @returns {Object|null} Effect data if applied, null otherwise
 */
detectAndApplyPropEffects(prop) {
  // Skip if not enabled
  if (!this.enabled) return null;
  
  // Check object name/type to determine effect
  const name = prop.name || prop.userData?.name || '';
  const lowerName = name.toLowerCase();
  
  // Check for fire-related props
  if (lowerName.includes('torch') || lowerName.includes('fire') || 
      lowerName.includes('flame') || lowerName.includes('candle') || 
      lowerName.includes('lantern') || lowerName.includes('brazier')) {
    return this.createPropGlowEffect(prop, {
      color: 0xff6600,
      intensity: 0.8
    });
  }
  
  // Check for magic-related props
  if (lowerName.includes('crystal') || lowerName.includes('magic') || 
      lowerName.includes('arcane') || lowerName.includes('rune') || 
      lowerName.includes('enchant')) {
    return this.createPropGlowEffect(prop, {
      color: 0x66ccff,
      intensity: 0.6,
      particleCount: 12
    });
  }
  
  // Check for lava/magma
  if (lowerName.includes('lava') || lowerName.includes('magma') || 
      lowerName.includes('ember')) {
    return this.createPropGlowEffect(prop, {
      color: 0xff3300,
      intensity: 1.0,
      particleCount: 18
    });
  }
  
  // Check for holy/radiant items
  if (lowerName.includes('holy') || lowerName.includes('divine') || 
      lowerName.includes('sacred') || lowerName.includes('blessed') ||
      lowerName.includes('radiant')) {
    return this.createPropGlowEffect(prop, {
      color: 0xffe599,
      intensity: 0.7,
      particleCount: 14
    });
  }
  
  // No effect applied
  return null;
}




  /**
 * Create footstep or impact dust effect
 * @param {THREE.Vector3} position - World position
 * @param {string} type - 'footstep' or 'impact'
 * @param {Object} options - Additional options
 */
createImpactEffect(position, type = 'footstep', options = {}) {
  // Skip effects on low quality
  if (this.qualityLevel === 'low' && !options.force) return null;
  
  const defaults = {
    count: type === 'footstep' ? 10 : 20,
    color: options.color || (type === 'footstep' ? 0xcccccc : 0xddccbb),
    size: type === 'footstep' ? 0.03 : 0.05,
    lifetime: type === 'footstep' ? 0.5 : 1.0
  };
  
  // Merge with provided options
  const config = {...defaults, ...options};
  
  // Create the dust effect
  return this.createDustEffect(position, config);
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
 * Create dust particles effect (for landings, footsteps, etc.)
 * @param {Object} position - Position {x, y, z} for the effect
 * @param {Object} options - Optional configuration parameters
 * @returns {Object} Effect data for tracking and updates
 */
createDustEffect(position, options = {}) {
  // console.log("Dust effect requested at:", position, "with options:", options);
  
  // Skip if disabled or low quality without force override
  if (!this.enabled || (this.qualityLevel === 'low' && !options.force)) {
    return null;
  }
  
  // NEW: Add NaN check for position values
  if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
    console.error("Dust effect failed: position contains NaN values");
    return null;
  }

  
  // Skip if we already have too many effects
  if (this.temporaryEffects.size >= this.maxTempEffects && !options.force) {
    if (this.debug) console.log('Max temporary effects reached, skipping dust effect');
    return null;
  }
  
  const count = options.count || 20;
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesMaterial = new THREE.PointsMaterial({
    color: options.color || 0xcccccc,
    size: options.size || 0.05,
    transparent: true,
    opacity: 0.6
  });
  
  // Create particle positions
  const positions = new Float32Array(count * 3);
  const velocities = [];
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.1 + Math.random() * 0.2;
    
    // Starting positions in a circle around landing point
    positions[i3] = position.x + Math.cos(angle) * radius;
    positions[i3 + 1] = position.y + 0.05; // Slightly above ground
    positions[i3 + 2] = position.z + Math.sin(angle) * radius;
    
    // Add random velocities
    velocities.push({
      x: (Math.random() - 0.5) * 0.01,
      y: 0.01 + Math.random() * 0.02,
      z: (Math.random() - 0.5) * 0.01
    });
  }
  
  particlesGeometry.setAttribute('position', 
    new THREE.BufferAttribute(positions, 3)
  );
  
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  this.scene3D.scene.add(particles);
  
  // Create effect ID and set lifetime
  const effectId = `dust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const lifetime = options.lifetime || 3.0; // Default 3 second lifetime
  
  // Create particle system and animation data
  const particleSystem = {
    id: effectId,
    mesh: particles,
    positions,
    velocities,
    lifetime: lifetime,
    age: 0,
    created: Date.now(),
    
    update: (deltaTime) => {
      // Update age
      particleSystem.age += deltaTime;
      
      // Check if expired
      if (particleSystem.age >= particleSystem.lifetime) {
        if (particleSystem.mesh.parent) {
          this.scene3D.scene.remove(particleSystem.mesh);
        }
        particleSystem.mesh.geometry.dispose();
        particleSystem.mesh.material.dispose();
        this.temporaryEffects.delete(effectId);
        return false; // Remove from updates
      }
      
      // Update particles
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Apply velocities
        positions[i3] += velocities[i].x;
        positions[i3 + 1] += velocities[i].y;
        positions[i3 + 2] += velocities[i].z;
        
        // Slow down with friction and gravity
        velocities[i].x *= 0.98;
        velocities[i].z *= 0.98;
        velocities[i].y -= 0.001;
      }
      
      // Fade out
      const fadeRatio = 1 - (particleSystem.age / particleSystem.lifetime);
      particlesMaterial.opacity = 0.6 * fadeRatio;
      
      // Update buffer
      particlesGeometry.attributes.position.needsUpdate = true;
      
      return true; // Keep updating
    }
  };
  
  // Add to temporary effects collection
  this.temporaryEffects.set(effectId, particleSystem);
  
  // Start cleanup interval if not already running
  this.ensureCleanupInterval();

  console.log(`Created dust effect with ${count} particles, ID: ${effectId}`);
  
  return particleSystem;
}

/**
 * Create a landing dust cloud effect
 * @param {Object} position {x, y, z} position 
 * @param {number} intensity How intense the effect should be (1.0 = normal)
 * @returns {Object} Effect data
 */
createLandingEffect(position, intensity = 1.0) {
  if (!this.enabled || (this.qualityLevel === 'low' && !intensity > 1.5)) return null;
  
  // Scale particles based on quality and intensity
  const particleCount = Math.min(
    this.qualityLevel === 'ultra' ? 75 : 
    this.qualityLevel === 'high' ? 50 : 
    30, 
    Math.floor(20 + intensity * 20)
  );
  
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = [];
 
  // Fill with random positions in a circle pattern
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    // Random position in circle
    const radius = 0.3 * Math.random() * intensity;
    const angle = Math.random() * Math.PI * 2;
   
    particlePositions[i3] = position.x + Math.cos(angle) * radius;
    particlePositions[i3 + 1] = position.y + 0.05; // Just above ground
    particlePositions[i3 + 2] = position.z + Math.sin(angle) * radius;
    
    // Add velocities with intensity factor
    particleVelocities.push({
      x: (Math.random() - 0.5) * 0.01 * intensity,
      y: 0.01 + Math.random() * 0.02 * intensity,
      z: (Math.random() - 0.5) * 0.01 * intensity  
    });
  }
 
  particleGeometry.setAttribute('position', 
    new THREE.Float32BufferAttribute(particlePositions, 3)
  );
 
  // Get or create particle texture
  const particleTexture = this.getParticleTexture();
 
  // Create material
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.15,
    map: particleTexture,
    transparent: true,
    opacity: 0.7,
    color: 0xddccbb, // Dust color
    depthWrite: false,
    sizeAttenuation: true
  });
 
  // Create particle system
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  this.scene3D.scene.add(particles);
 
  if (this.debug) {
    console.log(`Added ${particleCount} landing dust particles at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }
 
  // Create effect data for tracking
  const effectId = `landing-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const lifetime = 1.5 * intensity; // Longer lifetime for bigger impacts
  
  const effectData = {
    id: effectId,
    type: 'temporary',
    mesh: particles,
    positions: particlePositions,
    velocities: particleVelocities,
    duration: lifetime,
    age: 0,
    created: Date.now(),
    
    update: (deltaTime) => {
      // Update age
      effectData.age += deltaTime;
      const progress = effectData.age / effectData.duration;
      
      // Check if done
      if (progress >= 1.0) {
        // Clean up
        if (particles.parent) {
          this.scene3D.scene.remove(particles);
        }
        particleGeometry.dispose();
        particleMaterial.dispose();
        
        return false; // Signal to remove from tracking
      }
      
      // Update positions
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Apply velocities
        particlePositions[i3] += particleVelocities[i].x;
        particlePositions[i3 + 1] += particleVelocities[i].y;
        particlePositions[i3 + 2] += particleVelocities[i].z;
        
        // Apply physics
        particleVelocities[i].x *= 0.98; // Air resistance
        particleVelocities[i].z *= 0.98;
        particleVelocities[i].y -= 0.001; // Gravity
      }
      
      // Update geometry
      particleGeometry.attributes.position.needsUpdate = true;
      
      // Fade out
      particleMaterial.opacity = 0.7 * (1 - progress);
      
      return true; // Keep updating
    }
  };
  
  // Add to temporary effects for tracking and updates
  this.temporaryEffects.set(effectId, effectData);
  
  // Ensure cleanup interval is running
  this.ensureCleanupInterval();
  
  return effectData;
}

/**
 * Get or create a cached particle texture
 * @returns {THREE.Texture} Particle texture
 */
getParticleTexture() {
  if (!this._particleTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
   
    // Draw a soft white circle
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(240,240,220,0.8)');
    gradient.addColorStop(1, 'rgba(240,240,220,0)');
   
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
   
    this._particleTexture = new THREE.CanvasTexture(canvas);
  }
 
  return this._particleTexture;
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
    
    // Update standard effects
    this.effects.forEach((effectData, objectId) => {
      this.updateEffect(effectData, deltaTime);
    });
    
    // Update temporary effects
    let updatedCount = 0;
    this.temporaryEffects.forEach((effectData, effectId) => {
      if (effectData.update) {
        const keepUpdating = effectData.update(deltaTime);
        if (!keepUpdating) {
          this.temporaryEffects.delete(effectId);
        } else {
          updatedCount++;
        }
      }
    });
    
    if (updatedCount > 0 && this.debug) {
      console.log(`Updated ${updatedCount} temporary effects`);
    }
  
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
  const time = effectData.animationData.time;
  
  // Animate particles if present
  if (effectData.particles) {
    // Check if using advanced shader material
    if (effectData.particles.material.isShaderMaterial && 
        effectData.particles.material.uniforms && 
        effectData.particles.material.uniforms.time) {
      
      // Update time uniform for shader animation
      effectData.particles.material.uniforms.time.value = time;
      
      // No need to update positions manually, shader handles it
    } 
    // Standard particle animation (original code)
    else {
      const positions = effectData.particles.geometry.attributes.position.array;
      const originalPositions = effectData.particles.userData.positions;
      const count = positions.length / 3;
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
  }
  
  // Animate light flickering if applicable
  if (effectData.light) {
    // Apply subtle flicker to light intensity
    const originalIntensity = effectData.definition.intensity || 1.0;
    const flickerAmount = 0.1; // Amount of intensity variation
    
    // More complex flicker calculation for realism
    const flicker = 
      Math.sin(time * 5) * 0.05 +
      Math.sin(time * 10) * 0.025 +
      Math.sin(time * 20) * 0.0125;
    
    effectData.light.intensity = originalIntensity * (1.0 - flickerAmount + flicker);
    
    // Option: also animate light color for more realism
    if (effectData.definition.animateColor && effectData.light.color) {
      // Shift color slightly toward yellow/red for fire
      const baseColor = new THREE.Color(effectData.definition.color);
      const warmthShift = Math.sin(time * 3) * 0.05; // Small color variation
      
      effectData.light.color.copy(baseColor);
      effectData.light.color.r += warmthShift;
      effectData.light.color.g += warmthShift * 0.4;
    }
  }
  
  // Update emissive material effects if present
  if (effectData.emissiveMesh && effectData.emissiveMesh.material) {
    const material = effectData.emissiveMesh.material;
    if (material.emissiveIntensity !== undefined) {
      // Add subtle pulsing to emissive intensity
      const originalIntensity = effectData.definition.emissiveIntensity || 1.0;
      material.emissiveIntensity = originalIntensity * (0.8 + Math.sin(time * 2) * 0.2);
    }
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
 * Ensure cleanup interval is running
 */
ensureCleanupInterval() {
  if (!this.effectCleanupInterval) {
    console.log('Starting effects cleanup interval');
    this.effectCleanupInterval = setInterval(() => {
      this.cleanupOldEffects();
    }, 5000); // Check every 5 seconds
  }
}

/**
 * Clean up old effects
 */
cleanupOldEffects() {
  if (this.temporaryEffects.size === 0) {
    // Clear interval if no effects to manage
    if (this.effectCleanupInterval) {
      clearInterval(this.effectCleanupInterval);
      this.effectCleanupInterval = null;
    }
    return;
  }
  
  const now = Date.now();
  const maxAge = 10000; // 10 seconds absolute maximum
  
  // First, remove any super old effects
  this.temporaryEffects.forEach((effect, id) => {
    if (now - effect.created > maxAge) {
      // Force remove very old effects
      if (effect.mesh && effect.mesh.parent) {
        this.scene3D.scene.remove(effect.mesh);
      }
      
      // Clean up resources
      if (effect.mesh) {
        if (effect.mesh.geometry) effect.mesh.geometry.dispose();
        if (effect.mesh.material) effect.mesh.material.dispose();
      }
      
      this.temporaryEffects.delete(id);
      if (this.debug) console.log(`Removed old effect ${id}`);
    }
  });
  
  // Second, if we're still over limit, remove oldest effects
  if (this.temporaryEffects.size > this.maxTempEffects) {
    // Sort by creation time
    const sortedEffects = Array.from(this.temporaryEffects.entries())
      .sort((a, b) => a[1].created - b[1].created);
    
    // Remove oldest effects until we're within limits
    const countToRemove = this.temporaryEffects.size - this.maxTempEffects;
    for (let i = 0; i < countToRemove; i++) {
      if (i < sortedEffects.length) {
        const [id, effect] = sortedEffects[i];
        
        // Cleanup this effect
        if (effect.mesh && effect.mesh.parent) {
          this.scene3D.scene.remove(effect.mesh);
        }
        
        // Clean up resources
        if (effect.mesh) {
          if (effect.mesh.geometry) effect.mesh.geometry.dispose();
          if (effect.mesh.material) effect.mesh.material.dispose();
        }
        
        this.temporaryEffects.delete(id);
        if (this.debug) console.log(`Removed excess effect ${id}`);
      }
    }
  }
  
  if (this.debug) {
    console.log(`Cleanup completed: ${this.temporaryEffects.size} temporary effects remaining`);
  }
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

      // Clean up temporary effects
  this.temporaryEffects.forEach((effect, id) => {
    if (effect.mesh && effect.mesh.parent) {
      this.scene3D.scene.remove(effect.mesh);
    }
    if (effect.mesh) {
      if (effect.mesh.geometry) effect.mesh.geometry.dispose();
      if (effect.mesh.material) effect.mesh.material.dispose();
    }
  });
  this.temporaryEffects.clear();
  
  // Clear cleanup interval
  if (this.effectCleanupInterval) {
    clearInterval(this.effectCleanupInterval);
    this.effectCleanupInterval = null;
  }
    
    // Clear collections
    this.effects.clear();
    this.zoneEffects.clear();
    
    console.log('ShaderEffectsManager disposed.');
  }
}

// Export the class
window.ShaderEffectsManager = ShaderEffectsManager;
}
