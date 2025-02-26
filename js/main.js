// js/main.js

// Utility function for map dimensions
function parseMapDimensions(filename) {
    const dimensionMatch = filename.match(/(\d+)x(\d+)/i);
    if (dimensionMatch) {
        return {
            width: parseInt(dimensionMatch[1]),
            height: parseInt(dimensionMatch[2])
        };
    }
    return null;
}

// Function to update layers list height
function updateLayersListHeight() {
    const sidebar = document.querySelector(".sidebar");
    const sidebarContent = document.querySelector(".sidebar-content");
    const layersHeader = document.querySelector(".layers-header");
    const layersList = document.querySelector("#layersList");

    if (sidebar && sidebarContent && layersHeader && layersList) {
        const toolbarsHeight = sidebarContent.offsetHeight + layersHeader.offsetHeight;
        const availableHeight = sidebar.offsetHeight - toolbarsHeight;
        layersList.style.height = `${availableHeight}px`;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Initialize layers list height
    updateLayersListHeight();
    
    // Initialize map editor
    window.mapEditor = new MapEditor();


    // help info
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', showHelpDialog);
    }
  
    function showHelpDialog() {
      const dialog = document.createElement('sl-dialog');
      dialog.label = 'Map Editor Help Guide';
      dialog.style.setProperty('--width', '700px');
      
      dialog.innerHTML = `
        <sl-tab-group>
          <sl-tab slot="nav" panel="getting-started">Getting Started</sl-tab>
          <sl-tab slot="nav" panel="map-basics">Map Basics</sl-tab>
          <sl-tab slot="nav" panel="working-with-map">Working with Maps</sl-tab>
          <sl-tab slot="nav" panel="3d-view">3D View</sl-tab>
          <sl-tab slot="nav" panel="saving-loading">Saving & Loading</sl-tab>
          <sl-tab slot="nav" panel="resources">Resources</sl-tab>
          
          <sl-tab-panel name="getting-started">
            <h3>Welcome to Map Editor!</h3>
            <p>This tool allows you to create and edit maps for your D&D campaigns or other tabletop adventures.</p>
            
            <div class="help-section">
              <h4>Quick Start Guide</h4>
              <ol>
                <li>Click the <span class="material-icons inline-icon">map</span> button to create a new map or open an existing one</li>
                <li>Use the tools in the left sidebar to add rooms, walls, and markers to your map</li>
                <li>Save your work using the <span class="material-icons inline-icon">save</span> button</li>
                <li>View your map in 3D with the <span class="material-icons inline-icon">view_in_ar</span> button</li>
              </ol>
            </div>
          </sl-tab-panel>
          
          <sl-tab-panel name="map-basics">
            <h3>Map Basics</h3>
            
            <div class="help-section">
              <h4>Creating a New Map</h4>
              <ol>
                <li>Click the <span class="material-icons inline-icon">map</span> button in the header</li>
                <li>Select "New Map" from the menu</li>
                <li>Choose a background image for your map</li>
                <li>Enter a name for your map when prompted</li>
              </ol>
            </div>
            
            <div class="help-section">
              <h4>Adding Rooms and Walls</h4>
              <ul>
                <li><strong>Rectangle Tool</strong> <span class="material-icons inline-icon">crop_square</span>: Creates rectangular rooms</li>
                <li><strong>Circle Tool</strong> <span class="material-icons inline-icon">circle</span>: Creates circular rooms</li>
                <li><strong>Wall Tool</strong> <span class="material-icons inline-icon">account_tree</span>: Creates custom polygon shapes for walls
                  <ul>
                    <li>Click to place points</li>
                    <li>Click near the first point to close the shape</li>
                  </ul>
                </li>
                <li><strong>Screenshot Tool</strong> <span class="material-icons inline-icon">photo_camera</span>: Takes a screenshot of the map</li>
              </ul>
            </div>
          </sl-tab-panel>
          
          <sl-tab-panel name="working-with-map">
            <h3>Working with Maps</h3>
            
            <div class="help-section">
              <h4>Adding Markers</h4>
              <ul>
                <li><strong>Player Start</strong> <span class="material-icons inline-icon">person_pin_circle</span>: Sets the starting position for the player in 3D view</li>
                <li><strong>Encounter</strong> <span class="material-icons inline-icon">local_fire_department</span>: Adds enemy encounters</li>
                <li><strong>Treasure</strong> <span class="material-icons inline-icon">workspace_premium</span>: Adds treasure locations</li>
                <li><strong>Trap</strong> <span class="material-icons inline-icon">warning</span>: Marks trap locations</li>
                <li><strong>Teleport</strong> <span class="material-icons inline-icon">swap_calls</span>: Creates teleport points (place two to create a pair)</li>
                <li><strong>Door</strong> <span class="material-icons inline-icon">door_front</span>: Adds doors to walls</li>
                <li><strong>Prop</strong> <span class="material-icons inline-icon">category</span>: Adds decorative props</li>
                <li><strong>Splash Art</strong> <span class="material-icons inline-icon">add_photo_alternate</span>: Adds interactive art/images</li>
              </ul>
            </div>
            
            <div class="help-section">
              <h4>Editing Elements</h4>
              <ul>
                <li>Click and drag rooms to move them</li>
                <li>Use the corner handles to resize rooms</li>
                <li>Use the Edit Marker tool <span class="material-icons inline-icon">edit_location</span> to move markers</li>
                <li>Right-click on any element to see additional options</li>
              </ul>
            </div>
            
            <div class="help-section">
              <h4>Layers Panel</h4>
              <p>The Rooms panel at the bottom of the sidebar allows you to:</p>
              <ul>
                <li>Organize rooms into folders</li>
                <li>Lock layers to prevent accidental changes</li>
                <li>Toggle visibility</li>
                <li>Select and edit rooms</li>
              </ul>
            </div>
          </sl-tab-panel>
          
          <sl-tab-panel name="3d-view">
            <h3>3D View</h3>
            
            <div class="help-section">
              <h4>Entering 3D View</h4>
              <p>Click the <span class="material-icons inline-icon">view_in_ar</span> button to enter 3D mode.</p>
              <p><strong>Important:</strong> It's recommended to run Preferences the first time you enter 3D view to optimize performance for your device.</p>
            </div>
            
            <div class="help-section">
              <h4>Navigation Controls</h4>
              <ul>
                <li><strong>WASD or Arrow Keys</strong>: Move forward, left, backward, right</li>
                <li><strong>Mouse</strong>: Look around</li>
                <li><strong>Shift or Right Mouse Button</strong>: Sprint</li>
                <li><strong>E</strong>: Interact with objects (doors, teleporters, props)</li>
                <li><strong>P</strong>: Toggle FPS counter</li>
                <li><strong>\\ (Backslash)</strong>: Open inventory</li>
                <li><strong>ESC</strong>: Exit pointer lock mode</li>
                <li><strong>~ (Backquote)</strong>: Open preferences</li>
              </ul>
            </div>
            
            <div class="help-section">
              <h4>Day/Night Cycle</h4>
              <p>The 3D view includes a day/night cycle system for more immersive scenes.</p>
              <ul>
                <li>Use the <span class="material-icons inline-icon">brightness_4</span> button in 3D view to adjust time of day</li>
                <li>You can set default time and auto-play options in Preferences</li>
              </ul>
            </div>
          </sl-tab-panel>
          
          <sl-tab-panel name="saving-loading">
            <h3>Saving & Loading</h3>
            
            <div class="help-section">
              <h4>Saving Your Work</h4>
              <p>Click the <span class="material-icons inline-icon">save</span> button to save your work. You have several options:</p>
              <ul>
                <li><strong>Save Map Only</strong>: Saves just the map structure (.map.json)</li>
                <li><strong>Save Complete Project</strong>: Saves the map, resources, and project file
                  <ul>
                    <li>This is the recommended option for most cases</li>
                    <li>Creates multiple files that work together</li>
                  </ul>
                </li>
              </ul>
            </div>
            
            <div class="help-section">
              <h4>Loading Maps & Projects</h4>
              <p>Click the <span class="material-icons inline-icon">map</span> button to load existing content:</p>
              <ul>
                <li><strong>Open Project File</strong>: Load a complete project with all resources</li>
                <li><strong>Open Map File</strong>: Load just a map structure</li>
                <li><strong>Open Resource Pack</strong>: Load textures, monsters, and other resources</li>
                <li><strong>Recent Projects</strong>: Quickly access recently saved projects</li>
              </ul>
            </div>
            
            <div class="help-section">
              <h4>Resource Manager</h4>
              <p>Click the <span class="material-icons inline-icon">palette</span> button to access the Resource Manager:</p>
              <ul>
                <li>Manage textures for walls, doors, props, etc.</li>
                <li>Import monster stats and tokens</li>
                <li>Organize resources into packs</li>
                <li>Import bestiary files (.bestiary.json)</li>
              </ul>
            </div>
          </sl-tab-panel>
          
          <sl-tab-panel name="resources">
            <h3>Resources</h3>
            
            <div class="help-section">
              <h4>Performance Settings</h4>
              <p>Click the <span class="material-icons inline-icon">settings</span> button to access Preferences:</p>
              <ul>
                <li>Adjust quality settings based on your device's capabilities</li>
                <li>Enable/disable shadows, anti-aliasing, and other visual effects</li>
                <li>Set FPS limits for better performance on lower-end devices</li>
                <li>Configure day/night cycle settings</li>
              </ul>
              <p><strong>Tip:</strong> For the best experience, run the preferences after entering 3D view for the first time.</p>
            </div>
          </sl-tab-panel>
        </sl-tab-group>
        
        <style>
          .help-section {
            margin-bottom: 20px;
          }
          .inline-icon {
            font-size: 18px;
            vertical-align: middle;
            margin: 0 2px;
          }
          h3 {
            margin-top: 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
          }
          h4 {
            margin-top: 16px;
            margin-bottom: 8px;
          }
          ul, ol {
            padding-left: 20px;
          }
          li {
            margin-bottom: 6px;
          }
        </style>
      `;
      
      document.body.appendChild(dialog);
      dialog.show();
    }
  });


// Window resize handler
window.addEventListener("resize", updateLayersListHeight);