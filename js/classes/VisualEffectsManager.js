// VisualEffectsManager.js - Simplified version without external dependencies
class VisualEffectsManager {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.scene = scene3D.scene;
    this.camera = scene3D.camera;
    this.renderer = scene3D.renderer;
    
    // Track torch lights and emissive objects
    this.torchLights = [];
    this.emissiveObjects = [];
    
    // Settings
    this.qualityLevel = 'medium';
    this.effectsEnabled = true;
    
    // Simplified bloom effect (no postprocessing)
    this.useSimpleGlow = true;
  }
  
  /**
   * Initialize effects - simplified version that doesn't require
   * external post-processing libraries
   */
  initPostProcessing() {
    console.log('Using simplified visual effects (emissive materials only)');
    
    // We'll rely on emissive materials for glow without actual bloom
    this.effectsEnabled = true;
  }
  
  /**
   * Create a glowing torch with light
   * @param {Object} position {x, y, z}
   * @param {Object} options Configuration
   */
  createTorch(position, options = {}) {
    const defaults = {
      color: 0xffaa00,      // Orange-yellow
      intensity: 1.0,       // Light intensity
      distance: 8.0,        // Light range
      flicker: true,        // Animation
      size: 0.15            // Size of flame
    };
    
    // Merge options
    const config = { ...defaults, ...options };
    
    // Create flame geometry
    const flameGeometry = new THREE.SphereGeometry(config.size, 16, 16);
    
    // Create emissive material for glow effect
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 1.5, // Higher intensity since we don't have real bloom
      transparent: true,
      opacity: 0.9
    });
    
    // Create flame mesh
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(position.x, position.y, position.z);
    
    // Make flame slightly squished
    flame.scale.set(0.8, 1.2, 0.8);
    
    // Create torch handle
    const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,  // Brown
      roughness: 0.9
    });
    
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(position.x, position.y - 0.25, position.z);
    
    // Create point light
    const light = new THREE.PointLight(config.color, config.intensity, config.distance);
    light.position.set(position.x, position.y, position.z);
    
    // Add shadows if enabled
    if (this.renderer.shadowMap.enabled) {
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      light.shadow.bias = -0.001;
    }
    
    // Create a group to hold everything
    const group = new THREE.Group();
    group.add(flame);
    group.add(handle);
    group.add(light);
    
    // Add to scene
    this.scene.add(group);
    
    // Setup animation data if flicker is enabled
    if (config.flicker) {
      const torch = {
        group,
        flame,
        light,
        originalIntensity: config.intensity,
        flickerSpeed: 1 + Math.random() * 0.5,
        flickerTime: Math.random() * 100,
        update: (deltaTime) => {
          // Update flicker time
          torch.flickerTime += deltaTime * torch.flickerSpeed * 5;
          
          // Create realistic flicker
          const noise = 
            Math.sin(torch.flickerTime) * 0.1 + 
            Math.sin(torch.flickerTime * 2.5) * 0.05 +
            Math.sin(torch.flickerTime * 7) * 0.025;
          
          // Apply flicker to light intensity
          const intensity = torch.originalIntensity * (0.8 + noise);
          torch.light.intensity = intensity;
          
          // Also adjust flame scale slightly
          const scale = 1 + noise * 0.2;
          torch.flame.scale.set(0.8 * scale, 1.2 * scale, 0.8 * scale);
        }
      };
      
      // Store for updates
      this.torchLights.push(torch);
      
      return torch;
    }
    
    return { group, flame, light };
  }
  
  /**
   * Create a glowing item or material
   * @param {Object} options Material configuration
   */
  createGlowMaterial(options = {}) {
    const defaults = {
      color: 0x00aaff,          // Blue glow
      emissiveIntensity: 1.0,    // Glow strength
      roughness: 0.2,
      metalness: 0.0
    };
    
    const config = { ...defaults, ...options };
    
    // Create material with emissive properties
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: config.emissiveIntensity,
      roughness: config.roughness,
      metalness: config.metalness
    });
    
    return material;
  }
  
  /**
   * Create dust particles (when landing, etc.)
   * @param {Object} position {x, y, z} 
   */
  createDustEffect(position) {
    const count = 20;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.05,
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
    this.scene.add(particles);
    
    // Create animation data
    const particleSystem = {
      mesh: particles,
      positions,
      velocities,
      lifetime: 1.0,
      age: 0,
      
      update: (deltaTime) => {
        // Update age
        particleSystem.age += deltaTime;
        
        // Check if expired
        if (particleSystem.age >= particleSystem.lifetime) {
          this.scene.remove(particleSystem.mesh);
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
    
    this.emissiveObjects.push(particleSystem);
    return particleSystem;
  }
  
  /**
   * Apply quality settings to effects
   * @param {string} level Quality level (low, medium, high)
   */
  applyQualityLevel(level) {
    this.qualityLevel = level;
    
    // Adjust torches based on quality
    this.torchLights.forEach(torch => {
      switch(level) {
        case 'high':
          torch.originalIntensity = torch.light.userData.originalIntensity || 1.0;
          torch.flame.material.emissiveIntensity = 1.5;
          break;
        case 'medium':
          torch.originalIntensity = (torch.light.userData.originalIntensity || 1.0) * 0.8;
          torch.flame.material.emissiveIntensity = 1.2;
          break;
        case 'low':
          torch.originalIntensity = (torch.light.userData.originalIntensity || 1.0) * 0.6;
          torch.flame.material.emissiveIntensity = 0.8;
          break;
      }
    });
    
    // Adjust other emissive objects
    this.emissiveObjects.forEach(obj => {
      if (obj.mesh && obj.mesh.material && obj.mesh.material.emissiveIntensity) {
        switch(level) {
          case 'high':
            obj.mesh.material.emissiveIntensity = 1.0;
            break;
          case 'medium':
            obj.mesh.material.emissiveIntensity = 0.7;
            break;
          case 'low':
            obj.mesh.material.emissiveIntensity = 0.4;
            break;
        }
      }
    });
    
    console.log(`Visual effects quality set to: ${level}`);
  }
  
  /**
   * Update all animated effects
   * @param {number} deltaTime Time since last update in seconds
   */
  update(deltaTime) {
    if (!this.effectsEnabled) return;
    
    // Update torches
    this.torchLights.forEach(torch => {
      if (torch.update) torch.update(deltaTime);
    });
    
    // Update other effects
    this.emissiveObjects = this.emissiveObjects.filter(obj => {
      if (obj.update) return obj.update(deltaTime);
      return true;
    });
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove torches
    this.torchLights.forEach(torch => {
      if (torch.group) this.scene.remove(torch.group);
    });
    this.torchLights = [];
    
    // Remove other effects
    this.emissiveObjects.forEach(obj => {
      if (obj.mesh) this.scene.remove(obj.mesh);
    });
    this.emissiveObjects = [];
  }
}