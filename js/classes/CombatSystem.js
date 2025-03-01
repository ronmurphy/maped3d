/**
 * CombatSystem.js
 * Handles turn-based combat using monsters from the party system
 * 
 * neeeds fixing for the random additional monsters generated
 */
class CombatSystem {
  constructor(partyManager, resourceManager) {
    console.log("CombatSystem constructor called");
    
    // Store references to managers
    this.partyManager = partyManager;
    this.resourceManager = resourceManager;
  
    // Direct instantiation like in PartyManager
    this.monsterManager = new MonsterManager(this);
    console.log("CombatSystem: Created new MonsterManager instance directly");
  
    // Now get direct access to database
    if (this.monsterManager) {
      this.monsterDatabase = this.monsterManager.monsterDatabase || 
                            this.monsterManager.loadDatabase();
      console.log("CombatSystem: Access to monster database:", !!this.monsterDatabase);
    } else {
      console.warn("CombatSystem: Could not create MonsterManager");
    }
  
    // Now get direct access to database if possible
    if (this.monsterManager) {
      this.monsterDatabase = this.monsterManager.monsterDatabase || 
                            this.monsterManager.loadDatabase();
      console.log("CombatSystem: Access to monster database:", !!this.monsterDatabase);
    } else {
      console.warn("CombatSystem: Could not connect to MonsterManager database");
    }

    // Combat state
    this.inCombat = false;
    this.initiativeOrder = [];
    this.currentTurn = 0;
    this.roundNumber = 0;

    // Combat participants
    this.playerParty = [];
    this.enemyParty = [];

    // UI elements
    this.combatOverlay = null;
    this.dialogContainer = null;

    console.log('Combat System initialized');
  }

  createCombatStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
.combat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5); /* Semi-transparent black instead of solid purple */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.3s ease;
}
  
.combat-container {
  width: 90%;
  max-width: 1000px;
  height: 90vh;
  background: linear-gradient(to bottom, #2e1065, #4c1d95, #581c87); /* Move gradient here */
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  transform: scale(0.95);
  transition: transform 0.3s ease;
  overflow: hidden;
}
  
      .combat-header {
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
      }
  
      .battle-scene {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 16px;
        position: relative;
        overflow: hidden;
      }
  
      .enemy-area {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 32px;
        padding-top: 32px;
        transform: rotate(1deg) translateX(16px);
      }
  
      .player-area {
        display: flex;
        justify-content: flex-start;
        margin-top: 32px;
        transform: rotate(-1deg) translateX(-16px);
      }
  
      .combat-monster {
        position: relative;
        width: 180px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        padding: 0;
        transition: all 0.3s ease;
        color: #333;
        margin: 4px;
      }
  
      .combat-monster.enemy {
        transform: rotate(4deg);
      }
  
      .combat-monster.player {
        transform: rotate(-4deg);
      }
  
      .combat-monster.active {
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
        transform: translateY(-10px) scale(1.05);
        z-index: 10;
        border: 2px solid #3b82f6;
      }
  
      .combat-monster.defeated {
        opacity: 0.6;
        filter: grayscale(100%);
      }
  
      .monster-header {
        display: flex;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #eee;
      }
  
      .monster-image {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 20px;
        overflow: hidden;
      }
  
      .player .monster-image {
        background-color: #3b82f6;
      }
  
      .enemy .monster-image {
        background-color: #ef4444;
      }
  
      .monster-info {
        flex: 1;
        overflow: hidden;
      }
  
      .monster-name {
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
  
      .monster-type {
        font-size: 0.8em;
        color: #666;
      }
  
      .monster-stats {
        padding: 8px;
        background: #f9fafb;
        border-radius: 0 0 8px 8px;
      }
  
      .hp-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.8em;
        margin-bottom: 4px;
      }
  
      .hp-bar-bg {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        margin-bottom: 8px;
        overflow: hidden;
      }
  
      .hp-bar-fill {
        height: 100%;
        width: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }
  
      .hp-bar-fill.high {
        background: #10b981;
      }
  
      .hp-bar-fill.medium {
        background: #f59e0b;
      }
  
      .hp-bar-fill.low {
        background: #ef4444;
      }
  
      .stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8em;
        margin-bottom: 4px;
      }
  
      .active-indicator {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: #3b82f6;
        color: white;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 0.7em;
        font-weight: bold;
      }
  
      .defeated-indicator {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 48px;
      }
  
      .initiative-tracker {
        position: absolute;
        top: 16px;
        left: 16px;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        border-radius: 8px;
        width: 200px;
        color: white;
        overflow: hidden;
      }
  
      .initiative-header {
        padding: 8px;
        text-align: center;
        font-weight: bold;
        background: rgba(0, 0, 0, 0.4);
        font-size: 0.9em;
      }
  
      .initiative-list {
        max-height: 200px;
        overflow-y: auto;
      }
  
      .initiative-item {
        display: flex;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 0.85em;
      }
  
      .initiative-item:nth-child(even) {
        background: rgba(0, 0, 0, 0.2);
      }
  
      .initiative-item.active {
        background: rgba(59, 130, 246, 0.5);
      }
  
      .initiative-item.defeated {
        text-decoration: line-through;
        opacity: 0.6;
      }
  
      .initiative-marker {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
      }
  
      .initiative-marker.player {
        background: #3b82f6;
      }
  
      .initiative-marker.enemy {
        background: #ef4444;
      }
  
      .combat-log {
        flex: 0 0 250px;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        color: white;
      }
  
      .log-header {
        padding: 8px;
        background: rgba(0, 0, 0, 0.4);
        font-weight: bold;
        display: flex;
        align-items: center;
      }
  
      .log-entries {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
  
      .log-entry {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 4px;
        font-size: 0.9em;
        border-left: 4px solid;
      }
  
      .log-entry.system {
        background: rgba(59, 130, 246, 0.2);
        border-left-color: #3b82f6;
      }
  
      .log-entry.action {
        background: rgba(168, 85, 247, 0.2);
        border-left-color: #a855f7;
      }
  
      .log-entry.turn {
        background: rgba(107, 114, 128, 0.2);
        border-left-color: #6b7280;
      }
  
      .action-bar {
        padding: 12px;
        background: rgba(0, 0, 0, 0.4);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
  
      .abilities-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
  
      .ability-btn {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid;
        transition: all 0.2s ease;
        font-weight: 500;
      }
  
      .ability-btn.attack {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }
  
      .ability-btn.attack:hover {
        background: rgba(239, 68, 68, 0.2);
      }
  
      .ability-btn.buff {
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.3);
        color: #10b981;
      }
  
      .ability-btn.buff:hover {
        background: rgba(16, 185, 129, 0.2);
      }
  
      .ability-btn.debuff {
        background: rgba(168, 85, 247, 0.1);
        border-color: rgba(168, 85, 247, 0.3);
        color: #a855f7;
      }
  
      .ability-btn.debuff:hover {
        background: rgba(168, 85, 247, 0.2);
      }
  
      .ability-btn.area {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.3);
        color: #f59e0b;
      }
  
      .ability-btn.area:hover {
        background: rgba(245, 158, 11, 0.2);
      }
  
      .utility-buttons {
        display: flex;
        justify-content: center;
        gap: 8px;
      }
  
      .utility-btn {
        padding: 6px 12px;
        background: rgba(107, 114, 128, 0.7);
        color: white;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: background 0.2s ease;
      }
  
      .utility-btn:hover {
        background: rgba(107, 114, 128, 0.9);
      }
  
      .targeting-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 50;
      }
  
      .targeting-instructions {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        color: white;
        font-size: 1.2em;
        margin-bottom: 16px;
        padding: 12px 24px;
        border-radius: 8px;
        text-align: center;
      }
  
      .cancel-targeting-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: background 0.2s ease;
      }
  
      .cancel-targeting-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
  
      .battle-notification {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-align: center;
        font-size: 1.2em;
        font-weight: bold;
      }
  
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
  
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
  
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
  
      .fade-in {
        animation: fadeIn 0.3s ease forwards;
      }
  
      .slide-up {
        animation: slideUp 0.3s ease forwards;
      }

      .pulse {
        animation: pulse 1s infinite;
      }

      .auto-targeted {
  animation: auto-target-pulse 0.8s ease;
}

@keyframes auto-target-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

@keyframes targetPulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.targetable {
  cursor: pointer;
  animation: targetPulse 1.5s infinite;
  position: relative;
}

.targeting-hint {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.targetable:hover .targeting-hint {
  opacity: 1;
}

@keyframes relationshipPulse {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.5); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

.relationship-card {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  transition: transform 0.2s;
}

.relationship-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.affinity-badge {
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 0.75em;
  margin-right: 6px;
}

.affinity-badge.high {
  background: #d1fae5;
  color: #065f46;
}

.affinity-badge.medium {
  background: #dbeafe;
  color: #1e40af;
}

.affinity-badge.low {
  background: #f3f4f6;
  color: #4b5563;
}

.monster-relationship-tooltip {
  position: absolute;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.8em;
  z-index: 1000;
  pointer-events: none;
  max-width: 200px;
}

.enemy-area {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
  padding-top: 32px;
  flex-wrap: wrap;
  position: relative;
}

.enemy-layout-single {
  justify-content: center;
}

.enemy-layout-duo {
  justify-content: space-around;
  width: 100%;
}

.enemy-layout-trio {
  width: 100%;
  height: 180px; /* Provide enough height for arrangement */
  position: relative;
}

.enemy-layout-trio .combat-monster:first-child {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) rotate(4deg);
  z-index: 3;
}

.enemy-layout-trio .combat-monster:nth-child(2) {
  position: absolute;
  bottom: 0;
  left: 25%;
  transform: translateX(-50%) rotate(-3deg);
  z-index: 2;
}

.enemy-layout-trio .combat-monster:nth-child(3) {
  position: absolute;
  bottom: 0;
  left: 75%;
  transform: translateX(-50%) rotate(7deg);
  z-index: 1;
}

/* Make enemy cards slightly smaller when multiple */
.enemy-layout-duo .combat-monster,
.enemy-layout-trio .combat-monster {
  width: 160px; /* Slightly smaller than the standard 180px */
}
`;

    return styleElement;
  }



  setCombatBackground() {
    console.log('Setting combat background...');

    // First, check if dialogContainer exists
    if (!this.dialogContainer) {
      console.error('setCombatBackground: dialogContainer is not available');
      return false;
    }

    // Safely check the resource manager and splashArt structure
    if (!this.resourceManager) {
      console.error('setCombatBackground: resourceManager is not available');
      return false;
    }

    if (!this.resourceManager.resources ||
      !this.resourceManager.resources.splashArt) {
      console.error('setCombatBackground: splashArt property not found in resources');
      return false;
    }

    if (!this.resourceManager.resources.splashArt.background) {
      console.error('setCombatBackground: background category not found in splashArt');
      return false;
    }

    // Try to get a random background art
    const backgrounds = this.resourceManager.resources.splashArt.background;
    console.log(`Found ${backgrounds.size} backgrounds in splashArt.background`);

    if (backgrounds.size <= 0) {
      console.warn('setCombatBackground: No backgrounds available');
      return false;
    }

    // Log available backgrounds for debugging
    if (backgrounds.size > 0) {
      console.log('Available backgrounds:');
      backgrounds.forEach((bg, id) => {
        console.log(`- ID: ${id}, Name: ${bg.name}, Has data: ${!!bg.data}, Data length: ${bg.data ? bg.data.substring(0, 30) + '...' : 'N/A'}`);
      });
    }

    // Get random splash art
    const randomIndex = Math.floor(Math.random() * backgrounds.size);
    const backgroundValues = Array.from(backgrounds.values());
    const backgroundArt = backgroundValues[randomIndex];

    console.log(`Selected background index ${randomIndex}: ${backgroundArt?.name || 'Unknown'}`);

    if (!backgroundArt) {
      console.error('setCombatBackground: Selected background is null or undefined');
      return false;
    }

    if (!backgroundArt.data) {
      console.error('setCombatBackground: Selected background does not have data property');
      return false;
    }

    try {
      // Apply as background
      console.log('Applying background image...');
      this.dialogContainer.style.backgroundImage = `url(${backgroundArt.data})`;

      // Randomly choose styling approach
      const stylingOption = Math.floor(Math.random() * 5);
      console.log(`Using styling option: ${stylingOption}`);

      switch (stylingOption) {
        case 0:
          // Full cover (default)
          this.dialogContainer.style.backgroundSize = 'cover';
          this.dialogContainer.style.backgroundPosition = 'center';
          console.log('Applied style: Full cover');
          break;

        case 1:
          // Contained with possible repetition
          this.dialogContainer.style.backgroundSize = 'contain';
          this.dialogContainer.style.backgroundPosition = 'center';
          this.dialogContainer.style.backgroundRepeat = 'repeat';
          console.log('Applied style: Contained with repetition');
          break;

        case 2:
          // Zoomed in on a section
          this.dialogContainer.style.backgroundSize = '150%';

          // Pick a random focus point
          const positions = ['top left', 'top center', 'top right',
            'center left', 'center', 'center right',
            'bottom left', 'bottom center', 'bottom right'];
          const randomPosition = positions[Math.floor(Math.random() * positions.length)];
          this.dialogContainer.style.backgroundPosition = randomPosition;
          console.log(`Applied style: Zoomed in (${randomPosition})`);
          break;

        case 3:
          // Slightly tilted background (adds distinctive look)
          this.dialogContainer.style.backgroundSize = 'cover';
          this.dialogContainer.style.backgroundPosition = 'center';

          // Use a separate element for rotation to avoid conflicts
          // Check if we already have a rotated background layer
          let bgLayer = this.dialogContainer.querySelector('.combat-bg-layer');
          if (!bgLayer) {
            // Create a new background layer element
            bgLayer = document.createElement('div');
            bgLayer.className = 'combat-bg-layer';
            bgLayer.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: -1;
                        background-image: inherit;
                        background-size: inherit;
                        background-position: inherit;
                    `;
            this.dialogContainer.appendChild(bgLayer);
          }

          // Apply rotation to the background layer instead
          const rotation = Math.random() > 0.5 ? '1deg' : '-1deg';
          bgLayer.style.transform = `rotate(${rotation})`;
          console.log(`Applied style: Tilted (${rotation})`);
          break;

        case 4:
          // Panoramic-style with fixed width
          this.dialogContainer.style.backgroundSize = 'auto 100%';
          this.dialogContainer.style.backgroundPosition = `${Math.floor(Math.random() * 100)}% center`;
          console.log('Applied style: Panoramic');
          break;
      }

      // Make sure position is relative for absolute positioning to work
      const computedStyle = window.getComputedStyle(this.dialogContainer);
      if (computedStyle.position === 'static') {
        this.dialogContainer.style.position = 'relative';
      }

      // Add overlay to ensure text remains readable regardless of background
      const overlayColor = 'rgba(46, 16, 101, 0.75)'; // Semi-transparent purple

      // Use a background blend mode for more interesting effects
      const blendModes = ['normal', 'multiply', 'overlay', 'darken'];
      const randomBlend = blendModes[Math.floor(Math.random() * blendModes.length)];

      this.dialogContainer.style.backgroundColor = overlayColor;
      this.dialogContainer.style.backgroundBlendMode = randomBlend;
      console.log(`Applied overlay: ${overlayColor} with blend mode: ${randomBlend}`);

      return true;
    } catch (error) {
      console.error('Error applying background:', error);
      return false;
    }
  }

  addTestBackgrounds() {
    if (!this.resourceManager) {
      console.error('Cannot add test backgrounds - no ResourceManager connected');
      return false;
    }

    console.log('Adding test backgrounds to ResourceManager');

    // Make sure the splashArt object exists
    if (!this.resourceManager.resources.splashArt) {
      this.resourceManager.resources.splashArt = {};
    }

    // Initialize the background category as a Map if it doesn't exist
    if (!this.resourceManager.resources.splashArt['background']) {
      this.resourceManager.resources.splashArt['background'] = new Map();
    }

    // Create some simple SVG backgrounds for testing
    const backgrounds = [
      {
        name: 'Purple Gradient',
        data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%234338ca;stop-opacity:1" /><stop offset="100%" style="stop-color:%237e22ce;stop-opacity:1" /></linearGradient></defs><rect width="800" height="600" fill="url(%23grad)" /></svg>'
      },
      {
        name: 'Dungeon Pattern',
        data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><pattern id="pattern" patternUnits="userSpaceOnUse" width="100" height="100"><rect width="50" height="50" x="0" y="0" fill="%23432874" /><rect width="50" height="50" x="50" y="50" fill="%23432874" /><rect width="50" height="50" x="50" y="0" fill="%23331c60" /><rect width="50" height="50" x="0" y="50" fill="%23331c60" /></pattern></defs><rect width="800" height="600" fill="url(%23pattern)" /></svg>'
      }
    ];

    // Add each background to the ResourceManager
    backgrounds.forEach((bg, index) => {
      const id = `test_background_${index}`;
      const backgroundData = {
        id: id,
        name: bg.name,
        data: bg.data,
        thumbnail: bg.data,
        category: 'background',
        dateAdded: new Date().toISOString()
      };

      this.resourceManager.resources.splashArt['background'].set(id, backgroundData);
      console.log(`Added test background: ${bg.name}`);
    });

    return true;
  }

  /**
   * Combat Initialization Methods
   */


  async initiateCombat(enemies) {
    console.log('========== COMBAT INITIALIZATION ==========');
    if (this.inCombat) {
      console.warn('Already in combat');
      return false;
    }
  
    // Check if player has active monsters
    console.log('Checking player party:', this.partyManager.party.active.length, 'active monsters');
    if (!this.partyManager.party.active.length) {
      console.log('No active monsters in party, showing dialog');
      this.showNeedMonstersDialog();
      return false;
    }
  
    // Set combat state
    this.inCombat = true;
    
    // Setup player party
    this.playerParty = [...this.partyManager.party.active];
    console.log(`Player party: ${this.playerParty.length} monsters`);
    console.log('Player names:', this.playerParty.map(p => p.name).join(', '));
    
    // Handle enemy setup
    console.log('Enemy parameter type:', enemies ? (Array.isArray(enemies) ? 'Array' : typeof enemies) : 'undefined');
    
    if (Array.isArray(enemies) && enemies.length > 0) {
      console.log(`Using provided enemy list: ${enemies.length} enemies`);
      this.enemyParty = enemies.map(enemy => this.prepareEnemyForCombat(enemy));
    } else if (enemies) {
      console.log('Single enemy provided, wrapping in array');
      this.enemyParty = [this.prepareEnemyForCombat(enemies)];
    } else {
      console.log('No enemies provided, generating random enemy party');
      
      try {
        // Generate random enemies asynchronously
        const generatedEnemies = await this.generateEnemyParty(this.playerParty);
        
        if (generatedEnemies && generatedEnemies.length > 0) {
          this.enemyParty = generatedEnemies;
        } else {
          // Fallback to a default enemy if generation failed
          console.log('Enemy generation failed, using default enemy');
          const defaultEnemy = this.generateDefaultEnemies(1)[0];
          this.enemyParty = [this.prepareEnemyForCombat(defaultEnemy)];
        }
      } catch (error) {
        console.error("Error generating enemy party:", error);
        // Fallback to default enemy
        const defaultEnemy = this.generateDefaultEnemies(1)[0];
        this.enemyParty = [this.prepareEnemyForCombat(defaultEnemy)];
      }
    }
  
    console.log(`Final enemy party: ${this.enemyParty.length} monsters`);
    console.log('Enemy names:', this.enemyParty.map(e => e.name).join(', '));
    
    // Roll initiative 
    this.rollInitiative();
    console.log('Initiative order:', this.initiativeOrder.map(c => `${c.monster.name} (${c.initiative})`).join(', '));
  
    // Show combat UI
    console.log('Showing combat interface');
    this.showCombatInterface();
    console.log('========== COMBAT INITIALIZATION COMPLETE ==========');
  
    return true;
  }

  // Roll initiative for all participants
  rollInitiative() {
    const allParticipants = [];

    // Add player monsters with initiative rolls
    this.playerParty.forEach(monster => {
      // Base initiative on DEX
      const dexMod = monster.abilities?.dex?.modifier || 0;
      const initiativeRoll = this.rollDice(20) + dexMod;

      allParticipants.push({
        monster,
        initiative: initiativeRoll,
        side: 'player'
      });
    });

    // Add enemy monsters with initiative rolls
    this.enemyParty.forEach(monster => {
      // Base initiative on DEX
      const dexMod = monster.abilities?.dex?.modifier || 0;
      const initiativeRoll = this.rollDice(20) + dexMod;

      allParticipants.push({
        monster,
        initiative: initiativeRoll,
        side: 'enemy'
      });
    });

    // Sort by initiative (highest first)
    this.initiativeOrder = allParticipants.sort((a, b) => b.initiative - a.initiative);

    // Reset turn counter
    this.currentTurn = 0;
    this.roundNumber = 1;

    console.log('Initiative order:', this.initiativeOrder);
  }

  /**
   * Combat UI Methods
   */

  showCombatInterface() {
    // Add our custom styles to the document
    document.head.appendChild(this.createCombatStyles());

    // Create overlay
    this.combatOverlay = document.createElement('div');
    this.combatOverlay.className = 'combat-overlay';

    // Create main combat container
    this.dialogContainer = document.createElement('div');
    this.dialogContainer.className = 'combat-container';

    // Try to set background from splash art, fallback to gradient is already in CSS
    this.setCombatBackground();

    // Create header
    const header = document.createElement('div');
    header.className = 'combat-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span class="material-icons" style="margin-right: 8px;">swords</span>
        <h2 style="margin: 0; font-size: 1.25rem;">Combat</h2>
        <span style="margin-left: 16px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.9rem;">
          Round ${this.roundNumber}
        </span>
      </div>
    `;

    // Create main combat area
    const combatArea = document.createElement('div');
    combatArea.className = 'battle-scene';

    // Create enemy area at top
    const enemyArea = document.createElement('div');
    enemyArea.className = 'enemy-area';

    // Create player area at bottom
    const playerArea = document.createElement('div');
    playerArea.className = 'player-area';

    // Add enemy monsters
    this.enemyParty.forEach((monster, index) => {
      const monsterCard = this.createMonsterCard(monster, 'enemy', index);
      // Position each monster card with a slight offset
      monsterCard.style.transform = `translateY(-${index * 15}px) translateX(-${index * 20}px)`;
      enemyArea.appendChild(monsterCard);
    });

    // Add player monsters
    this.playerParty.forEach((monster, index) => {
      const monsterCard = this.createMonsterCard(monster, 'player', index);
      // Position each monster card with a slight offset
      monsterCard.style.transform = `translateY(${index * 15}px) translateX(${index * 20}px)`;
      playerArea.appendChild(monsterCard);
    });

    // Create initiative tracker
    const initiativeTracker = document.createElement('div');
    initiativeTracker.className = 'initiative-tracker';
    initiativeTracker.innerHTML = `
      <div class="initiative-header">Initiative Order</div>
      <div class="initiative-list">
        ${this.renderInitiativeList()}
      </div>
    `;

    // Create battle notification (current turn)
    const battleNotification = document.createElement('div');
    battleNotification.className = 'battle-notification fade-in';
    const currentMonster = this.getCurrentMonster();
    if (currentMonster) {
      battleNotification.textContent = `${currentMonster.name}'s Turn`;
    }

    // Create combat log
    const combatLog = document.createElement('div');
    combatLog.className = 'combat-log';
    combatLog.innerHTML = `
      <div class="log-header">
        <span class="material-icons" style="font-size: 16px; margin-right: 8px;">history</span>
        Combat Log
      </div>
      <div class="log-entries">
        <div class="log-entry system">
          <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8em;">Round ${this.roundNumber}</div>
          <div>Combat has begun!</div>
        </div>
        <div class="log-entry turn">
          <div>Initiative order determined</div>
        </div>
      </div>
    `;

    // Create action bar
    const actionBar = document.createElement('div');
    actionBar.className = 'action-bar';

    // Only show action buttons if it's player's turn
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    if (currentCombatant && currentCombatant.side === 'player') {
      const currentMonster = currentCombatant.monster;
      actionBar.innerHTML = this.renderActionBar(currentMonster);
    } else {
      actionBar.innerHTML = `
        <div style="text-align: center; color: rgba(255, 255, 255, 0.7);">
          <em>Enemy's turn...</em>
        </div>
      `;
    }

    // Assemble the UI
    combatArea.appendChild(enemyArea);
    combatArea.appendChild(battleNotification);
    combatArea.appendChild(playerArea);
    combatArea.appendChild(initiativeTracker);

    this.dialogContainer.appendChild(header);
    this.dialogContainer.appendChild(combatArea);
    this.dialogContainer.appendChild(actionBar);

    // Add log to the right
    const mainContent = document.createElement('div');
    mainContent.style.display = 'flex';
    mainContent.style.flex = '1';
    mainContent.style.overflow = 'hidden';

    mainContent.appendChild(combatArea);
    mainContent.appendChild(combatLog);

    this.dialogContainer.insertBefore(mainContent, actionBar);

    // Add to overlay
    this.combatOverlay.appendChild(this.dialogContainer);
    document.body.appendChild(this.combatOverlay);

    // Add event listeners
    this.setupCombatEventListeners();

    // Animate in
    setTimeout(() => {
      this.combatOverlay.style.opacity = '1';
      this.dialogContainer.style.transform = 'scale(1)';

      // If it's enemy's turn, start AI processing
      if (currentCombatant && currentCombatant.side === 'enemy') {
        setTimeout(() => this.processEnemyTurn(), 1000);
      }
    }, 10);
  }

  // New method to create styled monster cards
  createMonsterCard(monster, side, index) {
    const isPlayer = side === 'player';
    const isActive = this.isMonsterActive(monster);
    const isDefeated = monster.currentHP <= 0;

    // Calculate HP percentage
    const hpPercent = (monster.currentHP / monster.maxHP) * 100;
    let hpBarColorClass = 'high';
    if (hpPercent < 30) {
      hpBarColorClass = 'low';
    } else if (hpPercent < 70) {
      hpBarColorClass = 'medium';
    }

    // Create card wrapper
    const card = document.createElement('div');
    card.className = `combat-monster ${side}`;
    if (isActive) card.classList.add('active');
    if (isDefeated) card.classList.add('defeated');
    card.setAttribute('data-monster-id', monster.id);

    // Generate token or placeholder
    const tokenSource = monster.token?.data || monster.token?.url || null;

    // Create card content
    card.innerHTML = `
      <div class="monster-header">
        <div class="monster-image">
          ${tokenSource ?
        `<img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
        `<span>${monster.name.charAt(0)}</span>`
      }
        </div>
        <div class="monster-info">
          <div class="monster-name">${monster.name}</div>
          <div class="monster-type">
            ${monster.size} ${monster.type} ${isPlayer ? `• Lvl ${monster.level || 1}` : ''}
          </div>
        </div>
      </div>
      
      <div class="monster-stats">
        <div class="hp-bar-label">
          <span>HP</span>
          <span>${monster.currentHP}/${monster.maxHP}</span>
        </div>
        <div class="hp-bar-bg">
          <div class="hp-bar-fill ${hpBarColorClass}" style="width: ${hpPercent}%;"></div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <div class="stat-row">
            <span>AC</span>
            <span>${monster.armorClass || monster.stats.ac || 10}</span>
          </div>
          <div class="stat-row">
            <span>${isPlayer ? 'EXP' : 'CR'}</span>
            <span>${isPlayer ?
        (monster.experience ? `${monster.experience}/${monster.experienceToNext}` : '0/100') :
        (monster.cr || monster.basic?.cr || '?')
      }</span>
          </div>
        </div>
      </div>
      
      ${isActive ? `
        <div class="active-indicator">ACTIVE</div>
      ` : ''}
      
      ${isDefeated ? `
        <div class="defeated-indicator">✕</div>
      ` : ''}
    `;

    return card;
  }

  // Render a group of monsters (player or enemy)
  renderMonsterGroup(monsters, side) {
    if (!monsters || monsters.length === 0) {
      return `<div class="empty-party-message">No ${side} monsters</div>`;
    }

    let html = '';

    monsters.forEach(monster => {
      // Determine if this monster is active
      const isActive = this.isMonsterActive(monster);
      const isDefeated = monster.currentHP <= 0;


      // Calculate HP percentage
      const hpPercent = (monster.currentHP / monster.maxHP) * 100;
      let hpBarColor = '#4CAF50';  // Green
      if (hpPercent < 30) {
        hpBarColor = '#F44336';  // Red
      } else if (hpPercent < 70) {
        hpBarColor = '#FF9800';  // Orange
      }

      // Apply styling based on status
      let cardStyle = `
        position: relative;
        width: 150px;
        background: white;
        border-radius: 8px;
        border: 1px solid #ddd;
        padding: 8px;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
      `;

      if (isActive) {
        cardStyle += `
          box-shadow: 0 0 15px rgba(33, 150, 243, 0.8);
          transform: translateY(-10px) scale(1.05);
          z-index: 10;
          border-color: #2196F3;
        `;
      }

      if (isDefeated) {
        cardStyle += `
          opacity: 0.6;
          filter: grayscale(100%);
        `;
      }

      const tokenSource = monster.token?.data || monster.token?.url || this.generateDefaultTokenImage(monster);

      html += `
        <div class="combat-monster ${side}" data-monster-id="${monster.id}" style="${cardStyle}">
          <div class="monster-header" style="display: flex; align-items: center; margin-bottom: 8px;">
            <div class="monster-image" style="width: 40px; height: 40px; margin-right: 8px;">
              <img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;">
            </div>
            <div class="monster-info" style="flex: 1; overflow: hidden;">
              <div class="monster-name" style="font-weight: bold; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${monster.name}</div>
              <div class="monster-level" style="font-size: 0.8em;">Lvl ${monster.level}</div>
            </div>
          </div>
          
          <div class="monster-hp" style="margin-bottom: 8px;">
            <div class="hp-label" style="display: flex; justify-content: space-between; font-size: 0.8em;">
              <span>HP</span>
              <span>${monster.currentHP}/${monster.maxHP}</span>
            </div>
            <div class="hp-bar-bg" style="height: 8px; background: #e0e0e0; border-radius: 4px;">
              <div class="hp-bar-fill" style="height: 100%; width: ${hpPercent}%; background: ${hpBarColor}; border-radius: 4px;"></div>
            </div>
          </div>
          
          ${isActive ? `
            <div class="active-indicator" style="position: absolute; top: -10px; left: calc(50% - 12px); background: #2196F3; color: white; border-radius: 12px; padding: 2px 6px; font-size: 0.7em; font-weight: bold;">
              ACTIVE
            </div>
          ` : ''}
          
          ${isDefeated ? `
            <div class="defeated-indicator" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; align-items: center; pointer-events: none;">
              <span class="material-icons" style="font-size: 48px; color: rgba(200, 0, 0, 0.7);">close</span>
            </div>
          ` : ''}
        </div>
      `;
    });

    return html;
  }

  getMonsterTypeColor(type) {
    const typeColors = {
      aberration: '#5500AA',  
      beast: '#44AA44',       
      celestial: '#FFD700',   
      construct: '#999999',   
      dragon: '#FF4444',      
      elemental: '#FF8800',   
      fey: '#DD66FF',         
      fiend: '#AA2222',       
      giant: '#AA7722',       
      humanoid: '#4444FF',    
      monstrosity: '#886600', 
      ooze: '#66CC66',        
      plant: '#228B22',       
      undead: '#663366',      
      vermin: '#996633',      
  
      // Subtypes
      demon: '#990000',       
      devil: '#660000',       
      lich: '#330066',        
      ghost: '#9999FF',       
      skeleton: '#CCCCCC',    
      vampire: '#550000',     
      lycanthrope: '#775500', 
      mimic: '#AA33CC',       
      aberrant_horror: '#220044', 
      swamp_beast: '#556B2F', 
      sea_monster: '#008080', 
      storm_creature: '#708090', 
      fire_entity: '#FF4500', 
      frost_monster: '#00FFFF', 
      shadow_creature: '#222222', 
      celestial_guardian: '#FFFFCC', 
      arcane_construct: '#6666FF', 
      ancient_horror: '#3B3B6D', 
      chaos_entity: '#FF00FF', 
      nature_spirit: '#32CD32', 
      sand_creature: '#D2B48C', 
    };
  
    return typeColors[type.toLowerCase()] || '#6B7280'; // Default gray if not found
  }

  // Add helper method to generate default token image
  generateDefaultTokenImage(monster) {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Generate color based on monster type
    const color = this.getMonsterTypeColor(monster.basic.type);

    // Draw circle background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Add border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add monster initial
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(monster.name.charAt(0).toUpperCase(), size / 2, size / 2);

    return canvas.toDataURL('image/webp');
  }


  renderInitiativeList() {
    if (!this.initiativeOrder || this.initiativeOrder.length === 0) {
      return '<div style="padding: 8px; text-align: center;">No combatants</div>';
    }

    let html = '';

    this.initiativeOrder.forEach((combatant, index) => {
      const { monster, initiative, side } = combatant;
      const isCurrentTurn = index === this.currentTurn;
      const isDefeated = monster.currentHP <= 0;

      const classes = ['initiative-item'];
      if (isCurrentTurn) classes.push('active');
      if (isDefeated) classes.push('defeated');

      html += `
        <div class="${classes.join(' ')}">
          ${isCurrentTurn ?
          `<span class="material-icons" style="margin-right: 8px; font-size: 16px; color: #fcd34d;">play_arrow</span>` :
          `<span style="width: 24px; display: inline-block;"></span>`
        }
          <div class="initiative-marker ${side}"></div>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${monster.name}</span>
          <span style="margin-left: 4px; font-weight: bold;">${initiative}</span>
        </div>
      `;
    });

    return html;
  }


  renderActionBar(monster) {
    if (!monster || monster.currentHP <= 0) {
      return '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>This monster is defeated</em></div>';
    }

    if (!monster.monsterAbilities || monster.monsterAbilities.length === 0) {
      return '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>No abilities available</em></div>';
    }

    let html = `<div class="abilities-container">`;

    // Add abilities with icons
    monster.monsterAbilities.forEach(ability => {
      // Determine icon based on ability type
      let icon = 'sports_martial_arts'; // Default for attack

      switch (ability.type) {
        case 'attack': icon = 'sports_martial_arts'; break;
        case 'area': icon = 'blur_circular'; break;
        case 'buff': icon = 'upgrade'; break;
        case 'debuff': icon = 'threat'; break;
        case 'defense': icon = 'shield'; break;
        case 'healing': icon = 'healing'; break;
        case 'reaction': icon = 'autorenew'; break;
        case 'support': icon = 'group'; break;
      }

      html += `
        <button class="ability-btn ${ability.type}" data-ability="${ability.name.replace(/\s+/g, '_')}">
          <span class="material-icons" style="margin-right: 8px; font-size: 18px;">${icon}</span>
          <span>${ability.name}</span>
          ${ability.damage ? `<span style="margin-left: 8px; color: #ef4444; font-size: 0.8em;">${ability.damage}</span>` : ''}
        </button>
      `;
    });

    // Add utility buttons
    html += `
      </div>
      <div class="utility-buttons">
        <button class="utility-btn use-item-btn">
          <span class="material-icons" style="margin-right: 8px; font-size: 18px;">inventory_2</span>
          Use Item
        </button>
        <button class="utility-btn skip-turn-btn">
          <span class="material-icons" style="margin-right: 8px; font-size: 18px;">skip_next</span>
          Skip Turn
        </button>
      </div>
    `;

    return html;
  }

  setupCombatEventListeners() {
    // Skip button
    const skipBtn = this.dialogContainer.querySelector('.skip-turn-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.addLogEntry(`${this.getCurrentMonster().name} skips their turn.`);
        this.nextTurn();
      });
    }

    // Ability buttons
    const abilityBtns = this.dialogContainer.querySelectorAll('.ability-btn');
    abilityBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        const abilityName = e.currentTarget.getAttribute('data-ability').replace(/_/g, ' ');
        this.useMonsterAbility(abilityName);
      });
    });

    // Use item button
    const itemBtn = this.dialogContainer.querySelector('.use-item-btn');
    if (itemBtn) {
      itemBtn.addEventListener('click', () => {
        alert('Item usage not implemented yet');
      });
    }
  }

  // Show dialog when player has no monsters in party
  showNeedMonstersDialog() {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'No Active Monsters';

    dialog.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <span class="material-icons" style="font-size: 48px; color: #F44336; margin-bottom: 16px;">pets</span>
        <p>You don't have any monsters in your active party.</p>
        <p>You need at least one monster to participate in combat.</p>
      </div>
      
      <div slot="footer">
        <sl-button variant="primary" class="manage-party-btn">Manage Party</sl-button>
        <sl-button variant="neutral" class="close-btn">Close</sl-button>
      </div>
    `;

    // Add event listeners
    dialog.addEventListener('sl-after-show', () => {
      dialog.querySelector('.manage-party-btn').addEventListener('click', () => {
        dialog.hide();
        this.partyManager.showPartyManager();
      });

      dialog.querySelector('.close-btn').addEventListener('click', () => {
        dialog.hide();
      });
    });

    document.body.appendChild(dialog);
    dialog.show();
  }

  /**
   * Combat Logic Methods
   */

  // Process current turn
  processTurn() {
    // Get current combatant
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    if (!currentCombatant) return false;

    const { monster, side } = currentCombatant;

    // Check if monster is defeated
    if (monster.currentHP <= 0) {
      this.addLogEntry(`${monster.name} is defeated and cannot act.`);
      this.nextTurn();
      return true;
    }

    // If it's player's turn, wait for player input
    if (side === 'player') {
      // Update UI to show it's player's turn
      this.updateActionBar(monster);
      return true;
    }

    // If it's enemy's turn, process AI
    if (side === 'enemy') {
      this.processEnemyTurn();
      return true;
    }

    return false;
  }

  // Process enemy's turn with AI
  processEnemyTurn() {
    // Small delay for better UX
    setTimeout(() => {
      const currentCombatant = this.initiativeOrder[this.currentTurn];
      if (!currentCombatant || currentCombatant.side !== 'enemy') return;

      const monster = currentCombatant.monster;

      // Simple AI: select random ability and random target
      if (monster.monsterAbilities && monster.monsterAbilities.length > 0) {
        // Choose random ability
        const randomAbilityIndex = Math.floor(Math.random() * monster.monsterAbilities.length);
        const ability = monster.monsterAbilities[randomAbilityIndex];

        // Find valid targets (non-defeated player monsters)
        const validTargets = this.playerParty.filter(m => m.currentHP > 0);

        if (validTargets.length > 0) {
          // Select random target
          const randomTargetIndex = Math.floor(Math.random() * validTargets.length);
          const target = validTargets[randomTargetIndex];

          // Use ability
          this.resolveAbility(monster, ability, target);
        } else {
          this.addLogEntry(`${monster.name} has no valid targets.`);
        }
      } else {
        this.addLogEntry(`${monster.name} has no abilities and skips their turn.`);
      }

      // Move to next turn
      this.nextTurn();
    }, 1000);
  }

    // Move to next turn - Fixed to skip defeated monsters
  nextTurn() {
    // Move to next combatant
    this.currentTurn++;
  
    // If we've gone through all combatants, start a new round
    if (this.currentTurn >= this.initiativeOrder.length) {
      this.currentTurn = 0;
      this.roundNumber++;
      this.addLogEntry(`Round ${this.roundNumber} begins.`, true);
  
      // Update round number in UI
      const roundDisplay = this.dialogContainer.querySelector('.combat-header span:last-child');
      if (roundDisplay) {
        roundDisplay.textContent = `Round ${this.roundNumber}`;
      }
    }
  
    // Update initiative UI
    this.updateInitiativeTracker();
  
    // Check for combat end conditions
    if (this.checkCombatEnd()) {
      return;
    }
  
    // Get current combatant
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    if (!currentCombatant) return; // Safety check
    
    // NEW CODE: Check if current monster is defeated, if so skip this turn
    if (currentCombatant.monster.currentHP <= 0) {
      this.addLogEntry(`${currentCombatant.monster.name} is defeated and cannot act.`);
      // Call nextTurn again to skip to the next combatant
      this.nextTurn();
      return;
    }
  
    // Process the turn for a non-defeated monster
    this.addLogEntry(`${currentCombatant.monster.name}'s turn.`);
  
    // Update action bar for player turn
    if (currentCombatant.side === 'player') {
      this.updateActionBar(currentCombatant.monster);
    } else {
      // For enemy turn, clear action bar
      this.updateActionBar(null);
      // Process enemy turn with a slight delay
      setTimeout(() => this.processEnemyTurn(), 1000);
    }
  }

  // Check if combat has ended
  checkCombatEnd() {
    // Check if all player monsters are defeated
    const allPlayerDefeated = this.playerParty.every(monster => monster.currentHP <= 0);
    if (allPlayerDefeated) {
      this.endCombat('defeat');
      return true;
    }

    // Check if all enemy monsters are defeated
    const allEnemiesDefeated = this.enemyParty.every(monster => monster.currentHP <= 0);
    if (allEnemiesDefeated) {
      this.endCombat('victory');
      return true;
    }

    return false;
  }

  // End combat and show results
  endCombat(result) {
    // Set combat state
    this.inCombat = false;

    // Create result overlay
    const resultOverlay = document.createElement('div');
    resultOverlay.className = 'combat-result-overlay';
    resultOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
    `;

    // Create result card
    const resultCard = document.createElement('div');
    resultCard.className = 'combat-result-card';
    resultCard.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    // Set content based on result
    if (result === 'victory') {
      resultCard.innerHTML = `
          <span class="material-icons" style="font-size: 64px; color: #FFD700; margin-bottom: 16px;">emoji_events</span>
          <h2 style="margin: 0 0 16px 0; color: #4CAF50;">Victory!</h2>
          <p style="margin-bottom: 24px;">Your party has defeated all enemies.</p>
          
          <div class="rewards" style="margin-bottom: 24px; background: #f5f5f5; padding: 16px; border-radius: 8px;">
            <h3 style="margin-top: 0;">Rewards</h3>
            <div class="experience-reward" style="margin-bottom: 8px;">
              <span style="font-weight: bold;">Experience:</span> 100 XP
            </div>
            <div class="item-rewards">
              <span style="font-weight: bold;">Items:</span> None
            </div>
          </div>
          
          <sl-button class="continue-btn" variant="primary">Continue</sl-button>
        `;

      // Award XP to all player monsters
      this.playerParty.forEach(monster => {
        if (monster.currentHP > 0) { // Only award XP to surviving monsters
          this.partyManager.awardExperience(monster.id, 100);
        }
      });

      // Store enemy data for recruitment opportunity
      if (this.enemyParty.length > 0) {
        // Get a random enemy that wasn't defeated (or first one if all defeated)
        const recruitableEnemies = this.enemyParty.filter(enemy => enemy.currentHP > 0);
        const targetEnemy = recruitableEnemies.length > 0 ?
          recruitableEnemies[0] : this.enemyParty[0];

        // Store for potential recruitment
        window.lastDefeatedEnemy = targetEnemy;

        // Show recruitment hint
        const hintElement = document.createElement('div');
        hintElement.style.cssText = `
            margin-top: 12px;
            font-size: 0.9em;
            color: #666;
            text-align: center;
          `;
        hintElement.innerHTML = 'Press <strong>E</strong> after closing to attempt recruitment';
        resultCard.appendChild(hintElement);
      }
    } else if (result === 'defeat') {
      resultCard.innerHTML = `
        <span class="material-icons" style="font-size: 64px; color: #F44336; margin-bottom: 16px;">sentiment_very_dissatisfied</span>
        <h2 style="margin: 0 0 16px 0; color: #F44336;">Defeat</h2>
        <p style="margin-bottom: 24px;">Your party has been defeated.</p>
        
        <sl-button class="continue-btn" variant="primary">Continue</sl-button>
      `;
    }

    resultOverlay.appendChild(resultCard);
    this.dialogContainer.appendChild(resultOverlay);

    // Add event listener to close combat
    resultCard.querySelector('.continue-btn').addEventListener('click', () => {
      this.closeCombat();
    });
  }

  closeCombat() {
    // Animate out
    this.combatOverlay.style.opacity = '0';
    this.dialogContainer.style.transform = 'scale(0.95)';

    // Remove after animation
    setTimeout(() => {
      this.combatOverlay.remove();
      this.combatOverlay = null;
      this.dialogContainer = null;

      // Reset combat state
      this.inCombat = false;
      this.initiativeOrder = [];
      this.currentTurn = 0;
      this.roundNumber = 0;

      // Store enemy data for recruitment
      const defeatedEnemy = window.lastDefeatedEnemy;

      // Set up recruitment key listener if we have a defeated enemy
      if (defeatedEnemy) {
        const handleRecruitKey = (e) => {
          if (e.key.toLowerCase() === 'e') {
            // Remove this listener to prevent multiple dialogs
            document.removeEventListener('keydown', handleRecruitKey);

            // Show recruitment dialog
            if (this.partyManager) {
              this.partyManager.showRecruitmentDialog(defeatedEnemy);
            }

            // Clear stored enemy
            window.lastDefeatedEnemy = null;
          }
        };

        // Add listener with a slight delay to prevent accidental triggering
        setTimeout(() => {
          document.addEventListener('keydown', handleRecruitKey);

          // Show recruitment prompt
          const promptElement = document.createElement('div');
          promptElement.className = 'recruitment-prompt';
          promptElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
          `;
          promptElement.innerHTML = 'Press <strong>E</strong> to attempt recruitment';
          document.body.appendChild(promptElement);

          // Remove prompt after 5 seconds
          setTimeout(() => {
            if (promptElement.parentNode) {
              promptElement.remove();
            }
          }, 5000);
        }, 500);
      }

      // Restore all player monsters' HP
      this.partyManager.party.active.forEach(monster => {
        monster.currentHP = monster.maxHP;
      });

      // Save party state
      this.partyManager.saveParty();

      console.log('Combat ended and state reset');
    }, 300);
  }

  /**
   * Combat Action Methods
   */

  // Use a monster's ability
  useMonsterAbility(abilityName) {
    const currentMonster = this.getCurrentMonster();
    if (!currentMonster) return false;

    // Find the ability
    const ability = currentMonster.monsterAbilities.find(a => a.name === abilityName);
    if (!ability) {
      console.error(`Ability ${abilityName} not found for ${currentMonster.name}`);
      return false;
    }

    // Show target selection for attack abilities
    if (ability.type === 'attack' || ability.type === 'debuff') {
      this.markTargetableEnemies(currentMonster, ability);
      //   this.showTargetSelection(currentMonster, ability);
    }
    // For self-buff abilities, apply directly
    else if (ability.type === 'buff' || ability.type === 'defense') {
      this.resolveAbility(currentMonster, ability, currentMonster);
      this.nextTurn();
    }
    // For area abilities, apply to all valid targets
    else if (ability.type === 'area') {
      // Get all valid enemy targets
      const targets = this.enemyParty.filter(monster => monster.currentHP > 0);
      if (targets.length > 0) {
        let totalDamage = 0;

        // Process each target
        targets.forEach(target => {
          const damage = this.calculateAbilityDamage(ability);
          this.applyDamage(target, damage);
          totalDamage += damage;
        });

        // Log the area attack
        this.addLogEntry(`${currentMonster.name} uses ${ability.name}, dealing ${totalDamage} total damage to ${targets.length} targets.`);

        // Move to next turn
        this.nextTurn();
      } else {
        this.addLogEntry(`${currentMonster.name} has no valid targets for ${ability.name}.`);
      }
    }
    // For healing abilities, show friendly target selection
    else if (ability.type === 'healing') {
      this.showFriendlyTargetSelection(currentMonster, ability);
    }
    else {
      // For other ability types
      this.addLogEntry(`${currentMonster.name} uses ${ability.name}.`);
      this.nextTurn();
    }

    return true;
  }

  applyRelationshipBonuses(attacker, target) {
    // First, check if attacker exists and has required properties
    if (!attacker || !target || !this.partyManager || !this.partyManager.relationshipMap) {
      return 0; // No relationship system active or missing parameters
    }

    // IMPORTANT: Only apply relationship bonuses for player monsters, not enemies
    // Find which side the attacker is on by checking the initiative order
    const attackerEntry = this.initiativeOrder.find(combatant =>
      combatant.monster.id === attacker.id
    );

    // If attacker isn't found or is on enemy side, return 0 (no bonus)
    if (!attackerEntry || attackerEntry.side !== 'player') {
      return 0; // No relationship bonuses for enemies
    }

    let bonus = 0;

    // Only proceed if this is a player monster
    // Check relationships with other active player monsters
    const activePlayerMonsters = this.initiativeOrder
      .filter(combatant =>
        combatant.side === 'player' &&
        combatant.monster.id !== attacker.id
      )
      .map(combatant => combatant.monster);

    // Apply bonuses from all allies with relationships
    activePlayerMonsters.forEach(ally => {
      bonus += this.partyManager.getCombatModifier(attacker.id, ally.id);
    });

    // If bonus exists, log it and create visual effect
    if (bonus !== 0) {
      this.addLogEntry(`${attacker.name} ${bonus > 0 ? 'strengthened' : 'hindered'} by party relationships (${bonus > 0 ? '+' : ''}${bonus})`);

      // Show relationship effect visualization
      const attackerCard = this.dialogContainer.querySelector(`.combat-monster[data-monster-id="${attacker.id}"]`);
      if (attackerCard) {
        const effect = document.createElement('div');
        effect.className = 'relationship-effect';
        effect.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: relationshipPulse 1s ease-out;
        opacity: 0;
      `;

        effect.innerHTML = `
        <span class="material-icons" style="font-size: 36px; color: ${bonus > 0 ? '#ff6b6b' : '#6b7280'};">
          ${bonus > 0 ? 'favorite' : 'heart_broken'}
        </span>
      `;

        attackerCard.style.position = 'relative';
        attackerCard.appendChild(effect);

        // Remove effect after animation
        setTimeout(() => effect.remove(), 1000);
      }
    }

    return bonus;
  }

  markTargetableEnemies(monster, ability) {
    // Find all enemy cards
    const enemyCards = this.dialogContainer.querySelectorAll('.combat-monster.enemy');

    // Find viable targets (enemies with HP > 0)
    const viableTargets = [];

    enemyCards.forEach(card => {
      const enemyId = card.getAttribute('data-monster-id');
      const enemy = this.enemyParty.find(e => e.id === enemyId);

      if (enemy && enemy.currentHP > 0) {
        viableTargets.push({ card, enemy });
      }
    });

    // If there's only one viable target, auto-target it
    if (viableTargets.length === 1) {
      const { enemy } = viableTargets[0];

      // Create a quick highlight effect to show which enemy was targeted
      const card = viableTargets[0].card;
      card.classList.add('auto-targeted');

      // Create a temporary message
      const battleScene = this.dialogContainer.querySelector('.battle-scene');
      const autoMessage = document.createElement('div');
      autoMessage.className = 'battle-notification fade-in';
      autoMessage.textContent = `Auto-targeting ${enemy.name}`;
      autoMessage.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
      battleScene.appendChild(autoMessage);

      // Remove the message and execute the ability after a short delay
      setTimeout(() => {
        // Remove the message
        autoMessage.classList.remove('fade-in');
        autoMessage.style.opacity = 0;

        // Execute the ability
        this.resolveAbility(monster, ability, enemy);

        // Move to next turn
        this.nextTurn();

        // Clean up
        setTimeout(() => {
          autoMessage.remove();
          card.classList.remove('auto-targeted');
        }, 300);
      }, 800); // Short delay so player can see what happened

      return; // Exit early since we auto-targeted
    }

    // If we have multiple targets, proceed with normal targeting
    viableTargets.forEach(({ card, enemy }) => {
      // Add targetable class and hint
      card.classList.add('targetable');

      // Add targeting hint
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = `Click to target with ${ability.name}`;
      card.appendChild(hint);

      // Click handler to execute the ability
      card.addEventListener('click', () => {
        // Remove targeting from all cards
        enemyCards.forEach(c => {
          c.classList.remove('targetable');
          const h = c.querySelector('.targeting-hint');
          if (h) h.remove();
        });

        // Execute ability on the target
        this.resolveAbility(monster, ability, enemy);

        // Move to next turn
        this.nextTurn();

        // Remove battle notification if present
        const notification = this.dialogContainer.querySelector('.battle-notification');
        if (notification) notification.remove();
      });
    });

    // Add the targeting instruction message only if we have multiple targets
    const battleScene = this.dialogContainer.querySelector('.battle-scene');
    const indicator = document.createElement('div');
    indicator.className = 'battle-notification fade-in';
    indicator.textContent = 'Select an enemy to target';
    indicator.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';

    battleScene.appendChild(indicator);

    // Remove after a few seconds to avoid clutter
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.classList.remove('fade-in');
        indicator.style.opacity = 0;
        setTimeout(() => {
          if (indicator.parentNode) indicator.remove();
        }, 300);
      }
    }, 3000);
  }

  // Show target selection overlay
  showTargetSelection(monster, ability) {
    // Get valid targets (non-defeated enemies)
    const validTargets = this.enemyParty.filter(enemy => enemy.currentHP > 0);

    if (validTargets.length === 0) {
      this.addLogEntry(`${monster.name} has no valid targets for ${ability.name}.`);
      return;
    }

    // Create targeting overlay
    const targetingOverlay = document.createElement('div');
    targetingOverlay.className = 'targeting-overlay';
    targetingOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 50;
    `;

    // Add targeting instructions
    const instructions = document.createElement('div');
    instructions.className = 'targeting-instructions';
    instructions.style.cssText = `
      color: white;
      font-size: 1.2em;
      margin-bottom: 16px;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 16px;
      border-radius: 4px;
    `;
    instructions.innerHTML = `Select a target for <strong>${ability.name}</strong>`;

    targetingOverlay.appendChild(instructions);

    // Add overlay to dialog
    const battleScene = this.dialogContainer.querySelector('.battle-scene');
    battleScene.appendChild(targetingOverlay);

    // Highlight enemy monsters as targetable
    const enemyCards = this.dialogContainer.querySelectorAll('.combat-monster.enemy');
    enemyCards.forEach(card => {
      const enemyId = card.getAttribute('data-monster-id');
      const enemy = this.enemyParty.find(e => e.id === enemyId);

      if (enemy && enemy.currentHP > 0) {
        card.style.cursor = 'pointer';
        card.style.boxShadow = '0 0 10px rgba(244, 67, 54, 0.7)';
        card.style.transform = 'scale(1.05)';

        // Add click handler
        card.addEventListener('click', () => {
          // Remove overlay
          targetingOverlay.remove();

          // Reset styling
          enemyCards.forEach(c => {
            c.style.cursor = '';
            c.style.boxShadow = '';
            c.style.transform = '';
          });

          // Resolve the ability
          this.resolveAbility(monster, ability, enemy);

          // Move to next turn
          this.nextTurn();
        });
      }
    });

    // Add cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-targeting-btn';
    cancelBtn.style.cssText = `
      background: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin-top: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    cancelBtn.innerHTML = `
      <span class="material-icons">cancel</span>
      <span>Cancel</span>
    `;

    cancelBtn.addEventListener('click', () => {
      // Remove overlay
      targetingOverlay.remove();

      // Reset styling
      enemyCards.forEach(card => {
        card.style.cursor = '';
        card.style.boxShadow = '';
        card.style.transform = '';
      });
    });

    targetingOverlay.appendChild(cancelBtn);
  }

  // Show friendly target selection overlay
  showFriendlyTargetSelection(monster, ability) {
    // Get valid targets (non-defeated player monsters)
    const validTargets = this.playerParty.filter(m => m.currentHP > 0);

    if (validTargets.length === 0) {
      this.addLogEntry(`${monster.name} has no valid targets for ${ability.name}.`);
      return;
    }

    // Create targeting overlay
    const targetingOverlay = document.createElement('div');
    targetingOverlay.className = 'targeting-overlay';
    targetingOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 50;
    `;

    // Add targeting instructions
    const instructions = document.createElement('div');
    instructions.className = 'targeting-instructions';
    instructions.style.cssText = `
      color: white;
      font-size: 1.2em;
      margin-bottom: 16px;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 16px;
      border-radius: 4px;
    `;
    instructions.innerHTML = `Select a friendly target for <strong>${ability.name}</strong>`;

    targetingOverlay.appendChild(instructions);

    // Add overlay to dialog
    const battleScene = this.dialogContainer.querySelector('.battle-scene');
    battleScene.appendChild(targetingOverlay);

    // Highlight player monsters as targetable
    const playerCards = this.dialogContainer.querySelectorAll('.combat-monster.player');
    playerCards.forEach(card => {
      const playerId = card.getAttribute('data-monster-id');
      const playerMonster = this.playerParty.find(p => p.id === playerId);

      if (playerMonster && playerMonster.currentHP > 0) {
        card.style.cursor = 'pointer';
        card.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.7)';
        card.style.transform = 'scale(1.05)';

        // Add click handler
        card.addEventListener('click', () => {
          // Remove overlay
          targetingOverlay.remove();

          // Reset styling
          playerCards.forEach(c => {
            c.style.cursor = '';
            c.style.boxShadow = '';
            c.style.transform = '';
          });

          // Resolve the ability
          this.resolveHealingAbility(monster, ability, playerMonster);

          // Move to next turn
          this.nextTurn();
        });
      }
    });

    // Add cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-targeting-btn';
    cancelBtn.style.cssText = `
      background: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin-top: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    cancelBtn.innerHTML = `
      <span class="material-icons">cancel</span>
      <span>Cancel</span>
    `;

    cancelBtn.addEventListener('click', () => {
      // Remove overlay
      targetingOverlay.remove();

      // Reset styling
      playerCards.forEach(card => {
        card.style.cursor = '';
        card.style.boxShadow = '';
        card.style.transform = '';
      });
    });

    targetingOverlay.appendChild(cancelBtn);
  }

  // Resolve an ability's effects
  resolveAbility(monster, ability, target) {
    // Log the ability use
    this.addLogEntry(`${monster.name} uses ${ability.name} on ${target.name}.`);

    // Process based on ability type
    switch (ability.type) {
      case 'attack':
        // Calculate and apply damage - PASS THE MONSTER AS ATTACKER
        const damage = this.calculateAbilityDamage(ability, monster, target);
        this.applyDamage(target, damage);
        break;

      case 'buff':
        // Apply buff to monster
        this.addLogEntry(`${monster.name} gains a beneficial effect.`);
        break;

      case 'debuff':
        // Apply debuff to target
        this.addLogEntry(`${target.name} is afflicted with a negative effect.`);
        break;

      default:
        this.addLogEntry(`${ability.name} is used.`);
        break;
    }

    // Update UI to reflect changes
    this.updateCombatDisplay();
  }

  // Resolve healing ability
  resolveHealingAbility(monster, ability, target) {
    // Calculate healing amount
    const healing = this.calculateHealingAmount(ability);

    // Apply healing
    const originalHP = target.currentHP;
    target.currentHP = Math.min(target.maxHP, target.currentHP + healing);
    const actualHealing = target.currentHP - originalHP;

    // Log the healing
    this.addLogEntry(`${monster.name} uses ${ability.name} on ${target.name}, healing for ${actualHealing} HP.`);

    // Update UI
    this.updateCombatDisplay();
  }

  // Calculate damage for an ability
  originalCalculateAbilityDamage(ability) {
    if (!ability.damage) return 0;

    // Parse damage formula (e.g., "2d6+3")
    const damageFormula = ability.damage;
    let damage = 0;

    // Check if it has dice notation
    if (damageFormula.includes('d')) {
      const [dice, modifier] = damageFormula.split('+');
      const [numDice, dieSize] = dice.split('d').map(n => parseInt(n));

      // Roll the dice
      for (let i = 0; i < numDice; i++) {
        damage += this.rollDice(dieSize);
      }

      // Add modifier if present
      if (modifier) {
        damage += parseInt(modifier);
      }
    }
    // Otherwise treat as fixed damage
    else {
      damage = parseInt(damageFormula);
    }

    return damage;
  }

  calculateAbilityDamage(ability, attacker = null, target = null) {
    // Base damage calculation
    let damage = this.originalCalculateAbilityDamage(ability);

    // Only apply relationship bonus if both attacker and target are provided
    if (attacker && target) {
      const relationshipBonus = this.applyRelationshipBonuses(attacker, target);

      // Apply bonus to damage
      if (relationshipBonus > 0) {
        damage += Math.floor(relationshipBonus / 3);
      }
    }

    return damage;
  }

  // Calculate healing amount
  calculateHealingAmount(ability) {
    // Similar to damage calculation
    if (!ability.healing && !ability.damage) return 0;

    // Use damage field if healing field not specified
    const healingFormula = ability.healing || ability.damage;
    let healing = 0;

    // Check if it has dice notation
    if (healingFormula.includes('d')) {
      const [dice, modifier] = healingFormula.split('+');
      const [numDice, dieSize] = dice.split('d').map(n => parseInt(n));

      // Roll the dice
      for (let i = 0; i < numDice; i++) {
        healing += this.rollDice(dieSize);
      }

      // Add modifier if present
      if (modifier) {
        healing += parseInt(modifier);
      }
    }
    // Otherwise treat as fixed healing
    else {
      healing = parseInt(healingFormula);
    }

    return healing;
  }

  // Apply damage to a target
  applyDamage(target, damage) {
    // Apply damage
    target.currentHP = Math.max(0, target.currentHP - damage);

    // Log the damage
    this.addLogEntry(`${target.name} takes ${damage} damage${target.currentHP <= 0 ? ' and is defeated!' : '.'}`);

    // Update UI to reflect changes
    this.updateCombatDisplay();

    // Check if combat should end
    this.checkCombatEnd();
  }

  /**
   * UI Update Methods
   */

  // Update action bar based on current monster
  updateActionBar(monster) {
    const actionBar = this.dialogContainer.querySelector('.action-bar');
    if (!actionBar) return;

    if (monster && monster.currentHP > 0) {
      actionBar.innerHTML = this.renderActionBar(monster);
      this.setupCombatEventListeners();
    } else {
      actionBar.innerHTML = `
      <div style="text-align: center; color: #666;">
        <em>Enemy's turn...</em>
      </div>
    `;
    }
  }

  // Update initiative tracker UI
  updateInitiativeTracker() {
    const initiativeList = this.dialogContainer.querySelector('.initiative-list');
    if (!initiativeList) return;

    initiativeList.innerHTML = this.renderInitiativeList();
  }

  // Update all combat displays
  updateCombatDisplay() {
    // Update enemy display
    const enemyArea = this.dialogContainer.querySelector('.enemy-area');
    if (enemyArea) {
      enemyArea.innerHTML = this.renderMonsterGroup(this.enemyParty, 'enemy');
    }

    // Update player display
    const playerArea = this.dialogContainer.querySelector('.player-area');
    if (playerArea) {
      playerArea.innerHTML = this.renderMonsterGroup(this.playerParty, 'player');
    }

    // Update initiative display
    this.updateInitiativeTracker();
  }

  // Add entry to combat log
  addLogEntry(message, isRoundHeader = false) {
    // Get log container
    const logEntries = this.dialogContainer.querySelector('.log-entries');
    if (!logEntries) return;

    // Create new entry
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.cssText = `
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
    ${isRoundHeader ? 'font-weight: bold; background-color: #f5f5f5; padding: 4px;' : ''}
  `;

    if (isRoundHeader) {
      entry.innerHTML = `
      <div style="color: #666; font-size: 0.8em;">Round ${this.roundNumber}</div>
      <div>${message}</div>
    `;
    } else {
      entry.innerHTML = `<div>${message}</div>`;
    }

    // Add to log
    logEntries.appendChild(entry);

    // Scroll to bottom
    logEntries.scrollTop = logEntries.scrollHeight;
  }

  /**
   * Helper Methods
   */

  // Roll dice of specified size
  rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }  
  

  establishConnections() {
    console.log("CombatSystem: Establishing connections");
    
    // Try multiple paths to establish MonsterManager connection
    if (!this.monsterManager || !this.monsterDatabase) {
      console.log("CombatSystem: Attempting to re-establish connection to monster database");
      
      // Try to get MonsterManager from PartyManager first (most reliable)
      if (this.partyManager && this.partyManager.monsterManager) {
        this.monsterManager = this.partyManager.monsterManager;
        this.monsterDatabase = this.partyManager.monsterDatabase;
        console.log("CombatSystem: Connected via PartyManager");
      } 
      // If that fails, check resourceManager
      else if (this.resourceManager && this.resourceManager.monsterManager) {
        this.monsterManager = this.resourceManager.monsterManager;
        this.monsterDatabase = this.monsterManager?.monsterDatabase;
        console.log("CombatSystem: Connected via ResourceManager");
      }
      // Last resort: create a new instance
      else {
        this.monsterManager = new MonsterManager(this);
        this.monsterDatabase = this.monsterManager.monsterDatabase || 
                              this.monsterManager.loadDatabase();
        console.log("CombatSystem: Created new connection");
      }
    }
    
    console.log("CombatSystem: Connection status - MonsterManager:", !!this.monsterManager, 
                "MonsterDatabase:", !!this.monsterDatabase);
    
    return !!this.monsterDatabase;
  }

  
  getEnemiesFromManager(targetCR, manager = null) {
    const mm = manager || this.monsterManager;
    console.log('========== DATABASE SEARCH START ==========');
    console.log(`Manager provided: ${!!manager}, Using: ${!!mm}`);
    
    if (!mm || !mm.monsterDatabase) {
      console.warn("No monster database available for enemy selection");
      console.log('MonsterManager:', mm);
      console.log('Database:', mm?.monsterDatabase);
      console.log('========== DATABASE SEARCH END (FAILED) ==========');
      return [];
    }
    
    console.log(`Searching for enemies with target CR ~${targetCR}`);
    
    // Get CR range (50% below to 25% above target)
    const minCR = targetCR * 0.5;
    const maxCR = targetCR * 1.25;
    console.log(`CR Range: ${minCR} to ${maxCR}`);
    
    // Search the database for monsters in CR range
    const candidates = [];
    
    try {
      // Get all monsters from database
      const allMonsters = Array.from(mm.monsterDatabase.values());
      console.log(`Total monsters in database: ${allMonsters.length}`);
      console.log('Sample monster from DB:', allMonsters.length > 0 ? 
                  JSON.stringify(allMonsters[0].basic || allMonsters[0]).substring(0, 100) + '...' : 'None');
      
      let noBasicCount = 0;
      let noCRCount = 0;
      let invalidCRCount = 0;
      let inRangeCount = 0;
      
      for (const monster of allMonsters) {
        // Skip non-hostile creatures and those without CR
        if (!monster.basic) {
          noBasicCount++;
          continue;
        }
        
        if (!monster.basic.cr) {
          noCRCount++;
          continue;
        }
        
        // Convert CR to number for comparison
        let crValue = monster.basic.cr;
        if (typeof crValue === 'string') {
          // Handle fractional CR values
          if (crValue.includes('/')) {
            const [numerator, denominator] = crValue.split('/').map(Number);
            crValue = numerator / denominator;
          } else {
            crValue = Number(crValue);
          }
        }
        
        // Check if CR is in range
        if (!isNaN(crValue)) {
          if (crValue >= minCR && crValue <= maxCR) {
            candidates.push(monster);
            inRangeCount++;
          }
        } else {
          invalidCRCount++;
        }
      }
      
      console.log('Database search stats:');
      console.log(`- Monsters missing 'basic': ${noBasicCount}`);
      console.log(`- Monsters missing CR: ${noCRCount}`);
      console.log(`- Monsters with invalid CR: ${invalidCRCount}`);
      console.log(`- Monsters in CR range: ${inRangeCount}`);
      
      if (candidates.length > 0) {
        console.log('Sample candidate monster:', 
                    JSON.stringify(candidates[0].basic || candidates[0]).substring(0, 100) + '...');
      }
      
      console.log(`Found ${candidates.length} suitable enemies in CR range ${minCR} - ${maxCR}`);
    } catch (error) {
      console.error("Error searching monster database:", error);
    }
    
    console.log('========== DATABASE SEARCH END ==========');
    return candidates;
  }
  

  generateDefaultEnemies(targetCR) {
    // Basic set of default enemies with varying CRs
    const defaultEnemies = [
      {
        id: `default_goblin_${Date.now()}`,
        basic: {
          name: "Goblin Scout",
          type: "Humanoid",
          size: "Small",
          cr: "1/4"
        },
        abilities: {
          str: { score: 8, modifier: -1 },
          dex: { score: 14, modifier: 2 },
          con: { score: 10, modifier: 0 },
          int: { score: 10, modifier: 0 },
          wis: { score: 8, modifier: -1 },
          cha: { score: 8, modifier: -1 }
        },
        stats: {
          ac: 15,
          hp: { average: 7 }
        }
      },
      {
        id: `default_orc_${Date.now()}`,
        basic: {
          name: "Orc Warrior",
          type: "Humanoid",
          size: "Medium",
          cr: "1/2"
        },
        abilities: {
          str: { score: 16, modifier: 3 },
          dex: { score: 12, modifier: 1 },
          con: { score: 16, modifier: 3 },
          int: { score: 7, modifier: -2 },
          wis: { score: 11, modifier: 0 },
          cha: { score: 10, modifier: 0 }
        },
        stats: {
          ac: 13,
          hp: { average: 15 }
        }
      },
      {
        id: `default_ogre_${Date.now()}`,
        basic: {
          name: "Ogre Brute",
          type: "Giant",
          size: "Large",
          cr: "2"
        },
        abilities: {
          str: { score: 19, modifier: 4 },
          dex: { score: 8, modifier: -1 },
          con: { score: 16, modifier: 3 },
          int: { score: 5, modifier: -3 },
          wis: { score: 7, modifier: -2 },
          cha: { score: 7, modifier: -2 }
        },
        stats: {
          ac: 11,
          hp: { average: 59 }
        }
      }
    ];
    
    // Scale the enemies based on target CR
    const scaledEnemies = defaultEnemies.map(enemy => {
      const enemyClone = JSON.parse(JSON.stringify(enemy));
      const originalCr = this.parseCR(enemyClone.basic.cr);
      const scaleRate = targetCR / originalCr;
      
      // Only scale if significant difference
      if (scaleRate > 1.5 || scaleRate < 0.67) {
        // Scale HP based on CR
        if (enemyClone.stats && enemyClone.stats.hp) {
          enemyClone.stats.hp.average = Math.max(1, Math.floor(
            enemyClone.stats.hp.average * Math.sqrt(scaleRate)
          ));
        }
        
        // Scale CR
        const newCR = Math.max(1/8, originalCr * scaleRate);
        enemyClone.basic.cr = this.formatCR(newCR);
        
        // Add scaling info to name
        if (scaleRate > 1) {
          enemyClone.basic.name = `Veteran ${enemyClone.basic.name}`;
        } else if (scaleRate < 1) {
          enemyClone.basic.name = `Young ${enemyClone.basic.name}`;
        }
      }
      
      return enemyClone;
    });
    
    console.log(`Generated ${scaledEnemies.length} default enemies`);
    return scaledEnemies;
  }
  
  // Helper methods for CR conversion
  parseCR(cr) {
    if (typeof cr === 'number') return cr;
    if (typeof cr !== 'string') return 0;
    
    // Handle fractional CR values like "1/4"
    if (cr.includes('/')) {
      const [numerator, denominator] = cr.split('/').map(Number);
      return numerator / denominator;
    }
    
    return Number(cr) || 0;
  }
  
  formatCR(cr) {
    if (cr >= 1) return String(Math.floor(cr));
    
    // Handle fractional CRs
    if (cr >= 0.5) return "1/2";
    if (cr >= 0.25) return "1/4";
    if (cr >= 0.125) return "1/8";
    return "0";
  }


// Add this improved method to your CombatSystem class
async generateEnemyParty(playerParty) {
  console.log('========== ENEMY PARTY GENERATION START ==========');
  
  // Get player party strength metrics
  const partySize = playerParty.length;
  const averageLevel = playerParty.reduce((sum, monster) => sum + monster.level, 0) / partySize;
  console.log(`Party size: ${partySize}, Average level: ${averageLevel}`);
  
  // Determine number of enemies with fairer scaling
  let enemyCount;
  
  if (partySize === 1) {
    // For solo player: always 1 enemy for fair fights
    enemyCount = 1;
  } else if (partySize === 2) {
    // For 2-player party: 1-2 enemies, biased toward 1
    const roll = Math.random();
    enemyCount = roll < 0.7 ? 1 : 2;
    console.log(`2-player party roll: ${roll} -> ${enemyCount} enemies`);
  } else {
    // For 3+ player party: scale enemies more aggressively
    // Maximum of 3 enemies regardless of party size
    const maxEnemies = Math.min(partySize, 3);
    
    // Weight toward more enemies for larger parties
    const weights = [0.2, 0.3, 0.5]; // Weights for 1, 2, or 3 enemies
    const roll = Math.random();
    console.log(`3+ player party roll: ${roll}`);
    
    if (roll < weights[0]) {
      enemyCount = 1;
    } else if (roll < weights[0] + weights[1]) {
      enemyCount = 2;
    } else {
      enemyCount = maxEnemies;
    }
    console.log(`Roll result: ${roll} -> ${enemyCount} enemies`);
  }
  
  console.log(`Generating enemy party with ${enemyCount} monsters for player party of ${partySize}`);
  
  // Calculate target CR
  const targetCR = averageLevel * 0.75;
  console.log(`Target CR: ${targetCR}`);
  
  // Try to get monsters from the database
  let potentialEnemies = [];
  
  try {
    // Make sure we have a connection
    if (this.monsterManager && this.monsterManager.monsterDatabase) {
      console.log("MonsterDatabase type:", typeof this.monsterManager.monsterDatabase);
      console.log("MonsterDatabase has monsters property:", !!this.monsterManager.monsterDatabase.monsters);
      
      // Get all monsters from database - KEY DIFFERENCE: Handle the proper data structure
      let allMonsters = [];
      
      // MonsterManager's database is an object with a 'monsters' property (not a Map)
      if (this.monsterManager.monsterDatabase && this.monsterManager.monsterDatabase.monsters) {
        console.log("Accessing via monsterDatabase.monsters object");
        allMonsters = Object.values(this.monsterManager.monsterDatabase.monsters);
      }
      
      console.log(`Got ${allMonsters.length} total monsters from database`);
      
      // Filter by CR range
      const minCR = targetCR * 0.5;
      const maxCR = targetCR * 1.25;
      
      potentialEnemies = allMonsters.filter(monster => {
        // Check if monster has basic data
        if (!monster.basic || !monster.basic.cr) return false;
        
        // Parse CR value
        let crValue = monster.basic.cr;
        if (typeof crValue === 'string') {
          if (crValue.includes('/')) {
            const [num, denom] = crValue.split('/').map(Number);
            crValue = num / denom;
          } else {
            crValue = Number(crValue);
          }
        }
        
        // Include if in range
        return !isNaN(crValue) && crValue >= minCR && crValue <= maxCR;
      });
      
      console.log(`Found ${potentialEnemies.length} monsters within CR range ${minCR} to ${maxCR}`);
    }
  } catch (error) {
    console.error("Error accessing monster database:", error);
  }
  
  // If we don't have enough monsters, use default enemies
  if (!potentialEnemies || potentialEnemies.length < enemyCount) {
    console.log("Using default enemy templates - not enough monsters in database");
    potentialEnemies = this.generateDefaultEnemies(targetCR);
    console.log(`Generated ${potentialEnemies.length} default enemies`);
  }
  
  // Select random enemies from potential pool
  const selectedEnemies = [];
  for (let i = 0; i < enemyCount; i++) {
    if (potentialEnemies.length > 0) {
      const randomIndex = Math.floor(Math.random() * potentialEnemies.length);
      const enemy = potentialEnemies.splice(randomIndex, 1)[0];
      
      console.log(`Selected enemy ${i+1}:`, enemy.basic ? enemy.basic.name : enemy.name);
      
      // Prepare enemy for combat
      const combatEnemy = this.prepareEnemyForCombat(enemy, targetCR);
      selectedEnemies.push(combatEnemy);
    }
  }
  
  console.log(`Final enemy party size: ${selectedEnemies.length}`);
  console.log(`Enemy names: ${selectedEnemies.map(e => e.name).join(', ')}`);
  console.log('========== ENEMY PARTY GENERATION END ==========');
  
  return selectedEnemies;
}

// Add this async connection method
async establishAsyncConnections() {
  console.log("CombatSystem: Establishing async connections");
  
  if (!this.monsterManager || !this.monsterDatabase) {
    console.log("CombatSystem: No active connections, trying to establish");
    
    // Try connection through PartyManager first
    if (this.partyManager && this.partyManager.monsterManager) {
      this.monsterManager = this.partyManager.monsterManager;
      this.monsterDatabase = this.partyManager.monsterDatabase;
      console.log("CombatSystem: Connected via PartyManager");
    } 
    // If that fails, try direct connection
    else {
      this.monsterManager = new MonsterManager(this);
      console.log("CombatSystem: Created new MonsterManager instance");
      
      // Wait for database to load
      try {
        this.monsterDatabase = await this.monsterManager.loadDatabase();
        console.log("CombatSystem: Loaded database asynchronously");
      } catch (error) {
        console.error("CombatSystem: Failed to load database:", error);
      }
    }
  }
  
  // Verify we actually have monsters
  if (this.monsterDatabase) {
    const count = this.monsterDatabase.size || 0;
    console.log(`CombatSystem: Database has ${count} monsters`);
  }
  
  return !!this.monsterDatabase;
}

  prepareEnemyForCombat(enemy, targetCR) {
    console.log('========== PREPARING ENEMY FOR COMBAT ==========');
    console.log('Enemy before preparation:', enemy.basic ? enemy.basic.name : enemy.name);
    
    // If it's already in combat format, return as is
    if (enemy.currentHP && enemy.maxHP && enemy.monsterAbilities) {
      console.log('Enemy already in combat format');
      return enemy;
    }
    
    // Otherwise, convert from bestiary format using PartyManager's prepare method
    if (this.partyManager) {
      console.log('Using PartyManager to prepare monster');
      console.log('PartyManager available:', !!this.partyManager);
      console.log('prepareMonster method available:', typeof this.partyManager.prepareMonster === 'function');
      
      const preparedEnemy = this.partyManager.prepareMonster(enemy);
      
      // Add some randomization to make fights more interesting
      // Vary HP between 90-110% of base
      const hpVariance = 0.9 + (Math.random() * 0.2);
      preparedEnemy.maxHP = Math.floor(preparedEnemy.maxHP * hpVariance);
      preparedEnemy.currentHP = preparedEnemy.maxHP;
      
      // Give it a unique ID
      preparedEnemy.id = `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      console.log('Enemy after preparation:', preparedEnemy.name);
      console.log(`HP: ${preparedEnemy.currentHP}/${preparedEnemy.maxHP}`);
      console.log(`Abilities: ${preparedEnemy.monsterAbilities?.length || 0}`);
      console.log('========== ENEMY PREPARATION COMPLETE ==========');
      
      return preparedEnemy;
    }
    
    // Fallback if no party manager
    console.log('No PartyManager available, returning unprepared enemy');
    console.log('========== ENEMY PREPARATION FAILED ==========');
    return enemy;
  }

  
  // Update enemy area rendering for multiple enemies
  updateEnemyArea() {
    const enemyArea = this.dialogContainer.querySelector('.enemy-area');
    if (!enemyArea) return;
    
    // Clear existing content
    enemyArea.innerHTML = '';
    
    // Determine layout based on enemy count
    const count = this.enemyParty.length;
    let layoutClass = 'enemy-layout-single';
    
    if (count === 2) {
      layoutClass = 'enemy-layout-duo';
    } else if (count === 3) {
      layoutClass = 'enemy-layout-trio';
    }
    
    enemyArea.className = `enemy-area ${layoutClass}`;
    
    // Add each enemy card with correct positioning
    this.enemyParty.forEach((monster, index) => {
      const monsterCard = this.createMonsterCard(monster, 'enemy', index);
      
      // Apply positioning based on layout
      if (count === 1) {
        // Single enemy - centered
        monsterCard.style.transform = 'rotate(4deg)';
      } else if (count === 2) {
        // Two enemies - side by side with opposite tilts
        const rotation = index === 0 ? 5 : -5;
        monsterCard.style.transform = `translateX(${index === 0 ? '-20px' : '20px'}) rotate(${rotation}deg)`;
      } else {
        // Three enemies - triangular arrangement
        if (index === 0) {
          // Top center
          monsterCard.style.transform = 'translateY(-15px) translateX(0) rotate(4deg)';
        } else if (index === 1) {
          // Bottom left
          monsterCard.style.transform = 'translateY(10px) translateX(-40px) rotate(-3deg)';
        } else {
          // Bottom right
          monsterCard.style.transform = 'translateY(10px) translateX(40px) rotate(7deg)';
        }
      }
      
      enemyArea.appendChild(monsterCard);
    });
  }

  // Get current monster
  getCurrentMonster() {
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    return currentCombatant ? currentCombatant.monster : null;
  }

  // Check if a monster is the active one
  isMonsterActive(monster) {
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    return currentCombatant && currentCombatant.monster.id === monster.id;
  }


}