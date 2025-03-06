// window.DEBUG_MODE = true;

class Scene3DController {
  constructor() {
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false
    };
    this.PLAYER_EYE_HEIGHT = 1.7;
    this.teleporters = [];
    this.doors = [];
    this.insideWallRoom = false;
    this.debugVisuals = false;
    this.resourceManager = null;
    this.activeSplashArt = null;
    this.splashArtPrompt = null;
    this.nearestSplashArt = null;
    this.inventory = new Map();
    this.nearestProp = null;
    this.pickupPrompt = null;
    this.inventoryDrawer = null;
    this.isInventoryShowing = false;
    this.isPartyManagerOpen = false;
    this.stats = null; // FPS Counter
    this.showStats = false;
    this.isInitializingStats = false; // Add this flag
    this.lastStatsToggle = 0; // For debouncing
    this.lastKeyPresses = {}; // For debouncing key presses
    this.renderDistance = 100; // Default render distance
    this.textureMultiplier = 1.0; // Default texture resolution multiplier
    this.physics = {
      simulationDetail: 2,
      maxSimulationSteps: 10
    };
    this.visualEffects = null;
    this.showDemoEffects = false;
    this.dayNightCycle = null;
    this.encounterPrompt = null;
    this.nearestEncounter = null;
    this.movementVector = new THREE.Vector3();
    this.lastFrameTime = performance.now();
    this.deltaTime = 0;
    this.keyDebounceTimers = {};
    this.gameState = 'initializing'; // Current game state
    this._ignoreNextLock = false;    // Flag to prevent event cascades
    this._ignoreNextUnlock = false;  // Flag to prevent event cascades
    this.gameStarted = false;
    window.scene3D = this;
    console.log('Set window.scene3D reference in constructor');
    this.setupInventorySystem();
    // this.initializePartyAndCombatSystems();
    this.clear();
  }

  clear() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrameId = null;
    this.isActive = false;
    this.keyHandlers = {
      keydown: null,
      keyup: null
    };
    this.keys = {};
    this.doors = [];
    this.doorPrompt = null;
    this.activeDoor = null;
  }


  initialize(container, width, height) {
    // Initialize core Three.js components
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // Create the renderer with proper width/height
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.optimizeRenderer();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setClearColor(0x222222);

    // Create camera with correct aspect ratio
    this.camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);

    // Create controls
    this.controls = new THREE.PointerLockControls(this.camera, container);

    // Add renderer to container
    container.appendChild(this.renderer.domElement);


    this.loadPreferences();
    if (this.preferences && this.preferences.showFps) {
      this.showStats = true;
      this.initStats();

      // Explicitly make sure memory stats is visible if showStats is true
      if (this.memStats) {
        this.memStats.style.display = 'block';
      }

      this.updateQualityIndicator();

    }

    // Initialize visual effects
    if (!this.visualEffects) {
      this.visualEffects = new VisualEffectsManager(this);
      this.visualEffects.initPostProcessing();
    }

    // Initialize day/night cycle if not exists
    if (!this.dayNightCycle) {
      this.initializeDayNightCycle();
    }

    // Add player light
    this.addPlayerLight();

    // Setup key handlers
    this.keyHandlers.keydown = (e) => (this.keys[e.key.toLowerCase()] = true);
    this.keyHandlers.keyup = (e) => (this.keys[e.key.toLowerCase()] = false);

    document.addEventListener("keydown", this.keyHandlers.keydown);
    document.addEventListener("keyup", this.keyHandlers.keyup);

    this.isActive = true;

    // Apply FPS limit if set in preferences
    const prefs = this.getPreferences();
    if (prefs.fpsLimit) {
      console.log('Applying FPS limit from preferences:', prefs.fpsLimit);
      this.setFPSLimit(prefs.fpsLimit);
    }

    // Schedule texture updates
    [100, 500, 1000].forEach(delay => {
      setTimeout(() => this.updateTexturesColorSpace(), delay);
    });

    return true;
  }


  cleanup() {
    console.log('Starting enhanced Scene3D cleanup...');
    this.isActive = false;

    // Cancel any pending animation frames first
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all timers and intervals
    if (this.miniMapUpdateInterval) {
      clearInterval(this.miniMapUpdateInterval);
      this.miniMapUpdateInterval = null;
    }

    // Clean up UI elements with proper checks
    const uiElements = [
      'teleportPrompt', 'doorPrompt', 'encounterPrompt', 'pickupPrompt',
      'splashArtPrompt', 'inventoryDrawer', 'qualityIndicator'
    ];

    uiElements.forEach(element => {
      if (this[element]) {
        if (this[element].remove) this[element].remove();
        if (this[element].parentNode) this[element].parentNode.removeChild(this[element]);
        this[element] = null;
      }
    });

    // Remove all event listeners with named functions
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("keydown", this.keyHandlers.keydown);
    document.removeEventListener("keyup", this.keyHandlers.keyup);
    window.removeEventListener('resize', this.handleResize);
  
    if (this._gameMenu) {
      this._gameMenu.dispose();
      this._gameMenu = null;
    }
  
    // Clean up renderer DOM element - critical for WebGL context release
    if (this.renderer) {
      console.log('Disposing of renderer...');

      // Force immediate renderer disposal
      this.renderer.dispose();

      // Dispose of all render targets
      if (this.renderer.renderTargets) {
        Object.keys(this.renderer.renderTargets).forEach(key => {
          this.renderer.renderTargets[key].dispose();
          delete this.renderer.renderTargets[key];
        });
      }

      // Remove DOM element
      if (this.renderer.domElement) {
        if (this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }

      // Force context loss (important for WebGL resource cleanup)
      if (this.renderer.forceContextLoss) {
        this.renderer.forceContextLoss();
      }

      // Force context release
      const gl = this.renderer.getContext();
      if (gl && gl.getExtension('WEBGL_lose_context')) {
        gl.getExtension('WEBGL_lose_context').loseContext();
      }

      this.renderer = null;
    }

    // Clean up audio with better checks
    if (this.camera) {
      // Find and dispose of audio listener
      const listener = this.camera.children.find(child => child instanceof THREE.AudioListener);
      if (listener) {
        console.log('Cleaning up audio listener...');
        this.camera.remove(listener);
        if (listener.context && listener.context.close) {
          listener.context.close();
        }

        // Dispose of all audio sources
        this.scene.traverse(object => {
          if (object.isAudio) {
            object.disconnect();
            if (object.source) {
              object.source.disconnect();
              object.source = null;
            }
            if (object.buffer) {
              object.buffer = null;
            }
          }
        });
      }
    }

    // Clean up specific sounds
    ['doorSound', 'jumpSound'].forEach(sound => {
      if (this[sound]) {
        if (this[sound].isPlaying) this[sound].stop();
        if (this[sound].disconnect) this[sound].disconnect();
        this[sound] = null;
      }
    });

    // Clean up physics with proper checks
    if (this.physics) {
      console.log('Cleaning up physics...');
      if (this.physics.cleanup) this.physics.cleanup();
      this.physics = null;
    }

    // Clean up visual effects
    if (this.visualEffects) {
      console.log('Cleaning up visual effects...');
      if (this.visualEffects.dispose) this.visualEffects.dispose();
      this.visualEffects = null;
    }

    // Clean up day/night cycle
    if (this.dayNightCycle) {
      console.log('Cleaning up day/night cycle...');
      if (this.dayNightCycle.dispose) this.dayNightCycle.dispose();
      this.dayNightCycle = null;
    }

    if (this.lightSources) {
      this.lightSources.clear();
      this.lightSources = null;
    }
    if (this.lightSourcesContainer) {
      this.scene.remove(this.lightSourcesContainer);
      this.lightSourcesContainer = null;
    }

    // Clean up stats with proper checks
    if (this.stats) {
      console.log('Cleaning up stats...');
      if (this.stats.dom && this.stats.dom.parentNode) {
        this.stats.dom.parentNode.removeChild(this.stats.dom);
      }
      this.stats = null;
    }

    // Clean up controls
    if (this.controls) {
      console.log('Cleaning up controls...');
      this.controls.disconnect();
      if (this.controls.dispose) this.controls.dispose();
      this.controls = null;
    }

    // Dispose all geometries, materials, and textures in the scene
    console.log('Disposing scene objects...');
    if (this.scene) {
      this.scene.traverse((object) => {
        // Remove all event listeners
        if (object._listeners) {
          object._listeners = {};
        }

        // Dispose geometry with safety checks
        if (object.geometry) {
          object.geometry.dispose();
          object.geometry = null;
        }

        // Dispose material(s) thoroughly
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => this.disposeMaterial(material));
          } else {
            this.disposeMaterial(object.material);
          }
          object.material = null;
        }
      });

      // Clear the scene
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }

      this.scene = null;
    }

    // Explicit cleanup of memory-heavy components
    if (this.baseImage) {
      this.baseImage.src = '';
      this.baseImage = null;
    }

    // Clear arrays and maps with proper nullifying
    console.log('Clearing data structures...');
    this.teleporters = [];
    this.doors = [];
    this.markers = [];
    if (this.inventory) {
      this.inventory.clear();
      this.inventory = null;
    }

    // Clear all references to objects
    this.nearestSplashArt = null;
    this.activeSplashArt = null;
    this.nearestProp = null;
    this.nearestEncounter = null;
    this.activeTeleporter = null;
    this.activeDoor = null;
    this.playerLight = null;

    // Clear cached objects in Three.js
    THREE.Cache.clear();

    // Clean up mini-map
    this.cleanupMiniMap();

    // Clean up any potential circular references
    this.movementVector = null;
    this.frustum = null;
    this.projScreenMatrix = null;
    this.particlePool = null;

    // Clear all remaining properties
    this.clear();

    // Explicitly request garbage collection when available
    console.log('Cleanup complete, requesting garbage collection...');
    setTimeout(() => {
      if (window.gc) window.gc();
    }, 300);

    // Force another garbage collection attempt after a delay
    setTimeout(() => {
      if (window.gc) window.gc();
      console.log('Final cleanup completed');
    }, 1000);
  }

  // Enhanced method to thoroughly dispose of materials including all textures
  disposeMaterial(material) {
    if (!material) return;

    // Dispose all texture properties
    const textureProps = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'displacementMap', 'specularMap',
      'emissiveMap', 'metalnessMap', 'roughnessMap', 'alphaMap', 'aoMap', 'envMap',
      'matcap', 'gradientMap'
    ];

    textureProps.forEach(prop => {
      if (material[prop]) {
        material[prop].dispose();
        material[prop] = null;
      }
    });

    // Check for custom properties
    if (material.userData) {
      Object.keys(material.userData).forEach(key => {
        if (material.userData[key] &&
          material.userData[key].isTexture) {
          material.userData[key].dispose();
          material.userData[key] = null;
        }
      });
    }

    // Also dispose any MeshStandardMaterial specific fields
    if (material.isMeshStandardMaterial) {
      if (material.envMap) {
        material.envMap.dispose();
        material.envMap = null;
      }

      if (material.onBeforeCompile) {
        material.onBeforeCompile = null;
      }
    }

    // Dispose the material itself
    material.dispose();
  }

  setGameState(state) {
    const prevState = this.gameState || 'initializing';
    console.log(`Game state changing: ${prevState} → ${state}`);
    
    this.gameState = state;
    
    switch (state) {
      case 'paused':
        // Ensure controls are unlocked (mouse is free)
        if (this.controls && this.controls.isLocked) {
          console.log('Unlocking controls for pause state');
          this._ignoreNextUnlock = true;
          this.controls.unlock();
        }
        
        // Pause all systems
        this._controlsPaused = true;
        break;
        
      case 'playing':
        // Resume all systems
        this._controlsPaused = false;
        break;
        
      case 'exiting':
        // Clean transition when exiting game
        this._controlsPaused = true;
        break;
    }
  }

  modifyControlsListeners() {
    if (!this.controls) return;
    
    // Store original event handlers
    if (!this._originalLockHandler) {
      this._originalLockHandler = this.controls.onLock;
    }
    if (!this._originalUnlockHandler) {
      this._originalUnlockHandler = this.controls.onUnlock;
    }
    
    // Override lock handler
    this.controls.onLock = () => {
      console.log('Controls locked');
      
      // Only set playing state if not ignored
      if (!this._ignoreNextLock && this.gameState !== 'playing') {
        this.setGameState('playing');
      }
      
      // Clear ignore flag
      this._ignoreNextLock = false;
      
      // Call original handler if it exists
      if (this._originalLockHandler) {
        this._originalLockHandler.call(this.controls);
      }
    };
    
    // Override unlock handler
    this.controls.onUnlock = () => {
      console.log('Controls unlocked');
      
      // Only pause if not ignored
      if (!this._ignoreNextUnlock && this.gameState !== 'paused') {
        this.setGameState('paused');
      }
      
      // Clear ignore flag
      this._ignoreNextUnlock = false;
      
      // Call original handler if it exists
      if (this._originalUnlockHandler) {
        this._originalUnlockHandler.call(this.controls);
      }
    };
  }

    monitorMemory() {
    if (window.performance && window.performance.memory) {
      const memStats = document.createElement('div');
      memStats.style.cssText = `
        position: fixed;
        top: 56px;
        left: 100px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-family: monospace;
        z-index: 1000;
      `;

      // Set initial display state based on showStats
      memStats.style.display = this.showStats ? 'block' : 'none';

      document.body.appendChild(memStats);

      const updateMemStats = () => {
        if (!memStats.parentNode) return;

        const memory = window.performance.memory;
        const usedHeapSize = (memory.usedJSHeapSize / 1048576).toFixed(2);
        const totalHeapSize = (memory.totalJSHeapSize / 1048576).toFixed(2);

        memStats.textContent = `Mem: ${usedHeapSize}MB / ${totalHeapSize}MB`;

        setTimeout(updateMemStats, 1000);
      };

      updateMemStats();

      return memStats;
    }

    return null;
  }

  safeUpdateTexture(texture, source = 'unknown') {
    if (!texture) {
      console.warn(`Null texture in ${source}`);
      return false;
    }

    // Different checks based on Three.js version
    if (texture.image) {
      // Standard case - check if image exists
      if (texture.image.width > 0 && texture.image.height > 0) {
        texture.needsUpdate = true;
        return true;
      }
    }
    else if (texture.source && texture.source.data) {
      // In newer Three.js versions
      texture.needsUpdate = true;
      return true;
    }
    else if (texture.source && texture.source.width > 0) {
      // Alternative check for newer Three.js
      texture.needsUpdate = true;
      return true;
    }

    console.warn(`Texture missing image data in ${source}`);
    return false;
  }

  // Add this method to Scene3DController
  getPreferences() {
    // Initialize preferences if not already done
    if (!this.preferences) {
      try {
        // Try to load from localStorage
        const savedPrefs = localStorage.getItem('appPreferences');
        if (savedPrefs) {
          this.preferences = JSON.parse(savedPrefs);
          console.log('Loaded preferences from localStorage:', this.preferences);
        } else {
          // Set defaults if nothing in localStorage
          this.preferences = {
            qualityPreset: 'auto',
            shadowsEnabled: false,
            antialiasEnabled: true,
            hqTextures: false,
            ambientOcclusion: false,
            disableLighting: false,
            showFps: false,
            showStats: false,
            movementSpeed: 1.0,
            fpsLimit: 0,  // Default to no FPS limit
            detectedQuality: null,
            // Add day/night related settings if needed
            timeOfDay: 12,
            autoPlayDayNight: false
          };
          console.log('Using default preferences');
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        // Fallback to defaults on error
        this.preferences = {
          qualityPreset: 'auto',
          shadowsEnabled: false,
          antialiasEnabled: true,
          hqTextures: false,
          ambientOcclusion: false,
          disableLighting: false,
          showFps: false,
          showStats: false,
          movementSpeed: 1.0,
          fpsLimit: 0,
          detectedQuality: null
        };
      }
    }

    return this.preferences;
  }

  // Method to initialize Stats
  initStats() {
    // Skip if already initialized or initialization in progress
    if (this.stats || this.isInitializingStats) return;

    // Set flag to prevent multiple initializations
    this.isInitializingStats = true;

    try {
      // Create a script element to load the local Stats.js
      const script = document.createElement('script');
      script.src = '/js/libs/stats.min.js'; // Adjust path if needed

      script.onload = () => {
        try {
          this.stats = new Stats();
          this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

          // Style the stats panel
          this.stats.dom.style.position = 'absolute';
          this.stats.dom.style.top = '56px';
          this.stats.dom.style.left = '10px';
          this.stats.dom.style.zIndex = '1000';

          // Important: Set display AFTER creating dom element
          this.stats.dom.style.display = this.showStats ? 'block' : 'none';

          // Add to DOM
          const container = document.querySelector('.drawer-3d-view');
          if (container) {
            container.appendChild(this.stats.dom);
          } else {
            document.body.appendChild(this.stats.dom);
          }

          this.updateQualityIndicator();
          this.memStats = this.monitorMemory();

          // Explicitly set memStats visibility to match showStats
          if (this.memStats && this.showStats) {
            this.memStats.style.display = 'block';
          }

          console.log('FPS counter initialized (using Stats.js)');
        } catch (err) {
          console.error('Error initializing Stats panel:', err);
          this.createSimpleFPSCounter(); // Fallback to simple counter
          this.updateQualityIndicator();

        } finally {
          this.isInitializingStats = false; // Reset flag when done
        }
      };

      script.onerror = () => {
        console.error('Failed to load Stats.js from local path');
        this.createSimpleFPSCounter(); // Fallback to simple counter
        this.isInitializingStats = false; // Reset flag on error
      };

      document.head.appendChild(script);
    } catch (err) {
      console.error('Error loading Stats.js:', err);
      this.createSimpleFPSCounter(); // Fallback to simple counter
      this.isInitializingStats = false; // Reset flag on error
    }
  }

  // Fallback method to create a simple FPS counter
  createSimpleFPSCounter() {
    console.log('Creating simple FPS counter as fallback');

    // Create a simple FPS counter as a DOM element
    this.stats = {
      dom: document.createElement('div'),
      lastTime: performance.now(),
      frames: 0,
      fps: 0,

      begin: function () {
        this.startTime = performance.now();
      },

      end: function () {
        const time = performance.now();
        this.frames++;

        // Update FPS every second
        if (time >= this.lastTime + 1000) {
          this.fps = Math.round((this.frames * 1000) / (time - this.lastTime));
          this.lastTime = time;
          this.frames = 0;
          this.fpsText.textContent = `${this.fps} FPS`;
        }

        // Update MS counter every frame
        const frameTime = time - this.startTime;
        this.msText.textContent = `${frameTime.toFixed(1)} ms`;
      }
    };

    // Style the counter
    this.stats.dom.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: #0ff;
    padding: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
    border-radius: 3px;
    width: 80px;
    text-align: center;
  `;

    // Create the text elements
    this.stats.fpsText = document.createElement('div');
    this.stats.fpsText.textContent = '0 FPS';
    this.stats.dom.appendChild(this.stats.fpsText);

    this.stats.msText = document.createElement('div');
    this.stats.msText.textContent = '0 ms';
    this.stats.dom.appendChild(this.stats.msText);

    // Initially hide or show based on the setting
    this.stats.dom.style.display = this.showStats ? 'block' : 'none';

    // Add to DOM
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(this.stats.dom);
    } else {
      document.body.appendChild(this.stats.dom);
    }
  }

  toggleStats() {
    // Debounce toggling
    const now = Date.now();
    if (now - this.lastStatsToggle < 500) {
      return;
    }
    this.lastStatsToggle = now;

    // Toggle visibility
    this.showStats = !this.showStats;

    // Initialize if needed
    if (!this.stats && !this.isInitializingStats) {
      // Initialize stats panel
      this.initStats();
    }

    // Create or update quality indicator
    this.updateQualityIndicator();

    // Update both the stats panel and quality indicator visibility
    if (this.stats && this.stats.dom) {
      this.stats.dom.style.display = this.showStats ? 'block' : 'none';
    }

    if (this.qualityIndicator) {
      this.qualityIndicator.style.display = this.showStats ? 'block' : 'none';
    }

    // Also toggle memory stats visibility
    if (this.memStats) {
      this.memStats.style.display = this.showStats ? 'block' : 'none';
    }

    // Save preference if we have preferences
    if (this.preferences) {
      this.preferences.showFps = this.showStats;
      localStorage.setItem('appPreferences', JSON.stringify(this.preferences));
    }

    console.log(`FPS counter ${this.showStats ? 'shown' : 'hidden'} with quality level: ${this.qualityLevel || 'not set'}`);
  }

  // New helper method to create/update quality indicator
  updateQualityIndicator() {
    // Get current quality level - check all possible sources
    const qualityLevel = this.qualityLevel ||
      (this.preferences?.qualityPreset !== 'auto' ? this.preferences?.qualityPreset : null) ||
      this.preferences?.detectedQuality || 'medium';

    // Create quality indicator if it doesn't exist
    if (!this.qualityIndicator) {
      this.qualityIndicator = document.createElement('div');
      this.qualityIndicator.className = 'quality-level-indicator';
      this.qualityIndicator.style.cssText = `
      position: absolute;
      top: 48px; /* Position below the FPS counter */
      left: 10px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 5px 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      border-radius: 3px;
      width: 60px;
      text-align: center;
    `;

      // Add to DOM
      const container = document.querySelector('.drawer-3d-view');
      if (container) {
        container.appendChild(this.qualityIndicator);
      } else {
        document.body.appendChild(this.qualityIndicator);
      }
    }

    // Set color based on quality level
    const levelColors = {
      ultra: '#9C27B0',  // Purple
      high: '#4CAF50',   // Green
      medium: '#2196F3', // Blue
      low: '#FF9800'     // Orange
    };

    // Update content and style
    this.qualityIndicator.textContent = qualityLevel.toUpperCase();
    this.qualityIndicator.style.color = levelColors[qualityLevel] || 'white';

    // Set initial visibility
    this.qualityIndicator.style.display = this.showStats ? 'block' : 'none';

    return this.qualityIndicator;
  }

  createStatsPanel() {
    this.stats = new Stats();

    // Configure stats panel
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.zIndex = '1000';

    // Always add quality indicator too
    this.updateQualityIndicator();
    this.memStats = this.monitorMemory();

    // Set initial visibility based on preferences
    this.stats.dom.style.display = this.showStats ? 'block' : 'none';
    this.memStats.style.display = this.showStats ? 'block' : 'none';
    // Add stats panel to DOM
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(this.stats.dom);
    } else {
      document.body.appendChild(this.stats.dom);
    }

    console.log('FPS counter initialized with quality level:', this.qualityLevel || 'medium');
  }

  initializeWithData(data) {
    if (!data) return;

    // Store references to essential data
    this.rooms = data.rooms || [];  // Keep rooms terminology
    this.textures = data.textures || {};
    this.tokens = data.tokens || [];
    this.cellSize = data.cellSize || 50;
    this.playerStart = data.playerStart || null;
    this.baseImage = data.baseImage || null;
    this.markers = data.markers || [];
    this.textureManager = data.textureManager;
    this.props = data.props || [];

    // Initialize physics
    this.physics = new PhysicsController(this);

    // Get texture rooms if they exist
    this.wallTextureRoom = this.rooms.find(room => room.name === "WallTexture");
    this.roomTextureRoom = this.rooms.find(room => room.name === "RoomTexture");

    // Create textures from the texture rooms
    if (this.wallTextureRoom) {
      this.wallTexture = this.createTextureFromRoom(this.wallTextureRoom);
    }
    if (this.roomTextureRoom) {
      this.roomTexture = this.createTextureFromRoom(this.roomTextureRoom);
    }

    // Store dimensions for calculations
    this.boxWidth = this.baseImage ? this.baseImage.width / 50 : 20;
    this.boxDepth = this.baseImage ? this.baseImage.height / 50 : 20;
    this.boxHeight = 4.5;

    // Setup render state
    this.renderState = {
      clippingEnabled: false
    };

    // Initialize movement state
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false,
      shiftHeld: false
    };


    // this.monitorActualFPS();
    const prefs = this.getPreferences();
    if (prefs.fpsLimit) {
      console.log('Applying FPS limit from preferences:', prefs.fpsLimit);
      this.setFPSLimit(prefs.fpsLimit);
    }

    return true;
  }


  createPropMesh(propData) {
    console.log(`Creating prop mesh with ID: ${propData.id}`);

    return new Promise((resolve, reject) => {
      const textureLoader = new THREE.TextureLoader();

      textureLoader.load(
        propData.image,
        (texture) => {
          // Calculate dimensions based on texture aspect ratio
          let width, height;

          if (texture.image) {
            const aspectRatio = texture.image.width / texture.image.height;
            width = propData.scale || 1;
            height = width / aspectRatio;
          } else {
            // Fallback if image dimensions aren't available
            width = propData.scale || 1;
            height = propData.scale || 1;
          }

          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.1 // Help with transparency sorting
          });

          const mesh = new THREE.Mesh(geometry, material);

          // Position in world space
          const x = propData.x / 50 - this.boxWidth / 2;
          const z = propData.y / 50 - this.boxDepth / 2;

          // Get elevation at this point
          const { elevation } = this.getElevationAtPoint(x, z);

          // Handle horizontal vs vertical orientation
          if (propData.isHorizontal) {
            // Horizontal prop - lie flat on surface
            mesh.rotation.x = -Math.PI / 2;

            // Set position slightly above surface
            const y = elevation + 0.02;
            mesh.position.set(x, y, z);

            // Apply rotation around Y axis (which is now the up vector)
            mesh.rotation.z = (propData.rotation || 0) * Math.PI / 180;
          }
          else if (propData.isWallMounted) {
            // Wall-mounted prop
            const y = propData.height;
            mesh.position.set(x, y, z);

            // Rotate to face away from wall
            mesh.rotation.y = (propData.rotation || 0) * Math.PI / 180;
          }
          else {
            // Vertical prop (original behavior)
            const y = propData.height + elevation;
            mesh.position.set(x, y, z);

            // Standard rotation around Y axis
            mesh.rotation.y = (propData.rotation || 0) * Math.PI / 180;
          }

          // Add metadata
          mesh.userData = {
            type: 'prop',
            id: propData.id,
            name: propData.name || 'Prop',
            isHorizontal: propData.isHorizontal || false,
            isWallMounted: propData.isWallMounted || false,
            gridX: propData.x,
            gridY: propData.y
          };

          mesh.userData.debugId = Date.now(); // Add a unique timestamp
          console.log(`Prop mesh created with debugId: ${mesh.userData.debugId}`);

          resolve(mesh);
        },
        undefined,
        (error) => {
          console.error("Error loading prop texture:", error);
          reject(error);
        }
      );
    });
  }

  createTextureFromArea(room) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = room.bounds.width;
    canvas.height = room.bounds.height;

    // Draw the portion of the map that contains the texture
    ctx.drawImage(
      this.baseImage,  // Changed from this.mapEditor.baseImage
      room.bounds.x,
      room.bounds.y,
      room.bounds.width,
      room.bounds.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
  }

  createTextureFromRoom(textureRoom) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = textureRoom.bounds.width;
    canvas.height = textureRoom.bounds.height;

    // Draw the portion of the map that contains the texture
    ctx.drawImage(
      this.baseImage,
      textureRoom.bounds.x,
      textureRoom.bounds.y,
      textureRoom.bounds.width,
      textureRoom.bounds.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Calculate repeats based on grid cell size
    const horizontalRepeats = Math.round(
      textureRoom.bounds.width / this.cellSize
    );
    const verticalRepeats = Math.round(
      textureRoom.bounds.height / this.cellSize
    );

    texture.repeat.set(horizontalRepeats, verticalRepeats);
    if (canvas.width > 0 && canvas.height > 0) {
      // texture.needsUpdate = true;
      this.safeUpdateTexture(texture, 'createTextureFromRoom');
    }

    return texture;
  }


  // Modify the createTokenMesh method to handle elevation
  createTokenMesh(token) {
    // Debug token data
    console.log("Creating token mesh for:", {
      name: token.name,
      position: `${token.x}, ${token.y}`,
      size: token.size || 1,
      height: token.height || 2
    });

    // Create billboard material  
    const spriteMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load(token.image),
      transparent: true,
      sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    // Scale based on token size and grid
    const scale = token.size * (this.cellSize / 50);
    const aspectRatio = 1; // Assume square for now
    sprite.scale.set(scale * aspectRatio, scale, 1);

    // Calculate world position  
    const x = token.x / 50 - this.boxWidth / 2;
    const z = token.y / 50 - this.boxDepth / 2;

    // Get elevation at token position
    const { elevation, isInside } = this.getElevationAtPoint(x, z);

    // Set y position - tokens inside walls stay at normal height,
    // tokens on raised blocks get placed on top
    let y = token.height || 2;
    if (!isInside && elevation > 0) {
      y = elevation + (token.size || 1);
    }

    if (token.type === "prop") {
      // Create billboard material with the prop texture
      const spriteMaterial = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load(token.image),
        transparent: true,
        sizeAttenuation: true
      });

      const sprite = new THREE.Sprite(spriteMaterial);

      // Scale based on prop size
      const scale = token.scale || 1;
      const aspectRatio = token.aspect || 1;
      sprite.scale.set(scale * aspectRatio, scale, 1);

      // Position at grid location
      const x = token.x / 50 - this.boxWidth / 2;
      const z = token.y / 50 - this.boxDepth / 2;
      const { elevation } = this.getElevationAtPoint(x, z);

      // Base height plus elevation
      const y = (token.height || 2) + elevation;

      sprite.position.set(x, y, z);
      sprite.rotation.y = (token.rotation || 0) * Math.PI / 180;

      return sprite;
    }


    sprite.position.set(x, y, z);



    console.log(`Positioned token at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);

    return sprite;
  }

  createRoomShape(room) {
    let geometry;

    switch (room.shape) {
      case "circle":
        const radius =
          Math.max(room.bounds.width, room.bounds.height) / 100;
        geometry = new THREE.CylinderGeometry(radius, radius, 4, 32);
        break;

      case "polygon":
        if (!room.points || room.points.length < 3) return null;

        const shape = new THREE.Shape();
        room.points.forEach((point, index) => {
          const x = point.x / 50;
          const y = point.y / 50;
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();

        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 4,
          bevelEnabled: false
        });
        break;

      default: // rectangle
        geometry = new THREE.BoxGeometry(
          room.bounds.width / 50,
          4,
          room.bounds.height / 50
        );
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0 // Make it invisible
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position the room correctly
    mesh.position.set(
      room.bounds.x / 50,
      2, // Half of height
      room.bounds.y / 50
    );

    return mesh;
  }



  setupDrawer() {
    const drawer = document.createElement("sl-drawer");
    drawer.label = "3D View";
    drawer.placement = "end";
    drawer.classList.add("drawer-3d-view");

    // Calculate width based on viewport and sidebar
    const sidebar = document.querySelector(".sidebar");
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
    const availableWidth = window.innerWidth - sidebarWidth;
    const drawerWidth = `${Math.floor(availableWidth)}px`; // Use pixels instead of vw

    // Set drawer width
    drawer.style.setProperty("--size", drawerWidth);

    // Container for Three.js
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden"; // Prevent scrollbars
    drawer.appendChild(container);

    // Progress indicator
    const progress = document.createElement("sl-progress-bar");
    progress.style.display = "none";
    drawer.appendChild(progress);

    document.body.appendChild(drawer);
    return { drawer, container, progress };
  }

  handleKeyDown(event) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveState.forward = true;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveState.backward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveState.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveState.right = true;
        break;
      case "KeyL": // L for Light toggle
        const nowL = Date.now();
        if (!event.repeat && (!this.lastKeyPresses.h || nowL - this.lastKeyPresses.h > 500)) {
          this.lastKeyPresses.h = nowL;
          this.addPlayerLight(!this.playerLight);
        }
        break;
      // Fixed KeyP handler with proper debounce
      case "KeyP": // P to show Party Manager
        if (window.partyManager) {
          const nowP = Date.now();

          // Use nowP in the condition, not nowL which is undefined
          if (!event.repeat && (!this.lastKeyPresses.p || nowP - this.lastKeyPresses.p > 500)) {
            // Update the lastKeyPresses.p, not lastKeyPresses.h
            this.lastKeyPresses.p = nowP;

            console.log("Opening Party Manager");

            // Pause 3D controls while party manager is open
            this.pauseControls();

            // Show party manager
            window.partyManager.showPartyManager();

            // Resume controls when party manager closes
            const checkForDialog = setInterval(() => {
              const dialog = document.querySelector('sl-dialog[label="Monster Party"]');
              if (!dialog) {
                this.resumeControls();
                clearInterval(checkForDialog);
              }
            }, 100);
          } else {
            console.log("Party Manager key debounced");
          }
        } else {
          console.warn('Party Manager not available');
        }
        break;

      case "Backquote": // ` for FPS counter

        if (!event.repeat &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !(document.activeElement instanceof HTMLTextAreaElement)) {
          event.preventDefault(); // Prevent any default behavior
          this.toggleStats();
          this.monitorMemory();
        }
        break;

      case "ShiftLeft":
        this.moveState.shiftHeld = true;
        this.moveState.sprint = true;
        this.moveState.speed = 0.09; // 0.05 - running speed
        break;
      case "Space":
        // Initiate jump if not already jumping
        if (this.physics && !event.repeat) {
          const jumpStarted = this.physics.startJump();
          if (jumpStarted) {
            // Play jump sound if available
            if (this.jumpSound) {
              this.jumpSound.play();
            }
          }
        }
        break;
      // case "KeyC":
      //   if (!event.repeat) {
      //     this.renderState.clippingEnabled = !this.renderState.clippingEnabled;
      //     this.updateWallClipping();
      //   }
      //   break;
      case "KeyI":
        this.toggleInventory();
        break;
      case "KeyE":
        // Handle interactions
        if (this.nearestProp && !this.inventory.has(this.nearestProp.userData.id)) {
          // Pick up the prop
          const propData = {
            id: this.nearestProp.userData.id,
            name: this.nearestProp.userData.name || 'Prop',
            image: this.nearestProp.material?.map?.image?.src
          };

          this.addToInventory(propData);

          // Remove prop from scene
          this.scene.remove(this.nearestProp);
          this.nearestProp = null;

          // Hide prompt
          if (this.pickupPrompt) {
            this.pickupPrompt.style.display = 'none';
          }
        } else if (this.teleportPrompt && this.teleportPrompt.style.display === 'block') {
          this.executeTeleport();
        }
        else if (this.doorPrompt && this.doorPrompt.style.display === 'block') {
          this.executeDoorTeleport();
        }
        else if (this.nearestSplashArt && !this.activeSplashArt) {
          this.showSplashArt(this.nearestSplashArt);
        }
        else if (this.nearestEncounter) {
          this.handleEncounter(this.nearestEncounter);
        }
        break;
    }
  }

  handleKeyUp(event) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveState.forward = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveState.backward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveState.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveState.right = false;
        break;
      case "ShiftLeft":
        this.moveState.shiftHeld = false;
        if (!this.moveState.mouseRightDown) {
          this.moveState.sprint = false;
          this.moveState.speed = 0.025;
        }
        break;
    }
  }

  updateWallClipping() {
    this.scene.traverse((object) => {
      if (object.material && object.userData.isWall) {
        object.material.transparent = !this.renderState.clippingEnabled;
        object.material.opacity = this.renderState.clippingEnabled ? 1.0 : 0.8;
        object.material.side = this.renderState.clippingEnabled ? THREE.FrontSide : THREE.DoubleSide;
        object.material.needsUpdate = true;
      }
    });
  }

  setupMouseControls() {
    this.renderer.domElement.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    this.renderer.domElement.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        this.moveState.mouseRightDown = true;
        this.moveState.sprint = true;
        this.moveState.speed = 0.09; // 0.05 - running speed
      }
    });

    this.renderer.domElement.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.moveState.mouseRightDown = false;
        if (!this.moveState.shiftHeld) {
          this.moveState.sprint = false;
          this.moveState.speed = 0.025;
        }
      }
    });

    this.renderer.domElement.addEventListener("click", () => {
      this.controls.lock();
    });

    this.controls.addEventListener("lock", () => {
      this.renderer.domElement.style.cursor = "none";
    });

    this.controls.addEventListener("unlock", () => {
      this.renderer.domElement.style.cursor = "auto";
    });
  }

  pauseControls() {
    console.log("Pausing controls");

    // Save the current movement state
    this._savedMoveState = {
      forward: this.moveState.forward,
      backward: this.moveState.backward,
      left: this.moveState.left,
      right: this.moveState.right,
      sprint: this.moveState.sprint
    };

    // Stop all movement
    this.moveState.forward = false;
    this.moveState.backward = false;
    this.moveState.left = false;
    this.moveState.right = false;
    this.moveState.sprint = false;

    // Disable controls
    if (this.controls) {
      this.controls.enabled = false;

      // Unlock pointer if locked
      if (this.controls.isLocked) {
        this.controls.unlock();
      }
    }

    // Set a flag to indicate controls are paused
    this._controlsPaused = true;
  }

  resumeControls() {
    console.log("Resuming controls");

    // Only re-enable if we previously paused
    if (this._controlsPaused) {
      // Restore movement state if we saved it
      if (this._savedMoveState) {
        this.moveState.forward = this._savedMoveState.forward;
        this.moveState.backward = this._savedMoveState.backward;
        this.moveState.left = this._savedMoveState.left;
        this.moveState.right = this._savedMoveState.right;
        this.moveState.sprint = this._savedMoveState.sprint;
        this._savedMoveState = null;
      }

      // Re-enable controls
      if (this.controls) {
        this.controls.enabled = true;
      }

      this._controlsPaused = false;
    }
  }

  createRoomGeometry(room) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Add at the start of createRoomGeometry:
    const isWall = room.type === "wall";
    console.log("Room geometry creation:", {
      roomName: room.name,
      roomType: room.type,
      isWall: isWall
    });

    switch (room.shape) {
      case "circle": {
        const segments = 32;
        const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
        const centerX = (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2;
        const centerZ = (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2;

        if (isWall) {
          // For walls, create solid cylinder including top and bottom
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta);
            const z = Math.sin(theta);

            // Bottom vertices
            positions.push(
              centerX + radius * x,
              0,
              centerZ + radius * z
            );
            normals.push(x, 0, z);
            uvs.push(i / segments, 0);

            // Top vertices
            positions.push(
              centerX + radius * x,
              this.boxHeight,
              centerZ + radius * z
            );
            normals.push(x, 0, z);
            uvs.push(i / segments, 1);
          }

          // Create faces for cylinder walls
          for (let i = 0; i < segments; i++) {
            const base = i * 2;
            indices.push(
              base, base + 1, base + 2,
              base + 1, base + 3, base + 2
            );
          }

          // Add center vertices for top and bottom caps
          const bottomCenterIndex = positions.length / 3;
          positions.push(centerX, 0, centerZ);
          normals.push(0, -1, 0);
          uvs.push(0.5, 0.5);

          const topCenterIndex = positions.length / 3;
          positions.push(centerX, this.boxHeight, centerZ);
          normals.push(0, 1, 0);
          uvs.push(0.5, 0.5);

          // Add cap faces
          for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = ((i + 1) % segments) * 2;
            // Bottom cap
            indices.push(bottomCenterIndex, current, next);
            // Top cap
            indices.push(topCenterIndex, next + 1, current + 1);
          }
        } else {
          // Original hollow room code
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = centerX + radius * Math.cos(theta);
            const z = centerZ + radius * Math.sin(theta);

            positions.push(x, 0, z);
            positions.push(x, this.boxHeight, z);

            const normal = [Math.cos(theta), 0, Math.sin(theta)];
            normals.push(...normal, ...normal);

            uvs.push(i / segments, 0, i / segments, 1);
          }

          for (let i = 0; i < segments; i++) {
            const base = i * 2;
            indices.push(
              base, base + 1, base + 2,
              base + 1, base + 3, base + 2
            );
          }
        }
        break;
      }

      case "polygon": {
        if (!room.points || room.points.length < 3) return null;

        const baseZ = room.bounds.y / 50 - this.boxDepth / 2;
        const baseX = room.bounds.x / 50 - this.boxWidth / 2;

        if (isWall) {
          // Calculate scaling like rectangle case
          const heightRatio = 1.0;
          const scaleU = this.wallTexture
            ? room.bounds.width / this.wallTextureRoom.bounds.width
            : 1;
          const scaleV = this.wallTexture
            ? heightRatio * (this.boxHeight / this.wallTextureRoom.bounds.height)
            : 1;

          // Use texture repeats for vertical surfaces
          const textureRepeatsU = this.wallTexture
            ? this.wallTexture.repeat.x
            : 1;
          const textureRepeatsV = this.wallTexture
            ? this.wallTexture.repeat.y
            : 1;

          // Create points for the walls
          for (let i = 0; i < room.points.length; i++) {
            const point = room.points[i];
            const nextPoint = room.points[(i + 1) % room.points.length];
            const x1 = point.x / 50 + baseX;
            const z1 = point.y / 50 + baseZ;
            const x2 = nextPoint.x / 50 + baseX;
            const z2 = nextPoint.y / 50 + baseZ;

            // Add vertices for this wall segment
            positions.push(
              x1,
              0,
              z1, // bottom left
              x2,
              0,
              z2, // bottom right
              x2,
              this.boxHeight,
              z2, // top right
              x1,
              this.boxHeight,
              z1 // top left
            );

            // Calculate wall segment length for UV scaling
            const segmentLength = Math.sqrt(
              Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2)
            );
            const segmentScaleU =
              (segmentLength / (this.wallTextureRoom.bounds.width / 50)) *
              textureRepeatsU;

            // Add UVs for this segment, incorporating texture repeats
            uvs.push(
              0,
              0, // bottom left
              segmentScaleU,
              0, // bottom right
              segmentScaleU,
              textureRepeatsV, // top right
              0,
              textureRepeatsV // top left
            );

            // Add normals
            const dx = x2 - x1;
            const dz = z2 - z1;
            const length = Math.sqrt(dx * dx + dz * dz);
            const nx = dz / length;
            const nz = -dx / length;

            for (let j = 0; j < 4; j++) {
              normals.push(nx, 0, nz);
            }

            // Add indices for this segment
            const base = i * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }
        } else {
          // Original hollow room code
          room.points.forEach((point, i) => {
            const x = point.x / 50 + baseX;
            const z = point.y / 50 + baseZ;

            positions.push(x, 0, z);
            positions.push(x, this.boxHeight, z);

            normals.push(0, 0, 1, 0, 0, 1);

            uvs.push(i / room.points.length, 0);
            uvs.push(i / room.points.length, 1);
          });

          for (let i = 0; i < room.points.length; i++) {
            const next = (i + 1) % room.points.length;
            const base = i * 2;
            const nextBase = next * 2;

            indices.push(
              base,
              base + 1,
              nextBase,
              base + 1,
              nextBase + 1,
              nextBase
            );
          }
        }
        break;
      }

      default: {
        // rectangle
        const x1 = room.bounds.x / 50 - this.boxWidth / 2;
        const x2 = x1 + room.bounds.width / 50;
        const z1 = room.bounds.y / 50 - this.boxDepth / 2;
        const z2 = z1 + room.bounds.height / 50;

        if (isWall) {
          // Create solid box vertices
          positions.push(
            // Bottom face
            x1,
            0,
            z1,
            x2,
            0,
            z1,
            x2,
            0,
            z2,
            x1,
            0,
            z2,
            // Top face
            x1,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            // Front and back
            x1,
            0,
            z1,
            x2,
            0,
            z1,
            x2,
            this.boxHeight,
            z1,
            x1,
            this.boxHeight,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            // Left and right
            x1,
            0,
            z1,
            x1,
            0,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x2,
            this.boxHeight,
            z1
          );

          // Add corresponding normals for each face
          for (let i = 0; i < 4; i++) normals.push(0, -1, 0); // Bottom
          for (let i = 0; i < 4; i++) normals.push(0, 1, 0); // Top
          for (let i = 0; i < 4; i++) normals.push(0, 0, -1); // Front
          for (let i = 0; i < 4; i++) normals.push(0, 0, 1); // Back
          for (let i = 0; i < 4; i++) normals.push(-1, 0, 0); // Left
          for (let i = 0; i < 4; i++) normals.push(1, 0, 0); // Right

          const heightRatio = 1.0;
          const scaleU = this.wallTexture
            ? room.bounds.width / this.wallTextureRoom.bounds.width
            : 1;
          const scaleV = this.wallTexture
            ? heightRatio * (this.boxHeight / this.wallTextureRoom.bounds.height)
            : 1;

          // Get texture repeats
          const textureRepeatsU = this.wallTexture
            ? this.wallTexture.repeat.x
            : 1;
          const textureRepeatsV = this.wallTexture
            ? this.wallTexture.repeat.y
            : 1;

          // Bottom face
          uvs.push(
            0,
            0,
            textureRepeatsU,
            0,
            textureRepeatsU,
            textureRepeatsU,
            0,
            textureRepeatsU
          );
          // Top face
          uvs.push(
            0,
            0,
            textureRepeatsU,
            0,
            textureRepeatsU,
            textureRepeatsU,
            0,
            textureRepeatsU
          );

          // Front face (use width for U repeat)
          const widthRepeats =
            (Math.abs(x2 - x1) / (this.wallTextureRoom.bounds.width / 50)) *
            textureRepeatsU;
          uvs.push(
            0,
            0,
            widthRepeats,
            0,
            widthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );
          // Back face
          uvs.push(
            0,
            0,
            widthRepeats,
            0,
            widthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );

          // Left face (use depth for U repeat)
          const depthRepeats =
            (Math.abs(z2 - z1) / (this.wallTextureRoom.bounds.width / 50)) *
            textureRepeatsU;
          uvs.push(
            0,
            0,
            depthRepeats,
            0,
            depthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );
          // Right face
          uvs.push(
            0,
            0,
            depthRepeats,
            0,
            depthRepeats,
            textureRepeatsV,
            0,
            textureRepeatsV
          );

          // Add indices for each face (6 faces, 2 triangles each)
          for (let face = 0; face < 6; face++) {
            const base = face * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }
        } else {
          // Original hollow room code
          const wallVertices = [
            x1,
            0,
            z1,
            x1,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z2,
            x2,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            0,
            z1,
            x1,
            0,
            z2,
            x1,
            this.boxHeight,
            z2,
            x1,
            this.boxHeight,
            z1,
            x2,
            0,
            z1,
            x2,
            this.boxHeight,
            z1,
            x2,
            this.boxHeight,
            z2,
            x2,
            0,
            z2
          ];
          positions.push(...wallVertices);

          for (let i = 0; i < 4; i++) {
            const base = i * 4;
            indices.push(
              base,
              base + 1,
              base + 2,
              base,
              base + 2,
              base + 3
            );
          }

          for (let i = 0; i < wallVertices.length / 3; i++) {
            normals.push(0, 0, 1);
            uvs.push(i % 2, Math.floor(i / 2) % 2);
          }
        }
        break;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    geometry.setIndex(indices);

    const material = room.type === "wall"
      ? this.textureManager.createMaterial(room, this.wallTextureRoom)
      : this.textureManager.createMaterial(room, this.roomTextureRoom);

    return new THREE.Mesh(geometry, material);
  }

  // createRaisedBlockGeometry(room) {
  //   let geometry;
  //   const materials = [];

  //   // Side material (using wall texture)
  //   const sideMaterial = room.type === "wall" ?
  //     this.textureManager.createMaterial(room, this.wallTextureRoom) :
  //     new THREE.MeshStandardMaterial({
  //       color: 0xcccccc,
  //       roughness: 0.7,
  //       metalness: 0.2,
  //       side: THREE.DoubleSide
  //     });
  //   materials.push(sideMaterial);
  //   // Create and configure top texture
  //   const topTexture = this.createTextureFromArea(room);
  //   topTexture.center.set(0.5, 0.5); // Set rotation center to middle
  //   // Remove the rotation line
  //   // topTexture.repeat.set(1, 1); // Ensure 1:1 mapping
  //   if (topTexture.image && topTexture.image.width > 0) {
  //     topTexture.repeat.set(1, 1); // Ensure 1:1 mapping
  //     this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-topTexture');
  //     // topTexture.needsUpdate = true;
  //   }

  //   // Create top material with the configured texture
  //   const topMaterial = new THREE.MeshStandardMaterial({
  //     map: topTexture,
  //     roughness: 0.6,
  //     metalness: 0.1,
  //     side: THREE.DoubleSide
  //   });
  //   materials.push(topMaterial);

  //   // Bottom material (use same as sides)
  //   materials.push(sideMaterial);


  //   switch (room.shape) {


  //     case "circle": {
  //       // Only update the texture if it has valid data
  //       if (topTexture && topTexture.image) {
  //         topTexture.rotation = Math.PI / 2;
  //         this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-circle-topTexture');
  //         // topTexture.needsUpdate = true;
  //       }

  //       const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
  //       geometry = new THREE.CylinderGeometry(radius, radius, room.blockHeight, 32);
  //       geometry.rotateZ(0);  // Keep it horizontal

  //       // Move up by half the block height
  //       geometry.translate(0, room.blockHeight / 2, 0);
  //       break;
  //     }

  //     case "polygon": {
  //       if (!room.points || room.points.length < 3) return null;

  //       // Swap materials first
  //       const tempMaterial = materials[0];
  //       materials[0] = materials[1];
  //       materials[1] = tempMaterial;

  //       const shape = new THREE.Shape();

  //       // Calculate bounds for UV mapping
  //       const minX = Math.min(...room.points.map(p => p.x));
  //       const maxX = Math.max(...room.points.map(p => p.x));
  //       const minY = Math.min(...room.points.map(p => p.y));
  //       const maxY = Math.max(...room.points.map(p => p.y));
  //       const width = maxX - minX;
  //       const height = maxY - minY;

  //       // Create shape with normalized coordinates
  //       room.points.forEach((point, index) => {
  //         const x = (point.x - minX) / 50;
  //         const y = -(point.y - minY) / 50;  // Flip Y and normalize
  //         if (index === 0) shape.moveTo(x, y);
  //         else shape.lineTo(x, y);
  //       });
  //       shape.closePath();

  //       geometry = new THREE.ExtrudeGeometry(shape, {
  //         depth: room.blockHeight,
  //         bevelEnabled: false,
  //         UVGenerator: {
  //           generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
  //             const vA = new THREE.Vector3(vertices[indexA * 3], vertices[indexA * 3 + 1], vertices[indexA * 3 + 2]);
  //             const vB = new THREE.Vector3(vertices[indexB * 3], vertices[indexB * 3 + 1], vertices[indexB * 3 + 2]);
  //             const vC = new THREE.Vector3(vertices[indexC * 3], vertices[indexC * 3 + 1], vertices[indexC * 3 + 2]);

  //             return [
  //               new THREE.Vector2(vA.x / width * 50, vA.y / height * 50),
  //               new THREE.Vector2(vB.x / width * 50, vB.y / height * 50),
  //               new THREE.Vector2(vC.x / width * 50, vC.y / height * 50)
  //             ];
  //           },
  //           generateSideWallUV: function (geometry, vertices, indexA, indexB, indexC, indexD) {
  //             return [
  //               new THREE.Vector2(0, 0),
  //               new THREE.Vector2(1, 0),
  //               new THREE.Vector2(1, 1),
  //               new THREE.Vector2(0, 1)
  //             ];
  //           }
  //         }
  //       });

  //       geometry.rotateX(-Math.PI / 2);

  //       const topBottomFaces = room.points.length - 2;
  //       const sideFaces = room.points.length * 2;

  //       geometry.clearGroups();
  //       geometry.addGroup(0, sideFaces * 3, 0);
  //       geometry.addGroup(sideFaces * 3, topBottomFaces * 3, 1);
  //       geometry.addGroup((sideFaces + topBottomFaces) * 3, topBottomFaces * 3, 2);

  //       break;
  //     }

  //     default: {
  //       // Rectangle case
  //       const positions = [];
  //       const normals = [];
  //       const uvs = [];
  //       const indices = [];
  //       // Keep track of where each face starts for material mapping
  //       const materialGroups = [];
  //       let faceCount = 0;

  //       const x1 = room.bounds.x / 50 - this.boxWidth / 2;
  //       const x2 = x1 + room.bounds.width / 50;
  //       const z1 = room.bounds.y / 50 - this.boxDepth / 2;
  //       const z2 = z1 + room.bounds.height / 50;
  //       const height = room.blockHeight;

  //       // Create and configure top texture
  //       // topTexture.repeat.set(1, -1);  // Flip vertically by setting Y to negative

  //       topTexture.repeat.set(1, -1);
  //       // if (canvas.width > 0 && canvas.height > 0) {
  //       //   topTexture.needsUpdate = true;
  //       // }
  //       // topTexture.needsUpdate = true;
  //       this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-default-topTexture');

  //       // All vertices remain the same
  //       positions.push(
  //         // Bottom face
  //         x1, 0, z1,
  //         x2, 0, z1,
  //         x2, 0, z2,
  //         x1, 0, z2,
  //         // Top face
  //         x1, height, z1,
  //         x2, height, z1,
  //         x2, height, z2,
  //         x1, height, z2,
  //         // Front
  //         x1, 0, z1,
  //         x2, 0, z1,
  //         x2, height, z1,
  //         x1, height, z1,
  //         // Back
  //         x1, 0, z2,
  //         x2, 0, z2,
  //         x2, height, z2,
  //         x1, height, z2,
  //         // Left
  //         x1, 0, z1,
  //         x1, 0, z2,
  //         x1, height, z2,
  //         x1, height, z1,
  //         // Right
  //         x2, 0, z1,
  //         x2, 0, z2,
  //         x2, height, z2,
  //         x2, height, z1
  //       );

  //       // Normals stay the same
  //       for (let i = 0; i < 4; i++) normals.push(0, -1, 0);  // Bottom
  //       for (let i = 0; i < 4; i++) normals.push(0, 1, 0);   // Top
  //       for (let i = 0; i < 4; i++) normals.push(0, 0, -1);  // Front
  //       for (let i = 0; i < 4; i++) normals.push(0, 0, 1);   // Back
  //       for (let i = 0; i < 4; i++) normals.push(-1, 0, 0);  // Left
  //       for (let i = 0; i < 4; i++) normals.push(1, 0, 0);   // Right

  //       // UVs for each face
  //       const textureRepeatsU = this.wallTexture ? this.wallTexture.repeat.x : 1;
  //       const textureRepeatsV = this.wallTexture ? this.wallTexture.repeat.y : 1;

  //       // Add UVs for each face
  //       for (let face = 0; face < 6; face++) {
  //         uvs.push(
  //           0, 0,
  //           textureRepeatsU, 0,
  //           textureRepeatsU, textureRepeatsV,
  //           0, textureRepeatsV
  //         );
  //       }

  //       // Add indices with material groups
  //       // Bottom face (material index 2)
  //       materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 2 });
  //       indices.push(0, 1, 2, 0, 2, 3);
  //       faceCount += 2;

  //       // Top face (material index 1)
  //       materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 1 });
  //       indices.push(4, 5, 6, 4, 6, 7);
  //       faceCount += 2;

  //       // Side faces (material index 0)
  //       materialGroups.push({ startIndex: faceCount * 3, count: 24, materialIndex: 0 });
  //       for (let face = 2; face < 6; face++) {
  //         const base = face * 4;
  //         indices.push(
  //           base, base + 1, base + 2,
  //           base, base + 2, base + 3
  //         );
  //         faceCount += 2;
  //       }

  //       geometry = new THREE.BufferGeometry();
  //       geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  //       geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  //       geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  //       geometry.setIndex(indices);

  //       // Add material groups to geometry
  //       materialGroups.forEach(group => {
  //         geometry.addGroup(group.startIndex, group.count, group.materialIndex);
  //       });

  //       break;
  //     }
  //   }

  //   const mesh = new THREE.Mesh(geometry, materials);

  //   // Position mesh correctly based on room bounds
  //   if (room.shape === "polygon") {
  //     mesh.position.set(
  //       room.bounds.x / 50 - this.boxWidth / 2,  // Use absolute position
  //       0,
  //       room.bounds.y / 50 - this.boxDepth / 2
  //     );
  //   } else if (room.shape === "circle") {
  //     mesh.position.set(
  //       (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2,
  //       0,
  //       (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2
  //     );

  //   } else {
  //     mesh.position.set(0, 0, 0);
  //   }

  //   return mesh;
  // }

  // non halfblock stairstepping code, does not work
  // the polygon code may be able to be salvaged for terrain generation
  createRaisedBlockGeometry(room) {
    let geometry;
    const materials = [];
  
    // Side material (using wall texture)
    const sideMaterial = room.type === "wall" ?
      this.textureManager.createMaterial(room, this.wallTextureRoom) :
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
    materials.push(sideMaterial);
    
    // Create and configure top texture
    const topTexture = this.createTextureFromArea(room);
    topTexture.center.set(0.5, 0.5); // Set rotation center to middle
    // Remove the rotation line
    // topTexture.repeat.set(1, 1); // Ensure 1:1 mapping
    if (topTexture.image && topTexture.image.width > 0) {
      topTexture.repeat.set(1, 1); // Ensure 1:1 mapping
      this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-topTexture');
      // topTexture.needsUpdate = true;
    }
  
    // Create top material with the configured texture
    const topMaterial = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    materials.push(topMaterial);
  
    // Bottom material (use same as sides)
    materials.push(sideMaterial);
  
    // Check if this is a "slope" (we'll make it into stairs)
    const isSlope = room.isSlope === true;
    let slopeDirection = room.slopeDirection || 'east';
    let slopeStartHeight = parseFloat(room.slopeStartHeight) || 0;
    let slopeEndHeight = parseFloat(room.slopeEndHeight) || 1;
  
    // Calculate number of steps based on height difference
    const heightDiff = Math.abs(slopeEndHeight - slopeStartHeight);
    const numSteps = Math.max(1, Math.ceil(heightDiff * 2)); // 2 steps per block height
    
    if (isSlope) {
      // We'll create a group to hold all step blocks
      const stairsGroup = new THREE.Group();
      
      // Handle different shapes
      if (room.shape === "circle") {
        // For circles, create concentric stepped cylinders
        const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
        const segments = 32;
        
        for (let i = 0; i < numSteps; i++) {
          // Calculate height of this step
          const stepHeight = slopeStartHeight + (slopeEndHeight - slopeStartHeight) * (i / (numSteps - 1));
          
          // Calculate radius for this step (to create concentric circles)
          const innerRadius = radius * (1 - (i / numSteps));
          const outerRadius = radius * (1 - ((i-1) / numSteps));
          
          // Create cylinder for this step
          const stepGeometry = new THREE.CylinderGeometry(
            innerRadius,
            innerRadius,
            stepHeight, 
            segments
          );
          
          // Position the step cylinder
          stepGeometry.translate(0, stepHeight / 2, 0);
          
          // Create mesh and add to group
          const stepMesh = new THREE.Mesh(stepGeometry, materials);
          
          // Add metadata for physics
          stepMesh.userData = {
            isWall: true,
            isRaisedBlock: true,
            blockHeight: stepHeight
          };
          
          stairsGroup.add(stepMesh);
        }
        
        // Position the stair group
        stairsGroup.position.set(
          (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2,
          0,
          (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2
        );
        
        // Return the group instead of a single mesh
        stairsGroup.userData = {
          isSlope: true,
          isStairs: true,
          slopeDirection: slopeDirection,
          slopeStartHeight: slopeStartHeight,
          slopeEndHeight: slopeEndHeight
        };
        
        return stairsGroup;
      }
      else if (room.shape === "polygon") {
        // For polygons, we'll create a series of extruded shapes
        if (!room.points || room.points.length < 3) return null;
        
        // Swap materials first
        const tempMaterial = materials[0];
        materials[0] = materials[1];
        materials[1] = tempMaterial;
        
        // Calculate bounds for UV mapping
        const minX = Math.min(...room.points.map(p => p.x));
        const maxX = Math.max(...room.points.map(p => p.x));
        const minY = Math.min(...room.points.map(p => p.y));
        const maxY = Math.max(...room.points.map(p => p.y));
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Create the base shape
        const shape = new THREE.Shape();
        room.points.forEach((point, index) => {
          const x = (point.x - minX) / 50;
          const y = -(point.y - minY) / 50;  // Flip Y and normalize
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();
        
        // Position for the polygon
        const posX = room.bounds.x / 50 - this.boxWidth / 2;
        const posZ = room.bounds.y / 50 - this.boxDepth / 2;
        
        // Calculate step positions based on direction
        for (let i = 0; i < numSteps; i++) {
          // Calculate height for this step
          const stepHeight = slopeStartHeight + (i / (numSteps - 1)) * (slopeEndHeight - slopeStartHeight);
          
          // Create step geometry
          const extrudeSettings = {
            depth: stepHeight,
            bevelEnabled: false,
            UVGenerator: {
              generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
                const vA = new THREE.Vector3(vertices[indexA * 3], vertices[indexA * 3 + 1], vertices[indexA * 3 + 2]);
                const vB = new THREE.Vector3(vertices[indexB * 3], vertices[indexB * 3 + 1], vertices[indexB * 3 + 2]);
                const vC = new THREE.Vector3(vertices[indexC * 3], vertices[indexC * 3 + 1], vertices[indexC * 3 + 2]);
  
                return [
                  new THREE.Vector2(vA.x / width * 50, vA.y / height * 50),
                  new THREE.Vector2(vB.x / width * 50, vB.y / height * 50),
                  new THREE.Vector2(vC.x / width * 50, vC.y / height * 50)
                ];
              },
              generateSideWallUV: function (geometry, vertices, indexA, indexB, indexC, indexD) {
                return [
                  new THREE.Vector2(0, 0),
                  new THREE.Vector2(1, 0),
                  new THREE.Vector2(1, 1),
                  new THREE.Vector2(0, 1)
                ];
              }
            }
          };
          
          // Calculate scale factor for this step
          const scaleFactor = 1 - (i / numSteps) * 0.8;
          
          // Create a scaled version of the shape for this step
          const scaledShape = new THREE.Shape();
          room.points.forEach((point, index) => {
            // Scale around center
            const centerX = (maxX + minX) / 2;
            const centerY = (maxY + minY) / 2;
            
            const scaledX = centerX + (point.x - centerX) * scaleFactor;
            const scaledY = centerY + (point.y - centerY) * scaleFactor;
            
            const x = (scaledX - minX) / 50;
            const y = -(scaledY - minY) / 50;
            
            if (index === 0) scaledShape.moveTo(x, y);
            else scaledShape.lineTo(x, y);
          });
          scaledShape.closePath();
          
          const stepGeometry = new THREE.ExtrudeGeometry(scaledShape, extrudeSettings);
          stepGeometry.rotateX(-Math.PI / 2);
          
          // Create material groups
          const topBottomFaces = room.points.length - 2;
          const sideFaces = room.points.length * 2;
  
          stepGeometry.clearGroups();
          stepGeometry.addGroup(0, sideFaces * 3, 0);
          stepGeometry.addGroup(sideFaces * 3, topBottomFaces * 3, 1);
          stepGeometry.addGroup((sideFaces + topBottomFaces) * 3, topBottomFaces * 3, 2);
          
          // Create step mesh
          const stepMesh = new THREE.Mesh(stepGeometry, materials);
          
          // Add metadata for physics
          stepMesh.userData = {
            isWall: true,
            isRaisedBlock: true,
            blockHeight: stepHeight
          };
          
          stairsGroup.add(stepMesh);
        }
        
        // Position the stairs group
        stairsGroup.position.set(posX, 0, posZ);
        
        // Store metadata
        stairsGroup.userData = {
          isSlope: true,
          isStairs: true,
          slopeDirection: slopeDirection,
          slopeStartHeight: slopeStartHeight,
          slopeEndHeight: slopeEndHeight
        };
        
        return stairsGroup;
      }
// For rectangles, create a series of independent half-blocks
const x1 = room.bounds.x / 50 - this.boxWidth / 2;
const x2 = x1 + room.bounds.width / 50;
const z1 = room.bounds.y / 50 - this.boxDepth / 2;
const z2 = z1 + room.bounds.height / 50;

// We'll keep using numSteps to determine how many steps to create
const heightDiff = Math.abs(slopeEndHeight - slopeStartHeight);
const numSteps = Math.max(1, Math.ceil(heightDiff * 2)); // 2 steps per block height

// Set the appropriate step size based on direction
let stepSizeX = room.bounds.width / 50 / numSteps;
let stepSizeZ = room.bounds.height / 50 / numSteps;

let steps = [];

// Set up steps based on direction
switch (slopeDirection) {
    case 'north': // Steps go from south (z2) to north (z1)
        for (let i = 0; i < numSteps; i++) {
            // Calculate step position
            const stepZ = z2 - (i + 1) * stepSizeZ;
            // Calculate step height (from low to high)
            const stepHeight = slopeStartHeight + (i / (numSteps - 1)) * (slopeEndHeight - slopeStartHeight);
            
            // Create half-block for this step
            steps.push({
                x: x1,
                z: stepZ,
                width: room.bounds.width / 50,
                depth: stepSizeZ,
                height: stepHeight + 0.5 // Half-block = 0.5 blocks
            });
        }
        break;
        
    case 'east': // Steps go from west (x1) to east (x2)
        for (let i = 0; i < numSteps; i++) {
            // Calculate step position
            const stepX = x1 + i * stepSizeX;
            // Calculate step height (from low to high)
            const stepHeight = slopeStartHeight + (i / (numSteps - 1)) * (slopeEndHeight - slopeStartHeight);
            
            // Create half-block for this step
            steps.push({
                x: stepX,
                z: z1,
                width: stepSizeX,
                depth: room.bounds.height / 50,
                height: stepHeight + 0.5 // Half-block = 0.5 blocks
            });
        }
        break;
        
    case 'south': // Steps go from north (z1) to south (z2)
        for (let i = 0; i < numSteps; i++) {
            // Calculate step position
            const stepZ = z1 + i * stepSizeZ;
            // Calculate step height (from low to high)
            const stepHeight = slopeStartHeight + (i / (numSteps - 1)) * (slopeEndHeight - slopeStartHeight);
            
            // Create half-block for this step
            steps.push({
                x: x1,
                z: stepZ,
                width: room.bounds.width / 50,
                depth: stepSizeZ,
                height: stepHeight + 0.5 // Half-block = 0.5 blocks
            });
        }
        break;
        
    case 'west': // Steps go from east (x2) to west (x1)
        for (let i = 0; i < numSteps; i++) {
            // Calculate step position
            const stepX = x2 - (i + 1) * stepSizeX;
            // Calculate step height (from low to high)
            const stepHeight = slopeStartHeight + (i / (numSteps - 1)) * (slopeEndHeight - slopeStartHeight);
            
            // Create half-block for this step
            steps.push({
                x: stepX,
                z: z1,
                width: stepSizeX,
                depth: room.bounds.height / 50,
                height: stepHeight + 0.5 // Half-block = 0.5 blocks
            });
        }
        break;
}

// Now create the individual blocks for each step
for (const step of steps) {
    // Create step geometry
    const stepPositions = [];
    const stepNormals = [];
    const stepUVs = [];
    const stepIndices = [];
    
    // Create a box for this step
    // Bottom face vertices
    stepPositions.push(
        0, 0, 0,                 // Bottom left front
        step.width, 0, 0,        // Bottom right front
        step.width, 0, step.depth, // Bottom right back
        0, 0, step.depth         // Bottom left back
    );
    
    // Top face vertices
    stepPositions.push(
        0, step.height, 0,                 // Top left front
        step.width, step.height, 0,        // Top right front
        step.width, step.height, step.depth, // Top right back
        0, step.height, step.depth         // Top left back
    );
    
    // Add front face vertices
    stepPositions.push(
        0, 0, 0,                   // Bottom left
        step.width, 0, 0,          // Bottom right
        step.width, step.height, 0,  // Top right
        0, step.height, 0           // Top left
    );
    
    // Add back face vertices
    stepPositions.push(
        0, 0, step.depth,                   // Bottom left
        step.width, 0, step.depth,          // Bottom right
        step.width, step.height, step.depth,  // Top right
        0, step.height, step.depth           // Top left
    );
    
    // Add left face vertices
    stepPositions.push(
        0, 0, 0,                     // Bottom front
        0, 0, step.depth,            // Bottom back
        0, step.height, step.depth,    // Top back
        0, step.height, 0             // Top front
    );
    
    // Add right face vertices
    stepPositions.push(
        step.width, 0, 0,                     // Bottom front
        step.width, 0, step.depth,            // Bottom back
        step.width, step.height, step.depth,    // Top back
        step.width, step.height, 0             // Top front
    );
    
    // Add normals
    for (let j = 0; j < 4; j++) stepNormals.push(0, -1, 0);  // Bottom face
    for (let j = 0; j < 4; j++) stepNormals.push(0, 1, 0);   // Top face
    for (let j = 0; j < 4; j++) stepNormals.push(0, 0, -1);  // Front face
    for (let j = 0; j < 4; j++) stepNormals.push(0, 0, 1);   // Back face
    for (let j = 0; j < 4; j++) stepNormals.push(-1, 0, 0);  // Left face
    for (let j = 0; j < 4; j++) stepNormals.push(1, 0, 0);   // Right face
    
    // Add UVs
    for (let face = 0; face < 6; face++) {
        stepUVs.push(
            0, 0,
            1, 0,
            1, 1,
            0, 1
        );
    }
    
    // Add indices
    for (let face = 0; face < 6; face++) {
        const base = face * 4;
        stepIndices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
        );
    }
    
    // Create buffer geometry
    const stepGeometry = new THREE.BufferGeometry();
    stepGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stepPositions, 3));
    stepGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(stepNormals, 3));
    stepGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(stepUVs, 2));
    stepGeometry.setIndex(stepIndices);
    
    // Add material groups
    stepGeometry.clearGroups();
    stepGeometry.addGroup(0, 6, 2);  // Bottom face
    stepGeometry.addGroup(6, 6, 1);  // Top face
    stepGeometry.addGroup(12, 24, 0); // Side faces
    
    // Create mesh
    const stepMesh = new THREE.Mesh(stepGeometry, materials);
    
    // Position the step
    stepMesh.position.set(step.x, 0, step.z);
    
    // Add metadata for physics - use fixed 0.5 for block height
    stepMesh.userData = {
        isWall: true,
        isRaisedBlock: true,
        blockHeight: step.height - 0.5  // Adjust so the height is from ground
    };
    
    // Add to group
    stairsGroup.add(stepMesh);
    }
    return stairsGroup;  
  }
  
    switch (room.shape) {
      case "circle": {
        // Only update the texture if it has valid data
        if (topTexture && topTexture.image) {
          topTexture.rotation = Math.PI / 2;
          this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-circle-topTexture');
          // topTexture.needsUpdate = true;
        }
  
        const radius = Math.max(room.bounds.width, room.bounds.height) / 100;
        
        geometry = new THREE.CylinderGeometry(radius, radius, room.blockHeight, 32);
        geometry.rotateZ(0);  // Keep it horizontal
        
        // Move up by half the block height
        geometry.translate(0, room.blockHeight / 2, 0);
        break;
      }
  
      case "polygon": {
        if (!room.points || room.points.length < 3) return null;
  
        // Swap materials first
        const tempMaterial = materials[0];
        materials[0] = materials[1];
        materials[1] = tempMaterial;
  
        const shape = new THREE.Shape();
  
        // Calculate bounds for UV mapping
        const minX = Math.min(...room.points.map(p => p.x));
        const maxX = Math.max(...room.points.map(p => p.x));
        const minY = Math.min(...room.points.map(p => p.y));
        const maxY = Math.max(...room.points.map(p => p.y));
        const width = maxX - minX;
        const height = maxY - minY;
  
        // Create shape with normalized coordinates
        room.points.forEach((point, index) => {
          const x = (point.x - minX) / 50;
          const y = -(point.y - minY) / 50;  // Flip Y and normalize
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();
  
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: room.blockHeight,
          bevelEnabled: false,
          UVGenerator: {
            generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
              const vA = new THREE.Vector3(vertices[indexA * 3], vertices[indexA * 3 + 1], vertices[indexA * 3 + 2]);
              const vB = new THREE.Vector3(vertices[indexB * 3], vertices[indexB * 3 + 1], vertices[indexB * 3 + 2]);
              const vC = new THREE.Vector3(vertices[indexC * 3], vertices[indexC * 3 + 1], vertices[indexC * 3 + 2]);
  
              return [
                new THREE.Vector2(vA.x / width * 50, vA.y / height * 50),
                new THREE.Vector2(vB.x / width * 50, vB.y / height * 50),
                new THREE.Vector2(vC.x / width * 50, vC.y / height * 50)
              ];
            },
            generateSideWallUV: function (geometry, vertices, indexA, indexB, indexC, indexD) {
              return [
                new THREE.Vector2(0, 0),
                new THREE.Vector2(1, 0),
                new THREE.Vector2(1, 1),
                new THREE.Vector2(0, 1)
              ];
            }
          }
        });
  
        geometry.rotateX(-Math.PI / 2);
  
        const topBottomFaces = room.points.length - 2;
        const sideFaces = room.points.length * 2;
  
        geometry.clearGroups();
        geometry.addGroup(0, sideFaces * 3, 0);
        geometry.addGroup(sideFaces * 3, topBottomFaces * 3, 1);
        geometry.addGroup((sideFaces + topBottomFaces) * 3, topBottomFaces * 3, 2);
        
        break;
      }
  
      default: {
        // Rectangle case
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        // Keep track of where each face starts for material mapping
        const materialGroups = [];
        let faceCount = 0;
  
        const x1 = room.bounds.x / 50 - this.boxWidth / 2;
        const x2 = x1 + room.bounds.width / 50;
        const z1 = room.bounds.y / 50 - this.boxDepth / 2;
        const z2 = z1 + room.bounds.height / 50;
        const height = room.blockHeight;
  
        // Create and configure top texture
        // topTexture.repeat.set(1, -1);  // Flip vertically by setting Y to negative
  
        topTexture.repeat.set(1, -1);
        // if (canvas.width > 0 && canvas.height > 0) {
        //   topTexture.needsUpdate = true;
        // }
        // topTexture.needsUpdate = true;
        this.safeUpdateTexture(topTexture, 'createRaisedBlockGeometry-default-topTexture');
  
        positions.push(
          // Bottom face
          x1, 0, z1,
          x2, 0, z1,
          x2, 0, z2,
          x1, 0, z2,
          // Top face
          x1, height, z1,
          x2, height, z1,
          x2, height, z2,
          x1, height, z2,
          // Front
          x1, 0, z1,
          x2, 0, z1,
          x2, height, z1,
          x1, height, z1,
          // Back
          x1, 0, z2,
          x2, 0, z2,
          x2, height, z2,
          x1, height, z2,
          // Left
          x1, 0, z1,
          x1, 0, z2,
          x1, height, z2,
          x1, height, z1,
          // Right
          x2, 0, z1,
          x2, 0, z2,
          x2, height, z2,
          x2, height, z1
        );
  
        // Normals stay the same regardless of slope (we'll compute them correctly later)
        for (let i = 0; i < 4; i++) normals.push(0, -1, 0);  // Bottom
        for (let i = 0; i < 4; i++) normals.push(0, 1, 0);   // Top
        for (let i = 0; i < 4; i++) normals.push(0, 0, -1);  // Front
        for (let i = 0; i < 4; i++) normals.push(0, 0, 1);   // Back
        for (let i = 0; i < 4; i++) normals.push(-1, 0, 0);  // Left
        for (let i = 0; i < 4; i++) normals.push(1, 0, 0);   // Right
  
        // UVs for each face
        const textureRepeatsU = this.wallTexture ? this.wallTexture.repeat.x : 1;
        const textureRepeatsV = this.wallTexture ? this.wallTexture.repeat.y : 1;
  
        // Add UVs for each face
        for (let face = 0; face < 6; face++) {
          uvs.push(
            0, 0,
            textureRepeatsU, 0,
            textureRepeatsU, textureRepeatsV,
            0, textureRepeatsV
          );
        }
  
        // Add indices with material groups
        // Bottom face (material index 2)
        materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 2 });
        indices.push(0, 1, 2, 0, 2, 3);
        faceCount += 2;
  
        // Top face (material index 1)
        materialGroups.push({ startIndex: faceCount * 3, count: 6, materialIndex: 1 });
        indices.push(4, 5, 6, 4, 6, 7);
        faceCount += 2;
  
        // Side faces (material index 0)
        materialGroups.push({ startIndex: faceCount * 3, count: 24, materialIndex: 0 });
        for (let face = 2; face < 6; face++) {
          const base = face * 4;
          indices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
          );
          faceCount += 2;
        }
  
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
  
        // Add material groups to geometry
        materialGroups.forEach(group => {
          geometry.addGroup(group.startIndex, group.count, group.materialIndex);
        });
  
        break;
      }
    }
  
    const mesh = new THREE.Mesh(geometry, materials);
  
    // Position mesh correctly based on room bounds
    if (room.shape === "polygon") {
      mesh.position.set(
        room.bounds.x / 50 - this.boxWidth / 2,  // Use absolute position
        0,
        room.bounds.y / 50 - this.boxDepth / 2
      );
    } else if (room.shape === "circle") {
      mesh.position.set(
        (room.bounds.x + room.bounds.width / 2) / 50 - this.boxWidth / 2,
        0,
        (room.bounds.y + room.bounds.height / 2) / 50 - this.boxDepth / 2
      );
  
    } else {
      mesh.position.set(0, 0, 0);
    }
    
    // Store slope information with the mesh for physics
    if (isSlope) {
      mesh.userData.isSlope = true;
      mesh.userData.slopeDirection = slopeDirection;
      mesh.userData.slopeStartHeight = slopeStartHeight;
      mesh.userData.slopeEndHeight = slopeEndHeight;
    }
  
    return mesh;
  }


  getMonsterTokenData(marker) {

    if (!marker || !marker.data || !marker.data.monster) {
      console.log("Invalid marker data");
      return null;
    }

    // Get token info - ensure we always have a valid token source
    let tokenSource = null;

    if (marker.data.monster.token) {
      tokenSource = marker.data.monster.token.data || marker.data.monster.token.url;
    }

    // If no token source available, generate a default placeholder image
    if (!tokenSource) {
      console.log("No token source found, generating placeholder image");

      // Create a placeholder canvas
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      // Fill with a color based on monster name
      const monsterName = marker.data.monster.basic?.name || "Unknown Monster";
      const hashCode = monsterName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);

      // Generate a color from the hash
      const hue = Math.abs(hashCode) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(0, 0, 64, 64);

      // Add border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 60, 60);

      // Add text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(monsterName.charAt(0).toUpperCase(), 32, 32);

      // Convert to data URL
      tokenSource = canvas.toDataURL('image/webp');
    }

    // console.log("Token image source type:", {
    //   isBase64: tokenSource.startsWith('data:'),
    //   length: tokenSource.length,
    //   preview: tokenSource.substring(0, 100) + '...'
    // });

    const monsterSize = this.getMonsterSizeInSquares(marker.data.monster.basic?.size || "medium");
    const tokenData = {
      x: marker.x,
      y: marker.y,
      size: monsterSize,
      image: tokenSource,
      type: "monster",
      name: marker.data.monster.basic?.name || "Unknown Monster",
      height: 2 * monsterSize
    };

    console.log("Created token data:", {
      position: `${tokenData.x}, ${tokenData.y}`,
      size: tokenData.size,
      height: tokenData.height,
      hasImage: !!tokenData.image
    });

    return tokenData;
  }


  getMonsterSizeInSquares(size) {
    // Add debug logging
    console.log("Getting monster size for:", size);

    // Handle undefined/null size
    if (!size) {
      console.log("Size undefined, defaulting to medium");
      return 1; // Default to medium size
    }

    const sizeMap = {
      tiny: 0.5, // 2.5ft
      small: 1, // 5ft
      medium: 1, // 5ft
      large: 2, // 10ft (2x2)
      huge: 3, // 15ft (3x3)
      gargantuan: 4 // 20ft (4x4)
    };

    const calculatedSize = sizeMap[size.toLowerCase()] || 1;
    console.log("Calculated size:", calculatedSize);
    return calculatedSize;
  }

  getHighestElevationAtPoint(x, z) {
    let maxElevation = 0;
    let insideWall = false;
    let elevationSource = null;

    console.log("Checking elevation at:", { x, z });

    this.rooms.forEach(room => {
      const roomX = room.bounds.x / 50 - this.boxWidth / 2;
      const roomZ = room.bounds.y / 50 - this.boxDepth / 2;
      const roomWidth = room.bounds.width / 50;
      const roomDepth = room.bounds.height / 50;

      if (x >= roomX && x <= roomX + roomWidth &&
        z >= roomZ && z <= roomZ + roomDepth) {

        if (room.isRaisedBlock && room.blockHeight) {
          const blockHeight = room.blockHeight;
          if (blockHeight > maxElevation) {
            maxElevation = blockHeight;
            elevationSource = 'raised block';
            console.log("New max height from raised block:", blockHeight);
          }
        }

        if (room.type === 'wall' && !room.isRaisedBlock) {
          const wallHeight = this.boxHeight || 4;
          if (wallHeight > maxElevation) {
            maxElevation = wallHeight;
            elevationSource = 'wall';
            insideWall = true;
            console.log("New max height from wall:", wallHeight);
          }
        }
      }
    });

    console.log("Final elevation calculation:", {
      height: maxElevation,
      source: elevationSource || 'ground level',
      insideWall
    });

    return {
      elevation: maxElevation,
      insideWall,
      source: elevationSource || 'ground level'
    };
  }

  getElevationAtPoint(x, z) {
    let elevation = 0;
    let isInside = false;

    // Check all rooms/walls
    this.rooms.forEach(room => {
      // Skip non-wall and non-raised blocks
      if (!room.isRaisedBlock && room.type !== 'wall') return;

      // Check if point is within bounds
      const roomX = room.bounds.x / 50 - this.boxWidth / 2;
      const roomZ = room.bounds.y / 50 - this.boxDepth / 2;
      const roomWidth = room.bounds.width / 50;
      const roomDepth = room.bounds.height / 50;

      const isPointInside = this.isPointInRectangle(
        x, z,
        roomX, roomZ,
        roomX + roomWidth, roomZ + roomDepth
      );

      if (isPointInside) {
        if (room.isRaisedBlock) {
          // For raised blocks, we increase elevation
          elevation = Math.max(elevation, room.blockHeight || 0);
        } else if (room.isRegularWall) {
          // For regular walls, consider top surface at boxHeight
          // but only if the current elevation is near the top
          const wallHeight = this.boxHeight || 4;
          if (Math.abs(elevation - wallHeight) < 0.3) {
            elevation = wallHeight;
          } else {
            // Inside wall but not on top
            isInside = true;
          }
        } else if (room.type === 'wall' && !room.isRaisedBlock) {
          // For regular walls (backward compatibility), mark as inside
          isInside = true;
        }
      }
    });

    return { elevation, isInside };
  }




  isPointInRectangle(px, pz, x1, z1, x2, z2) {
    return px >= x1 && px <= x2 && pz >= z1 && pz <= z2;
  }

  isPointInPolygon(px, pz, vertices) {
    // Ray-casting algorithm
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, zi = vertices[i].y;
      const xj = vertices[j].x, zj = vertices[j].y;

      const intersect = ((zi > pz) !== (zj > pz)) &&
        (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }


  async processAllMarkers() {
    if (!this.markers || this.markers.length === 0) {
      console.log("No markers to process");
      return;
    }

    console.log(`Processing ${this.markers.length} markers...`);

    // 1. Process each marker type properly
    const propPromises = [];

    for (const marker of this.markers) {
      // Skip invalid markers
      if (!marker || !marker.type) continue;

      // Process based on marker type
      switch (marker.type) {
        case "encounter":
          if (marker.data?.monster) {
            console.log(`Processing encounter marker: ${marker.data.monster.basic?.name || "Unknown"}`);
            const tokenData = this.getMonsterTokenData(marker);
            if (tokenData) {
              const mesh = this.createTokenMesh(tokenData);
              if (mesh) {
                // Add encounter type to userData
                mesh.userData = {
                  type: 'encounter',
                  monster: marker.data.monster
                };
                this.scene.add(mesh);
                console.log('Added encounter mesh to scene');
              }
            }
          }
          break;

        case "prop":
          if (marker.data?.texture) {
            console.log(`Processing prop marker: ${marker.id}`);
            const propData = {
              id: marker.id,
              x: marker.x,
              y: marker.y,
              image: marker.data.texture.data,
              rotation: marker.data.prop?.position?.rotation || 0,
              scale: marker.data.prop?.scale || 1,
              height: marker.data.prop?.height || 1,
              isHorizontal: marker.data.prop?.isHorizontal || false,
              name: marker.data.texture.name || "Prop", // Include the name from the texture data
              description: marker.data.prop?.description || "A mysterious item."
            };

            // Create prop mesh and add to scene
            propPromises.push(
              this.createPropMesh(propData)
                .then(mesh => {
                  if (mesh) {
                    this.scene.add(mesh);
                    console.log(`Added prop mesh: ${marker.id}`);
                  }
                  return mesh;
                })
                .catch(error => {
                  console.error(`Error creating prop ${marker.id}:`, error);
                  return null;
                })
            );
          }
          break;


        // First, improve teleporter creation in processAllMarkers
        case "teleport":
          console.log(`Processing teleport marker: ${marker.id}`);
          const teleX = marker.x / 50 - this.boxWidth / 2;
          const teleZ = marker.y / 50 - this.boxDepth / 2;
          const { elevation } = this.getElevationAtPoint(teleX, teleZ);

          // Store elevation data with marker
          marker.data.elevation = elevation;

          // Store the paired marker ID explicitly
          const pairedMarkerId = marker.data.pairedMarker?.id;
          console.log(`Teleporter ${marker.id} paired with ${pairedMarkerId || 'none'}`);

          // Create teleporter visual
          const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
          const material = new THREE.MeshBasicMaterial({
            color: marker.data.isPointA ? 0x4CAF50 : 0x2196F3,
            transparent: true,
            opacity: 0.5
          });

          const mesh = new THREE.Mesh(geometry, material);

          // Position at correct elevation
          const finalHeight = elevation + 0.05; // Slightly above surface
          mesh.position.set(teleX, finalHeight, teleZ);

          const teleporterInfo = {
            mesh,
            marker,
            pairedMarkerId: pairedMarkerId,  // Store ID instead of reference
            isPointA: marker.data.isPointA,
            position: new THREE.Vector3(teleX, finalHeight, teleZ)
          };

          this.teleporters.push(teleporterInfo);
          this.scene.add(mesh);

          // Add particles at correct height
          const particles = this.createTeleporterParticles(teleX, finalHeight, teleZ);
          this.scene.add(particles);
          break;

        case "door":
          console.log(`Processing door marker: ${marker.id}`);
          if (marker.data?.texture) {
            const doorMesh = this.textureManager.createDoorMesh(
              marker,
              this.boxWidth,
              this.boxHeight,
              this.boxDepth
            );
            if (doorMesh) {
              this.scene.add(doorMesh);
              console.log(`Added door mesh: ${marker.id}`);
            }
          }
          break;

        case "splash-art":
          console.log(`Processing splash-art marker: ${marker.id}`);
          // Just register splash-art markers for interaction
          // No mesh needed for these
          break;

        default:
          console.log(`Skipping unknown marker type: ${marker.type}`);
          break;
      }
    }

    // 2. Process door interaction points
    this.processDoorMarkers();


    if (propPromises.length > 0) {
      try {
        const propMeshes = await Promise.all(propPromises);
        console.log(`Added ${propMeshes.filter(m => m !== null).length} prop meshes to scene`);

        // Add position validation after all props are created
        setTimeout(() => {
          this.validatePropPositions();
        }, 100); // Small delay to ensure scene is stable
      } catch (error) {
        console.error("Error processing props:", error);
      }
    }

    this.updateTexturesColorSpace();

    // 4. Final check for duplicates
    this.checkForDuplicateProps();
  }

  validatePropPositions() {
    // Find all prop meshes
    const props = this.scene.children.filter(obj =>
      obj.userData && obj.userData.type === 'prop'
    );

    console.log(`Validating positions for ${props.length} props`);

    props.forEach(prop => {
      const userData = prop.userData;

      // Calculate expected world position from grid coordinates
      const expectedX = userData.gridX / 50 - this.boxWidth / 2;
      const expectedZ = userData.gridY / 50 - this.boxDepth / 2;

      // Check if position is significantly off
      const positionDiffX = Math.abs(prop.position.x - expectedX);
      const positionDiffZ = Math.abs(prop.position.z - expectedZ);

      if (positionDiffX > 0.1 || positionDiffZ > 0.1) {
        console.log(`Fixing position for prop ${userData.id}: 
                    Current (${prop.position.x.toFixed(2)}, ${prop.position.z.toFixed(2)}) → 
                    Expected (${expectedX.toFixed(2)}, ${expectedZ.toFixed(2)})`);

        // Fix the position (keeping the Y value)
        const currentY = prop.position.y;
        prop.position.set(expectedX, currentY, expectedZ);
      }
    });
  }

  checkForDuplicateProps() {
    // Find all prop meshes
    const propMeshes = this.scene.children.filter(child =>
      child.userData && child.userData.type === 'prop'
    );

    // Group by ID
    const propsByID = {};
    propMeshes.forEach(mesh => {
      const id = mesh.userData.id;
      if (!propsByID[id]) {
        propsByID[id] = [];
      }
      propsByID[id].push(mesh);
    });

    // Remove duplicates
    let removedCount = 0;
    Object.entries(propsByID).forEach(([id, meshes]) => {
      if (meshes.length > 1) {
        console.log(`Found ${meshes.length} meshes for prop ID ${id}, keeping only the first one`);
        // Keep the first one, remove the rest
        for (let i = 1; i < meshes.length; i++) {
          this.scene.remove(meshes[i]);
          removedCount++;
        }
      }
    });

    if (removedCount > 0) {
      console.log(`Removed ${removedCount} duplicate prop meshes`);
    }
  }


  async init3DScene(updateStatus) {
    const renderState = {
      clippingEnabled: false // true
    };
    // const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x222222);

    this.tokens = [];


    // Process all markers (encounter tokens, props, teleporters, doors, etc.)
    await this.processAllMarkers();

    this.autoDetectLightSources();


    const wallTextureRoom = this.rooms.find(
      (room) => room.name === "WallTexture"
    );
    const roomTextureRoom = this.rooms.find(
      (room) => room.name === "RoomTexture"
    );

    let wallTexture = null;
    let roomTexture = null;

    if (this.wallTextureRoom) {
      // console.log("Creating wall texture from room:", wallTextureRoom);
      this.wallTexture = this.createTextureFromRoom(this.wallTextureRoom);
    }

    // Create room texture if defined
    if (this.roomTextureRoom) {
      // console.log("Creating room texture from room:", roomTextureRoom);
      this.roomTexture = this.createTextureFromRoom(this.roomTextureRoom);
    }

    // Create floor texture
    const texture = new THREE.Texture(this.baseImage);
    if (this.baseImage && this.baseImage.complete && this.baseImage.width > 0) {
      // texture.needsUpdate = true;
      this.safeUpdateTexture(texture, 'init3DScene-floor texture');
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Create main block dimensions
    const boxWidth = this.baseImage.width / 50;
    const boxHeight = 4.5; // 4; // Wall height
    const boxDepth = this.baseImage.height / 50;

    // Handle doors with textures
    this.markers.forEach(marker => {
      if (marker.type === 'door' && marker.data.texture) {
        console.log('Creating 3D door with texture:', marker.data);
        const doorMesh = this.textureManager.createDoorMesh(
          marker,
          this.boxWidth,
          this.boxHeight,
          this.boxDepth
        );
        if (doorMesh) {
          this.scene.add(doorMesh);
          console.log('Door mesh added to scene');
        }
      }
    });


    this.rooms.forEach((room) => {
      if (room.name === "WallTexture" || room.name === "RoomTexture") {
        return;
      }

      let roomMesh;
      if (room.isRaisedBlock && room.blockHeight) {
        roomMesh = this.createRaisedBlockGeometry(room);
        if (roomMesh) {
          roomMesh.userData = {
            isWall: true,
            blockHeight: room.blockHeight,
            isRaisedBlock: true
          };
        }
      } else {
        roomMesh = this.createRoomGeometry(room);
        if (roomMesh) {
          roomMesh.userData = {
            isWall: room.type === "wall",
            isRegularWall: room.isRegularWall || false,  // Add the regular wall flag
            type: room.type
          };
        }
      }

      if (roomMesh) {
        this.scene.add(roomMesh);
      }
    });


    const materials = [
      new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide
      }),
      new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.7,
        side: THREE.DoubleSide
      })
    ];

    updateStatus(20);
    this.rooms.forEach((room, index) => {
      // Skip the WallTexture room in 3D view
      if (room.name === "WallTexture" || room.name === "RoomTexture") {
        return;
      }

      let roomMesh;
      if (room.isRaisedBlock && room.blockHeight) {
        roomMesh = this.createRaisedBlockGeometry(room);
        if (roomMesh) {
          roomMesh.userData.isWall = true;
        }
      } else {
        roomMesh = this.createRoomGeometry(room);
        if (roomMesh) {
          roomMesh.userData.isWall = room.type === "wall";
        }
      }

      if (roomMesh) {
        if (roomMesh.userData.isWall) {
        }
        this.scene.add(roomMesh);
      }
      updateStatus(20 + 60 * (index / this.rooms.length));
    });


    // Add floor
    const floorGeometry = new THREE.PlaneGeometry(this.boxWidth, this.boxDepth);
    const floor = new THREE.Mesh(floorGeometry, materials[0]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01; // Slightly above ground to prevent z-fighting
    this.scene.add(floor);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    ambientLight.castShadow = false; // Explicitly disable shadow casting
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Position this.camera at player start if available
    if (this.playerStart) {
      this.camera.position.set(
        this.playerStart.x / 50 - this.boxWidth / 2,
        1.7, // Eye level
        this.playerStart.y / 50 - this.boxDepth / 2
      );
    }



    const createTokenMesh = (token) => {
      // Debug log the token data
      // console.log("Creating token mesh with data:", token);

      return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();

        textureLoader.load(
          token.image,
          (texture) => {
            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              sizeAttenuation: true
            });

            const sprite = new THREE.Sprite(spriteMaterial);
            const scale = token.size * (this.cellSize / 25);
            const aspectRatio = texture.image.width / texture.image.height;
            sprite.scale.set(scale * aspectRatio, scale, 1);

            // Position at grid location
            const x = token.x / 50 - this.boxWidth / 2;
            const z = token.y / 50 - this.boxDepth / 2;
            const y = token.size * (this.cellSize / 50); // Height adjustment

            sprite.position.set(x, y, z);

            console.log("Token sprite created:", {
              position: sprite.position,
              scale: sprite.scale,
              aspectRatio
            });

            resolve(sprite);
          },
          undefined,
          (error) => {
            console.error("Error loading token texture:", error);
            reject(error);
          }
        );
      });
    };

    // token mesh processing
    if (this.tokens && this.tokens.length > 0) {
      console.log("Processing tokens for 3D view:", this.tokens.length);

      // Debug first token
      if (this.tokens[0]) {
        console.log("Example token data:", {
          name: this.tokens[0].name,
          position: `(${this.tokens[0].x}, ${this.tokens[0].y})`,
          size: this.tokens[0].size
        });
      }

      const tokenMeshes = [];

      // Process tokens one by one
      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];

        try {
          // Look for elevation data from the marker
          const matchingMarker = this.markers?.find(m =>
            m.type === 'encounter' &&
            m.data?.monster?.basic?.name === token.name &&
            m.x === token.x &&
            m.y === token.y
          );

          if (matchingMarker?.data?.elevation > 0 && !matchingMarker.data.insideWall) {
            console.log(`Token ${token.name} at elevation ${matchingMarker.data.elevation}`);
            // Add elevation to token height
            token.height = (token.size || 1) + matchingMarker.data.elevation;
          }

          // Create and add token mesh
          const mesh = this.createTokenMesh(token);
          if (mesh) {
            this.scene.add(mesh);
            tokenMeshes.push(mesh);
          }
        } catch (err) {
          console.error(`Error creating token ${i}:`, err);
        }
      }

      console.log(`Added ${tokenMeshes.length} token meshes to scene`);
    }


    // Try to load door sound
    this.loadDoorSound();

    this.controls = new THREE.PointerLockControls(
      this.camera,
      this.renderer.domElement
    );

    const moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      speed: 0.025,
      sprint: false,
      mouseRightDown: false
    };

    // Instead of all the inline event handlers, use:
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));
    this.setupMouseControls();


    updateStatus(100);



    this.cleanup = () => {
      document.removeEventListener("keydown", this.handleKeyDown);
      document.removeEventListener("keyup", this.handleKeyUp);

      // Dispose of renderer
      this.renderer.dispose();

      // Dispose of geometries and materials
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };

    this.createMiniMap();

    // Return with all class method references
    return {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      animate: this.animate.bind(this),  // Ensure 'this' binding
      controls: this.controls,
      cleanup: this.cleanup.bind(this)   // Ensure 'this' binding
    };
  }

  createPickupPrompt() {
    if (!this.pickupPrompt) {
      this.pickupPrompt = document.createElement('div');
      this.pickupPrompt.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 15px 20px;
          border-radius: 5px;
          display: none;
          font-family: Arial, sans-serif;
          pointer-events: none;
          z-index: 1000;
      `;
      document.body.appendChild(this.pickupPrompt);
    }
    return this.pickupPrompt;
  }

  setupInventorySystem() {
    console.log('Setting up inventory system');

    // Create inventory drawer
    this.inventoryDrawer = document.createElement('sl-drawer');
    this.inventoryDrawer.label = "Inventory";
    this.inventoryDrawer.placement = "end"; // Change to end for right side
    this.inventoryDrawer.className = "inventory-drawer";

    // Add higher z-index to appear above 3D view
    this.inventoryDrawer.style.setProperty('--sl-z-index-drawer', '3000');

    // Calculate width based on viewport and sidebar
    const sidebar = document.querySelector(".sidebar");
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
    const availableWidth = window.innerWidth - sidebarWidth;
    const drawerWidth = `${Math.floor(availableWidth)}px`; // Use pixels instead of vw

    // Set drawer width
    this.inventoryDrawer.style.setProperty('--size', drawerWidth);

    // Create grid container for items
    const gridContainer = document.createElement('div');
    gridContainer.className = 'inventory-grid';
    gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
    padding: 16px;
    max-height: 70vh;
    overflow-y: auto;
  `;

    // Add empty inventory message
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-inventory-message';
    emptyMessage.textContent = 'Your inventory is empty. Explore the world to find items!';
    emptyMessage.style.cssText = `
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px 20px;
    color: #666;
    font-style: italic;
  `;
    gridContainer.appendChild(emptyMessage);

    // Add the grid to the drawer
    this.inventoryDrawer.appendChild(gridContainer);


    // Event listeners for the drawer
    this.inventoryDrawer.addEventListener('sl-show', () => {
      console.log('Inventory drawer shown');
      this.isInventoryShowing = true;
      this.pauseControls();

      // Update empty message visibility
      const emptyMessage = this.inventoryDrawer.querySelector('.empty-inventory-message');
      const hasItems = this.inventory.size > 0;
      if (emptyMessage) {
        emptyMessage.style.display = hasItems ? 'none' : 'block';
      }
    });

    this.inventoryDrawer.addEventListener('sl-hide', () => {
      console.log('Inventory drawer hidden');
      this.isInventoryShowing = false;
      this.resumeControls();
    });

    // Prevent closing when clicking overlay
    this.inventoryDrawer.addEventListener('sl-request-close', event => {
      if (event.detail.source === 'overlay') {
        event.preventDefault();
      }
    });

    // Close button handler
    // closeButton.addEventListener('click', () => {
    //   this.inventoryDrawer.hide();
    // });

    // Add to the document
    document.body.appendChild(this.inventoryDrawer);

    // Initialize inventory data structure if not already
    if (!this.inventory) {
      this.inventory = new Map();
    }
  }

  toggleInventory() {
    if (!this.inventoryDrawer) {
      console.warn('Inventory drawer not initialized');
      return;
    }

    console.log('Opening inventory');

    // Only show the drawer - closing is handled by the close button
    if (!this.isInventoryShowing) {
      this.inventoryDrawer.show();
    }
    // We intentionally don't handle closing here
  }


  getInventoryItems() {
    console.log('Scene3DController.getInventoryItems called');

    // Convert inventory Map to an array of usable items
    const items = [];

    if (!this.inventory || !(this.inventory instanceof Map)) {
      console.warn('Scene3DController: Invalid inventory structure');
      return items;
    }

    // Debug output
    console.log(`Processing ${this.inventory.size} inventory items`);

    this.inventory.forEach((item, id) => {
      const prop = item.prop;
      if (!prop) {
        console.warn('Item missing prop data:', id);
        return;
      }

      // Determine if this is equipment and what type
      let equipmentType = null;
      if (prop.name && (
        prop.name.toLowerCase().includes('sword') ||
        prop.name.toLowerCase().includes('axe') ||
        prop.name.toLowerCase().includes('dagger') ||
        prop.name.toLowerCase().includes('staff') ||
        prop.name.toLowerCase().includes('wand') ||
        prop.name.toLowerCase().includes('bow') ||
        prop.name.toLowerCase().includes('mace')
      )) {
        equipmentType = 'weapon';
      }
      else if (prop.name && (
        prop.name.toLowerCase().includes('armor') ||
        prop.name.toLowerCase().includes('shield') ||
        prop.name.toLowerCase().includes('helmet') ||
        prop.name.toLowerCase().includes('robe') ||
        prop.name.toLowerCase().includes('mail')
      )) {
        equipmentType = 'armor';
      }

      // Only include items identified as equipment
      if (equipmentType) {
        // Make sure to use the original ID that's in the inventory Map
        const equipItem = {
          id: id, // IMPORTANT: Use the original Map key as the definitive ID 
          name: prop.name || 'Unknown Item',
          description: prop.description || '',
          type: equipmentType,
          image: prop.image || null,
          // Add appropriate bonus based on item type
          damageBonus: equipmentType === 'weapon' ? Math.ceil(Math.random() * 3) : 0,
          acBonus: equipmentType === 'armor' ? Math.ceil(Math.random() * 3) : 0,
          source: '3d-inventory'
        };

        // Log the item we're adding
        console.log(`Adding inventory item to equipment: ${equipItem.name} with ID ${equipItem.id}`);
        items.push(equipItem);
      }
    });

    console.log(`Prepared ${items.length} equipment items from 3D inventory`);
    return items;
  }

  logInventoryItems() {
    console.group('Scene3D Inventory Contents');

    if (!this.inventory) {
      console.log('No inventory found');
      console.groupEnd();
      return;
    }

    if (this.inventory instanceof Map) {
      console.log(`Inventory has ${this.inventory.size} items`);
      this.inventory.forEach((item, id) => {
        console.log(`ID: ${id}, Name: ${item.prop?.name || 'Unknown'}, Type: ${typeof id}`);
      });
    } else {
      console.log('Inventory is not a Map:', this.inventory);
    }

    console.groupEnd();
  }

  addToInventory(prop) {
    if (!prop || !prop.id) {
      console.warn('Invalid prop data for inventory', prop);
      return;
    }

    console.log('Adding item to inventory:', prop);

    // Create inventory item element
    const itemElement = document.createElement('div');
    itemElement.className = 'inventory-item';
    itemElement.style.cssText = `
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    position: relative;
  `;

    // Hover effect
    itemElement.onmouseover = () => {
      itemElement.style.transform = 'translateY(-3px)';
      itemElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    };

    itemElement.onmouseout = () => {
      itemElement.style.transform = 'translateY(0)';
      itemElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    };

    // Add image if available
    if (prop.image) {
      const imgContainer = document.createElement('div');
      imgContainer.style.cssText = `
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      padding: 4px;
    `;

      const img = document.createElement('img');
      img.src = prop.image;
      img.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    `;
      imgContainer.appendChild(img);
      itemElement.appendChild(imgContainer);
    } else {
      // Default icon if no image
      const defaultIcon = document.createElement('div');
      defaultIcon.innerHTML = '📦';
      defaultIcon.style.cssText = `
      font-size: 40px;
      margin-bottom: 8px;
    `;
      itemElement.appendChild(defaultIcon);
    }

    // Add name/label
    const label = document.createElement('div');
    label.textContent = prop.name || 'Unknown Item';
    label.style.cssText = `
    font-size: 0.9em;
    font-weight: bold;
    color: #333;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
    itemElement.appendChild(label);

    // Add description if available
    if (prop.description) {
      const description = document.createElement('div');
      description.textContent = prop.description;
      description.style.cssText = `
      font-size: 0.8em;
      color: #666;
      margin-top: 4px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
      itemElement.appendChild(description);
    }

    // Add use button
    const useButton = document.createElement('button');
    useButton.textContent = 'Use';
    useButton.style.cssText = `
    margin-top: 8px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 0.8em;
  `;
    // useButton.onclick = (e) => {
    //   e.stopPropagation();
    //   this.useInventoryItem(prop.id);
    // };

    useButton.onclick = (e) => {
      e.stopPropagation();
      this.showItemDetails(prop);  // Call showItemDetails instead of useInventoryItem
    };

    itemElement.appendChild(useButton);

    // Click handler for item details
    itemElement.onclick = () => {
      this.showItemDetails(prop);
    };

    // Add to inventory map and grid
    this.inventory.set(prop.id, {
      id: prop.id,
      prop: prop,
      element: itemElement
    });

    // Add to grid and hide empty message
    const grid = this.inventoryDrawer.querySelector('.inventory-grid');
    const emptyMessage = grid.querySelector('.empty-inventory-message');
    if (emptyMessage) {
      emptyMessage.style.display = 'none';
    }
    grid.appendChild(itemElement);

    // Play pickup sound if available
    if (this.resourceManager) {
      this.resourceManager.playSound('item_pickup', 'effects');
    }

    // Show pickup notification
    this.showPickupNotification(prop.name || 'Item');
  }

  removeFromInventory(itemId) {
    console.log('Scene3DController.removeFromInventory called for item:', itemId);

    if (!this.inventory.has(itemId)) {
      console.warn('Item not found in inventory:', itemId);
      return false;
    }

    // Get the item before removing it
    const item = this.inventory.get(itemId);

    // Remove from DOM if element exists
    if (item.element && item.element.parentNode) {
      item.element.parentNode.removeChild(item.element);
    }

    // Remove from inventory Map
    const result = this.inventory.delete(itemId);
    console.log(`Removed item ${itemId} from 3D inventory:`, result);

    // If inventory drawer is open, update the empty message
    if (this.inventoryDrawer && this.isInventoryShowing) {
      const grid = this.inventoryDrawer.querySelector('.inventory-grid');
      if (grid) {
        const emptyMessage = grid.querySelector('.empty-inventory-message');
        if (emptyMessage && this.inventory.size === 0) {
          emptyMessage.style.display = 'block';
        }
      }
    }

    return true;
  }


  useInventoryItem(itemId) {
    if (!this.inventory.has(itemId)) {
      console.warn('Cannot use item, not found in inventory:', itemId);
      return;
    }

    const item = this.inventory.get(itemId);
    console.log('Using inventory item:', item.prop);

    // Create prop in the world at player's position
    const playerPos = this.camera.position.clone();

    // Add a small offset in front of the player
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.multiplyScalar(1.5); // 1.5 units in front
    playerPos.add(direction);

    // Convert back to grid coordinates
    const gridX = Math.round((playerPos.x + this.boxWidth / 2) * 50);
    const gridY = Math.round((playerPos.z + this.boxDepth / 2) * 50);

    // Create prop data
    const propData = {
      id: `used-${Date.now()}`, // Generate a new ID to prevent confusion
      x: gridX,
      y: gridY,
      image: item.prop.image,
      name: item.prop.name,
      description: item.prop.description,
      scale: item.prop.scale || 1,
      height: 1,
      // Add this to ensure it appears correctly
      rotation: 0,
      isHorizontal: false
    };

    console.log('Creating prop from inventory item at:', { x: gridX, y: gridY });

    // Create and add prop mesh
    this.createPropMesh(propData)
      .then(mesh => {
        if (mesh) {
          // Add user data to make it interactable
          mesh.userData = {
            type: 'prop',
            id: propData.id,
            name: propData.name,
            description: propData.description
          };

          this.scene.add(mesh);
          console.log('Item placed in world:', propData.id);
        }
      })
      .catch(error => {
        console.error('Error creating prop from inventory item:', error);
      });

    // Remove from inventory
    this.removeFromInventory(itemId);

    // Show notification
    this.showNotification(`Used ${item.prop.name || 'Item'}`);
  }


  showItemDetails(prop) {
    console.log('Showing details for item:', prop);

    // Create modal dialog for item details
    const dialog = document.createElement('sl-dialog');
    dialog.label = prop.name || 'Item Details';
    dialog.style.setProperty('--sl-z-index-dialog', '4000');

    const content = document.createElement('div');
    content.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
  `;

    // Add image if available
    if (prop.image) {
      const img = document.createElement('img');
      img.src = prop.image;
      img.style.cssText = `
      max-width: 200px;
      max-height: 200px;
      object-fit: contain;
      margin-bottom: 16px;
      border-radius: 8px;
    `;
      content.appendChild(img);
    }

    // Add description
    const description = document.createElement('p');
    description.textContent = prop.description || 'No description available.';
    description.style.cssText = `
    text-align: center;
    margin-bottom: 16px;
    line-height: 1.5;
  `;
    content.appendChild(description);

    // Equipment detection - determine if this is equipment
    const isWeapon = prop.name.toLowerCase().includes('sword') ||
      prop.name.toLowerCase().includes('axe') ||
      prop.name.toLowerCase().includes('dagger') ||
      prop.name.toLowerCase().includes('staff') ||
      prop.name.toLowerCase().includes('wand') ||
      prop.name.toLowerCase().includes('bow') ||
      prop.name.toLowerCase().includes('mace');

    const isArmor = prop.name.toLowerCase().includes('armor') ||
      prop.name.toLowerCase().includes('shield') ||
      prop.name.toLowerCase().includes('helmet') ||
      prop.name.toLowerCase().includes('robe') ||
      prop.name.toLowerCase().includes('mail');


    const actions = document.createElement('div');
    actions.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  `;

    // Use item button (regular)
    const useButton = document.createElement('sl-button');
    useButton.setAttribute('variant', 'primary');
    useButton.textContent = 'Use Item';
    useButton.addEventListener('click', () => {
      dialog.hide();
      this.useInventoryItem(prop.id);
    });
    actions.appendChild(useButton);

    // Drop vertically
    const dropButton = document.createElement('sl-button');
    dropButton.setAttribute('variant', 'neutral');
    dropButton.innerHTML = '<span class="material-icons">vertical_align_bottom</span> Drop';
    dropButton.addEventListener('click', () => {
      dialog.hide();
      this.dropInventoryItem(prop.id, 'vertical');
    });
    actions.appendChild(dropButton);

    // Drop horizontally 
    const dropHorizontalButton = document.createElement('sl-button');
    dropHorizontalButton.setAttribute('variant', 'neutral');
    dropHorizontalButton.innerHTML = '<span class="material-icons">horizontal_rule</span> Lay Flat';
    dropHorizontalButton.addEventListener('click', () => {
      dialog.hide();
      this.dropInventoryItem(prop.id, 'horizontal');
    });
    actions.appendChild(dropHorizontalButton);

    // Place on wall (only show if wall is detected)
    const wallInfo = this.checkWallInFront();
    if (wallInfo.hit) {
      const placeWallButton = document.createElement('sl-button');
      placeWallButton.setAttribute('variant', 'neutral');
      placeWallButton.innerHTML = '<span class="material-icons">push_pin</span> Hang on Wall';
      placeWallButton.addEventListener('click', () => {
        dialog.hide();
        this.placeItemOnWall(prop.id, wallInfo);
      });
      actions.appendChild(placeWallButton);
    }

    content.appendChild(actions);
    dialog.appendChild(content);

    // Add to document and show
    document.body.appendChild(dialog);
    dialog.show();
  }

  placeItemOnWall(itemId, wallInfo) {
    if (!this.inventory.has(itemId) || !wallInfo.hit) {
      return;
    }

    const item = this.inventory.get(itemId);

    // Create prop data for wall placement
    const propData = {
      id: `wall-${Date.now()}`,
      x: wallInfo.point.x * 50 + this.boxWidth * 25, // Convert to grid coordinates
      y: wallInfo.point.z * 50 + this.boxDepth * 25,
      image: item.prop.image,
      name: item.prop.name,
      description: item.prop.description,
      scale: item.prop.scale || 1,
      height: wallInfo.point.y, // Place at hit point height
      rotation: this.getWallRotation(wallInfo.normal), // Align with wall
      isWallMounted: true,
      insideWallRoom: wallInfo.insideWallRoom
    };

    this.createPropMesh(propData)
      .then(mesh => {
        // Position slightly away from wall to prevent z-fighting
        // Adjust offset direction based on inside/outside status
        const offsetScale = wallInfo.insideWallRoom ? -0.05 : 0.05;
        const normalOffset = wallInfo.normal.clone().multiplyScalar(offsetScale);
        mesh.position.add(normalOffset);

        this.scene.add(mesh);
        console.log('Placed item on wall:', propData);
      })
      .catch(error => {
        console.error('Error creating wall prop:', error);
      });

    this.removeFromInventory(itemId);
    this.showNotification(`Placed ${item.prop.name} on wall`);
  }

  // Helper to get rotation from wall normal
  getWallRotation(normal) {
    // Calculate rotation to face away from wall
    // For a normal pointing in -Z, we want 0 degrees
    // For a normal pointing in +X, we want 90 degrees, etc.
    return Math.atan2(normal.x, normal.z) * (180 / Math.PI);
  }

  dropInventoryItem(itemId, placementType = 'vertical') {
    if (!this.inventory.has(itemId)) {
      console.warn('Cannot drop item, not found in inventory:', itemId);
      return;
    }

    const item = this.inventory.get(itemId);
    console.log('Dropping inventory item:', item.prop);

    // Create prop in the world at player's position
    const playerPos = this.camera.position.clone();

    // Add a small offset in front of the player
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.multiplyScalar(1); // 1 unit in front
    playerPos.add(direction);

    // Convert back to grid coordinates
    const gridX = Math.round((playerPos.x + this.boxWidth / 2) * 50);
    const gridY = Math.round((playerPos.z + this.boxDepth / 2) * 50);

    // Create prop data
    const propData = {
      id: `dropped-${Date.now()}`,
      x: gridX,
      y: gridY,
      image: item.prop.image,
      name: item.prop.name,
      description: item.prop.description,
      scale: item.prop.scale || 1,
      height: placementType === 'horizontal' ? 0.05 : 1, // Lower height for horizontal items
      isHorizontal: placementType === 'horizontal', // New flag for horizontal placement
      rotation: 0
    };

    // Create and add prop mesh
    this.createPropMesh(propData)
      .then(mesh => {
        this.scene.add(mesh);
        console.log('Dropped item added to scene at:', { x: gridX, y: gridY, placementType });
      })
      .catch(error => {
        console.error('Error creating dropped prop:', error);
      });

    // Remove from inventory
    this.removeFromInventory(itemId);

    // Show notification
    this.showNotification(`Dropped ${item.prop.name || 'Item'}`);
  }

  // Add this new method for wall placement
  placeItemOnWall(itemId, wallInfo) {
    if (!this.inventory.has(itemId) || !wallInfo.hit) {
      return;
    }

    const item = this.inventory.get(itemId);

    // Create prop data for wall placement
    const propData = {
      id: `wall-${Date.now()}`,
      x: wallInfo.point.x * 50 + this.boxWidth * 25, // Convert to grid coordinates
      y: wallInfo.point.z * 50 + this.boxDepth * 25,
      image: item.prop.image,
      name: item.prop.name,
      description: item.prop.description,
      scale: item.prop.scale || 1,
      height: wallInfo.point.y, // Place at hit point height
      rotation: this.getWallRotation(wallInfo.normal), // Align with wall
      isWallMounted: true, // New flag
      wallNormal: wallInfo.normal.clone() // Store for future reference
    };

    this.createPropMesh(propData)
      .then(mesh => {
        // Position slightly away from wall to prevent z-fighting
        const normalOffset = wallInfo.normal.clone().multiplyScalar(0.05);
        mesh.position.add(normalOffset);

        this.scene.add(mesh);
        console.log('Placed item on wall:', propData);
      })
      .catch(error => {
        console.error('Error creating wall prop:', error);
      });

    this.removeFromInventory(itemId);
    this.showNotification(`Placed ${item.prop.name} on wall`);
  }

  // Helper to get rotation from wall normal
  getWallRotation(normal) {
    // Calculate rotation to face away from wall
    // For a normal pointing in -Z, we want 0 degrees
    // For a normal pointing in +X, we want 90 degrees, etc.
    return Math.atan2(normal.x, normal.z) * (180 / Math.PI);
  }

  checkWallInFront() {
    const playerPos = this.camera.position;
    const lookDirection = new THREE.Vector3();
    this.camera.getWorldDirection(lookDirection);

    // Cast ray forward
    const raycaster = new THREE.Raycaster(
      playerPos,
      lookDirection,
      0,
      2 // Check up to 2 units in front
    );

    const walls = this.scene.children.filter(obj => obj.userData?.isWall);
    const hits = raycaster.intersectObjects(walls);

    if (hits.length > 0) {
      // Get normal - but we need to adjust it if inside a wall room
      let normal = hits[0].face?.normal.clone() || new THREE.Vector3(0, 0, -1);

      // If inside a wall room, invert the normal to ensure it points inward
      if (this.insideWallRoom) {
        normal.negate();
      }

      return {
        hit: true,
        wall: hits[0].object,
        distance: hits[0].distance,
        point: hits[0].point,
        normal: normal,
        insideWallRoom: this.insideWallRoom
      };
    }

    return { hit: false };
  }

  showPickupNotification(itemName) {
    const notification = document.createElement('div');
    notification.className = 'pickup-notification';
    notification.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    z-index: 2000;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

    notification.innerHTML = `
    <span style="font-size: 24px;">📦</span>
    <span>Picked up: <strong>${itemName}</strong></span>
  `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    // Animate out
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';

      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
    position: fixed;
    bottom: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    z-index: 2000;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
  `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    // Animate out
    setTimeout(() => {
      notification.style.opacity = '0';

      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2000);
  }

  // Replace or modify your updateTexturesColorSpace method
  updateTexturesColorSpace() {
    // Apply to all materials in the scene
    this.scene.traverse((object) => {
      if (object.material) {
        // Handle single material
        if (object.material.map) {
          // Add safety check before updating
          if (object.material.map.image &&
            (object.material.map.image.width > 0 ||
              object.material.map.image instanceof HTMLCanvasElement)) {
            object.material.map.colorSpace = THREE.SRGBColorSpace;
            object.material.map.needsUpdate = true;
          }
        }

        // Handle material array
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => {
            if (mat.map) {
              // Same safety check for array materials
              if (mat.map.image &&
                (mat.map.image.width > 0 ||
                  mat.map.image instanceof HTMLCanvasElement)) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }
            }
          });
        }
      }
    });
  }

  // Add as a method in Scene3DController
  setFPSLimit(limit) {
    console.log(`setFPSLimit called with limit: ${limit}`);

    if (limit === 0 || limit === null || limit === undefined) {
      // No limit (default)
      this.fpsLimit = 0;
      this.fpsInterval = 0;
      console.log('FPS limit disabled');

      // Remove wrapper if it exists
      if (this._originalAnimate) {
        console.log('Restoring original animate function');
        this.animate = this._originalAnimate;
        this._originalAnimate = null;
      }
    } else {
      // Set the limit
      this.fpsLimit = limit;
      this.fpsInterval = 1000 / limit;
      console.log(`FPS limited to ${limit}`);

      // Save original animate function if not already saved
      if (!this._originalAnimate) {
        console.log('Saving original animate function');
        this._originalAnimate = this.animate;
      }

      // Create a new wrapper function that applies the FPS limit
      console.log('Creating FPS limited animate wrapper');
      this.animate = this._createFPSLimitedAnimate();
    }

    // Reset last frame time
    this.lastFrameTime = 0;
  }

  // Helper method to create the FPS-limited animation function
  _createFPSLimitedAnimate() {
    // Store a reference to the original animate method and this
    const originalAnimate = this._originalAnimate;
    const self = this;

    // Return a new function that wraps the original
    return function limitedAnimateWrapper() {
      const now = performance.now();

      // Initialize lastFrameTime if needed
      if (!self.lastFrameTime) {
        self.lastFrameTime = now;
      }

      const elapsed = now - self.lastFrameTime;

      // If enough time has elapsed, run the animation
      if (elapsed >= self.fpsInterval) {
        // Adjust lastFrameTime, accounting for any excess time
        self.lastFrameTime = now - (elapsed % self.fpsInterval);

        // Call the original animation function
        originalAnimate.call(self);
      } else {
        // Skip this frame but schedule the next one
        self.animationFrameId = requestAnimationFrame(self.animate);
      }
    };
  }


  monitorActualFPS() {
    console.log('monitorActualFPS called');

    if (this._fpsMonitorActive) {
      console.log('FPS monitor already active, skipping');
      return;
    }

    this._fpsMonitorActive = true;
    this._frameCount = 0;
    this._fpsStartTime = performance.now();

    // Create a simple display
    const fpsMonitor = document.createElement('div');
    fpsMonitor.style.cssText = `
    position: fixed;
    top: 64px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-family: monospace;
    z-index: 10000;
  `;
    document.body.appendChild(fpsMonitor);
    this._fpsMonitor = fpsMonitor;

    // Update every second
    const updateFPS = () => {
      if (!this._fpsMonitorActive) return;

      const now = performance.now();
      const elapsed = now - this._fpsStartTime;

      if (elapsed >= 1000) {
        const fps = Math.round((this._frameCount * 1000) / elapsed);
        fpsMonitor.textContent = `Actual FPS: ${fps} ${this.fpsLimit ? `(Limit: ${this.fpsLimit})` : ''}`;

        this._frameCount = 0;
        this._fpsStartTime = now;
      }

      setTimeout(updateFPS, 500);
    };

    // Start monitoring
    updateFPS();

    // Count each frame
    const originalAnimate = this.animate;
    this.animate = () => {
      this._frameCount++;
      originalAnimate.call(this);
    };
  }


  handleEncounter(marker) {
    // Prevent multiple encounters
    if (this.activeEncounter || this.encounterCooldown) return;

    // Hide the prompt
    if (this.encounterPrompt) {
      this.encounterPrompt.style.display = 'none';
    }

    console.log('Handling encounter:', marker);

    // Set active encounter
    this.activeEncounter = marker;

    // Check if we have monster data
    if (marker.userData && marker.userData.monster) {
      console.log('Monster data found:', marker.userData.monster);

      // If we have a party manager, show recruitment dialog
      if (window.partyManager) {

        this.pauseControls();

        // window.partyManager.showRecruitmentDialog(marker.userData.monster);
        window.partyManager.showRecruitmentDialog(marker.userData.monster, marker);




        // Add dialog close handler
        const cleanup = () => {
          this.activeEncounter = null;
          // Set cooldown to prevent immediate re-trigger
          this.encounterCooldown = true;
          setTimeout(() => {
            this.encounterCooldown = false;
          }, 1000); // 1 second cooldown
        };

        // Find and monitor the recruitment dialog
        const checkDialog = setInterval(() => {
          const dialog = document.querySelector('.recruitment-overlay');
          if (!dialog) {
            clearInterval(checkDialog);
            cleanup();
            this.resumeControls();
          }
        }, 100);
      }
    }
  }



  updateTimeBasedMovement() {
    // Calculate time-based delta for smooth movement
    const now = performance.now();
    this.deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;

    // Cap deltaTime to avoid huge jumps after pauses or slow frames
    const cappedDelta = Math.min(this.deltaTime, 0.1);

    // Calculate base speed adjusted for time (normalized to 60fps)
    //prefs.fpsLimit

    // const prefs = this.getPreferences();
    // if (prefs.fpsLimit) {
    //   console.log('Applying FPS limit from preferences:', prefs.fpsLimit);
    //   this.setFPSLimit(prefs.fpsLimit);
    //       if (this.fpsLimit) {
    //   const timeAdjustedSpeed = this.moveState.speed * cappedDelta * prefs.fpsLimit;
    // } else {

    const timeAdjustedSpeed = this.moveState.speed * cappedDelta * 60;
    // }
    // }



    // Skip movement if paused
    if (this._controlsPaused) {
      return cappedDelta;
    }

    let canMove = true;

    if (this.moveState.forward || this.moveState.backward) {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      if (this.moveState.backward) direction.negate();

      canMove = this.physics.checkCollision(direction, timeAdjustedSpeed);
    }

    if (canMove) {
      if (this.moveState.forward) this.controls.moveForward(timeAdjustedSpeed);
      if (this.moveState.backward) this.controls.moveForward(-timeAdjustedSpeed);
    }

    if (this.moveState.left) this.controls.moveRight(-timeAdjustedSpeed);
    if (this.moveState.right) this.controls.moveRight(timeAdjustedSpeed);

    // Return the delta time for other time-based calculations
    return cappedDelta;
  }

  processInteractiveElements() {
    const playerPosition = this.camera.position.clone();
    let nearestTeleporter = null;
    let nearestDoor = null;
    let nearestSplashArt = null;
    let nearestProp = null;
    let nearestEncounter = null;
    let shortestDistance = Infinity;

    // Check teleporters
    this.teleporters.forEach(teleporter => {
      const distance = playerPosition.distanceTo(teleporter.position);
      if (distance < 2 && distance < shortestDistance) {
        shortestDistance = distance;
        nearestTeleporter = teleporter;
      }
    });

    // Check doors
    this.doors.forEach(door => {
      const distance = playerPosition.distanceTo(door.position);
      if (distance < 2 && distance < shortestDistance) {
        shortestDistance = distance;
        nearestDoor = door;
      }
    });

    // Check splash art markers
    this.markers.forEach(marker => {
      if (marker.type === 'splash-art') {
        const markerPos = new THREE.Vector3(
          marker.x / 50 - this.boxWidth / 2,
          marker.data.height || 1,
          marker.y / 50 - this.boxDepth / 2
        );
        const distance = playerPosition.distanceTo(markerPos);
        if (distance < 2 && distance < shortestDistance) {
          shortestDistance = distance;
          nearestSplashArt = marker;
        }
      }
    });

    // Check props
    this.scene.children.forEach(child => {
      if (child.userData?.type === 'prop') {
        const distance = playerPosition.distanceTo(child.position);
        if (distance < 2 && distance < shortestDistance) {
          shortestDistance = distance;
          nearestProp = child;
        }
      }
    });

    // Check encounters
    if (!this.encounterCooldown && !this.activeEncounter) {
      this.scene.children.forEach(object => {
        if (object.userData && object.userData.type === 'encounter') {
          const dist = playerPosition.distanceTo(object.position);
          const minEncounterDist = 3; // Detection range
          if (dist < minEncounterDist && (!nearestEncounter || dist < shortestDistance)) {
            nearestEncounter = object;
            shortestDistance = dist;
          }
        }
      });
    }

    // Update UI prompts based on nearest interactive element
    this.updateTeleportPrompt(nearestTeleporter);
    this.updateDoorPrompt(nearestDoor);

    // Update splash art prompt
    if (nearestSplashArt && !this.activeSplashArt) {
      const prompt = this.createSplashArtPrompt();
      prompt.textContent = nearestSplashArt.data.inspectMessage || 'Press E to inspect';
      prompt.style.display = 'block';
      this.nearestSplashArt = nearestSplashArt;
    } else if (!nearestSplashArt && this.splashArtPrompt) {
      this.splashArtPrompt.style.display = 'none';
      this.nearestSplashArt = null;
    }

    // Update pickup prompt
    if (nearestProp && !this.inventory.has(nearestProp.userData.id)) {
      const prompt = this.createPickupPrompt();
      prompt.textContent = 'Press E to pick up';
      prompt.style.display = 'block';
      this.nearestProp = nearestProp;
    } else if (this.pickupPrompt) {
      this.pickupPrompt.style.display = 'none';
      this.nearestProp = null;
    }

    // Update encounter prompt
    if (nearestEncounter && !this.activeEncounter && !this.activeSplashArt) {
      const prompt = this.createEncounterPrompt();
      prompt.textContent = 'Press E to approach monster';
      prompt.style.display = 'block';
      this.nearestEncounter = nearestEncounter;
    } else if (!nearestEncounter && this.encounterPrompt) {
      this.encounterPrompt.style.display = 'none';
      this.nearestEncounter = null;
    }
  }

  // Helper method for animating effects
  animateEffects(deltaTime) {
    // Animate teleporter particles
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Points && child.userData.animate) {
        const positions = child.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          // Circular motion with time-based animation
          const time = performance.now() * 0.001;
          const radius = 0.5;
          positions[i] = Math.cos(time + i) * radius;
          positions[i + 1] = Math.sin(time * 0.5) * 0.2;  // Vertical wobble
          positions[i + 2] = Math.sin(time + i) * radius;
        }
        child.geometry.attributes.position.needsUpdate = true;
      }
    });
  }


  animate = () => {
    // Debugging to check if this is the wrapped version or not
    if (!this._animateDebugChecked) {
      this._animateDebugChecked = true;
      console.log('Animate function running, wrapped:', !!this._originalAnimate);
    }

    if (!this._dayNightDebugLogged && this.dayNightCycle) {
      console.log('Day/Night cycle exists in animate:', this.dayNightCycle);
      this._dayNightDebugLogged = true;
    } else if (!this._dayNightMissingLogged && !this.dayNightCycle) {
      console.log('Day/Night cycle missing in animate. Adding it now.');
      this.initializeDayNightCycle();
      this._dayNightMissingLogged = true;
    }

    if (this._controlsPaused) {
      // Only render the scene, don't process movement

      if (this.dayNightCycle) {
        this.dayNightCycle.update();
      }

      this.renderer.render(this.scene, this.camera);
      return;
    }
    // fps counter
    if (this.stats && this.showStats) {
      this.stats.begin();
    }

    this.updateTimeBasedMovement();

    const playerPosition = this.camera.position.clone();
    let nearestTeleporter = null;
    let shortestDistance = Infinity;

    this.teleporters.forEach(teleporter => {
      const distance = playerPosition.distanceTo(teleporter.position);
      if (distance < 2 && distance < shortestDistance) {  // Within 2 units
        shortestDistance = distance;
        nearestTeleporter = teleporter;
      }
    });

    // Show/hide teleport prompt based on proximity
    this.updateTeleportPrompt(nearestTeleporter);

    let nearestDoor = null;
    shortestDistance = Infinity;

    this.doors.forEach(door => {
      const distance = playerPosition.distanceTo(door.position);
      if (distance < 2 && distance < shortestDistance) { // Within 2 units
        shortestDistance = distance;
        nearestDoor = door;
      }
    });

    // Show/hide door prompt based on proximity
    this.updateDoorPrompt(nearestDoor);

    // Animate teleporter particles
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Points && child.userData.animate) {
        const positions = child.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          // Circular motion
          const time = Date.now() * 0.001;
          const radius = 0.5;
          positions[i] = Math.cos(time + i) * radius;
          positions[i + 1] = Math.sin(time * 0.5) * 0.2;  // Vertical wobble
          positions[i + 2] = Math.sin(time + i) * radius;
        }
        child.geometry.attributes.position.needsUpdate = true;
      }
    });

    // const playerPosition = this.camera.position.clone();
    let nearestSplashArt = null;
    // let shortestDistance = Infinity;

    this.markers.forEach(marker => {
      if (marker.type === 'splash-art') {
        const markerPos = new THREE.Vector3(
          marker.x / 50 - this.boxWidth / 2,
          marker.data.height || 1,
          marker.y / 50 - this.boxDepth / 2
        );
        const distance = playerPosition.distanceTo(markerPos);

        if (distance < 2 && distance < shortestDistance) {
          shortestDistance = distance;
          nearestSplashArt = marker;
        }
      }
    });

    // Show/hide splash art prompt
    if (nearestSplashArt && !this.activeSplashArt) {
      const prompt = this.createSplashArtPrompt();
      prompt.textContent = nearestSplashArt.data.inspectMessage || 'Press E to inspect';
      prompt.style.display = 'block';
      this.nearestSplashArt = nearestSplashArt;
    } else if (!nearestSplashArt && this.splashArtPrompt) {
      this.splashArtPrompt.style.display = 'none';
      this.nearestSplashArt = null;
    }

    // const playerPosition = this.camera.position.clone();
    let nearestProp = null;

    this.scene.children.forEach(child => {
      if (child.userData?.type === 'prop') {
        const distance = playerPosition.distanceTo(child.position);
        if (distance < 2 && distance < shortestDistance) {
          shortestDistance = distance;
          nearestProp = child;
        }
      }
    });

    // Show/hide pickup prompt
    if (nearestProp && !this.inventory.has(nearestProp.userData.id)) {
      const prompt = this.createPickupPrompt();
      prompt.textContent = 'Press E to pick up';
      prompt.style.display = 'block';
      this.nearestProp = nearestProp;
    } else if (this.pickupPrompt) {
      this.pickupPrompt.style.display = 'none';
      this.nearestProp = null;
    }

    // // Find nearest encounter marker
    let nearestEncounter = null;
    let minEncounterDist = 3; // Detection range

    // Only check for encounters if we're not in cooldown and don't have an active encounter
    if (!this.encounterCooldown && !this.activeEncounter) {
      // Loop through scene objects to find encounter markers
      this.scene.children.forEach(object => {
        if (object.userData && object.userData.type === 'encounter') {
          const dist = playerPosition.distanceTo(object.position);
          if (dist < minEncounterDist && (!nearestEncounter || dist < minEncounterDist)) {
            nearestEncounter = object;
          }
        }
      });
    }

    // Show or hide encounter prompt
    if (nearestEncounter && !this.activeEncounter && !this.activeSplashArt) {
      const prompt = this.createEncounterPrompt();
      prompt.textContent = 'Press E to approach monster';
      prompt.style.display = 'block';
      this.nearestEncounter = nearestEncounter;
    } else if (!nearestEncounter && this.encounterPrompt) {
      this.encounterPrompt.style.display = 'none';
      this.nearestEncounter = null;
    }


    // Update physics and camera height
    this.camera.position.y = this.physics.update();
    // original renderer code
    // this.renderer.render(this.scene, this.camera);


    if (this.playerLight) {
      this.playerLight.position.copy(this.camera.position);
    }


    this.updateAutoLightSources(this.deltaTime || 0.016);

    // rendering distance baised upon hardware levels
    this.updateObjectVisibility();

    // Optimize particle systems
    this.optimizeParticleSystems();

    if (this.visualEffects) {
      const time = performance.now() * 0.001;
      const deltaTime = time - (this.lastTime || time);
      this.lastTime = time;

      this.visualEffects.update(deltaTime);
    } //else {
    // Fallback to standard rendering

    if (this.dayNightCycle) {
      this.dayNightCycle.update();
    }

    this.renderer.render(this.scene, this.camera);


    if (this.stats && this.showStats) {
      this.stats.end();
    }


  };


  createLandingEffect(position) {
    // Create a particle system for dust effect
    const particleCount = 20;
    const particles = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Set up particles in a small radius around landing position
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Position within small radius
      const radius = 0.2 + Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;

      positions[i3] = position.x + Math.cos(angle) * radius;
      positions[i3 + 1] = position.y + 0.05;  // Just above ground
      positions[i3 + 2] = position.z + Math.sin(angle) * radius;

      // Dust color (light brown/gray)
      colors[i3] = 0.8 + Math.random() * 0.2;
      colors[i3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i3 + 2] = 0.6 + Math.random() * 0.2;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material with particle texture
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    this.scene.add(particleSystem);

    // Animate particles rising and fading
    const startTime = Date.now();
    const duration = 1000;  // 1 second

    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // Update particles
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          // Move upward slowly
          particles.attributes.position.array[i3 + 1] += 0.003;
        }

        particles.attributes.position.needsUpdate = true;

        // Fade out
        particleMaterial.opacity = 0.7 * (1 - progress);

        requestAnimationFrame(animateParticles);
      } else {
        // Remove when done
        this.scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        particleMaterial.dispose();
      }
    };

    animateParticles();
  }


  // Add this method to Scene3DController
  // In loadPreferences method
  loadPreferences() {
    try {
      // Load preferences from localStorage
      const savedPrefs = localStorage.getItem('appPreferences');
      if (savedPrefs) {
        this.preferences = JSON.parse(savedPrefs);

        // Apply quality level
        const qualityLevel = this.preferences.qualityPreset === 'auto' ?
          this.preferences.detectedQuality || 'medium' : this.preferences.qualityPreset;

        // Set quality level
        this.qualityLevel = qualityLevel;

        // Apply settings
        this.setQualityLevel(qualityLevel, {
          shadows: this.preferences.shadowsEnabled,
          antialias: this.preferences.antialiasEnabled,
          highQualityTextures: this.preferences.hqTextures,
          ambientOcclusion: this.preferences.ambientOcclusion
        });

        // Apply lighting toggle
        const lightingEnabled = this.preferences.disableLighting !== true;
        this.setLightingEnabled(lightingEnabled);

        // Apply movement speed
        if (this.moveState) {
          this.moveState.baseSpeed = 0.025 * (this.preferences.movementSpeed || 1.0);
          this.moveState.speed = this.moveState.sprint ?
            this.moveState.baseSpeed * 2 : this.moveState.baseSpeed;
        }

        console.log(`Loaded preferences with quality level: ${qualityLevel}, lighting: ${lightingEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  }


  async show3DView() {
    const { drawer, container, progress } = this.setupDrawer();

    progress.style.display = "block";
    progress.value = 0;

    const updateStatus = (percent) => {
      progress.value = percent;
      progress.innerHTML = `Processing... ${Math.round(percent)}%`;
    };

    // Check for URL-based tokens
    const hasUrlTokens = this.markers.some(marker =>
      marker.type === "encounter" &&
      marker.data?.monster?.token?.url &&
      !marker.data.monster.token.data?.startsWith('data:')
    );

    if (hasUrlTokens) {
      // Show warning toast
      const toast = document.createElement('div');
      toast.className = 'token-warning-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 16px;
        border-radius: 4px;
        z-index: 10000;
        max-width: 400px;
        text-align: center;
      `;

      toast.innerHTML = `
        <span class="material-icons" style="font-size: 24px; display: block; margin: 0 auto 8px auto;">warning</span>
        <div>
          <div style="font-weight: bold; margin-bottom: 8px;">3D Token Warning</div>
          <div>Some monsters use URL-based tokens which won't display correctly in 3D view.</div>
          <div style="margin-top: 8px;">Please update monsters in the Resource Manager first.</div>
        </div>
      `;

      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }

    try {
      drawer.show();

      // Calculate dimensions
      const sidebar = document.querySelector(".sidebar");
      const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
      const availableWidth = window.innerWidth - sidebarWidth;

      // Initialize the scene
      await this.initialize(container, availableWidth, window.innerHeight);

      // Initialize with map data
      await this.initializeWithData({
        rooms: this.rooms,
        textures: this.textures,
        tokens: this.tokens,
        cellSize: this.cellSize,
        playerStart: this.playerStart,
        baseImage: this.baseImage,
        markers: this.markers,
        textureManager: this.textureManager,
        props: this.props
      });

      // Process the scene
      await this.init3DScene(updateStatus);

      // Instructions overlay
      // const instructions = document.createElement("div");
      // instructions.style.cssText = `
      //   position: absolute;
      //   top: 50%;
      //   left: 50%;
      //   transform: translate(-50%, -50%);
      //   background: rgba(0, 0, 0, 0.7);
      //   color: white;
      //   padding: 20px;
      //   width: 75vw;
      //   border-radius: 5px;
      //   text-align: center;
      //   pointer-events: none;
      // `;
      // instructions.innerHTML = `
      //   Click to Start<br>
      //   WASD or Arrow Keys to move<br>
      //   Hold Shift or Right Mouse Button to sprint<br>
      //   ~ to show FPS<br>
      //   I for inventory<br>
      //   E as the Action key<br>
      //   P for Party Manager<br>
      //   ESC to exit
      // `;
      // container.appendChild(instructions);

      // Controls event listeners
      // this.controls.addEventListener("lock", () => {
      //   instructions.style.display = "none";
      // });

      // this.controls.addEventListener("unlock", () => {
      //   instructions.style.display = "block";
      // });

      const gameMenu = new GameMenu(this, container);

      // Update control event listeners:
      this.controls.addEventListener("lock", () => {
        // Hide menu if visible when controls are locked
        if (gameMenu && gameMenu.isVisible) {
          gameMenu.hide();
        }
      });
      
      this.controls.addEventListener("unlock", () => {
        // Don't automatically show menu on unlock
        // GameMenu handles showing itself via ESC key
      });
      
      // Store reference to game menu for cleanup
      this._gameMenu = gameMenu;

      // Call this after initializing controls in show3DView
this.modifyControlsListeners();

// Set initial game state (typically 'playing' or 'initializing')
this.gameState = 'initializing';

      // Start animation loop
      const animate = () => {
        if (drawer.open) {
          requestAnimationFrame(animate);
          this.animate();
        }
      };
      animate();

      // Window resize handler
      const handleResize = () => {
        const sidebar = document.querySelector(".sidebar");
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const availableWidth = window.innerWidth - sidebarWidth;

        this.renderer.setSize(availableWidth, window.innerHeight);
        this.camera.aspect = availableWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', handleResize);

      // Cleanup on drawer close
      drawer.addEventListener("sl-after-hide", () => {
        window.removeEventListener('resize', handleResize);
        this.cleanup();
        container.innerHTML = "";
      }, { once: true });

    } catch (error) {
      console.error("Error creating 3D view:", error);
      container.innerHTML = `
        <div style="color: red; padding: 20px;">
          Error creating 3D view: ${error.message}
        </div>
      `;
    } finally {
      progress.style.display = "none";
    }
  }

  async processRooms(scene, mainBox, updateStatus) {
    let result = mainBox;
    const totalRooms = this.rooms.length;

    for (let i = 0; i < totalRooms; i++) {
      const room = this.rooms[i];
      const roomMesh = this.createRoomShape(room);

      if (roomMesh) {
        try {
          // Perform CSG subtraction
          const bspA = CSG.fromMesh(result);
          const bspB = CSG.fromMesh(roomMesh);
          const bspResult = bspA.subtract(bspB);
          result = CSG.toMesh(bspResult, result.matrix, result.material);
        } catch (error) {
          console.error(`Error processing room ${room.id}:`, error);
        }
      }

      if (updateStatus) {
        updateStatus(20 + 60 * (i / totalRooms));
      }
    }

    this.scene.add(result);
    return result;
  }

  async assignTexture(structure, textureData, position = null) {
    if (!structure || !textureData) return null;

    const assignment = {
      id: Date.now(),
      textureId: textureData.id,
      structureId: structure.id,
      structureType: structure.type,
      position: position || null, // For specific placement on walls/rooms
      dateAssigned: new Date().toISOString()
    };

    // Initialize texture assignments if needed
    if (!structure.textureAssignments) {
      structure.textureAssignments = new Map();
    }

    structure.textureAssignments.set(assignment.id, assignment);

    // If this is a door texture, handle it specially
    if (textureData.category === 'doors') {
      return this.createDoor(structure, assignment);
    }

    // If this is a prop (like a torch), handle placement
    if (textureData.category === 'props') {
      return this.createProp(structure, assignment);
    }

    return assignment;
  }

  processDoorMarkers() {
    const doorMarkers = this.markers.filter(m => m.type === 'door' && m.data.texture);

    doorMarkers.forEach(marker => {
      console.log('Processing door for interaction:', marker);

      // Convert map coordinates to 3D world coordinates
      const x = marker.x / 50 - this.boxWidth / 2;
      const z = marker.y / 50 - this.boxDepth / 2;

      // Get elevation at door position
      const { elevation } = this.getElevationAtPoint(x, z);

      // Create door interaction point
      const doorInfo = {
        marker: marker,
        position: new THREE.Vector3(x, elevation + 1.0, z), // Position at eye level
        rotation: marker.data.door?.position?.rotation || 0,
        id: marker.id
      };

      // Add a visual indicator for debugging (can be removed later)
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        visible: false // Hide in production, set to true for debugging
      });

      const doorIndicator = new THREE.Mesh(geometry, material);
      doorIndicator.position.copy(doorInfo.position);
      this.scene.add(doorIndicator);

      doorInfo.indicator = doorIndicator;
      this.doors.push(doorInfo);
    });

    console.log(`Added ${this.doors.length} door interaction points`);
  }

  updateDoorPrompt(nearestDoor) {
    if (!this.doorPrompt) {
      // Create prompt if it doesn't exist
      this.doorPrompt = document.createElement('div');
      this.doorPrompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        display: none;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(this.doorPrompt);

      // Add keypress listener for door interaction
      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE') {
          // Handle teleporter interaction
          if (this.teleportPrompt && this.teleportPrompt.style.display === 'block') {
            this.executeTeleport();
          }
          // Handle door interaction
          else if (this.doorPrompt && this.doorPrompt.style.display === 'block') {
            this.executeDoorTeleport();
          }
        }
      });
    }

    // Only show door prompt if no teleporter prompt is active
    const teleporterActive = this.teleportPrompt && this.teleportPrompt.style.display === 'block';

    if (nearestDoor && !teleporterActive) {
      this.doorPrompt.textContent = 'Press E to open door';
      this.doorPrompt.style.display = 'block';
      this.activeDoor = nearestDoor;
    } else {
      this.doorPrompt.style.display = 'none';
      this.activeDoor = null;
    }
  }


  executeDoorTeleport() {
    if (!this.activeDoor) return;

    if (this.physics) {
      // Reset walking surface flags - they'll be checked next frame
      this.physics.insideRoomWall = false;
      this.physics.onTopOfWall = false;

      // Force an immediate check of what surface we're on
      setTimeout(() => {
        this.physics.checkWalkingSurface();
      }, 100);
    }


    console.log("Executing simplified door teleport");

    // Get the door's position and rotation
    const doorX = this.activeDoor.position.x;
    const doorZ = this.activeDoor.position.z;
    const doorRotationDegrees = this.activeDoor.rotation;

    // Convert door rotation to radians if it's in degrees
    const doorRotation = typeof doorRotationDegrees === 'number'
      ? doorRotationDegrees * Math.PI / 180
      : doorRotationDegrees;

    console.log(`Door at (${doorX}, ${doorZ}) with rotation ${doorRotationDegrees}°`);

    // Get player's current position
    const playerX = this.camera.position.x;
    const playerY = this.camera.position.y; // Keep player at same height
    const playerZ = this.camera.position.z;

    console.log(`Player at (${playerX}, ${playerZ})`);

    // Determine teleport offset direction based on door rotation
    // For a door at -90 degrees, this would be along the X-axis
    let offsetX = 0;
    let offsetZ = 0;

    if (Math.abs(doorRotationDegrees) === 90 || Math.abs(doorRotationDegrees) === 270) {
      // Door faces along X axis (east-west)
      offsetX = 4.0; // Use a larger offset for testing
      offsetZ = 0;
    } else {
      // Door faces along Z axis (north-south) 
      offsetX = 0;
      offsetZ = 4.0; // Use a larger offset for testing
    }

    // Determine which side of the door the player is on by comparing positions
    let destX, destZ;

    if (doorRotationDegrees === 90 || doorRotationDegrees === -270) {
      // Door faces east (+X)
      if (playerX > doorX) {
        // Player is east of door, teleport west
        destX = doorX - offsetX;
        destZ = doorZ;
        console.log("Player is east, teleporting west");
      } else {
        // Player is west of door, teleport east
        destX = doorX + offsetX;
        destZ = doorZ;
        console.log("Player is west, teleporting east");
      }
    }
    else if (doorRotationDegrees === -90 || doorRotationDegrees === 270) {
      // Door faces west (-X)
      if (playerX < doorX) {
        // Player is west of door, teleport east
        destX = doorX + offsetX;
        destZ = doorZ;
        console.log("Player is west, teleporting east");
      } else {
        // Player is east of door, teleport west
        destX = doorX - offsetX;
        destZ = doorZ;
        console.log("Player is east, teleporting west");
      }
    }
    else if (doorRotationDegrees === 0 || doorRotationDegrees === 360) {
      // Door faces north (+Z)
      if (playerZ > doorZ) {
        // Player is north of door, teleport south
        destX = doorX;
        destZ = doorZ - offsetZ;
        console.log("Player is north, teleporting south");
      } else {
        // Player is south of door, teleport north
        destX = doorX;
        destZ = doorZ + offsetZ;
        console.log("Player is south, teleporting north");
      }
    }
    else if (doorRotationDegrees === 180 || doorRotationDegrees === -180) {
      // Door faces south (-Z)
      if (playerZ < doorZ) {
        // Player is south of door, teleport north
        destX = doorX;
        destZ = doorZ + offsetZ;
        console.log("Player is south, teleporting north");
      } else {
        // Player is north of door, teleport south
        destX = doorX;
        destZ = doorZ - offsetZ;
        console.log("Player is north, teleporting south");
      }
    }
    else {
      // For non-cardinal rotations, use a simpler approach
      // Just teleport the player directly through the door
      const dx = playerX - doorX;
      const dz = playerZ - doorZ;
      destX = doorX - dx * 2; // Teleport to opposite side
      destZ = doorZ - dz * 2;
      console.log("Using mirror teleport for angled door");
    }

    console.log(`Teleporting to (${destX}, ${destZ})`);

    // Create flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 9999;
  `;
    document.body.appendChild(flash);

    // Play door sound if available
    if (this.doorSound) {
      this.doorSound.play();
    }

    // Perform teleport
    requestAnimationFrame(() => {
      flash.style.opacity = '0.7';

      setTimeout(() => {
        // DIRECTLY SET POSITION WITH NO FANCY MATH
        this.camera.position.set(destX, playerY, destZ);

        // If using controls with their own position object, update it too
        if (this.controls && this.controls.getObject) {
          this.controls.getObject().position.set(destX, playerY, destZ);
        }

        // Update physics if available
        if (this.physics) {
          this.physics.currentGroundHeight = 0; // Reset to ground level
        }

        if (this.physics) {
          // Allow movement inside walls after teleporting
          this.physics.insideRoomWall = true;

          // Log this change
          console.log("Enabled movement inside wall rooms");
        }

        console.log("Teleport complete");

        // Fade out flash
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 200);
      }, 100);
    });
    setTimeout(() => {
      this.updateInsideWallRoomState();
    }, 100);
  }


  updateInsideWallRoomState() {
    // Cast rays in 6 directions (up, down, forward, backward, left, right)
    const directions = [
      new THREE.Vector3(0, 1, 0),   // Up
      new THREE.Vector3(0, -1, 0),  // Down
      new THREE.Vector3(0, 0, 1),   // Forward
      new THREE.Vector3(0, 0, -1),  // Backward
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(-1, 0, 0)   // Left
    ];

    let wallCount = 0;
    directions.forEach(dir => {
      const raycaster = new THREE.Raycaster(
        this.camera.position,
        dir,
        0,
        5 // Check up to 5 units away
      );

      const walls = this.scene.children.filter(obj => obj.userData?.isWall);
      const hits = raycaster.intersectObjects(walls);

      if (hits.length > 0) {
        wallCount++;
      }
    });

    // If surrounded by walls in at least 4 directions, we're inside a wall room
    this.insideWallRoom = wallCount >= 4;
    console.log(`Player is ${this.insideWallRoom ? 'inside' : 'outside'} a wall room. Wall count: ${wallCount}`);
  }

  processDoorMarkers() {
    const doorMarkers = this.markers.filter(m => m.type === 'door');
    console.log(`Found ${doorMarkers.length} door markers`);

    if (doorMarkers.length === 0) return;

    doorMarkers.forEach(marker => {
      // Get the basic position
      const x = marker.x / 50 - this.boxWidth / 2;
      const z = marker.y / 50 - this.boxDepth / 2;

      // Get elevation at door position
      const { elevation } = this.getElevationAtPoint(x, z);

      // Extract rotation from door data or element
      let rotation = 0;

      // Try to get rotation from the door data
      if (marker.data && marker.data.door && marker.data.door.position &&
        marker.data.door.position.rotation !== undefined) {
        rotation = marker.data.door.position.rotation;
        console.log(`Door rotation from data: ${rotation}°`);
      }
      // Try to get it from element style transform
      else if (marker.element && marker.element.style && marker.element.style.transform) {
        // Extract rotation from transform style: "rotate(Xdeg)"
        const transformMatch = marker.element.style.transform.match(/rotate\((-?\d+)deg\)/);
        if (transformMatch && transformMatch[1]) {
          rotation = parseInt(transformMatch[1]);
          console.log(`Door rotation from element style: ${rotation}°`);
        }
      }

      console.log(`Door marker ${marker.id} at (${x.toFixed(2)}, ${z.toFixed(2)}) with rotation ${rotation}°`);

      // Create door interaction point
      const doorInfo = {
        marker,
        position: new THREE.Vector3(x, elevation + 1.0, z), // Position at eye level
        rotation, // Store in degrees for easier debugging
        id: marker.id
      };

      // Log door info for debugging
      console.log("Door info:", {
        id: doorInfo.id,
        position: `(${x.toFixed(2)}, ${elevation.toFixed(2)}, ${z.toFixed(2)})`,
        rotation: doorInfo.rotation
      });

      // Add a visual indicator for debugging
      const indicatorSize = 0.2; // Make it bigger for visibility
      const geometry = new THREE.SphereGeometry(indicatorSize, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.6,
        visible: this.debugVisuals // Make visible for debugging
      });

      const doorIndicator = new THREE.Mesh(geometry, material);
      doorIndicator.position.copy(doorInfo.position);
      this.scene.add(doorIndicator);

      doorInfo.indicator = doorIndicator;
      this.doors.push(doorInfo);

      if (this.debugVisuals) {
        // // Draw a line in the door's forward direction for debugging
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          doorInfo.rotation * Math.PI / 180
        );
        forwardVector.normalize().multiplyScalar(1.0); // 1 unit length

        const directionEnd = new THREE.Vector3()
          .addVectors(doorInfo.position, forwardVector);

        const directionGeometry = new THREE.BufferGeometry().setFromPoints([
          doorInfo.position,
          directionEnd
        ]);

        const directionMaterial = new THREE.LineBasicMaterial({
          color: 0x00ff00,
          linewidth: 3
        });

        const directionLine = new THREE.Line(directionGeometry, directionMaterial);
        this.scene.add(directionLine);

        doorInfo.directionLine = directionLine;
      }

    });

    console.log(`Added ${this.doors.length} door interaction points`);
  }



  async loadDoorSound() {
    if (!this.resourceManager) {
      console.warn('ResourceManager not available for door sound loading');
      return;
    }

    const listener = new THREE.AudioListener();
    this.camera.add(listener);

    try {
      const soundData = await this.resourceManager.getThreeJSSound('door.mp3', 'effects');
      if (soundData) {
        this.doorSound = await this.resourceManager.loadThreeJSSound(soundData, listener);
        if (this.doorSound) {
          console.log('Door sound loaded successfully');
        }
      }
    } catch (error) {
      console.warn('Could not load door sound:', error);
    }
  }


  async loadJumpSound() {
    if (!this.resourceManager) {
      console.warn('ResourceManager not available for door sound loading');
      return;
    }

    const listener = new THREE.AudioListener();
    this.camera.add(listener);

    try {
      const soundData = await this.resourceManager.getThreeJSSound('jump.mp3', 'effects');
      if (soundData) {
        this.doorSound = await this.resourceManager.loadThreeJSSound(soundData, listener);
        if (this.doorSound) {
          console.log('Door sound loaded successfully');
        }
      }
    } catch (error) {
      console.warn('Could not load door sound:', error);
    }
  }

  createProp(structure, assignment) {
    const prop = {
      id: assignment.id,
      parentId: structure.id,
      textureId: assignment.textureId,
      position: assignment.position,
      rotation: 0
    };

    // Add visual representation
    const propElement = document.createElement('div');
    propElement.className = 'prop';
    propElement.style.cssText = `
        position: absolute;
        pointer-events: all;
        cursor: pointer;
        width: ${this.cellSize}px;
        height: ${this.cellSize}px;
    `;

    // Add to structure
    if (!structure.props) structure.props = new Map();
    structure.props.set(prop.id, prop);

    return prop;
  }

  createTeleporterParticles(x, y, z) {
    const geometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;     // X
      positions[i * 3 + 1] = 0; // Y
      positions[i * 3 + 2] = 0; // Z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.6
    });

    const particles = new THREE.Points(geometry, material);
    particles.position.set(x, y, z);

    // Store initial positions for animation
    particles.userData.initialPositions = [...positions];
    particles.userData.animate = true;

    return particles;
  }

  updateTeleportPrompt(nearestTeleporter) {
    if (!this.teleportPrompt) {
      // Create prompt if it doesn't exist
      this.teleportPrompt = document.createElement('div');
      this.teleportPrompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        display: none;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(this.teleportPrompt);

      // Add keypress listener for teleportation
      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE' && this.teleportPrompt.style.display === 'block') {
          this.executeTeleport();
        }
      });
    }

    if (nearestTeleporter) {
      this.teleportPrompt.textContent = 'Press E to teleport';
      this.teleportPrompt.style.display = 'block';
      this.activeTeleporter = nearestTeleporter;
    } else {
      this.teleportPrompt.style.display = 'none';
      this.activeTeleporter = null;
    }
  }


  executeTeleport() {
    if (!this.activeTeleporter) return;

    console.log(`Executing teleport from marker ${this.activeTeleporter.marker.id}`);

    // Find the paired teleporter by ID rather than object reference
    const pairedMarkerId = this.activeTeleporter.pairedMarkerId;
    console.log(`Looking for paired marker with ID ${pairedMarkerId}`);

    if (!pairedMarkerId) {
      console.error("No paired marker ID found for teleporter");
      return;
    }

    // Find the destination teleporter
    const destination = this.teleporters.find(t =>
      t.marker.id === pairedMarkerId
    );

    if (!destination) {
      console.error(`Could not find destination teleporter with ID ${pairedMarkerId}`);
      return;
    }

    console.log(`Found destination teleporter: ${destination.marker.id}`);

    // Get destination coordinates from teleporter
    const destX = destination.position.x;
    const destZ = destination.position.z;
    const destY = destination.position.y;

    console.log("Teleport destination:", {
      x: destX.toFixed(2),
      y: destY.toFixed(2),
      z: destZ.toFixed(2)
    });

    // Create flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 9999;
  `;
    document.body.appendChild(flash);

    // Animate teleportation
    requestAnimationFrame(() => {
      flash.style.opacity = '1';
      setTimeout(() => {
        // Update the physics controller's ground height directly
        if (this.physics) {
          // Update the physics ground height to match destination elevation
          // Subtract the small offset that's added to teleporter position (0.05)
          this.physics.currentGroundHeight = destY - 0.05;
          console.log("Setting physics ground height:", this.physics.currentGroundHeight);

          // Reset any jumping or falling state
          this.physics.isJumping = false;
          this.physics.isFalling = false;
        }

        // Move the player - position + physics-controlled player height
        const playerHeight = this.physics ? this.physics.playerHeight : 1.7;
        this.camera.position.set(
          destX,
          destY - 0.05 + playerHeight, // Adjust to player eye level
          destZ
        );

        console.log("Final position:", {
          x: this.camera.position.x.toFixed(2),
          y: this.camera.position.y.toFixed(2),
          z: this.camera.position.z.toFixed(2)
        });

        // Fade out
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 300);
      }, 150);
    });
  }

  createEncounterPrompt() {
    if (!this.encounterPrompt) {
      this.encounterPrompt = document.createElement('div');
      this.encounterPrompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        display: none;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(this.encounterPrompt);

      // Add keypress listener for encounter interaction
      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE' && this.nearestEncounter) {
          this.handleEncounter(this.nearestEncounter);
        }
      });
    }
    return this.encounterPrompt;
  }

  createSplashArtPrompt() {
    if (!this.splashArtPrompt) {
      this.splashArtPrompt = document.createElement('div');
      this.splashArtPrompt.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 15px 20px;
          border-radius: 5px;
          display: none;
          font-family: Arial, sans-serif;
          pointer-events: none;
          z-index: 1000;
      `;
      document.body.appendChild(this.splashArtPrompt);
    }
    return this.splashArtPrompt;
  }

  // Update the showSplashArt method in Scene3DController
  showSplashArt(marker) {
    // Pause controls
    this.pauseControls();

    // Get the actual splash art from the resource manager
    const category = marker.data.splashArt.category;
    const artId = marker.data.splashArt.id;
    const art = this.resourceManager?.resources.splashArt[category]?.get(artId);

    console.log('Found splash art:', {
      category,
      artId,
      found: !!art
    });

    if (!art?.data) {
      console.warn('Could not find splash art data in resource manager');
      return;
    }

    this.pauseControls();

    const overlay = document.createElement('div');
    overlay.className = 'splash-art-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
  `;

    const artContainer = document.createElement('div');
    artContainer.style.cssText = `
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      transform: scale(0.95);
      transition: transform 0.3s ease;
  `;

    const img = document.createElement('img');
    img.src = art.data; // Use the art data from resource manager
    img.style.cssText = `
      max-width: 100%;
      max-height: 90vh;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      text-align: center;
  `;
    loadingIndicator.innerHTML = `
      <span class="material-icons" style="font-size: 48px;">hourglass_top</span>
      <div>Loading...</div>
  `;
    artContainer.appendChild(loadingIndicator);

    // Handle image load
    img.onload = () => {
      loadingIndicator.remove();
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        artContainer.style.transform = 'scale(1)';
      });
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // Prevent other ESC handlers
        e.stopPropagation();
        this.hideSplashArt();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '<span class="material-icons">close</span>';
    closeButton.style.cssText = `
      position: absolute;
      top: -40px;
      right: -40px;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 8px;
      font-size: 24px;
  `;

    artContainer.appendChild(img);
    artContainer.appendChild(closeButton);
    overlay.appendChild(artContainer);
    document.body.appendChild(overlay);

    // Play sound if assigned
    if (marker.data.effects?.inspectSound) {
      this.resourceManager.playSound(marker.data.effects.inspectSound.id, 'effects');
    }

    const closeMessage = document.createElement('div');
    closeMessage.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    text-align: center;
    color: white;
    font-family: Arial, sans-serif;
    font-size: 14px;
`;
    closeMessage.textContent = 'Click anywhere to close';
    overlay.appendChild(closeMessage);

    closeButton.addEventListener('click', () => {
      this.hideSplashArt();
      document.removeEventListener('keydown', handleEsc, true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideSplashArt();
        document.removeEventListener('keydown', handleEsc, true);
      }
    });

    document.body.appendChild(overlay);
    this.activeSplashArt = overlay;
  }

  hideSplashArt() {
    if (this.activeSplashArt) {
      this.activeSplashArt.style.opacity = '0';
      setTimeout(() => {
        this.activeSplashArt.remove();
        this.activeSplashArt = null;

        // Resume controls when art is hidden
        this.resumeControls();
      }, 300);
    }
  }

  // Add this method to Scene3DController
  optimizeRenderer() {
    if (!this.renderer) {
      console.warn('Cannot optimize renderer: not initialized');
      return false;
    }

    console.log('Optimizing WebGL renderer...');

    // Enable object sorting for correct transparency
    this.renderer.sortObjects = true;

    // Disable physically correct lights for better performance
    if (this.renderer.physicallyCorrectLights !== undefined) {
      this.renderer.physicallyCorrectLights = false;
    }

    // Optimize shadow map settings if enabled
    if (this.renderer.shadowMap.enabled) {
      // Use basic shadow maps for performance
      this.renderer.shadowMap.type = THREE.BasicShadowMap;

      // Limit shadow map size on lower-end devices
      if (this.isMobileOrLowEndDevice()) {
        this.renderer.shadowMap.autoUpdate = false; // Update only when needed
        this.renderer.shadowMap.needsUpdate = true; // Initial update
      }
    }

    // Set appropriate pixel ratio based on device
    const devicePixelRatio = window.devicePixelRatio || 1;
    let targetPixelRatio = devicePixelRatio;

    // Get current quality level
    const qualityLevel = this.qualityLevel || 'medium';

    // Adjust pixel ratio based on quality setting
    // switch (qualityLevel) {
    //   case 'ultra':
    //     // Use full pixel ratio, but cap extremely high DPR for 4K+ displays
    //     targetPixelRatio = Math.min(devicePixelRatio, 2.5);
    //     this.renderer.physicallyCorrectLights = true;
    //     break;
    //   case 'high':
    //     // Use full pixel ratio, but cap extremely high DPR for 4K+ displays
    //     targetPixelRatio = Math.min(devicePixelRatio, 2.5);
    //     break;
    //   case 'medium':
    //     // Cap at 1.5 for medium quality
    //     targetPixelRatio = Math.min(devicePixelRatio, 1.5);
    //     break;
    //   case 'low':
    //     // Use 1.0 for low quality (no supersampling)
    //     targetPixelRatio = 1.0;
    //     break;
    //   default:
    //     // Default to medium behavior
    //     targetPixelRatio = Math.min(devicePixelRatio, 1.5);
    // }

        // In optimizeRenderer method, update the pixel ratio section:
    switch (qualityLevel) {
      case 'ultra':
        // Ultra uses native device pixel ratio with no cap for maximum sharpness
        targetPixelRatio = devicePixelRatio;
        // Enable physically correct lights for ultra quality
        if (this.renderer.physicallyCorrectLights !== undefined) {
          this.renderer.physicallyCorrectLights = true;
        }
        // Use higher quality shadow maps
        if (this.renderer.shadowMap.enabled) {
          this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        break;
        
      case 'high':
        targetPixelRatio = Math.min(devicePixelRatio, 2);
        break;
        
      case 'medium':
        targetPixelRatio = Math.min(devicePixelRatio, 1.5);
        break;
        
      case 'low':
        targetPixelRatio = Math.min(devicePixelRatio, 1);
        break;
        
      default:
        // Default to medium behavior
        targetPixelRatio = Math.min(devicePixelRatio, 1.5);
    }

    // Apply the calculated pixel ratio
    if (this.renderer.getPixelRatio() !== targetPixelRatio) {
      console.log(`Setting renderer pixel ratio: ${this.renderer.getPixelRatio()} → ${targetPixelRatio}`);
      this.renderer.setPixelRatio(targetPixelRatio);
    }

    // Optimize precision based on device
    if (this.isMobileOrLowEndDevice()) {
      if (this.renderer.outputColorSpace !== THREE.LinearSRGBColorSpace) {
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      }
    }

    // Set appropriate tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    console.log('Renderer optimization complete');
    return true;
  }

  // Helper method to detect mobile/low-end devices
  isMobileOrLowEndDevice() {
    // Check for mobile user agent
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Check for low memory (if available)
    const isLowMemory = navigator.deviceMemory !== undefined && navigator.deviceMemory < 4;

    // Check for low CPU cores (if available)
    const isLowCPU = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4;

    // Check for known low-end GPU (this is a simplified version)
    let isLowEndGPU = false;
    try {
      if (this.renderer) {
        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          // Check for integrated graphics or known low-end GPUs
          isLowEndGPU = renderer && (
            renderer.includes('Intel') ||
            renderer.includes('Intel(R)') ||
            renderer.includes('HD Graphics') ||
            renderer.includes('UHD Graphics')
          );
        }
      }
    } catch (e) {
      console.warn('Could not detect GPU info:', e);
    }

    return isMobile || isLowMemory || isLowCPU || isLowEndGPU;
  }

  // Add this method to your Scene3DController class
  updateObjectVisibility() {
    if (!this.camera) return;

    const playerPos = this.camera.position;
    const nearDistance = 20;  // Objects within this range get full detail
    const farDistance = 40;   // Objects beyond this get simplified or hidden

    this.scene.traverse(object => {
      // Skip non-mesh objects or those set to always show
      if (!object.isMesh || object.userData.alwaysShow) return;

      // Skip walls and other essential objects
      if (object.userData && (object.userData.isWall || object.userData.isEssential)) {
        return;
      }

      const distance = playerPos.distanceTo(object.position);

      // Objects close to player get full detail
      if (distance < nearDistance) {
        object.visible = true;
        // Restore original material if it exists
        if (object.userData.originalMaterial) {
          object.material = object.userData.originalMaterial;
          delete object.userData.originalMaterial;
        }
      }
      // Objects at medium distance get simplified
      else if (distance < farDistance) {
        object.visible = true;

        // If it's a complex object, use a simpler material
        if (object.material && object.material.isMeshStandardMaterial) {
          // Store original material if not already stored
          if (!object.userData.originalMaterial) {
            object.userData.originalMaterial = object.material;

            // Create a simplified material (cheaper to render)
            const simpleMaterial = new THREE.MeshBasicMaterial({
              color: object.material.color ? object.material.color.clone() : 0xcccccc,
              map: object.material.map,
              transparent: object.material.transparent,
              opacity: object.material.opacity
            });

            object.material = simpleMaterial;
          }
        }
      }
      // Very distant objects can be hidden
      else {
        // Don't hide essential objects
        if (!object.userData ||
          (object.userData.type !== 'wall' &&
            object.userData.type !== 'prop' &&
            object.userData.type !== 'door')) {
          object.visible = false;
        }
      }
    });
  }

  detectHardwareCapabilities(callback) {
    console.log("Starting hardware capability detection");

    // Store initial state to restore later
    const originalShowStats = this.showStats;

    // Create test objects for benchmark
    const boxCount = 200;
    const testObjects = [];

    // Create a complex scene to test rendering performance
    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366ff,
      roughness: 0.7,
      metalness: 0.2
    });

    // Add many objects to stress the system
    for (let i = 0; i < boxCount; i++) {
      const box = new THREE.Mesh(testGeometry, testMaterial);

      // Position in random locations
      box.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );

      // Random rotation
      box.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Add to scene
      this.scene.add(box);
      testObjects.push(box);
    }

    // Add a point light to test lighting performance
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 10, 0);
    this.scene.add(pointLight);
    testObjects.push(pointLight);

    // Enable shadows for testing
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    pointLight.castShadow = true;

    // Measure FPS
    let frames = 0;
    let lastTime = performance.now();
    let totalTime = 0;
    let frameRates = [];

    // Create a placeholder result object
    const testResultObj = {
      fps: 0,
      qualityLevel: 'medium',
      devicePixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString()
    };

    // Animate test scene
    const animateTest = () => {
      // Rotate camera around scene
      const time = performance.now() * 0.001;
      this.camera.position.x = Math.sin(time * 0.5) * 15;
      this.camera.position.z = Math.cos(time * 0.5) * 15;
      this.camera.position.y = Math.sin(time * 0.3) * 5 + 7;
      this.camera.lookAt(0, 0, 0);

      // Render
      this.renderer.render(this.scene, this.camera);

      // Calculate FPS
      frames++;
      const now = performance.now();
      const elapsed = now - lastTime;

      // Record FPS every 100ms
      if (elapsed >= 100) {
        const currentFPS = (frames * 1000) / elapsed;
        frameRates.push(currentFPS);

        frames = 0;
        lastTime = now;
        totalTime += elapsed;

        // Update test objects
        testObjects.forEach((obj, i) => {
          if (obj.isMesh) {
            obj.rotation.x += 0.01;
            obj.rotation.y += 0.01;
          }
        });
      }

      // Run for 5 seconds total
      if (totalTime < 5000) {
        requestAnimationFrame(animateTest);
      } else {
        // Clean up test objects
        testObjects.forEach(obj => this.scene.remove(obj));

        // Calculate median FPS - more reliable than average
        frameRates.sort((a, b) => a - b);
        const medianFPS = frameRates[Math.floor(frameRates.length / 2)];

        console.log(`Hardware test completed: ${medianFPS.toFixed(1)} FPS`);

        // Determine quality level
        let qualityLevel = 'medium'; // Default

        // if (medianFPS >= 55) {
        //   qualityLevel = 'high';
        // } else if (medianFPS >= 30) {
        //   qualityLevel = 'medium';
        // } else {
        //   qualityLevel = 'low';
        // }

        if (medianFPS >= 99) {
          qualityLevel = 'ultra';
        } else if (medianFPS >= 59) {
          qualityLevel = 'high';
        } else if (medianFPS >= 30) {
          qualityLevel = 'medium';
        } else {
          qualityLevel = 'low';
        }

        // Store quality level
        this.qualityLevel = qualityLevel;

        // Restore original state
        this.showStats = originalShowStats;

        // Update testResultObj with final values
        testResultObj.fps = medianFPS;
        testResultObj.qualityLevel = qualityLevel;

        // Clean up and restore normal rendering
        this.renderer.shadowMap.enabled = false;

        // Call callback with results
        if (callback) callback(testResultObj);
      }
    };

    // Start test animation
    animateTest();

    // Return a copy of the initial placeholder result
    // The actual values will be updated in the callback
    return {
      fps: testResultObj.fps,
      qualityLevel: testResultObj.qualityLevel,
      devicePixelRatio: testResultObj.devicePixelRatio,
      timestamp: testResultObj.timestamp
    };
  }


  // setQualityLevel(level, options = {}) {
  //   const settings = {
  //     shadows: options.shadows !== undefined ? options.shadows : true,
  //     antialias: options.antialias !== undefined ? options.antialias : true,
  //     highQualityTextures: options.highQualityTextures !== undefined ? options.highQualityTextures : true,
  //     ambientOcclusion: options.ambientOcclusion !== undefined ? options.ambientOcclusion : false
  //   };

  //   this.qualityLevel = level;

  //   if (this.visualEffects) {
  //     this.visualEffects.applyQualityLevel(level);
  //   }

  //   // Apply quality settings
  //   switch (level) {
  //     case 'high':
  //       // Renderer settings
  //       this.renderer.shadowMap.enabled = settings.shadows;
  //       this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Highest quality shadows
  //       this.renderer.setPixelRatio(window.devicePixelRatio); // Full device pixel ratio

  //       // Texture settings
  //       this.textureMultiplier = 1.0; // Full resolution textures

  //       // View distance settings
  //       this.renderDistance = 100; // Long view distance

  //       // Materials quality
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           // Enable all material features
  //           if (Array.isArray(obj.material)) {
  //             obj.material.forEach(mat => {
  //               if (mat.isMeshStandardMaterial) {
  //                 mat.envMapIntensity = 1.0;
  //                 mat.roughness = mat.userData?.originalRoughness || mat.roughness;
  //                 mat.metalness = mat.userData?.originalMetalness || mat.metalness;
  //               }
  //             });
  //           } else if (obj.material.isMeshStandardMaterial) {
  //             obj.material.envMapIntensity = 1.0;
  //             obj.material.roughness = obj.material.userData?.originalRoughness || obj.material.roughness;
  //             obj.material.metalness = obj.material.userData?.originalMetalness || obj.material.metalness;
  //           }
  //         }
  //       });

  //       // Lighting quality
  //       this.scene.traverse(obj => {
  //         if (obj.isLight) {
  //           obj.castShadow = settings.shadows;
  //           if (obj.shadow) {
  //             obj.shadow.mapSize.width = 2048;
  //             obj.shadow.mapSize.height = 2048;
  //             obj.shadow.bias = -0.0001;
  //           }
  //         }
  //       });

  //       // Set maximum anisotropy for textures (reduces blur at angles)
  //       const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  //           materials.forEach(mat => {
  //             if (mat.map) {
  //               mat.map.anisotropy = maxAnisotropy;
  //               mat.map.needsUpdate = true;
  //             }
  //           });
  //         }
  //       });


  //       if (this.visualEffects) {
  //         this.visualEffects.applyQualityLevel(level);
  //       }


  //       // Physics quality
  //       this.physics.simulationDetail = 2; // Higher detail physics
  //       this.physics.maxSimulationSteps = 10; // More physics steps

  //       break;

  //     case 'medium':
  //       // Renderer settings
  //       this.renderer.shadowMap.enabled = settings.shadows;
  //       this.renderer.shadowMap.type = THREE.PCFShadowMap; // Medium quality shadows
  //       this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped device pixel ratio

  //       // Texture settings
  //       this.textureMultiplier = 0.75; // 75% resolution textures

  //       // View distance settings
  //       this.renderDistance = 60; // Medium view distance

  //       // Materials quality
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           // Medium material features
  //           if (Array.isArray(obj.material)) {
  //             obj.material.forEach(mat => {
  //               if (mat.isMeshStandardMaterial) {
  //                 // Store original values if first time
  //                 if (!mat.userData) mat.userData = {};
  //                 if (mat.userData.originalRoughness === undefined)
  //                   mat.userData.originalRoughness = mat.roughness;
  //                 if (mat.userData.originalMetalness === undefined)
  //                   mat.userData.originalMetalness = mat.metalness;

  //                 mat.envMapIntensity = 0.7;
  //                 mat.roughness = Math.min(0.95, mat.userData.originalRoughness * 1.2); // Increase roughness
  //                 mat.metalness = mat.userData.originalMetalness * 0.9; // Decrease metalness
  //               }
  //             });
  //           } else if (obj.material.isMeshStandardMaterial) {
  //             // Store original values if first time
  //             if (!obj.material.userData) obj.material.userData = {};
  //             if (obj.material.userData.originalRoughness === undefined)
  //               obj.material.userData.originalRoughness = obj.material.roughness;
  //             if (obj.material.userData.originalMetalness === undefined)
  //               obj.material.userData.originalMetalness = obj.material.metalness;

  //             obj.material.envMapIntensity = 0.7;
  //             obj.material.roughness = Math.min(0.95, obj.material.userData.originalRoughness * 1.2);
  //             obj.material.metalness = obj.material.userData.originalMetalness * 0.9;
  //           }
  //         }
  //       });

  //       // Lighting quality
  //       this.scene.traverse(obj => {
  //         if (obj.isLight) {
  //           obj.castShadow = settings.shadows;
  //           if (obj.shadow) {
  //             obj.shadow.mapSize.width = 1024;
  //             obj.shadow.mapSize.height = 1024;
  //             obj.shadow.bias = -0.0005;
  //           }
  //         }
  //       });

  //       // Medium anisotropy for textures
  //       const medAnisotropy = Math.max(4, Math.floor(this.renderer.capabilities.getMaxAnisotropy() / 2));
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  //           materials.forEach(mat => {
  //             if (mat.map) {
  //               mat.map.anisotropy = medAnisotropy;
  //               mat.map.needsUpdate = true;
  //             }
  //           });
  //         }
  //       });

  //       // Medium bloom if available
  //       // if (this.bloomPass) {
  //       //   this.bloomPass.enabled = true;
  //       //   this.bloomPass.strength = 0.5;
  //       //   this.bloomPass.radius = 0.35;
  //       //   this.bloomPass.threshold = 0.9;
  //       // }

  //       if (this.visualEffects) {
  //         this.visualEffects.applyQualityLevel(level);
  //       }

  //       // Physics quality
  //       this.physics.simulationDetail = 1; // Medium detail physics
  //       this.physics.maxSimulationSteps = 6; // Fewer physics steps

  //       break;

  //     case 'low':
  //       // Renderer settings
  //       this.renderer.shadowMap.enabled = settings.shadows && this.renderer.capabilities.maxShadowMapSize > 1024;
  //       this.renderer.shadowMap.type = THREE.BasicShadowMap; // Simple shadows
  //       this.renderer.setPixelRatio(1); // Minimum pixel ratio

  //       // Texture settings
  //       this.textureMultiplier = 0.5; // 50% resolution textures

  //       // View distance settings
  //       this.renderDistance = 40; // Short view distance

  //       // Materials quality
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           // Simplify materials
  //           if (Array.isArray(obj.material)) {
  //             obj.material.forEach(mat => {
  //               if (mat.isMeshStandardMaterial) {
  //                 // Store original values if first time
  //                 if (!mat.userData) mat.userData = {};
  //                 if (mat.userData.originalRoughness === undefined)
  //                   mat.userData.originalRoughness = mat.roughness;
  //                 if (mat.userData.originalMetalness === undefined)
  //                   mat.userData.originalMetalness = mat.metalness;

  //                 mat.envMapIntensity = 0.3;
  //                 mat.roughness = Math.min(1.0, mat.userData.originalRoughness * 1.5); // Max roughness
  //                 mat.metalness = mat.userData.originalMetalness * 0.7; // Minimal metalness
  //               }
  //             });
  //           } else if (obj.material.isMeshStandardMaterial) {
  //             // Store original values if first time
  //             if (!obj.material.userData) obj.material.userData = {};
  //             if (obj.material.userData.originalRoughness === undefined)
  //               obj.material.userData.originalRoughness = obj.material.roughness;
  //             if (obj.material.userData.originalMetalness === undefined)
  //               obj.material.userData.originalMetalness = obj.material.metalness;

  //             obj.material.envMapIntensity = 0.3;
  //             obj.material.roughness = Math.min(1.0, obj.material.userData.originalRoughness * 1.5);
  //             obj.material.metalness = obj.material.userData.originalMetalness * 0.7;
  //           }

  //           // Disable normal maps on low quality
  //           if (Array.isArray(obj.material)) {
  //             obj.material.forEach(mat => {
  //               if (mat.normalMap) {
  //                 mat.normalScale.set(0, 0); // Disable normal map effect
  //               }
  //             });
  //           } else if (obj.material.normalMap) {
  //             obj.material.normalScale.set(0, 0);
  //           }
  //         }
  //       });

  //       // Lighting quality
  //       this.scene.traverse(obj => {
  //         if (obj.isLight) {
  //           obj.castShadow = settings.shadows;
  //           if (obj.shadow) {
  //             obj.shadow.mapSize.width = 512;
  //             obj.shadow.mapSize.height = 512;
  //             obj.shadow.bias = -0.001;
  //           }

  //           // Reduce light intensity for point and spot lights
  //           if (obj.isPointLight || obj.isSpotLight) {
  //             if (!obj.userData) obj.userData = {};
  //             if (obj.userData.originalIntensity === undefined)
  //               obj.userData.originalIntensity = obj.intensity;
  //             obj.intensity = obj.userData.originalIntensity * 0.8;
  //           }
  //         }
  //       });

  //       // Low anisotropy for textures
  //       this.scene.traverse(obj => {
  //         if (obj.material) {
  //           const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  //           materials.forEach(mat => {
  //             if (mat.map) {
  //               mat.map.anisotropy = 1; // Lowest possible value
  //               mat.map.needsUpdate = true;
  //             }
  //           });
  //         }
  //       });

  //       // Disable bloom for performance
  //       // if (this.bloomPass) {
  //       //   this.bloomPass.enabled = false;
  //       // }

  //       if (this.visualEffects) {
  //         this.visualEffects.applyQualityLevel(level);
  //       }

  //       // Physics quality
  //       this.physics.simulationDetail = 0; // Lowest detail physics
  //       this.physics.maxSimulationSteps = 3; // Minimal physics steps

  //       break;
  //   }

  //   // Update render distance
  //   this.updateRenderDistance();

  //   // Update FPS counter to show quality level
  //   if (this.stats && this.stats.dom) {
  //     // Add or update quality indicator
  //     let qualityIndicator = this.stats.dom.querySelector('.quality-level');
  //     if (!qualityIndicator) {
  //       qualityIndicator = document.createElement('div');
  //       qualityIndicator.className = 'quality-level';
  //       qualityIndicator.style.cssText = `
  //       position: absolute;
  //       top: 48px;
  //       right: 0;
  //       background: rgba(0,0,0,0.5);
  //       color: white;
  //       padding: 2px 5px;
  //       font-size: 10px;
  //       border-radius: 0 0 0 3px;
  //     `;
  //       this.stats.dom.appendChild(qualityIndicator);
  //     }

  //     // Set color based on quality level
  //     const levelColors = {
  //       ultra: '#f7f7e1',
  //       high: '#4CAF50',
  //       medium: '#2196F3',
  //       low: '#FF9800'
  //     };

  //     qualityIndicator.textContent = level.toUpperCase();
  //     qualityIndicator.style.color = levelColors[level] || 'white';
  //   }

  //   console.log(`Quality level set to: ${level}`);
  //   this.optimizeRenderer();
  //   this.updateQualityIndicator();
  //   return level;
  // }

  // Add this helper method to implement render distance
  
  
setQualityLevel(level, options = {}) {
  console.log(`Setting quality level to: ${level}`);
  
  // Store the quality level
  this.qualityLevel = level;
  
  // Default options
  const settings = {
    shadows: options.shadows !== undefined ? options.shadows : (level !== 'low'),
    antialias: options.antialias !== undefined ? options.antialias : (level !== 'low'),
    highQualityTextures: options.highQualityTextures !== undefined ? options.highQualityTextures : (level === 'high' || level === 'ultra'),
    ambientOcclusion: options.ambientOcclusion !== undefined ? options.ambientOcclusion : (level === 'high' || level === 'ultra')
  };
  
  // Apply settings based on quality level
  switch (level) {
    case 'ultra':
      // Ultra-specific settings
      this.renderDistance = 150; // Extended render distance
      this.textureMultiplier = 2.0; // Higher resolution textures
      this.physics.simulationDetail = 3; // Highest physics detail
      this.physics.maxSimulationSteps = 12; // More physics steps
      
      // Enable advanced rendering features for ultra - WITH SAFETY CHECKS
      if (this.visualEffects) {
        // Only call methods if they exist
        if (typeof this.visualEffects.setEffectQuality === 'function') {
          this.visualEffects.setEffectQuality('ultra');
        }
        
        // Check for specific effect methods
        if (typeof this.visualEffects.setBloomIntensity === 'function') {
          this.visualEffects.setBloomIntensity(1.5);
        }
      }
      
      // Day/night cycle enhancements
      if (this.dayNightCycle) {
        if (typeof this.dayNightCycle.setQuality === 'function') {
          this.dayNightCycle.setQuality('ultra');
        }
        
        // Check for volumetric lighting method
        if (typeof this.dayNightCycle.enableVolumetricLighting === 'function') {
          this.dayNightCycle.enableVolumetricLighting(true);
        }
        
        // Check for shadow quality method
        if (typeof this.dayNightCycle.setShadowQuality === 'function') {
          this.dayNightCycle.setShadowQuality('ultra');
        }
      }
      break;
      
    case 'high':
      this.renderDistance = 100;
      this.textureMultiplier = 1.5;
      this.physics.simulationDetail = 2;
      this.physics.maxSimulationSteps = 10;
      
      // WITH SAFETY CHECKS
      if (this.visualEffects && typeof this.visualEffects.setEffectQuality === 'function') {
        this.visualEffects.setEffectQuality('high');
      }
      
      if (this.dayNightCycle) {
        if (typeof this.dayNightCycle.setQuality === 'function') {
          this.dayNightCycle.setQuality('high');
        }
        if (typeof this.dayNightCycle.setShadowQuality === 'function') {
          this.dayNightCycle.setShadowQuality('high');
        }
      }
      break;
      
    case 'medium':
      // Medium settings
      this.renderDistance = 80;
      this.textureMultiplier = 1.0;
      this.physics.simulationDetail = 1;
      this.physics.maxSimulationSteps = 8;
      
      if (this.visualEffects && typeof this.visualEffects.setEffectQuality === 'function') {
        this.visualEffects.setEffectQuality('medium');
      }
      
      if (this.dayNightCycle && typeof this.dayNightCycle.setQuality === 'function') {
        this.dayNightCycle.setQuality('medium');
      }
      break;
      
    case 'low':
      // Low settings for performance
      this.renderDistance = 50;
      this.textureMultiplier = 0.75;
      this.physics.simulationDetail = 0;
      this.physics.maxSimulationSteps = 5;
      
      if (this.visualEffects && typeof this.visualEffects.setEffectQuality === 'function') {
        this.visualEffects.setEffectQuality('low');
      }
      
      if (this.dayNightCycle && typeof this.dayNightCycle.setQuality === 'function') {
        this.dayNightCycle.setQuality('low');
      }
      break;
  }
  
  // Update the renderer with new quality settings
  this.optimizeRenderer();
  
  // Apply shadow settings if renderer exists
  if (this.renderer) {
    this.renderer.shadowMap.enabled = settings.shadows;
    if (settings.shadows) {
      this.renderer.shadowMap.type = level === 'ultra' ? 
        THREE.PCFSoftShadowMap : 
        (level === 'high' ? THREE.PCFShadowMap : THREE.BasicShadowMap);
    }
  }
  
  // Update all textures based on quality
  this.updateTexturesForQualityLevel(level);
  
  // Update object visibility with new render distance
  if (typeof this.updateObjectVisibility === 'function') {
    this.updateObjectVisibility();
  }
  
  // Update quality indicator if available
  if (this.showStats) {
    this.updateQualityIndicator();
  }
  
  console.log(`Quality level set to: ${level} with render distance: ${this.renderDistance}`);
}
  
  updateRenderDistance() {
    const distance = this.renderDistance || 50;

    // Create or update the fog effect
    if (!this.scene.fog) {
      this.scene.fog = new THREE.Fog(0x222222, distance * 0.5, distance);
    } else {
      this.scene.fog.near = distance * 0.5;
      this.scene.fog.far = distance;
    }

    // Optionally disable rendering of distant objects
    this.scene.traverse(object => {
      if (object.isMesh && object.userData.optimizable) {
        // Store original visibility state if not already stored
        if (object.userData.originalVisible === undefined) {
          object.userData.originalVisible = object.visible;
        }

        // Update visibility based on distance in next frame
        if (this.camera) {
          const distanceToCamera = this.camera.position.distanceTo(object.position);
          object.visible = distanceToCamera < distance && object.userData.originalVisible;
        }
      }
    });
  }

  // Add this helper method for ultra quality particle enhancements
enhanceParticleSystem(particleSystem, scaleFactor) {
  if (!particleSystem || !particleSystem.geometry) return;
  
  // Save current attributes
  const oldPositions = particleSystem.geometry.getAttribute('position').array;
  const oldColors = particleSystem.geometry.getAttribute('color')?.array;
  const oldSizes = particleSystem.geometry.getAttribute('size')?.array;
  
  // Calculate new particle count
  const oldCount = oldPositions.length / 3;
  const newCount = Math.floor(oldCount * scaleFactor);
  const additionalCount = newCount - oldCount;
  
  if (additionalCount <= 0) return;
  
  // Create new attribute arrays
  const newPositions = new Float32Array(newCount * 3);
  let newColors = null;
  let newSizes = null;
  
  if (oldColors) {
    newColors = new Float32Array(newCount * 3);
  }
  
  if (oldSizes) {
    newSizes = new Float32Array(newCount);
  }
  
  // Copy existing particles
  newPositions.set(oldPositions);
  if (oldColors) newColors.set(oldColors);
  if (oldSizes) newSizes.set(oldSizes);
  
  // Add new particles with similar properties to existing ones
  for (let i = 0; i < additionalCount; i++) {
    // Pick a random existing particle to copy from
    const sourceIdx = Math.floor(Math.random() * oldCount);
    const targetIdx = oldCount + i;
    
    // Copy position with some variation
    newPositions[targetIdx * 3] = oldPositions[sourceIdx * 3] + (Math.random() - 0.5) * 0.1;
    newPositions[targetIdx * 3 + 1] = oldPositions[sourceIdx * 3 + 1] + (Math.random() - 0.5) * 0.1;
    newPositions[targetIdx * 3 + 2] = oldPositions[sourceIdx * 3 + 2] + (Math.random() - 0.5) * 0.1;
    
    // Copy color if exists
    if (newColors) {
      newColors[targetIdx * 3] = oldColors[sourceIdx * 3];
      newColors[targetIdx * 3 + 1] = oldColors[sourceIdx * 3 + 1];
      newColors[targetIdx * 3 + 2] = oldColors[sourceIdx * 3 + 2];
    }
    
    // Copy size if exists
    if (newSizes) {
      newSizes[targetIdx] = oldSizes[sourceIdx] * (0.8 + Math.random() * 0.4); // Some size variation
    }
  }
  
  // Create new geometry with enhanced attributes
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  if (newColors) {
    newGeometry.setAttribute('color', new THREE.Float32BufferAttribute(newColors, 3));
  }
  if (newSizes) {
    newGeometry.setAttribute('size', new THREE.Float32BufferAttribute(newSizes, 1));
  }
  
  // Keep any other attributes from the original
  for (const key in particleSystem.geometry.attributes) {
    if (!['position', 'color', 'size'].includes(key)) {
      newGeometry.setAttribute(key, particleSystem.geometry.attributes[key]);
    }
  }
  
  // Replace geometry
  particleSystem.geometry.dispose();
  particleSystem.geometry = newGeometry;
}

// Helper to update textures based on quality level
updateTexturesForQualityLevel(level) {
  const textureScale = level === 'ultra' ? 2.0 : 
                        level === 'high' ? 1.5 : 
                        level === 'medium' ? 1.0 : 0.5;
  
  // Update all materials in scene with texture settings
  this.scene.traverse(object => {
    if (!object.material) return;
    
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    
    materials.forEach(material => {
      // Skip materials without textures
      if (!material.map) return;
      
      // Adjust anisotropy based on quality
      const renderer = this.renderer;
      if (renderer && material.map) {
        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
        
        if (level === 'ultra') {
          material.map.anisotropy = maxAnisotropy;
        } else if (level === 'high') {
          material.map.anisotropy = maxAnisotropy / 2;
        } else if (level === 'medium') {
          material.map.anisotropy = maxAnisotropy / 4;
        } else {
          material.map.anisotropy = 1; // No anisotropic filtering for low
        }
        
        // Update mipmapping
        if (level === 'ultra' || level === 'high') {
          material.map.minFilter = THREE.LinearMipmapLinearFilter;
        } else {
          material.map.minFilter = THREE.LinearMipmapNearestFilter;
        }
        
        material.map.needsUpdate = true;
      }
    });
  });
}

  // Add this method to Scene3DController
  optimizeParticleSystems() {
    if (!this.scene) return;

    // Maximum number of active particles based on quality level
    const qualityLevel = this.qualityLevel || 'medium';
    const maxParticles = {
      ultra: 1500,
      high: 1000,
      medium: 500,
      low: 200
    }[qualityLevel] || 500;

    // Current count of particles
    let currentParticleCount = 0;

    // Track all particle systems
    const particleSystems = [];

    // Find all particle systems in the scene
    this.scene.traverse(object => {
      // Check if it's a particle system (Points object)
      if (object instanceof THREE.Points) {
        particleSystems.push(object);

        // Add tracking properties if not already there
        if (object.userData.particleImportance === undefined) {
          // Assign importance based on proximity to camera or special effects
          // Higher = more important to gameplay
          if (object.userData.isTeleporter) {
            object.userData.particleImportance = 10; // Teleporters are critical
          } else if (object.userData.isEffect) {
            object.userData.particleImportance = 5;  // Visual effects are medium importance
          } else {
            object.userData.particleImportance = 1;  // Default ambient particles
          }
        }

        // Count current particles if the system is visible
        if (object.visible && object.geometry) {
          currentParticleCount += object.geometry.attributes.position.count;
        }
      }
    });

    // If we're under the limit, nothing to do
    if (currentParticleCount <= maxParticles || particleSystems.length === 0) {
      return;
    }

    console.log(`Optimizing particles: ${currentParticleCount} → ${maxParticles} (limit for ${qualityLevel} quality)`);

    // Sort particle systems by importance (lowest first)
    particleSystems.sort((a, b) => {
      return (a.userData.particleImportance || 0) - (b.userData.particleImportance || 0);
    });

    // Calculate distance to camera for each system for secondary sorting
    const cameraPosition = this.camera.position;
    particleSystems.forEach(system => {
      system.userData.distanceToCamera = system.position.distanceTo(cameraPosition);
    });

    // Start reducing particles from least important systems
    let remainingBudget = maxParticles;

    // First pass - completely disable least important distant systems
    for (let i = 0; i < particleSystems.length; i++) {
      const system = particleSystems[i];

      // Skip critical systems
      if (system.userData.particleImportance >= 10) continue;

      // For lowest importance, distant systems, hide completely
      if (system.userData.particleImportance <= 1 &&
        system.userData.distanceToCamera > 30) {
        system.visible = false;
        continue;
      }

      // For medium importance distant systems, reduce particles
      if (system.userData.particleImportance <= 5 &&
        system.userData.distanceToCamera > 20) {
        // Cut particles in half for distant medium importance
        if (system.geometry && system.geometry.attributes.position) {
          const origCount = system.geometry.attributes.position.count;
          const newCount = Math.floor(origCount / 2);

          // Store original count if not already stored
          if (system.userData.originalParticleCount === undefined) {
            system.userData.originalParticleCount = origCount;
          }

          // Reduce visible count
          system.geometry.setDrawRange(0, newCount);
          system.geometry.attributes.position.needsUpdate = true;

          // Subtract from budget
          remainingBudget -= newCount;
        }
        continue;
      }

      // Keep high importance and nearby systems at full count
      if (system.geometry && system.geometry.attributes.position) {
        remainingBudget -= system.geometry.attributes.position.count;
      }
    }

    // If we're still over budget, start reducing more aggressively
    if (remainingBudget < 0) {
      // Second pass - reduce even important systems
      for (let i = 0; i < particleSystems.length; i++) {
        const system = particleSystems[i];

        // Skip already hidden systems
        if (!system.visible) continue;

        // Skip critical systems even now
        if (system.userData.particleImportance >= 10) continue;

        if (system.geometry && system.geometry.attributes.position) {
          const currentCount = system.geometry.drawRange.count ||
            system.geometry.attributes.position.count;

          // Reduce by 25% more
          const newCount = Math.floor(currentCount * 0.75);
          system.geometry.setDrawRange(0, newCount);
          system.geometry.attributes.position.needsUpdate = true;

          // Update budget
          remainingBudget += (currentCount - newCount);

          // If we're back under budget, we can stop
          if (remainingBudget >= 0) break;
        }
      }
    }

    // Final pass - restore particles for any systems that can fit in the budget
    if (remainingBudget > 0) {
      // Sort by importance (highest first this time)
      particleSystems.sort((a, b) => {
        return (b.userData.particleImportance || 0) - (a.userData.particleImportance || 0);
      });

      // Restore particles where possible
      for (let i = 0; i < particleSystems.length; i++) {
        const system = particleSystems[i];

        // Skip systems without stored original count
        if (system.userData.originalParticleCount === undefined) continue;

        // Check if we can restore some or all particles
        if (system.geometry && system.geometry.attributes.position) {
          const currentCount = system.geometry.drawRange.count ||
            system.geometry.attributes.position.count;
          const originalCount = system.userData.originalParticleCount;

          // Can we restore some particles?
          if (currentCount < originalCount) {
            // How many can we add back?
            const addBack = Math.min(remainingBudget, originalCount - currentCount);
            if (addBack > 0) {
              const newCount = currentCount + addBack;
              system.geometry.setDrawRange(0, newCount);
              system.geometry.attributes.position.needsUpdate = true;

              remainingBudget -= addBack;
            }
          }

          // If budget is exhausted, stop
          if (remainingBudget <= 0) break;
        }
      }
    }
  }

  // Example: Adding torches to your scene
  initializeTorches() {
    if (this.visualEffects) {
      // Position the torch on a wall
      const torch = this.visualEffects.createTorch({
        x: wallX,
        y: wallY + 2, // Mount height
        z: wallZ
      });
    }
  }

  addPlayerLight() {
    if (this.playerLight) return;

    // Create a point light that follows the player
    this.playerLight = new THREE.PointLight(0xffffcc, 0.6, 10);
    this.playerLight.position.set(0, 1.0, 0); // Slightly below eye level

    // Add the light to the camera so it moves with the player
    this.camera.add(this.playerLight);

    // Add a switch to UI to toggle the light
    const flashlightBtn = document.createElement('div');
    flashlightBtn.className = 'flashlight-button';
    flashlightBtn.setAttribute('data-tooltip', 'Toggle Flashlight');
    flashlightBtn.innerHTML = `<span class="material-icons">flashlight_on</span>`;
    flashlightBtn.style.cssText = `
    position: absolute;
    top: 150px;
    right: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
  `;

    // Add click handler to toggle the flashlight
    let isFlashlightOn = true;
    flashlightBtn.addEventListener('click', () => {
      isFlashlightOn = !isFlashlightOn;
      this.playerLight.intensity = isFlashlightOn ? 0.6 : 0;
      flashlightBtn.innerHTML = `<span class="material-icons">${isFlashlightOn ? 'flashlight_on' : 'flashlight_off'}</span>`;
    });

    // Add to 3D view
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(flashlightBtn);
    }

    return this.playerLight;
  }

  setLightingEnabled(enabled) {
    // Flip the boolean since we're using "disable lighting" in the UI
    const disableLighting = !enabled;

    console.log(`${disableLighting ? 'Disabling' : 'Enabling'} advanced lighting effects`);

    // 1. Adjust ambient light intensity
    this.scene.traverse(obj => {
      if (obj.isAmbientLight) {
        obj.intensity = disableLighting ? 1.2 : 0.5; // Brighter when disabled
        obj.castShadow = false; // Ambient lights can't cast shadows
      }

      // Make point lights less intense when simple lighting is enabled
      if ((obj.isPointLight || obj.isSpotLight) && obj !== this.playerLight) {
        obj.intensity = disableLighting ? 0.3 : 1.0;
      }
    });

    // 2. Adjust material properties for better visibility
    this.scene.traverse(obj => {
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

        materials.forEach(mat => {
          // Only affect standard materials, not basic ones
          if (mat.isMeshStandardMaterial) {
            // Make materials brighter when lighting is disabled
            if (disableLighting) {
              // Store original values if not already stored
              if (!mat.userData) mat.userData = {};
              if (mat.userData.originalEmissive === undefined && mat.emissive) {
                mat.userData.originalEmissive = mat.emissive.clone();
              }
              if (mat.userData.originalEmissiveIntensity === undefined) {
                mat.userData.originalEmissiveIntensity = mat.emissiveIntensity || 0;
              }

              // Brighten materials by adding emissive component
              if (mat.color) {
                // Add slight emissive glow based on color
                mat.emissive = mat.color.clone().multiplyScalar(0.3);
                mat.emissiveIntensity = 0.5;
              }
            }
            else if (mat.userData && mat.userData.originalEmissive) {
              // Restore original values
              mat.emissive = mat.userData.originalEmissive;
              mat.emissiveIntensity = mat.userData.originalEmissiveIntensity;
            }
          }
        });
      }
    });

    // 3. Disable visual effects if applicable
    if (this.visualEffects) {
      this.visualEffects.effectsEnabled = enabled;
    }

    // 4. Disable fog when lighting is disabled
    if (this.scene.fog) {
      if (disableLighting) {
        // Store original fog settings
        if (!this.savedFog) {
          this.savedFog = {
            near: this.scene.fog.near,
            far: this.scene.fog.far,
            color: this.scene.fog.color.clone()
          };
        }
        // Reduce fog drastically
        this.scene.fog.near = this.renderDistance * 0.8;
        this.scene.fog.far = this.renderDistance * 1.2;
      } else if (this.savedFog) {
        // Restore fog settings
        this.scene.fog.near = this.savedFog.near;
        this.scene.fog.far = this.savedFog.far;
        this.scene.fog.color.copy(this.savedFog.color);
      }
    }

    // Store the setting
    this.lightingEnabled = enabled;
  }

  autoDetectLightSources() {
    if (!this.scene) return;

    console.log('Auto-detecting light sources from prop names...');

    // Create a container for lights
    if (!this.lightSourcesContainer) {
      this.lightSourcesContainer = new THREE.Group();
      this.lightSourcesContainer.name = 'lightSources';
      this.scene.add(this.lightSourcesContainer);
    }

    // Track all light sources
    if (!this.lightSources) {
      this.lightSources = new Map();
    }

    // Keywords that suggest light emission
    const lightKeywords = [
      {
        words: ['fire', 'torch', 'flame', 'candle', 'lantern', 'campfire'],
        color: 0xff6600, intensity: 1.5, distance: 8, decay: 2
      },
      {
        words: ['crystal', 'gem', 'magic', 'arcane', 'rune', 'glow'],
        color: 0x66ccff, intensity: 1.2, distance: 6, decay: 1.5
      },
      {
        words: ['lava', 'magma', 'ember'],
        color: 0xff3300, intensity: 1.3, distance: 7, decay: 2
      },      {
        words: ['radiant', 'holy'],
        color: 0xffe599, intensity: 1.2, distance: 6, decay: 1.5
      },
    ];

    // Look for props in the scene
    let lightSourceCount = 0;
    this.scene.traverse(object => {
      // Skip objects that aren't props or already have lights
      if (!object.userData || object.userData.type !== 'prop' || object.userData.hasLight) {
        return;
      }

      // Get the prop name
      const propName = object.userData.name ? object.userData.name.toLowerCase() : '';
      if (!propName) return;

      // Check if prop name contains any light keywords
      for (const category of lightKeywords) {
        if (category.words.some(word => propName.includes(word))) {
          console.log(`Auto-detected light source: "${propName}"`);

          // Create a light source for this prop
          const light = new THREE.PointLight(
            category.color,
            category.intensity,
            category.distance,
            category.decay
          );

          // Position the light at or slightly above the prop
          light.position.copy(object.position);
          // Move up slightly if not already above ground
          if (light.position.y < 1.5) {
            light.position.y += 0.5;
          }

          // Add light to scene
          this.lightSourcesContainer.add(light);

          // Mark this prop as having a light
          object.userData.hasLight = true;

          // Store reference to this light
          this.lightSources.set(object.uuid, {
            light,
            prop: object,
            originalIntensity: category.intensity,
            originalDistance: category.distance
          });

          // Create glow effect
          this.createFireGlowEffect(object, category.color);

          lightSourceCount++;
          break; // Stop after first match
        }
      }
    });

    console.log(`Auto-detected ${lightSourceCount} light sources from prop names`);
  }

  // Create fire glow effect for auto-detected props
  createFireGlowEffect(prop, color = 0xff6600) {
    // Skip if lighting effects are disabled
    if (this.preferences && this.preferences.disableLighting) return;

    // Create emissive material for the prop if it has a standard material
    if (prop.material && prop.material.isMeshStandardMaterial) {
      // Store original material properties
      if (!prop.userData.originalEmissive) {
        prop.userData.originalEmissive = prop.material.emissive.clone();
        prop.userData.originalEmissiveIntensity = prop.material.emissiveIntensity || 0;
      }

      // Make the prop itself glow a bit
      prop.material.emissive = new THREE.Color(color);
      prop.material.emissiveIntensity = 0.5;
    }

    // Create glowing particle effect
    const particleCount = 15;
    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3); // Renamed to avoid conflict
    const sizes = new Float32Array(particleCount);

    // Convert color to RGB components
    const colorObj = new THREE.Color(color);
    const r = colorObj.r;
    const g = colorObj.g;
    const b = colorObj.b;

    // Create random particles around the prop
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Position particles in small sphere around the prop's upper part
      const radius = 0.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = 0.2 + Math.random() * 0.2; // Slightly above
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // Colors - base color with some variation
      particleColors[i3] = r * (0.8 + Math.random() * 0.4); // Red with variation
      particleColors[i3 + 1] = g * (0.8 + Math.random() * 0.4); // Green with variation
      particleColors[i3 + 2] = b * (0.8 + Math.random() * 0.4); // Blue with variation

      // Random sizes
      sizes[i] = 0.05 + Math.random() * 0.15;
    }

    // Create geometry and set attributes
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('particleColor', new THREE.BufferAttribute(particleColors, 3)); // Renamed attribute
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create shader material for better looking particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(color) }
      },
      vertexShader: `
      attribute float size;
      attribute vec3 particleColor; // Renamed attribute
      varying vec3 vColor;
      uniform float time;
      
      void main() {
        vColor = particleColor; // Use renamed attribute
        
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
    particles.position.copy(prop.position);

    // Store time value for animation
    particles.userData = {
      type: 'effect',
      timeOffset: Math.random() * 1000,
      originalPosition: prop.position.clone()
    };

    // Add to scene
    this.scene.add(particles);

    // Store reference
    if (!prop.userData.effects) prop.userData.effects = [];
    prop.userData.effects.push(particles);

    return particles;
  }


  // Update auto-detected light sources
  updateAutoLightSources(deltaTime) {
    if (!this.lightSources || this.lightSources.size === 0) return;

    const time = performance.now() * 0.001;
    const playerPos = this.camera.position.clone();

    // Update each light
    this.lightSources.forEach((data, id) => {
      const { light, prop, originalIntensity } = data;

      // Skip if light was removed
      if (!light || !light.parent) return;

      // Calculate distance to player
      const distance = playerPos.distanceTo(light.position);

      // Dynamic intensity based on distance
      const maxDistance = 30;
      const fullFadeDistance = 50;

      if (distance <= maxDistance) {
        // Full intensity when within reasonable range
        light.intensity = originalIntensity * (0.85 + Math.sin(time * 3) * 0.15); // Flicker effect
      } else if (distance <= fullFadeDistance) {
        // Fade out with distance
        const fadeRatio = 1 - ((distance - maxDistance) / (fullFadeDistance - maxDistance));
        light.intensity = originalIntensity * fadeRatio;
      } else {
        // Turn off light completely when far away
        light.intensity = 0;
      }

      // Update any particle effects
      if (prop && prop.userData && prop.userData.effects) {
        prop.userData.effects.forEach(effect => {
          if (effect && effect.material && effect.material.uniforms) {
            // Update time uniform for animation
            effect.material.uniforms.time.value = time;

            // Make particles fade with distance similar to the light
            if (distance > maxDistance) {
              if (effect.material.opacity !== undefined) {
                const fadeRatio = 1 - ((distance - maxDistance) / (fullFadeDistance - maxDistance));
                effect.material.opacity = Math.max(0, fadeRatio);
              }
            } else {
              if (effect.material.opacity !== undefined) {
                effect.material.opacity = 1.0;
              }
            }
          }
        });
      }
    });
  }

  // initializeDayNightCycle() {
  //   // Load the DayNightCycle script dynamically if not already loaded
  //   if (typeof DayNightCycle === 'undefined') {
  //     // Create script element
  //     const script = document.createElement('script');
  //     script.src = 'js/classes/day-night-cycle.js';

  //     script.onload = () => {
  //       // Create the cycle when script is loaded
  //       this.createDayNightCycle();
  //       this.createPartyButton();
  //     };

  //     script.onerror = (err) => {
  //       console.error('Could not load day-night cycle script', err);
  //     };

  //     document.head.appendChild(script);
  //   } else {
  //     // Script is already loaded, create directly
  //     this.createDayNightCycle();
  //     this.createPartyButton();
  //   }
  // }



  // Helper method to create the cycle
  // createDayNightCycle() {
  //   // Create the cycle
  //   this.dayNightCycle = new DayNightCycle(this);

  //   // Start with appropriate time based on preference or default to noon
  //   const startTime = this.preferences?.timeOfDay || 12;
  //   this.dayNightCycle.setTime(startTime);

  //   // Start cycle if auto-play is enabled in preferences
  //   if (this.preferences?.autoPlayDayNight) {
  //     this.dayNightCycle.start();
  //   }

  //   // Create lighting controls in UI
  //   const dayNightButton = document.createElement('div');
  //   dayNightButton.className = 'time-control-button';
  //   dayNightButton.setAttribute('data-tooltip', 'Day/Night Cycle');
  //   dayNightButton.innerHTML = `<span class="material-icons">brightness_4</span>`;
  //   dayNightButton.style.cssText = `
  //   position: absolute;
  //   top: 100px;
  //   right: 10px;
  //   background: rgba(0, 0, 0, 0.5);
  //   color: white;
  //   border-radius: 50%;
  //   width: 40px;
  //   height: 40px;
  //   display: flex;
  //   align-items: center;
  //   justify-content: center;
  //   cursor: pointer;
  //   z-index: 1000;
  // `;

  //   // Add click handler to show controls
  //   dayNightButton.addEventListener('click', () => {
  //     this.dayNightCycle.showControls();
  //   });

  //   // Add to 3D view
  //   const container = document.querySelector('.drawer-3d-view');
  //   if (container) {
  //     container.appendChild(dayNightButton);
  //   }

  //   console.log('Day/Night cycle initialized');
  // }

    initializeDayNightCycle() {
    // Load the DayNightCycle script dynamically if not already loaded
    if (typeof DayNightCycle === 'undefined') {
      // Create script element
      const script = document.createElement('script');
      script.src = 'js/classes/day-night-cycle.js';
  
      script.onload = () => {
        // Create the cycle when script is loaded
        this.createDayNightCycle();
        this.createPartyButton();
      };
  
      script.onerror = (err) => {
        console.error('Could not load day-night cycle script', err);
      };
  
      document.head.appendChild(script);
    } else {
      // Script is already loaded, create directly
      this.createDayNightCycle();
      this.createPartyButton();
    }
  }
  
  // Helper method to create the cycle
  createDayNightCycle() {
    // Create the cycle
    this.dayNightCycle = new DayNightCycle(this);
  
    // Set default time from preferences or default to noon
    const startTime = this.preferences?.timeOfDay || 12;
    this.dayNightCycle.setTime(startTime);
    
    // Check if we have a stored preference for auto-play
    // If we don't have a preference yet, default to TRUE (enabled)
    const shouldAutoStart = this.preferences?.autoPlayDayNight !== undefined ? 
      this.preferences.autoPlayDayNight : true;
    
    // Start cycle based on the above logic 
    if (shouldAutoStart) {
      console.log('Auto-starting day-night cycle by default');
      this.dayNightCycle.start();
      
      // Update preferences to remember this setting
      if (this.preferences) {
        this.preferences.autoPlayDayNight = true;
        localStorage.setItem('appPreferences', JSON.stringify(this.preferences));
      }
    }
  
    // Create lighting controls in UI
    const dayNightButton = document.createElement('div');
    dayNightButton.className = 'time-control-button';
    dayNightButton.setAttribute('data-tooltip', 'Day/Night Cycle');
    dayNightButton.innerHTML = `<span class="material-icons">brightness_4</span>`;
    dayNightButton.style.cssText = `
      position: absolute;
      top: 100px;
      right: 10px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1000;
    `;
  
    // Add click handler to show controls
    dayNightButton.addEventListener('click', () => {
      this.dayNightCycle.showControls();
    });
  
    // Add to 3D view
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(dayNightButton);
    }
  
    console.log('Day/Night cycle initialized');
  }

  // Add after createDayNightCycle() in Scene3DController.js
  createPartyButton() {
    // Create party management button
    const partyButton = document.createElement('div');
    partyButton.className = 'party-control-button';
    partyButton.setAttribute('data-tooltip', 'Party Manager');
    partyButton.innerHTML = `<span class="material-icons">group</span>`;
    partyButton.style.cssText = `
      position: absolute;
      top: 200px;
      right: 10px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1000;
    `;

    // Add click handler to show party manager
    partyButton.addEventListener('click', () => {
      if (window.partyManager) {
        // Pause 3D controls while party manager is open
        this.pauseControls();

        // Show party manager
        window.partyManager.showPartyManager();

        // Resume controls when party manager closes
        const checkForDialog = setInterval(() => {
          const dialog = document.querySelector('sl-dialog[label="Monster Party"]');
          if (!dialog) {
            this.resumeControls();
            clearInterval(checkForDialog);
          }
        }, 100);
      } else {
        console.warn('Party Manager not available');
      }
    });

    // Add to 3D view
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(partyButton);
    }
  }

  initializePartyAndCombatSystems() {
    console.log('Initializing party and combat systems');
    if (!window.partyManager) { // Add check to prevent double initialization
      this.createPartyAndCombatSystems();
    }
  }

  createPartyAndCombatSystems() {
    console.log('Creating party and combat systems');
    if (!window.partyManager) { // Add check to prevent double initialization
      const resourceManager = window.ResourceManager ? new window.ResourceManager() : null;
      if (resourceManager) {
        const partyManager = new PartyManager(resourceManager);
        const combatSystem = new CombatSystem(partyManager, resourceManager);

        window.partyManager = partyManager;
        window.combatSystem = combatSystem;

        console.log('Party and combat systems created and available globally');
      }
    }
  }

  // Improved Mini-Map Implementation for Scene3DController
  // This version handles varying map sizes and ensures accurate player positioning

  createMiniMap() {
    console.log('Creating improved mini-map');

    // Only create once
    if (this.miniMapContainer) {
      console.log('Mini-map already exists');
      return;
    }

    // Check if we have the necessary map image
    if (!this.baseImage || !this.baseImage.src) {
      console.warn('No base image available for mini-map');
      return;
    }

    // Create minimap container with tilted card aesthetic
    this.miniMapContainer = document.createElement('div');
    this.miniMapContainer.className = 'mini-map-container';
    this.miniMapContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 180px;
    height: 180px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);
    overflow: hidden;
    transform: rotate(-3deg);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.3);
    z-index: 1000;
    transition: transform 0.3s ease;
    user-select: none;
  `;

    // Create map image container with overflow hidden
    const mapViewport = document.createElement('div');
    mapViewport.className = 'mini-map-viewport';
    mapViewport.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 8px;
  `;

    // Store the map dimensions for accurate calculation
    this.miniMapDimensions = {
      worldWidth: this.boxWidth,
      worldDepth: this.boxDepth,
      imageWidth: this.baseImage.width,
      imageHeight: this.baseImage.height,
      viewportWidth: 180,
      viewportHeight: 180
    };

    // Calculate the scale factor between 3D world and image
    this.miniMapDimensions.scaleX = this.miniMapDimensions.imageWidth / this.miniMapDimensions.worldWidth;
    this.miniMapDimensions.scaleZ = this.miniMapDimensions.imageHeight / this.miniMapDimensions.worldDepth;

    // Create the map image element - sized to match the world scale exactly
    this.miniMapImage = document.createElement('div');
    this.miniMapImage.className = 'mini-map-image';
    this.miniMapImage.style.cssText = `
    position: absolute;
    background-image: url(${this.baseImage.src});
    background-size: 100% 100%;
    width: ${this.miniMapDimensions.imageWidth}px;
    height: ${this.miniMapDimensions.imageHeight}px;
    transform-origin: top left;
    transition: transform 0.1s ease-out;
  `;

    // Create player indicator
    this.miniMapPlayer = document.createElement('div');
    this.miniMapPlayer.className = 'mini-map-player';
    this.miniMapPlayer.style.cssText = `
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: #3b82f6;
    border: 2px solid white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 11;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  `;

    // Direction indicator (shows which way player is facing)
    this.miniMapDirection = document.createElement('div');
    this.miniMapDirection.className = 'mini-map-direction';
    this.miniMapDirection.style.cssText = `
    position: absolute;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 12px solid #3b82f6;
    transform: translate(-50%, -50%) rotate(0deg);
    transform-origin: center bottom;
    z-index: 10;
    pointer-events: none;
  `;

    // Add border frame to emphasize the mini-map
    const mapBorder = document.createElement('div');
    mapBorder.className = 'mini-map-border';
    mapBorder.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    pointer-events: none;
    z-index: 12;
  `;

    // Add compass elements
    const directions = [
      { letter: 'N', rotation: 0, top: '5px', left: '50%' },
      { letter: 'E', rotation: 90, top: '50%', right: '5px' },
      { letter: 'S', rotation: 180, bottom: '5px', left: '50%' },
      { letter: 'W', rotation: 270, top: '50%', left: '5px' }
    ];

    directions.forEach(dir => {
      const dirMarker = document.createElement('div');
      dirMarker.className = 'compass-marker';
      dirMarker.textContent = dir.letter;
      dirMarker.style.cssText = `
      position: absolute;
      font-size: 10px;
      font-weight: bold;
      color: rgba(255, 255, 255, 0.8);
      z-index: 9;
      ${dir.top ? `top: ${dir.top};` : ''}
      ${dir.bottom ? `bottom: ${dir.bottom};` : ''}
      ${dir.left ? `left: ${dir.left};` : ''}
      ${dir.right ? `right: ${dir.right};` : ''}
      transform: translate(-50%, -50%) rotate(${dir.rotation}deg);
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
      pointer-events: none;
    `;
      mapViewport.appendChild(dirMarker);
    });

    // Add zoom buttons for adjustable mini-map
    const zoomControls = document.createElement('div');
    zoomControls.className = 'mini-map-zoom-controls';
    zoomControls.style.cssText = `
    position: absolute;
    bottom: 5px;
    right: 5px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 13;
  `;

    const zoomInBtn = document.createElement('div');
    zoomInBtn.className = 'mini-map-zoom-in';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.style.cssText = `
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.2s;
  `;

    const zoomOutBtn = document.createElement('div');
    zoomOutBtn.className = 'mini-map-zoom-out';
    zoomOutBtn.innerHTML = '-';
    zoomOutBtn.style.cssText = `
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.2s;
  `;

    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);

    // Zoom functionality
    this.miniMapZoom = 1.0; // Default zoom level
    const maxZoom = 4.0;
    const minZoom = 0.5;
    const zoomStep = 0.25;

    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.miniMapZoom < maxZoom) {
        this.miniMapZoom += zoomStep;
        this.updateMiniMap(true); // Force update
      }
    });

    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.miniMapZoom > minZoom) {
        this.miniMapZoom -= zoomStep;
        this.updateMiniMap(true); // Force update
      }
    });

    // Add toggle/minimize button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'mini-map-toggle';
    toggleButton.innerHTML = '<span class="material-icons">map</span>';
    toggleButton.style.cssText = `
    position: absolute;
    top: -10px;
    right: -10px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    z-index: 14;
    transition: transform 0.2s ease;
  `;

    // Toggle mini-map visibility
    let isMinimized = false;
    toggleButton.addEventListener('click', () => {
      if (isMinimized) {
        this.miniMapContainer.style.transform = 'rotate(-3deg)';
        this.miniMapContainer.style.width = '180px';
        this.miniMapContainer.style.height = '180px';
        toggleButton.innerHTML = '<span class="material-icons">map</span>';
      } else {
        this.miniMapContainer.style.transform = 'rotate(-3deg) scale(0.5)';
        this.miniMapContainer.style.width = '60px';
        this.miniMapContainer.style.height = '60px';
        toggleButton.innerHTML = '<span class="material-icons">zoom_out_map</span>';
      }
      isMinimized = !isMinimized;
    });

    // Add pan functionality using mouse drag
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let currentOffset = { x: 0, y: 0 };

    mapViewport.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      mapViewport.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      // Update current offset (will be applied in updateMiniMap)
      currentOffset.x += dx;
      currentOffset.y += dy;

      // Update drag start for next move
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;

      // Force an update
      this.updateMiniMap(true);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        mapViewport.style.cursor = 'grab';
      }
    });

    // Reset pan button
    const resetPanBtn = document.createElement('div');
    resetPanBtn.className = 'mini-map-reset';
    resetPanBtn.innerHTML = '⟳';
    resetPanBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
    z-index: 13;
  `;

    resetPanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Reset offset and center on player
      currentOffset = { x: 0, y: 0 };
      this.updateMiniMap(true);
    });

    // Store the current offset for panning
    this.miniMapOffset = currentOffset;

    // Assemble the components
    mapViewport.appendChild(this.miniMapImage);
    mapViewport.appendChild(this.miniMapPlayer);
    mapViewport.appendChild(this.miniMapDirection);
    mapViewport.appendChild(mapBorder);
    mapViewport.appendChild(zoomControls);
    mapViewport.appendChild(resetPanBtn);
    this.miniMapContainer.appendChild(mapViewport);
    this.miniMapContainer.appendChild(toggleButton);

    // Find where to add the mini-map
    const container = document.querySelector('.drawer-3d-view');
    if (container) {
      container.appendChild(this.miniMapContainer);
    } else {
      document.body.appendChild(this.miniMapContainer);
    }

    // Add hover effect
    this.miniMapContainer.addEventListener('mouseenter', () => {
      if (!isMinimized) {
        this.miniMapContainer.style.transform = 'rotate(-3deg) scale(1.05)';
      }
      mapViewport.style.cursor = 'grab';
    });

    this.miniMapContainer.addEventListener('mouseleave', () => {
      if (!isMinimized) {
        this.miniMapContainer.style.transform = 'rotate(-3deg)';
      }
      mapViewport.style.cursor = 'default';
      isDragging = false;
    });

    // Initial update
    this.updateMiniMap(true);

    // Schedule updates
    this.miniMapUpdateInterval = setInterval(() => {
      this.updateMiniMap();
    }, 100);

    console.log('Improved mini-map created successfully');
  }

  // Improved updateMiniMap method with better scaling and positioning
  updateMiniMap(forceUpdate = false) {
    if (!this.miniMapContainer || !this.camera) return;

    // Skip updates if minimized and not forcing an update
    if (this.miniMapContainer.style.width === '60px' && !forceUpdate) return;

    // Get the viewport dimensions
    const viewport = this.miniMapContainer.querySelector('.mini-map-viewport');
    const viewportWidth = viewport.offsetWidth;
    const viewportHeight = viewport.offsetHeight;

    // Get player position in world coordinates (already converted from camera position)
    const playerX = this.camera.position.x;
    const playerZ = this.camera.position.z;

    // Calculate the center of the 3D world
    const worldCenterX = 0; // Assuming the center is at origin
    const worldCenterZ = 0;

    // Convert player position to map image coordinates
    // Step 1: Convert from world coords to normalized coords (0-1)
    // First adjust from world center to world corner
    const normalizedX = (playerX + this.miniMapDimensions.worldWidth / 2) / this.miniMapDimensions.worldWidth;
    const normalizedZ = (playerZ + this.miniMapDimensions.worldDepth / 2) / this.miniMapDimensions.worldDepth;

    // Step 2: Convert normalized coords to pixel coords on the map image
    const mapPixelX = normalizedX * this.miniMapDimensions.imageWidth;
    const mapPixelZ = normalizedZ * this.miniMapDimensions.imageHeight;

    // DEBUGGING: Log map coordinates and player world position
    if (forceUpdate) {
      console.log("World position:", { x: playerX, z: playerZ });
      console.log("Normalized coordinates:", { x: normalizedX, z: normalizedZ });
      console.log("Map pixel coordinates:", { x: mapPixelX, z: mapPixelZ });
    }

    // Calculate the image scale to account for zoom
    const imageScale = Math.min(
      viewportWidth / this.miniMapDimensions.imageWidth,
      viewportHeight / this.miniMapDimensions.imageHeight
    ) * this.miniMapZoom;

    // Calculate the scaled image dimensions
    const scaledImageWidth = this.miniMapDimensions.imageWidth * imageScale;
    const scaledImageHeight = this.miniMapDimensions.imageHeight * imageScale;

    // Calculate center offset for the image to position player at center
    // Also include any user panning offset
    let offsetX = (viewportWidth / 2) - (mapPixelX * imageScale) + this.miniMapOffset.x;
    let offsetZ = (viewportHeight / 2) - (mapPixelZ * imageScale) + this.miniMapOffset.y;

    // Apply scale and position to map image
    this.miniMapImage.style.transform = `translate(${offsetX}px, ${offsetZ}px) scale(${imageScale})`;

    // Update the player indicator position - always at viewport center unless panned
    const playerPosX = viewportWidth / 2 - this.miniMapOffset.x;
    const playerPosZ = viewportHeight / 2 - this.miniMapOffset.y;

    this.miniMapPlayer.style.left = `${playerPosX}px`;
    this.miniMapPlayer.style.top = `${playerPosZ}px`;

    // Update the direction indicator
    this.miniMapDirection.style.left = `${playerPosX}px`;
    this.miniMapDirection.style.top = `${playerPosZ}px`;

    // Get player rotation for the direction indicator
    if (this.camera.rotation) {
      // Convert to degrees and adjust
      let degrees = -this.camera.rotation.y * (180 / Math.PI);
      this.miniMapDirection.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
    } else if (this.controls && this.controls.getObject) {
      // For PointerLockControls, we get rotation from camera quaternion
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(this.camera.quaternion);
      const angle = Math.atan2(direction.x, direction.z);
      let degrees = angle * (180 / Math.PI);
      this.miniMapDirection.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
    }
  }

  // Clean up the mini-map resources
  cleanupMiniMap() {
    if (this.miniMapUpdateInterval) {
      clearInterval(this.miniMapUpdateInterval);
      this.miniMapUpdateInterval = null;
    }

    // Remove event listeners
    document.removeEventListener('mousemove', this._miniMapMouseMove);
    document.removeEventListener('mouseup', this._miniMapMouseUp);

    if (this.miniMapContainer && this.miniMapContainer.parentNode) {
      this.miniMapContainer.parentNode.removeChild(this.miniMapContainer);
      this.miniMapContainer = null;
      this.miniMapImage = null;
      this.miniMapPlayer = null;
      this.miniMapDirection = null;
      this.miniMapOffset = null;
      this.miniMapDimensions = null;
      this.miniMapZoom = null;
    }
  }


}
