/**
 * ShapeForge.js - Visual 3D geometry editor for Three.js
 * 
 * This tool allows for creating, editing, and exporting 3D geometries with
 * materials and shader effects for use in Three.js applications.
 */
// console.log("ShapeForge script loaded, THREE.js available:", !!window.THREE);
class ShapeForge {
  /**
   * Create a new ShapeForge editor
   * @param {ResourceManager} resourceManager - Reference to the resource manager
   * @param {ShaderEffectsManager} shaderEffectsManager - Reference to the shader effects manager
   */
  // constructor(resourceManager = null, shaderEffectsManager = null) {
  //   // Dependencies
  //   this.resourceManager = resourceManager;
  //   this.shaderEffectsManager = shaderEffectsManager;

  //   // Core properties
  //   this.objects = [];
  //   this.selectedObject = null;
  //   this.history = [];
  //   this.historyIndex = -1;
  //   this.maxHistorySteps = 30;

  //   // Scene for preview
  //   this.previewScene = null;
  //   this.previewCamera = null;
  //   this.previewRenderer = null;
  //   this.previewControls = null;
  //   this.previewContainer = null;
  //   this.isPreviewActive = false;

  //   // UI references
  //   this.drawer = null;
  //   this.propertyPanels = {};

  //   // Bind methods to maintain proper 'this' context
  //   this.animate = this.animate.bind(this);
  //   this.handleResize = this.handleResize.bind(this);

  //   // Auto-load dependencies if needed
  //   this.checkDependencies();
  // }

  constructor(resourceManager = null, shaderEffectsManager = null, mapEditor = null) {
    // Add mapEditor parameter
    this.mapEditor = mapEditor;
    
    // Dependencies
    // Try to get ResourceManager from mapEditor first if available
    if (mapEditor && mapEditor.resourceManager) {
        this.resourceManager = mapEditor.resourceManager;
        console.log('ResourceManager connected from MapEditor');
    } else {
        this.resourceManager = resourceManager;
    }
    
    this.shaderEffectsManager = shaderEffectsManager;
    
    // Core properties
    this.objects = [];
    this.selectedObject = null;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySteps = 30;
    
    // Scene for preview
    this.previewScene = null;
    this.previewCamera = null;
    this.previewRenderer = null;
    this.previewControls = null;
    this.previewContainer = null;
    this.isPreviewActive = false;
    
    // UI references
    this.drawer = null;
    this.propertyPanels = {};
    
    // Bind methods to maintain proper 'this' context
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    
    // Auto-load dependencies if needed
    this.checkDependencies();
}

/**
 * Check and load necessary dependencies
 */
checkDependencies() {
    console.log("ShapeForge checking dependencies...");
    
    // Check if THREE.js is available
    if (!window.THREE) {
        console.error("THREE.js not available! ShapeForge requires THREE.js to function.");
        return false;
    }
    
    // Try to get ResourceManager from various sources
    if (!this.resourceManager) {
        // Try window global
        if (window.resourceManager) {
            this.resourceManager = window.resourceManager;
            console.log("Using global ResourceManager");
        } 
        // Try through mapEditor if available
        else if (window.mapEditor && window.mapEditor.resourceManager) {
            this.resourceManager = window.mapEditor.resourceManager;
            console.log("Using MapEditor's ResourceManager");
        }
        // Try to find it in the Scene3D if available
        else if (window.scene3D && window.scene3D.resourceManager) {
            this.resourceManager = window.scene3D.resourceManager;
            console.log("Using Scene3D's ResourceManager");
        }
    }
    
    // If we have ResourceManager, log its state to help with debugging
    if (this.resourceManager) {
        console.log("ResourceManager connected:", {
            hasTextures: !!this.resourceManager.resources?.textures,
            textureCategories: Object.keys(this.resourceManager.resources?.textures || {})
        });
    } else {
        console.warn("ResourceManager not found, texture features will be disabled");
    }
    
    // Try to get ShaderEffectsManager from window if not provided
    if (!this.shaderEffectsManager && window.shaderEffectsManager) {
        this.shaderEffectsManager = window.shaderEffectsManager;
        console.log("Using global ShaderEffectsManager");
    }
    
    return true;
}

  /**
   * Check and load necessary dependencies
   */
  checkDependencies() {
    console.log("ShapeForge checking dependencies...");

    // Check if THREE.js is available
    if (!window.THREE) {
      console.error("THREE.js not available! ShapeForge requires THREE.js to function.");
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

  /**
 * Manually connect to ResourceManager
 * @param {ResourceManager} resourceManager - Instance of ResourceManager
 */
connectResourceManager(resourceManager) {
  if (!resourceManager) {
      console.error("Invalid ResourceManager provided");
      return false;
  }
  
  this.resourceManager = resourceManager;
  console.log("Manually connected to ResourceManager:", {
      hasTextures: !!this.resourceManager.resources?.textures,
      textureCategories: Object.keys(this.resourceManager.resources?.textures || {})
  });
  
  return true;
}



  show() {
    console.log("ShapeForge show() called");

    // Check if THREE.js is available
    if (!window.THREE) {
      console.error("THREE.js not available! Cannot show ShapeForge.");
      alert("ShapeForge requires THREE.js which is not loaded. Please check console for details.");
      return this;
    }

    // Create UI if it doesn't exist
    if (!this.drawer) {
      console.log("Creating ShapeForge UI");
      this.createUI();
    }

    // Check if the drawer was created successfully
    if (!this.drawer) {
      console.error("Failed to create ShapeForge UI!");
      return this;
    }

    // Show the drawer
    this.drawer.show();
    console.log("ShapeForge drawer shown");

    // Wait a moment for the drawer to be visible before initializing preview
    setTimeout(() => {
      // Check if preview container exists in the DOM
      this.previewContainer = this.drawer.querySelector('#preview-container');

      if (!this.previewContainer) {
        console.error("Preview container not found in ShapeForge UI!");
        return;
      }

      console.log("Preview container found:", {
        width: this.previewContainer.clientWidth,
        height: this.previewContainer.clientHeight,
        visible: this.previewContainer.offsetParent !== null
      });

      // Start the preview if not already running
      if (!this.isPreviewActive) {
        this.startPreview();
      }
    }, 500); // Wait 500ms for the drawer to render

    // Initialize new features if they haven't been already
    if (!this.featuresInitialized) {
      // Wait a moment for UI to be ready, then initialize features
      setTimeout(async () => {
        try {
          await this.initializeNewFeatures();
          this.featuresInitialized = true;
          console.log('All ShapeForge features initialized');
        } catch (error) {
          console.error('Error during ShapeForge feature initialization:', error);
        }
      }, 1000);
    }

    return this;
  }

  /**
   * Hide the ShapeForge UI
   */
  hide() {
    if (this.drawer) {
      this.drawer.hide();
    }

    // Stop the preview to save resources
    if (this.isPreviewActive) {
      this.stopPreview();
    }

    return this;
  }

  /**
   * Create the main UI components
   */

  createUI() {
    console.log("Creating ShapeForge UI");

    // Create drawer
    this.drawer = document.createElement('sl-drawer');
    this.drawer.label = 'ShapeForge - 3D Geometry Editor';
    this.drawer.placement = 'end';
    this.drawer.style.setProperty('--size', 'calc(100vw - 260px');

    // Create drawer content
    this.drawer.innerHTML = `
    <div id="shape-forge-container" style="display: flex; height: 100%; overflow: hidden;">
      <!-- Left panel for tools and properties -->
      <div class="tool-panel" style="width: 250px; padding: 0 10px; overflow-y: auto; border-right: 1px solid #444;">
        <!-- Project Info -->
        <div class="panel-section">
          <sl-input id="project-name" label="Project Name" placeholder="Untitled Project"></sl-input>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px;">
            <sl-button id="new-project" size="small">New</sl-button>
            <sl-button id="save-project" size="small">Save</sl-button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px;">
  <sl-button id="import-additional" size="small">Add to Project</sl-button>
  <sl-button id="export-code" size="small">Export Code</sl-button>
</div>
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px;">
  <sl-button id="save-to-resources" size="small">Resources</sl-button>
  <sl-button id="clear-all" size="small" variant="danger">Clear All</sl-button>
</div>
        </div>
        
        
<div class="panel-section" style="margin-top: 20px;">
  <h3>Shapes</h3>
  <div class="shape-buttons" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
    <!-- Basic Shapes -->
    <sl-icon-button  title="Cube" name="square" label="Cube" id="shape-cube"></sl-icon-button><sl-tooltip>
    <sl-icon-button  title="Sphere" name="circle" label="Sphere" id="shape-sphere"></sl-icon-button>
    <sl-icon-button  title="Cylinder"  name="plus-square" label="Cylinder" id="shape-cylinder"></sl-icon-button>
    <sl-icon-button  title="Cone" name="triangle" label="Cone" id="shape-cone"></sl-icon-button>
    <sl-icon-button  title="Torus"  name="life-preserver" label="Torus" id="shape-torus"></sl-icon-button>
    <sl-icon-button  title="Plane"  name="window" label="Plane" id="shape-plane"></sl-icon-button>
    
    <!-- Dice Shapes -->
    <sl-icon-button  title="D4"  name="diamond" label="D4 Tetrahedron" id="shape-d4"></sl-icon-button>
    <sl-icon-button  title="D8" name="octagon" label="D8 Octahedron" id="shape-d8"></sl-icon-button>
    <sl-icon-button  title="D10" name="pentagon" label="D10" id="shape-d10"></sl-icon-button>
    <sl-icon-button  title="D12" name="hexagon" label="D12 Dodecahedron" id="shape-d12"></sl-icon-button>
    <sl-icon-button  title="D20" name="record-circle" label="D20 Icosahedron" id="shape-d20"></sl-icon-button>
    
    <!-- Additional Shapes -->
    <sl-icon-button  title="Torus Knot" name="intersect" label="Torus Knot" id="shape-torus-knot"></sl-icon-button>
    <sl-icon-button  title="Pyramid" name="triangle-fill" label="Pyramid" id="shape-pyramid"></sl-icon-button>
    <sl-icon-button  title="Capsule" name="capsule" label="Capsule" id="shape-capsule"></sl-icon-button>
    <sl-icon-button  title="Tube" name="record" label="Tube/Ring" id="shape-tube"></sl-icon-button>
    <sl-icon-button  title="Hemisphere" name="circle-half" label="Hemisphere" id="shape-hemisphere"></sl-icon-button>
    <sl-icon-button  title="Star" name="asterisk" label="Star" id="shape-star"></sl-icon-button>
  </div>
</div>
        
        <!-- Transform Controls -->
        <div class="panel-section" style="margin-top: 20px;">
          <h3>Transform</h3>
          <div id="transform-container">
            <!-- Position -->
            <div class="transform-group">
              <label>Position</label>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: center;">
                <label>X:</label>
                <sl-range id="position-x" min="-10" max="10" step="0.1" value="0"></sl-range>
                <label>Y:</label>
                <sl-range id="position-y" min="-10" max="10" step="0.1" value="0"></sl-range>
                <label>Z:</label>
                <sl-range id="position-z" min="-10" max="10" step="0.1" value="0"></sl-range>
              </div>
            </div>
            
            <!-- Rotation -->
            <!-- <div class="transform-group" style="margin-top: 10px;">
              <label>Rotation</label>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: center;">
                <label>X:</label>
                <sl-range id="rotation-x" min="0" max="6.28" step="0.1" value="0"></sl-range>
                <label>Y:</label>
                <sl-range id="rotation-y" min="0" max="6.28" step="0.1" value="0"></sl-range>
                <label>Z:</label>
                <sl-range id="rotation-z" min="0" max="6.28" step="0.1" value="0"></sl-range>
              </div>
            </div> -->


<div class="transform-group" style="margin-top: 10px;">
  <label>Rotation (degrees)</label>
  <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 6px; align-items: center;">
    <label>X:</label>
    <sl-range id="rotation-x" min="0" max="360" step="1" value="0"></sl-range>
    <sl-button-group>
      <sl-button size="small" id="rot-x-90">90°</sl-button>
      <sl-button size="small" id="rot-x-180">180°</sl-button>
    </sl-button-group>
    
    <label>Y:</label>
    <sl-range id="rotation-y" min="0" max="360" step="1" value="0"></sl-range>
    <sl-button-group>
      <sl-button size="small" id="rot-y-90">90°</sl-button>
      <sl-button size="small" id="rot-y-180">180°</sl-button>
    </sl-button-group>
    
    <label>Z:</label>
    <sl-range id="rotation-z" min="0" max="360" step="1" value="0"></sl-range>
    <sl-button-group>
      <sl-button size="small" id="rot-z-90">90°</sl-button>
      <sl-button size="small" id="rot-z-180">180°</sl-button>
    </sl-button-group>
  </div>
</div>
            
            <!-- Scale -->
            <div class="transform-group" style="margin-top: 10px;">
              <label>Scale</label>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: center;">
                <label>X:</label>
                <sl-range id="scale-x" min="0.1" max="5" step="0.1" value="1"></sl-range>
                <label>Y:</label>
                <sl-range id="scale-y" min="0.1" max="5" step="0.1" value="1"></sl-range>
                <label>Z:</label>
                <sl-range id="scale-z" min="0.1" max="5" step="0.1" value="1"></sl-range>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Shape Properties -->
        <div class="panel-section" style="margin-top: 20px;">
          <h3>Properties</h3>
          <div id="properties-container">
            <!-- Properties will be added dynamically based on selected object -->
            <div class="no-selection-message">
              Select or create an object to edit properties
            </div>
          </div>
        </div>
        
        <!-- Materials -->
        <div class="panel-section" style="margin-top: 20px;">
          <h3>Materials</h3>
          <div id="materials-container">
            <sl-select label="Material Type" id="material-type">
              <sl-option value="basic">Basic</sl-option>
              <sl-option value="standard">Standard</sl-option>
              <sl-option value="phong">Phong</sl-option>
              <sl-option value="lambert">Lambert</sl-option>
            </sl-select>
            
            <sl-color-picker label="Color" id="material-color" value="#3388ff"></sl-color-picker>
            
            <sl-checkbox id="material-wireframe">Wireframe</sl-checkbox>
            
            <sl-range id="material-opacity" min="0" max="1" step="0.01" value="1" 
                    label="Opacity"></sl-range>
            
            <sl-range id="material-metalness" min="0" max="1" step="0.01" value="0" 
                    label="Metalness"></sl-range>
            
            <sl-range id="material-roughness" min="0" max="1" step="0.01" value="0.5" 
                    label="Roughness"></sl-range>
          </div>
        </div>
        
        <!-- Shader Effects -->
        <div class="panel-section" style="margin-top: 20px;">
          <h3>Shader Effects</h3>
          <div id="effects-container">
            <sl-select label="Effect Type" id="effect-type">
              <sl-option value="none">None</sl-option>
              <sl-option value="glow">Glow Effect</sl-option>
              <sl-option value="fire">Fire Effect</sl-option>
              <sl-option value="magic">Magic Effect</sl-option>
            </sl-select>
            
            <div id="effect-properties" style="display: none; margin-top: 10px;">
              <!-- Effect properties will be added dynamically -->
            </div>
          </div>
        </div>
      </div>
      
      <!-- Right panel for preview -->
      <div class="preview-panel" style="flex: 1; display: flex; flex-direction: column;">

        
        <div id="preview-container" style="flex: 1; position: relative;">
          <!-- Three.js preview will be inserted here -->
        </div>
      </div>
    </div>
    
    <div slot="footer">
      <sl-button variant="neutral" class="close-button">Close</sl-button>
    </div>
  `;

    // Add drawer to document
    document.body.appendChild(this.drawer);

    // Get references to UI elements
    this.previewContainer = this.drawer.querySelector('#preview-container');
    this.objectsListContainer = this.drawer.querySelector('#objects-list-container');

    // Set up event listeners
    this.setupEventListeners();

    const materialsContainer = this.drawer.querySelector('#materials-container');
if (materialsContainer) {
    // Add texture selection button
    const textureBtn = document.createElement('sl-button');
    textureBtn.style.marginTop = '16px';
    textureBtn.style.width = '100%';
    textureBtn.innerHTML = `
        <span class="material-icons" slot="prefix">wallpaper</span>
        Apply Texture from Resources
    `;
    
    textureBtn.addEventListener('click', () => {
        if (this.selectedObject !== null) {
            this.showTextureSelectionDialog();
        } else {
            alert('Please select an object first');
        }
    });
    
    materialsContainer.appendChild(textureBtn);
}


  }

  /**
   * Set up event listeners for UI interactions
   */

  setupEventListeners() {
    // Close button
    this.drawer.querySelector('.close-button').addEventListener('click', () => {
      this.hide();
    });

    // Shape creation buttons
// In setupEventListeners, update the shapeButtons object:
const shapeButtons = {
  'shape-cube': this.createCube.bind(this),
  'shape-sphere': this.createSphere.bind(this),
  'shape-cylinder': this.createCylinder.bind(this),
  'shape-cone': this.createCone.bind(this),
  'shape-torus': this.createTorus.bind(this),
  'shape-plane': this.createPlane.bind(this),
  'shape-d4': this.createTetrahedron.bind(this),
  'shape-d6': this.createCube.bind(this),
  'shape-d8': this.createOctahedron.bind(this),
  'shape-d10': this.createD10.bind(this),
  'shape-d12': this.createDodecahedron.bind(this),
  'shape-d20': this.createIcosahedron.bind(this),
  // New shapes
  'shape-torus-knot': this.createTorusKnot.bind(this),
  'shape-pyramid': this.createPyramid.bind(this),
  'shape-prism': this.createPrism.bind(this),
  'shape-capsule': this.createCapsule.bind(this),
  'shape-tube': this.createTube.bind(this),
  'shape-hemisphere': this.createHemisphere.bind(this),
  'shape-rounded-cube': this.createRoundedCube.bind(this),
  'shape-star': this.createStar.bind(this)
};

    // Add event listeners for shape buttons
    Object.entries(shapeButtons).forEach(([id, handler]) => {
      const button = this.drawer.querySelector(`#${id}`);
      if (button) {
        button.addEventListener('click', handler);
      }
    });

    // Material type change
    const materialTypeSelect = this.drawer.querySelector('#material-type');
    if (materialTypeSelect) {
      materialTypeSelect.addEventListener('sl-change', (e) => {
        this.updateMaterialType(e.target.value);
      });
    }

    // Material color change
    const colorPicker = this.drawer.querySelector('#material-color');
    if (colorPicker) {
      colorPicker.addEventListener('sl-change', (e) => {
        this.updateMaterialColor(e.target.value);
      });
    }

    // Material property changes
    ['wireframe', 'opacity', 'metalness', 'roughness'].forEach(prop => {
      const control = this.drawer.querySelector(`#material-${prop}`);
      if (control) {
        control.addEventListener('sl-change', (e) => {
          this.updateMaterialProperty(prop, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        });
      }
    });

    // Project controls
    this.drawer.querySelector('#new-project')?.addEventListener('click', this.newProject.bind(this));
    this.drawer.querySelector('#save-project')?.addEventListener('click', this.saveProject.bind(this));
    this.drawer.querySelector('#load-project')?.addEventListener('click', this.loadProject.bind(this));
    this.drawer.querySelector('#export-code')?.addEventListener('click', this.showExportDialog.bind(this));
    this.drawer.querySelector('#save-to-resources')?.addEventListener('click', this.saveToResources.bind(this));

    const rotationQuickButtons = [
      { id: 'rot-x-90', axis: 'x', degrees: 90 },
      { id: 'rot-x-180', axis: 'x', degrees: 180 },
      { id: 'rot-y-90', axis: 'y', degrees: 90 },
      { id: 'rot-y-180', axis: 'y', degrees: 180 },
      { id: 'rot-z-90', axis: 'z', degrees: 90 },
      { id: 'rot-z-180', axis: 'z', degrees: 180 }
    ];
    
    rotationQuickButtons.forEach(btn => {
      const button = this.drawer.querySelector(`#${btn.id}`);
      if (button) {
        button.addEventListener('click', () => {
          if (this.selectedObject === null) return;
          
          const object = this.objects[this.selectedObject];
          const currentDegrees = (object.rotation[btn.axis] * 180) / Math.PI;
          
          // Add the degrees, keeping within 0-360 range
          let newDegrees = (currentDegrees + btn.degrees) % 360;
          
          // Update the slider
          const slider = this.drawer.querySelector(`#rotation-${btn.axis}`);
          if (slider) {
            slider.value = newDegrees;
            
            // Trigger the change event
            this.updateTransform('rotation', btn.axis, newDegrees);
          }
        });
      }
    });

    // Transform controls
    const transformControls = ['position', 'rotation', 'scale'];
    const axes = ['x', 'y', 'z'];

    transformControls.forEach(control => {
      axes.forEach(axis => {
        const slider = this.drawer.querySelector(`#${control}-${axis}`);
        if (slider) {
          slider.addEventListener('sl-change', (e) => {
            this.updateTransform(control, axis, e.target.value);
          });
        }
      });
    });

    this.drawer.querySelector('#import-additional')?.addEventListener('click', this.importAdditional.bind(this));
    this.drawer.querySelector('#clear-all')?.addEventListener('click', this.clearAll.bind(this));

    // Preview controls
    this.drawer.querySelector('#preview-reset-camera')?.addEventListener('click', this.resetCamera.bind(this));
    this.drawer.querySelector('#preview-wireframe')?.addEventListener('click', () => this.setPreviewMode('wireframe'));
    this.drawer.querySelector('#preview-solid')?.addEventListener('click', () => this.setPreviewMode('solid'));

    // History controls
    this.drawer.querySelector('#object-undo')?.addEventListener('click', this.undo.bind(this));
    this.drawer.querySelector('#object-redo')?.addEventListener('click', this.redo.bind(this));

    // Window resize
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Initialize the preview scene
   */


  // In ShapeForge.js, modify the initPreview method:
  initPreview() {
    if (!this.previewContainer) return;

    // Create scene
    this.previewScene = new THREE.Scene();
    this.previewScene.background = new THREE.Color(0x111111);

    // Create camera
    this.previewCamera = new THREE.PerspectiveCamera(
      60, // FOV
      this.previewContainer.clientWidth / this.previewContainer.clientHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    this.previewCamera.position.set(3, 3, 3);
    this.previewCamera.lookAt(0, 0, 0);

    // Create renderer
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.previewRenderer.setSize(
      this.previewContainer.clientWidth,
      this.previewContainer.clientHeight
    );
    this.previewContainer.appendChild(this.previewRenderer.domElement);

    // Check if OrbitControls is available
    if (typeof THREE.OrbitControls === 'function') {
      // Create orbit controls
      this.previewControls = new THREE.OrbitControls(
        this.previewCamera,
        this.previewRenderer.domElement
      );
      this.previewControls.enableDamping = true;
      this.previewControls.dampingFactor = 0.25;
      console.log("Using OrbitControls for camera manipulation");
    } else {
      // Create a simple camera rotation as fallback
      console.log("OrbitControls not available, using simple camera rotation");
      this.previewControls = {
        update: () => {
          // Simple automatic rotation around the center
          const time = Date.now() * 0.001;
          const radius = 5;
          this.previewCamera.position.x = Math.cos(time * 0.3) * radius;
          this.previewCamera.position.z = Math.sin(time * 0.3) * radius;
          this.previewCamera.lookAt(0, 0, 0);
        }
      };

      // Add mouse/touch event listeners for basic interaction
      this.setupBasicCameraControls();
    }

    // Add grid helper
    const gridHelper = new THREE.GridHelper(10, 10);
    this.previewScene.add(gridHelper);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x666666);
    this.previewScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.previewScene.add(directionalLight);

    console.log("Preview scene initialized");
  }


  setupBasicCameraControls() {
    if (!this.previewContainer) return;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    this.previewContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
    });

    this.previewContainer.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // Simple camera rotation
      const rotationSpeed = 0.005;
      const radius = this.previewCamera.position.length();

      // Calculate new camera position
      let phi = Math.atan2(this.previewCamera.position.z, this.previewCamera.position.x);
      let theta = Math.acos(this.previewCamera.position.y / radius);

      phi += deltaMove.x * rotationSpeed;
      theta = Math.max(0.1, Math.min(Math.PI - 0.1, theta + deltaMove.y * rotationSpeed));

      this.previewCamera.position.x = radius * Math.sin(theta) * Math.cos(phi);
      this.previewCamera.position.z = radius * Math.sin(theta) * Math.sin(phi);
      this.previewCamera.position.y = radius * Math.cos(theta);

      this.previewCamera.lookAt(0, 0, 0);

      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
    });

    this.previewContainer.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.previewContainer.addEventListener('mouseleave', () => {
      isDragging = false;
    });

    // Add zoom controls with mouse wheel
    this.previewContainer.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomSpeed = 0.1;
      const direction = e.deltaY > 0 ? 1 : -1;
      const factor = 1 + direction * zoomSpeed;

      // Zoom by adjusting camera distance
      const radius = this.previewCamera.position.length() * factor;
      this.previewCamera.position.normalize().multiplyScalar(radius);
    });
  }

  /**
   * Start the preview animation loop
   */
  startPreview() {
    if (!this.previewScene) {
      this.initPreview();
    }

    this.isPreviewActive = true;
    this.animate();

    console.log("Preview started");
  }

  /**
   * Stop the preview animation loop
   */
  stopPreview() {
    this.isPreviewActive = false;
    console.log("Preview stopped");
  }

  /**
   * Animation loop for preview
   */
  animate() {
    if (!this.isPreviewActive) return;

    requestAnimationFrame(this.animate);

    // Calculate delta time for smooth animations
    const now = Date.now();
    const deltaTime = (now - (this.lastFrameTime || now)) / 1000; // in seconds
    this.lastFrameTime = now;

    // Update orbit controls
    if (this.previewControls) {
      this.previewControls.update();
    }

    // Update shader effects
    this.updateEffects(deltaTime);

    // Render the scene
    if (this.previewRenderer && this.previewScene && this.previewCamera) {
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (!this.previewContainer || !this.previewCamera || !this.previewRenderer) return;

    // Update camera aspect ratio
    this.previewCamera.aspect = this.previewContainer.clientWidth / this.previewContainer.clientHeight;
    this.previewCamera.updateProjectionMatrix();

    // Update renderer size
    this.previewRenderer.setSize(
      this.previewContainer.clientWidth,
      this.previewContainer.clientHeight
    );
  }

  /**
   * Reset camera to default position
   */
  resetCamera() {
    if (!this.previewCamera || !this.previewControls) return;

    this.previewCamera.position.set(3, 3, 3);
    this.previewCamera.lookAt(0, 0, 0);
    this.previewControls.reset();
  }

  /**
   * Set preview display mode (wireframe or solid)
   * @param {string} mode - Display mode ('wireframe' or 'solid')
   */
  setPreviewMode(mode) {
    if (!this.objects.length) return;

    this.objects.forEach(obj => {
      if (obj.mesh && obj.mesh.material) {
        if (Array.isArray(obj.mesh.material)) {
          obj.mesh.material.forEach(material => {
            material.wireframe = mode === 'wireframe';
          });
        } else {
          obj.mesh.material.wireframe = mode === 'wireframe';
        }
      }
    });
  }

  //-------------------------------------------------------
  // Shape Creation Methods
  //-------------------------------------------------------

  /**
   * Create a cube and add it to the scene
   */
  createCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'cube',
      name: `Cube ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        width: 1,
        height: 1,
        depth: 1,
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a sphere and add it to the scene
   */
  createSphere() {
    const geometry = new THREE.SphereGeometry(0.5, 32, 16);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'sphere',
      name: `Sphere ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        widthSegments: 32,
        heightSegments: 16
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a cylinder and add it to the scene
   */
  createCylinder() {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'cylinder',
      name: `Cylinder ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 1,
        radialSegments: 32
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a cone and add it to the scene
   */
  createCone() {
    const geometry = new THREE.ConeGeometry(0.5, 1, 32);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'cone',
      name: `Cone ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        height: 1,
        radialSegments: 32
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a torus and add it to the scene
   */
  createTorus() {
    const geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 48);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'torus',
      name: `Torus ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        tube: 0.2,
        radialSegments: 16,
        tubularSegments: 48
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a plane and add it to the scene
   */
  createPlane() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'plane',
      name: `Plane ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        width: 1,
        height: 1,
        widthSegments: 1,
        heightSegments: 1
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a tetrahedron (D4 dice) and add it to the scene
   */
  createTetrahedron() {
    const geometry = new THREE.TetrahedronGeometry(0.5);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'tetrahedron',
      name: `D4 ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        detail: 0
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create an octahedron (D8 dice) and add it to the scene
   */
  createOctahedron() {
    const geometry = new THREE.OctahedronGeometry(0.5);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'octahedron',
      name: `D8 ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        detail: 0
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a dodecahedron (D12 dice) and add it to the scene
   */
  createDodecahedron() {
    const geometry = new THREE.DodecahedronGeometry(0.5);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'dodecahedron',
      name: `D12 ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        detail: 0
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create an icosahedron (D20 dice) and add it to the scene
   */
  createIcosahedron() {
    const geometry = new THREE.IcosahedronGeometry(0.5);
    const material = this.createDefaultMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    this.addObjectToScene({
      type: 'icosahedron',
      name: `D20 ${this.objects.length + 1}`,
      geometry: geometry,
      material: material,
      mesh: mesh,
      parameters: {
        radius: 0.5,
        detail: 0
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }

  /**
   * Create a d10 dice shape (pentagonal trapezohedron) and add it to the scene
   * Note: THREE.js doesn't have this built-in, so we use a custom approach
   */
  createD10() {
      // Define the vertices for a pentagonal trapezohedron
  const sides = 10;
  const radius = 0.5; // Scale to match other shapes in ShapeForge
  
  // Start with top and bottom vertices
  const vertices = [
    [0, 0, 1],   // Top vertex
    [0, 0, -1],  // Bottom vertex
  ];
  
  // Add vertices around the "equator" with slight offsets
  for (let i = 0; i < sides; ++i) {
    const b = (i * Math.PI * 2) / sides;
    vertices.push([-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1)]);
  }
  
  // Define the faces as triangles
  const faces = [
    // Top faces (connecting top vertex to equator)
    [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 6], [0, 6, 7],
    [0, 7, 8], [0, 8, 9], [0, 9, 10], [0, 10, 11], [0, 11, 2],
    
    // Bottom faces (connecting bottom vertex to equator)
    [1, 3, 2], [1, 4, 3], [1, 5, 4], [1, 6, 5], [1, 7, 6],
    [1, 8, 7], [1, 9, 8], [1, 10, 9], [1, 11, 10], [1, 2, 11]
  ];
  
  // Flatten the arrays to the format needed by THREE.PolyhedronGeometry
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
  
  // Create the geometry
  const geometry = new THREE.PolyhedronGeometry(
    flatVertices,
    flatFaces,
    radius,
    0 // No subdivision
  );
  
  // Create material and mesh
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  // Add to scene
  this.addObjectToScene({
    type: 'd10',
    name: `D10 ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      radius: radius,
      sides: sides
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
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
   * Update property panels for the selected object
   * @param {Object} object - Object data
   */
  updatePropertyPanels(object) {
    if (!object) {
      // No selection, clear properties
      const propertiesContainer = this.drawer.querySelector('#properties-container');
      if (propertiesContainer) {
        propertiesContainer.innerHTML = `
          <div class="no-selection-message">
            Select or create an object to edit properties
          </div>
        `;
      }
      return;
    }

    // Create properties UI based on object type
    const propertiesContainer = this.drawer.querySelector('#properties-container');
    if (!propertiesContainer) return;

    // Clear existing properties
    // propertiesContainer.innerHTML = '';

    while (propertiesContainer.firstChild) {
      // If it's a Shoelace element, remove it properly
      if (propertiesContainer.firstChild.tagName &&
        propertiesContainer.firstChild.tagName.startsWith('SL-')) {
        propertiesContainer.firstChild.remove();
      } else {
        propertiesContainer.removeChild(propertiesContainer.firstChild);
      }
    }

    // Create name input
    const nameInput = document.createElement('sl-input');
    nameInput.label = 'Name';
    nameInput.value = object.name;
    nameInput.id = 'object-name';
    propertiesContainer.appendChild(nameInput);

    // Add event listener for name change
    nameInput.addEventListener('sl-change', (e) => {
      const oldName = object.name;
      const newName = e.target.value.trim();

      if (newName) {
        object.name = newName;
        this.addHistoryStep('rename', {
          objectIndex: this.selectedObject,
          oldName,
          newName
        });
      }
    });

    // Create geometry-specific properties
    const parametersDiv = document.createElement('div');
    parametersDiv.style.marginTop = '16px';
    parametersDiv.innerHTML = `<label>Geometry Parameters</label>`;
    propertiesContainer.appendChild(parametersDiv);

    // Create property sliders based on object type
    switch (object.type) {
      case 'cube':
        this.addRangeSlider(parametersDiv, 'Width', 'width', object.parameters.width, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('width', value));
        this.addRangeSlider(parametersDiv, 'Height', 'height', object.parameters.height, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('height', value));
        this.addRangeSlider(parametersDiv, 'Depth', 'depth', object.parameters.depth, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('depth', value));
        break;

      case 'sphere':
        this.addRangeSlider(parametersDiv, 'Radius', 'radius', object.parameters.radius, 0.1, 5, 0.1,
          (value) => this.updateGeometryParameter('radius', value));
        this.addRangeSlider(parametersDiv, 'Width Segments', 'widthSegments', object.parameters.widthSegments, 4, 64, 1,
          (value) => this.updateGeometryParameter('widthSegments', value));
        this.addRangeSlider(parametersDiv, 'Height Segments', 'heightSegments', object.parameters.heightSegments, 2, 32, 1,
          (value) => this.updateGeometryParameter('heightSegments', value));
        break;

      case 'cylinder':
        this.addRangeSlider(parametersDiv, 'Top Radius', 'radiusTop', object.parameters.radiusTop, 0, 5, 0.1,
          (value) => this.updateGeometryParameter('radiusTop', value));
        this.addRangeSlider(parametersDiv, 'Bottom Radius', 'radiusBottom', object.parameters.radiusBottom, 0, 5, 0.1,
          (value) => this.updateGeometryParameter('radiusBottom', value));
        this.addRangeSlider(parametersDiv, 'Height', 'height', object.parameters.height, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('height', value));
        this.addRangeSlider(parametersDiv, 'Radial Segments', 'radialSegments', object.parameters.radialSegments, 3, 64, 1,
          (value) => this.updateGeometryParameter('radialSegments', value));
        break;

      case 'cone':
        this.addRangeSlider(parametersDiv, 'Radius', 'radius', object.parameters.radius, 0.1, 5, 0.1,
          (value) => this.updateGeometryParameter('radius', value));
        this.addRangeSlider(parametersDiv, 'Height', 'height', object.parameters.height, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('height', value));
        this.addRangeSlider(parametersDiv, 'Radial Segments', 'radialSegments', object.parameters.radialSegments, 3, 64, 1,
          (value) => this.updateGeometryParameter('radialSegments', value));
        break;

      case 'torus':
        this.addRangeSlider(parametersDiv, 'Radius', 'radius', object.parameters.radius, 0.1, 5, 0.1,
          (value) => this.updateGeometryParameter('radius', value));
        this.addRangeSlider(parametersDiv, 'Tube', 'tube', object.parameters.tube, 0.01, 2, 0.01,
          (value) => this.updateGeometryParameter('tube', value));
        this.addRangeSlider(parametersDiv, 'Radial Segments', 'radialSegments', object.parameters.radialSegments, 3, 64, 1,
          (value) => this.updateGeometryParameter('radialSegments', value));
        this.addRangeSlider(parametersDiv, 'Tubular Segments', 'tubularSegments', object.parameters.tubularSegments, 3, 128, 1,
          (value) => this.updateGeometryParameter('tubularSegments', value));
        break;

      case 'tetrahedron':
      case 'octahedron':
      case 'dodecahedron':
      case 'icosahedron':
        this.addRangeSlider(parametersDiv, 'Radius', 'radius', object.parameters.radius, 0.1, 5, 0.1,
          (value) => this.updateGeometryParameter('radius', value));
        this.addRangeSlider(parametersDiv, 'Detail', 'detail', object.parameters.detail, 0, 5, 1,
          (value) => this.updateGeometryParameter('detail', value));
        break;

      case 'd10':
        this.addRangeSlider(parametersDiv, 'Radius', 'radius', object.parameters.radius, 0.1, 5, 0.1,
          (value) => this.updateGeometryParameter('radius', value));
        this.addRangeSlider(parametersDiv, 'Height', 'height', object.parameters.height, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('height', value));
        this.addRangeSlider(parametersDiv, 'Segments', 'segments', object.parameters.segments, 5, 10, 1,
          (value) => this.updateGeometryParameter('segments', value));
        break;

      case 'plane':
        this.addRangeSlider(parametersDiv, 'Width', 'width', object.parameters.width, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('width', value));
        this.addRangeSlider(parametersDiv, 'Height', 'height', object.parameters.height, 0.1, 10, 0.1,
          (value) => this.updateGeometryParameter('height', value));
        this.addRangeSlider(parametersDiv, 'Width Segments', 'widthSegments', object.parameters.widthSegments, 1, 32, 1,
          (value) => this.updateGeometryParameter('widthSegments', value));
        this.addRangeSlider(parametersDiv, 'Height Segments', 'heightSegments', object.parameters.heightSegments, 1, 32, 1,
          (value) => this.updateGeometryParameter('heightSegments', value));
        break;
    }

    // Also update material UI components
    this.updateMaterialUI(object);
  }

  /**
   * Add a range slider to the properties panel
   * @param {HTMLElement} container - Container element
   * @param {string} label - Slider label
   * @param {string} id - Slider ID
   * @param {number} value - Initial value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {number} step - Step value
   * @param {Function} onChange - Change handler
   */
  addRangeSlider(container, label, id, value, min, max, step, onChange) {
    const slider = document.createElement('sl-range');
    slider.label = label;
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.id = `property-${id}`;
    slider.style.marginTop = '8px';

    slider.addEventListener('sl-change', (e) => {
      onChange(parseFloat(e.target.value));
    });

    container.appendChild(slider);
    return slider;
  }

  /**
   * Update a geometry parameter
   * @param {string} parameter - Parameter name
   * @param {number} value - New value
   */
  updateGeometryParameter(parameter, value) {
    if (this.selectedObject === null) return;

    const object = this.objects[this.selectedObject];
    const oldValue = object.parameters[parameter];

    // Update parameter
    object.parameters[parameter] = value;

    // Recreate geometry with new parameter
    this.recreateGeometry(object);

    // Add to history
    this.addHistoryStep('geometry', {
      objectIndex: this.selectedObject,
      parameter,
      oldValue,
      newValue: value
    });
  }

  /**
   * Recreate geometry with updated parameters
   * @param {Object} object - Object data
   */
  recreateGeometry(object) {
    // Dispose of old geometry
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Create new geometry based on type
    let newGeometry;
    switch (object.type) {
      case 'cube':
        newGeometry = new THREE.BoxGeometry(
          object.parameters.width,
          object.parameters.height,
          object.parameters.depth,
          object.parameters.widthSegments,
          object.parameters.heightSegments,
          object.parameters.depthSegments
        );
        break;

      case 'sphere':
        newGeometry = new THREE.SphereGeometry(
          object.parameters.radius,
          object.parameters.widthSegments,
          object.parameters.heightSegments
        );
        break;

      case 'cylinder':
        newGeometry = new THREE.CylinderGeometry(
          object.parameters.radiusTop,
          object.parameters.radiusBottom,
          object.parameters.height,
          object.parameters.radialSegments
        );
        break;

      case 'cone':
        newGeometry = new THREE.ConeGeometry(
          object.parameters.radius,
          object.parameters.height,
          object.parameters.radialSegments
        );
        break;

      case 'torus':
        newGeometry = new THREE.TorusGeometry(
          object.parameters.radius,
          object.parameters.tube,
          object.parameters.radialSegments,
          object.parameters.tubularSegments
        );
        break;

      case 'tetrahedron':
        newGeometry = new THREE.TetrahedronGeometry(
          object.parameters.radius,
          object.parameters.detail
        );
        break;

      case 'octahedron':
        newGeometry = new THREE.OctahedronGeometry(
          object.parameters.radius,
          object.parameters.detail
        );
        break;

      case 'dodecahedron':
        newGeometry = new THREE.DodecahedronGeometry(
          object.parameters.radius,
          object.parameters.detail
        );
        break;

      case 'icosahedron':
        newGeometry = new THREE.IcosahedronGeometry(
          object.parameters.radius,
          object.parameters.detail
        );
        break;

      case 'd10':
        newGeometry = new THREE.CylinderGeometry(
          0,
          object.parameters.radius,
          object.parameters.height,
          object.parameters.segments,
          1
        );
        // Customize vertices for d10 shape
        const vertices = newGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
          if (vertices[i + 1] < 0) {
            vertices[i] *= 0.6;
            vertices[i + 2] *= 0.6;
          }
        }
        newGeometry.attributes.position.needsUpdate = true;
        break;

      case 'plane':
        newGeometry = new THREE.PlaneGeometry(
          object.parameters.width,
          object.parameters.height,
          object.parameters.widthSegments,
          object.parameters.heightSegments
        );
        break;

      default:
        console.warn(`Unknown geometry type: ${object.type}`);
        return;
    }

    // Update object with new geometry
    object.geometry = newGeometry;
    object.mesh.geometry = newGeometry;
  }

  /**
   * Update material UI with current object material
   * @param {Object} object - Object data
   */
  updateMaterialUI(object) {
    // Update material type selector
    const materialType = this.drawer.querySelector('#material-type');
    if (materialType) {
      let type = 'standard';
      if (object.material instanceof THREE.MeshBasicMaterial) {
        type = 'basic';
      } else if (object.material instanceof THREE.MeshPhongMaterial) {
        type = 'phong';
      } else if (object.material instanceof THREE.MeshLambertMaterial) {
        type = 'lambert';
      }
      materialType.value = type;
    }

    // Update color picker
    const colorPicker = this.drawer.querySelector('#material-color');
    if (colorPicker && object.material.color) {
      colorPicker.value = '#' + object.material.color.getHexString();
    }

    // Update wireframe checkbox
    const wireframeCheckbox = this.drawer.querySelector('#material-wireframe');
    if (wireframeCheckbox) {
      wireframeCheckbox.checked = object.material.wireframe || false;
    }

    // Update opacity slider
    const opacitySlider = this.drawer.querySelector('#material-opacity');
    if (opacitySlider) {
      opacitySlider.value = object.material.opacity !== undefined ? object.material.opacity : 1;
    }

    // Update metalness slider (for standard material)
    const metalnessSlider = this.drawer.querySelector('#material-metalness');
    if (metalnessSlider) {
      metalnessSlider.value = object.material.metalness !== undefined ? object.material.metalness : 0;
      metalnessSlider.disabled = !(object.material instanceof THREE.MeshStandardMaterial);
    }

    // Update roughness slider (for standard material)
    const roughnessSlider = this.drawer.querySelector('#material-roughness');
    if (roughnessSlider) {
      roughnessSlider.value = object.material.roughness !== undefined ? object.material.roughness : 0.5;
      roughnessSlider.disabled = !(object.material instanceof THREE.MeshStandardMaterial);
    }
  }

  /**
   * Update transform controls with current object transform
   * @param {Object} object - Object data
   */
  updateTransformControls(object) {

    if (!object) return;
  
    // Update position sliders
    const axes = ['x', 'y', 'z'];
    axes.forEach(axis => {
      const positionSlider = this.drawer.querySelector(`#position-${axis}`);
      if (positionSlider) {
        positionSlider.value = object.position[axis];
      }
      
      const rotationSlider = this.drawer.querySelector(`#rotation-${axis}`);
      if (rotationSlider) {
        // Convert radians to degrees
        const degrees = (object.rotation[axis] * 180) / Math.PI;
        rotationSlider.value = degrees;
      }
      
      const scaleSlider = this.drawer.querySelector(`#scale-${axis}`);
      if (scaleSlider) {
        scaleSlider.value = object.scale[axis];
      }
    });
  }

  /**
   * Update the material type for the selected object
   * @param {string} materialType - Type of material to use
   */
  updateMaterialType(materialType) {
    if (this.selectedObject === null) return;

    const object = this.objects[this.selectedObject];
    let newMaterial;

    // Create new material based on type
    switch (materialType) {
      case 'basic':
        newMaterial = new THREE.MeshBasicMaterial({
          color: object.material.color || 0x3388ff
        });
        break;
      case 'standard':
        newMaterial = new THREE.MeshStandardMaterial({
          color: object.material.color || 0x3388ff,
          roughness: 0.5,
          metalness: 0.0
        });
        break;
      case 'phong':
        newMaterial = new THREE.MeshPhongMaterial({
          color: object.material.color || 0x3388ff,
          shininess: 30
        });
        break;
      case 'lambert':
        newMaterial = new THREE.MeshLambertMaterial({
          color: object.material.color || 0x3388ff
        });
        break;
      default:
        return;
    }

    // Copy other material properties
    if (object.material.opacity !== undefined) {
      newMaterial.opacity = object.material.opacity;
      newMaterial.transparent = object.material.opacity < 1;
    }

    if (object.material.wireframe !== undefined) {
      newMaterial.wireframe = object.material.wireframe;
    }

    // Replace material
    object.mesh.material = newMaterial;
    object.material = newMaterial;

    // Add to history
    this.addHistoryStep('material', {
      objectIndex: this.selectedObject,
      oldMaterial: object.material,
      newMaterial: newMaterial
    });
  }

  /**
   * Update material color for the selected object
   * @param {string} colorValue - Hex color value
   */
  updateMaterialColor(colorValue) {
    if (this.selectedObject === null) return;

    const object = this.objects[this.selectedObject];
    const oldColor = object.material.color.getHex();
    const newColor = new THREE.Color(colorValue);

    // Update material color
    object.material.color = newColor;

    // Add to history
    this.addHistoryStep('color', {
      objectIndex: this.selectedObject,
      oldColor: oldColor,
      newColor: newColor.getHex()
    });
  }

  /**
   * Update a material property for the selected object
   * @param {string} property - Name of the property to update
   * @param {any} value - New value for the property
   */
  updateMaterialProperty(property, value) {
    if (this.selectedObject === null) return;

    const object = this.objects[this.selectedObject];
    const oldValue = object.material[property];

    // Update material property
    object.material[property] = value;

    // Special handling for opacity
    if (property === 'opacity') {
      object.material.transparent = value < 1;
    }

    // Add to history
    this.addHistoryStep('property', {
      objectIndex: this.selectedObject,
      property: property,
      oldValue: oldValue,
      newValue: value
    });
  }

  //-------------------------------------------------------
  // ShaderEffects Integration
  //-------------------------------------------------------



  /**
   * Remove existing shader effect from an object
   * @param {Object} object - Object to remove effect from
   */
  removeExistingEffect(object) {
    if (!object.effect || !object.effect.data) return;

    // Remove effect elements from scene
    if (object.effect.data.container) {
      this.previewScene.remove(object.effect.data.container);
    }

    if (object.effect.data.particles) {
      this.previewScene.remove(object.effect.data.particles);
    }

    if (object.effect.data.light) {
      this.previewScene.remove(object.effect.data.light);
    }

    // Clear effect data
    object.effect = null;
  }

  /**
   * Create a glow effect for an object
   * @param {Object} object - Object to apply effect to
   * @returns {Object} Effect data
   */
  createGlowEffect(object) {
    if (!this.shaderEffectsManager) return null;

    try {
      // Get object world position
      const position = new THREE.Vector3();
      object.mesh.getWorldPosition(position);

      // Create the effect using ShaderEffectsManager
      const effectData = this.shaderEffectsManager.createPropGlowEffect(
        object.mesh, // Use the actual mesh as the target
        {
          color: object.material.color.getHex(),
          intensity: 0.8,
          particleCount: 15,
          particleSize: 0.05,
          height: 0.2,
          radius: 0.3,
          blending: THREE.AdditiveBlending
        }
      );

      return effectData;
    } catch (error) {
      console.error("Error creating glow effect:", error);
      return null;
    }
  }

  /**
   * Create a fire effect for an object
   * @param {Object} object - Object to apply effect to
   * @returns {Object} Effect data
   */
  createFireEffect(object) {
    if (!this.shaderEffectsManager || !this.shaderEffectsManager.createFireEffect) {
      console.warn("ShaderEffectsManager or createFireEffect not available");
      return null;
    }

    try {
      // Get object world position
      const position = new THREE.Vector3();
      object.mesh.getWorldPosition(position);

      // Create the effect using ShaderEffectsManager
      const effectData = this.shaderEffectsManager.createFireEffect(
        object.mesh, // Use the actual mesh as the target
        'medium', // Quality level
        {
          color: 0xff6600,
          intensity: 1.2,
          height: 0.5,
          width: 0.3
        }
      );

      return effectData;
    } catch (error) {
      console.error("Error creating fire effect:", error);
      return null;
    }
  }

  /**
   * Create a magic effect for an object
   * @param {Object} object - Object to apply effect to
   * @returns {Object} Effect data
   */
  createMagicEffect(object) {
    if (!this.shaderEffectsManager || !this.shaderEffectsManager.createMagicEffect) {
      // Fall back to glow effect with magic colors
      try {
        // Get object world position
        const position = new THREE.Vector3();
        object.mesh.getWorldPosition(position);

        // Create a glow effect with magic colors
        const effectData = this.shaderEffectsManager.createPropGlowEffect(
          object.mesh, // Use the actual mesh as the target
          {
            color: 0x6633ff, // Purple magic color
            intensity: 0.8,
            particleCount: 20,
            particleSize: 0.04,
            height: 0.2,
            radius: 0.3,
            blending: THREE.AdditiveBlending
          }
        );

        return effectData;
      } catch (error) {
        console.error("Error creating magic effect:", error);
        return null;
      }
    }

    try {
      // Get object world position
      const position = new THREE.Vector3();
      object.mesh.getWorldPosition(position);

      // Create the effect using ShaderEffectsManager
      const effectData = this.shaderEffectsManager.createMagicEffect(
        object.mesh, // Use the actual mesh as the target
        'medium', // Quality level
        {
          color: 0x6633ff,
          intensity: 0.8,
          particleCount: 20
        }
      );

      return effectData;
    } catch (error) {
      console.error("Error creating magic effect:", error);
      return null;
    }
  }

  /**
   * Update shader effects
   * This is called from the animation loop
   */
  updateEffects() {
    // If shader effects manager has a global update method, call it
    if (this.shaderEffectsManager && typeof this.shaderEffectsManager.update === 'function') {
      this.shaderEffectsManager.update();
    }

    // Update individual object effects
    this.objects.forEach(object => {
      if (object.effect && object.effect.data) {
        // If the effect has its own update method, call it
        if (object.effect.data.update && typeof object.effect.data.update === 'function') {
          object.effect.data.update();
        }

        // Update effect position to follow object
        if (object.effect.data.container) {
          object.effect.data.container.position.copy(object.mesh.position);
        }
      }
    });
  }

  //-------------------------------------------------------
  // History Management
  //-------------------------------------------------------

  /**
   * Add a step to the history
   * @param {string} type - Type of history step
   * @param {Object} data - Step data
   */
  addHistoryStep(type, data) {
    // If we're not at the end of history, remove future steps
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new step
    this.history.push({ type, data });

    // Limit history size
    if (this.history.length > this.maxHistorySteps) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    // Update UI
    this.updateHistoryButtons();
  }

  /**
   * Undo the last action
   */
  undo() {
    if (this.historyIndex < 0) return;

    const step = this.history[this.historyIndex];

    // Apply undo based on step type
    switch (step.type) {
      case 'create':
        // Remove created object
        this.removeObject(step.data.objectIndex);
        break;

      case 'delete':
        // Restore deleted object
        this.restoreObject(step.data.object);
        break;

      case 'material':
        // Restore old material
        this.restoreMaterial(step.data.objectIndex, step.data.oldMaterial);
        break;

      case 'color':
        // Restore old color
        this.restoreColor(step.data.objectIndex, step.data.oldColor);
        break;

      case 'property':
        // Restore old property value
        this.restoreProperty(
          step.data.objectIndex,
          step.data.property,
          step.data.oldValue
        );
        break;

      case 'transform':
        // Restore old transform value
        this.restoreTransform(
          step.data.objectIndex,
          step.data.transformType,
          step.data.axis,
          step.data.oldValue
        );
        break;

      case 'geometry':
        // Restore old geometry parameter
        this.restoreGeometryParameter(
          step.data.objectIndex,
          step.data.parameter,
          step.data.oldValue
        );
        break;

      case 'rename':
        // Restore old name
        this.restoreName(
          step.data.objectIndex,
          step.data.oldName
        );
        break;

        case 'texture':
          // Restore original material properties
          this.restoreMaterialTexture(step.data.objectIndex, null, step.data.originalProps);
          break;
    }

    // Decrement history index
    this.historyIndex--;

    // Update UI
    this.updateHistoryButtons();
  }

  /**
   * Redo the last undone action
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;

    // Increment history index
    this.historyIndex++;

    const step = this.history[this.historyIndex];

    // Apply redo based on step type
    switch (step.type) {
      case 'create':
        // Re-create object
        this.restoreObject(step.data.object);
        break;

      case 'delete':
        // Re-delete object
        this.removeObject(step.data.objectIndex);
        break;

      case 'material':
        // Apply new material
        this.restoreMaterial(step.data.objectIndex, step.data.newMaterial);
        break;

      case 'color':
        // Apply new color
        this.restoreColor(step.data.objectIndex, step.data.newColor);
        break;

      case 'property':
        // Apply new property value
        this.restoreProperty(
          step.data.objectIndex,
          step.data.property,
          step.data.newValue
        );
        break;

      case 'transform':
        // Apply new transform value
        this.restoreTransform(
          step.data.objectIndex,
          step.data.transformType,
          step.data.axis,
          step.data.newValue
        );
        break;

      case 'geometry':
        // Apply new geometry parameter
        this.restoreGeometryParameter(
          step.data.objectIndex,
          step.data.parameter,
          step.data.newValue
        );
        break;

      case 'rename':
        // Apply new name
        this.restoreName(
          step.data.objectIndex,
          step.data.newName
        );
        break;

        case 'texture':
          // Reapply the texture
          this.applyTextureToModel(step.data.textureId, step.data.category, step.data.objectIndex);
          break;

    }

    // Update UI
    this.updateHistoryButtons();
  }

  restoreMaterialTexture(index, textureMap, originalProps) {
    if (index < 0 || index >= this.objects.length) return;
    
    const object = this.objects[index];
    
    // Apply original properties
    if (originalProps) {
        if (originalProps.color) object.material.color.copy(originalProps.color);
        if (originalProps.wireframe !== undefined) object.material.wireframe = originalProps.wireframe;
        if (originalProps.transparent !== undefined) object.material.transparent = originalProps.transparent;
        if (originalProps.opacity !== undefined) object.material.opacity = originalProps.opacity;
        if (originalProps.metalness !== undefined) object.material.metalness = originalProps.metalness;
        if (originalProps.roughness !== undefined) object.material.roughness = originalProps.roughness;
    }
    
    // Clear or set texture map
    object.material.map = textureMap;
    object.material.needsUpdate = true;
    
    // Update UI if this is the selected object
    if (this.selectedObject === index) {
        this.updateMaterialUI(object);
    }
}

  /**
   * Update history button states
   */
  updateHistoryButtons() {
    const undoButton = this.drawer.querySelector('#object-undo');
    const redoButton = this.drawer.querySelector('#object-redo');

    if (undoButton) {
      undoButton.disabled = this.historyIndex < 0;
    }

    if (redoButton) {
      redoButton.disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  /**
  * Restore a previously deleted object
  * @param {Object} objectData - Object data to restore
  */
  restoreObject(objectData) {
    if (!objectData || !this.previewScene) return;

    // Create a new mesh with the same geometry and material
    const mesh = new THREE.Mesh(objectData.geometry, objectData.material);

    // Apply transforms
    if (objectData.position) {
      mesh.position.set(
        objectData.position.x,
        objectData.position.y,
        objectData.position.z
      );
    }

    if (objectData.rotation) {
      mesh.rotation.set(
        objectData.rotation.x,
        objectData.rotation.y,
        objectData.rotation.z
      );
    }

    if (objectData.scale) {
      mesh.scale.set(
        objectData.scale.x,
        objectData.scale.y,
        objectData.scale.z
      );
    }

    // Create the restored object
    const restoredObject = {
      ...objectData,
      mesh: mesh
    };

    // Add to scene
    this.previewScene.add(mesh);

    // Add to objects array
    this.objects.push(restoredObject);

    // Select the restored object
    this.selectObject(this.objects.length - 1);
  }

  /**
   * Restore material for an object
   * @param {number} index - Object index
   * @param {THREE.Material} material - Material to restore
   */
  restoreMaterial(index, material) {
    if (index < 0 || index >= this.objects.length || !material) return;

    const object = this.objects[index];

    // Store old material for proper cleanup
    const oldMaterial = object.mesh.material;

    // Set new material to mesh
    object.mesh.material = material;
    object.material = material;

    // Dispose of old material
    if (oldMaterial && oldMaterial !== material) {
      oldMaterial.dispose();
    }

    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      this.updateMaterialUI(object);
    }
  }

  /**
   * Restore color for an object
   * @param {number} index - Object index
   * @param {number} color - Color to restore (hex format)
   */
  restoreColor(index, color) {
    if (index < 0 || index >= this.objects.length) return;

    const object = this.objects[index];

    // Set color to material
    object.material.color.setHex(color);

    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      const colorPicker = this.drawer.querySelector('#material-color');
      if (colorPicker) {
        colorPicker.value = '#' + object.material.color.getHexString();
      }
    }
  }

  /**
   * Restore property for an object
   * @param {number} index - Object index
   * @param {string} property - Property name
   * @param {any} value - Property value
   */
  restoreProperty(index, property, value) {
    if (index < 0 || index >= this.objects.length) return;

    const object = this.objects[index];

    // Update material property
    object.material[property] = value;

    // Special handling for opacity
    if (property === 'opacity') {
      object.material.transparent = value < 1;
    }

    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      const control = this.drawer.querySelector(`#material-${property}`);
      if (control) {
        if (control.type === 'checkbox') {
          control.checked = value;
        } else {
          control.value = value;
        }
      }
    }
  }

  /**
   * Restore transform for an object
   * @param {number} index - Object index
   * @param {string} transformType - Transform type (position, rotation, scale)
   * @param {string} axis - Axis (x, y, z)
   * @param {number} value - Value to restore
   */
  restoreTransform(index, transformType, axis, value) {

    if (index < 0 || index >= this.objects.length) return;
  
    const object = this.objects[index];
    
    // Convert degrees to radians for rotation if it's from the history
    let transformValue = value;
    if (transformType === 'rotation' && value > Math.PI * 2) {
      // This appears to be degrees, convert to radians
      transformValue = (value * Math.PI) / 180;
    }
    
    // Update object data
    object[transformType][axis] = transformValue;
    
    // Update mesh
    object.mesh[transformType][axis] = transformValue;
    
    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      const slider = this.drawer.querySelector(`#${transformType}-${axis}`);
      if (slider) {
        if (transformType === 'rotation') {
          // Convert back to degrees for the UI
          slider.value = (transformValue * 180) / Math.PI;
        } else {
          slider.value = transformValue;
        }
      }
    }
  }

  /**
   * Restore geometry parameter
   * @param {number} index - Object index
   * @param {string} parameter - Parameter name
   * @param {number} value - Value to restore
   */
  restoreGeometryParameter(index, parameter, value) {
    if (index < 0 || index >= this.objects.length) return;

    const object = this.objects[index];

    // Update parameter
    object.parameters[parameter] = value;

    // Recreate geometry
    this.recreateGeometry(object);

    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      const slider = this.drawer.querySelector(`#property-${parameter}`);
      if (slider) {
        slider.value = value;
      }
    }
  }

  /**
   * Restore name for an object
   * @param {number} index - Object index
   * @param {string} name - Name to restore
   */
  restoreName(index, name) {
    if (index < 0 || index >= this.objects.length) return;

    const object = this.objects[index];

    // Update name
    object.name = name;

    // Update UI if this is the selected object
    if (this.selectedObject === index) {
      const nameInput = this.drawer.querySelector('#object-name');
      if (nameInput) {
        nameInput.value = name;
      }
    }
  }

  //-------------------------------------------------------
  // Object Management
  //-------------------------------------------------------

  /**
   * Duplicate the selected object
   */
  duplicateSelectedObject() {
    if (this.selectedObject === null) return;

    const originalObject = this.objects[this.selectedObject];

    // Clone the geometry
    let newGeometry;
    switch (originalObject.type) {
      case 'cube':
        newGeometry = new THREE.BoxGeometry(
          originalObject.parameters.width,
          originalObject.parameters.height,
          originalObject.parameters.depth,
          originalObject.parameters.widthSegments,
          originalObject.parameters.heightSegments,
          originalObject.parameters.depthSegments
        );
        break;

      case 'sphere':
        newGeometry = new THREE.SphereGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.widthSegments,
          originalObject.parameters.heightSegments
        );
        break;

      case 'cylinder':
        newGeometry = new THREE.CylinderGeometry(
          originalObject.parameters.radiusTop,
          originalObject.parameters.radiusBottom,
          originalObject.parameters.height,
          originalObject.parameters.radialSegments
        );
        break;

      case 'cone':
        newGeometry = new THREE.ConeGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.height,
          originalObject.parameters.radialSegments
        );
        break;

      case 'torus':
        newGeometry = new THREE.TorusGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.tube,
          originalObject.parameters.radialSegments,
          originalObject.parameters.tubularSegments
        );
        break;

      case 'tetrahedron':
        newGeometry = new THREE.TetrahedronGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.detail
        );
        break;

      case 'octahedron':
        newGeometry = new THREE.OctahedronGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.detail
        );
        break;

      case 'dodecahedron':
        newGeometry = new THREE.DodecahedronGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.detail
        );
        break;

      case 'icosahedron':
        newGeometry = new THREE.IcosahedronGeometry(
          originalObject.parameters.radius,
          originalObject.parameters.detail
        );
        break;

      case 'd10':
        newGeometry = new THREE.CylinderGeometry(
          0,
          originalObject.parameters.radius,
          originalObject.parameters.height,
          originalObject.parameters.segments,
          1
        );
        // Customize vertices for d10 shape
        const vertices = newGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
          if (vertices[i + 1] < 0) {
            vertices[i] *= 0.6;
            vertices[i + 2] *= 0.6;
          }
        }
        newGeometry.attributes.position.needsUpdate = true;
        break;

      case 'plane':
        newGeometry = new THREE.PlaneGeometry(
          originalObject.parameters.width,
          originalObject.parameters.height,
          originalObject.parameters.widthSegments,
          originalObject.parameters.heightSegments
        );
        break;

      default:
        console.warn(`Cannot duplicate unknown geometry type: ${originalObject.type}`);
        return;
    }

    // Clone the material
    let newMaterial;
    if (originalObject.material instanceof THREE.MeshBasicMaterial) {
      newMaterial = new THREE.MeshBasicMaterial();
    } else if (originalObject.material instanceof THREE.MeshStandardMaterial) {
      newMaterial = new THREE.MeshStandardMaterial();
    } else if (originalObject.material instanceof THREE.MeshPhongMaterial) {
      newMaterial = new THREE.MeshPhongMaterial();
    } else if (originalObject.material instanceof THREE.MeshLambertMaterial) {
      newMaterial = new THREE.MeshLambertMaterial();
    } else {
      newMaterial = new THREE.MeshStandardMaterial();
    }

    // Copy material properties
    newMaterial.color.copy(originalObject.material.color);
    newMaterial.wireframe = originalObject.material.wireframe || false;
    newMaterial.transparent = originalObject.material.transparent || false;
    newMaterial.opacity = originalObject.material.opacity !== undefined ? originalObject.material.opacity : 1;

    if (newMaterial instanceof THREE.MeshStandardMaterial) {
      newMaterial.roughness = originalObject.material.roughness !== undefined ? originalObject.material.roughness : 0.5;
      newMaterial.metalness = originalObject.material.metalness !== undefined ? originalObject.material.metalness : 0;
    }

    // Create new mesh
    const newMesh = new THREE.Mesh(newGeometry, newMaterial);

    // Copy transforms with slight offset
    const offset = 0.5; // Offset to make the duplicate visible
    newMesh.position.set(
      originalObject.position.x + offset,
      originalObject.position.y,
      originalObject.position.z + offset
    );

    newMesh.rotation.set(
      originalObject.rotation.x,
      originalObject.rotation.y,
      originalObject.rotation.z
    );

    newMesh.scale.set(
      originalObject.scale.x,
      originalObject.scale.y,
      originalObject.scale.z
    );

    // Create new object data
    const newObject = {
      type: originalObject.type,
      name: `${originalObject.name} (copy)`,
      geometry: newGeometry,
      material: newMaterial,
      mesh: newMesh,
      parameters: { ...originalObject.parameters },
      position: {
        x: originalObject.position.x + offset,
        y: originalObject.position.y,
        z: originalObject.position.z + offset
      },
      rotation: { ...originalObject.rotation },
      scale: { ...originalObject.scale }
    };

    // Add to scene
    this.previewScene.add(newMesh);

    // Add to objects array
    this.objects.push(newObject);

    // Select the new object
    this.selectObject(this.objects.length - 1);

    // Add to history
    this.addHistoryStep('create', {
      objectIndex: this.objects.length - 1,
      object: newObject
    });

    this.updateObjectsList();


    console.log(`Duplicated object: ${originalObject.name}`);
  }

  /**
   * Delete the selected object
   */
  deleteSelectedObject() {
    if (this.selectedObject === null) return;

    // Add to history before removing
    this.addHistoryStep('delete', {
      objectIndex: this.selectedObject,
      object: this.objects[this.selectedObject]
    });

    // Remove the object
    this.removeObject(this.selectedObject);
    this.updateObjectsList();
  }


  /**
   * Update transform for the selected object
   * @param {string} transformType - 'position', 'rotation', or 'scale'
   * @param {string} axis - 'x', 'y', or 'z'
   * @param {number} value - New value
   */
  updateTransform(transformType, axis, value) {
    // if (this.selectedObject === null) return;

    // const object = this.objects[this.selectedObject];
    // const oldValue = object[transformType][axis];
    // const newValue = parseFloat(value);

    // // Update object data
    // object[transformType][axis] = newValue;

    // // Update mesh
    // switch (transformType) {
    //   case 'position':
    //     object.mesh.position[axis] = newValue;
    //     break;
    //   case 'rotation':
    //     object.mesh.rotation[axis] = newValue;
    //     break;
    //   case 'scale':
    //     object.mesh.scale[axis] = newValue;
    //     break;
    // }

    // // Add to history
    // this.addHistoryStep('transform', {
    //   objectIndex: this.selectedObject,
    //   transformType,
    //   axis,
    //   oldValue,
    //   newValue
    // });

    if (this.selectedObject === null) return;
  
    const object = this.objects[this.selectedObject];
    const oldValue = object[transformType][axis];
    let newValue = parseFloat(value);
    
    // Convert degrees to radians for rotation
    if (transformType === 'rotation') {
      newValue = (newValue * Math.PI) / 180; // Convert to radians
    }
    
    // Update object data
    object[transformType][axis] = newValue;
    
    // Update mesh
    switch (transformType) {
      case 'position':
        object.mesh.position[axis] = newValue;
        break;
      case 'rotation':
        object.mesh.rotation[axis] = newValue;
        break;
      case 'scale':
        object.mesh.scale[axis] = newValue;
        break;
    }
    
    // Add to history
    this.addHistoryStep('transform', {
      objectIndex: this.selectedObject,
      transformType,
      axis,
      oldValue,
      newValue
    });
  }

  //-------------------------------------------------------
  // Project Management
  //-------------------------------------------------------

  /**
   * Create a new project
   */
  newProject() {
    // Confirm with user if there are existing objects
    if (this.objects.length > 0) {
      const confirm = window.confirm('Create a new project? All unsaved changes will be lost.');
      if (!confirm) return;
    }

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

    // Reset project name
    const projectNameInput = this.drawer.querySelector('#project-name');
    if (projectNameInput) {
      projectNameInput.value = 'Untitled Project';
    }

    // Update UI
    this.updatePropertyPanels(null);
    this.updateHistoryButtons();
    this.updateObjectsList();

    console.log('Created new project');
  }

  /**
   * Save the current project
   */
  saveProject() {

    const projectNameInput = this.drawer.querySelector('#project-name');
    const projectName = (projectNameInput?.value || 'Untitled Project').trim();

    // Create file name dialog
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Save Project';

    dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <sl-input id="export-filename" label="File Name" value="${projectName}.shapeforge.json"></sl-input>
        <p>This will save your project as a .shapeforge.json file that can be loaded back into ShapeForge.</p>
      </div>
      <div slot="footer">
        <sl-button id="save-btn" variant="primary">Save</sl-button>
        <sl-button variant="neutral" class="close-dialog">Cancel</sl-button>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#save-btn').addEventListener('click', () => {
      const filename = dialog.querySelector('#export-filename').value.trim();
      if (!filename) return;

      // Create JSON representation of the project
      const projectData = this.createProjectData();

      // Create a blob and download it
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(url);
      dialog.hide();

      // Show success message
      const toast = document.createElement('sl-alert');
      toast.variant = 'success';
      toast.duration = 3000;
      toast.closable = true;
      toast.innerHTML = `Project saved as ${filename}`;

      document.body.appendChild(toast);
      toast.toast();
    });

    dialog.querySelector('.close-dialog').addEventListener('click', () => {
      dialog.hide();
    });

    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });

    dialog.show();
  }

  /**
   * Load a project from a file
   */
  loadProject() {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.shapeforge.json';

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);
          this.loadProjectData(projectData);
        } catch (error) {
          console.error('Error loading project:', error);
          alert('Failed to load project: ' + error.message);
        }
      };

      reader.readAsText(file);
    });

    fileInput.click();
  }

  /**
   * Create JSON data for the current project
   * @returns {Object} Project data
   */

  createProjectData() {

    // Get project name
    const projectNameInput = this.drawer.querySelector('#project-name');
    const projectName = (projectNameInput?.value || 'Untitled Project').trim();

    // Create thumbnail
    const thumbnail = this.createThumbnail();

    // Create object data with detailed effect information
    const objectsData = this.objects.map(obj => {
      // Basic object info
      const objData = {
        type: obj.type,
        name: obj.name,
        parameters: obj.parameters,
        position: { ...obj.position },
        rotation: { ...obj.rotation },
        scale: { ...obj.scale }
      };

      // Material info
      if (obj.material) {
        objData.material = {
          type: this.getMaterialType(obj.material),
          color: obj.material.color?.getHex() || 0x3388ff,
          wireframe: obj.material.wireframe || false,
          transparent: obj.material.transparent || false,
          opacity: obj.material.opacity !== undefined ? obj.material.opacity : 1,
          metalness: obj.material.metalness !== undefined ? obj.material.metalness : 0,
          roughness: obj.material.roughness !== undefined ? obj.material.roughness : 0.5
        };
      }

      // NEW: Save geometry data for merged objects
      if (obj.type === 'merged' && obj.geometry) {
        const geometry = obj.geometry;
        const geometryData = {
          vertices: [],
          normals: [],
          uvs: [],
          indices: []
        };

        // Save position (vertex) data
        if (geometry.attributes.position) {
          const positions = geometry.attributes.position.array;
          for (let i = 0; i < positions.length; i++) {
            geometryData.vertices.push(positions[i]);
          }
        }

        // Save normal data
        if (geometry.attributes.normal) {
          const normals = geometry.attributes.normal.array;
          for (let i = 0; i < normals.length; i++) {
            geometryData.normals.push(normals[i]);
          }
        }

        // Save UV data
        if (geometry.attributes.uv) {
          const uvs = geometry.attributes.uv.array;
          for (let i = 0; i < uvs.length; i++) {
            geometryData.uvs.push(uvs[i]);
          }
        }

        // Save index data
        if (geometry.index) {
          const indices = geometry.index.array;
          for (let i = 0; i < indices.length; i++) {
            geometryData.indices.push(indices[i]);
          }
        }

        // Add geometry data to object data
        objData.geometryData = geometryData;
      }

      // Enhanced shader effect info
      if (obj.effect) {
        // Create effect data object
        const effectData = {
          type: obj.effect.type,
          parameters: {} // Will hold effect parameters
        };

        // Extract parameters from effect data
        if (obj.effect.data) {
          // Get light properties if available
          if (obj.effect.data.light) {
            effectData.parameters.color = obj.effect.data.light.color.getHex();
            effectData.parameters.intensity = obj.effect.data.light.intensity;
            effectData.parameters.distance = obj.effect.data.light.distance;
          }

          // Get particle properties if available
          if (obj.effect.data.particles) {
            // Try to determine particle count
            if (obj.effect.data.particles.geometry &&
              obj.effect.data.particles.geometry.attributes &&
              obj.effect.data.particles.geometry.attributes.position) {
              effectData.parameters.particleCount =
                obj.effect.data.particles.geometry.attributes.position.count;
            }

            // Get particle size
            if (obj.effect.data.particles.material) {
              effectData.parameters.particleSize = obj.effect.data.particles.material.size;
            }
          }

          // Get animation data if available
          if (obj.effect.data.animationData) {
            effectData.parameters.speed = obj.effect.data.animationData.speed;
            if (obj.effect.data.animationData.pattern) {
              effectData.parameters.pattern = obj.effect.data.animationData.pattern;
            }
          }
        }

        objData.effect = effectData;
      }

      return objData;
    });

    // Create project data
    const projectData = {
      name: projectName,
      version: '1.2', // Bump version for merged geometry support
      created: new Date().toISOString(),
      thumbnail: thumbnail,
      objects: objectsData
    };

    return projectData;
  };


  /**
   * Load a project from data
   * @param {Object} projectData - Project data
   */
  loadProjectData(projectData) {
    // Validate project data
    if (!projectData || !projectData.objects || !Array.isArray(projectData.objects)) {
      throw new Error('Invalid project data');
    }

    // Clear current project
    this.newProject();

    // Set project name
    const projectNameInput = this.drawer.querySelector('#project-name');
    if (projectNameInput && projectData.name) {
      projectNameInput.value = projectData.name;
    }

    // Load objects
    projectData.objects.forEach(objData => {
      this.createObjectFromData(objData);
    });

    this.updateObjectsList();
    console.log(`Loaded project "${projectData.name}" with ${projectData.objects.length} objects`);
  }

  /**
   * Create an object from saved data
   * @param {Object} objData - Object data
   */
  createObjectFromData(objData) {
    // Create geometry based on type
    let geometry;
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

    // Create material
    let material;
    if (objData.material) {
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

    // Add to scene (without history step)
    this.previewScene.add(mesh);

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

    return objectData;
  }

  /**
   * Create a thumbnail of the current scene
   * @returns {string} Base64 thumbnail
   */
  createThumbnail() {
    if (!this.previewRenderer || !this.previewScene || !this.previewCamera) {
      return '';
    }

    // Save current renderer size
    const originalWidth = this.previewRenderer.domElement.width;
    const originalHeight = this.previewRenderer.domElement.height;

    // Set to thumbnail size
    this.previewRenderer.setSize(300, 200);

    // Render scene
    this.previewRenderer.render(this.previewScene, this.previewCamera);

    // Get base64 image
    const thumbnail = this.previewRenderer.domElement.toDataURL('image/png');

    // Restore original size
    this.previewRenderer.setSize(originalWidth, originalHeight);

    return thumbnail;
  }

  /**
   * Determine material type
   * @param {THREE.Material} material - Material to check
   * @returns {string} Material type name
   */
  getMaterialType(material) {
    if (material instanceof THREE.MeshBasicMaterial) return 'MeshBasicMaterial';
    if (material instanceof THREE.MeshStandardMaterial) return 'MeshStandardMaterial';
    if (material instanceof THREE.MeshPhongMaterial) return 'MeshPhongMaterial';
    if (material instanceof THREE.MeshLambertMaterial) return 'MeshLambertMaterial';
    return 'MeshStandardMaterial';
  }

  /**
   * Save object to resource manager
   */
  // saveToResources() {
  //   if (!this.resourceManager) {
  //     alert("ResourceManager not available. Cannot save to resources.");
  //     return;
  //   }

  //   // Get project name
  //   const projectNameInput = this.drawer.querySelector('#project-name');
  //   const projectName = (projectNameInput?.value || 'Untitled Project').trim();

  //   // Create dialog for saving
  //   const dialog = document.createElement('sl-dialog');
  //   dialog.label = 'Save to ResourceManager';

  //   dialog.innerHTML = `
  //     <div style="display: flex; flex-direction: column; gap: 16px;">
  //       <sl-input id="resource-name" label="Name" value="${projectName}"></sl-input>
  //       <div style="display: flex; align-items: center; gap: 10px;">
  //         <div style="width: 150px; height: 100px; border: 1px solid #444; overflow: hidden;">
  //           <img id="resource-thumbnail" style="width: 100%; height: 100%; object-fit: contain;" />
  //         </div>
  //         <div>
  //           <p>Preview thumbnail</p>
  //           <p style="font-size: 0.8em; color: #aaa;">This will be shown in ResourceManager</p>
  //         </div>
  //       </div>
  //     </div>
  //     <div slot="footer">
  //       <sl-button id="save-btn" variant="primary">Save</sl-button>
  //       <sl-button variant="neutral" class="close-dialog">Cancel</sl-button>
  //     </div>
  //   `;

  //   document.body.appendChild(dialog);

  //   // Generate and set thumbnail
  //   const thumbnail = this.createThumbnail();
  //   dialog.querySelector('#resource-thumbnail').src = thumbnail;

  //   // Save handler
  //   dialog.querySelector('#save-btn').addEventListener('click', () => {
  //     const name = dialog.querySelector('#resource-name').value.trim();
  //     if (!name) {
  //       alert("Please enter a name for this resource");
  //       return;
  //     }

  //     // Create JSON representation of the project
  //     const projectData = this.createProjectData();

  //     // Make sure shapeforge category exists in resources
  //     if (!this.resourceManager.resources.shapeforge) {
  //       this.resourceManager.resources.shapeforge = {};
  //     }

  //     // Create resource entry
  //     const resourceId = `shapeforge_${Date.now()}`;
  //     const resource = {
  //       id: resourceId,
  //       name: name,
  //       data: JSON.stringify(projectData),
  //       thumbnail: thumbnail,
  //       dateAdded: new Date().toISOString()
  //     };

  //     // Add to ResourceManager
  //     this.resourceManager.resources.shapeforge[resourceId] = resource;
  //     this.resourceManager.saveResources();

  //     dialog.hide();

  //     // Show success message
  //     const toast = document.createElement('sl-alert');
  //     toast.variant = 'success';
  //     toast.duration = 3000;
  //     toast.closable = true;
  //     toast.innerHTML = `Saved "${name}" to ResourceManager`;

  //     document.body.appendChild(toast);
  //     toast.toast();
  //   });

  //   dialog.querySelector('.close-dialog').addEventListener('click', () => {
  //     dialog.hide();
  //   });

  //   dialog.addEventListener('sl-after-hide', () => {
  //     dialog.remove();
  //   });

  //   dialog.show();
  // }

  saveToResources() {
    if (!this.resourceManager) {
        alert("ResourceManager not available. Cannot save to resources.");
        return;
    }
    
    // Get project name
    const projectNameInput = this.drawer.querySelector('#project-name');
    const projectName = (projectNameInput?.value || 'Untitled Project').trim();
    
    // Create dialog for saving
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Save to ResourceManager';
    
    dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <sl-input id="resource-name" label="Name" value="${projectName}"></sl-input>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 150px; height: 100px; border: 1px solid #444; overflow: hidden;">
                    <img id="resource-thumbnail" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
                <div>
                    <p>Preview thumbnail</p>
                    <p style="font-size: 0.8em; color: #aaa;">This will be shown in ResourceManager</p>
                </div>
            </div>
        </div>
        <div slot="footer">
            <sl-button id="save-btn" variant="primary">Save</sl-button>
            <sl-button variant="neutral" class="close-dialog">Cancel</sl-button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Generate and set thumbnail
    const thumbnail = this.createThumbnail();
    dialog.querySelector('#resource-thumbnail').src = thumbnail;
    
    // Save handler
    dialog.querySelector('#save-btn').addEventListener('click', () => {
        const name = dialog.querySelector('#resource-name').value.trim();
        if (!name) {
            alert("Please enter a name for this resource");
            return;
        }
        
        // Create JSON representation of the project
        const projectData = this.createProjectData();
        
        // Make sure shapeforge category exists in resources
        if (!this.resourceManager.resources.shapeforge) {
            this.resourceManager.resources.shapeforge = new Map();
        }
        
        // Create resource entry
        const resourceId = `model_${Date.now()}`;
        const resource = {
            id: resourceId,
            name: name,
            data: projectData,
            thumbnail: thumbnail,
            dateAdded: new Date().toISOString()
        };
        
        // Add to ResourceManager
        this.resourceManager.resources.shapeforge.set(resourceId, resource);
        
        dialog.hide();
        
        // Show success message
        const toast = document.createElement('sl-alert');
        toast.variant = 'success';
        toast.duration = 3000;
        toast.closable = true;
        toast.innerHTML = `Saved "${name}" to ResourceManager`;
        
        document.body.appendChild(toast);
        toast.toast();
    });
    
    dialog.querySelector('.close-dialog').addEventListener('click', () => {
        dialog.hide();
    });
    
    dialog.addEventListener('sl-after-hide', () => {
        dialog.remove();
    });
    
    dialog.show();
}

// Method to list available textures from ResourceManager
// Method to list available textures from ResourceManager
// listAvailableTextures(category) {
//   console.log(`Attempting to list textures for category: ${category}`);
  
//   if (!this.resourceManager) {
//       console.warn("ResourceManager not available. Cannot list textures.");
//       return [];
//   }
  
//   // Check if textures object exists
//   if (!this.resourceManager.resources || !this.resourceManager.resources.textures) {
//       console.warn("ResourceManager.resources.textures not available:", this.resourceManager.resources);
//       return [];
//   }
  
//   // Get texture map for the requested category
//   const textureMap = this.resourceManager.resources.textures[category];
//   console.log(`Texture map for ${category}:`, textureMap);
  
//   if (!textureMap) {
//       console.warn(`Texture category '${category}' not found in ResourceManager`);
//       return [];
//   }
  
//   // Check if it's a Map (expected) or potentially another structure
//   let textureArray = [];
  
//   if (textureMap instanceof Map) {
//       // It's a Map as expected, convert to array
//       textureArray = Array.from(textureMap.values());
//   } else if (typeof textureMap === 'object') {
//       // It might be a plain object, try to convert
//       textureArray = Object.values(textureMap);
//   }
  
//   console.log(`Found ${textureArray.length} textures in category: ${category}`);
//   return textureArray;
// }

// Alternative texture finding method for when resource manager integration fails
findTexturesInWindow() {
  // Look for window.resourceManager
  if (window.resourceManager && window.resourceManager.resources && 
      window.resourceManager.resources.textures) {
      
      return {
          connected: true,
          resourceManager: window.resourceManager
      };
  }
  
  // Look for window.mapEditor.resourceManager
  if (window.mapEditor && window.mapEditor.resourceManager && 
      window.mapEditor.resourceManager.resources && 
      window.mapEditor.resourceManager.resources.textures) {
      
      return {
          connected: true,
          resourceManager: window.mapEditor.resourceManager
      };
  }
  
  // Look in scene3D if available
  if (window.scene3D && window.scene3D.resourceManager && 
      window.scene3D.resourceManager.resources && 
      window.scene3D.resourceManager.resources.textures) {
      
      return {
          connected: true,
          resourceManager: window.scene3D.resourceManager
      };
  }
  
  return { connected: false };
}

// Modified version of listAvailableTextures that uses findTexturesInWindow() if needed
listAvailableTextures(category) {
  // Try the normal route first
  if (this.resourceManager &&
      this.resourceManager.resources &&
      this.resourceManager.resources.textures &&
      this.resourceManager.resources.textures[category]) {
      
      const textureMap = this.resourceManager.resources.textures[category];
      if (textureMap instanceof Map) {
          return Array.from(textureMap.values());
      } else if (typeof textureMap === 'object') {
          return Object.values(textureMap);
      }
  }
  
  // If we get here, try the alternative method
  console.warn("Using alternative texture finding method");
  const result = this.findTexturesInWindow();
  
  if (result.connected) {
      // Temporarily connect and return textures
      const tempResourceManager = result.resourceManager;
      
      const textureMap = tempResourceManager.resources.textures[category];
      if (!textureMap) {
          console.warn(`Category ${category} not found in resourceManager`);
          return [];
      }
      
      if (textureMap instanceof Map) {
          return Array.from(textureMap.values());
      } else if (typeof textureMap === 'object') {
          return Object.values(textureMap);
      }
  }
  
  // If all else fails
  console.error(`Failed to find any textures for category: ${category}`);
  return [];
}

// applyTextureToModel(textureId, category, objectIndex) {
//   if (!this.resourceManager || this.selectedObject === null) {
//       console.warn("Cannot apply texture: ResourceManager unavailable or no object selected");
//       return false;
//   }
  
//   // Get the texture
//   const texture = this.resourceManager.resources.textures[category]?.get(textureId);
//   if (!texture) {
//       console.warn(`Texture not found: ${textureId} in category ${category}`);
//       return false;
//   }
  
//   // Get the object
//   const object = this.objects[objectIndex];
//   if (!object) {
//       console.warn(`Object not found at index ${objectIndex}`);
//       return false;
//   }
  
//   // Create a Three.js texture from the texture data
//   const loader = new THREE.TextureLoader();
  
//   // We need to create a data URL if it's not already one
//   const textureUrl = texture.data;
  
//   // Load the texture
//   const threeTexture = loader.load(textureUrl, (loadedTexture) => {
//       // Once loaded, apply it to the material
//       if (object.material) {
//           // Store original material properties
//           const originalProps = {
//               color: object.material.color.clone(),
//               wireframe: object.material.wireframe,
//               transparent: object.material.transparent,
//               opacity: object.material.opacity,
//               metalness: object.material.metalness,
//               roughness: object.material.roughness
//           };
          
//           // Apply texture to material
//           object.material.map = loadedTexture;
//           object.material.needsUpdate = true;
          
//           // Add to history
//           this.addHistoryStep('texture', {
//               objectIndex: objectIndex,
//               textureId: textureId,
//               category: category,
//               originalProps: originalProps
//           });
          
//           // Update material UI
//           this.updateMaterialUI(object);
//       }
//   });
  
//   return true;
// }

// Method to apply a texture to a model
applyTextureToModel(textureId, category, objectIndex) {
  if (!this.resourceManager || objectIndex === null) {
      console.warn("Cannot apply texture: ResourceManager unavailable or no object selected");
      return false;
  }
  
  // Get the texture
  const texture = this.resourceManager.resources.textures[category]?.get(textureId);
  if (!texture) {
      console.warn(`Texture not found: ${textureId} in category ${category}`);
      return false;
  }
  
  // Get the object
  const object = this.objects[objectIndex];
  if (!object) {
      console.warn(`Object not found at index ${objectIndex}`);
      return false;
  }
  
  // Create a Three.js texture from the texture data
  const loader = new THREE.TextureLoader();
  
  // We need to create a data URL if it's not already one
  const textureUrl = texture.data;
  
  // Load the texture
  const threeTexture = loader.load(textureUrl, (loadedTexture) => {
      // Once loaded, apply it to the material
      if (object.material) {
          // Store original material properties
          const originalProps = {
              color: object.material.color.clone(),
              wireframe: object.material.wireframe,
              transparent: object.material.transparent,
              opacity: object.material.opacity,
              metalness: object.material.metalness,
              roughness: object.material.roughness
          };
          
          // Apply texture to material
          object.material.map = loadedTexture;
          
          // Set color to white to avoid tinting the texture
          object.material.color.set(0xffffff00);
          
          // Make sure the texture is displayed properly
          object.material.needsUpdate = true;
          
          // Add to history
          this.addHistoryStep('texture', {
              objectIndex: objectIndex,
              textureId: textureId,
              category: category,
              originalProps: originalProps
          });
          
          // Update material UI
          this.updateMaterialUI(object);
      }
  });
  
  return true;
}

// Show texture selection dialog for the selected object
// Show texture selection dialog for the selected object
showTextureSelectionDialog() {
  if (!this.resourceManager || this.selectedObject === null) {
      alert("Cannot apply texture: ResourceManager unavailable or no object selected");
      return;
  }
  
  // Create dialog
  const dialog = document.createElement('sl-dialog');
  dialog.label = 'Apply Texture to Model';
  dialog.style = "--width: 650px;"; // Make it a bit wider for the textures
  
  // Prepare dialog content with tabs instead of dropdown
  dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Texture Category Tabs -->
          <sl-tab-group>
              <sl-tab slot="nav" panel="walls-panel">Walls</sl-tab>
              <sl-tab slot="nav" panel="doors-panel">Doors</sl-tab>
              <sl-tab slot="nav" panel="environmental-panel">Environmental</sl-tab>
              <sl-tab slot="nav" panel="props-panel">Props</sl-tab>
              
              <!-- Walls Panel -->
              <sl-tab-panel name="walls-panel">
                  <div class="texture-gallery" data-category="walls">
                      <div class="loading-placeholder">Loading textures...</div>
                  </div>
              </sl-tab-panel>
              
              <!-- Doors Panel -->
              <sl-tab-panel name="doors-panel">
                  <div class="texture-gallery" data-category="doors">
                      <div class="loading-placeholder">Loading textures...</div>
                  </div>
              </sl-tab-panel>
              
              <!-- Environmental Panel -->
              <sl-tab-panel name="environmental-panel">
                  <div class="texture-gallery" data-category="environmental">
                      <div class="loading-placeholder">Loading textures...</div>
                  </div>
              </sl-tab-panel>
              
              <!-- Props Panel -->
              <sl-tab-panel name="props-panel">
                  <div class="texture-gallery" data-category="props">
                      <div class="loading-placeholder">Loading textures...</div>
                  </div>
              </sl-tab-panel>
          </sl-tab-group>
          
          <!-- Preview Area -->
          <div id="texture-preview" style="display: none; text-align: center; padding: 10px; background: #f5f5f5; border-radius: 4px;">
              <img style="max-width: 200px; max-height: 200px; object-fit: contain;" />
              <div class="preview-name" style="margin-top: 8px; font-weight: bold;"></div>
          </div>
      </div>
      
      <div slot="footer">
          <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
          <sl-button variant="primary" class="apply-btn" disabled>Apply Texture</sl-button>
      </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Get references to elements
  const tabGroup = dialog.querySelector('sl-tab-group');
  const textureGalleries = dialog.querySelectorAll('.texture-gallery');
  const texturePreview = dialog.querySelector('#texture-preview');
  const applyBtn = dialog.querySelector('.apply-btn');
  
  // Selected texture tracking
  let selectedTextureId = null;
  let selectedCategory = 'walls';
  
  // Load textures for a category
  const loadTextures = (galleryEl) => {
      const category = galleryEl.dataset.category;
      galleryEl.innerHTML = '<div class="loading-placeholder">Loading textures...</div>';
      
      // Get textures for this category
      const textures = this.listAvailableTextures(category);
      
      if (!textures || textures.length === 0) {
          galleryEl.innerHTML = `
              <div class="empty-message" style="text-align: center; padding: 20px; color: #666;">
                  No textures found in ${category} category
              </div>
          `;
          return;
      }
      
      // Clear gallery
      galleryEl.innerHTML = '';
      
      // Create container for grid layout
      const gridContainer = document.createElement('div');
      gridContainer.style.cssText = `
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
          padding: 10px;
      `;
      galleryEl.appendChild(gridContainer);
      
      // Add each texture to the gallery
      textures.forEach(texture => {
          const item = document.createElement('div');
          item.className = 'texture-item';
          item.dataset.textureId = texture.id;
          item.dataset.category = category;
          item.style.cssText = `
              cursor: pointer;
              border: 2px solid transparent;
              border-radius: 4px;
              overflow: hidden;
              transition: all 0.2s ease;
              background: white;
          `;
          
          item.innerHTML = `
              <img src="${texture.thumbnail}" alt="${texture.name}" 
                   style="width: 100%; aspect-ratio: 1; object-fit: cover;" />
              <div style="font-size: 0.8em; padding: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${texture.name}
              </div>
          `;
          
          // Handle selection
          item.addEventListener('click', () => {
              // Update selection visuals - clear all selected items first
              dialog.querySelectorAll('.texture-item').forEach(el => {
                  el.style.borderColor = 'transparent';
                  el.style.transform = 'none';
              });
              
              // Mark this item as selected
              item.style.borderColor = '#3388ff';
              item.style.transform = 'translateY(-2px)';
              
              // Store selected texture
              selectedTextureId = texture.id;
              selectedCategory = category;
              
              // Update preview
              texturePreview.style.display = 'block';
              texturePreview.querySelector('img').src = texture.data;
              texturePreview.querySelector('.preview-name').textContent = texture.name;
              
              // Enable apply button
              applyBtn.disabled = false;
          });
          
          gridContainer.appendChild(item);
      });
  };
  
  // Load textures for all galleries when tabs are activated
  tabGroup.addEventListener('sl-tab-show', (event) => {
      const panelName = event.detail.name;
      const category = panelName.split('-')[0]; // Extract category from panel name
      
      // Find the gallery for this panel
      const gallery = dialog.querySelector(`.texture-gallery[data-category="${category}"]`);
      
      // Only load if not already loaded
      if (gallery && gallery.querySelector('.texture-item') === null && 
          !gallery.querySelector('.empty-message')) {
          loadTextures(gallery);
      }
  });
  
  // Handle apply button
  applyBtn.addEventListener('click', () => {
      if (selectedTextureId && selectedCategory) {
          this.applyTextureToModel(selectedTextureId, selectedCategory, this.selectedObject);
          dialog.hide();
      }
  });
  
  // Handle cancel
  dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.hide();
  });
  
  // Clean up when dialog closes
  dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
  });
  
  // Load initial textures for the first tab and show dialog
  loadTextures(textureGalleries[0]); // Load the first category (walls)
  dialog.show();
}

  /**
   * Show export dialog
   */
  showExportDialog() {
    if (this.selectedObject === null) return;

    const code = this.generateCode();

    // Create dialog
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Export Three.js Code';

    // Add content
    dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 400px;">
        <p>Copy this code to use in your Three.js application:</p>
        <pre style="flex: 1; overflow: auto; background: #1e1e1e; color: #dcdcdc; padding: 10px; border-radius: 4px; font-family: monospace;">${code}</pre>
      </div>
      <div slot="footer">
        <sl-button id="copy-code">Copy Code</sl-button>
        <sl-button variant="neutral" class="close-dialog">Close</sl-button>
      </div>
    `;

    // Add to document
    document.body.appendChild(dialog);

    // Add event listeners
    dialog.querySelector('#copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        // Show success message
        const toast = document.createElement('sl-alert');
        toast.variant = 'success';
        toast.duration = 3000;
        toast.closable = true;
        toast.innerHTML = 'Code copied to clipboard!';

        document.body.appendChild(toast);
        toast.toast();
      });
    });

    dialog.querySelector('.close-dialog').addEventListener('click', () => {
      dialog.hide();
    });

    // Show dialog
    dialog.show();

    // Remove dialog when hidden
    dialog.addEventListener('sl-after-hide', () => {
      dialog.remove();
    });
  }

  /**
   * Generate Three.js code for the selected object
   * @returns {string} Generated code
   */
  generateCode() {
    if (this.selectedObject === null) return '';

    const object = this.objects[this.selectedObject];
    let code = '';

    // Generate geometry code
    switch (object.type) {
      case 'cube':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.BoxGeometry(\n`;
        code += `  ${object.parameters.width}, // width\n`;
        code += `  ${object.parameters.height}, // height\n`;
        code += `  ${object.parameters.depth}, // depth\n`;
        code += `  ${object.parameters.widthSegments}, // widthSegments\n`;
        code += `  ${object.parameters.heightSegments}, // heightSegments\n`;
        code += `  ${object.parameters.depthSegments} // depthSegments\n`;
        code += `);\n\n`;
        break;

      case 'sphere':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.SphereGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.widthSegments}, // widthSegments\n`;
        code += `  ${object.parameters.heightSegments} // heightSegments\n`;
        code += `);\n\n`;
        break;

      case 'cylinder':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.CylinderGeometry(\n`;
        code += `  ${object.parameters.radiusTop}, // radiusTop\n`;
        code += `  ${object.parameters.radiusBottom}, // radiusBottom\n`;
        code += `  ${object.parameters.height}, // height\n`;
        code += `  ${object.parameters.radialSegments} // radialSegments\n`;
        code += `);\n\n`;
        break;

      case 'cone':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.ConeGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.height}, // height\n`;
        code += `  ${object.parameters.radialSegments} // radialSegments\n`;
        code += `);\n\n`;
        break;

      case 'torus':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.TorusGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.tube}, // tube\n`;
        code += `  ${object.parameters.radialSegments}, // radialSegments\n`;
        code += `  ${object.parameters.tubularSegments} // tubularSegments\n`;
        code += `);\n\n`;
        break;

      case 'plane':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.PlaneGeometry(\n`;
        code += `  ${object.parameters.width}, // width\n`;
        code += `  ${object.parameters.height}, // height\n`;
        code += `  ${object.parameters.widthSegments}, // widthSegments\n`;
        code += `  ${object.parameters.heightSegments} // heightSegments\n`;
        code += `);\n\n`;
        break;

      case 'tetrahedron':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.TetrahedronGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.detail} // detail\n`;
        code += `);\n\n`;
        break;

      case 'octahedron':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.OctahedronGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.detail} // detail\n`;
        code += `);\n\n`;
        break;

      case 'dodecahedron':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.DodecahedronGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.detail} // detail\n`;
        code += `);\n\n`;
        break;

      case 'icosahedron':
        code += `// Create geometry\n`;
        code += `const geometry = new THREE.IcosahedronGeometry(\n`;
        code += `  ${object.parameters.radius}, // radius\n`;
        code += `  ${object.parameters.detail} // detail\n`;
        code += `);\n\n`;
        break;

      case 'd10':
        code += `// Create geometry (D10 requires custom vertex manipulation)\n`;
        code += `const geometry = new THREE.CylinderGeometry(0, ${object.parameters.radius}, ${object.parameters.height}, ${object.parameters.segments}, 1);\n`;
        code += `// Adjust vertices to make it more like a D10\n`;
        code += `const vertices = geometry.attributes.position.array;\n`;
        code += `for (let i = 0; i < vertices.length; i += 3) {\n`;
        code += `  if (vertices[i + 1] < 0) { // Bottom vertices\n`;
        code += `    // Scale in slightly to create the pentagonal trapezohedron shape\n`;
        code += `    vertices[i] *= 0.6;\n`;
        code += `    vertices[i + 2] *= 0.6;\n`;
        code += `  }\n`;
        code += `}\n`;
        code += `geometry.attributes.position.needsUpdate = true;\n\n`;
        break;

      default:
        code += `// Unknown geometry type: ${object.type}\n`;
        break;
    }

    // Generate material code
    code += `// Create material\n`;
    if (object.material instanceof THREE.MeshBasicMaterial) {
      code += `const material = new THREE.MeshBasicMaterial({\n`;
      code += `  color: 0x${object.material.color.getHexString()},\n`;
      if (object.material.wireframe) code += `  wireframe: true,\n`;
      if (object.material.transparent) code += `  transparent: true,\n`;
      if (object.material.opacity < 1) code += `  opacity: ${object.material.opacity},\n`;
      code += `});\n\n`;
    } else if (object.material instanceof THREE.MeshStandardMaterial) {
      code += `const material = new THREE.MeshStandardMaterial({\n`;
      code += `  color: 0x${object.material.color.getHexString()},\n`;
      code += `  roughness: ${object.material.roughness},\n`;
      code += `  metalness: ${object.material.metalness},\n`;
      if (object.material.wireframe) code += `  wireframe: true,\n`;
      if (object.material.transparent) code += `  transparent: true,\n`;
      if (object.material.opacity < 1) code += `  opacity: ${object.material.opacity},\n`;
      code += `});\n\n`;
    } else if (object.material instanceof THREE.MeshPhongMaterial) {
      code += `const material = new THREE.MeshPhongMaterial({\n`;
      code += `  color: 0x${object.material.color.getHexString()},\n`;
      if (object.material.wireframe) code += `  wireframe: true,\n`;
      if (object.material.transparent) code += `  transparent: true,\n`;
      if (object.material.opacity < 1) code += `  opacity: ${object.material.opacity},\n`;
      code += `});\n\n`;
    } else if (object.material instanceof THREE.MeshLambertMaterial) {
      code += `const material = new THREE.MeshLambertMaterial({\n`;
      code += `  color: 0x${object.material.color.getHexString()},\n`;
      if (object.material.wireframe) code += `  wireframe: true,\n`;
      if (object.material.transparent) code += `  transparent: true,\n`;
      if (object.material.opacity < 1) code += `  opacity: ${object.material.opacity},\n`;
      code += `});\n\n`;
    }

    // Generate mesh code
    code += `// Create mesh\n`;
    code += `const mesh = new THREE.Mesh(geometry, material);\n`;

    // Add transform code
    code += `\n// Apply transforms\n`;
    code += `mesh.position.set(${object.position.x}, ${object.position.y}, ${object.position.z});\n`;
    code += `mesh.rotation.set(${object.rotation.x}, ${object.rotation.y}, ${object.rotation.z});\n`;
    code += `mesh.scale.set(${object.scale.x}, ${object.scale.y}, ${object.scale.z});\n\n`;

    code += `// Add to scene\n`;
    code += `scene.add(mesh);\n`;

    return code;
  }

  /**
   * Clean up resources when done
   */
  dispose() {
    // Stop animation loop
    this.stopPreview();

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);

    // Dispose of geometries and materials
    this.objects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    // Dispose of renderer
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
    }

    // Remove from DOM
    if (this.drawer && this.drawer.parentNode) {
      this.drawer.parentNode.removeChild(this.drawer);
    }

    // Clear references
    this.objects = [];
    this.selectedObject = null;
    this.previewScene = null;
    this.previewCamera = null;
    this.previewRenderer = null;
    this.previewControls = null;
    this.previewContainer = null;
    this.drawer = null;

    console.log("ShapeForge resources disposed");
  }
}










ShapeForge.prototype.addObjectToScene = function (objectData) {
  if (!this.previewScene) return;

  // Add mesh to scene
  this.previewScene.add(objectData.mesh);

  // Add to objects array
  this.objects.push(objectData);

  // Select this object
  this.selectObject(this.objects.length - 1);

  // Add to history
  this.addHistoryStep('create', {
    objectIndex: this.objects.length - 1,
    object: objectData
  });

  // Update objects list panel if it exists
  if (this.objectsListContainer) {
    this.updateObjectsList();
  }

  console.log(`Added ${objectData.type} to scene`);
};


ShapeForge.prototype.selectObject = function (index) {
  if (index < 0 || index >= this.objects.length) return;

  if (this.multiSelectEnabled) {
    // In multi-select mode, toggle selection
    const selectionIndex = this.selectedObjects.indexOf(index);

    if (selectionIndex === -1) {
      // Add to selection
      this.selectedObjects.push(index);
      console.log(`Added object ${index} to multi-selection`);

      // Highlight the object
      if (this.objects[index].mesh.material &&
        this.objects[index].mesh.material.emissive !== undefined) {
        this.objects[index].mesh.material.emissive = new THREE.Color(0x333333);
      }
    } else {
      // Remove from selection
      this.selectedObjects.splice(selectionIndex, 1);
      console.log(`Removed object ${index} from multi-selection`);

      // Remove highlight
      if (this.objects[index].mesh.material &&
        this.objects[index].mesh.material.emissive !== undefined) {
        this.objects[index].mesh.material.emissive = new THREE.Color(0x000000);
      }
    }

    // Also update single selection for properties panel
    this.selectedObject = index;

    // Update property panels for this object
    this.updatePropertyPanels(this.objects[index]);

    // Update transform controls
    this.updateTransformControls(this.objects[index]);
  } else {
    // Normal single-select behavior
    // Deselect current object
    if (this.selectedObject !== null) {
      const oldObject = this.objects[this.selectedObject];
      if (oldObject && oldObject.mesh) {
        // Remove selection indicator (if we had one)
        if (oldObject.mesh.material && oldObject.mesh.material.emissive !== undefined) {
          oldObject.mesh.material.emissive = new THREE.Color(0x000000);
        }
      }
    }

    // Set new selected object
    this.selectedObject = index;
    const object = this.objects[index];

    // Add selection indicator - highlight the object
    if (object.mesh.material && object.mesh.material.emissive !== undefined) {
      object.mesh.material.emissive = new THREE.Color(0x333333);
    }

    // Update property panels
    this.updatePropertyPanels(object);

    // Update transform controls
    this.updateTransformControls(object);
  }

  // Update objects list in both modes
  this.updateObjectsList();
};

/**
 * Create and show the objects list panel with better styling
 */

ShapeForge.prototype.createObjectsListPanel = function () {
  // Create panel container
  const panel = document.createElement('div');
  panel.className = 'objects-list-panel';
  panel.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      width: 240px;
      max-height: calc(100% - 20px);
      background: rgba(40, 40, 40, 0.9);
      border-radius: 4px;
      padding: 10px;
      color: white;
      font-family: sans-serif;
      font-size: 12px;
      overflow-y: auto;
      z-index: 100;
      border: 1px solid #555;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    `;

  // Add header with title
  const headerRow = document.createElement('div');
  headerRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #555;
    `;

  // Title
  const title = document.createElement('div');
  title.textContent = 'Objects';
  title.style.cssText = `
      font-weight: bold;
      font-size: 14px;
    `;
  headerRow.appendChild(title);

  panel.appendChild(headerRow);

  // Add toolbar with all controls
  const toolbarRow = document.createElement('div');
  toolbarRow.style.cssText = `
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    `;

  // Object actions group
  const objectActions = document.createElement('div');
  objectActions.style.cssText = `
      display: flex;
      gap: 4px;
      margin-right: 2px;
    `;

  // Duplicate button
  const duplicateBtn = document.createElement('sl-button');
  duplicateBtn.id = 'duplicate-object-btn';
  duplicateBtn.setAttribute('size', 'small');
  duplicateBtn.setAttribute('circle', '');
  duplicateBtn.setAttribute('variant', 'warning');
  duplicateBtn.setAttribute('title', 'Duplicate Object');
  duplicateBtn.innerHTML = '<sl-icon name="copy"></sl-icon>';
  duplicateBtn.addEventListener('click', () => this.duplicateSelectedObject());
  objectActions.appendChild(duplicateBtn);

  // Delete button
  const deleteBtn = document.createElement('sl-button');
  deleteBtn.id = 'delete-object-btn';
  deleteBtn.setAttribute('size', 'small');
  deleteBtn.setAttribute('circle', '');
  deleteBtn.setAttribute('variant', 'danger');
  deleteBtn.setAttribute('title', 'Delete Object');
  deleteBtn.innerHTML = '<sl-icon name="trash"></sl-icon>';
  deleteBtn.addEventListener('click', () => this.deleteSelectedObject());
  objectActions.appendChild(deleteBtn);

  toolbarRow.appendChild(objectActions);

  // View controls group
  const viewControls = document.createElement('div');
  viewControls.style.cssText = `
      display: flex;
      gap: 4px;
      margin-right: 2px;
            border-bottom: 1px solid #555;
    `;

  // Reset view button
  const resetViewBtn = document.createElement('sl-button');
  resetViewBtn.id = 'reset-view-btn';
  resetViewBtn.setAttribute('size', 'small');
  resetViewBtn.setAttribute('circle', '');
  resetViewBtn.setAttribute('title', 'Reset View');
  resetViewBtn.setAttribute('variant', 'success');
  resetViewBtn.innerHTML = '<sl-icon name="arrows-fullscreen"></sl-icon>';
  resetViewBtn.addEventListener('click', () => this.resetCamera());
  viewControls.appendChild(resetViewBtn);

  // Wireframe button
  const wireframeBtn = document.createElement('sl-button');
  wireframeBtn.id = 'wireframe-btn';
  wireframeBtn.setAttribute('size', 'small');
  wireframeBtn.setAttribute('circle', '');
  wireframeBtn.setAttribute('variant', 'success');
  wireframeBtn.setAttribute('title', 'Wireframe Mode');
  wireframeBtn.innerHTML = '<sl-icon name="bounding-box"></sl-icon>';
  wireframeBtn.addEventListener('click', () => this.setPreviewMode('wireframe'));
  viewControls.appendChild(wireframeBtn);

  // Solid button
  const solidBtn = document.createElement('sl-button');
  solidBtn.id = 'solid-btn';
  solidBtn.setAttribute('size', 'small');
  solidBtn.setAttribute('circle', '');
  solidBtn.setAttribute('variant', 'success');
  solidBtn.setAttribute('title', 'Solid Mode');
  solidBtn.innerHTML = '<sl-icon name="square"></sl-icon>';
  solidBtn.addEventListener('click', () => this.setPreviewMode('solid'));
  viewControls.appendChild(solidBtn);

  toolbarRow.appendChild(viewControls);

  // History controls group
  const historyControls = document.createElement('div');
  historyControls.style.cssText = `
      display: flex;
      gap: 4px;
    `;

  // Undo button
  const undoBtn = document.createElement('sl-button');
  undoBtn.id = 'undo-btn';
  undoBtn.setAttribute('size', 'small');
  undoBtn.setAttribute('circle', '');
  undoBtn.setAttribute('title', 'Undo');
  undoBtn.innerHTML = '<sl-icon name="arrow-counterclockwise"></sl-icon>';
  undoBtn.addEventListener('click', () => this.undo());
  historyControls.appendChild(undoBtn);

  // Redo button
  const redoBtn = document.createElement('sl-button');
  redoBtn.id = 'redo-btn';
  redoBtn.setAttribute('size', 'small');
  redoBtn.setAttribute('circle', '');
  redoBtn.setAttribute('title', 'Redo');
  redoBtn.innerHTML = '<sl-icon name="arrow-clockwise"></sl-icon>';
  redoBtn.addEventListener('click', () => this.redo());
  historyControls.appendChild(redoBtn);

  toolbarRow.appendChild(historyControls);

  panel.appendChild(toolbarRow);

  // Add list container
  const listContainer = document.createElement('div');
  listContainer.className = 'objects-list';
  listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
  panel.appendChild(listContainer);

  // Add to preview container
  if (this.previewContainer) {
    this.previewContainer.appendChild(panel);
    this.objectsListPanel = panel;
    this.objectsListContainer = listContainer;

    // Store button references for state updates
    this.undoButton = undoBtn;
    this.redoButton = redoBtn;

    // Initial update of the list
    this.updateObjectsList();
    console.log('Objects list panel created and added to preview container');
  } else {
    console.warn('Preview container not available, objects list not added');
  }

  return panel;
};


ShapeForge.prototype.updateObjectsList = function () {

  if (!this.objectsListContainer) {
    console.warn('Objects list container not available');
    return;
  }

  // Clear current list properly
  while (this.objectsListContainer.firstChild) {
    if (this.objectsListContainer.firstChild.tagName &&
      this.objectsListContainer.firstChild.tagName.startsWith('SL-')) {
      this.objectsListContainer.firstChild.remove();
    } else {
      this.objectsListContainer.removeChild(this.objectsListContainer.firstChild);
    }
  }

  // Show message if no objects
  if (this.objects.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'no-objects-message';
    emptyMsg.textContent = 'No objects created yet';
    emptyMsg.style.cssText = 'padding: 8px; color: #aaa; font-style: italic;';
    this.objectsListContainer.appendChild(emptyMsg);
    return;
  }

  // Add entry for each object
  this.objects.forEach((obj, index) => {
    const entry = document.createElement('div');
    entry.className = 'object-entry';
    entry.dataset.index = index;

    // Determine if this object is selected
    const isSelected = this.multiSelectEnabled
      ? this.selectedObjects?.includes(index)
      : this.selectedObject === index;

    entry.style.cssText = `
      padding: 5px;
      margin-bottom: 4px;
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      ${isSelected ? 'background: #3388ff; color: white;' : 'background: #444;'}
      transition: background-color 0.2s;
    `;

    // Add hover effect
    entry.onmouseover = () => {
      if (!isSelected) {
        entry.style.backgroundColor = '#555';
      }
    };

    entry.onmouseout = () => {
      if (!isSelected) {
        entry.style.backgroundColor = '#444';
      }
    };

    // Add icon based on shape type
    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 16px;
      margin-right: 8px;
      width: 20px;
      text-align: center;
    `;

    // Choose icon based on shape type
    let iconText = '★'; // Default
    switch (obj.type) {
      case 'cube': iconText = '□'; break;
      case 'sphere': iconText = '○'; break;
      case 'cylinder': iconText = '⌭'; break;
      case 'cone': iconText = '▲'; break;
      case 'torus': iconText = '⊗'; break;
      case 'plane': iconText = '▬'; break;
      case 'tetrahedron': iconText = '△'; break;
      case 'octahedron': iconText = '◇'; break;
      case 'dodecahedron': iconText = '⬠'; break;
      case 'icosahedron': iconText = '⬢'; break;
      case 'd10': iconText = '⯁'; break;
    }
    icon.textContent = iconText;
    entry.appendChild(icon);

    // Add object name
    const name = document.createElement('span');
    name.className = 'object-name';
    name.textContent = obj.name;
    name.style.cssText = 'flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    entry.appendChild(name);

    // Edit button
    const editBtn = document.createElement('sl-icon-button');
    editBtn.setAttribute('name', 'pencil');
    editBtn.setAttribute('label', 'Edit Name');
    editBtn.style.cssText = 'font-size: 14px; color: inherit;';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showRenameDialog(obj, index);
    });
    entry.appendChild(editBtn);

    // Add visibility toggle with icon
    const visToggle = document.createElement('sl-icon-button');
    visToggle.className = 'visibility-toggle';
    visToggle.setAttribute('name', obj.mesh.visible ? 'eye' : 'eye-slash');
    visToggle.setAttribute('label', obj.mesh.visible ? 'Hide Object' : 'Show Object');
    visToggle.style.cssText = 'font-size: 14px; color: inherit;';
    visToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      obj.mesh.visible = !obj.mesh.visible;
      visToggle.setAttribute('name', obj.mesh.visible ? 'eye' : 'eye-slash');
      visToggle.setAttribute('label', obj.mesh.visible ? 'Hide Object' : 'Show Object');
    });
    entry.appendChild(visToggle);

    // Click handler for selection
    entry.addEventListener('click', () => {
      this.selectObject(index);
    });

    // Add to list
    this.objectsListContainer.appendChild(entry);
  });

  // Update history buttons state
  this.updateHistoryButtons();
};

ShapeForge.prototype.showRenameDialog = function (obj, index) {
  const dialog = document.createElement('sl-dialog');
  dialog.label = 'Rename Object';

  dialog.innerHTML = `
    <sl-input id="new-name" label="Object Name" value="${obj.name}"></sl-input>
    
    <div slot="footer">
      <sl-button id="rename-btn" variant="primary">Rename</sl-button>
      <sl-button id="cancel-btn" variant="default">Cancel</sl-button>
    </div>
  `;

  document.body.appendChild(dialog);

  // Get input and set focus when dialog opens
  const input = dialog.querySelector('#new-name');
  dialog.addEventListener('sl-initial-focus', (e) => {
    // Prevent default focus and set it to our input
    e.preventDefault();
    input.focus();
    // Select all text for easy replacement
    input.setSelectionRange(0, input.value.length);
  });

  // Handle enter key in input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dialog.querySelector('#rename-btn').click();
    }
  });

  // Rename button handler
  dialog.querySelector('#rename-btn').addEventListener('click', () => {
    const newName = input.value.trim();
    if (newName && newName !== obj.name) {
      const oldName = obj.name;
      obj.name = newName;

      // Add history step
      this.addHistoryStep('rename', {
        objectIndex: index,
        oldName,
        newName
      });

      // Update UI
      this.updateObjectsList();

      // Update name in properties panel if this object is selected
      if (this.selectedObject === index) {
        const nameInput = this.drawer.querySelector('#object-name');
        if (nameInput) {
          nameInput.value = newName;
        }
      }
    }
    dialog.hide();
  });

  // Cancel button handler
  dialog.querySelector('#cancel-btn').addEventListener('click', () => {
    dialog.hide();
  });

  // Remove dialog when closed
  dialog.addEventListener('sl-after-hide', () => {
    dialog.remove();
  });

  dialog.show();
};


// 2. OBJECT PICKING IN 3D VIEW
// Add these methods to ShapeForge class

/**
 * Enable object picking in 3D view
 */
ShapeForge.prototype.enableObjectPicking = function () {
  if (!this.previewContainer || !this.previewRenderer) return;

  // Create raycaster for picking
  this.raycaster = new THREE.Raycaster();
  this.mouse = new THREE.Vector2();

  // Add click handler
  this.previewContainer.addEventListener('click', this.handleObjectPick.bind(this));

  console.log('Object picking enabled');
};

/**
 * Handle object picking on click
 * @param {MouseEvent} event - Mouse click event
 */
ShapeForge.prototype.handleObjectPick = function (event) {
  if (!this.raycaster || !this.previewCamera || !this.objects.length) return;

  // Calculate mouse position in normalized device coordinates
  const rect = this.previewRenderer.domElement.getBoundingClientRect();
  this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update the picking ray
  this.raycaster.setFromCamera(this.mouse, this.previewCamera);

  // Get all object meshes
  const meshes = this.objects.map(obj => obj.mesh);

  // Find intersections
  const intersects = this.raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    // Find the index of the intersected object
    const pickedMesh = intersects[0].object;
    const objectIndex = this.objects.findIndex(obj => obj.mesh === pickedMesh);

    if (objectIndex !== -1) {
      console.log(`Picked object: ${this.objects[objectIndex].name}`);
      this.selectObject(objectIndex);
      this.updateObjectsList();

      // Show visual feedback
      this.showPickFeedback(pickedMesh.position.clone());
    }
  }
};

/**
 * Show visual feedback when an object is picked
 * @param {Vector3} position - Position to show feedback
 */
ShapeForge.prototype.showPickFeedback = function (position) {
  if (!this.previewScene) return;

  // Create feedback geometry
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8
  });

  const feedback = new THREE.Mesh(geometry, material);
  feedback.position.copy(position);
  this.previewScene.add(feedback);

  // Animate and remove
  let scale = 1.0;
  const animate = () => {
    scale += 0.1;
    feedback.scale.set(scale, scale, scale);
    feedback.material.opacity -= 0.05;

    if (feedback.material.opacity > 0) {
      requestAnimationFrame(animate);
    } else {
      this.previewScene.remove(feedback);
      feedback.geometry.dispose();
      feedback.material.dispose();
    }
  };

  animate();
};

/**
 * Initialize shader effects panel with proper error handling
 */
ShapeForge.prototype.initializeShaderEffects = function () {
  // Check if ShaderEffectsManager exists and is properly initialized
  if (!this.shaderEffectsManager) {
    console.warn('ShaderEffectsManager not available, skipping effects initialization');
    return;
  }

  // Safely check if effectDefinitions exists and is a Map
  if (!this.shaderEffectsManager.effectDefinitions ||
    typeof this.shaderEffectsManager.effectDefinitions.entries !== 'function') {
    console.warn('ShaderEffectsManager.effectDefinitions not available or not a Map');

    // Create a basic map with just one effect as fallback
    if (!this.shaderEffectsManager.effectDefinitions) {
      this.shaderEffectsManager.effectDefinitions = new Map();
    }

    // Add a basic glow effect if none exist
    if (this.shaderEffectsManager.effectDefinitions.size === 0) {
      this.shaderEffectsManager.effectDefinitions.set('glow', {
        keywords: ['glow', 'light'],
        color: 0x66ccff,
        intensity: 1.0,
        particleCount: 15,
        isAreaEffect: false
      });
    }
  }

  // Find effects container
  const effectsContainer = this.drawer.querySelector('#effects-container');
  if (!effectsContainer) {
    console.warn('Effects container not found in UI');
    return;
  }

  // Get effect type selector
  const effectTypeSelect = effectsContainer.querySelector('#effect-type');
  if (!effectTypeSelect) return;

  try {
    // Safely get available effects
    let effectDefinitions = [];
    if (this.shaderEffectsManager.effectDefinitions &&
      typeof this.shaderEffectsManager.effectDefinitions.entries === 'function') {
      effectDefinitions = Array.from(this.shaderEffectsManager.effectDefinitions.entries());
    } else {
      console.warn('Using fallback effect definitions');
      effectDefinitions = [['glow', {
        keywords: ['glow', 'light'],
        color: 0x66ccff,
        intensity: 1.0,
        particleCount: 15,
        isAreaEffect: false
      }]];
    }

    // Clear existing options first
    while (effectTypeSelect.firstChild) {
      effectTypeSelect.removeChild(effectTypeSelect.firstChild);
    }

    // Add none option
    const noneOption = document.createElement('sl-option');
    noneOption.value = 'none';
    noneOption.textContent = 'None';
    effectTypeSelect.appendChild(noneOption);

    // Add available effects
    effectDefinitions.forEach(([type, definition]) => {
      // Only add relevant effects for props
      if (!definition.isAreaEffect) {
        const option = document.createElement('sl-option');
        option.value = type;
        option.textContent = this.formatEffectName(type);
        effectTypeSelect.appendChild(option);
      }
    });

    // Handle effect type changes
    effectTypeSelect.addEventListener('sl-change', (e) => {
      const selectedEffect = e.target.value;
      this.applyShaderEffect(selectedEffect);

      // Show/hide effect properties
      const effectProps = effectsContainer.querySelector('#effect-properties');
      if (effectProps) {
        effectProps.style.display = selectedEffect === 'none' ? 'none' : 'block';

        // Populate effect properties
        if (selectedEffect !== 'none') {
          this.populateEffectProperties(selectedEffect, effectProps);
        }
      }
    });

    console.log('Shader effects initialized');
  } catch (error) {
    console.error('Error initializing shader effects:', error);
    // Don't let this error prevent other features from working
  }
};

/**
 * Format effect type name for display
 * @param {string} type - Effect type identifier
 * @returns {string} Formatted name
 */
ShapeForge.prototype.formatEffectName = function (type) {
  return type
    .replace(/([A-Z])/g, ' $1') // Add spaces before capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .replace(/Prop$/, '') // Remove 'Prop' suffix
    .trim();
};

/**
 * Populate effect properties panel
 * @param {string} effectType - Type of effect
 * @param {HTMLElement} container - Properties container
 */
ShapeForge.prototype.populateEffectProperties = function (effectType, container) {
  if (!this.shaderEffectsManager || !container) return;

  // Get effect definition
  const definition = this.shaderEffectsManager.effectDefinitions.get(effectType);
  if (!definition) return;

  // Clear container
  container.innerHTML = '';

  // Add common properties

  // Color picker for effect color
  if (definition.color !== undefined) {
    const colorContainer = document.createElement('div');
    colorContainer.style.marginBottom = '10px';

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Effect Color';
    colorLabel.style.display = 'block';
    colorLabel.style.marginBottom = '5px';
    colorContainer.appendChild(colorLabel);

    const colorPicker = document.createElement('sl-color-picker');
    colorPicker.id = 'effect-color';
    colorPicker.value = '#' + new THREE.Color(definition.color).getHexString();
    colorContainer.appendChild(colorPicker);

    colorPicker.addEventListener('sl-change', (e) => {
      this.updateEffectProperty('color', new THREE.Color(e.target.value));
    });

    container.appendChild(colorContainer);
  }

  // Intensity slider
  if (definition.intensity !== undefined) {
    const intensityRange = document.createElement('sl-range');
    intensityRange.id = 'effect-intensity';
    intensityRange.label = 'Intensity';
    intensityRange.min = 0;
    intensityRange.max = 2;
    intensityRange.step = 0.1;
    intensityRange.value = definition.intensity;
    intensityRange.style.marginBottom = '10px';

    intensityRange.addEventListener('sl-change', (e) => {
      this.updateEffectProperty('intensity', parseFloat(e.target.value));
    });

    container.appendChild(intensityRange);
  }

  // Particle count slider
  if (definition.particleCount !== undefined) {
    const particleRange = document.createElement('sl-range');
    particleRange.id = 'effect-particles';
    particleRange.label = 'Particles';
    particleRange.min = 5;
    particleRange.max = 50;
    particleRange.step = 1;
    particleRange.value = definition.particleCount;
    particleRange.style.marginBottom = '10px';

    particleRange.addEventListener('sl-change', (e) => {
      this.updateEffectProperty('particleCount', parseInt(e.target.value));
    });

    container.appendChild(particleRange);
  }

  // Animation speed slider
  if (definition.animationSpeed !== undefined) {
    const speedRange = document.createElement('sl-range');
    speedRange.id = 'effect-speed';
    speedRange.label = 'Animation Speed';
    speedRange.min = 0.1;
    speedRange.max = 2;
    speedRange.step = 0.1;
    speedRange.value = definition.animationSpeed;
    speedRange.style.marginBottom = '10px';

    speedRange.addEventListener('sl-change', (e) => {
      this.updateEffectProperty('animationSpeed', parseFloat(e.target.value));
    });

    container.appendChild(speedRange);
  }

  // Add effect-specific properties based on type
  switch (effectType) {
    case 'fire':
      // Fire-specific properties
      break;
    case 'magic':
      // Magic-specific properties
      break;
    case 'glow':
      // Glow-specific properties
      break;
    // Add more effect types as needed
  }
};

/**
 * Safe wrapper for applyShaderEffect to prevent errors
 */
/**
 * Apply shader effect (completely self-contained version)
 * @param {string} effectType - Type of effect to apply
 */
ShapeForge.prototype.applyShaderEffect = function (effectType) {
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
        this.previewScene.remove(object.effect.container);
      }

      if (object.effect.light && object.effect.light.parent) {
        this.previewScene.remove(object.effect.light);
      }

      if (object.effect.particles && object.effect.particles.parent) {
        this.previewScene.remove(object.effect.particles);
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
        this.previewScene.remove(object.effect.container);
      }

      if (object.effect.light && object.effect.light.parent) {
        this.previewScene.remove(object.effect.light);
      }

      if (object.effect.particles && object.effect.particles.parent) {
        this.previewScene.remove(object.effect.particles);
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
ShapeForge.prototype.createPropGlowEffect = function (prop, options) {
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
  this.previewScene.add(light);

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
ShapeForge.prototype.createSimpleFireEffect = function (prop, options) {
  const defaults = {
    color: options.color || 0xff6600,
    intensity: options.intensity || 1.2
  };

  // Create container for fire effect
  const container = new THREE.Group();
  container.position.copy(prop.position);
  this.previewScene.add(container);

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
ShapeForge.prototype.createSimpleMagicEffect = function (prop, options) {
  const defaults = {
    color: options.color || 0x8800ff,
    intensity: options.intensity || 0.8
  };

  // Create container for magic effect
  const container = new THREE.Group();
  container.position.copy(prop.position);
  this.previewScene.add(container);

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
ShapeForge.prototype.updateEffects = function (deltaTime) {
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
ShapeForge.prototype.updateGlowEffect = function (object, deltaTime) {
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
ShapeForge.prototype.updateFireEffect = function (object, deltaTime) {
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
ShapeForge.prototype.updateMagicEffect = function (object, deltaTime) {
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
ShapeForge.prototype.updateEffectProperty = function (property, value) {
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

ShapeForge.prototype.mergeSelectedObjects = function () {
  if (!this.multiSelectEnabled || !this.selectedObjects || this.selectedObjects.length < 2) {
    alert('Please select at least 2 objects in multi-select mode');
    return;
  }

  console.log(`Attempting to merge ${this.selectedObjects.length} objects`);

  // Get objects to merge
  const objectsToMerge = this.selectedObjects.map(idx => this.objects[idx]);

  try {
    // Create a new BufferGeometry for the merged result
    const mergedGeometry = new THREE.BufferGeometry();

    // Arrays to hold all of the merged geometry attributes
    let positions = [];
    let normals = [];
    let uvs = [];

    // Track index offsets for faces
    let currentIndex = 0;
    let indices = [];

    // Process each geometry
    objectsToMerge.forEach(obj => {
      // Clone geometry
      const geometry = obj.geometry.clone();

      // Apply object transforms to geometry
      const tempMesh = new THREE.Mesh(geometry);
      tempMesh.position.copy(obj.mesh.position);
      tempMesh.rotation.copy(obj.mesh.rotation);
      tempMesh.scale.copy(obj.mesh.scale);
      tempMesh.updateMatrix();

      // Apply the transforms to the geometry
      geometry.applyMatrix4(tempMesh.matrix);

      // If the geometry has an index buffer, use it
      if (geometry.index) {
        const indexArray = geometry.index.array;
        for (let i = 0; i < indexArray.length; i++) {
          indices.push(indexArray[i] + currentIndex);
        }
      } else {
        // If no index buffer, create one based on positions
        const posCount = geometry.attributes.position.count;
        for (let i = 0; i < posCount; i += 3) {
          indices.push(i + currentIndex, i + 1 + currentIndex, i + 2 + currentIndex);
        }
      }

      // Get geometry attributes
      const positionArray = geometry.attributes.position.array;
      for (let i = 0; i < positionArray.length; i++) {
        positions.push(positionArray[i]);
      }

      // Get normals if available
      if (geometry.attributes.normal) {
        const normalArray = geometry.attributes.normal.array;
        for (let i = 0; i < normalArray.length; i++) {
          normals.push(normalArray[i]);
        }
      }

      // Get UVs if available
      if (geometry.attributes.uv) {
        const uvArray = geometry.attributes.uv.array;
        for (let i = 0; i < uvArray.length; i++) {
          uvs.push(uvArray[i]);
        }
      }

      // Update the offset for the next geometry
      currentIndex += geometry.attributes.position.count;
    });

    // Set attributes on the merged geometry
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    if (normals.length > 0 && normals.length === positions.length) {
      mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }

    if (uvs.length > 0 && uvs.length * 3 / 2 === positions.length) {
      mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }

    // Add the index buffer if we have indices
    if (indices.length > 0) {
      mergedGeometry.setIndex(indices);
    }

    // Compute vertex normals if not provided or if calculation needed
    mergedGeometry.computeVertexNormals();

    // Create a merged material (clone the first object's material)
    const material = objectsToMerge[0].material.clone();

    // Set side to double to prevent culling issues
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;

    // Create the merged mesh
    const mergedMesh = new THREE.Mesh(mergedGeometry, material);

    // Create a name for the merged object
    const mergedName = `Merged ${objectsToMerge.map(o => o.name).join('+')}`;

    // Create merged object data
    const mergedObject = {
      type: 'merged',
      name: mergedName,
      geometry: mergedGeometry,
      material: material,
      mesh: mergedMesh,
      parameters: {
        mergedFrom: objectsToMerge.map(obj => obj.name),
        isComposite: true
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };

    // Add to scene
    this.previewScene.add(mergedMesh);

    // Add to objects array
    this.objects.push(mergedObject);

    // Get indices of objects to remove (in reverse order to avoid indexing issues)
    const indicesToRemove = this.selectedObjects.slice().sort((a, b) => b - a);

    // Remove original objects
    indicesToRemove.forEach(idx => {
      this.removeObject(idx);
    });

    // Exit multi-select mode
    this.disableMultiSelect();

    // Select the new merged object
    this.selectObject(this.objects.length - 1);

    // Show success message
    alert(`Successfully merged ${objectsToMerge.length} objects into "${mergedName}"`);

    return true;
  } catch (error) {
    console.error('Error merging objects:', error);
    alert(`Failed to merge objects: ${error.message}`);
    return false;
  }
};

/**
 * Enable multi-select mode
 */
ShapeForge.prototype.enableMultiSelect = function () {
  console.log('Enabling multi-select mode');
  this.multiSelectEnabled = true;

  // Initialize selected objects array if this is the first selection
  if (!this.selectedObjects || !Array.isArray(this.selectedObjects)) {
    this.selectedObjects = [];

    // Add currently selected object if any
    if (this.selectedObject !== null) {
      this.selectedObjects.push(this.selectedObject);
    }
  }

  // Update UI to show multi-select mode
  const selectModeIndicator = document.createElement('div');
  selectModeIndicator.id = 'select-mode-indicator';
  selectModeIndicator.textContent = 'Multi-Select Mode';
  selectModeIndicator.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: #3388ff;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-family: sans-serif;
    font-size: 12px;
    z-index: 100;
  `;
  this.previewContainer.appendChild(selectModeIndicator);

  // Update object list to show multi-select state
  this.updateObjectsList();

  // Update button text
  const multiSelectBtn = this.drawer.querySelector('#enable-multi-select');
  if (multiSelectBtn) {
    multiSelectBtn.textContent = 'Exit Multi-Select';
  }
};

/**
 * Disable multi-select mode
 */
ShapeForge.prototype.disableMultiSelect = function () {
  console.log('Disabling multi-select mode');
  this.multiSelectEnabled = false;

  // Clear any emissive highlighting from objects
  if (this.selectedObjects && this.selectedObjects.length > 0) {
    this.selectedObjects.forEach(index => {
      if (index !== this.selectedObject &&
        this.objects[index] &&
        this.objects[index].mesh &&
        this.objects[index].mesh.material &&
        this.objects[index].mesh.material.emissive) {
        this.objects[index].mesh.material.emissive = new THREE.Color(0x000000);
      }
    });
  }

  // Clear selected objects array
  this.selectedObjects = [];

  // Remove UI indicator
  const indicator = document.getElementById('select-mode-indicator');
  if (indicator) indicator.remove();

  // Update the objects list to reflect single selection mode
  this.updateObjectsList();

  // Update button text
  const multiSelectBtn = this.drawer.querySelector('#enable-multi-select');
  if (multiSelectBtn) {
    multiSelectBtn.textContent = 'Multi-Select';
  }
};

/**
 * Toggle object selection in multi-select mode
 * @param {number} index - Object index to toggle
 */
ShapeForge.prototype.toggleObjectSelection = function (index) {
  if (!this.multiSelectEnabled) {
    this.enableMultiSelect();
  }

  const selectedIndex = this.selectedObjects.indexOf(index);
  if (selectedIndex === -1) {
    // Add to selection
    this.selectedObjects.push(index);
    this.objects[index].mesh.material.emissive = new THREE.Color(0x333333);
  } else {
    // Remove from selection
    this.selectedObjects.splice(selectedIndex, 1);
    this.objects[index].mesh.material.emissive = new THREE.Color(0x000000);
  }

  // Update UI
  this.updateObjectsList();

  console.log(`Selection updated: ${this.selectedObjects.length} objects selected`);
};

/**
 * Initialize new features with async shader effects handling
 */
ShapeForge.prototype.initializeNewFeatures = async function () {
  try {
    // Create objects list panel
    this.createObjectsListPanel();
    console.log('✓ Objects list panel created');
  } catch (error) {
    console.error('Error creating objects list panel:', error);
  }

  try {
    // Enable object picking
    this.enableObjectPicking();
    console.log('✓ Object picking enabled');
  } catch (error) {
    console.error('Error enabling object picking:', error);
  }

  try {
    // Add import/export buttons
    this.addImportExportButtons();
    console.log('✓ Import/Export buttons added');
  } catch (error) {
    console.error('Error adding import/export buttons:', error);
  }

  try {
    // Initialize shader effects - now properly waits for manager
    await this.initializeShaderEffects();
    console.log('✓ Shader effects initialized');
  } catch (error) {
    console.error('Error initializing shader effects:', error);
  }

  try {
    // Add merge button to UI
    this.addMergeTools();
    console.log('✓ Merge tools added');
  } catch (error) {
    console.error('Error adding merge tools:', error);
  }

  // Apply any pending effects to imported objects
  setTimeout(() => {
    this.objects.forEach((obj, index) => {
      if (obj.pendingEffect) {
        this.selectObject(index);
        this.applyShaderEffect(obj.pendingEffect);
        delete obj.pendingEffect;
      }
    });
  }, 500);

  console.log('✓ All new features initialized');
};

/**
 * Add merge tools to the UI
 */
ShapeForge.prototype.addMergeTools = function () {
  const toolPanel = this.drawer.querySelector('.tool-panel');
  if (!toolPanel) {
    console.warn('Tool panel not found, cannot add merge tools');
    return;
  }

  const mergeSection = document.createElement('div');
  mergeSection.className = 'panel-section';
  mergeSection.style.marginTop = '20px';
  mergeSection.innerHTML = `
    <h3>Advanced Tools</h3>
    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <sl-button id="enable-multi-select">Multi-Select</sl-button>
      <sl-button id="merge-objects">Merge Objects</sl-button>
    </div>
    <div style="margin-top: 10px;">
      <sl-range id="merge-detail" label="Merge Detail Level" min="0" max="1" step="0.1" value="0.5"></sl-range>
    </div>
  `;
  toolPanel.appendChild(mergeSection);

  // Add event listeners
  const multiSelectBtn = mergeSection.querySelector('#enable-multi-select');
  if (multiSelectBtn) {
    multiSelectBtn.addEventListener('click', () => {
      if (this.multiSelectEnabled) {
        this.disableMultiSelect();
        multiSelectBtn.textContent = 'Multi-Select';
      } else {
        this.enableMultiSelect();
        multiSelectBtn.textContent = 'Exit Multi-Select';
      }
    });
  }

  const mergeBtn = mergeSection.querySelector('#merge-objects');
  if (mergeBtn) {
    mergeBtn.addEventListener('click', () => {
      this.mergeSelectedObjects();
    });
  }

  const detailSlider = mergeSection.querySelector('#merge-detail');
  if (detailSlider) {
    detailSlider.addEventListener('sl-change', (e) => {
      this.mergeDetailLevel = parseFloat(e.target.value);
    });
  }
};

/**
 * Properly initialize and wait for ShaderEffectsManager to be ready
 */
ShapeForge.prototype.setupShaderEffectsManager = function () {
  return new Promise((resolve, reject) => {
    // If we already have a reference to ShaderEffectsManager
    if (this.shaderEffectsManager && this.shaderEffectsManager.effectDefinitions) {
      console.log('ShaderEffectsManager already available');
      resolve(this.shaderEffectsManager);
      return;
    }

    // If the global instance exists
    if (window.shaderEffectsManager) {
      console.log('Using global ShaderEffectsManager');
      this.shaderEffectsManager = window.shaderEffectsManager;
      resolve(this.shaderEffectsManager);
      return;
    }

    // Look for ShaderEffectsManager in scene3D if available
    if (this.scene3D && this.scene3D.shaderEffects) {
      console.log('Using Scene3D ShaderEffectsManager');
      this.shaderEffectsManager = this.scene3D.shaderEffects;
      resolve(this.shaderEffectsManager);
      return;
    }

    // If ShaderEffectsManager class is available but not instantiated
    if (typeof ShaderEffectsManager === 'function') {
      console.log('Creating new ShaderEffectsManager instance');
      try {
        // Create a new instance - pass scene3D if available
        const scene3D = this.scene3D || window.scene3D || null;
        this.shaderEffectsManager = new ShaderEffectsManager(scene3D);
        resolve(this.shaderEffectsManager);
        return;
      } catch (err) {
        console.warn('Error creating ShaderEffectsManager:', err);
      }
    }

    // If we don't have ShaderEffectsManager yet, wait for it to load
    console.log('Waiting for ShaderEffectsManager to be available...');

    // Check every 300ms for up to 5 seconds
    let attempts = 0;
    const maxAttempts = 16; // 16 * 300ms = ~5 seconds

    const checkInterval = setInterval(() => {
      attempts++;

      // Check if it's available now
      if (window.shaderEffectsManager) {
        clearInterval(checkInterval);
        console.log('ShaderEffectsManager found after waiting');
        this.shaderEffectsManager = window.shaderEffectsManager;
        resolve(this.shaderEffectsManager);
        return;
      }

      // Check if Scene3D has it now
      if (this.scene3D && this.scene3D.shaderEffects) {
        clearInterval(checkInterval);
        console.log('ShaderEffectsManager found in Scene3D after waiting');
        this.shaderEffectsManager = this.scene3D.shaderEffects;
        resolve(this.shaderEffectsManager);
        return;
      }

      // Check if class is available now
      if (typeof ShaderEffectsManager === 'function') {
        clearInterval(checkInterval);
        console.log('ShaderEffectsManager class found after waiting');
        try {
          const scene3D = this.scene3D || window.scene3D || null;
          this.shaderEffectsManager = new ShaderEffectsManager(scene3D);
          resolve(this.shaderEffectsManager);
        } catch (err) {
          console.warn('Error creating ShaderEffectsManager:', err);
          reject(err);
        }
        return;
      }

      // Give up after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn('ShaderEffectsManager not available after waiting');
        resolve(null); // Resolve with null to indicate it's not available
      }
    }, 300);
  });
};

/**
 * Initialize shader effects with dynamic effect discovery
 */
ShapeForge.prototype.initializeShaderEffects = async function () {
  try {
    // Wait for ShaderEffectsManager to be ready
    await this.setupShaderEffectsManager();

    // Find effects container
    const effectsContainer = this.drawer.querySelector('#effects-container');
    if (!effectsContainer) {
      console.warn('Effects container not found in UI');
      return;
    }

    // Get effect type selector
    const effectTypeSelect = effectsContainer.querySelector('#effect-type');
    if (!effectTypeSelect) return;

    // Add refresh button to rediscover effects
    const refreshButton = document.createElement('sl-button');
    refreshButton.size = 'small';
    refreshButton.innerHTML = '<sl-icon name="arrow-repeat"></sl-icon>';
    refreshButton.style.marginLeft = '8px';
    refreshButton.addEventListener('click', () => this.refreshEffectsList());

    // Add refresh button after the select element
    effectTypeSelect.insertAdjacentElement('afterend', refreshButton);

    // Initial population of effects list
    this.refreshEffectsList();

    // Handle effect type changes
    effectTypeSelect.addEventListener('sl-change', (e) => {
      const selectedEffect = e.target.value;
      this.applyShaderEffect(selectedEffect);

      // Show/hide effect properties
      const effectProps = effectsContainer.querySelector('#effect-properties');
      if (effectProps) {
        effectProps.style.display = selectedEffect === 'none' ? 'none' : 'block';

        // Populate effect properties
        if (selectedEffect !== 'none') {
          this.populateEffectProperties(selectedEffect, effectProps);
        }
      }
    });

    console.log('Shader effects initialized with dynamic discovery');
  } catch (error) {
    console.error('Error initializing shader effects:', error);
  }
};

/**
 * Refresh the list of available shader effects
 */
ShapeForge.prototype.refreshEffectsList = function () {
  const effectTypeSelect = this.drawer.querySelector('#effect-type');
  if (!effectTypeSelect) return;

  // Clear existing options
  while (effectTypeSelect.firstChild) {
    effectTypeSelect.removeChild(effectTypeSelect.firstChild);
  }

  // Add none option
  const noneOption = document.createElement('sl-option');
  noneOption.value = 'none';
  noneOption.textContent = 'None';
  effectTypeSelect.appendChild(noneOption);

  // Get available effects from ShaderEffectsManager
  if (this.shaderEffectsManager && this.shaderEffectsManager.effectDefinitions) {
    try {
      const effectDefinitions = Array.from(this.shaderEffectsManager.effectDefinitions.entries());

      console.log(`Discovered ${effectDefinitions.length} shader effects`);

      // Add each effect that's appropriate for props
      effectDefinitions.forEach(([type, definition]) => {
        // Skip area effects - only include effects appropriate for objects
        if (!definition.isAreaEffect) {
          const option = document.createElement('sl-option');
          option.value = type;
          option.textContent = this.formatEffectName(type);
          effectTypeSelect.appendChild(option);

          // Log each discovered effect
          console.log(`Added effect: ${type}`);
        }
      });
    } catch (error) {
      console.error('Error loading effects from ShaderEffectsManager:', error);
    }
  } else {
    console.warn('ShaderEffectsManager or effectDefinitions not available');

    // Add some fallback effects if none are available
    ['glow', 'fire', 'magic'].forEach(type => {
      const option = document.createElement('sl-option');
      option.value = type;
      option.textContent = this.formatEffectName(type);
      effectTypeSelect.appendChild(option);
    });
  }
};

/**
 * Format effect type name for display
 * @param {string} type - Effect type identifier
 * @returns {string} Formatted name
 */
ShapeForge.prototype.formatEffectName = function (type) {
  return type
    .replace(/([A-Z])/g, ' $1') // Add spaces before capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .replace(/Prop$/, '') // Remove 'Prop' suffix
    .trim();
};


/**
 * Import a ShapeForge JSON file
 */
ShapeForge.prototype.importJson = function () {
  // Create file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        this.loadProjectFromJson(jsonData);
      } catch (error) {
        console.error('Error loading JSON:', error);
        alert('Failed to load JSON file: ' + error.message);
      }
    };

    reader.readAsText(file);
  });

  fileInput.click();
};



ShapeForge.prototype.createObjectFromJson = function (objData) {
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
  this.previewScene.add(mesh);

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
ShapeForge.prototype.applyPendingEffects = function () {
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
ShapeForge.prototype.applyEffectParameters = function (obj, parameters) {
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
      // Apply glow-specific parameters
      break;

    case 'magic':
    case 'coldMagic':
      // Apply magic-specific parameters
      break;
  }
};

/**
 * Load a project from JSON data with effect handling
 * @param {Object} jsonData - The parsed JSON data
 */
ShapeForge.prototype.loadProjectFromJson = function (jsonData) {

  // Cleanup any existing effects
  this.cleanupAllShaderEffects();

  // Validate JSON data
  if (!jsonData || !jsonData.objects || !Array.isArray(jsonData.objects)) {
    alert('Invalid JSON format: Missing objects array');
    return;
  }

  // Confirm with user if objects already exist
  if (this.objects.length > 0) {
    if (!confirm('This will replace existing objects. Continue?')) {
      return;
    }

    // Clear existing objects
    this.objects.forEach(obj => {
      if (obj.mesh && this.previewScene) {
        this.previewScene.remove(obj.mesh);
      }
    });

    this.objects = [];
    this.selectedObject = null;
  }

  // Set project name if provided
  if (jsonData.name) {
    const projectNameInput = this.drawer.querySelector('#project-name');
    if (projectNameInput) {
      projectNameInput.value = jsonData.name;
    }
  }

  // Load objects
  jsonData.objects.forEach(objData => {
    this.createObjectFromJson(objData);
  });

  // Select first object if any were created
  if (this.objects.length > 0) {
    this.selectObject(0);
  }

  // Update UI
  this.updateObjectsList();

  // Apply any effects after a short delay to ensure UI is ready
  setTimeout(() => {
    this.applyPendingEffects();
  }, 800);

  // Show success message
  const message = `Project loaded with ${this.objects.length} objects. 
                   ${jsonData.objects.filter(o => o.effect).length} have effects.`;
  alert(message);
};

/**
 * Add the import button to the UI
 */
ShapeForge.prototype.addImportExportButtons = function () {
  // Find the project controls section
  const projectButtons = this.drawer.querySelector('#project-name')?.closest('.panel-section');
  if (!projectButtons) return;

  // Get the buttons container
  const buttonContainer = projectButtons.querySelector('div');
  if (!buttonContainer) return;

  // Add import JSON button
  const importBtn = document.createElement('sl-button');
  importBtn.id = 'import-json';
  importBtn.size = 'small';
  importBtn.textContent = 'Load File';
  importBtn.addEventListener('click', this.importJson.bind(this));

  // Add to container
  buttonContainer.appendChild(importBtn);

  console.log('Import/Export buttons added');
};


ShapeForge.prototype.removeObject = function (index) {
  if (index < 0 || index >= this.objects.length) return;

  const object = this.objects[index];

  // Remove object's mesh from scene
  if (object.mesh && this.previewScene) {
    this.previewScene.remove(object.mesh);
  }

  // Clean up associated shader effects
  if (object.effect && object.effect.data) {
    // Remove containers
    if (object.effect.data.container && object.effect.data.container.parent) {
      this.previewScene.remove(object.effect.data.container);
    }

    // Remove lights that aren't already in a removed container
    if (object.effect.data.light) {
      // Check if light is a child of the container
      const isInContainer = object.effect.data.container &&
        object.effect.data.light.parent === object.effect.data.container;

      // Only remove if it's not already removed as part of the container
      if (!isInContainer && object.effect.data.light.parent) {
        this.previewScene.remove(object.effect.data.light);
      }
    }

    // Remove particles if not already in a removed container
    if (object.effect.data.particles) {
      // Check if particles are a child of the container
      const isInContainer = object.effect.data.container &&
        object.effect.data.particles.parent === object.effect.data.container;

      // Only remove if it's not already removed as part of the container
      if (!isInContainer && object.effect.data.particles.parent) {
        this.previewScene.remove(object.effect.data.particles);
      }
    }

    // Dispose of any materials
    if (object.effect.data.material) {
      object.effect.data.material.dispose();
    }
  }

  // Remove from objects array
  this.objects.splice(index, 1);

  // Update selected object
  if (this.selectedObject === index) {
    this.selectedObject = null;
    this.updatePropertyPanels(null);
  } else if (this.selectedObject > index) {
    this.selectedObject--;
  }

  // Update the objects list
  this.updateObjectsList();
};


ShapeForge.prototype.cleanupAllShaderEffects = function () {
  if (!this.previewScene) return;

  // 1. Clean up known effects associated with objects
  this.objects.forEach(obj => {
    if (obj.effect && obj.effect.data) {
      if (obj.effect.data.container && obj.effect.data.container.parent) {
        this.previewScene.remove(obj.effect.data.container);
      }

      // Remove lights and particles if they're not part of container
      if (obj.effect.data.light &&
        (!obj.effect.data.container || obj.effect.data.light.parent !== obj.effect.data.container)) {
        this.previewScene.remove(obj.effect.data.light);
      }

      if (obj.effect.data.particles &&
        (!obj.effect.data.container || obj.effect.data.particles.parent !== obj.effect.data.container)) {
        this.previewScene.remove(obj.effect.data.particles);
      }
    }
  });

  // 2. Clean up "orphaned" effects by checking scene children
  const itemsToRemove = [];

  this.previewScene.traverse(object => {
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
    this.previewScene.remove(item);

    // Dispose of any materials and geometries
    if (item.material) item.material.dispose();
    if (item.geometry) item.geometry.dispose();
  });

  if (itemsToRemove.length > 0) {
    console.log(`Cleaned up ${itemsToRemove.length} orphaned shader effects`);
  }
};

ShapeForge.prototype.importAdditional = function () {
  // Create file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,.shapeforge.json';

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        const objectsAdded = this.importAdditionalFromJson(jsonData);
        alert(`Added ${objectsAdded} objects from ${file.name}`);
      } catch (error) {
        console.error('Error importing additional content:', error);
        alert('Failed to import file: ' + error.message);
      }
    };

    reader.readAsText(file);
  });

  fileInput.click();
};

ShapeForge.prototype.importAdditionalFromJson = function (jsonData) {
  // Validate JSON data
  if (!jsonData || !jsonData.objects || !Array.isArray(jsonData.objects)) {
    alert('Invalid JSON format: Missing objects array');
    return 0;
  }

  // Get existing object count for selection purposes
  const existingObjectCount = this.objects.length;

  // Load objects (add to existing)
  const newObjects = [];
  jsonData.objects.forEach(objData => {
    // Create a copy with a new name to avoid conflicts
    const modifiedData = { ...objData };
    modifiedData.name = objData.name + " (imported)";

    // Offset position slightly to avoid exact overlaps
    if (!modifiedData.position) modifiedData.position = { x: 0, y: 0, z: 0 };
    modifiedData.position.x += 0.5;
    modifiedData.position.z += 0.5;

    // Create the object
    const newObj = this.createObjectFromJson(modifiedData);
    if (newObj) {
      newObjects.push(newObj);
    }
  });

  // Select the first new object if any were added
  if (newObjects.length > 0) {
    this.selectObject(existingObjectCount);
  }

  // Update UI
  this.updateObjectsList();

  // Apply any effects after a short delay
  setTimeout(() => {
    this.applyPendingEffects();
  }, 800);

  return newObjects.length;
};

ShapeForge.prototype.clearAll = function () {
  if (this.objects.length === 0) return;

  const confirmMessage = `Remove all ${this.objects.length} objects from the project?`;
  if (!confirm(confirmMessage)) return;

  // Clean up all effects first
  this.cleanupAllShaderEffects();

  // Remove all objects from the scene
  this.objects.forEach(obj => {
    if (obj.mesh && this.previewScene) {
      this.previewScene.remove(obj.mesh);
    }
  });

  // Clear the objects array
  this.objects = [];
  this.selectedObject = null;

  // Update UI
  this.updatePropertyPanels(null);
  this.updateObjectsList();
};

/**
 * Create a torus knot and add it to the scene
 */
ShapeForge.prototype.createTorusKnot = function() {
  const geometry = new THREE.TorusKnotGeometry(0.4, 0.1, 64, 8, 2, 3);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'torusKnot',
    name: `Torus Knot ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      radius: 0.4,
      tube: 0.1,
      tubularSegments: 64,
      radialSegments: 8,
      p: 2,
      q: 3
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a triangular pyramid and add it to the scene
 */
ShapeForge.prototype.createPyramid = function() {
  // Create geometry (triangular base pyramid)
  const geometry = new THREE.ConeGeometry(0.5, 1, 3, 1);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'pyramid',
    name: `Pyramid ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      radius: 0.5,
      height: 1,
      radialSegments: 3,
      heightSegments: 1
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a triangular prism and add it to the scene
 */
ShapeForge.prototype.createPrism = function() {
  // Create a triangular prism using custom geometry
  const geometry = new THREE.BufferGeometry();
  
  // Vertices for a triangular prism
  const vertices = new Float32Array([
    // Top triangle
     0.0,  0.5,  0.5,
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
    
    // Bottom triangle 
     0.0,  0.5, -0.5,
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5
  ]);
  
  // Indices for faces
  const indices = [
    // Triangular faces (2)
    0, 1, 2,  // Front triangle
    3, 5, 4,  // Back triangle
    
    // Rectangular faces (3)
    0, 3, 4, 1,  // Left side
    0, 2, 5, 3,  // Right side
    1, 4, 5, 2   // Bottom side
  ];
  
  // Convert rectangular face indices to triangles
  const triangleIndices = [];
  for (let i = 0; i < indices.length; i++) {
    if (i >= 6) {
      // For rectangular faces, split into triangles
      if ((i - 6) % 4 === 0) {
        const j = i;
        triangleIndices.push(indices[j], indices[j+1], indices[j+2]);
        triangleIndices.push(indices[j], indices[j+2], indices[j+3]);
      }
    } else {
      // For existing triangular faces
      triangleIndices.push(indices[i]);
    }
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(triangleIndices);
  geometry.computeVertexNormals();
  
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'prism',
    name: `Prism ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      width: 1,
      height: 1,
      depth: 1
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a capsule shape and add it to the scene
 */
ShapeForge.prototype.createCapsule = function() {
  const geometry = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'capsule',
    name: `Capsule ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      radius: 0.3,
      length: 0.6,
      capSegments: 4,
      radialSegments: 8
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a tube/ring and add it to the scene
 */
ShapeForge.prototype.createTube = function() {
  // Create a curved path for the tube to follow
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, 0, 0),
    new THREE.Vector3(0, 0.5, 0.5),
    new THREE.Vector3(0.5, 0, 0),
    new THREE.Vector3(0, -0.5, -0.5)
  ]);
  curve.closed = true;
  
  const geometry = new THREE.TubeGeometry(curve, 32, 0.1, 8, true);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'tube',
    name: `Tube ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      path: 'circle',
      radius: 0.5,
      tube: 0.1,
      tubularSegments: 32,
      radialSegments: 8
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a hemisphere and add it to the scene
 */
ShapeForge.prototype.createHemisphere = function() {
  const geometry = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  this.addObjectToScene({
    type: 'hemisphere',
    name: `Hemisphere ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      radius: 0.5,
      widthSegments: 32,
      heightSegments: 16,
      phiStart: 0,
      phiLength: Math.PI * 2,
      thetaStart: 0,
      thetaLength: Math.PI / 2
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a rounded cube and add it to the scene
 */
ShapeForge.prototype.createRoundedCube = function() {
  // Create a rounded box (using BoxGeometry + SphereGeometry)
  const boxSize = 0.8;
  const radius = 0.1; // Corner radius
  
  // Create a group to hold all parts
  const group = new THREE.Group();
  
  // Create the core box (slightly smaller than final size)
  const boxGeometry = new THREE.BoxGeometry(
    boxSize - radius * 2,
    boxSize - radius * 2,
    boxSize - radius * 2
  );
  const boxMesh = new THREE.Mesh(boxGeometry, this.createDefaultMaterial());
  group.add(boxMesh);
  
  // Add spheres at corners
  const cornerPositions = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ];
  
  cornerPositions.forEach(pos => {
    const cornerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 8),
      boxMesh.material
    );
    cornerSphere.position.set(
      pos[0] * (boxSize / 2 - radius),
      pos[1] * (boxSize / 2 - radius),
      pos[2] * (boxSize / 2 - radius)
    );
    group.add(cornerSphere);
  });
  
  // Add cylinders for edges
  const edgePositions = [
    // X edges
    [0, -1, -1], [0, 1, -1], [0, -1, 1], [0, 1, 1],
    // Y edges
    [-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1],
    // Z edges
    [-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0]
  ];
  
  const edgeRotations = [
    // X edges (rotate around X)
    [1, 0, 0, Math.PI/2], [1, 0, 0, Math.PI/2], [1, 0, 0, Math.PI/2], [1, 0, 0, Math.PI/2],
    // Y edges (rotate around Y)
    [0, 1, 0, Math.PI/2], [0, 1, 0, Math.PI/2], [0, 1, 0, Math.PI/2], [0, 1, 0, Math.PI/2],
    // Z edges (default orientation)
    [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]
  ];
  
  edgePositions.forEach((pos, i) => {
    const edgeLength = boxSize - radius * 2;
    const edgeCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, edgeLength, 8),
      boxMesh.material
    );
    
    // Position
    edgeCylinder.position.set(
      pos[0] * (boxSize / 2 - radius),
      pos[1] * (boxSize / 2 - radius),
      pos[2] * (boxSize / 2 - radius)
    );
    
    // Rotation
    const rot = edgeRotations[i];
    edgeCylinder.rotateOnAxis(
      new THREE.Vector3(rot[0], rot[1], rot[2]),
      rot[3]
    );
    
    group.add(edgeCylinder);
  });
  
  // Create merged geometry from the group for better performance
  const material = this.createDefaultMaterial();
  
  this.addObjectToScene({
    type: 'roundedCube',
    name: `Rounded Cube ${this.objects.length + 1}`,
    geometry: boxGeometry, // Store only the main geometry
    material: material,
    mesh: group, // Store the whole group as the mesh
    parameters: {
      width: boxSize,
      height: boxSize,
      depth: boxSize,
      radius: radius
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

/**
 * Create a star shape and add it to the scene
 */
ShapeForge.prototype.createStar = function() {
  // Create a star shape
  const points = 5;
  const outerRadius = 0.5;
  const innerRadius = 0.2;
  
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
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const material = this.createDefaultMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  
  // Rotate to a more natural orientation
  mesh.rotation.x = -Math.PI / 2;
  
  this.addObjectToScene({
    type: 'star',
    name: `Star ${this.objects.length + 1}`,
    geometry: geometry,
    material: material,
    mesh: mesh,
    parameters: {
      points: points,
      outerRadius: outerRadius,
      innerRadius: innerRadius,
      depth: 0.2,
      bevelThickness: 0.05,
      bevelSize: 0.05
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
};

// // Add this call to the end of your show() method
// this.initializeNewFeatures();

// Make it globally available
window.ShapeForge = ShapeForge;