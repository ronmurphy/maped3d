// window.DEBUG_MODE = true;
/**
 * PartyManager.js
 * Handles monster recruitment, party management, and monster progression
 */
class PartyManager {
  constructor(resourceManager, monsterManager) {
    console.log("PartyManager constructor called");

    // Store direct references
    this.resourceManager = resourceManager;

    // Try multiple paths to get MonsterManager
    this.monsterManager = new MonsterManager(this) ||
      (resourceManager ? resourceManager.monsterManager : null) ||
      window.monsterManager;

    console.log("Initial connections:", {
      hasResourceManager: !!this.resourceManager,
      hasMonsterManager: !!this.monsterManager
    });

    // Direct access to database if possible
    if (this.monsterManager) {
      this.monsterDatabase = this.monsterManager.monsterDatabase || this.monsterManager.loadDatabase();
      console.log("Access to monster database:", !!this.monsterDatabase);
    }

    // Initialize player party data
    this.party = {
      active: [],         // Currently active monsters (max 4-6)
      reserve: [],        // Inactive recruited monsters
      maxActive: 4,       // Starting limit for active party
      maxTotal: 20        // Maximum total monsters that can be recruited
    };

    // Initialize inventory for equipment
    this.inventory = {
      weapons: [],
      armor: [],
      misc: []
    };

    this.recruitmentAttempts = {
      currentCount: 0,
      maxAttempts: 3,
      currentMarker: null,
      currentMonster: null
    };

    // Variables for UI elements
    this.partyDialog = null;
    this.activeTab = 'active';
    this.starterCheckPerformed = false;
    this.initializeRelationshipSystem();
    this.initializeComboSystem();



    // Try to connect to Scene3DController
      let connectionAttempts = 0;
      const tryConnect = () => {
        connectionAttempts++;
        console.log(`Connection attempt ${connectionAttempts} to Scene3DController`);
        
        if (this.connectToSceneInventory()) {
          console.log('Successfully connected to Scene3DController');
        } else if (connectionAttempts < 5) {
          console.log(`Connection failed, retrying in ${connectionAttempts * 500}ms...`);
          setTimeout(tryConnect, connectionAttempts * 500);
        } else {
          console.warn('Failed to connect to Scene3DController after multiple attempts');
        }
      };
      
      // Start connection attempts
      setTimeout(tryConnect, 1000);


    console.log('Party Manager initialized');
  }

  // New method to establish connections after page load
  establishConnections() {
    if (!this.monsterManager) {
      this.monsterManager = window.monsterManager ||
        (this.resourceManager ? this.resourceManager.monsterManager : null);

      if (this.monsterManager) {
        console.log("Established delayed connection to MonsterManager");
        this.monsterDatabase = this.monsterManager.monsterDatabase || this.monsterManager.loadDatabase();
      }
    }
  }

  createPartyManagerStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .party-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
  
      .party-container {
        width: 90%;
        max-width: 1200px;
        height: 90vh;
        background: linear-gradient(to bottom, #4338ca, #6d28d9, #7e22ce);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        transform: scale(0.95);
        transition: transform 0.3s ease;
        overflow: hidden;
      }
  
      .party-header {
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
      }
  
      .party-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
  
      .party-sidebar {
        width: 280px;
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(4px);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
      }
  
      .party-tab-buttons {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
  
      .party-tab {
        flex: 1;
        padding: 12px 8px;
        text-align: center;
        color: white;
        background: transparent;
        border: none;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
  
      .party-tab:hover {
        background: rgba(255, 255, 255, 0.1);
      }
  
      .party-tab.active {
        background: rgba(255, 255, 255, 0.15);
        border-bottom: 2px solid white;
      }
  
      .party-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
  
      .active-monster-list {
        display: flex;
        flex-direction: column;
        padding: 0 8px;
      }
  
      .reserve-monster-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
  
      .monster-card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
  
      .monster-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
  
      .monster-card.active-party {
        width: 200px;
        transform-origin: bottom left;
        transform: rotate(-3deg);
      }
  
      .monster-card.active-party.alt {
        transform-origin: bottom right;
        transform: rotate(3deg);
      }
  
      .monster-card.selected {
        box-shadow: 0 0 0 2px #4f46e5, 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: scale(1.02);
        z-index: 10;
      }
  
      .monster-header {
        display: flex;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
      }
  
      .monster-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 8px;
        color: white;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
      }
  
      .monster-info {
        flex: 1;
        overflow: hidden;
      }
  
      .monster-name {
        font-weight: bold;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.9rem;
      }
  
      .monster-type {
        color: #666;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
      }
  
      .monster-level-badge {
        background: #e0e7ff;
        color: #4338ca;
        font-size: 0.7rem;
        padding: 1px 4px;
        border-radius: 4px;
        margin-left: 4px;
      }
  
      .monster-stats {
        padding: 8px;
        background: #f9fafb;
      }
  
      .hp-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        margin-bottom: 4px;
        color: #666;
      }
  
      .hp-bar-bg {
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }
  
      .hp-bar-fill {
        height: 100%;
        border-radius: 3px;
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
  
      .monster-footer {
        display: flex;
        font-size: 0.75rem;
        color: #666;
        justify-content: space-between;
        align-items: center;
      }
  
      .ac-display {
        display: flex;
        align-items: center;
      }
  
      .equipment-icons {
        display: flex;
        gap: 4px;
      }
  
      .equipment-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
  
      .weapon-icon {
        background: #fee2e2;
        color: #ef4444;
      }
  
      .armor-icon {
        background: #dbeafe;
        color: #3b82f6;
      }
  
      .empty-party-slot {
        border: 2px dashed rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 8px;
      }
  
      .party-details {
        flex: 1;
        overflow: hidden;
        position: relative;
      }
  
      .empty-details-message {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        padding: 20px;
      }
  
      .monster-details {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: white;
        color: #333;
      }
  
      .details-header {
        padding: 16px;
        background: linear-gradient(to right, #4f46e5, #7e22ce);
        color: white;
        display: flex;
        align-items: center;
      }
  
      .details-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        margin-right: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: bold;
      }
  
      .details-title {
        flex: 1;
      }
  
      .details-name {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 4px;
      }
  
      .details-type {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        opacity: 0.9;
      }
  
      .details-cr-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
      }
  
      .details-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
  
      .details-section {
        margin-bottom: 24px;
      }
  
      .details-section-title {
        font-size: 1.1rem;
        font-weight: bold;
        color: #4338ca;
        margin-bottom: 12px;
      }
  
      .stat-bars {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }
  
      .stat-bar {
        background: #f3f4f6;
        padding: 12px;
        border-radius: 8px;
      }
  
      .stat-bar-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
  
      .exp-bar-bg {
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
      }
  
      .exp-bar-fill {
        height: 100%;
        background: #8b5cf6;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
  
      .stat-grid {
        display: flex;
        background: #f3f4f6;
        border-radius: 8px;
      }
  
      .stat-cell {
        flex: 1;
        text-align: center;
        padding: 12px 8px;
        border-right: 1px solid #e5e7eb;
      }
  
      .stat-cell:last-child {
        border-right: none;
      }
  
      .stat-label {
        font-size: 0.75rem;
        color: #6b7280;
        margin-bottom: 4px;
      }
  
      .stat-value {
        font-weight: bold;
      }
  
      .ability-scores {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
      }
  
      .ability-score {
        background: #eef2ff;
        border-radius: 8px;
        padding: 8px 4px;
        text-align: center;
      }
  
      .ability-name {
        font-size: 0.75rem;
        font-weight: bold;
        color: #4338ca;
        text-transform: uppercase;
      }
  
      .ability-value {
        font-weight: bold;
        font-size: 1.1rem;
      }
  
      .ability-mod {
        font-size: 0.75rem;
        color: #6b7280;
      }
  
      .monster-abilities {
        display: grid;
        gap: 8px;
      }
  
      .ability-card {
        border-radius: 8px;
        padding: 8px;
      }
  
      .ability-card.attack {
        background: #fee2e2;
      }
  
      .ability-card.buff {
        background: #d1fae5;
      }
  
      .ability-card.debuff {
        background: #ede9fe;
      }
  
      .ability-card.area {
        background: #ffedd5;
      }
  
      .ability-card.control {
        background: #dbeafe;
      }
  
      .ability-header {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
      }
  
      .ability-icon {
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
  
      .ability-title {
        flex: 1;
        font-weight: 500;
      }
  
      .ability-damage {
        font-size: 0.8rem;
        font-weight: 500;
      }
  
      .ability-description {
        font-size: 0.8rem;
        color: #4b5563;
        padding-left: 28px;
      }
  
      .equipment-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
  
      .equipment-slot {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
      }
  
      .equipment-slot.weapon.equipped {
        background: #fee2e2;
        border-color: #fca5a5;
      }
  
      .equipment-slot.armor.equipped {
        background: #dbeafe;
        border-color: #93c5fd;
      }
  
      .equipment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
  
      .equipment-type {
        display: flex;
        align-items: center;
        font-weight: 500;
      }
  
      .equipment-icon {
        margin-right: 8px;
      }
  
      .equipment-action {
        font-size: 0.75rem;
        color: #4f46e5;
        cursor: pointer;
      }
  
      .equipment-details {
        font-size: 0.9rem;
      }
  
      .equipment-name {
        font-weight: 500;
      }
  
      .equipment-bonus {
        font-size: 0.75rem;
      }
  
      .equipment-bonus.weapon {
        color: #dc2626;
      }
  
      .equipment-bonus.armor {
        color: #2563eb;
      }
  
      .empty-equipment {
        color: #9ca3af;
        font-size: 0.9rem;
      }
  
      .relationships {
        display: grid;
        gap: 8px;
      }
  
      .relationship-card {
        display: flex;
        align-items: center;
        padding: 8px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }
  
      .relationship-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      }
  
      .relationship-info {
        flex: 1;
        min-width: 0;
      }
  
      .relationship-name {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
  
      .relationship-details {
        display: flex;
        align-items: center;
        font-size: 0.75rem;
      }
  
      .affinity-badge {
        padding: 2px 6px;
        border-radius: 9999px;
        margin-right: 4px;
        font-size: 0.7rem;
        font-weight: 500;
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
  
      .relationship-benefit {
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
  
      /* Utility classes */
      .material-icons.small {
        font-size: 16px;
      }
  
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
  
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
  
      .fade-in {
        animation: fadeIn 0.3s ease forwards;
      }
  
      .slide-up {
        animation: slideUp 0.3s ease forwards;
      }

       /* Abilities grid layout */
  .monster-abilities {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .ability-card {
    border-radius: 8px;
    padding: 4px;
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s;
  }
  
  .ability-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  .ability-header {
    display: flex;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .ability-icon {
    width: 24px;
    height: 24px;
    margin-right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ability-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
  }

  .ability-title {
    font-weight: 500;
    margin-right: 8px;
  }

  .ability-damage {
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    background: rgba(0,0,0,0.1);
    padding: 2px 6px;
    border-radius: 12px;
  }

  .ability-description {
    font-size: 0.8rem;
    color: #4b5563;
    flex: 1;
  }

  .abilities-container {
    background: #f5f0e5; /* Tan color */
    border-radius: 12px;
    padding: 8px;
    padding-bottom: 16px;
    margin-top: 8px;
    border: 1px solid #e6e0d1; /* Slightly darker border */
  }
}

  /* Base animation keyframes */
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
  
  @keyframes pulse {
    0% { opacity: 0.8; }
    50% { opacity: 1; }
    100% { opacity: 0.8; }
  }
  
  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
    50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.6); }
    100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
  }
  
  @keyframes warp {
    0% { transform: scale(1) rotate(0deg); }
    33% { transform: scale(1.02) rotate(0.3deg); }
    66% { transform: scale(0.99) rotate(-0.3deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  
  @keyframes flicker {
    0% { opacity: 0.8; }
    10% { opacity: 1; }
    20% { opacity: 0.9; }
    30% { opacity: 1; }
    40% { opacity: 0.8; }
    60% { opacity: 1; }
    80% { opacity: 0.9; }
    100% { opacity: 0.8; }
  }

    /* Abilities grid layout - more robust version */
  .monster-abilities {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    min-width: 340px; /* Ensures at least two columns */
    width: 100%;
  }
  
  /* Ensure abilities container doesn't get too constrained */
  .abilities-container {
    background: #f5f0e5;
    border-radius: 12px;
    padding: 8px 12px 16px;
    margin-top: 8px;
    border: 1px solid #e6e0d1;
    width: 100%;
    min-width: 340px;
    overflow: visible;
  }
  
  /* Ensure ability cards maintain reasonable size */
  .ability-card {
    min-width: 150px;
    width: 100%;
    height: 100%;
  }

  .abilities-container {
  background: #f5f3e8;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e6e0d1;
  width: 100%; /* Take full width of parent */
  max-width: 100%; /* Prevent overflow */
  box-sizing: border-box; /* Include padding in width calculation */
  overflow: hidden; /* Prevent content from overflowing */
}

/* Keep the grid layout, but ensure it stays within bounds */
.monster-abilities {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* Style ability cards consistently */
.ability-card {
  min-width: 0; /* Allow cards to shrink if needed */
  width: 100%;
  box-sizing: border-box;
}

/* Add these to your createPartyManagerStyles method */

/* Updated HP bar fill colors */
.hp-bar-fill.high {
  background: #10b981;
}

.hp-bar-fill.medium {
  background: #f59e0b;
}

.hp-bar-fill.low {
  background: #ef4444;
}

/* Animation for monster cards */
@keyframes floatCard {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
}

/* Special styling for relationships */
.monster-relationships {
  border-top: 1px solid rgba(0,0,0,0.05);
  padding-top: 6px;
  margin-top: 6px;
}

/* Styling for empty slots to match new card style */
.empty-party-slot {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
  margin: 0 8px 16px 8px;
  transform: rotate(-2deg);
  transition: all 0.3s ease;
}

.empty-party-slot:hover {
  transform: rotate(-2deg) translateY(-5px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}

@keyframes pulseCombo {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

    `;

    return styleElement;
  }

  /**
   * Party Management Methods
   */

  // Add a monster to party (either active or reserve based on space)
  addMonster(monster) {
    // Clone the monster to avoid modifying the original bestiary data
    const newMonster = this.prepareMonster(monster);

    // Check if we have space in active party first
    if (this.party.active.length < this.party.maxActive) {
      this.party.active.push(newMonster);
      console.log(`Added ${newMonster.name} to active party`);
      // Update relationships whenever a monster is added
      this.updatePartyRelationships();
      return 'active';
    }

    // Check if we have space in reserve
    if (this.party.active.length + this.party.reserve.length < this.party.maxTotal) {
      this.party.reserve.push(newMonster);
      console.log(`Added ${newMonster.name} to reserve party`);
      return 'reserve';
    }

    // No space available
    console.warn('Party is full, cannot add monster');
    return null;
  }

  // Prepare a monster for party by adding additional properties needed for game
  prepareMonster(monster) {
    // Clone base monster data
    const base = JSON.parse(JSON.stringify(monster.data || monster));

    // Add gameplay properties
    const partyMonster = {
      id: base.id || `monster_${Date.now()}`,
      name: base.basic?.name || monster.name || 'Unknown Monster',
      type: base.basic?.type || 'Unknown',
      size: base.basic?.size || 'Medium',
      cr: base.basic?.cr || '0',
      abilities: base.abilities || {},
      stats: base.stats || {},
      traits: base.traits || {},
      // Use token data instead of thumbnail
      token: base.token || {
        data: monster.token?.data || null,
        url: monster.token?.url || null
      },

      // Game-specific properties
      level: 1,
      experience: 0,
      experienceToNext: 100,
      inventory: [],
      equipment: {
        weapon: null,
        armor: null
      },
      currentHP: base.stats?.hp?.average || 10,
      maxHP: base.stats?.hp?.average || 10,
      armorClass: base.stats?.ac || 10,
      monsterAbilities: this.generateAbilities(base)
    };

    return partyMonster;
  }

  // Generate abilities based on monster type
  generateAbilities(monster) {
    const abilities = [];

    // Basic attack for all monsters
    abilities.push({
      name: 'Attack',
      description: `Make a basic attack against one target.`,
      type: 'attack',
      damage: '1d6+' + this.getDamageModifier(monster)
    });

    // Add type-specific abilities
    switch (monster.basic?.type?.toLowerCase()) {
      case 'dragon':
        abilities.push({
          name: 'Breath Weapon',
          description: 'Exhale destructive energy in a cone. All creatures in the area must make a saving throw.',
          type: 'area',
          damage: '2d6'
        });
        break;
      case 'undead':
        abilities.push({
          name: 'Life Drain',
          description: 'Drain the life force from a target, healing for half the damage dealt.',
          type: 'attack',
          damage: '1d6',
          healing: true
        });
        break;
      case 'fiend':
        abilities.push({
          name: 'Hellish Rebuke',
          description: 'Counter-attack when hit, dealing fire damage to the attacker.',
          type: 'reaction',
          damage: '2d6'
        });
        break;
      case 'fey':
        abilities.push({
          name: 'Charm',
          description: 'Attempt to charm an enemy, preventing them from attacking for one turn.',
          type: 'control',
          duration: 1
        });
        break;
      case 'beast':
        abilities.push({
          name: 'Rend',
          description: 'A powerful attack that causes bleeding damage over time.',
          type: 'attack',
          damage: '1d4',
          dot: '1d4',
          dotDuration: 2
        });
        break;
      case 'humanoid':
        abilities.push({
          name: 'Tactical Advantage',
          description: 'Grant advantage to the next ally to attack this target.',
          type: 'support'
        });
        break;
      // Add more types as needed
    }

    // If creature is large or bigger, add a slam attack
    if (['Large', 'Huge', 'Gargantuan'].includes(monster.basic?.size)) {
      abilities.push({
        name: 'Slam',
        description: 'A powerful slam attack that can knock enemies back.',
        type: 'attack',
        damage: '2d6+' + this.getDamageModifier(monster),
        effect: 'knockback'
      });
    }

    return abilities;
  }

  // Helper to get damage modifier based on monster stats
  getDamageModifier(monster) {
    if (!monster.abilities) return 0;

    // Use the highest of STR or DEX
    const strMod = monster.abilities?.str?.modifier || 0;
    const dexMod = monster.abilities?.dex?.modifier || 0;

    return Math.max(strMod, dexMod);
  }

  // Move monster between active and reserve
  moveMonster(monsterId, destination) {
    // Find which array the monster is in
    let source = null;
    let sourceArray = null;
    let destArray = null;

    if (destination === 'active') {
      sourceArray = this.party.reserve;
      destArray = this.party.active;
      source = 'reserve';
    } else if (destination === 'reserve') {
      sourceArray = this.party.active;
      destArray = this.party.reserve;
      source = 'active';
    } else {
      console.error('Invalid destination:', destination);
      return false;
    }

    // Check if we have space in destination
    if (destination === 'active' && destArray.length >= this.party.maxActive) {
      console.warn('Active party is full');
      return false;
    }

    // Find monster in source array
    const monsterIndex = sourceArray.findIndex(m => m.id === monsterId);
    if (monsterIndex === -1) {
      console.error(`Monster ${monsterId} not found in ${source} party`);
      return false;
    }

    // Move monster
    const monster = sourceArray.splice(monsterIndex, 1)[0];
    destArray.push(monster);

    console.log(`Moved ${monster.name} from ${source} to ${destination}`);
    // Update relationships when party composition changes
    this.updatePartyRelationships();
    return true;
  }

// Add this method to PartyManager
dismissMonster(monsterId) {
  const monster = this.findMonster(monsterId);
  if (!monster) {
    console.error(`Monster ${monsterId} not found`);
    return false;
  }
  
  // Return equipment to inventory first
  if (monster.equipment) {
    // Check weapon slot
    if (monster.equipment.weapon) {
      console.log(`Returning ${monster.name}'s weapon to inventory`);
      // We don't need to add it back to inventory since our getPlaceholderEquipment 
      // is currently just generating items, not removing them from inventory
      
      // But for future inventory implementation, you'd add code here to 
      // return the item to the inventory
      monster.equipment.weapon = null;
    }
    
    // Check armor slot
    if (monster.equipment.armor) {
      console.log(`Returning ${monster.name}'s armor to inventory`);
      // Same logic as for weapons
      monster.equipment.armor = null;
    }
  }
  
  // Remove from appropriate array
  const activeIndex = this.party.active.findIndex(m => m.id === monsterId);
  if (activeIndex !== -1) {
    this.party.active.splice(activeIndex, 1);
    console.log(`Removed ${monster.name} from active party`);
  } else {
    const reserveIndex = this.party.reserve.findIndex(m => m.id === monsterId);
    if (reserveIndex !== -1) {
      this.party.reserve.splice(reserveIndex, 1);
      console.log(`Removed ${monster.name} from reserve party`);
    }
  }
  
  // Update relationships
  this.updatePartyRelationships();
  
  // Save party
  this.saveParty();
  
  return true;
}

// Add this method to show confirmation dialog
showDismissConfirmation(monster) {
  if (!this.dismissDrawer) return;
  
  this.dismissDrawer.label = `Dismiss ${monster.name}`;
  
  const content = this.dismissDrawer.querySelector('.dismiss-drawer-content');
  content.innerHTML = `
    <div style="text-align: center; padding: 16px;">
      <span class="material-icons" style="font-size: 48px; color:rgb(177, 0, 0); margin-bottom: 16px;">warning</span>
      <h2 style="margin: 0 0 16px 0; color: #333;">Are you sure?</h2>
      <p style="margin-bottom: 8px;">Are you sure you want to dismiss <strong>${monster.name}</strong>?</p>
      <p style="color: #666; font-style: italic;">They will leave your party permanently.</p>
      ${(monster.equipment?.weapon || monster.equipment?.armor) ? 
        `<p style="margin-top: 16px; color: #3b82f6;">Their equipment will be returned to your inventory.</p>` : ''}
    </div>
  `;
  
  // Store monster ID for the confirm button
  this.dismissDrawer.dataset.monsterId = monster.id;
  
  // Show drawer
  this.dismissDrawer.show();
}

  // Remove monster from party entirely
  removeMonster(monsterId) {
    // Check active party first
    const activeIndex = this.party.active.findIndex(m => m.id === monsterId);
    if (activeIndex !== -1) {
      const monster = this.party.active.splice(activeIndex, 1)[0];
      console.log(`Removed ${monster.name} from active party`);
      // Update relationships whenever a monster is removed
      this.updatePartyRelationships();
      return true;
    }

    // Check reserve party
    const reserveIndex = this.party.reserve.findIndex(m => m.id === monsterId);
    if (reserveIndex !== -1) {
      const monster = this.party.reserve.splice(reserveIndex, 1)[0];
      console.log(`Removed ${monster.name} from reserve party`);
      return true;
    }

    console.error(`Monster ${monsterId} not found in party`);
    return false;
  }

  // Find monster by ID
  findMonster(monsterId) {
    // Check active party first
    const activeMonster = this.party.active.find(m => m.id === monsterId);
    if (activeMonster) return activeMonster;

    // Check reserve party
    const reserveMonster = this.party.reserve.find(m => m.id === monsterId);
    if (reserveMonster) return reserveMonster;

    return null;
  }

  /**
   * Equipment Methods
   */

// Modified equipItem method to fix ID mismatch issue
equipItem(monsterId, slot, itemId) {
  const monster = this.findMonster(monsterId);
  if (!monster) {
    console.error(`Monster with ID ${monsterId} not found`);
    return false;
  }

  // Check if slot is valid
  if (!['weapon', 'armor'].includes(slot)) {
    console.error(`Invalid equipment slot: ${slot}`);
    return false;
  }
  
  console.log(`Equipping item ${itemId} to ${monster.name}'s ${slot} slot`);
  
  // 1. FIND THE ITEM FROM THE CORRECT INVENTORY
  let item = null;
  let itemSource = null;
  
  // Check for "none" to handle unequipping
  if (itemId === 'none') {
    console.log(`Unequipping ${monster.name}'s ${slot}`);
    if (monster.equipment[slot]) {
      // Return item to appropriate inventory if it was from local inventory
      if (monster.equipment[slot].source !== '3d-inventory') {
        if (slot === 'weapon') {
          this.inventory.weapons.push(monster.equipment[slot]);
        } else {
          this.inventory.armor.push(monster.equipment[slot]);
        }
      }
    }
    
    // Remove equipment
    monster.equipment[slot] = null;
    this.updateMonsterStats(monster);
    this.saveParty();
    
    console.log(`Unequipped ${slot} from ${monster.name}`);
    this.showToast(`Unequipped ${monster.name}'s ${slot}`, 'success');
    return true;
  }
  
  // First check Scene3D inventory (world items)
  if (this.scene3D && typeof this.scene3D.getInventoryItems === 'function') {
    // Get all potential items from Scene3D
    const sceneItems = this.scene3D.getInventoryItems();
    
    // DEBUG: Log all item IDs to see what's available
    console.log('Available items from 3D world:');
    sceneItems.forEach(i => console.log(`- Item: ${i.name}, ID: ${i.id}, Type: ${typeof i.id}`));
    
    // Convert itemId to both string and number for more robust comparison
    const itemIdStr = String(itemId);
    const itemIdNum = Number(itemId);
    
    // Try to find item matching either string or number ID
    const matchingItem = sceneItems.find(i => 
      String(i.id) === itemIdStr || 
      (i.id === itemIdNum) ||
      // Also try with "prop-" prefix that might be getting added
      String(i.id) === `prop-${itemIdStr}` ||
      String(itemId).replace('prop-', '') === String(i.id)
    );
    
    if (matchingItem) {
      // Important: Make a deep copy of the item to avoid reference issues
      item = JSON.parse(JSON.stringify(matchingItem));
      itemSource = '3d-inventory';
      console.log('Found item in 3D world inventory:', item);
    } else {
      console.log(`Could not find item with ID ${itemId} in 3D world inventory`);
    }
  }
  
  // If not found in Scene3D, check local inventory
  if (!item) {
    const localItems = (slot === 'weapon') ? this.inventory.weapons : this.inventory.armor;
    
    // DEBUG: Log all local items
    console.log(`Available items in local ${slot} inventory:`);
    localItems.forEach(i => console.log(`- Item: ${i.name}, ID: ${i.id}, Type: ${typeof i.id}`));
    
    // Use same flexible ID matching
    const itemIdStr = String(itemId);
    const itemIdNum = Number(itemId);
    
    const matchingItem = localItems.find(i => 
      String(i.id) === itemIdStr || 
      (i.id === itemIdNum) ||
      String(i.id) === `prop-${itemIdStr}` ||
      String(itemId).replace('prop-', '') === String(i.id)
    );
    
    if (matchingItem) {
      item = { ...matchingItem }; // Clone to avoid reference issues
      itemSource = 'local-inventory';
      console.log('Found item in local inventory:', item);
    } else {
      console.log(`Could not find item with ID ${itemId} in local inventory`);
    }
  }
  
  // Alternative approach: If still no item found, try direct inventory lookup
  // This is a fallback for Scene3D's specific inventory format
  if (!item && this.scene3D && this.scene3D.inventory) {
    console.log('Attempting direct inventory lookup as fallback');
    // Note: inventory in Scene3D might be a Map, not an array
    if (this.scene3D.inventory instanceof Map) {
      if (this.scene3D.inventory.has(itemId)) {
        const invItem = this.scene3D.inventory.get(itemId);
        if (invItem && invItem.prop) {
          console.log('Found item directly in Scene3D inventory Map:', invItem.prop);
          
          // Convert to proper equipment format
          item = {
            id: invItem.prop.id || itemId,
            name: invItem.prop.name || 'Unknown Item',
            type: slot, // Use the slot we're trying to fill
            image: invItem.prop.image || null,
            damageBonus: slot === 'weapon' ? Math.ceil(Math.random() * 3) : 0,
            acBonus: slot === 'armor' ? Math.ceil(Math.random() * 3) : 0,
            source: '3d-inventory'
          };
          itemSource = '3d-inventory';
        }
      }
    }
  }
  
  // If no item found, return error
  if (!item) {
    console.error(`Item ${itemId} not found in any inventory`);
    
    // Add extra error info for debugging
    console.error(`Unable to find item with ID ${itemId} in either inventory.`);
    console.error(`ItemID type: ${typeof itemId}`);
    
    // For debugging only: Create a placeholder item as a last resort
    // Remove this for production code
    if (window.DEBUG_MODE) {
      console.warn('DEBUG MODE: Creating placeholder item');
      item = {
        id: itemId,
        name: slot === 'weapon' ? 'Debug Weapon' : 'Debug Armor',
        type: slot,
        damageBonus: slot === 'weapon' ? 2 : 0,
        acBonus: slot === 'armor' ? 2 : 0,
        source: 'debug'
      };
      itemSource = 'debug';
    } else {
      return false;
    }
  }
  
  // 2. UNEQUIP CURRENT ITEM IF ANY
  if (monster.equipment[slot]) {
    console.log(`Unequipping current ${slot}: ${monster.equipment[slot].name}`);
    
    // Return the item to the appropriate inventory
    if (monster.equipment[slot].source === '3d-inventory') {
      console.log('Item would return to 3D inventory (not implemented)');
    } else {
      if (slot === 'weapon') {
        this.inventory.weapons.push(monster.equipment[slot]);
      } else if (slot === 'armor') {
        this.inventory.armor.push(monster.equipment[slot]);
      }
    }
  }
  
  // 3. EQUIP NEW ITEM TO MONSTER
  console.log(`Equipping ${item.name} to ${monster.name}`);
  monster.equipment[slot] = {
    id: item.id,
    name: item.name,
    type: item.type,
    image: item.image || null,
    damageBonus: item.damageBonus || 0,
    acBonus: item.acBonus || 0,
    source: itemSource
  };
  
  console.log(`Equipped item details:`, monster.equipment[slot]);
  
  // 4. REMOVE ITEM FROM SOURCE INVENTORY
  if (itemSource === '3d-inventory' && this.scene3D && typeof this.scene3D.removeFromInventory === 'function') {
    console.log(`Removing item ${item.id} from 3D inventory`);
    this.scene3D.removeFromInventory(item.id);
  } else {
    // Remove from local inventory
    if (slot === 'weapon') {
      this.inventory.weapons = this.inventory.weapons.filter(w => w.id !== item.id);
    } else if (slot === 'armor') {
      this.inventory.armor = this.inventory.armor.filter(a => a.id !== item.id);
    }
  }
  
  // 5. UPDATE MONSTER STATS
  this.updateMonsterStats(monster);
  
  // 6. SAVE PARTY STATE
  this.saveParty();
  
  // 7. Show a success toast
  this.showToast(`Equipped ${item.name} to ${monster.name}`, 'success');
  
  // 8. FORCE UI REFRESH with a longer timeout to ensure updates are processed
  setTimeout(() => {
    console.log("Executing delayed UI refresh for monster details");
    
    // Double-check that monster data has been updated
    const updatedMonster = this.findMonster(monsterId);
    console.log("Updated monster equipment status:", {
      slot: slot,
      equipped: !!updatedMonster.equipment[slot],
      item: updatedMonster.equipment[slot]
    });
    
    // Update the monster detail view
    const detailsPanel = this.partyDialog?.querySelector('.party-details');
    if (detailsPanel) {
      detailsPanel.innerHTML = '';
      const detailView = this.createMonsterDetailView(updatedMonster);
      detailsPanel.appendChild(detailView);
    }
  }, 300);
  
  return true;
}

// Unequip item from monster
unequipItem(monsterId, slot) {
  const monster = this.findMonster(monsterId);
  if (!monster) {
    console.error(`Monster ${monsterId} not found`);
    return false;
  }

  // Check if slot is valid
  if (!['weapon', 'armor'].includes(slot)) {
    console.error(`Invalid equipment slot: ${slot}`);
    return false;
  }

  // Check if monster has item equipped
  if (!monster.equipment[slot]) {
    console.warn(`Monster ${monster.name} has no ${slot} equipped`);
    return false;
  }

  // Get the item before unequipping
  const item = monster.equipment[slot];
  console.log(`Unequipping ${item.name} from ${monster.name}'s ${slot} slot`);

  // Unequip item
  monster.equipment[slot] = null;

  // Update monster stats
  this.updateMonsterStats(monster);

  console.log(`Successfully unequipped ${item.name} from ${monster.name}`);
  console.log("Monster after unequipping:", monster);
  
  // Save party after unequipping
  this.saveParty();
  
  return true;
}


  // Get appropriate RPG Awesome icon for weapon type
  getWeaponIcon(weapon) {
    // Default icon
    if (!weapon) return 'ra-broadsword';

    // Map weapon names to RPG Awesome icons
    const name = weapon.name.toLowerCase();

    if (name.includes('sword') || name.includes('blade')) {
      return 'ra-broadsword';
    }
    if (name.includes('axe')) {
      return 'ra-axe';
    }
    if (name.includes('mace') || name.includes('hammer')) {
      return 'ra-hammer';
    }
    if (name.includes('staff') || name.includes('wand')) {
      return 'ra-wizard-staff';
    }
    if (name.includes('bow')) {
      return 'ra-bow';
    }
    if (name.includes('dagger') || name.includes('knife')) {
      return 'ra-dagger';
    }
    if (name.includes('spear') || name.includes('pike')) {
      return 'ra-spear';
    }
    if (name.includes('crossbow')) {
      return 'ra-crossbow';
    }
    if (name.includes('flail')) {
      return 'ra-ball-and-chain';
    }

    // Default for unknown weapon types
    return 'ra-broadsword';
  }

  // Get appropriate RPG Awesome icon for armor type
  getArmorIcon(armor) {
    // Default icon
    if (!armor) return 'ra-shield';

    // Map armor names to RPG Awesome icons
    const name = armor.name.toLowerCase();

    if (name.includes('leather')) {
      return 'ra-leather-armor';
    }
    if (name.includes('chain') || name.includes('mail')) {
      return 'ra-chain-mail';
    }
    if (name.includes('plate')) {
      return 'ra-plate-armor';
    }
    if (name.includes('scale')) {
      return 'ra-dragon-scales';
    }
    if (name.includes('shield')) {
      return 'ra-round-shield';
    }
    if (name.includes('robe') || name.includes('cloth')) {
      return 'ra-fizzing-flask'; // Representing mage armor
    }

    // Default for unknown armor types
    return 'ra-shield';
  }

  // Update monster stats based on equipment
  updateMonsterStats(monster) {
    // Base AC calculation
    let baseAC = monster.armorClass || 10;

    // Apply armor bonus
    if (monster.equipment.armor) {
      baseAC += monster.equipment.armor.acBonus || 0;
    }

    // Set updated AC
    monster.armorClass = baseAC;

    // Update damage based on weapon
    if (monster.equipment.weapon && monster.monsterAbilities) {
      // Find basic attack ability
      const attackAbility = monster.monsterAbilities.find(a => a.name === 'Attack');
      if (attackAbility) {
        // Update damage with weapon bonus
        const baseDamage = attackAbility.damage.split('+')[0];
        const damageBonus = parseInt(this.getDamageModifier(monster)) + (monster.equipment.weapon.damageBonus || 0);
        attackAbility.damage = `${baseDamage}+${damageBonus}`;
      }
    }
  }

  /**
   * Monster Level & Experience
   */

  // Award experience to a monster
  awardExperience(monsterId, amount) {
    const monster = this.findMonster(monsterId);
    if (!monster) {
      console.error(`Monster ${monsterId} not found`);
      return false;
    }

    monster.experience += amount;
    console.log(`${monster.name} gained ${amount} experience (total: ${monster.experience})`);

    // Check for level up
    if (monster.experience >= monster.experienceToNext) {
      this.levelUpMonster(monster);
    }

    return true;
  }

  // Level up a monster
  levelUpMonster(monster) {
    // Increase level
    monster.level += 1;

    // Increase stats based on level
    monster.maxHP = Math.floor(monster.maxHP * 1.1);  // 10% HP increase per level
    monster.currentHP = monster.maxHP;  // Heal to full on level up

    // Set new experience threshold for next level
    monster.experience = 0;
    monster.experienceToNext = Math.floor(monster.experienceToNext * 1.5);

    console.log(`${monster.name} leveled up to level ${monster.level}!`);

    // Check if monster learns new ability at this level
    this.checkForNewAbilities(monster);

    return true;
  }

  // Check if monster learns new abilities at current level
  checkForNewAbilities(monster) {
    // For simplicity, learn a new ability every 3 levels
    if (monster.level % 3 === 0) {
      // Add a new ability based on type
      const newAbility = this.generateNewAbility(monster);
      if (newAbility) {
        if (!monster.monsterAbilities) {
          monster.monsterAbilities = [];
        }
        monster.monsterAbilities.push(newAbility);
        console.log(`${monster.name} learned a new ability: ${newAbility.name}`);
      }
    }
  }

  // Generate a new ability based on monster's type and level
  generateNewAbility(monster) {
    const type = monster.type?.toLowerCase();
    const level = monster.level;

    // Pool of possible abilities based on type
    const abilityPool = [];

    // Add generic abilities available to all types
    abilityPool.push(
      {
        name: 'Defensive Stance',
        description: 'Take a defensive posture, gaining +2 AC until next turn.',
        type: 'defense',
        duration: 1
      },
      {
        name: 'Focus Attack',
        description: 'Focus your next attack for increased accuracy and damage.',
        type: 'buff',
        duration: 1
      }
    );

    // Add type-specific advanced abilities
    switch (type) {
      case 'dragon':
        abilityPool.push(
          {
            name: 'Wing Buffet',
            description: 'Strike all nearby enemies with powerful wings.',
            type: 'area',
            damage: '1d8+' + this.getDamageModifier(monster)
          },
          {
            name: 'Draconic Resistance',
            description: 'Gain temporary resistance to damage.',
            type: 'buff',
            duration: 3
          }
        );
        break;
      case 'undead':
        abilityPool.push(
          {
            name: 'Terrifying Presence',
            description: 'Frighten nearby enemies, reducing their attack accuracy.',
            type: 'debuff',
            duration: 2
          },
          {
            name: 'Drain Vitality',
            description: 'Drain life from all nearby enemies, healing yourself.',
            type: 'area',
            damage: '1d6',
            healing: true
          }
        );
        break;
      // Add more types as needed
    }

    // Select a random ability from the pool
    if (abilityPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * abilityPool.length);
      return abilityPool[randomIndex];
    }

    return null;
  }

  /**
   * UI Methods
   */

  showPartyManager() {
    // Check for starter monster if party is empty
    if (this.party.active.length === 0 && this.party.reserve.length === 0) {
      this.checkForStarterMonster().catch(error =>
        console.error('Error checking for starter monster:', error)
      );
    }
    // Add our custom styles to the document
    document.head.appendChild(this.createPartyManagerStyles());
  
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'party-overlay';
  
    // Create main container
    const container = document.createElement('div');
    container.className = 'party-container';
      // Position relative is required for contained drawers
  container.style.position = 'relative';
  

        const header = document.createElement('div');
    header.className = 'party-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center;">
        <img src="images/pawns.png" alt="Monster Party" style="width: 24px; height: 24px; margin-right: 8px;">
        <h1 style="margin: 0; font-size: 1.25rem;">Monster Party</h1>
      </div>
      <button class="close-btn" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 50%; transition: background 0.2s;">
        <span class="material-icons">close</span>
      </button>
    `;
  
    // Create content area (sidebar + details)
    const content = document.createElement('div');
    content.className = 'party-content';
  
    // Create sidebar with tabs
    const sidebar = document.createElement('div');
    sidebar.className = 'party-sidebar';
  
    // Create tab buttons
    const tabButtons = document.createElement('div');
    tabButtons.className = 'party-tab-buttons';
    tabButtons.innerHTML = `
      <button class="party-tab active" data-tab="active">
        Active (${this.party.active.length}/${this.party.maxActive})
      </button>
      <button class="party-tab" data-tab="reserve">
        Reserve (${this.party.reserve.length})
      </button>
    `;
  
    // Create party list container
    const partyList = document.createElement('div');
    partyList.className = 'party-list';
  
    // Create active party list (default view)
    const activeList = document.createElement('div');
    activeList.className = 'active-monster-list';
  
    // Add active monsters
    if (this.party.active.length > 0) {
      this.party.active.forEach((monster, index) => {
        const card = this.createMonsterCard(monster, 'active', index % 2 !== 0);
        activeList.appendChild(card);
      });
  
      // Add empty slots
      for (let i = this.party.active.length; i < this.party.maxActive; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'empty-party-slot';
        emptySlot.innerHTML = `
          <span class="material-icons" style="margin-right: 8px;">add_circle_outline</span>
          Empty Slot
        `;
        activeList.appendChild(emptySlot);
      }
    } else {
      // Empty active party message
      activeList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.8);">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">sentiment_dissatisfied</span>
          <p style="margin: 0 0 8px 0; font-size: 1.1rem;">Your active party is empty</p>
          <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">You need monsters in your party to participate in combat</p>
        </div>
      `;
    }
  
    // Create reserve party list (hidden initially)
    const reserveList = document.createElement('div');
    reserveList.className = 'reserve-monster-list';
    reserveList.style.display = 'none';
  
    // Add reserve monsters
    if (this.party.reserve.length > 0) {
      this.party.reserve.forEach(monster => {
        const card = this.createMonsterCard(monster, 'reserve');
        reserveList.appendChild(card);
      });
    } else {
      // Empty reserve message
      reserveList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.8);">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">inventory_2</span>
          <p style="margin: 0 0 8px 0; font-size: 1.1rem;">Your reserve is empty</p>
          <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">Monsters will be stored here when your active party is full</p>
        </div>
      `;
    }

    const testBtn = header.querySelector('.test-save-btn');
if (testBtn) {
  testBtn.addEventListener('click', () => {
    this.testSaveLoad();
  });
}
  
    // Add lists to container
    partyList.appendChild(activeList);
    partyList.appendChild(reserveList);
  
    // Create details panel (right side)
    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'party-details';
  
    // Initial empty state for details
    detailsPanel.innerHTML = `
      <div class="empty-details-message">
        <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">touch_app</span>
        <h2 style="margin: 0 0 8px 0; font-size: 1.5rem;">Select a Monster</h2>
        <p style="margin: 0; max-width: 400px; opacity: 0.8;">
          Click on any monster card to view detailed information, abilities, and relationship data
        </p>
      </div>
    `;
    
    this.renderPartyAffinityVisualization(detailsPanel);

    // Assemble the UI
    sidebar.appendChild(tabButtons);
    sidebar.appendChild(partyList);
  
    content.appendChild(sidebar);
    content.appendChild(detailsPanel);
  
    container.appendChild(header);
    container.appendChild(content);
    // Create the equipment drawer that will be contained within the container
    const equipmentDrawer = document.createElement('sl-drawer');
    equipmentDrawer.label = "Equipment";
    equipmentDrawer.placement = "end"; // Come in from the right side
    equipmentDrawer.setAttribute('contained', ''); // Make it contained within parent
    equipmentDrawer.style.setProperty('--size', '50%'); // Width of the drawer
    
    equipmentDrawer.innerHTML = `
      <div class="equipment-drawer-content">
        <!-- Content will be populated when opened -->
      </div>
      <div slot="footer">
        <sl-button variant="neutral" class="close-drawer-btn">Close</sl-button>
      </div>
    `;
    
    // Add the drawer to the container BEFORE adding container to the overlay
    container.appendChild(equipmentDrawer);

    const dismissDrawer = document.createElement('sl-drawer');
dismissDrawer.label = "Dismiss Monster";
dismissDrawer.placement = "end";
dismissDrawer.setAttribute('contained', '');
dismissDrawer.style.setProperty('--size', '40%');
dismissDrawer.innerHTML = `
  <div class="dismiss-drawer-content">
    <!-- Content will be populated when opened -->
  </div>
  <div slot="footer">
    <sl-button variant="neutral" class="cancel-dismiss-btn">Cancel</sl-button>
    <sl-button variant="danger" class="confirm-dismiss-btn">Dismiss Monster</sl-button>
  </div>
`;
container.appendChild(dismissDrawer);
this.dismissDrawer = dismissDrawer;

// Add cancel button handler
dismissDrawer.querySelector('.cancel-dismiss-btn').addEventListener('click', () => {
  // this.refreshPartyDialog();
  dismissDrawer.hide();
});
    
    // Now add the container to the overlay
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  
    // Reference to the dialog for event handlers
    this.partyDialog = overlay;
    this.dialogContainer = container;
    this.equipmentDrawer = equipmentDrawer;
    
    // Add close button handler for the drawer
    equipmentDrawer.querySelector('.close-drawer-btn').addEventListener('click', () => {
      equipmentDrawer.hide();
    });

    // Add this in showPartyManager after setting up the dismissDrawer
dismissDrawer.querySelector('.confirm-dismiss-btn').addEventListener('click', () => {
  const monsterId = this.dismissDrawer.dataset.monsterId;
  if (monsterId) {
    this.dismissMonster(monsterId);
    this.dismissDrawer.hide();
    this.refreshPartyDialog();
    this.showToast(`Monster has been dismissed from your party.`, 'info');
  }
});
  
    // Add event listeners
    this.setupPartyDialogEvents(overlay, container, activeList, reserveList, detailsPanel);
  
    // Animate in
    setTimeout(() => {
      overlay.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }, 10);
  }
  

  createMonsterCard(monster, type, isAlt = false) {
    // Calculate HP percentage
    const hpPercent = Math.floor((monster.currentHP / monster.maxHP) * 100);
    let hpColorClass = 'high';
    if (hpPercent < 30) {
      hpColorClass = 'low';
    } else if (hpPercent < 70) {
      hpColorClass = 'medium';
    }
  
    // Get monster type color and background
    const bgColor = this.getMonsterTypeColor(monster.type);
    const lightBgColor = this.getLightVersionOfColor(bgColor);
  
    // Get relationship data
    const relationships = this.getMonstersWithAffinity(monster.id) || [];
  
    // Calculate tilt angle based on monster ID (consistent per monster)
    // This creates a random but consistent tilt between -5 and 5 degrees
    const idNum = monster.id.toString().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const tiltAngle = ((idNum % 11) - 5) || (isAlt ? 3 : -3);
  
    // Create the card
    const card = document.createElement('div');
    card.className = `monster-card ${type}-party`;
    card.setAttribute('data-monster-id', monster.id);
    card.setAttribute('data-monster-type', monster.type);
  
    // Get token source
    const tokenSource = monster.token?.data || (typeof monster.token === 'string' ? monster.token : null);
    
    // Get animation style
    const animation = this.getMonsterAnimation(monster.type, monster.name);
    
    // Apply tilt to the whole card
    card.style.transform = `rotate(${tiltAngle}deg)`;
    card.style.transition = 'all 0.3s ease';
    card.style.margin = '0 8px 16px 8px'; // Add some margin for the tilt
    
    // Add hover effect event listeners
    card.addEventListener('mouseenter', () => {
      card.style.transform = `rotate(${tiltAngle}deg) translateY(-5px)`;
      card.style.boxShadow = '0 12px 20px rgba(0, 0, 0, 0.3)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = `rotate(${tiltAngle}deg)`;
      card.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    });
  
    // Monster card content - new tilted design with larger asymmetric token
    card.innerHTML = `
      <div class="card-base" style="
        width: 200px;
        background: linear-gradient(to bottom, #f8fafc, #e2e8f0);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid ${bgColor};
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      ">
        <!-- Top Banner with Monster Name and Level -->
        <div class="card-banner" style="
          height: 50px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: linear-gradient(135deg, ${bgColor}dd, ${bgColor});
          border-bottom: 3px solid ${bgColor};
        ">
          <!-- Monster Name (Now on the left) -->
          <div class="monster-name" style="
            font-weight: bold;
            color: white;
            font-size: 1rem;
            max-width: 130px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          ">${monster.name}</div>
          
          <!-- Level Badge (Stays on the right) -->
          <div class="level-badge" style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: white;
            color: ${bgColor};
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            border: 2px solid ${bgColor};
          ">
            ${monster.level || 1}
          </div>
          
          <!-- Decorative Elements -->
          <div class="decorative-elements" style="
            position: absolute;
            inset: 0;
            overflow: hidden;
            opacity: 0.2;
            z-index: 0;
          ">
            ${Array.from({ length: 5 }).map(() => {
              const size = Math.floor(Math.random() * 6 + 3);
              const top = Math.floor(Math.random() * 100);
              const left = Math.floor(Math.random() * 100);
              return `<div style="
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background-color: white;
                top: ${top}%;
                left: ${left}%;
              "></div>`;
            }).join('')}
          </div>
        </div>
        
        <!-- Monster Portrait Section - Asymmetrically positioned -->
        <div class="portrait-section" style="
          position: relative;
          overflow: visible;
          padding: 16px 16px 8px;
          min-height: 60px;
        ">
          <!-- Large Token/Portrait -->
          <div class="monster-avatar" style="
            position: absolute;
            z-index: 10;
            top: -5px;
            left: 10px;
            width: 100px;
            height: 100px;
            transform: rotate(${-tiltAngle * 0.7}deg);
            transition: transform 0.3s ease-out, filter 0.3s ease;
            filter: drop-shadow(0 0 4px rgba(0,0,0,0.2));
          ">
            <!-- Token Circle with Border -->
            <div style="
              position: relative;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              overflow: hidden;
              border: 4px solid ${bgColor};
              background-color: #e5e7eb;
            ">
              ${tokenSource ?
                `<img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                `<div style="
                  position: absolute;
                  inset: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 60px;
                  font-weight: bold;
                  color: ${bgColor};
                ">${monster.name.charAt(0)}</div>`
              }
              
              <!-- Glare Effect -->
              <div style="
                position: absolute;
                top: 0;
                left: 25%;
                right: 0;
                height: 33%;
                background-color: white;
                opacity: 0.2;
                transform: rotate(-45deg);
                border-radius: 50% 50% 0 0 / 100% 100% 0 0;
              "></div>
            </div>
          </div>
          
          <!-- Monster Type Info (Name was moved to top) -->
          <div class="monster-info" style="
            margin-left: 100px;
            min-height: 40px;
            display: flex;
            align-items: center;
          ">
            <div class="monster-type" style="
              display: inline-block;
              padding: 4px 10px;
              border-radius: 20px;
              background-color: ${lightBgColor};
              color: ${bgColor};
              font-size: 0.8rem;
              font-weight: 500;
            ">
              ${monster.size} ${monster.type}
            </div>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="monster-stats" style="
          background-color: white;
          padding: 12px;
          border-top: 1px solid #f0f0f0;
        ">
          <!-- HP Bar -->
          <div class="hp-bar-label" style="
            display: flex; 
            justify-content: space-between;
            font-size: 0.75rem;
            margin-bottom: 4px;
            color: #666;
          ">
            <span>HP</span>
            <span>${monster.currentHP}/${monster.maxHP}</span>
          </div>
          
          <div class="hp-bar-bg" style="
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 8px;
          ">
            <div class="hp-bar-fill ${hpColorClass}" style="
              height: 100%;
              width: ${hpPercent}%;
              border-radius: 3px;
              transition: width 0.3s ease;
            "></div>
          </div>
          
          <!-- Monster footer with AC and equipment -->
          <div class="monster-footer" style="
            display: flex;
            font-size: 0.75rem;
            color: #666;
            justify-content: space-between;
            align-items: center;
          ">
            <div class="ac-display" style="
              display: flex;
              align-items: center;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: #f3f4f6;
                border: 2px solid ${bgColor};
                color: #374151;
                font-weight: bold;
                font-size: 0.8rem;
                margin-right: 4px;
              ">
                ${monster.armorClass}
              </div>
              <span style="font-size: 0.7rem; color: #6b7280;">AC</span>
            </div>
            
            <!-- Equipment icons -->
<div class="equipment-icons" style="
  display: flex;
  gap: 4px;
">
  ${monster.equipment?.weapon ? 
    `<div class="equipment-icon weapon-icon" title="${monster.equipment.weapon.name}" style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #fee2e2;
      color: #ef4444;
      font-size: 0.7rem;
      font-weight: bold;
    "><i class="ra ra-sword"></i></div>` : ''
  }
  
  ${monster.equipment?.armor ? 
    `<div class="equipment-icon armor-icon" title="${monster.equipment.armor.name}" style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #dbeafe;
      color: #3b82f6;
      font-size: 0.7rem;
      font-weight: bold;
    "><i class="ra ra-helmet ra-fw"></i></div>` : ''
  }

  ${this.hasAvailableCombo(monster.id) ? `
    <div class="equipment-icon combo-icon" title="Has combo ability!" style="
      background-color: rgba(74, 222, 128, 0.2); 
      border: 1px solid #4ade80;
      color: #4ade80;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span class="material-icons" style="font-size: 14px;">group</span>
    </div>` : ''
  }
</div>
          </div>
          
          ${relationships.length > 0 ?
            `<div class="monster-relationships" style="
              margin-top: 8px; 
              font-size: 0.75rem; 
              color: #666;
              border-top: 1px solid rgba(0,0,0,0.05);
              padding-top: 6px;
            ">
              <div style="
                display: flex; 
                align-items: center; 
                gap: 4px;
              ">
                <span class="material-icons" style="font-size: 14px; color: #ff6b6b;">favorite</span>
                <span>Affinity with: ${relationships.map(r => {
                  // Find monster name
                  const relatedMonster = [...this.party.active, ...this.party.reserve].find(m => m.id === r.monsterId);
                  return relatedMonster ? relatedMonster.name : '';
                }).filter(Boolean).join(', ')}</span>
              </div>
            </div>` : ''
          }
        </div>
      </div>
    `;
  
    const cardBase = card.querySelector('.card-base');
    const monsterAvatar = card.querySelector('.monster-avatar');
    
    card.addEventListener('mouseenter', () => {
      monsterAvatar.style.transform = `rotate(${-tiltAngle * 0.7}deg) scale(1.05)`;
      monsterAvatar.style.filter = 'drop-shadow(0 0 8px rgba(0,0,0,0.4))';
    });
    
    card.addEventListener('mouseleave', () => {
      monsterAvatar.style.transform = `rotate(${-tiltAngle * 0.7}deg)`;
      monsterAvatar.style.filter = 'drop-shadow(0 0 4px rgba(0,0,0,0.2))';
    });
  
    return card;
  }
  
  // Add this helper method to PartyManager to get lighter version of type colors
  getLightVersionOfColor(hexColor) {
    // Convert hex to RGB
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);
    
    // Lighten by mixing with white
    r = Math.floor(r + (255 - r) * 0.8);
    g = Math.floor(g + (255 - g) * 0.8);
    b = Math.floor(b + (255 - b) * 0.8);
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

  // Add this method to PartyManager class
  getMonsterAnimation(monsterType, monsterName = '') {
    // Default (no animation)
    const defaultAnimation = {
      useAnimation: false,
      style: {}
    };

    // Handle empty or invalid type
    if (!monsterType) return defaultAnimation;

    // Normalize type for comparison
    const type = monsterType.toLowerCase();
    const name = monsterName.toLowerCase();

    // Define type-specific animations
    const animations = {
      'aberration': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #5500aa, #8800cc, #5500aa)',
          backgroundSize: '200% 200%',
          animation: 'warp 10s ease infinite, shimmer 8s infinite linear',
          transition: 'all 0.5s'
        },
        description: 'Reality-warping effect for alien aberrations'
      },
      'celestial': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #ffd700, #ffffff, #ffd700)',
          backgroundSize: '200% 200%',
          animation: 'shimmer 4s infinite linear, glow 3s infinite ease-in-out',
          boxShadow: '0 0 10px rgba(255, 215, 0, 0.4)',
          transition: 'all 0.5s'
        },
        description: 'Divine radiance for celestial beings'
      },
      'dragon': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #ff4444, #ffaa00, #ff4444)',
          backgroundSize: '200% 200%',
          animation: 'shimmer 8s infinite ease-in-out',
          transition: 'all 0.3s'
        },
        description: 'Majestic, slow color shift for dragons'
      },
      'elemental': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #ff8800, #ffaa33, #ff8800)',
          backgroundSize: '200% 200%',
          animation: 'flicker 4s infinite',
          transition: 'all 0.3s'
        },
        description: 'Elemental energy manifestation'
      },
      'fey': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #dd66ff, #aa99ff, #dd66ff)',
          backgroundSize: '200% 200%',
          animation: 'shimmer 5s infinite linear',
          transition: 'all 0.3s'
        },
        description: 'Magical shimmer for fey creatures'
      },
      'fiend': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #aa2222, #660000, #aa2222)',
          backgroundSize: '200% 200%',
          animation: 'pulse 3s infinite ease-in-out',
          transition: 'all 0.3s'
        },
        description: 'Smoldering effect for fiendish beings'
      },
      'undead': {
        useAnimation: true,
        style: {
          background: 'linear-gradient(45deg, #663366, #442244, #663366)',
          backgroundSize: '200% 200%',
          animation: 'pulse 6s infinite ease-in-out',
          transition: 'all 0.5s'
        },
        description: 'Eerie pulsing for undead creatures'
      }
      // Add more types as needed    
    };

    // Special case for dragons - check name for color indicators
    if (type === 'dragon' && name) {
      // Check for chromatic dragons
      if (name.includes('red')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #ff0000, #aa0000, #ff3300)',
            backgroundSize: '200% 200%',
            animation: 'flicker 4s infinite, shimmer 8s infinite',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('blue')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #0066ff, #0033aa, #0066ff)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 6s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('green')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #00aa33, #006622, #00aa33)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 7s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('black')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #333333, #111111, #333333)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 10s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('white')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #ffffff, #ccccff, #ffffff)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 5s infinite linear, pulse 3s infinite',
            boxShadow: '0 0 10px rgba(200, 200, 255, 0.5)',
            transition: 'all 0.3s'
          }
        };
      }
      // Check for metallic dragons
      else if (name.includes('gold')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #ffd700, #ffaa00, #ffd700)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 6s infinite linear, glow 3s infinite ease-in-out',
            boxShadow: '0 0 10px rgba(255, 215, 0, 0.4)',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('silver')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #c0c0c0, #e8e8e8, #c0c0c0)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 5s infinite linear, glow 4s infinite ease-in-out',
            boxShadow: '0 0 10px rgba(192, 192, 192, 0.6)',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('copper')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #b87333, #da8a67, #b87333)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 7s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('brass')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #b5a642, #c9b870, #b5a642)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 6s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
      else if (name.includes('bronze')) {
        return {
          useAnimation: true,
          style: {
            background: 'linear-gradient(45deg, #cd7f32, #a86d29, #cd7f32)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 8s infinite linear',
            transition: 'all 0.3s'
          }
        };
      }
    }

    // Return the appropriate animation or default
    return animations[type] || defaultAnimation;
  }

  // Add this to PartyManager class
addComboIndicatorsToCards() {
  // First check if we have active monsters
  if (!this.party.active || this.party.active.length < 2) {
    return;
  }

  // Get all possible combos between active monsters
  const availableCombos = this.getAvailableComboAbilities ? 
    this.getAvailableComboAbilities() : 
    (this.partyManager?.getAvailableComboAbilities ? this.partyManager.getAvailableComboAbilities() : []);
    
  if (!availableCombos || availableCombos.length === 0) {
    return;
  }
  
  // Find all monster cards in the party manager
  const monsterCards = document.querySelectorAll('.monster-card');
  if (!monsterCards.length) return;
  
  // Clear any existing combo indicators
  monsterCards.forEach(card => {
    const existingIndicator = card.querySelector('.combo-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
  });
  
  // Add combo indicators for each combo
  availableCombos.forEach(combo => {
    // Get monster IDs from the combo
    const monsterIds = combo.monsters.map(m => m.id);
    
    // Add indicator to each monster's card
    monsterIds.forEach(monsterId => {
      // Find card for this monster
      const card = Array.from(monsterCards).find(
        card => card.getAttribute('data-monster-id') === monsterId
      );
      
      if (card) {
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'combo-indicator';
        indicator.style.cssText = `
        position: absolute;
        top: 6px;
        right: 6px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${combo.color || '#ff9d00'}, ${combo.color || '#ff9d00'}dd);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: white;
        z-index: 10;
        box-shadow: 0 0 12px rgba(255, 157, 0, 0.4);
        cursor: pointer;
        animation: pulseCombo 2s infinite ease-in-out;
      `;
        
        // Add icon based on combo type
        const iconName = combo.icon || 'group';
        indicator.innerHTML = `<span class="material-icons" style="font-size: 14px;">${iconName}</span>`;
        
        // Add tooltip with combo info
        indicator.title = `${combo.name} combo with ${
          combo.monsters.find(m => m.id !== monsterId)?.name || 'another monster'
        }`;
        
        // Add hover effect
        indicator.addEventListener('mouseenter', () => {
          indicator.style.transform = 'scale(1.2)';
        });
        
        indicator.addEventListener('mouseleave', () => {
          indicator.style.transform = '';
        });
        
        // Add to card
        card.style.position = 'relative';
        card.appendChild(indicator);
      }
    });
  });
}


  // Create a detailed view for a selected monster
  createMonsterDetailView(monster) {
    // Calculate percentages
    const hpPercent = Math.floor((monster.currentHP / monster.maxHP) * 100);
    const expPercent = Math.floor((monster.experience / monster.experienceToNext) * 100);

    const bgColor = this.getMonsterTypeColor(monster.type);
    const typeColor = this.getMonsterTypeColor(monster.type);
    const animation = this.getMonsterAnimation(monster.type, monster.name);

    // Get token source
    const tokenSource = monster.token?.data || (typeof monster.token === 'string' ? monster.token : null);

    // Create the details view
    const detailsView = document.createElement('div');
    detailsView.className = 'monster-details';

    // Get monster location (active or reserve)
    const isActive = this.party.active.some(m => m.id === monster.id);
    const buttonType = isActive ? 'reserve' : 'active';
    const buttonText = isActive ? 'To Reserve' : 'To Active';
    const buttonIcon = isActive ? 'arrow_downward' : 'arrow_upward';
    const buttonColor = isActive ? 'rgba(252, 252, 252, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    const buttonTextColor = isActive ? '#fff' : '#000';
    const isDisabled = !isActive && this.party.active.length >= this.party.maxActive;

    const header = document.createElement('div');
    header.className = 'details-header';


    // Apply styling based on monster type
    if (animation.useAnimation) {
      // Apply the type-specific animation
      Object.assign(header.style, animation.style);
    } else {
      // Default gradient if no special animation
      header.style.background = `linear-gradient(135deg, ${typeColor}, #7e22ce)`;
    }

    header.innerHTML = `
    <div class="details-avatar" style="background-color: ${bgColor};">
      ${tokenSource ?
        `<img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; ">` :
        monster.name.charAt(0)
      }
    </div>
    <div class="details-title">
      <div class="details-name" style="text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${monster.name}</div>
      <div class="details-type" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div>
          ${monster.size} ${monster.type} • Level ${monster.level || 1}
          <span class="details-cr-badge">CR ${monster.cr || '?'}</span>
        </div>
        <button class="move-to-${buttonType}" data-monster-id="${monster.id}" style="
          background: ${buttonColor};
          border: none;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          color: ${buttonTextColor};
          margin-left: 8px;
          cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
          opacity: ${isDisabled ? '0.5' : '1'};
        ">
          <span class="material-icons" style="font-size: 14px; margin-right: 4px;">${buttonIcon}</span>
          ${buttonText}
        </button>

        <button class="dismiss-monster-btn" data-monster-id="${monster.id}" style="
  background: rgba(255, 0, 0, 0.34);
  border: none;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  color:rgb(255, 255, 255);
  margin-left: 8px;
  cursor: pointer;
">
  <span class="material-icons" style="font-size: 14px; margin-right: 4px;">delete</span>
  Dismiss
</button>
      </div>
    </div>
  `;



    // Content
    const content = document.createElement('div');
    content.className = 'details-content';

    // Basic stats section
    let contentHtml = `
    <div class="details-section">
      <div class="stat-bars">
        <!-- HP Bar -->
        <div class="stat-bar">
          <div class="stat-bar-header">
            <div>Hit Points</div>
            <div>${monster.currentHP}/${monster.maxHP}</div>
          </div>
          <div class="hp-bar-bg">
            <div class="hp-bar-fill ${hpPercent < 30 ? 'low' : hpPercent < 70 ? 'medium' : 'high'}" style="width: ${hpPercent}%;"></div>
          </div>
        </div>
        
        <!-- Experience Bar -->
        <div class="stat-bar">
          <div class="stat-bar-header">
            <div>Experience</div>
            <div>${monster.experience || 0}/${monster.experienceToNext || 100}</div>
          </div>
          <div class="exp-bar-bg">
            <div class="exp-bar-fill" style="width: ${expPercent}%;"></div>
          </div>
        </div>
      </div>
      
      <!-- Core stats -->
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-label">Armor Class</div>
          <div class="stat-value">${monster.armorClass}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Initiative</div>
          <div class="stat-value">+${monster.abilities?.dex?.modifier || 0}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Speed</div>
          <div class="stat-value">30 ft</div>
        </div>
      </div>
    </div>
  `;

    // Ability scores section
    if (monster.abilities) {
      contentHtml += `
      <div class="details-section">
        <div class="details-section-title">Ability Scores</div>
        <div class="ability-scores">
          ${Object.entries(monster.abilities).map(([abilityName, data]) => `
            <div class="ability-score">
              <div class="ability-name">${abilityName}</div>
              <div class="ability-value">${data.score}</div>
              <div class="ability-mod">${data.modifier >= 0 ? `+${data.modifier}` : data.modifier}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }

    // Monster abilities section
    if (monster.monsterAbilities && monster.monsterAbilities.length > 0) {
      contentHtml += `
      <div class="details-section">
        <div class="details-section-title">Abilities</div>
        <div class="abilities-container" style="
          background: #f5f3e8;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #e6e0d1;
          width: 100%;
          box-sizing: border-box;
        ">
          <div class="monster-abilities" style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            width: 100%;
          ">
            ${monster.monsterAbilities.map(ability => {
        // Determine icon based on ability type
        let icon = 'star';
        let bgColor = '#f3f4f6';
        let iconColor = '#6b7280';

        switch (ability.type) {
          case 'attack':
            icon = 'sports_martial_arts';
            bgColor = 'rgba(239, 68, 68, 0.1)';
            iconColor = '#ef4444';
            break;
          case 'area':
            icon = 'blur_circular';
            bgColor = 'rgba(245, 158, 11, 0.1)';
            iconColor = '#f59e0b';
            break;
          case 'buff':
            icon = 'upgrade';
            bgColor = 'rgba(16, 185, 129, 0.1)';
            iconColor = '#10b981';
            break;
          case 'debuff':
            icon = 'threat';
            bgColor = 'rgba(168, 85, 247, 0.1)';
            iconColor = '#a855f7';
            break;
          case 'control':
            icon = 'touch_app';
            bgColor = 'rgba(59, 130, 246, 0.1)';
            iconColor = '#3b82f6';
            break;
        }

        return `
        <div class="ability-card" style="background: ${bgColor};">
          <div class="ability-header">
            <div class="ability-icon" style="color: ${iconColor};">
              <span class="material-icons small">${icon}</span>
            </div>
            <div class="ability-title-row">
              <div class="ability-title">${ability.name}</div>
              ${ability.damage ?
            `<div class="ability-damage" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">${ability.damage}</div>` :
            ''
          }
            </div>
          </div>
          <div class="ability-description">${ability.description || 'No description available.'}</div>
        </div>

      `;
      }).join('')}
    </div>
  </div>
</div>
`;
    }

// Add this after the monster abilities section in createMonsterDetailView
contentHtml += this.createComboAbilitiesSection(monster);


    // Equipment section
    contentHtml += `
  <div class="details-section">
    <div class="details-section-title">Equipment</div>
    <div class="equipment-container" style="
      background: #f5f3e8;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e6e0d1;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    ">
      <!-- Weapon Slot -->
      <div class="equipment-slot ${monster.equipment?.weapon ? 'equipped' : 'empty'}" style="
        background: ${monster.equipment?.weapon ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
        border-radius: 8px;
        padding: 12px;
        border: 1px solid ${monster.equipment?.weapon ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
        position: relative;
        transition: all 0.2s;
        cursor: pointer;
      " data-slot="weapon" data-monster-id="${monster.id}">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <i class="ra ra-crossed-swords" style="
            font-size: 20px; 
            margin-right: 8px;
            color: ${monster.equipment?.weapon ? '#ef4444' : '#666'};
          "></i>
          <div style="font-weight: 500;">Weapon</div>
        </div>
        
        ${monster.equipment?.weapon ? `
          <div style="display: flex; align-items: center;">
            <div style="width: 40px; height: 40px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
              ${monster.equipment.weapon.image ? 
                `<img src="${monster.equipment.weapon.image}" alt="${monster.equipment.weapon.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` :
                `<i class="ra ${this.getWeaponIcon(monster.equipment.weapon)}" style="font-size: 24px; color: #ef4444;"></i>`
              }
            </div>
            <div>
              <div style="font-weight: 500;">${monster.equipment.weapon.name}</div>
              <div style="font-size: 0.8rem; color: #ef4444;">
                ${this.getWeaponDiceNotation(monster.equipment.weapon.name)} damage
              </div>
            </div>
          </div>
        ` : `
          <div style="color: #666; font-style: italic; text-align: center; padding: 8px 0;">
            No weapon equipped
          </div>
        `}
        
        <div style="
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-size: 0.8rem;
          color: #3b82f6;
        ">Click to ${monster.equipment?.weapon ? 'change' : 'equip'}</div>
      </div>
      
      <!-- Armor Slot -->
      <div class="equipment-slot ${monster.equipment?.armor ? 'equipped' : 'empty'}" style="
        background: ${monster.equipment?.armor ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
        border-radius: 8px;
        padding: 12px;
        border: 1px solid ${monster.equipment?.armor ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
        position: relative;
        transition: all 0.2s;
        cursor: pointer;
      " data-slot="armor" data-monster-id="${monster.id}">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <i class="ra ra-shield" style="
            font-size: 20px; 
            margin-right: 8px;
            color: ${monster.equipment?.armor ? '#3b82f6' : '#666'};
          "></i>
          <div style="font-weight: 500;">Armor</div>
        </div>
        
        ${monster.equipment?.armor ? `
          <div style="display: flex; align-items: center;">
            <div style="
              width: 40px;
              height: 40px;
              background: rgba(59, 130, 246, 0.1);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
            ">
              ${monster.equipment.armor.image ? 
                `<img src="${monster.equipment.armor.image}" alt="${monster.equipment.armor.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` :
                `<i class="ra ${this.getArmorIcon(monster.equipment.armor)}" style="font-size: 24px; color: #3b82f6;"></i>`
              }
            </div>
            <div>
              <div style="font-weight: 500;">${monster.equipment.armor.name}</div>
              ${monster.equipment.armor.acBonus ?
                `<div style="font-size: 0.8rem; color: #3b82f6;">+${monster.equipment.armor.acBonus} armor</div>` :
                ''
              }
            </div>
          </div>
        ` : `
          <div style="color: #666; font-style: italic; text-align: center; padding: 8px 0;">
            No armor equipped
          </div>
        `}
        
        <div style="
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-size: 0.8rem;
          color: #3b82f6;
        ">Click to ${monster.equipment?.armor ? 'change' : 'equip'}</div>
      </div>
    </div>
  </div>
`;

    // Relationships section
    if (monster.relationships && monster.relationships.length > 0) {
      contentHtml += `
      <div class="details-section">
        <div class="details-section-title">Relationships</div>
        <div class="relationships">
          ${monster.relationships.map(relation => {
        // Find the related monster
        const relatedMonster = [...this.party.active, ...this.party.reserve].find(m => m.id === relation.monsterId);
        if (!relatedMonster) return '';

        // Get color for monster type
        const relatedColor = this.getMonsterTypeColor(relatedMonster.type);

        // Determine affinity class
        let affinityClass = 'low';
        if (relation.level === 'High') affinityClass = 'high';
        else if (relation.level === 'Medium') affinityClass = 'medium';

        return `
              <div class="relationship-card">
                <div class="relationship-avatar" style="background-color: ${relatedColor};">
                  ${relatedMonster.token ?
            `<img src="${relatedMonster.token}" alt="${relatedMonster.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` :
            relatedMonster.name.charAt(0)
          }
                </div>
                <div class="relationship-info">
                  <div class="relationship-name">${relatedMonster.name}</div>
                  <div class="relationship-details">
                    <span class="affinity-badge ${affinityClass}">${relation.level}</span>
                    ${relation.benefit && relation.benefit !== 'None' ?
            `<span class="relationship-benefit">${relation.benefit}</span>` :
            ''
          }
                  </div>
                </div>
              </div>
            `;
      }).join('')}
        </div>
      </div>
    `;
    }

    content.innerHTML = contentHtml;

    const equipmentSlots = content.querySelectorAll('.equipment-slot');
    equipmentSlots.forEach(slot => {
      slot.addEventListener('mouseenter', () => {
        slot.style.transform = 'translateY(-2px)';
        slot.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
      });

      slot.addEventListener('mouseleave', () => {
        slot.style.transform = '';
        slot.style.boxShadow = '';
      });

      slot.addEventListener('click', () => {
        const slotType = slot.getAttribute('data-slot');
        this.showEquipmentDialog(monster, slotType);
      });
    });

    // Add event listener to the move button
    const moveButton = header.querySelector(`.move-to-${buttonType}`);
    if (moveButton && !isDisabled) {
      moveButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.moveMonster(monster.id, buttonType)) {
          this.refreshPartyDialog();
        } else if (buttonType === 'active') {
          this.showToast('Active party is full!', 'warning');
        }
      });
    }
    // Assemble the view
    detailsView.appendChild(header);
    detailsView.appendChild(content);

    return detailsView;
  }

  getWeaponDiceNotation(weaponName) {
    if (!weaponName) return "1d4";
    
    const name = weaponName.toLowerCase();
    
    if (name.includes('dagger') || name.includes('knife')) return "1d4";
    if (name.includes('short') && name.includes('sword') || name.includes('shortsword')) return "1d6";
    if (name.includes('sword') || name.includes('saber') || name.includes('rapier')) return "1d8";
    if (name.includes('axe') || name.includes('battleaxe')) return "1d10";
    if (name.includes('great') && (name.includes('sword') || name.includes('axe'))) return "2d6";
    if (name.includes('mace') || name.includes('club')) return "1d6";
    if (name.includes('hammer') || name.includes('warhammer')) return "1d8";
    if (name.includes('maul') || name.includes('great hammer')) return "2d6";
    if (name.includes('spear')) return "1d6";
    
    return "1d6"; // Default
  }

  // Render active party display
  renderActiveParty() {
    if (this.party.active.length === 0) {
      return `
        <div class="empty-party-message" style="text-align: center; padding: 40px;">
          <span class="material-icons" style="font-size: 48px; opacity: 0.5;">sentiment_dissatisfied</span>
          <p>Your active party is empty.</p>
          <p>You need monsters in your active party to participate in combat.</p>
        </div>
      `;
    }

    let html = `<div class="active-party-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px;">`;

    // Render each active monster
    this.party.active.forEach(monster => {
      html += this.renderMonsterCard(monster, 'active');
    });

    // Add empty slots
    for (let i = this.party.active.length; i < this.party.maxActive; i++) {
      html += `
        <div class="empty-monster-slot" style="border: 2px dashed #ccc; border-radius: 8px; padding: 20px; text-align: center; height: 150px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <span class="material-icons" style="font-size: 36px; opacity: 0.5;">add_circle_outline</span>
          <p style="margin-top: 8px;">Empty Slot</p>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  // Render reserve party display
  renderReserveParty() {
    if (this.party.reserve.length === 0) {
      return `
        <div class="empty-reserve-message" style="text-align: center; padding: 40px;">
          <span class="material-icons" style="font-size: 48px; opacity: 0.5;">pets</span>
          <p>You don't have any reserve monsters.</p>
          <p>Monsters you recruit will appear here when your active party is full.</p>
        </div>
      `;
    }

    let html = `<div class="reserve-party-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 16px;">`;

    // Render each reserve monster
    this.party.reserve.forEach(monster => {
      html += this.renderMonsterCard(monster, 'reserve');
    });

    html += `</div>`;
    return html;
  }


    // Update this method to use createMonsterCard internally
  renderMonsterCard(monster, location) {
    // Just pass through to createMonsterCard for consistency
    return this.createMonsterCard(monster, location);
  }

  generateDefaultTokenImage(monster) {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Generate color based on monster type
    const colors = {
      dragon: '#ff4444',
      undead: '#663366',
      beast: '#44aa44',
      humanoid: '#4444ff',
      fiend: '#aa4444'
    };
    const color = colors[monster.type.toLowerCase()] || '#888888';

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


  // Setup event handlers for party manager
  setupPartyDialogEvents(overlay, container, activeList, reserveList, detailsPanel) {
    // Track the currently selected monster
    let selectedMonster = null;

    // Pause 3D controls
    if (window.scene3D) {
      window.scene3D.pauseControls();
    }

    // Store the currently focused element before opening the dialog
    const previouslyFocused = document.activeElement;

    // Close button handler
    const closeButton = container.querySelector('.close-btn');
    closeButton.addEventListener('click', () => {
      // Animate out
      overlay.style.opacity = '0';
      container.style.transform = 'scale(0.95)';

      // Remove after animation
      setTimeout(() => {
        overlay.remove();

        // Focus back on the document body
        const canvas = document.querySelector('canvas') || document.body;
        canvas.focus();

        // Reset key states
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));

        // Resume controls
        if (window.scene3D) {
          window.scene3D.resumeControls();
        }
      }, 300);
    });

    // Tab switching
    const tabButtons = container.querySelectorAll('.party-tab');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Show the corresponding list
        const tabName = button.getAttribute('data-tab');
        if (tabName === 'active') {
          activeList.style.display = '';
          reserveList.style.display = 'none';
        } else {
          activeList.style.display = 'none';
          reserveList.style.display = '';
        }
      });
    });

    // Monster selection handler
    const handleMonsterSelection = (monsterId) => {
      // Remove selection from all cards
      overlay.querySelectorAll('.monster-card').forEach(card => {
        card.classList.remove('selected');
      });

      if (monsterId === selectedMonster) {
        // Deselect if clicking the same monster
        selectedMonster = null;

        // Show empty details message
        detailsPanel.innerHTML = `
        <div class="empty-details-message">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">touch_app</span>
          <h2 style="margin: 0 0 8px 0; font-size: 1.5rem;">Select a Monster</h2>
          <p style="margin: 0; max-width: 400px; opacity: 0.8;">
            Click on any monster card to view detailed information, abilities, and relationship data
          </p>
        </div>
      `;

      this.renderPartyAffinityVisualization(detailsPanel);


      } else {
        // Find the monster
        const monster = this.findMonster(monsterId);
        if (!monster) return;

        // Update selection
        selectedMonster = monsterId;

        // Highlight selected card
        const selectedCard = overlay.querySelector(`.monster-card[data-monster-id="${monsterId}"]`);
        if (selectedCard) {
          selectedCard.classList.add('selected');
        }

        // Show monster details
        detailsPanel.innerHTML = '';
        const detailView = this.createMonsterDetailView(monster);
        detailsPanel.appendChild(detailView);

        // Add event listeners to equipment buttons
        const equipmentActions = detailsPanel.querySelectorAll('.equipment-action');
        equipmentActions.forEach(button => {
          button.addEventListener('click', (e) => {
            const slot = e.target.closest('.equipment-slot');
            const slotType = slot.classList.contains('weapon') ? 'weapon' : 'armor';
            this.showEquipmentDialog(monster, slotType);
          });
        });
      }
    };

    // Monster card click handlers
    const addCardClickHandlers = () => {
      const monsterCards = overlay.querySelectorAll('.monster-card');
      monsterCards.forEach(card => {
        card.addEventListener('click', (e) => {
          const monsterId = card.getAttribute('data-monster-id');
          handleMonsterSelection(monsterId);
        });
      });
    };

    // Add initial handlers
    addCardClickHandlers();

      // Listen for clicks on the details panel (for dismiss button)
  detailsPanel.addEventListener('click', (e) => {
    const dismissBtn = e.target.closest('.dismiss-monster-btn');
    if (dismissBtn) {
      e.stopPropagation();
      const monsterId = dismissBtn.getAttribute('data-monster-id');
      const monster = this.findMonster(monsterId);
      if (monster) {
        this.showDismissConfirmation(monster);
      }
    }
  });

    const addMoveButtonHandlers = () => {
      // Set up "To Reserve" buttons
      const toReserveButtons = overlay.querySelectorAll('.move-to-reserve');
      toReserveButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card selection
          const monsterId = button.getAttribute('data-monster-id');
          if (this.moveMonster(monsterId, 'reserve')) {
            // Refresh the UI
            this.refreshPartyDialog();
          }
        });
      });

      // Set up "To Active" buttons
      const toActiveButtons = overlay.querySelectorAll('.move-to-active');
      toActiveButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card selection
          const monsterId = button.getAttribute('data-monster-id');
          if (this.moveMonster(monsterId, 'active')) {
            // Refresh the UI
            this.refreshPartyDialog();
          } else {
            // Show message if active party is full
            this.showToast('Active party is full!', 'warning');
          }
        });
      });
    };

  }

  // Refresh party dialog when data changes
  refreshPartyDialog() {
    if (!this.partyDialog) return;

    // Get references to the active and reserve lists
    const activeList = this.partyDialog.querySelector('.active-monster-list');
    const reserveList = this.partyDialog.querySelector('.reserve-monster-list');
    const detailsPanel = this.partyDialog.querySelector('.party-details');

    // Update tab labels
    const tabButtons = this.partyDialog.querySelectorAll('.party-tab');
    if (tabButtons.length >= 2) {
      tabButtons[0].textContent = `Active (${this.party.active.length}/${this.party.maxActive})`;
      tabButtons[1].textContent = `Reserve (${this.party.reserve.length})`;
    }

    // Clear existing content
    if (activeList) activeList.innerHTML = '';
    if (reserveList) reserveList.innerHTML = '';

    // Repopulate active list
    if (activeList) {
      if (this.party.active.length > 0) {
        this.party.active.forEach((monster, index) => {
          const card = this.createMonsterCard(monster, 'active', index % 2 !== 0);
          activeList.appendChild(card);
        });

        // Add empty slots
        for (let i = this.party.active.length; i < this.party.maxActive; i++) {
          const emptySlot = document.createElement('div');
          emptySlot.className = 'empty-party-slot';
          emptySlot.innerHTML = `
          <span class="material-icons" style="margin-right: 8px;">add_circle_outline</span>
          Empty Slot
        `;
          activeList.appendChild(emptySlot);
        }
      } else {
        // Empty active party message
        activeList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.8);">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">sentiment_dissatisfied</span>
          <p style="margin: 0 0 8px 0; font-size: 1.1rem;">Your active party is empty</p>
          <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">You need monsters in your party to participate in combat</p>
        </div>
      `;
      }
    }

    // Repopulate reserve list
    if (reserveList) {
      if (this.party.reserve.length > 0) {
        this.party.reserve.forEach(monster => {
          const card = this.createMonsterCard(monster, 'reserve');
          reserveList.appendChild(card);
        });
      } else {
        // Empty reserve message
        reserveList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.8);">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">inventory_2</span>
          <p style="margin: 0 0 8px 0; font-size: 1.1rem;">Your reserve is empty</p>
          <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">Monsters will be stored here when your active party is full</p>
        </div>
      `;
      }
    }

    this.addComboIndicatorsToCards();

    // Reattach event listeners
    const container = this.partyDialog.querySelector('.party-container');
    this.setupPartyDialogEvents(this.partyDialog, container, activeList, reserveList, detailsPanel);
  }

  // Show monster details overlay (similar to splash art)
  showMonsterDetails(monster) {
    // Pause any 3D controls if they exist
    if (window.scene3D && typeof window.scene3D.pauseControls === 'function') {
      window.scene3D.pauseControls();
    }

    const overlay = document.createElement('div');
    overlay.className = 'monster-details-overlay';
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

    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'monster-details-container';
    detailsContainer.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.3s ease;
      display: flex;
      flex-direction: column;
    `;

    // Create header with monster name and close button
    const header = document.createElement('div');
    header.className = 'monster-details-header';
    header.style.cssText = `
      display: flex;
      align-items: center;
      padding: 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      border-radius: 8px 8px 0 0;
    `;

    header.innerHTML = `
      <h2 style="margin: 0; flex: 1;">${monster.name}</h2>
      <button class="close-details-btn" style="background: none; border: none; cursor: pointer; padding: 4px;">
        <span class="material-icons">close</span>
      </button>
    `;

    // Create content with monster details
    const content = document.createElement('div');
    content.className = 'monster-details-content';
    content.style.cssText = `
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Create top section with image and basic info
    const topSection = document.createElement('div');
    topSection.className = 'monster-top-section';
    topSection.style.cssText = `
      display: flex;
      gap: 16px;
    `;

    // Format HP as percentage
    const hpPercent = (monster.currentHP / monster.maxHP) * 100;
    let hpBarColor = '#4CAF50';  // Green
    if (hpPercent < 30) {
      hpBarColor = '#F44336';  // Red
    } else if (hpPercent < 70) {
      hpBarColor = '#FF9800';  // Orange
    }

    // Determine if monster has ability score bonuses from level
    const levelBonus = Math.floor(monster.level / 4);  // +1 every 4 levels

    // Calculate experience percentage
    const expPercent = (monster.experience / monster.experienceToNext) * 100;

    // Build the top section with image and basic info
    topSection.innerHTML = `
      <div class="monster-image-large" style="flex: 0 0 150px;">
        <img src="${monster.thumbnail}" alt="${monster.name}" style="width: 100%; height: 150px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      </div>
      <div class="monster-basic-info" style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
        <div style="color: #666; font-style: italic;">
          ${monster.size} ${monster.type}, CR ${monster.cr}
        </div>
        
        <div class="monster-level-info" style="margin-top: 8px;">
          <div style="font-weight: bold;">Level ${monster.level}</div>
          <div class="exp-bar-label" style="display: flex; justify-content: space-between; font-size: 0.9em; color: #666;">
            <span>Experience</span>
            <span>${monster.experience}/${monster.experienceToNext}</span>
          </div>
          <div class="exp-bar-bg" style="height: 6px; background: #e0e0e0; border-radius: 3px; margin-bottom: 16px;">
            <div class="exp-bar-fill" style="height: 100%; width: ${expPercent}%; background: #9c27b0; border-radius: 3px;"></div>
          </div>
        </div>
        
        <div class="hp-bar-label" style="display: flex; justify-content: space-between;">
          <span>Hit Points</span>
          <span>${monster.currentHP}/${monster.maxHP}</span>
        </div>
        <div class="hp-bar-bg" style="height: 10px; background: #e0e0e0; border-radius: 5px; margin-bottom: 8px;">
          <div class="hp-bar-fill" style="height: 100%; width: ${hpPercent}%; background: ${hpBarColor}; border-radius: 5px;"></div>
        </div>
        
        <div class="other-stats" style="display: flex; gap: 16px; margin-top: 8px;">
          <div>
            <div style="font-weight: bold;">Armor Class</div>
            <div>${monster.armorClass}</div>
          </div>
          <div>
            <div style="font-weight: bold;">Equipment</div>
            <div>${monster.equipment.weapon ? monster.equipment.weapon.name : 'No weapon'}</div>
            <div>${monster.equipment.armor ? monster.equipment.armor.name : 'No armor'}</div>
          </div>
        </div>
      </div>
    `;

    // Create ability scores section
    const abilitiesSection = document.createElement('div');
    abilitiesSection.className = 'monster-abilities-section';
    abilitiesSection.style.cssText = `
      background: #f9f9f9;
      border-radius: 8px;
      padding: 16px;
    `;

    // Helper function to format modifiers
    const formatMod = (mod) => {
      const sign = mod >= 0 ? '+' : '';
      return `${sign}${mod}`;
    };

    // Add abilities if available
    if (monster.abilities) {
      abilitiesSection.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 12px;">Ability Scores</h3>
        <div class="ability-scores-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center;">
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">STR</div>
            <div class="ability-score">${monster.abilities.str.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.str.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">DEX</div>
            <div class="ability-score">${monster.abilities.dex.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.dex.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">CON</div>
            <div class="ability-score">${monster.abilities.con.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.con.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">INT</div>
            <div class="ability-score">${monster.abilities.int.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.int.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">WIS</div>
            <div class="ability-score">${monster.abilities.wis.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.wis.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">CHA</div>
            <div class="ability-score">${monster.abilities.cha.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.cha.modifier + Math.floor(levelBonus / 2))})</div>
          </div>
        </div>
      `;
    } else {
      abilitiesSection.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 12px;">Ability Scores</h3>
        <p style="text-align: center; color: #666;">No ability scores available for this monster.</p>
      `;
    }

    // Create monster abilities section
    const monsterAbilitiesSection = document.createElement('div');
    monsterAbilitiesSection.className = 'monster-combat-abilities-section';

    if (monster.monsterAbilities && monster.monsterAbilities.length > 0) {
      let abilitiesHtml = `
        <h3 style="margin-top: 0; margin-bottom: 12px;">Combat Abilities</h3>
        <div class="abilities-list" style="display: flex; flex-direction: column; gap: 12px;">
      `;

      // Add each ability
      monster.monsterAbilities.forEach(ability => {
        // Determine icon based on ability type
        let icon = 'sports_martial_arts'; // Default for attack
        let color = '#607D8B'; // Default color

        switch (ability.type) {
          case 'attack': icon = 'sports_martial_arts'; color = '#F44336'; break;
          case 'area': icon = 'blur_circular'; color = '#FF9800'; break;
          case 'buff': icon = 'upgrade'; color = '#4CAF50'; break;
          case 'debuff': icon = 'threat'; color = '#9C27B0'; break;
          case 'defense': icon = 'shield'; color = '#2196F3'; break;
          case 'healing': icon = 'healing'; color = '#00BCD4'; break;
          case 'reaction': icon = 'autorenew'; color = '#795548'; break;
          case 'support': icon = 'group'; color = '#607D8B'; break;
        }

        abilitiesHtml += `
          <div class="ability-card" style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div class="ability-header" style="display: flex; align-items: center; padding: 8px; background: ${color}20; border-bottom: 1px solid ${color}40;">
              <span class="material-icons" style="margin-right: 8px; color: ${color};">${icon}</span>
              <div class="ability-name" style="font-weight: bold;">${ability.name}</div>
              ${ability.damage ? `<div class="ability-damage" style="margin-left: auto; color: #d32f2f;">${ability.damage}</div>` : ''}
            </div>
            <div class="ability-description" style="padding: 8px;">
              ${ability.description}
            </div>
          </div>
        `;
      });

      abilitiesHtml += `</div>`;
      monsterAbilitiesSection.innerHTML = abilitiesHtml;
    } else {
      monsterAbilitiesSection.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 12px;">Combat Abilities</h3>
        <p style="text-align: center; color: #666;">This monster has no special combat abilities.</p>
      `;
    }

    // Assemble all sections
    content.appendChild(topSection);
    content.appendChild(abilitiesSection);
    content.appendChild(monsterAbilitiesSection);

    // Add sections to container
    detailsContainer.appendChild(header);
    detailsContainer.appendChild(content);
    overlay.appendChild(detailsContainer);

    // Add event listeners
    const closeDialog = () => {
      overlay.style.opacity = '0';
      detailsContainer.style.transform = 'scale(0.95)';

      setTimeout(() => {
        overlay.remove();
        // Resume controls if they exist
        if (window.scene3D && typeof window.scene3D.resumeControls === 'function') {
          window.scene3D.resumeControls();
        }
      }, 300);
    };

    // Close button
    header.querySelector('.close-details-btn').addEventListener('click', closeDialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });

    // Escape key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Add to body and trigger animation
    document.body.appendChild(overlay);

    // Force browser to process the new elements before animating
    setTimeout(() => {
      overlay.style.opacity = '1';
      detailsContainer.style.transform = 'scale(1)';
    }, 10);
  }

  // Add or update your showEquipmentDialog method

// Modified showEquipmentDialog to ensure correct item ID display
showEquipmentDialog(monster, selectedSlot = 'weapon') {
  // Make sure party manager is open
  if (!this.partyDialog || !this.equipmentDrawer) {
    console.error('Party manager must be open to show equipment dialog');
    return;
  }
  
  // Get placeholder equipment
  const placeholderEquipment = this.getPlaceholderEquipment(selectedSlot);
  
  // Log all available items with their IDs for debugging
  console.log(`Available items for slot ${selectedSlot}:`);
  placeholderEquipment.forEach(item => {
    console.log(`- Item: ${item.name}, ID: ${item.id}, Type: ${typeof item.id}, Source: ${item.source || 'unknown'}`);
  });
  
  // Update drawer label
  this.equipmentDrawer.label = `Equip ${selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1)} for ${monster.name}`;
  
  // Update drawer content
  const drawerContent = this.equipmentDrawer.querySelector('.equipment-drawer-content');
  drawerContent.innerHTML = `
  <div style="
    background: #f5f3e8;
    border-radius: 12px;
    padding: 16px;
    border: 1px solid #e6e0d1;
    margin-bottom: 16px;
  ">
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <i class="ra ${selectedSlot === 'weapon' ? 'ra-crossed-swords' : 'ra-shield'}" style="
        font-size: 24px;
        margin-right: 12px;
        color: ${selectedSlot === 'weapon' ? '#ef4444' : '#3b82f6'};
      "></i>
      <div style="font-weight: bold; font-size: 1.1rem;">Available ${selectedSlot === 'weapon' ? 'Weapons' : 'Armor'}</div>
    </div>
    
    <!-- Current equipment -->
    ${monster.equipment[selectedSlot] ? `
      <div style="
        margin-bottom: 16px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
      ">
        <div style="margin-bottom: 8px; font-weight: bold; display: flex; align-items: center;">
          <i class="ra ra-slash-ring" style="font-size: 16px; margin-right: 8px; color: #666;"></i>
          Currently Equipped
        </div>
        <div style="display: flex; align-items: center;">
          <div style="
            width: 48px;
            height: 48px;
            background: ${selectedSlot === 'weapon' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            ${monster.equipment[selectedSlot].image ? 
              `<img src="${monster.equipment[selectedSlot].image}" alt="${monster.equipment[selectedSlot].name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` :
              `<i class="ra ${selectedSlot === 'weapon' ?
                this.getWeaponIcon(monster.equipment[selectedSlot]) :
                this.getArmorIcon(monster.equipment[selectedSlot])
              }" style="
                font-size: 28px; 
                color: ${selectedSlot === 'weapon' ? '#ef4444' : '#3b82f6'};
              "></i>`
            }
          </div>
          <div>
            <div style="font-weight: 500;">${monster.equipment[selectedSlot].name}</div>
            ${monster.equipment[selectedSlot].damageBonus ?
              `<div style="font-size: 0.9rem; color: #ef4444;">+${monster.equipment[selectedSlot].damageBonus} damage</div>` :
              ''
            }
            ${monster.equipment[selectedSlot].acBonus ?
              `<div style="font-size: 0.9rem; color: #3b82f6;">+${monster.equipment[selectedSlot].acBonus} armor</div>` :
              ''
            }
          </div>
        </div>
      </div>
    ` : ''}
    
    <!-- Equipment options -->
    <div class="equipment-options" style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    ">
      <!-- Option to unequip -->
      <div class="equipment-item" data-item-id="none" data-slot="${selectedSlot}" style="
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid rgba(0, 0, 0, 0.1);
      ">
        <div style="display: flex; align-items: center;">
          <div style="
            width: 48px;
            height: 48px;
            background: rgba(239, 68, 68, 0.05);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            <i class="ra ra-broken-skull" style="font-size: 28px; color: #666;"></i>
          </div>
          <div>
            <div style="font-weight: 500;">Unequip</div>
            <div style="font-size: 0.9rem; color: #666;">Remove current ${selectedSlot}</div>
          </div>
        </div>
      </div>
      
      <!-- Equipment items -->
      ${placeholderEquipment.map(item => `
        <div class="equipment-item" 
             data-item-id="${item.id}" 
             data-slot="${selectedSlot}" 
             style="
               background: ${selectedSlot === 'weapon' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)'};
               border-radius: 8px;
               padding: 12px;
               cursor: pointer;
               transition: all 0.2s;
               border: 1px solid ${selectedSlot === 'weapon' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'};
             ">
          <div style="display: flex; align-items: center;">
            <div style="
              width: 48px;
              height: 48px;
              background: ${selectedSlot === 'weapon' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
            ">
              ${item.image ? 
                `<img src="${item.image}" alt="${item.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` :
                `<i class="ra ${selectedSlot === 'weapon' ? this.getWeaponIcon(item) : this.getArmorIcon(item)}"
                   style="font-size: 28px; color: ${selectedSlot === 'weapon' ? '#ef4444' : '#3b82f6'};"></i>`
              }
            </div>
            <div>
              <div style="font-weight: 500;">${item.name}</div>
              ${item.damageBonus ?
                `<div style="font-size: 0.9rem; color: #ef4444;">+${item.damageBonus} damage</div>` :
                ''
              }
              ${item.acBonus ?
                `<div style="font-size: 0.9rem; color: #3b82f6;">+${item.acBonus} armor</div>` :
                ''
              }
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  `;
  
  // Store the monster ID for use in event handlers
  this.equipmentDrawer.dataset.monsterId = monster.id;
  
  // Show the drawer
  this.equipmentDrawer.show();
  
  // Add hover effects and click handlers for equipment items
  const setupEquipmentItems = () => {
    const items = this.equipmentDrawer.querySelectorAll('.equipment-item');
    items.forEach(item => {
      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-2px)';
        item.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
      });

      item.addEventListener('mouseleave', () => {
        item.style.transform = '';
        item.style.boxShadow = '';
      });

      // Click handler
      item.addEventListener('click', () => {
        const itemId = item.getAttribute('data-item-id');
        const slot = item.getAttribute('data-slot');
        const monsterId = this.equipmentDrawer.dataset.monsterId;
        
        // Log exactly what's being passed to equipItem
        console.log('Item clicked:', {
          itemId, 
          slot, 
          monsterId,
          itemIdType: typeof itemId
        });
        
        if (itemId === 'none') {
          // Unequip
          this.unequipItem(monsterId, slot);
        } else {
          // Find and equip the item - This is the critical part
          this.equipItem(monsterId, slot, itemId);
        }

        // Close drawer
        this.equipmentDrawer.hide();
        
        // Refresh party UI with explicit delay
        setTimeout(() => {
          this.refreshPartyDialog();
          
          // Find the updated monster
          const updatedMonster = this.findMonster(monsterId);
          if (updatedMonster) {
            // Get the details panel
            const detailsPanel = this.partyDialog.querySelector('.party-details');
            if (detailsPanel) {
              // Clear and update details view
              detailsPanel.innerHTML = '';
              const detailView = this.createMonsterDetailView(updatedMonster);
              detailsPanel.appendChild(detailView);
            }
          }
        }, 300); // Longer delay for more reliable updates
      });
    });
  };
  
  // Setup the items after the drawer is shown
  this.equipmentDrawer.addEventListener('sl-after-show', setupEquipmentItems, { once: true });
}

// Add to PartyManager class
connectToSceneInventory() {
  console.log('PartyManager.connectToSceneInventory called');
  
  // Try to get Scene3DController instance
  this.scene3D = window.scene3D || null;
  
  if (this.scene3D) {
    console.log('Connected to Scene3DController:', this.scene3D);
    console.log('Scene3D has inventory:', !!this.scene3D.inventory);
    console.log('Scene3D has getInventoryItems method:', typeof this.scene3D.getInventoryItems === 'function');
    
    // Test the method if it exists
    if (typeof this.scene3D.getInventoryItems === 'function') {
      try {
        const items = this.scene3D.getInventoryItems();
        console.log('Sample result from getInventoryItems:', items.length > 0 ? items[0] : 'No items available');
      } catch (error) {
        console.error('Error testing getInventoryItems:', error);
      }
    }
    
    return true;
  } else {
    console.warn('No Scene3DController found - window.scene3D is:', window.scene3D);
    
    // Try again with a delay
    setTimeout(() => {
      if (window.scene3D && !this.scene3D) {
        this.scene3D = window.scene3D;
        console.log('Delayed connection to Scene3DController established');
      }
    }, 1000);
    
    return false;
  }
}

  // Placeholder equipment function (to be replaced with inventory integration)
  getEquipmentFromInventory(type) {
    if (!this.inventory) {
      // Generate starter equipment if we don't have any
      this.generateStarterEquipment();
    }
    
    if (type === 'weapon') {
      return this.inventory.weapons || [];
    } else if (type === 'armor') {
      return this.inventory.armor || [];
    }
    
    return [];
  }


  getPlaceholderEquipment(type) {
    console.log(`PartyManager.getPlaceholderEquipment(${type}) called`);
    
    // Initialize result array with existing inventory items
    let result = [];
    
    // Get items from own inventory
    if (type === 'weapon' && this.inventory && this.inventory.weapons) {
      result = [...this.inventory.weapons];
      console.log(`Found ${result.length} weapons in Party's own inventory`);
    } else if (type === 'armor' && this.inventory && this.inventory.armor) {
      result = [...this.inventory.armor];
      console.log(`Found ${result.length} armor pieces in Party's own inventory`);
    }
    
    // Try to get items from Scene3D inventory
    if (this.scene3D) {
      console.log('Scene3D connection exists, checking for getInventoryItems method');
      
      if (typeof this.scene3D.getInventoryItems === 'function') {
        console.log('Calling scene3D.getInventoryItems()');
        const sceneItems = this.scene3D.getInventoryItems().filter(item => item.type === type);
        
        if (sceneItems.length > 0) {
          console.log(`Found ${sceneItems.length} ${type}s in scene inventory:`, sceneItems);
          result = [...result, ...sceneItems];
        } else {
          console.log(`No ${type}s found in scene inventory`);
        }
      } else {
        console.warn('Scene3D connected, but getInventoryItems method is missing!');
      }
    } else {
      console.log('No Scene3D connection, skipping scene inventory');
    }
    
    // Generate starter equipment if we still don't have any
    if (result.length === 0) {
      console.log('No equipment found, generating starter equipment');
      this.generateStarterEquipment();
      
      // Get the generated items
      if (type === 'weapon' && this.inventory && this.inventory.weapons) {
        result = [...this.inventory.weapons];
      } else if (type === 'armor' && this.inventory && this.inventory.armor) {
        result = [...this.inventory.armor];
      }
    }
    
    console.log(`Returning ${result.length} ${type} items`);
    return result;
  }


  generateStarterEquipment() {
    // Create basic starter weapons
    const starterWeapons = [
      {
        id: 'starter_sword',
        name: 'Adventurer\'s Sword',
        damageBonus: 1,
        type: 'weapon',
        description: 'A reliable starter sword.'
      },
      {
        id: 'starter_staff',
        name: 'Apprentice\'s Staff',
        damageBonus: 1,
        type: 'weapon',
        description: 'A basic magical staff.'
      }
    ];
    
    // Create basic starter armor
    const starterArmor = [
      {
        id: 'starter_leather',
        name: 'Basic Leather Armor',
        acBonus: 1,
        type: 'armor',
        description: 'Simple but effective protection.'
      },
      {
        id: 'starter_robe',
        name: 'Apprentice\'s Robe',
        acBonus: 1,
        type: 'armor',
        description: 'Light protection with magical properties.'
      }
    ];
    
    // Initialize inventory if needed
    if (!this.inventory) {
      this.inventory = {
        weapons: [],
        armor: []
      };
    }
    
    // Add weapons if inventory is empty
    if (!this.inventory.weapons || this.inventory.weapons.length === 0) {
      this.inventory.weapons = starterWeapons;
    }
    
    // Add armor if inventory is empty
    if (!this.inventory.armor || this.inventory.armor.length === 0) {
      this.inventory.armor = starterArmor;
    }
    
    console.log('Generated starter equipment:', this.inventory);
    
    return this.inventory;
  }

  // Render equipment list for dialog
  renderEquipmentList(items, monster, slot) {
    // If no items, show message
    if (!items || items.length === 0) {
      return `
        <div style="text-align: center; padding: 20px;">
          <span class="material-icons" style="font-size: 36px; opacity: 0.5;">inventory_2</span>
          <p>No ${slot}s available</p>
        </div>
      `;
    }

    // Get currently equipped item
    const equippedItem = monster.equipment[slot];

    // Build html for equipment list
    let html = `
      <div class="equipment-list" style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
        <!-- Option to unequip -->
        <div class="equipment-item" data-item-id="none" data-slot="${slot}" style="display: flex; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; transition: background 0.2s ease;">
          <span class="material-icons" style="margin-right: 16px; color: #F44336;">remove_circle</span>
          <div style="flex: 1;">
            <div style="font-weight: bold;">Remove ${slot}</div>
            <div style="color: #666; font-size: 0.9em;">Unequip current ${slot}</div>
          </div>
        </div>
    `;

    // Add each item
    items.forEach(item => {
      // Check if this is the equipped item
      const isEquipped = equippedItem && equippedItem.id === item.id;

      html += `
        <div class="equipment-item ${isEquipped ? 'equipped' : ''}" 
             data-item-id="${item.id}" 
             data-slot="${slot}" 
             style="display: flex; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; transition: background 0.2s ease; ${isEquipped ? 'background: #e3f2fd; border-color: #2196F3;' : ''}">
          <div class="item-icon" style="margin-right: 16px;">
            ${item.icon ? `<img src="${item.icon}" alt="${item.name}" style="width: 40px; height: 40px;">` :
          `<span class="material-icons" style="font-size: 40px; color: #607D8B;">${slot === 'weapon' ? 'sports_martial_arts' : 'security'}</span>`}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: bold; display: flex; align-items: center;">
              ${item.name}
              ${isEquipped ? `<span class="material-icons" style="margin-left: 8px; color: #2196F3; font-size: 16px;">check_circle</span>` : ''}
            </div>
            <div style="color: #666; font-size: 0.9em;">${item.description || ''}</div>
            ${item.damageBonus || item.acBonus ? `
              <div style="color: #388E3C; margin-top: 4px; font-size: 0.9em;">
                ${item.damageBonus ? `+${item.damageBonus} damage` : ''}
                ${item.acBonus ? `+${item.acBonus} AC` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  // Updated Modified showRecruitmentDialog method to use createMonsterCard
  showRecruitmentDialog(monster, encounterMarker = null) {
    // Reset attempt counter logic - keep this part
    if (!this.recruitmentAttempts.currentMarker || 
        this.recruitmentAttempts.currentMarker !== encounterMarker) {
      console.log("New encounter - resetting attempt counter");
      this.recruitmentAttempts.currentCount = 0;
      this.recruitmentAttempts.currentMarker = encounterMarker;
      this.recruitmentAttempts.currentMonster = monster;
    } else {
      console.log(`Continuing encounter - attempt ${this.recruitmentAttempts.currentCount}/${this.recruitmentAttempts.maxAttempts}`);
    }
  
    if (document.querySelector('.party-overlay')) {
      document.querySelector('.party-overlay').remove();
    }
  
    // Create monster from bestiary data if needed
    const recruitMonster = monster.data ? monster : { data: monster };
    
    // Convert to a format compatible with createMonsterCard
    const cardMonster = this.prepareMonster(recruitMonster);
  
    // Create overlay and dialog
    const overlay = document.createElement('div');
    overlay.className = 'party-overlay';
    overlay.style.opacity = '0';
  
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'party-container';
    dialogContainer.style.maxWidth = '700px';
    dialogContainer.style.transform = 'scale(0.95)';
  
    // Create header
    const header = document.createElement('div');
    header.className = 'party-header';
    header.innerHTML = `
      <div style="text-align: center; width: 100%;">
        <h1 style="margin: 0; font-size: 1.5rem;">Monster Encounter</h1>
      </div>
      <button class="close-dialog-btn" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; border-radius: 50%;">
        <span class="material-icons">close</span>
      </button>
    `;
  
    // Create content
    const content = document.createElement('div');
    content.className = 'recruitment-content';
    content.style.padding = '24px';
    content.style.color = 'white';
  
    // Create presentation section
    const presentationSection = document.createElement('div');
    presentationSection.style.cssText = `
      display: flex;
      align-items: center; 
      justify-content: center; 
      margin-bottom: 32px;
    `;
  
    // Create monster card using the standardized method
    const monsterCard = this.createMonsterCard(cardMonster, 'encounter', true);
    monsterCard.style.marginRight = '24px';
  
    // Create description
    const description = document.createElement('div');
    description.style.maxWidth = '350px';
    description.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 1.3rem;">You've encountered a ${cardMonster.name}!</h2>
      <p style="margin-bottom: 16px; opacity: 0.9;">This creature appears to be watching you cautiously. Different approaches might work better depending on the monster's nature.</p>
      <p style="font-style: italic; opacity: 0.8;">How will you approach this ${cardMonster.type.toLowerCase()}?</p>
    `;
  
    // Assemble presentation section
    presentationSection.appendChild(monsterCard);
    presentationSection.appendChild(description);
  
    // Create approach options
    const approachSection = document.createElement('div');
    approachSection.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 1.2rem; text-align: center;">Choose Your Approach</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <button class="approach-btn negotiate" style="
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          padding: 16px;
          border-radius: 8px;
          color: white;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px;">
            <span class="material-icons" style="font-size: 36px; color: #3b82f6; margin-bottom: 8px;">chat</span>
            <span style="font-weight: bold; font-size: 1.1rem;">Negotiate</span>
          </div>
          <div style="font-size: 0.9rem; opacity: 0.9;">
            Try to convince the monster to join your party through conversation and diplomacy.
          </div>
        </button>
        
        <button class="approach-btn impress" style="
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 16px;
          border-radius: 8px;
          color: white;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px;">
            <span class="material-icons" style="font-size: 36px; color: #f59e0b; margin-bottom: 8px;">fitness_center</span>
            <span style="font-weight: bold; font-size: 1.1rem;">Impress</span>
          </div>
          <div style="font-size: 0.9rem; opacity: 0.9;">
            Demonstrate your strength and capabilities to gain the monster's respect.
          </div>
        </button>
        
    <!-- Gift button - ADD THIS -->
    <button class="approach-btn gift" style="
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.3);
      padding: 16px;
      border-radius: 8px;
      color: white;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
    ">
      <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px;">
        <span class="material-icons" style="font-size: 36px; color: #a855f7; margin-bottom: 8px;">card_giftcard</span>
        <span style="font-weight: bold; font-size: 1.1rem;">Offer Gift</span>
      </div>
      <div style="font-size: 0.9rem; opacity: 0.9;">
        Give the monster a gift as a token of friendship and goodwill.
      </div>
    </button>
  </div>
      
      <!-- Alternative options -->
      <div style="display: flex; justify-content: center; gap: 16px;">
        <button class="approach-btn fight" style="
          background: rgba(239, 68, 68, 0.2);
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        ">
          <span class="material-icons" style="margin-right: 8px;">swords</span>
          Fight
        </button>
        
        <button class="approach-btn flee" style="
          background: rgba(107, 114, 128, 0.2);
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        ">
          <span class="material-icons" style="margin-right: 8px;">directions_run</span>
          Flee
        </button>
      </div>
    `;
  
    // Assemble dialog
    content.appendChild(presentationSection);
    content.appendChild(approachSection);
    dialogContainer.appendChild(header);
    dialogContainer.appendChild(content);
    overlay.appendChild(dialogContainer);
    document.body.appendChild(overlay);
  
    // Add hover effects to approach buttons - keep this part
    const approachButtons = overlay.querySelectorAll('.approach-btn');
    approachButtons.forEach(button => {
      // Get current background
      const computedStyle = window.getComputedStyle(button);
      const bgColor = computedStyle.backgroundColor;
  
      // Create hover color (more opaque)
      const color = bgColor.replace('0.15', '0.25').replace('0.2', '0.3');
  
      // Add hover effect
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = color;
        button.style.transform = 'translateY(-2px)';
      });
  
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = bgColor;
        button.style.transform = '';
      });
    });
  
    // Add event listeners for buttons - keep this part
    overlay.querySelector('.close-dialog-btn').addEventListener('click', () => {
      overlay.style.opacity = '0';
      dialogContainer.style.transform = 'scale(0.95)';
      setTimeout(() => overlay.remove(), 300);
    });
  
    overlay.querySelector('.negotiate').addEventListener('click', () => {
      this.handleRecruitmentAttempt(recruitMonster, 'negotiate', overlay);
    });
  
    overlay.querySelector('.impress').addEventListener('click', () => {
      this.handleRecruitmentAttempt(recruitMonster, 'impress', overlay);
    });
  
    // overlay.querySelector('.gift').addEventListener('click', () => {
    //   this.handleRecruitmentAttempt(recruitMonster, 'gift', overlay);
    // });
  
    overlay.querySelector('.gift').addEventListener('click', () => {
      console.log("Gift button clicked");
      
      // Always clean up and recreate the drawer - this is key to fixing the issue
      if (this.giftDrawer) {
        // Remove existing drawer if it exists
        if (this.giftDrawer.parentNode) {
          this.giftDrawer.parentNode.removeChild(this.giftDrawer);
        }
        this.giftDrawer = null;
      }
      
      // Create a fresh drawer
      this.giftDrawer = this.createGiftDrawer();
      dialogContainer.appendChild(this.giftDrawer);
      
      // Show gift selection dialog
      this.showGiftSelection(recruitMonster, overlay);
    });

    overlay.querySelector('.fight').addEventListener('click', () => {
      overlay.style.opacity = '0';
      dialogContainer.style.transform = 'scale(0.95)';
      setTimeout(() => {
        overlay.remove();
        if (window.combatSystem) {
          window.combatSystem.initiateCombat();
        }
      }, 300);
    });
  
    overlay.querySelector('.flee').addEventListener('click', () => {
      overlay.style.opacity = '0';
      dialogContainer.style.transform = 'scale(0.95)';
      setTimeout(() => overlay.remove(), 300);
    });
  
    // Animate in
    setTimeout(() => {
      overlay.style.opacity = '1';
      dialogContainer.style.transform = 'scale(1)';
    }, 10);
  }


  // Handle recruitment attempt
  handleRecruitmentAttempt(monster, approach, overlay) {

    //`Attempt: 1/${this.recruitmentAttempts.maxAttempts}`;

    this.recruitmentAttempts.currentCount++;

    console.log(`Recruitment attempt: ${this.recruitmentAttempts.currentCount}/${this.recruitmentAttempts.maxAttempts}`);


    // Determine success chance based on monster type and approach
    let successChance = 0.5;  // Base 50% chance

    // Adjust based on monster type and approach
    if (approach === 'negotiate') {
      // Intelligent creatures are more receptive to negotiation
      if (['humanoid', 'fey', 'fiend', 'celestial'].includes(monster.data.basic?.type?.toLowerCase())) {
        successChance += 0.2;
      } else if (['beast', 'monstrosity', 'ooze'].includes(monster.data.basic?.type?.toLowerCase())) {
        successChance -= 0.2;
      }
    } else if (approach === 'impress') {
      // Some monsters respect displays of strength
      if (['dragon', 'monstrosity', 'giant'].includes(monster.data.basic?.type?.toLowerCase())) {
        successChance += 0.2;
      } else if (['fey', 'celestial', 'undead'].includes(monster.data.basic?.type?.toLowerCase())) {
        successChance -= 0.2;
      }
    } else if (approach === 'gift') {
      // Some creatures value gifts more than others
      if (['dragon', 'fey', 'humanoid'].includes(monster.data.basic?.type?.toLowerCase())) {
        successChance += 0.2;
      }
    }

    // Adjust based on monster CR
    // Higher CR monsters are harder to recruit
    const cr = parseFloat(monster.data.basic?.cr || '0');
    if (cr <= 1) {
      successChance += 0.1;
    } else if (cr >= 5) {
      successChance -= 0.1 * Math.min(5, Math.floor(cr / 5));  // -0.1 for every 5 CR
    }

    // Cap success chance
    successChance = Math.max(0.1, Math.min(0.9, successChance));

    // Roll for success
    const roll = Math.random();
    const success = roll <= successChance;

    console.log(`Recruitment attempt (${approach}): ${roll} vs ${successChance.toFixed(2)} - ${success ? 'SUCCESS' : 'FAILURE'}`);

    // Show result with dice animation
    this.showRecruitmentResult(monster, success, approach, overlay);

     
  // Check if we've reached max attempts
  if (!success && this.recruitmentAttempts.currentCount >= this.recruitmentAttempts.maxAttempts) {
    // Failed all attempts - close dialog after showing result
    setTimeout(() => {
      this.closeRecruitmentDialog(overlay);
      this.removeEncounterMarker();
    }, 3000); // Give time to see the final failure message
  }

    return success;
  }

// First, add the missing closeRecruitmentDialog method
closeRecruitmentDialog(overlay) {
  if (overlay) {
    overlay.style.opacity = '0';
    const dialogContainer = overlay.querySelector('.party-container');
    if (dialogContainer) {
      dialogContainer.style.transform = 'scale(0.95)';
    }
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }
}

// Then, update removeEncounterMarker to properly handle Sprite objects
removeEncounterMarker() {
  if (!this.recruitmentAttempts.currentMarker) {
    console.log("No marker to remove");
    return;
  }
  
  // Reference to the current marker
  const marker = this.recruitmentAttempts.currentMarker;
  
  console.log(`Removing encounter marker after recruitment interaction:`, marker);
  console.log(`Marker details:`, {
    id: marker.id,
    type: marker.type,
    position: marker.position ? `(${marker.position.x}, ${marker.position.y}, ${marker.position.z})` : 'No position',
    userData: marker.userData
  });
  
  // If we have access to Scene3D, remove the marker
  if (window.scene3D) {
    // Since marker is a Sprite, we can remove it directly from the scene
    if (marker.parent) {
      console.log(`Removing sprite directly from its parent`);
      marker.parent.remove(marker);
    }
    
    // ALSO need to remove it from the markers array by ID
    if (window.scene3D.markers) {
      // Iterate through all markers to find matching encounter markers
      const monsterName = marker.userData?.monster?.basic?.name;
      
      if (monsterName) {
        console.log(`Looking for marker with monster name: ${monsterName}`);
        
        // Filter out markers with matching monster name
        const initialCount = window.scene3D.markers.length;
        window.scene3D.markers = window.scene3D.markers.filter(m => {
          if (m.type === "encounter" && 
              m.data && m.data.monster && 
              m.data.monster.basic && 
              m.data.monster.basic.name === monsterName) {
            console.log(`Found and removing marker for ${monsterName}`);
            return false; // remove this marker
          }
          return true; // keep other markers
        });
        
        console.log(`Removed ${initialCount - window.scene3D.markers.length} markers from markers array`);
      }
    }
    
    console.log(`Encounter marker removal processing complete`);
  } else {
    console.warn('No window.scene3D available - cannot remove marker from scene');
  }
  
  // Clear current marker reference
  this.recruitmentAttempts.currentMarker = null;
  this.recruitmentAttempts.currentMonster = null;
}

  // Show recruitment result with animation
  // showRecruitmentResult(monster, success, approach, overlay) {

  showRecruitmentResult(monster, success, approach, overlay, extraData = {}) {

    const dialogContainer = overlay.querySelector('.party-container');

    const content = overlay.querySelector('.recruitment-content');
    if (!content) {
      console.error('Cannot find recruitment-content element');
      return;
    }

    content.innerHTML = '';

    // Create result content
    const resultContent = document.createElement('div');
    resultContent.className = 'recruitment-result';
    resultContent.style.cssText = `
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  `;

    // Create dice animation container
    const diceContainer = document.createElement('div');
    diceContainer.className = 'dice-animation';
    diceContainer.style.cssText = `
    margin-bottom: 24px;
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

    // Add spinning dice animation - was 
    diceContainer.innerHTML = `
    <div class="spinning-dice" style="font-size: 64px; animation: spin 1s ease-out forwards;"><i class="fa-solid fa-dice-d20"></i></i></div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg) scale(0.5); opacity: 0.5; }
        50% { transform: rotate(360deg) scale(1.2); opacity: 1; }
        100% { transform: rotate(720deg) scale(1); opacity: 1; }
      }
      @keyframes fadeResult {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;

    // Create result message container (hidden initially)
    const resultMessage = document.createElement('div');
    resultMessage.className = 'result-message';
    resultMessage.style.cssText = `
    opacity: 0;
    animation: fadeResult 0.5s ease-out 1s forwards;
  `;

    // Determine result message based on success and approach
    let message, icon, iconColor;

    if (success) {
      message = `${monster.data.basic?.name} has joined your party!`;
      icon = 'emoji_events';
      iconColor = '#FFD700';

      // Additional flavor based on approach
      let approachMessage = '';
      switch (approach) {
        case 'negotiate':
          approachMessage = 'Your diplomatic approach was successful.';
          break;
        case 'impress':
          approachMessage = 'The monster was impressed by your display of strength.';
          break;
        case 'gift':
          const extraInfo = extraData || {}; // This line was causing the error
          const itemName = extraInfo.itemName || 'your gift';
          const newName = extraInfo.monsterName;
          const effectiveness = extraInfo.effectiveness || '';
          
          if (effectiveness === 'Perfect') {
            approachMessage = `The ${monster.name} was thrilled by ${itemName}! `;
          } else if (effectiveness === 'Good') {
            approachMessage = `The ${monster.name} appreciated ${itemName}. `;
          } else {
            approachMessage = `The ${monster.name} accepted ${itemName}. `;
          }
          
          if (newName) {
            approachMessage += `You've named your new companion ${newName}.`;
          }
            break;
        }

        // Add warning about attempts remaining
  if (this.recruitmentAttempts.currentCount < this.recruitmentAttempts.maxAttempts) {
    approachMessage += ` (${this.recruitmentAttempts.maxAttempts - this.recruitmentAttempts.currentCount} attempts remaining)`;
  } else {
    approachMessage += ' The monster is no longer interested and leaves...';
  }

      resultMessage.innerHTML = `
      <span class="material-icons" style="font-size: 48px; color: ${iconColor}; margin-bottom: 16px;">${icon}</span>
      <h2 style="margin: 0 0 8px 0; color: #388E3C;">Success!</h2>
      <p style="margin: 0 0 16px 0; font-size: 1.2em;">${message}</p>
      <p style="color: #666;">${approachMessage}</p>
      <sl-button class="continue-btn" variant="primary" style="margin-top: 24px;">Continue</sl-button>
    `;
    } else {
      message = `${monster.data.basic?.name} refused to join your party.`;
      icon = 'cancel';
      iconColor = '#F44336';
console.log(`Attempt: 1/'${this.recruitmentAttempts.maxAttempts}`);
      // Additional flavor based on approach
      let approachMessage = '';
      switch (approach) {
        case 'negotiate':
          approachMessage = 'Your words failed to convince the monster.';
          break;
        case 'impress':
          approachMessage = 'The monster was unimpressed by your display.';
          break;
        case 'gift':
          approachMessage = 'Your gift was rejected.';
          break;
      }


        // Check if we still have attempts left
        const attemptsRemaining = this.recruitmentAttempts.maxAttempts - this.recruitmentAttempts.currentCount;
        const isLastAttempt = attemptsRemaining <= 0;
    
        // Add message about remaining attempts
        if (!isLastAttempt) {
          approachMessage += ` (${attemptsRemaining} attempts remaining)`;
        } else {
          approachMessage += ' The monster is no longer interested in joining.';
        }
    
        // Different buttons based on remaining attempts
        const buttonsHTML = !isLastAttempt ? 
          `<div style="display: flex; gap: 16px; margin-top: 24px;">
            <sl-button class="try-again-btn" variant="primary">Try Again</sl-button>
            <sl-button class="fight-btn" variant="danger">Fight</sl-button>
            <sl-button class="flee-btn" variant="neutral">Flee</sl-button>
          </div>` :
          `<div style="display: flex; gap: 16px; margin-top: 24px;">
            <sl-button class="fight-btn" variant="danger">Fight</sl-button>
            <sl-button class="flee-btn" variant="neutral">Flee</sl-button>
          </div>`;
    
        resultMessage.innerHTML = `
          <span class="material-icons" style="font-size: 48px; color: ${iconColor}; margin-bottom: 16px;">${icon}</span>
          <h2 style="margin: 0 0 8px 0; color: #D32F2F;">Failure!</h2>
          <p style="margin: 0 0 16px 0; font-size: 1.2em;">${message}</p>
          <p style="color: #666;">${approachMessage}</p>
          ${buttonsHTML}
        `;


    }

    // Assemble result content
    resultContent.appendChild(diceContainer);
    resultContent.appendChild(resultMessage);
    content.appendChild(resultContent);


    // Add event listeners after dice animation finishes
    setTimeout(() => {
      if (success) {
        // Add monster to party
        this.addMonster(monster);
    
        // Continue button
        resultContent.querySelector('.continue-btn').addEventListener('click', () => {
          // Close overlay
          overlay.style.opacity = '0';
          dialogContainer.style.transform = 'scale(0.95)';
          setTimeout(() => {
            overlay.remove();
            this.recruitmentOverlay = null;
            
            // IMPORTANT: Also remove the encounter marker on success
            this.removeEncounterMarker();
          }, 300);
        });
      } else {
        // Try again button (only present if attempts remain)
        const tryAgainBtn = resultContent.querySelector('.try-again-btn');
        if (tryAgainBtn) {
          tryAgainBtn.addEventListener('click', () => {
            // Show recruitment dialog again
            this.showRecruitmentDialog(monster.data || monster, this.recruitmentAttempts.currentMarker);
          });
        }
  
        // Fight button
        resultContent.querySelector('.fight-btn').addEventListener('click', () => {
          // Close overlay
          overlay.style.opacity = '0';
          dialogContainer.style.transform = 'scale(0.95)';
  
          setTimeout(() => {
            overlay.remove();
  
            // Trigger combat with this monster
            if (window.combatSystem) {
              window.combatSystem.initiateCombat([monster]);
            } else {
              console.warn('Combat system not available');
            }
            
            // Since we've used up the recruitment chance (fought instead),
            // remove the marker if this was the last attempt
            if (this.recruitmentAttempts.currentCount >= this.recruitmentAttempts.maxAttempts) {
              this.removeEncounterMarker();
            }
          }, 300);
        });
  
        // Flee button - always removes the marker if it was the last attempt
        resultContent.querySelector('.flee-btn').addEventListener('click', () => {
          // Close overlay
          overlay.style.opacity = '0';
          dialogContainer.style.transform = 'scale(0.95)';
  
          setTimeout(() => {
            overlay.remove();
            this.recruitmentOverlay = null;
            
            // Remove the encounter marker if this was the last attempt
            if (this.recruitmentAttempts.currentCount >= this.recruitmentAttempts.maxAttempts) {
              this.removeEncounterMarker();
            }
          }, 300);
        });
      }
    }, 1000);  // Wait for dice animation
  }

  /**
   * Equipment/Inventory Helpers
   */

  // Get available equipment
  getAvailableEquipment(type) {
    // This would normally get equipment from inventory
    // For now, we'll return sample items

    if (type === 'weapon') {
      return [
        {
          id: 'sword1',
          name: 'Iron Sword',
          description: 'A simple but sturdy iron sword',
          damageBonus: 1,
          icon: 'icons/weapons/sword.png'
        },
        {
          id: 'axe1',
          name: 'Battle Axe',
          description: 'A heavy axe that deals devastating blows',
          damageBonus: 2,
          icon: 'icons/weapons/axe.png'
        },
        {
          id: 'wand1',
          name: 'Magic Wand',
          description: 'A wooden wand with magical properties',
          damageBonus: 1,
          icon: 'icons/weapons/wand.png'
        }
      ];
    } else if (type === 'armor') {
      return [
        {
          id: 'leather1',
          name: 'Leather Armor',
          description: 'Simple protection made from tanned hide',
          acBonus: 1,
          icon: 'icons/armor/leather.png'
        },
        {
          id: 'chain1',
          name: 'Chain Mail',
          description: 'Interlocking metal rings provide good protection',
          acBonus: 3,
          icon: 'icons/armor/chainmail.png'
        },
        {
          id: 'scale1',
          name: 'Scale Armor',
          description: 'Overlapping metal scales for flexible defense',
          acBonus: 2,
          icon: 'icons/armor/scale.png'
        }
      ];
    }

    return [];
  }


  /**
   * Starter Monsters
   */
  // New method to ensure we can access bestiary data
  ensureBestiaryAccess() {
    // If ResourceManager doesn't have bestiary data but has MonsterManager, load it
    if (this.resourceManager &&
      this.resourceManager.resources &&
      this.resourceManager.resources.bestiary.size === 0 &&
      this.resourceManager.monsterManager) {

      console.log('PartyManager: Loading bestiary from database');
      this.resourceManager.loadBestiaryFromDatabase();
    }

    // If we have direct access to MonsterManager but ResourceManager doesn't, set it up
    if (this.monsterManager && !this.resourceManager?.monsterManager) {
      console.log('PartyManager: Setting up MonsterManager connection');
      if (this.resourceManager) {
        this.resourceManager.monsterManager = this.monsterManager;
        this.resourceManager.loadBestiaryFromDatabase();
      }
    }
  }


    // Update checkForStarterMonster to use the new method
  async checkForStarterMonster() {
    try {
      // Await the result from getEligibleStarterMonsters
      const eligibleMonsters = await this.getEligibleStarterMonsters();
  
      // If we don't have any eligible monsters, just exit
      if (!eligibleMonsters || eligibleMonsters.length === 0) {
        console.warn('No eligible starter monsters found in bestiary');
        return;
      }
  
      // Pick 3 random monsters from eligible list
      const starterChoices = this.getRandomStarters(eligibleMonsters, 3);
  
      // Use the improved showStarterSelection method instead
      this.showStarterSelection(starterChoices);
    } catch (error) {
      console.error('Error getting starter monsters:', error);
      // Fallback to defaults as a last resort
      const defaultMonsters = this.createDefaultStarterMonsters();
      const starterChoices = this.getRandomStarters(defaultMonsters, 3);
      // Use the improved showStarterSelection method here too
      this.showStarterSelection(starterChoices);
    }
  }
  
  // Update offerStarterMonster to use the new method too
  offerStarterMonster() {
    const eligibleMonsters = this.getEligibleStarterMonsters();
  
    if (eligibleMonsters.length === 0) {
      console.warn('No eligible starter monsters found in bestiary');
      return;
    }
  
    // Pick 3 random monsters from eligible list
    const starterChoices = this.getRandomStarters(eligibleMonsters, 3);
  
    // Use the improved showStarterSelection method
    this.showStarterSelection(starterChoices);
  }

  // Find eligible starter monsters from bestiary
  getEligibleStarterMonsters() {
    console.log("PartyManager looking for starter monsters");

    // Get direct access to database if possible
    const monsterDatabase = this.monsterDatabase ||
      (this.monsterManager ? this.monsterManager.loadDatabase() : null);

    console.log("Direct database access:", !!monsterDatabase);

    // Create a list of eligible monsters
    const eligibleMonsters = [];

    // If we have direct access to the database, use it
    if (monsterDatabase && monsterDatabase.monsters) {
      console.log(`Found ${Object.keys(monsterDatabase.monsters).length} monsters in database`);

      // Process all monsters in the database
      Object.values(monsterDatabase.monsters).forEach(monster => {
        try {
          // Check CR value for eligibility
          const cr = monster.basic?.cr || '0';
          const isEligible = cr === '0' || cr === '1/8' || cr === '1/4' || cr === '1/2';

          if (isEligible) {
            // console.log(`Found eligible starter: ${monster.basic.name} (CR ${cr})`);
            eligibleMonsters.push(this.formatMonsterForParty(monster));
          }
        } catch (error) {
          console.error("Error processing monster:", error);
        }
      });
    } else {
      console.warn("No direct database access available");
    }

    // console.log(`Found ${eligibleMonsters.length} eligible starter monsters`);

    // If no eligible monsters found, create default starter monsters
    if (eligibleMonsters.length === 0) {
      // console.log("No eligible monsters found, creating defaults");
      return this.createDefaultStarterMonsters();
    }

    return eligibleMonsters;
  }

  // Helper method to retry getting monsters with increasing delays
  retryGetMonsters(resourceManager, monsterDatabase, attempt = 0, maxAttempts = 3) {
    const eligibleMonsters = [];
    const MAX_STARTER_XP = 100;

    // First try ResourceManager's bestiary
    if (resourceManager?.resources?.bestiary?.size > 0) {
      // console.log(`Checking ${resourceManager.resources.bestiary.size} monsters in ResourceManager`);

      resourceManager.resources.bestiary.forEach(monster => {
        try {
          // Calculate XP from CR if needed
          const xp = this.getMonsterXP(monster);
          if (xp <= MAX_STARTER_XP && xp > 0) {
            // console.log(`Found eligible starter: ${monster.name} (XP: ${xp})`);
            eligibleMonsters.push(this.formatMonsterForParty(monster));
          }
        } catch (error) {
          console.error("Error processing monster:", error);
        }
      });
    }
    // Then try direct database access as fallback
    else if (monsterDatabase?.monsters) {
      // console.log(`Checking ${Object.keys(monsterDatabase.monsters).length} monsters in database`);

      Object.values(monsterDatabase.monsters).forEach(monster => {
        try {
          // Get XP from CR
          const cr = monster.basic?.cr || "0";
          let xp = 0;

          if (cr === "1/4") xp = 50;
          else if (cr === "1/2") xp = 100;
          else if (cr === "0") xp = 10;
          else if (cr === "1/8") xp = 25;

          if (xp <= MAX_STARTER_XP && xp > 0) {
            // console.log(`Found eligible starter: ${monster.basic.name} (CR: ${cr}, XP: ${xp})`);
            eligibleMonsters.push(this.formatMonsterForParty(monster));
          }
        } catch (error) {
          console.error("Error processing monster from database:", error);
        }
      });
    }

    // console.log(`Found ${eligibleMonsters.length} eligible starter monsters on attempt ${attempt + 1}`);

    // If no monsters found and we have retries left, try again with delay
    if (eligibleMonsters.length === 0 && attempt < maxAttempts - 1) {
      const delay = (attempt + 1) * 500; // Increasing delays: 500ms, 1000ms, etc.
      console.log(`No monsters found yet, retrying in ${delay}ms...`);

      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.retryGetMonsters(resourceManager, monsterDatabase, attempt + 1, maxAttempts));
        }, delay);
      });
    }

    // If we still don't have monsters or we're out of retries, create defaults
    if (eligibleMonsters.length === 0) {
      console.log("No eligible monsters found, creating defaults");
      return this.createDefaultStarterMonsters();
    }

    return eligibleMonsters;
  }

  // Add these helper methods if they don't exist
  // Helper to format monster for party
  formatMonsterForParty(monster) {
    try {
      // Create token if needed
      let tokenData = null;

      if (monster.token?.data) {
        tokenData = monster.token.data;
      } else if (monster.token?.url) {
        tokenData = monster.token.url;
      } else {
        // Generate a default token
        tokenData = this.monsterManager?.generateDefaultMonsterToken(monster.basic.name, monster.basic.size) || null;
      }

      return {
        id: `monster_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: monster.basic.name,
        type: monster.basic.type,
        size: monster.basic.size,
        level: 1,
        cr: monster.basic.cr,
        currentHP: monster.stats.hp.average,
        maxHP: monster.stats.hp.average,
        armorClass: monster.stats.ac,
        experience: 0,
        experienceToNext: 100,
        token: {
          data: tokenData
        },
        data: monster,
        abilities: monster.abilities,
        monsterAbilities: [],
        equipment: { weapon: null, armor: null }
      };
    } catch (error) {
      console.error("Error formatting monster for party:", error);
      return null;
    }
  }



  hasAvailableCombo(monsterId) {
    // Get all available combos
    const availableCombos = this.getAvailableComboAbilities();
      
    // Check if any combo includes this monster
    return availableCombos?.some(combo => 
      combo.monsters.some(m => m.id === monsterId)
    ) || false;
  }

  getMonsterCombos(monsterId) {
    // Get all available combos
    const availableCombos = this.getAvailableComboAbilities ? 
      this.getAvailableComboAbilities() : 
      (this.partyManager?.getAvailableComboAbilities ? this.partyManager.getAvailableComboAbilities() : []);
    
    // Filter to combos that include this monster
    return availableCombos?.filter(combo => 
      combo.monsters.some(m => m.id === monsterId)
    ) || [];
  }


  createComboAbilitiesSection(monster) {
    // Get combos for this monster
    const monsterCombos = this.getMonsterCombos(monster.id);
    
    // If no combos, return nothing
    if (!monsterCombos || monsterCombos.length === 0) {
      return '';
    }
    
    // Create the combo abilities section HTML
    let html = `
    <div class="details-section">
      <div class="details-section-title" style="display: flex; align-items: center;">
        <span class="material-icons" style="font-size: 20px; margin-right: 8px; color: #4ade80;">group</span>
        Combo Abilities
      </div>
      <div class="abilities-container" style="
        background: #f0f9f0;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #d1fae5;
        width: 100%;
        box-sizing: border-box;
      ">
        <div class="monster-abilities combo-abilities" style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          width: 100%;
        ">
    `;
    
    // Add each combo ability
    monsterCombos.forEach(combo => {
      // Find the partner monster
      const partner = combo.monsters.find(m => m.id !== monster.id);
      
      // Background color based on combo type or defined color
      const bgColor = combo.color ? 
        `${combo.color}1A` : // Convert hex to rgba with 0.1 opacity
        (combo.type === 'attack' ? 'rgba(239, 68, 68, 0.1)' : 
         combo.type === 'area' ? 'rgba(245, 158, 11, 0.1)' : 
         combo.type === 'buff' ? 'rgba(16, 185, 129, 0.1)' : 
         'rgba(74, 222, 128, 0.1)');
      
      // Text color based on combo type or defined color
      const iconColor = combo.color || 
        (combo.type === 'attack' ? '#ef4444' : 
         combo.type === 'area' ? '#f59e0b' : 
         combo.type === 'buff' ? '#10b981' : 
         '#4ade80');
      
      // Icon based on combo type or defined icon
      const icon = combo.icon || 
        (combo.type === 'attack' ? 'sports_martial_arts' : 
         combo.type === 'area' ? 'blur_circular' : 
         combo.type === 'buff' ? 'upgrade' : 
         'group');
      
      let detailsText = '';
      
      // Add combat details based on combo properties
      if (combo.damage) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #ef4444;">Damage: ${combo.damage}</div>`;
      }
      
      if (combo.healing) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #10b981;">Healing: ${combo.healing}</div>`;
      }
      
      if (combo.duration) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #6b7280;">Duration: ${combo.duration} turns</div>`;
      }
      
      if (combo.defensiveBonus) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #3b82f6;">Defense Bonus: +${combo.defensiveBonus}</div>`;
      }
      
      if (combo.attackBonus) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #ef4444;">Attack Bonus: +${combo.attackBonus}</div>`;
      }
      
      if (combo.effectDescription) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #8b5cf6;">${combo.effectDescription}</div>`;
      }
      
      if (combo.lifeSteal) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #ec4899;">Life Steal: Heals for 50% of damage</div>`;
      }
      
      if (combo.criticalRange) {
        detailsText += `<div style="margin-top: 4px; font-size: 0.8rem; color: #f59e0b;">Critical on: ${combo.criticalRange}-20</div>`;
      }
      
      html += `
        <div class="ability-card combo-card" style="background: ${bgColor}; position: relative;">
          <div class="ability-header">
            <div class="ability-icon" style="color: ${iconColor};">
              <span class="material-icons small">${icon}</span>
            </div>
            <div class="ability-title-row">
              <div class="ability-title">${combo.name}</div>
              ${combo.damage ? `<div class="ability-damage" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">${combo.damage}</div>` : ''}
            </div>
          </div>
          <div class="ability-description">${combo.description || 'No description available.'}</div>
          
          ${detailsText}
          
          <!-- Partner indicator -->
          <div style="
            display: flex;
            align-items: center;
            margin-top: 8px;
            padding-top: 4px;
            border-top: 1px solid rgba(0,0,0,0.05);
            font-size: 0.75rem;
          ">
            <span class="material-icons" style="font-size: 12px; margin-right: 4px; color: ${iconColor};">people</span>
            <span>With: ${partner ? partner.name : 'another monster'}</span>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    </div>
    `;
    
    return html;
  }

  getMonsterXP(monster) {
    // XP might be in different locations based on data structure
    if (monster.data?.basic?.xp) return parseInt(monster.data.basic.xp);
    if (monster.data?.xp) return parseInt(monster.data.xp);
    if (monster.basic?.xp) return parseInt(monster.basic.xp);
    if (monster.xp) return parseInt(monster.xp);

    // If no XP found, try to determine from CR
    const cr = monster.data?.basic?.cr || monster.basic?.cr;
    if (cr) {
      const crToXP = {
        '0': 10,
        '1/8': 25,
        '1/4': 50,
        '1/2': 100,
        '1': 200
      };
      return crToXP[cr] || 0;
    }

    return 0;
  }

  getMonsterName(monster) {
    return monster.data?.basic?.name || monster.basic?.name || monster.name || "Unknown Monster";
  }

  generateMonsterThumbnail(monster) {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Generate color based on monster type
    const colors = {
      aberration: '#5500AA',  // Purple - alien and unnatural beings
      beast: '#44AA44',       // Green - natural creatures
      celestial: '#FFD700',   // Gold - divine and radiant beings
      construct: '#999999',   // Gray - artificial or mechanical beings
      dragon: '#FF4444',      // Red - powerful, elemental creatures
      elemental: '#FF8800',   // Orange - creatures of pure elemental energy
      fey: '#DD66FF',         // Pink/Purple - whimsical and otherworldly
      fiend: '#AA2222',       // Dark Red - demons and devils
      giant: '#AA7722',       // Brown/Orange - large humanoid creatures
      humanoid: '#4444FF',    // Blue - sentient, civilized species
      monstrosity: '#886600', // Dark Yellow - unnatural or mutated creatures
      ooze: '#66CC66',        // Light Green - gelatinous and amorphous beings
      plant: '#228B22',       // Forest Green - living plant-based creatures
      undead: '#663366',      // Dark Purple - spirits and reanimated corpses
      vermin: '#996633',      // Brown - insects, spiders, and pests

      // Subtypes and additional categories
      demon: '#990000',       // Deep Red - Chaotic fiends
      devil: '#660000',       // Dark Crimson - Lawful fiends
      lich: '#330066',        // Dark Indigo - Powerful undead mages
      ghost: '#9999FF',       // Pale Blue - Ethereal spirits
      skeleton: '#CCCCCC',    // Bone White - Basic undead soldiers
      vampire: '#550000',     // Blood Red - Classic horror monsters
      lycanthrope: '#775500', // Brown - Werewolves and shapechangers
      mimic: '#AA33CC',       // Purple - Deceptive creatures
      aberrant_horror: '#220044', // Deep Purple - Cosmic horror creatures
      swamp_beast: '#556B2F', // Dark Olive Green - Creatures of the swamp
      sea_monster: '#008080', // Teal - Aquatic terrors
      storm_creature: '#708090', // Slate Gray - Creatures tied to lightning and storms
      fire_entity: '#FF4500', // Orange-Red - Fire-based beings
      frost_monster: '#00FFFF', // Cyan - Ice creatures
      shadow_creature: '#222222', // Almost Black - Beings of darkness
      celestial_guardian: '#FFFFCC', // Soft Gold - Divine protectors
      arcane_construct: '#6666FF', // Soft Blue - Magical constructs
      ancient_horror: '#3B3B6D', // Dark Slate Blue - Forgotten, eldritch things
      chaos_entity: '#FF00FF', // Magenta - Chaotic beings
      nature_spirit: '#32CD32', // Lime Green - Embodiments of the wild
      sand_creature: '#D2B48C', // Tan - Desert-based creatures
    };



    const type = monster.basic?.type || 'unknown';
    const color = colors[type.toLowerCase()] || '#888888';

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
    ctx.fillText((monster.basic?.name || 'M').charAt(0).toUpperCase(), size / 2, size / 2);

    return canvas.toDataURL('image/webp');
  }
  // Updated createDefaultStarterMonsters with tokens
  createDefaultStarterMonsters() {
    // Create simple SVG-based tokens
    const wolfToken = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%234f46e5" stroke="white" stroke-width="2"/><path d="M30,40 L42,55 L35,70 L50,60 L65,70 L58,55 L70,40 L55,45 L50,30 L45,45 Z" fill="white"/></svg>`;

    const fireToken = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23ef4444" stroke="white" stroke-width="2"/><path d="M50,20 C60,40 80,40 70,60 C65,70 60,75 50,80 C40,75 35,70 30,60 C20,40 40,40 50,20 Z" fill="white"/></svg>`;

    const feyToken = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%2306b6d4" stroke="white" stroke-width="2"/><path d="M30,60 C25,40 50,20 75,40 C65,45 70,65 50,70 C30,65 35,45 30,60 Z M35,35 C40,30 60,30 65,35 C55,45 45,45 35,35 Z" fill="white"/></svg>`;

    return [
      {
        id: 'starter_wolf',
        name: 'Young Wolf',
        type: 'Beast',
        size: 'Medium',
        level: 1,
        cr: '1/4',
        currentHP: 11,
        maxHP: 11,
        armorClass: 13,
        experience: 0,
        experienceToNext: 100,
        token: {
          data: wolfToken
        },
        data: {
          basic: {
            name: 'Young Wolf',
            type: 'Beast',
            size: 'Medium',
            cr: '1/4',
            alignment: 'Unaligned'
          },
          stats: {
            ac: 13,
            hp: { average: 11, roll: '2d8+2', max: 18 },
            speed: '40 ft.'
          },
          abilities: {
            str: { score: 12, modifier: 1 },
            dex: { score: 15, modifier: 2 },
            con: { score: 12, modifier: 1 },
            int: { score: 3, modifier: -4 },
            wis: { score: 12, modifier: 1 },
            cha: { score: 6, modifier: -2 }
          },
          token: {
            data: wolfToken
          }
        },
        abilities: {
          str: { score: 12, modifier: 1 },
          dex: { score: 15, modifier: 2 },
          con: { score: 12, modifier: 1 },
          int: { score: 3, modifier: -4 },
          wis: { score: 12, modifier: 1 },
          cha: { score: 6, modifier: -2 }
        },
        monsterAbilities: [
          { name: 'Bite', type: 'attack', damage: '1d4+1', description: 'Melee attack that deals piercing damage.' },
          { name: 'Pack Tactics', type: 'buff', description: 'Advantage on attack rolls when allies are nearby.' }
        ]
      },
      {
        id: 'starter_elemental',
        name: 'Minor Fire Elemental',
        type: 'Elemental',
        size: 'Small',
        level: 1,
        cr: '1/2',
        currentHP: 15,
        maxHP: 15,
        armorClass: 13,
        experience: 0,
        experienceToNext: 100,
        token: {
          data: fireToken
        },
        data: {
          basic: {
            name: 'Minor Fire Elemental',
            type: 'Elemental',
            size: 'Small',
            cr: '1/2',
            alignment: 'Neutral'
          },
          stats: {
            ac: 13,
            hp: { average: 15, roll: '3d6+6', max: 24 },
            speed: '30 ft.'
          },
          abilities: {
            str: { score: 10, modifier: 0 },
            dex: { score: 16, modifier: 3 },
            con: { score: 14, modifier: 2 },
            int: { score: 6, modifier: -2 },
            wis: { score: 10, modifier: 0 },
            cha: { score: 6, modifier: -2 }
          },
          token: {
            data: fireToken
          }
        },
        abilities: {
          str: { score: 10, modifier: 0 },
          dex: { score: 16, modifier: 3 },
          con: { score: 14, modifier: 2 },
          int: { score: 6, modifier: -2 },
          wis: { score: 10, modifier: 0 },
          cha: { score: 6, modifier: -2 }
        },
        monsterAbilities: [
          { name: 'Fire Touch', type: 'attack', damage: '1d6+3', description: 'Melee attack that deals fire damage.' },
          { name: 'Heat Aura', type: 'area', damage: '1d4', description: 'Damages enemies in close proximity.' }
        ]
      },
      {
        id: 'starter_sprite',
        name: 'Forest Sprite',
        type: 'Fey',
        size: 'Tiny',
        level: 1,
        cr: '1/4',
        currentHP: 10,
        maxHP: 10,
        armorClass: 15,
        experience: 0,
        experienceToNext: 100,
        token: {
          data: feyToken
        },
        data: {
          basic: {
            name: 'Forest Sprite',
            type: 'Fey',
            size: 'Tiny',
            cr: '1/4',
            alignment: 'Neutral Good'
          },
          stats: {
            ac: 15,
            hp: { average: 10, roll: '4d4', max: 16 },
            speed: '20 ft., fly 40 ft.'
          },
          abilities: {
            str: { score: 4, modifier: -3 },
            dex: { score: 18, modifier: 4 },
            con: { score: 10, modifier: 0 },
            int: { score: 14, modifier: 2 },
            wis: { score: 13, modifier: 1 },
            cha: { score: 15, modifier: 2 }
          },
          token: {
            data: feyToken
          }
        },
        abilities: {
          str: { score: 4, modifier: -3 },
          dex: { score: 18, modifier: 4 },
          con: { score: 10, modifier: 0 },
          int: { score: 14, modifier: 2 },
          wis: { score: 13, modifier: 1 },
          cha: { score: 15, modifier: 2 }
        },
        monsterAbilities: [
          { name: 'Magical Touch', type: 'attack', damage: '1d4+4', description: 'Ranged attack that deals magical damage.' },
          { name: 'Invisibility', type: 'buff', description: 'Can become invisible until next attack.' }
        ]
      }
    ];
  }

  // Choose random starter choices
  getRandomStarters(monsters, count) {
    const shuffled = [...monsters].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Offer starter monster selection
  offerStarterMonster() {
    const eligibleMonsters = this.getEligibleStarterMonsters();

    if (eligibleMonsters.length === 0) {
      console.warn('No eligible starter monsters found in bestiary');
      return;
    }

    // Pick 3 random monsters from eligible list
    const starterChoices = this.getRandomStarters(eligibleMonsters, 3);

    // Show starter selection dialog
    this.showStarterMonsterDialog(starterChoices);
  }

    // Replace the starter monster selection dialog with this improved version
  showStarterSelection(starterMonsters) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'party-overlay';
    overlay.style.opacity = '0';
  
    // Create container
    const container = document.createElement('div');
    container.className = 'party-container';
    container.style.maxWidth = '900px';
    container.style.transform = 'scale(0.95)';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'party-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center;">
        <img src="images/pawns.png" alt="Monster Party" style="width: 24px; height: 24px; margin-right: 8px;">
        <h1 style="margin: 0; font-size: 1.25rem;">Choose Your Starter Monster</h1>
      </div>
    `;

    // Create content
    const content = document.createElement('div');
    content.style.padding = '24px';
    content.style.color = 'white';
    content.innerHTML = `
      <p style="margin-bottom: 24px; text-align: center; font-size: 1.1rem;">
      <p>Welcome to your adventure! Choose one monster to be your starting companion.</p>
      <p style="opacity: 0.8;">Your starter will join your active party and help you recruit more monsters.</p>
       </p>
      <div class="starter-monsters-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 24px;
        justify-content: center;
      "></div>
    `;
  
    // Assemble
    container.appendChild(header);
    container.appendChild(content);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
  
    // Add monsters to grid using createMonsterCard method
    const grid = content.querySelector('.starter-monsters-grid');
    
    starterMonsters.forEach((monster, index) => {
      // Use the existing createMonsterCard method to ensure consistency
      const card = this.createMonsterCard(monster, 'starter', index % 2 !== 0);
      
      // Wrap the card in a container for better selection styling
      const cardContainer = document.createElement('div');
      cardContainer.className = 'starter-card-container';
      cardContainer.style.cssText = `
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
      `;
      
      // Add selection indicator that's initially hidden
      const selectionIndicator = document.createElement('div');
      selectionIndicator.className = 'selection-indicator';
      selectionIndicator.innerHTML = `
        <span class="material-icons" style="font-size: 36px; color: #4ade80;">check_circle</span>
      `;
      selectionIndicator.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.3s ease;
        z-index: 10;
      `;
      
      // Add click handler
      cardContainer.addEventListener('click', () => {
        // Reset all cards
        document.querySelectorAll('.starter-card-container').forEach(c => {
          c.style.transform = '';
          c.style.boxShadow = '';
          c.querySelector('.selection-indicator').style.opacity = '0';
          c.querySelector('.selection-indicator').style.transform = 'scale(0.8)';
        });
        
        // Highlight selected
        cardContainer.style.transform = 'translateY(-8px)';
        cardContainer.style.boxShadow = '0 12px 20px rgba(0, 0, 0, 0.3)';
        selectionIndicator.style.opacity = '1';
        selectionIndicator.style.transform = 'scale(1)';
        
        // Store selection
        this.selectedStarterMonster = monster;
        
        // Enable confirm button
        const confirmBtn = document.querySelector('.confirm-starter-btn');
        if (confirmBtn) {
          confirmBtn.removeAttribute('disabled');
        }
      });
      
      // Add elements to DOM
      cardContainer.appendChild(card);
      cardContainer.appendChild(selectionIndicator);
      grid.appendChild(cardContainer);
    });
  
    // Add confirm button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: center;
      margin-top: 32px;
    `;
    
    const confirmButton = document.createElement('sl-button');
    confirmButton.className = 'confirm-starter-btn';
    confirmButton.setAttribute('variant', 'primary');
    confirmButton.setAttribute('size', 'large');
    confirmButton.setAttribute('disabled', '');
    confirmButton.innerHTML = `
      <span class="material-icons" style="margin-right: 8px;">pets</span>
      Choose This Monster
    `;
    
    confirmButton.addEventListener('click', () => {
      if (this.selectedStarterMonster) {
        this.addMonster(this.selectedStarterMonster);


        // Save party
        this.saveParty();
    this.refreshPartyDialog();
        // Animate out and close
        overlay.style.opacity = '0';
        container.style.transform = 'scale(0.95)';
        setTimeout(() => {
          overlay.remove();
        }, 300);
      }
    });
    
    buttonContainer.appendChild(confirmButton);
    content.appendChild(buttonContainer);
  
    // Animate in
    setTimeout(() => {
      overlay.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }, 10);
  }

  /**
   * Helper UI Methods
   */

  // Show a toast message
  showToast(message, variant = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'party-manager-toast';
    toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${this.getToastColor(variant)};
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => { toast.style.opacity = '1'; }, 10);

    // Hide toast after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.remove(); }, 300);
    }, duration);
  }

  // Get color for toast variant
  getToastColor(variant) {
    switch (variant) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      case 'info':
      default: return '#2196F3';
    }
  }

  /**
   * Saving & Loading
   */

  // Add to saveParty method
saveParty() {
  try {
    const partyData = {
      active: this.party.active,
      reserve: this.party.reserve,
      maxActive: this.party.maxActive,
      maxTotal: this.party.maxTotal,
      inventory: this.inventory // Include inventory
    };

    localStorage.setItem('partyData', JSON.stringify(partyData));
    console.log('Party data saved with inventory');
    
    // Show a quick toast to confirm
    this.showToast('Party saved!', 'success');
    
    return true;
  } catch (error) {
    console.error('Error saving party data:', error);
    this.showToast('Error saving party', 'error');
    return false;
  }
}

// Update loadParty method
loadParty() {
  try {
    const savedData = localStorage.getItem('partyData');
    if (savedData) {
      const partyData = JSON.parse(savedData);

      this.party.active = partyData.active || [];
      this.party.reserve = partyData.reserve || [];
      this.party.maxActive = partyData.maxActive || 4;
      this.party.maxTotal = partyData.maxTotal || 20;
      this.inventory = partyData.inventory || { weapons: [], armor: [] };

      console.log('Party data loaded with inventory:', this.inventory);
      return true;
    }
  } catch (error) {
    console.error('Error loading party data:', error);
  }

  return false;
}

// Test save/load functionality
testSaveLoad() {
  console.log("Testing party save/load functionality");
  
  // Make sure we have some equipment
  this.generateStarterEquipment();
  
  // Save the party
  console.log("Before saving:", {
    active: this.party.active.length,
    reserve: this.party.reserve.length,
    inventory: this.inventory
  });
  
  this.saveParty();
  console.log("Party saved to localStorage");
  
  // Clear some data to test loading
  this.party.active = [];
  this.inventory = { weapons: [], armor: [] };
  console.log("Cleared party data for testing");
  
  // Load the party
  this.loadParty();
  console.log("After loading:", {
    active: this.party.active.length,
    reserve: this.party.reserve.length,
    inventory: this.inventory
  });
  
  // Show a confirmation
  this.showToast("Save/load test complete", "info");
}

  // Add this to PartyManager class
  initializeRelationshipSystem() {
    // Define type relationships (positive values = like, negative = dislike)
    this.typeAffinities = {
      // Positive relationships (natural allies)
      'Beast': {
        'Beast': 1,        // Pack animals bond together
        'Fey': 1,          // Natural connection
        'Humanoid': 2      // Traditional companion relationship
      },
      'Celestial': {
        'Celestial': 3,    // Divine harmony
        'Humanoid': 1,     // Protective relationship
        'Fey': 2,          // Both magical, positive energy
        'Fiend': -3,       // Natural enemies
        'Undead': -2       // Oppose corruption
      },
      'Construct': {
        'Construct': 1,    // Mechanical synergy
        'Humanoid': 1      // Created by humanoids
      },
      'Dragon': {
        'Dragon': -1,      // Often territorial, but respect lineage
        'Humanoid': 0,     // Varies widely
        'Kobold': 3        // Dragon worship
      },
      'Elemental': {
        'Elemental': 2,    // Elemental harmony
        'Fey': 1,          // Natural forces
        'Undead': -1       // Opposed natural states
      },
      'Fey': {
        'Fey': 2,          // Magical kinship
        'Plant': 3,        // Deep nature connection
        'Beast': 1,        // Natural allies
        'Humanoid': 1,     // Curious relationship
        'Fiend': -2        // Chaotic tensions
      },
      'Fiend': {
        'Fiend': 2,        // Evil alliance
        'Undead': 1,       // Dark forces unite
        'Celestial': -3,   // Eternal enemies
        'Fey': -2          // Opposed magical natures
      },
      'Giant': {
        'Giant': 2,        // Tribal bonds
        'Humanoid': -1     // Size disparity and history
      },
      'Humanoid': {
        'Humanoid': 1,     // Social creatures
        'Beast': 2,        // Traditional companions
        'Monstrosity': -1  // Traditional enemies
      },
      'Monstrosity': {
        'Monstrosity': 0,  // Not naturally social
        'Humanoid': -1,    // Traditional prey
        'Beast': -1        // Territorial conflicts
      },
      'Ooze': {
        'Ooze': 0,         // No real connection
        // Most oozes don't form connections
      },
      'Plant': {
        'Plant': 1,        // Root systems connect
        'Fey': 3,          // Strong nature bond
        'Undead': -2,      // Opposed to natural life
        'Fire Elemental': -3 // Obvious reasons!
      },
      'Undead': {
        'Undead': 2,       // United in undeath
        'Fiend': 1,        // Dark alliance
        'Celestial': -2,   // Natural opposition
        'Beast': -2        // Life vs undeath
      },
      'Aberration': {
        // Aberrations are alien and struggle to connect
        'Aberration': 1    // Shared alien nature
      }
    };

    // Special relationships by specific monster rather than type
    this.specificAffinities = {
      'Wolf': {
        'Dire Wolf': 3,    // Pack kinship
        'Winter Wolf': 2   // Wolf-kind
      },
      'Dragon': {
        'Kobold': 2,       // Dragon worship
        'Dragonborn': 1    // Draconic connection
      },
      'Goblin': {
        'Hobgoblin': 2,    // Goblinoid bond
        'Bugbear': 1,      // Goblinoid cousin
        'Wolf': 1          // Traditional mount/pet
      },
      'Zombie': {
        'Skeleton': 1,     // Basic undead bond
        'Ghoul': 1,        // Undead connection
        'Necromancer': 2   // Creator bond
      }
      // Many more could be added
    };

    // Generate relationships for current party
    this.updatePartyRelationships();

    console.log('Relationship system initialized');
  }

  initializeComboSystem() {
    // Define combo abilities between monster types
    this.comboAbilities = {
      'Dragon-Celestial': {
        name: 'Divine Flames',
        description: 'A powerful combination of holy fire that deals extra damage and heals allies',
        type: 'area',
        damage: '3d8+6', // Higher damage than standard abilities
        healing: '2d6',   // Also provides healing to allies
        requiredAffinity: 'High',
        icon: 'local_fire_department',
        color: '#FFD700' // Gold color
      },
      'Fey-Plant': {
        name: 'Nature\'s Blessing',
        description: 'Enhances the party with natural energy, boosting defense and healing',
        type: 'buff',
        healing: '2d8',
        defensiveBonus: 3, // Adds temporary AC to all allies
        duration: 3,      // Lasts 3 rounds
        requiredAffinity: 'High',
        icon: 'eco',
        color: '#4ADE80' // Green color
      },
      'Beast-Humanoid': {
        name: 'Hunter\'s Bond',
        description: 'Perfect coordination between beast and master, granting devastating precision',
        type: 'attack',
        damage: '2d12+6', // Higher single-target damage
        criticalRange: 19, // Crits on 19-20
        requiredAffinity: 'High',
        icon: 'pets',
        color: '#60A5FA' // Blue color
      },
      'Undead-Fiend': {
        name: 'Unholy Pact',
        description: 'A terrifying combination of undeath and demonic energy that drains life',
        type: 'attack',
        damage: '2d10+4',
        lifeSteal: true,  // Heals attacker for 50% of damage
        requiredAffinity: 'High',
        icon: 'blood_count',
        color: '#EC4899' // Pink color
      },
      'Elemental-Elemental': {
        name: 'Elemental Fusion',
        description: 'Combines elemental powers for devastating area effects',
        type: 'area',
        damage: '4d6',
        requiredAffinity: 'High',
        icon: 'storm',
        color: '#F59E0B' // Amber color
      },
      'Construct-Humanoid': {
        name: 'Master\'s Command',
        description: 'Perfect synchronization between creator and creation',
        type: 'buff',
        attackBonus: 4,
        duration: 2,
        requiredAffinity: 'Medium',
        icon: 'precision_manufacturing',
        color: '#6B7280' // Gray color
      },
      'Fiend-Beast': {
        name: 'Corrupted Claws',
        description: 'Infuses a beast with fiendish energy for a devastating attack',
        type: 'attack',
        damage: '3d6+8',
        effectDescription: 'Target suffers ongoing damage',
        requiredAffinity: 'Medium',
        icon: 'front_hand',
        color: '#DC2626' // Red color
      },
      'Dragon-Dragon': {
        name: 'Twin Dragon Breath',
        description: 'Two dragons combine their breath attacks into a devastating blast',
        type: 'area',
        damage: '5d8',
        requiredAffinity: 'Low', // Even dragons with low affinity can do this
        icon: 'flourescent',
        color: '#FF4444' // Bright red
      },
      'Celestial-Humanoid': {
        name: 'Divine Intervention',
        description: 'A celestial bestows divine protection upon its allies',
        type: 'buff',
        healing: '3d6',
        defensiveBonus: 2,
        duration: 3,
        requiredAffinity: 'Medium',
        icon: 'shield',
        color: '#FBBF24' // Yellow color
      },
      'Fey-Humanoid': {
        name: 'Enchanted Strike',
        description: 'Fey magic enhances a humanoid\'s attack with ancient power',
        type: 'attack',
        damage: '2d8+6',
        effectDescription: 'Target is stunned for 1 turn',
        requiredAffinity: 'Medium',
        icon: 'auto_awesome',
        color: '#A78BFA' // Purple color
      }
      // More combinations can be added
    };
    
    console.log("Combo abilities system initialized");
  }

  // Calculate and update relationships between party members
  updatePartyRelationships() {
    // Collection of all monsters
    const allMonsters = [...this.party.active, ...this.party.reserve];

    // Create relationship map to track monsters that like each other
    this.relationshipMap = new Map();

    // Process each monster
    allMonsters.forEach(monster => {
      // Initialize relationship array for this monster
      if (!this.relationshipMap.has(monster.id)) {
        this.relationshipMap.set(monster.id, []);
      }

      // Check relationship with every other monster
      allMonsters.forEach(otherMonster => {
        // Don't compare with self
        if (monster.id === otherMonster.id) return;

        // Calculate affinity
        const affinityScore = this.calculateAffinity(monster, otherMonster);

        // If positive affinity, add to relationships
        if (affinityScore > 0) {
          this.relationshipMap.get(monster.id).push({
            monsterId: otherMonster.id,
            level: this.getAffinityLevel(affinityScore),
            score: affinityScore,
            benefit: this.getAffinityBenefit(affinityScore)
          });
        }
      });
    });

    console.log('Party relationships updated', this.relationshipMap);
  }

  // Calculate affinity between two monsters
  calculateAffinity(monster1, monster2) {
    let affinity = 0;

    // Check type affinities
    const type1 = monster1.type || monster1.data?.basic?.type;
    const type2 = monster2.type || monster2.data?.basic?.type;

    // Check for type affinity in both directions
    if (this.typeAffinities[type1] && this.typeAffinities[type1][type2] !== undefined) {
      affinity += this.typeAffinities[type1][type2];
    }

    if (this.typeAffinities[type2] && this.typeAffinities[type2][type1] !== undefined) {
      affinity += this.typeAffinities[type2][type1];
    }

    // Check specific monster affinities
    const name1 = monster1.name;
    const name2 = monster2.name;

    if (this.specificAffinities[name1] && this.specificAffinities[name1][name2] !== undefined) {
      affinity += this.specificAffinities[name1][name2];
    }

    if (this.specificAffinities[name2] && this.specificAffinities[name2][name1] !== undefined) {
      affinity += this.specificAffinities[name2][name1];
    }

    // Adjust for time spent together in party (bonus to relationship)
    // For now, this is a placeholder. You could implement a system to track
    // how long monsters have been in the party together.

    // Take average to normalize
    affinity = affinity / 2;

    return affinity;
  }

  // Convert numerical affinity to descriptive level
  getAffinityLevel(score) {
    if (score >= 3) return 'High';
    if (score >= 1) return 'Medium';
    if (score > 0) return 'Low';
    if (score === 0) return 'Neutral';
    if (score > -1) return 'Slight Dislike';
    if (score > -3) return 'Moderate Dislike';
    return 'Strong Dislike';
  }

  // Determine combat benefit based on affinity score
  getAffinityBenefit(score) {
    if (score >= 3) return '+9 to combat rolls';
    if (score >= 2) return '+7 to combat rolls';
    if (score >= 1) return '+5 to combat rolls';
    if (score > 0) return '+3 to combat rolls';
    if (score === 0) return 'None';
    if (score > -1) return '-3 to combat rolls';
    if (score > -3) return '-5 to combat rolls';
    return '-7 to combat rolls';
  }

  // Get combat modifier between two monsters
  getCombatModifier(monster1Id, monster2Id) {
    // Look for direct relationship
    const relationships = this.relationshipMap.get(monster1Id) || [];
    const relationship = relationships.find(r => r.monsterId === monster2Id);

    if (relationship) {
      // Determine numerical bonus
      const score = relationship.score;
      if (score >= 3) return 9;
      if (score >= 2) return 7;
      if (score >= 1) return 5;
      if (score > 0) return 3;
      if (score === 0) return 0;
      if (score > -1) return -3;
      if (score > -3) return -5;
      return -7;
    }

    return 0; // No relationship
  }

  // Get all monsters that like a specific monster
  getMonstersWithAffinity(monsterId) {
    return this.relationshipMap.get(monsterId) || [];
  }

  renderPartyAffinityVisualization(detailsPanel) {
  // Only show visualization if we have at least 2 active monsters
  if (!this.party.active || this.party.active.length < 2) {
    console.log("Not enough active monsters for affinity visualization");
    return false;
  }

  console.log(`Creating affinity visualization for ${this.party.active.length} active monsters`);

  // Create container for the affinity visualization
  const affinityContainer = document.createElement('div');
  affinityContainer.className = 'affinity-visualization';
  affinityContainer.style.cssText = `
    padding: 24px 16px;
    margin-top: 24px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  `;

  // Add heading
  const heading = document.createElement('h3');
  heading.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 1.2rem;
    text-align: center;
    color: white;
  `;
  heading.innerHTML = `Party Affinity Network`;
  affinityContainer.appendChild(heading);

  // Add explanation text
  const explanation = document.createElement('p');
  explanation.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 0.9rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.8);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  `;
  explanation.innerHTML = `Monsters with matching types form affinities that provide combat bonuses. Stronger affinities provide greater bonuses when monsters fight together.`;
  affinityContainer.appendChild(explanation);

  // Calculate total party affinity bonus
  let totalPartyBonus = 0;
  let affinityPairs = [];

  // Find all affinity relationships between active monsters
  for (let i = 0; i < this.party.active.length; i++) {
    const monster1 = this.party.active[i];
    
    for (let j = i + 1; j < this.party.active.length; j++) {
      const monster2 = this.party.active[j];
      
      const bonus = this.getCombatModifier(monster1.id, monster2.id);
      if (bonus !== 0) {
        totalPartyBonus += bonus;
        
        // Get affinity level
        const relationships = this.relationshipMap.get(monster1.id) || [];
        const relationship = relationships.find(r => r.monsterId === monster2.id);
        const affinityLevel = relationship ? relationship.level : 'None';
        
        affinityPairs.push({
          monster1,
          monster2,
          bonus,
          affinityLevel
        });
      }
    }
  }

  console.log(`Found ${affinityPairs.length} affinity pairs with total bonus: ${totalPartyBonus}`);

  // Create affinity network visualization
  const networkContainer = document.createElement('div');
  networkContainer.style.cssText = `
    position: relative;
    height: 280px;
    margin-bottom: 24px;
    width: 100%;
  `;

  // Function to get a color based on affinity level
  const getAffinityColor = (level) => {
    switch(level) {
      case 'High': return '#4ade80'; // Green
      case 'Medium': return '#60a5fa'; // Blue
      case 'Low': return '#a78bfa'; // Purple
      default: return '#d1d5db'; // Gray
    }
  };

  // Add networkContainer to DOM early so we can get its dimensions
  affinityContainer.appendChild(networkContainer);
  
  // Create SVG for connection lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  `;
  networkContainer.appendChild(svg);

  // Add this to detailsPanel first so we can get proper sizing
  detailsPanel.appendChild(affinityContainer);

  // Now use requestAnimationFrame to ensure DOM is updated before calculating positions
  requestAnimationFrame(() => {
    const activeMonsters = this.party.active;
    
    // Now we can safely get the container width
    const containerWidth = networkContainer.offsetWidth || 500; // Fallback to 500 if still 0
    console.log(`Network container width: ${containerWidth}px`);
    
    // Position active monsters in a circle with fixed values if needed
    const radius = Math.min(120, containerWidth / 3);
    const centerX = containerWidth / 2;
    const centerY = 140;
    
    console.log(`Positioning monsters in circle: radius=${radius}, centerX=${centerX}, centerY=${centerY}`);
    
    // Create monster cards
    activeMonsters.forEach((monster, index) => {
      const angle = (index / activeMonsters.length) * Math.PI * 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      console.log(`Monster ${index}: angle=${angle.toFixed(2)}, x=${x.toFixed(0)}, y=${y.toFixed(0)}`);

      // Create card container with relative position for the absolute positioned card inside
      const cardContainer = document.createElement('div');
      cardContainer.className = 'network-monster-container';
      cardContainer.style.cssText = `
        position: absolute;
        left: ${x - 50}px;
        top: ${y - 50}px;
        width: 100px;
        height: 100px;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 5;
      `;

      // Calculate tilt angle based on position
      const tiltAngle = (Math.sin(angle) * 10);

      // Create monster card
      const miniCard = document.createElement('div');
      miniCard.className = 'network-monster-card';
      miniCard.setAttribute('data-monster-id', monster.id);
      miniCard.style.cssText = `
        width: 80px;
        height: 80px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        transform: rotate(${tiltAngle}deg);
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
      `;

      // Add monster icon/avatar
      const avatarBgColor = this.getMonsterTypeColor(monster.type);
      const tokenSource = monster.token?.data || (typeof monster.token === 'string' ? monster.token : null);

      const avatar = document.createElement('div');
      avatar.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: ${avatarBgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 6px;
        border: 2px solid ${avatarBgColor};
        color: white;
        font-weight: bold;
      `;

      if (tokenSource) {
        avatar.innerHTML = `<img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      } else {
        avatar.textContent = monster.name.charAt(0);
      }

      // Add monster name
      const name = document.createElement('div');
      name.style.cssText = `
        font-size: 0.7rem;
        font-weight: bold;
        text-align: center;
        color: #333;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      name.textContent = monster.name;

      // Add monster type badge
      const typeBadge = document.createElement('div');
      typeBadge.style.cssText = `
        font-size: 0.6rem;
        padding: 1px 6px;
        background-color: ${avatarBgColor};
        color: white;
        border-radius: 20px;
        position: absolute;
        bottom: 4px;
      `;
      typeBadge.textContent = monster.type;

      // Hover effect
      miniCard.addEventListener('mouseenter', () => {
        miniCard.style.transform = `rotate(${tiltAngle}deg) scale(1.1)`;
        miniCard.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
      });

      miniCard.addEventListener('mouseleave', () => {
        miniCard.style.transform = `rotate(${tiltAngle}deg)`;
        miniCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      });

      // Click handler to show monster details
      miniCard.addEventListener('click', () => {
        // Find the monster card in the side panel and click it
        const monsterCard = document.querySelector(`.monster-card[data-monster-id="${monster.id}"]`);
        if (monsterCard) {
          monsterCard.click();
        }
      });

      // Assemble card
      miniCard.appendChild(avatar);
      miniCard.appendChild(name);
      miniCard.appendChild(typeBadge);
      cardContainer.appendChild(miniCard);
      networkContainer.appendChild(cardContainer);

      // Store position for drawing connection lines
      monster.networkPosition = { x, y };
    });

    // Now draw connection lines
    affinityPairs.forEach(pair => {
      if (!pair.monster1.networkPosition || !pair.monster2.networkPosition) return;

      const x1 = pair.monster1.networkPosition.x;
      const y1 = pair.monster1.networkPosition.y;
      const x2 = pair.monster2.networkPosition.x;
      const y2 = pair.monster2.networkPosition.y;

      // Draw connection line
      const lineColor = getAffinityColor(pair.affinityLevel);
      const lineWidth = pair.bonus > 5 ? 3 : (pair.bonus > 3 ? 2 : 1);
      
      // Calculate midpoint for the bonus badge
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      
      // Draw the line with gradient
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      const gradientId = `affinity-gradient-${pair.monster1.id}-${pair.monster2.id}`;
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '100%');
      
      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', lineColor);
      stop1.setAttribute('stop-opacity', '0.4');
      
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '50%');
      stop2.setAttribute('stop-color', lineColor);
      stop2.setAttribute('stop-opacity', '1');
      
      const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop3.setAttribute('offset', '100%');
      stop3.setAttribute('stop-color', lineColor);
      stop3.setAttribute('stop-opacity', '0.4');
      
      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      gradient.appendChild(stop3);
      
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.appendChild(gradient);
      svg.appendChild(defs);
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', `url(#${gradientId})`);
      line.setAttribute('stroke-width', lineWidth);
      line.setAttribute('stroke-dasharray', '4 2');
      
      svg.appendChild(line);
      
      // Add affinity bonus badge
      const bonusBadge = document.createElement('div');
      bonusBadge.className = 'affinity-bonus-badge';
      bonusBadge.style.cssText = `
        position: absolute;
        left: ${midX - 15}px;
        top: ${midY - 10}px;
        background: ${lineColor};
        color: white;
        border-radius: 20px;
        padding: 2px 6px;
        font-size: 0.65rem;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 2px;
      `;
      bonusBadge.innerHTML = `
        <span class="material-icons" style="font-size: 10px;">add</span>${pair.bonus}
      `;
      
      networkContainer.appendChild(bonusBadge);
    });
  });

  // Add total party bonus summary
  const partyBonusContainer = document.createElement('div');
  partyBonusContainer.className = 'party-bonus-summary';
  partyBonusContainer.style.cssText = `
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
  `;

  const bonusIcon = document.createElement('div');
  bonusIcon.style.cssText = `
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ade80, #60a5fa);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
  `;
  bonusIcon.innerHTML = `<span class="material-icons" style="font-size: 24px; color: white;">group</span>`;

  const bonusText = document.createElement('div');
  bonusText.style.cssText = `
    flex: 1;
  `;
  bonusText.innerHTML = `
    <div style="font-weight: bold; color: white;">Total Party Bonus</div>
    <div style="color: rgba(255, 255, 255, 0.8); font-size: 0.9rem;">
      Your party has a <strong style="color: ${totalPartyBonus > 0 ? '#4ade80' : '#f87171'};">+${totalPartyBonus}</strong> combat bonus from monster affinities
    </div>
  `;

  partyBonusContainer.appendChild(bonusIcon);
  partyBonusContainer.appendChild(bonusText);
  affinityContainer.appendChild(partyBonusContainer);
  
  return true;
}


getNormalizedType(typeString) {
  if (!typeString) return '';
  
  // Common size prefixes to remove
  const sizePrefixes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  
  // Convert to lowercase for consistent comparison
  const lowercaseType = typeString.toLowerCase();
  
  // Check if type starts with any size prefix
  for (const prefix of sizePrefixes) {
    if (lowercaseType.startsWith(prefix + ' ')) {
      // Return everything after the prefix + space, with first letter capitalized
      const baseType = typeString.substring(prefix.length + 1);
      return baseType.charAt(0).toUpperCase() + baseType.slice(1);
    }
  }
  
  // If no prefix found, return the original with first letter capitalized
  return typeString.charAt(0).toUpperCase() + typeString.slice(1);
}

getAvailableComboAbilities() {
  // Make sure the combo system is initialized
  if (!this.comboAbilities) {
    this.initializeComboSystem();
  }
  
  const activeMonsters = this.party.active;
  const availableCombos = [];
  
  // Check each pair of monsters
  for (let i = 0; i < activeMonsters.length; i++) {
    for (let j = i + 1; j < activeMonsters.length; j++) {
      const monster1 = activeMonsters[i];
      const monster2 = activeMonsters[j];

      // Get monster types
      const type1 = this.getNormalizedType(monster1.type || monster1.basic?.type || '');
      const type2 = this.getNormalizedType(monster2.type || monster2.basic?.type || '');
      if (!type1 || !type2) continue;
      
      // Create both possible type combinations to check
      const typePair1 = `${type1}-${type2}`;
      const typePair2 = `${type2}-${type1}`;
      
      // Check if there's a combo defined for these types
      let combo = this.comboAbilities[typePair1] || this.comboAbilities[typePair2];
      
      if (combo) {
        // Create a copy of the combo with the specific monsters
        const availableCombo = {
          ...combo,
          monsters: [monster1, monster2],
          id: `combo_${monster1.id}_${monster2.id}`
        };
        
        availableCombos.push(availableCombo);
        // console.log(`Found available combo: ${combo.name} between ${monster1.name} and ${monster2.name}`);
      }
    }
  }
  
  return availableCombos;
}

// Add this to the createGiftDrawer method
createGiftDrawer() {
  const giftDrawer = document.createElement('sl-drawer');
  giftDrawer.label = "Choose a Gift";
  giftDrawer.placement = "end"; 
  giftDrawer.setAttribute('contained', ''); 
  giftDrawer.style.setProperty('--size', '50%');
  
  giftDrawer.innerHTML = `
    <div class="gift-drawer-content">
      <!-- Content will be populated when opened -->
    </div>
    <div slot="footer">
      <sl-button variant="neutral" class="close-drawer-btn">Cancel</sl-button>
    </div>
  `;
  
  // Add close button handler
  giftDrawer.querySelector('.close-drawer-btn').addEventListener('click', () => {
    console.log("Close drawer button clicked");
    giftDrawer.hide();
  });
  
  // Add cleanup event
  giftDrawer.addEventListener('sl-after-hide', () => {
    console.log("Drawer closed event - performing cleanup");
    
    // Clear content to prevent memory issues
    const content = giftDrawer.querySelector('.gift-drawer-content');
    if (content) {
      // Remove all event listeners by replacing the element
      const newContent = document.createElement('div');
      newContent.className = 'gift-drawer-content';
      content.parentNode.replaceChild(newContent, content);
    }
  });
  
  return giftDrawer;
}

showGiftSelection(monster, recruitmentOverlay) {
  console.log("Opening gift selection for", monster.name || monster.basic?.name || "monster");
  
  // Make sure dialogContainer is properly set
  if (!this.dialogContainer) {
    console.error("Dialog container not found!");
    return;
  }
  
  // Create the drawer if it doesn't exist yet
  if (!this.giftDrawer) {
    console.log("Creating new gift drawer");
    this.giftDrawer = this.createGiftDrawer();
    this.dialogContainer.appendChild(this.giftDrawer);
  }
  
  // Get items directly from Scene3D inventory
  let availableItems = [];
  
  // Add items from own inventory first
  if (this.inventory) {
    if (this.inventory.weapons) {
      availableItems = [...availableItems, ...this.inventory.weapons.map(item => ({
        ...item,
        type: 'weapon',
        source: 'local-inventory'
      }))];
    }
    
    if (this.inventory.armor) {
      availableItems = [...availableItems, ...this.inventory.armor.map(item => ({
        ...item,
        type: 'armor',
        source: 'local-inventory'
      }))];
    }
    
    if (this.inventory.misc) {
      availableItems = [...availableItems, ...this.inventory.misc.map(item => ({
        ...item,
        type: 'misc',
        source: 'local-inventory'
      }))];
    }
  }
  
  // Get Scene3D inventory items - directly access props if possible
  if (this.scene3D) {
    try {
      console.log("Checking Scene3D inventory for props");
      
      // Check if we can access the inventory directly
      if (this.scene3D.inventory && this.scene3D.inventory.size > 0) {
        console.log(`Found ${this.scene3D.inventory.size} items in direct inventory access`);
        
        // Convert Map to array if needed
        let sceneItems = [];
        if (this.scene3D.inventory instanceof Map) {
          // Convert Map entries to array of props
          this.scene3D.inventory.forEach((value, key) => {
            if (value && value.prop) {
              sceneItems.push({
                id: key,
                name: value.prop.name || "Unknown Item",
                type: this.determineItemType(value.prop),
                description: value.prop.description || "",
                source: '3d-inventory'
              });
            }
          });
        }
        
        if (sceneItems.length > 0) {
          console.log(`Processed ${sceneItems.length} items from inventory Map`);
          availableItems = [...availableItems, ...sceneItems];
        }
      }
      
      // If we couldn't get items from direct access, try getInventoryItems
      if (typeof this.scene3D.getInventoryItems === 'function') {
        console.log("Getting items from Scene3D.getInventoryItems()");
        const inventoryItems = this.scene3D.getInventoryItems();
        
        if (inventoryItems && inventoryItems.length > 0) {
          console.log(`Found ${inventoryItems.length} items from getInventoryItems`);
          
          // Process each item to ensure it has required properties
          const processedItems = inventoryItems.map(item => ({
            id: item.id || `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: item.name || item.prop?.name || "Unknown Item",
            type: item.type || this.determineItemType(item),
            image: item.image || item.prop?.image || null,
            description: item.description || item.prop?.description || "",
            source: '3d-inventory'
          }));
          
          availableItems = [...availableItems, ...processedItems];
        }
      }
    } catch (error) {
      console.error('Error accessing Scene3D inventory:', error);
    }
  }
  
  console.log(`Found ${availableItems.length} items for gifts`);
  
  // If no items found, use placeholder equipment as fallback
  if (availableItems.length === 0) {
    console.log("No items found, falling back to placeholder equipment");
    const weapons = this.getPlaceholderEquipment('weapon');
    const armor = this.getPlaceholderEquipment('armor');
    
    availableItems = [
      ...weapons.map(item => ({...item, type: 'weapon'})),
      ...armor.map(item => ({...item, type: 'armor'}))
    ];
  }
  
  console.log(`Found ${availableItems.length} total items to offer as gifts`);
  
  // Populate gift drawer
  const content = this.giftDrawer.querySelector('.gift-drawer-content');
  const monsterType = monster.basic?.type || monster.type || 'Unknown';
  
  if (availableItems.length === 0) {
    // No items case
    content.innerHTML = `
      <div style="padding: 32px; text-align: center;">
        <span class="material-icons" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;">inventory_2</span>
        <h3 style="margin: 0 0 8px 0; color: #374151;">No Items Available</h3>
        <p style="color: #6b7280; margin: 0;">You don't have any items in your inventory to offer as gifts.</p>
      </div>
    `;
  } else {
    // Has items case - show gift selection UI
    content.innerHTML = `
    <div style="padding: 16px;">
      <h2 style="margin-top: 0; color: #111827;">Choose a Gift for ${this.getMonsterName(monster)}</h2>
      <p style="color: #4b5563;">The right gift can greatly increase your chances of recruiting this ${monsterType.toLowerCase()}.</p>
    
        <div class="gift-items-grid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
          margin-top: 16px;
        ">
          <!-- Gift items will be inserted here -->
        </div>
      </div>
    `;
  
  const itemsGrid = content.querySelector('.gift-items-grid');
  
  // Add each item to grid
  availableItems.forEach(item => {
    // Determine gift type for preference logic
    let giftType = 'misc';
    
    if (item.type === 'weapon') {
      giftType = 'weapon';
    } else if (item.type === 'armor') {
      giftType = 'armor';
    } else if (item.name.toLowerCase().includes('potion')) {
      giftType = 'potion';
    } else if (item.name.toLowerCase().includes('food') || 
              item.name.toLowerCase().includes('fruit') || 
              item.name.toLowerCase().includes('meat')) {
      giftType = 'food';
    } else if (item.name.toLowerCase().includes('gem') || 
              item.name.toLowerCase().includes('gold') || 
              item.name.toLowerCase().includes('jewelry')) {
      giftType = 'treasure';
    } else if (item.name.toLowerCase().includes('chest') || 
              item.name.toLowerCase().includes('box')) {
      giftType = 'chest';
    }
    
    // Get effectiveness for this gift type and monster type
    const effectiveness = this.getGiftEffectiveness(giftType, monsterType);
    
    // Determine color based on effectiveness
    let effectColor = '#6B7280'; // Default gray
    switch (effectiveness.effectiveness) {
      case 'Perfect': effectColor = '#10B981'; break; // Green
      case 'Good': effectColor = '#3B82F6'; break; // Blue
      case 'Neutral': effectColor = '#6B7280'; break; // Gray
      case 'Poor': effectColor = '#F59E0B'; break; // Amber
      case 'Insulting': effectColor = '#EF4444'; break; // Red
    }
    
    // Create item card
    const itemCard = document.createElement('div');
    itemCard.className = 'gift-item';
    itemCard.dataset.itemId = item.id;
    itemCard.dataset.giftType = giftType;
    itemCard.dataset.modifier = effectiveness.modifier;
    itemCard.dataset.reaction = effectiveness.reaction;
    
    itemCard.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.2s ease;
      cursor: pointer;
    `;
    
    // Get appropriate icon
    let icon = 'inventory_2'; // Default
    switch (giftType) {
      case 'weapon': icon = 'swords'; break;
      case 'armor': icon = 'shield'; break;
      case 'potion': icon = 'science'; break;
      case 'food': icon = 'restaurant'; break;
      case 'treasure': icon = 'diamond'; break;
      case 'chest': icon = 'inventory_2'; break;
    }
    
    // If the icon system doesn't have the specific icon, fallback to material icons
    if (icon === 'swords') icon = 'hardware'; // Fallback for swords
    if (icon === 'diamond') icon = 'diamond'; // Fallback for diamond
    
    itemCard.innerHTML = `
      <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; position: relative;">
        <div style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: ${effectColor}20;
          color: ${effectColor};
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 500;
        ">${effectiveness.effectiveness}</div>
        
        <div style="margin-top: 6px; display: flex; gap: 12px; align-items: center;">
          <div style="
            width: 40px;
            height: 40px;
            background: ${effectColor}10;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span class="material-icons" style="color: ${effectColor};">${icon}</span>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: #111; margin-bottom: 2px;">${item.name}</div>
            <div style="font-size: 0.8rem; color: #666;">${giftType.charAt(0).toUpperCase() + giftType.slice(1)}</div>
          </div>
        </div>
      </div>
      
      <div style="padding: 12px; background: #f9fafb; font-size: 0.85rem; color: #374151;">
        <div style="margin-bottom: 4px; font-style: italic; color: #4B5563;">"${effectiveness.reaction}"</div>
        <div style="margin-top: 8px; font-size: 0.75rem; color: #6B7280;">
          ${effectiveness.modifier > 0 ? 
            `<span style="color: ${effectColor};">+${Math.round(effectiveness.modifier * 100)}% recruitment chance</span>` : 
            effectiveness.modifier < 0 ? 
            `<span style="color: ${effectColor};">${Math.round(effectiveness.modifier * 100)}% recruitment chance</span>` :
            `No effect on recruitment chance`
          }
        </div>
      </div>
    `;
    
    // Add hover effect
    itemCard.addEventListener('mouseenter', () => {
      itemCard.style.transform = 'translateY(-2px)';
      itemCard.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    });
    
    itemCard.addEventListener('mouseleave', () => {
      itemCard.style.transform = '';
      itemCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    });
    
    // Add click handler
    itemCard.addEventListener('click', () => {
      // Process gift selection
      this.selectGift(item, giftType, effectiveness, monster, recruitmentOverlay);
    });
    
    itemsGrid.appendChild(itemCard);
  });
}
  
  // Show the drawer
  console.log("About to show the gift drawer");
  setTimeout(() => {
    if (this.giftDrawer && typeof this.giftDrawer.show === 'function') {
      this.giftDrawer.show();
      console.log("Gift drawer show() called");
    } else {
      console.error("Gift drawer or show() method not available");
    }
  }, 50);
}

determineItemType(item) {
  const name = (item.name || item.prop?.name || '').toLowerCase();
  
  if (name.includes('sword') || name.includes('axe') || name.includes('dagger') || 
      name.includes('mace') || name.includes('staff') || name.includes('bow') ||
      name.includes('weapon')) {
    return 'weapon';
  }
  
  if (name.includes('armor') || name.includes('shield') || name.includes('helmet') || 
      name.includes('gloves') || name.includes('boots') || name.includes('cloak')) {
    return 'armor'; 
  }
  
  if (name.includes('potion') || name.includes('elixir') || name.includes('vial')) {
    return 'potion';
  }
  
  if (name.includes('food') || name.includes('fruit') || name.includes('meat') || 
      name.includes('bread') || name.includes('fish')) {
    return 'food';
  }
  
  return 'misc';
}

getGiftEffectiveness(giftType, monsterType) {
  // Gift preferences by monster type
  const preferences = {
    'Beast': {
      'food': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The beast excitedly devours the food offering!" },
      'potion': { effectiveness: 'Good', modifier: 0.1, reaction: "The beast sniffs the potion curiously." },
      'weapon': { effectiveness: 'Poor', modifier: -0.15, reaction: "The beast growls at the weapon, unsure of its purpose." },
      'armor': { effectiveness: 'Poor', modifier: -0.15, reaction: "The beast has no use for armor and seems confused." },
      'treasure': { effectiveness: 'Neutral', modifier: 0, reaction: "The beast shows little interest in the shiny object." },
      'chest': { effectiveness: 'Good', modifier: 0.1, reaction: "The beast is curious about what's inside." }
    },
    'Dragon': {
      'food': { effectiveness: 'Good', modifier: 0.1, reaction: "The dragon appreciates the snack, though it's hardly a feast." },
      'potion': { effectiveness: 'Neutral', modifier: 0, reaction: "The dragon examines the potion with mild interest." },
      'weapon': { effectiveness: 'Poor', modifier: -0.15, reaction: "The dragon scoffs at your puny weapon." },
      'armor': { effectiveness: 'Poor', modifier: -0.15, reaction: "The dragon has no need for armor with its scales." },
      'treasure': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The dragon's eyes gleam at the sight of treasure!" },
      'chest': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The dragon eagerly eyes what appears to be a new addition to its hoard." }
    },
    'Humanoid': {
      'food': { effectiveness: 'Good', modifier: 0.1, reaction: "The humanoid gratefully accepts the food." },
      'potion': { effectiveness: 'Good', modifier: 0.1, reaction: "The humanoid recognizes the potion's value." },
      'weapon': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The humanoid examines the weapon with great interest!" },
      'armor': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The humanoid tries on the armor, impressed by its quality!" },
      'treasure': { effectiveness: 'Good', modifier: 0.1, reaction: "The humanoid's eyes light up at the valuable gift." },
      'chest': { effectiveness: 'Good', modifier: 0.1, reaction: "The humanoid is intrigued by the mysterious chest." }
    },
    'Undead': {
      'food': { effectiveness: 'Insulting', modifier: -0.3, reaction: "The undead has no need for food and is offended by the offering." },
      'potion': { effectiveness: 'Poor', modifier: -0.15, reaction: "The potion has little effect on the undead's condition." },
      'weapon': { effectiveness: 'Good', modifier: 0.1, reaction: "The undead appreciates the weapon's destructive potential." },
      'armor': { effectiveness: 'Neutral', modifier: 0, reaction: "The undead shows little interest in protection." },
      'treasure': { effectiveness: 'Good', modifier: 0.1, reaction: "The undead is drawn to the former possessions of the living." },
      'chest': { effectiveness: 'Good', modifier: 0.1, reaction: "The undead is curious about what souls might be trapped inside." }
    },
    'Fey': {
      'food': { effectiveness: 'Good', modifier: 0.1, reaction: "The fey creature nibbles delicately at the offering." },
      'potion': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The fey is delighted by the magical concoction!" },
      'weapon': { effectiveness: 'Poor', modifier: -0.15, reaction: "The fey creature recoils from the crude implement of war." },
      'armor': { effectiveness: 'Poor', modifier: -0.15, reaction: "The fey has no interest in heavy, restrictive armor." },
      'treasure': { effectiveness: 'Good', modifier: 0.1, reaction: "The fey is attracted to the shiny bauble." },
      'chest': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The fey is excited by the mystery and potential mischief!" }
    },
    'Fiend': {
      'food': { effectiveness: 'Poor', modifier: -0.15, reaction: "The fiend scorns your mundane offering." },
      'potion': { effectiveness: 'Good', modifier: 0.1, reaction: "The fiend is intrigued by the potion's properties." },
      'weapon': { effectiveness: 'Good', modifier: 0.1, reaction: "The fiend appreciates instruments of violence." },
      'armor': { effectiveness: 'Neutral', modifier: 0, reaction: "The fiend has little need for physical protection." },
      'treasure': { effectiveness: 'Perfect', modifier: 0.25, reaction: "The fiend covets the valuable treasure!" },
      'chest': { effectiveness: 'Good', modifier: 0.1, reaction: "The fiend wonders what secrets might be contained within." }
    },
    'Elemental': {
      'food': { effectiveness: 'Insulting', modifier: -0.3, reaction: "The elemental has no physical form to consume food." },
      'potion': { effectiveness: 'Good', modifier: 0.1, reaction: "The elemental is drawn to the elemental essence within the potion." },
      'weapon': { effectiveness: 'Poor', modifier: -0.15, reaction: "The elemental has no need for physical weapons." },
      'armor': { effectiveness: 'Poor', modifier: -0.15, reaction: "The elemental's form cannot wear armor." },
      'treasure': { effectiveness: 'Neutral', modifier: 0, reaction: "The elemental shows no interest in material wealth." },
      'chest': { effectiveness: 'Neutral', modifier: 0, reaction: "The elemental regards the chest with indifference." }
    },
    'Celestial': {
      'food': { effectiveness: 'Neutral', modifier: 0, reaction: "The celestial acknowledges your humble offering." },
      'potion': { effectiveness: 'Good', modifier: 0.1, reaction: "The celestial recognizes the healing properties." },
      'weapon': { effectiveness: 'Poor', modifier: -0.15, reaction: "The celestial looks upon the weapon with disapproval." },
      'armor': { effectiveness: 'Good', modifier: 0.1, reaction: "The celestial appreciates the protection it offers." },
      'treasure': { effectiveness: 'Poor', modifier: -0.15, reaction: "The celestial has no interest in material wealth." },
      'chest': { effectiveness: 'Good', modifier: 0.1, reaction: "The celestial is curious about your mysterious gift." }
    }
  };
  
  // Default values if monster type or gift type not found
  const defaultResponse = { effectiveness: 'Neutral', modifier: 0, reaction: "The creature seems indifferent to your offering." };
  
  // Check if we have preferences for this monster type
  const monsterPreferences = preferences[monsterType] || {};
  
  // Return preference for this gift type, or default if not found
  return monsterPreferences[giftType] || defaultResponse;
}

// 3. Method to populate the gift drawer with items from inventory
populateGiftDrawer(drawer, monster) {
  const content = drawer.querySelector('.gift-drawer-content');
  const monsterType = monster.basic?.type || monster.type || 'Unknown';
  
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h2 style="margin-top: 0;">Choose a Gift for ${monster.basic?.name || monster.name}</h2>
      <p>The right gift can greatly increase your chances of recruiting this ${monsterType.toLowerCase()}.</p>
    </div>
    
    <div class="gift-items-grid" style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    ">
      <!-- Items will be inserted here -->
    </div>
  `;
  
  const itemsGrid = content.querySelector('.gift-items-grid');
  
  // Get available items - combine weapons, armor and misc items
  const availableItems = [
    ...(this.inventory.weapons || []).map(item => ({ ...item, type: 'weapon' })),
    ...(this.inventory.armor || []).map(item => ({ ...item, type: 'armor' })),
    ...(this.inventory.misc || []).map(item => ({ ...item }))
  ];
  
  // Add items from Scene3D inventory if available
  if (this.scene3D && typeof this.scene3D.getInventoryItems === 'function') {
    try {
      const sceneItems = this.scene3D.getInventoryItems();
      if (sceneItems && sceneItems.length) {
        availableItems.push(...sceneItems);
      }
    } catch (error) {
      console.error('Error getting inventory items from Scene3D:', error);
    }
  }
  
  // If no items available
  if (availableItems.length === 0) {
    itemsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 32px; color: #666;">
        <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">inventory_2</span>
        <p>You don't have any items to offer as gifts.</p>
      </div>
    `;
    return;
  }
  
  // Categorize items for gift preferences
  availableItems.forEach(item => {
    // Determine gift type for preference calculation
    let giftType = 'misc';
    
    if (item.type === 'weapon') {
      giftType = 'weapon';
    } else if (item.type === 'armor') {
      giftType = 'armor';
    } else if (item.name.toLowerCase().includes('potion')) {
      giftType = 'potion';
    } else if (item.name.toLowerCase().includes('food') || 
               item.name.toLowerCase().includes('fruit') || 
               item.name.toLowerCase().includes('meat')) {
      giftType = 'food';
    } else if (item.name.toLowerCase().includes('gem') || 
               item.name.toLowerCase().includes('gold') || 
               item.name.toLowerCase().includes('jewelry')) {
      giftType = 'treasure';
    } else if (item.name.toLowerCase().includes('chest') || 
               item.name.toLowerCase().includes('box')) {
      giftType = 'chest';
    }
    
    // Get effectiveness of this gift for this monster type
    const effectiveness = this.getGiftEffectiveness(giftType, monsterType);
    
    // Determine color based on effectiveness
    let effectColor = '#6B7280'; // Default gray
    switch (effectiveness.effectiveness) {
      case 'Perfect': effectColor = '#10B981'; break; // Green
      case 'Good': effectColor = '#3B82F6'; break; // Blue
      case 'Neutral': effectColor = '#6B7280'; break; // Gray
      case 'Poor': effectColor = '#F59E0B'; break; // Amber
      case 'Insulting': effectColor = '#EF4444'; break; // Red
    }
    
    // Icon based on item type
    let icon = 'inventory_2'; // Default
    switch (giftType) {
      case 'weapon': icon = 'swords'; break;
      case 'armor': icon = 'shield'; break;
      case 'potion': icon = 'science'; break;
      case 'food': icon = 'restaurant'; break;
      case 'treasure': icon = 'diamond'; break;
      case 'chest': icon = 'inventory_2'; break;
    }
    
    // Create item card
    const itemCard = document.createElement('div');
    itemCard.className = 'gift-item';
    itemCard.dataset.itemId = item.id;
    itemCard.dataset.giftType = giftType;
    itemCard.dataset.modifier = effectiveness.modifier;
    itemCard.dataset.reaction = effectiveness.reaction;
    
    itemCard.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.2s ease;
      cursor: pointer;
    `;
    
    itemCard.innerHTML = `
      <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; position: relative;">
        <div style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: ${effectColor}20;
          color: ${effectColor};
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 500;
        ">${effectiveness.effectiveness}</div>
        
        <div style="margin-top: 6px; display: flex; gap: 12px; align-items: center;">
          <div style="
            width: 40px;
            height: 40px;
            background: ${effectColor}10;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span class="material-icons" style="color: ${effectColor};">${icon}</span>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: #111; margin-bottom: 2px;">${item.name}</div>
            <div style="font-size: 0.8rem; color: #666;">${giftType.charAt(0).toUpperCase() + giftType.slice(1)}</div>
          </div>
        </div>
      </div>
      
      <div style="padding: 12px; background: #f9fafb; font-size: 0.85rem; color: #374151;">
        <div style="margin-bottom: 4px; font-style: italic; color: #4B5563;">"${effectiveness.reaction}"</div>
        <div style="margin-top: 8px; font-size: 0.75rem; color: #6B7280;">
          ${effectiveness.modifier > 0 ? 
            `<span style="color: ${effectColor};">+${Math.round(effectiveness.modifier * 100)}% recruitment chance</span>` : 
            effectiveness.modifier < 0 ? 
            `<span style="color: ${effectColor};">${Math.round(effectiveness.modifier * 100)}% recruitment chance</span>` :
            `No effect on recruitment chance`
          }
        </div>
      </div>
    `;
    
    // Add hover effects
    itemCard.addEventListener('mouseenter', () => {
      itemCard.style.transform = 'translateY(-2px)';
      itemCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });
    
    itemCard.addEventListener('mouseleave', () => {
      itemCard.style.transform = '';
      itemCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    });
    
    // Add click handler to select this gift
    itemCard.addEventListener('click', () => {
      this.selectGift(item, giftType, effectiveness, monster, drawer);
    });
    
    itemsGrid.appendChild(itemCard);
  });
}

// Handle gift selection
// In selectGift function
selectGift(item, giftType, effectiveness, monster, recruitmentOverlay) {
  console.log(`Selected gift: ${item.name} for ${this.getMonsterName(monster)}`);
  
  // If effectiveness wasn't provided, determine it now
  if (!effectiveness) {
    const monsterType = monster.basic?.type || monster.type || 'Unknown';
    giftType = giftType || this.determineGiftType(item);
    effectiveness = this.getGiftEffectiveness(giftType, monsterType);
    console.log(`Determined gift effectiveness: ${effectiveness.effectiveness}`);
  }
  
  // Close and clean up the drawer
  if (this.giftDrawer) {
    this.giftDrawer.hide();
    
    // Schedule removal after hide animation
    setTimeout(() => {
      if (this.giftDrawer && this.giftDrawer.parentNode) {
        this.giftDrawer.parentNode.removeChild(this.giftDrawer);
        this.giftDrawer = null;
      }
    }, 350); // Slightly longer than hide animation duration
  }
  
  // Show gift offering dialog and process results
  this.offerGift(item, giftType, effectiveness, monster, recruitmentOverlay);
}

// Show gift offering and handle result
offerGift(item, giftType, effectiveness, monster, recruitmentOverlay) {
  // Create a dialog overlay
  const overlay = document.createElement('div');
  overlay.className = 'gift-offering-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  const container = document.createElement('div');
  container.className = 'gift-offering-container';
  container.style.cssText = `
    background: linear-gradient(135deg, #4338ca, #6d28d9);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    width: 90%;
    max-width: 500px;
    padding: 24px;
    transform: scale(0.95);
    transition: transform 0.3s ease;
    color: white;
    text-align: center;
  `;
  
  // Determine effectiveness color
  let effectColor = '#6B7280'; // Default gray
  switch (effectiveness.effectiveness) {
    case 'Perfect': effectColor = '#10B981'; break; // Green
    case 'Good': effectColor = '#3B82F6'; break; // Blue
    case 'Neutral': effectColor = '#6B7280'; break; // Gray
    case 'Poor': effectColor = '#F59E0B'; break; // Amber
    case 'Insulting': effectColor = '#EF4444'; break; // Red
  }
  
  container.innerHTML = `
    <div style="font-size: 36px; margin-bottom: 16px;">🎁</div>
    <h2 style="margin: 0 0 8px 0; font-size: 1.5rem;">You offer ${item.name} to the ${monster.basic?.name || monster.name}</h2>
    
    <div style="
      background: rgba(255, 255, 255, 0.1);
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      text-align: left;
    ">
      <div style="
        display: inline-block;
        padding: 4px 10px;
        background: ${effectColor}20;
        color: ${effectColor};
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
        margin-bottom: 8px;
      ">${effectiveness.effectiveness} Gift</div>
      
      <p style="margin: 8px 0; font-style: italic;">
        "${effectiveness.reaction}"
      </p>
    </div>
    
    <p>The ${monster.basic?.type || monster.type} ${effectiveness.modifier > 0 ? 'appreciates' : effectiveness.modifier < 0 ? 'dislikes' : 'acknowledges'} your gift.</p>
    
    <button class="continue-btn" style="
      background: rgba(255, 255, 255, 0.2);
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      cursor: pointer;
      margin-top: 16px;
    ">Continue</button>
  `;
  
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  
  // Animate in
  setTimeout(() => {
    overlay.style.opacity = '1';
    container.style.transform = 'scale(1)';
  }, 10);
  
  // Add close button handler
  container.querySelector('.continue-btn').addEventListener('click', () => {
    // Close dialog
    overlay.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      overlay.remove();
      
      // Remove item from inventory
      this.removeGiftFromInventory(item);
      
      // Apply the effectiveness modifier and continue recruitment
      // Make sure to pass the effectiveness object
      this.handleGiftRecruitmentAttempt(monster, effectiveness.modifier, item, giftType, effectiveness, recruitmentOverlay);
    }, 300);
  });
}

removeGiftFromInventory(item) {
  console.log(`Removing ${item.name} (${item.id}) from inventory`);
  
  // If it's from Scene3D inventory
  if (item.source === '3d-inventory' && this.scene3D && typeof this.scene3D.removeFromInventory === 'function') {
    console.log(`Removing from Scene3D inventory: ${item.id}`);
    this.scene3D.removeFromInventory(item.id);
    return true;
  }
  
  // If it's from local inventory
  if (this.inventory) {
    if (item.type === 'weapon' && this.inventory.weapons) {
      console.log(`Removing weapon from local inventory: ${item.id}`);
      this.inventory.weapons = this.inventory.weapons.filter(w => w.id !== item.id);
      return true;
    } 
    
    if (item.type === 'armor' && this.inventory.armor) {
      console.log(`Removing armor from local inventory: ${item.id}`);
      this.inventory.armor = this.inventory.armor.filter(a => a.id !== item.id);
      return true;
    }
    
    if (this.inventory.misc) {
      console.log(`Removing misc item from local inventory: ${item.id}`);
      this.inventory.misc = this.inventory.misc.filter(m => m.id !== item.id);
      return true;
    }
  }
  
  console.warn(`Could not remove item ${item.name} (${item.id}) from inventory`);
  return false;
}

getMonsterName(monster) {
  // Try various paths to get the monster name
  return monster.name || 
         monster.basic?.name || 
         (monster.data && monster.data.basic?.name) || 
         "Unknown Monster";
}

// 7. Method to handle recruitment attempt with gift modifier
handleGiftRecruitmentAttempt(monster, chanceModifier, giftedItem, giftType, effectiveness, recruitmentOverlay) {
  // Increase current attempt count
  this.recruitmentAttempts.currentCount++;
  
  console.log(`Gift recruitment attempt ${this.recruitmentAttempts.currentCount}/${this.recruitmentAttempts.maxAttempts}`);
  console.log(`Base chance modifier: ${chanceModifier}`);
  
  // Determine success chance based on monster type and approach
  let successChance = 0.5;  // Base 50% chance
  
  // Apply the gift modifier
  successChance += chanceModifier;
  
  // Cap success chance
  successChance = Math.max(0.1, Math.min(0.9, successChance));
  
  console.log(`Final success chance: ${successChance.toFixed(2)}`);
  
  // Roll for success
  const roll = Math.random();
  const success = roll <= successChance;
  
  console.log(`Gift recruitment roll: ${roll.toFixed(2)} vs ${successChance.toFixed(2)} - ${success ? 'SUCCESS' : 'FAILURE'}`);

  // If successful, add extra logic for naming the monster and keeping/renaming the item
  if (success) {
    // Generate a name for the monster
    const monsterName = this.generateMonsterName(monster);
    console.log(`Generated name for monster: ${monsterName}`);
    
    // Close the recruitment dialog first
    if (recruitmentOverlay) {
      recruitmentOverlay.style.opacity = '0';
      const dialogContainer = recruitmentOverlay.querySelector('.party-container');
      if (dialogContainer) {
        dialogContainer.style.transform = 'scale(0.95)';
      }
      setTimeout(() => {
        if (recruitmentOverlay.parentNode) {
          recruitmentOverlay.parentNode.removeChild(recruitmentOverlay);
        }
      }, 300);
    }
    
    // Add the monster to party with its new name
    const newMonster = this.prepareMonster(monster);
    newMonster.name = monsterName;
    
    // If the monster is a humanoid and the gift was a usable item (weapon/armor), equip it
    const monsterType = monster.basic?.type || monster.type || '';
    if (monsterType === 'Humanoid' && (giftType === 'weapon' || giftType === 'armor')) {
      // Create a copy of the item with a personalized name
      const personalizedItem = JSON.parse(JSON.stringify(giftedItem));
      personalizedItem.name = `${monsterName}'s ${giftedItem.name}`;
      
      // Equip the item to the monster
      newMonster.equipment = newMonster.equipment || {};
      newMonster.equipment[giftType] = personalizedItem;
      
      // Update stats based on equipment
      this.updateMonsterStats(newMonster);
      
      console.log(`Equipped personalized ${giftType} to ${monsterName}: ${personalizedItem.name}`);
    }
    
    // Add to party
    this.addMonster(newMonster);
    console.log(`Added ${monsterName} to party`);
    
    // Remove the encounter marker if success
    this.removeEncounterMarker();
  }
  
  // Show result with dice animation
  this.showRecruitmentResult(monster, success, 'gift', recruitmentOverlay, {
    itemName: giftedItem.name,
    monsterName: success ? this.generateMonsterName(monster) : null,
    effectiveness: effectiveness.effectiveness
  });
}

// 8. Method to generate a random name for the monster based on type
generateMonsterName(monster) {
  const monsterType = monster.basic?.type || monster.type || 'Unknown';
  
  const namesByType = {
    'Beast': [
      'Fang', 'Shadow', 'Whisper', 'Storm', 'Thunder', 'Frost', 'Blaze', 'Thorn',
      'Swift', 'Midnight', 'Ghost', 'Timber', 'Sage', 'Echo', 'Flint', 'River'
    ],
    'Dragon': [
      'Drakor', 'Fafnir', 'Saphira', 'Vermithrax', 'Glaurung', 'Ancalagon',
      'Falkor', 'Smaug', 'Ember', 'Scorch', 'Tiamat', 'Bahamut', 'Aurelion'
    ],
    'Undead': [
      'Mortis', 'Grimm', 'Bane', 'Shroud', 'Dread', 'Scourge', 'Wraith',
      'Doom', 'Haunt', 'Grave', 'Rot', 'Shade', 'Crypt', 'Mournful'
    ],
    'Humanoid': [
      'Thorin', 'Elara', 'Garrick', 'Lirael', 'Thorne', 'Isolde', 'Darian',
      'Lyra', 'Kaspar', 'Thalia', 'Rook', 'Serena', 'Valor', 'Elysia'
    ],
    'Fiend': [
      'Maloch', 'Lilith', 'Abaddon', 'Mephistopheles', 'Baphomet', 'Asmodeus',
      'Belial', 'Dagon', 'Pazuzu', 'Izrial', 'Xaphan', 'Vetis', 'Naberius'
    ],
    'Fey': [
      'Puck', 'Titania', 'Oberon', 'Ariel', 'Mab', 'Cobweb', 'Peaseblossom',
      'Robin', 'Quince', 'Thistle', 'Willow', 'Bramble', 'Gossamer', 'Drift'
    ],
    'Elemental': [
      'Ignis', 'Aquilo', 'Terran', 'Zephyr', 'Frost', 'Ember', 'Gust',
      'Quake', 'Spark', 'Torrent', 'Avalanche', 'Squall', 'Cinder'
    ],
    'Celestial': [
      'Seraphim', 'Auriel', 'Cassiel', 'Raziel', 'Uriel', 'Gabriel', 'Raphael',
      'Sariel', 'Azrael', 'Chamuel', 'Jophiel', 'Zadkiel', 'Metatron'
    ]
  };
  
  // Get appropriate name list or use generic names
  const nameList = namesByType[monsterType] || [
    'Gizmo', 'Patch', 'Nimble', 'Quirk', 'Sparkle', 'Wisp', 'Echo', 'Flicker',
    'Glimmer', 'Rune', 'Zephyr', 'Pebble', 'Drift', 'Sprout', 'Flare'
  ];
  
  // Get random name from list
  const randomIndex = Math.floor(Math.random() * nameList.length);
  return nameList[randomIndex];
}

}