/**
 * PartyManager.js
 * Handles monster recruitment, party management, and monster progression
 */
class PartyManager {
  constructor(resourceManager) {
    // Store reference to resource manager
    this.resourceManager = resourceManager;
    
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
    
    // Variables for UI elements
    this.partyDialog = null;
    this.activeTab = 'active';
    
    console.log('Party Manager initialized');
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
//   prepareMonster(monster) {
//     // Clone base monster data
//     const base = JSON.parse(JSON.stringify(monster.data || monster));
    
//     // Add gameplay properties
//     const partyMonster = {
//       id: base.id || `monster_${Date.now()}`,
//       name: base.basic?.name || monster.name || 'Unknown Monster',
//       type: base.basic?.type || 'Unknown',
//       size: base.basic?.size || 'Medium',
//       cr: base.basic?.cr || '0',
//       abilities: base.abilities || {},
//       stats: base.stats || {},
//       traits: base.traits || {},
//       thumbnail: monster.thumbnail || monster.token?.data || null,
      
//       // Game-specific properties
//       level: 1,
//       experience: 0,
//       experienceToNext: 100,
//       inventory: [],
//       equipment: {
//         weapon: null,
//         armor: null
//       },
//       // Calculate HP based on monster data
//       currentHP: base.stats?.hp?.average || 10,
//       maxHP: base.stats?.hp?.average || 10,
//       // Use AC from monster data
//       armorClass: base.stats?.ac || 10,
//       // Monster abilities
//       monsterAbilities: this.generateAbilities(base)
//     };
    
//     return partyMonster;
//   }

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
    return true;
  }
  
  // Remove monster from party entirely
  removeMonster(monsterId) {
    // Check active party first
    const activeIndex = this.party.active.findIndex(m => m.id === monsterId);
    if (activeIndex !== -1) {
      const monster = this.party.active.splice(activeIndex, 1)[0];
      console.log(`Removed ${monster.name} from active party`);
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
  
  // Equip item to monster
  equipItem(monsterId, slot, item) {
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
    
    // Unequip current item if any
    if (monster.equipment[slot]) {
      this.unequipItem(monsterId, slot);
    }
    
    // Equip new item
    monster.equipment[slot] = item;
    
    // Update monster stats based on equipment
    this.updateMonsterStats(monster);
    
    console.log(`Equipped ${item.name} to ${monster.name}`);
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
    
    // Unequip item
    monster.equipment[slot] = null;
    
    // Update monster stats
    this.updateMonsterStats(monster);
    
    console.log(`Unequipped ${item.name} from ${monster.name}`);
    return true;
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
  
  // Show party management dialog
  showPartyManager() {
    // Create dialog for party management
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Monster Party';
    dialog.style.setProperty('--width', '800px');
    
    // Add event listener for when dialog is cancelled (Esc key)
    dialog.addEventListener('sl-request-close', (e) => {
      if (window.scene3D) {
        window.scene3D.resumeControls();
      }
    });
    
    // Create content with tabs
    dialog.innerHTML = `
      <sl-tab-group>
        <sl-tab slot="nav" panel="active-party">Active Party (${this.party.active.length}/${this.party.maxActive})</sl-tab>
        <sl-tab slot="nav" panel="reserve-party">Reserve Monsters (${this.party.reserve.length})</sl-tab>
        
        <sl-tab-panel name="active-party">
          ${this.renderActiveParty()}
        </sl-tab-panel>
        
        <sl-tab-panel name="reserve-party">
          ${this.renderReserveParty()}
        </sl-tab-panel>
      </sl-tab-group>
      
      <div slot="footer">
        <sl-button variant="neutral" class="close-btn">Close</sl-button>
      </div>
    `;
    
    // Add event listeners
    dialog.addEventListener('sl-after-show', () => {
      this.setupPartyDialogEvents(dialog);
    });
    
    // Store reference and show dialog
    this.partyDialog = dialog;
    document.body.appendChild(dialog);
    dialog.show();
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
  
  // Render a monster card
  renderMonsterCard(monster, location) {
    // Format HP as fraction and percentage
    const hpPercent = (monster.currentHP / monster.maxHP) * 100;
    let hpBarColor = '#4CAF50';  // Green
    if (hpPercent < 30) {
      hpBarColor = '#F44336';  // Red
    } else if (hpPercent < 70) {
      hpBarColor = '#FF9800';  // Orange
    }

    const tokenSource = monster.token?.data || monster.token?.url || null;

    
    // Equipment icons
    const weaponIcon = monster.equipment.weapon ? 
      `<img src="${monster.equipment.weapon.icon}" alt="${monster.equipment.weapon.name}" title="${monster.equipment.weapon.name}" style="width: 24px; height: 24px;">` : 
      `<span class="material-icons" style="opacity: 0.3;">add</span>`;
      
    const armorIcon = monster.equipment.armor ? 
      `<img src="${monster.equipment.armor.icon}" alt="${monster.equipment.armor.name}" title="${monster.equipment.armor.name}" style="width: 24px; height: 24px;">` : 
      `<span class="material-icons" style="opacity: 0.3;">add</span>`;
    
      return `
      <div class="monster-card" data-monster-id="${monster.id}" style="...">
        <div class="monster-header" style="...">
          <div class="monster-image" style="width: 64px; height: 64px; margin-right: 10px;">
            <img src="${tokenSource || this.generateDefaultTokenImage(monster)}" 
                 alt="${monster.name}" 
                 style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;">
          </div>
          <div class="monster-info" style="flex: 1;">
            <div class="monster-name" style="font-weight: bold; font-size: 1.1em;">${monster.name}</div>
            <div class="monster-type" style="color: #666; font-size: 0.9em;">${monster.size} ${monster.type}</div>
            <div class="monster-level" style="margin-top: 4px;">Level ${monster.level}</div>
          </div>
        </div>
        
        <!-- Monster stats -->
        <div class="monster-stats" style="padding: 10px;">
          <!-- HP Bar -->
          <div class="hp-bar-label" style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>HP</span>
            <span>${monster.currentHP}/${monster.maxHP}</span>
          </div>
          <div class="hp-bar-bg" style="height: 8px; background: #e0e0e0; border-radius: 4px; margin-bottom: 10px;">
            <div class="hp-bar-fill" style="height: 100%; width: ${hpPercent}%; background: ${hpBarColor}; border-radius: 4px;"></div>
          </div>
          
          <!-- Other stats -->
          <div class="stat-row" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>AC</span>
            <span>${monster.armorClass}</span>
          </div>
          <div class="stat-row" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>CR</span>
            <span>${monster.cr}</span>
          </div>
          
          <!-- Equipment -->
          <div class="equipment" style="display: flex; justify-content: space-between; margin-top: 8px;">
            <div class="equipment-slot weapon" data-slot="weapon" data-monster-id="${monster.id}" style="display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
              <span class="material-icons" style="font-size: 16px;">sports_martial_arts</span>
              ${weaponIcon}
            </div>
            <div class="equipment-slot armor" data-slot="armor" data-monster-id="${monster.id}" style="display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
              <span class="material-icons" style="font-size: 16px;">security</span>
              ${armorIcon}
            </div>
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="monster-actions" style="display: flex; padding: 8px; background: #f9f9f9; border-top: 1px solid #eee;">
          ${location === 'active' ? `
            <sl-button class="move-to-reserve" size="small" data-monster-id="${monster.id}">
              <span class="material-icons" style="font-size: 16px;">arrow_downward</span>
              To Reserve
            </sl-button>
          ` : `
            <sl-button class="move-to-active" size="small" data-monster-id="${monster.id}" ?disabled="${this.party.active.length >= this.party.maxActive}">
              <span class="material-icons" style="font-size: 16px;">arrow_upward</span>
              To Active
            </sl-button>
          `}
          <div style="flex: 1;"></div>
          <sl-button class="view-details" size="small" data-monster-id="${monster.id}">
            <span class="material-icons" style="font-size: 16px;">info</span>
          </sl-button>
          <sl-button class="equip-monster" size="small" data-monster-id="${monster.id}">
            <span class="material-icons" style="font-size: 16px;">build</span>
          </sl-button>
        </div>
      </div>
    `;
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
    ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
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
    ctx.fillText(monster.name.charAt(0).toUpperCase(), size/2, size/2);
    
    return canvas.toDataURL('image/webp');
  }
  
  // Setup event listeners for party dialog
  setupPartyDialogEvents(dialog) {
  // Pause controls when dialog opens
    if (window.scene3D) {
        window.scene3D.pauseControls();
      }

      const previouslyFocused = document.activeElement;

  // Close button
  dialog.querySelector('.close-btn').addEventListener('click', () => {
    dialog.hide();
    // Resume controls after dialog closes
    setTimeout(() => {
        // Try to find the main canvas or use document.body
        const canvas = document.querySelector('canvas') || document.body;
        canvas.focus();
        
        // Resume controls after dialog closes
        if (window.scene3D) {
          window.scene3D.resumeControls();
        }
      }, 100); // Small delay to ensure dialog is fully hidden
    });

  // Handle dialog hide event
  dialog.addEventListener('sl-after-hide', () => {
    // Remove dialog from DOM after it's hidden
    dialog.remove();
    
    // Force the document body to have focus
    setTimeout(() => {
      // Try to find the main canvas or use document.body
      const canvas = document.querySelector('canvas') || document.body;
      canvas.focus();
      
      // Also dispatch a dummy keyup event to reset key states
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
      
      // Make sure controls are resumed
      if (window.scene3D) {
        window.scene3D.resumeControls();
      }
    }, 100);
  });
    
    // Move to reserve buttons
    dialog.querySelectorAll('.move-to-reserve').forEach(btn => {
      btn.addEventListener('click', e => {
        const monsterId = e.currentTarget.getAttribute('data-monster-id');
        if (this.moveMonster(monsterId, 'reserve')) {
          this.refreshPartyDialog();
        }
      });
    });
    
    // Move to active buttons
    dialog.querySelectorAll('.move-to-active').forEach(btn => {
      btn.addEventListener('click', e => {
        const monsterId = e.currentTarget.getAttribute('data-monster-id');
        if (this.moveMonster(monsterId, 'active')) {
          this.refreshPartyDialog();
        }
      });
    });
    
    // View details buttons
    dialog.querySelectorAll('.view-details').forEach(btn => {
      btn.addEventListener('click', e => {
        const monsterId = e.currentTarget.getAttribute('data-monster-id');
        const monster = this.findMonster(monsterId);
        if (monster) {
          this.showMonsterDetails(monster);
        }
      });
    });
    
    // Equipment slot clicks
    dialog.querySelectorAll('.equipment-slot').forEach(slot => {
      slot.addEventListener('click', e => {
        const monsterId = e.currentTarget.getAttribute('data-monster-id');
        const slotType = e.currentTarget.getAttribute('data-slot');
        const monster = this.findMonster(monsterId);
        if (monster) {
          this.showEquipmentDialog(monster, slotType);
        }
      });
    });
    
    // Equip monster buttons
    dialog.querySelectorAll('.equip-monster').forEach(btn => {
      btn.addEventListener('click', e => {
        const monsterId = e.currentTarget.getAttribute('data-monster-id');
        const monster = this.findMonster(monsterId);
        if (monster) {
          this.showEquipmentDialog(monster);
        }
      });
    });
  }
  
  // Refresh party dialog when data changes
  refreshPartyDialog() {
    if (!this.partyDialog) return;
    
    const tabGroup = this.partyDialog.querySelector('sl-tab-group');
    const activeTab = tabGroup.getAttribute('active-tab') || 'active-party';
    
    // Update tab contents
    this.partyDialog.querySelector('sl-tab-panel[name="active-party"]').innerHTML = this.renderActiveParty();
    this.partyDialog.querySelector('sl-tab-panel[name="reserve-party"]').innerHTML = this.renderReserveParty();
    
    // Update tab labels
    this.partyDialog.querySelectorAll('sl-tab').forEach((tab, index) => {
      if (index === 0) {
        tab.textContent = `Active Party (${this.party.active.length}/${this.party.maxActive})`;
      } else if (index === 1) {
        tab.textContent = `Reserve Monsters (${this.party.reserve.length})`;
      }
    });
    
    // Reattach event listeners
    this.setupPartyDialogEvents(this.partyDialog);
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
            <div class="ability-mod">(${formatMod(monster.abilities.str.modifier + Math.floor(levelBonus/2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">DEX</div>
            <div class="ability-score">${monster.abilities.dex.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.dex.modifier + Math.floor(levelBonus/2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">CON</div>
            <div class="ability-score">${monster.abilities.con.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.con.modifier + Math.floor(levelBonus/2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">INT</div>
            <div class="ability-score">${monster.abilities.int.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.int.modifier + Math.floor(levelBonus/2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">WIS</div>
            <div class="ability-score">${monster.abilities.wis.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.wis.modifier + Math.floor(levelBonus/2))})</div>
          </div>
          <div class="ability">
            <div class="ability-name" style="font-weight: bold;">CHA</div>
            <div class="ability-score">${monster.abilities.cha.score + levelBonus}</div>
            <div class="ability-mod">(${formatMod(monster.abilities.cha.modifier + Math.floor(levelBonus/2))})</div>
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
  
  // Show equipment dialog for a monster
  showEquipmentDialog(monster, selectedSlot = null) {
    // Get available equipment
    const weapons = this.getAvailableEquipment('weapon');
    const armor = this.getAvailableEquipment('armor');
    
    // Create dialog
    const dialog = document.createElement('sl-dialog');
    dialog.label = `Equip ${monster.name}`;
    dialog.style.setProperty('--width', '500px');
    
    // Create content with tabs for different equipment types
    let contentHtml = `
      <sl-tab-group>
        <sl-tab slot="nav" panel="weapons" ${!selectedSlot || selectedSlot === 'weapon' ? 'active' : ''}>Weapons</sl-tab>
        <sl-tab slot="nav" panel="armor" ${selectedSlot === 'armor' ? 'active' : ''}>Armor</sl-tab>
        
        <sl-tab-panel name="weapons">
          ${this.renderEquipmentList(weapons, monster, 'weapon')}
        </sl-tab-panel>
        
        <sl-tab-panel name="armor">
          ${this.renderEquipmentList(armor, monster, 'armor')}
        </sl-tab-panel>
      </sl-tab-group>
    `;
    
    dialog.innerHTML = contentHtml;
    
    // Add footer with buttons
    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.innerHTML = `
      <sl-button variant="neutral" class="close-btn">Close</sl-button>
    `;
    dialog.appendChild(footer);
    
    // Add event listeners
    dialog.addEventListener('sl-after-show', () => {
      // Close button
      dialog.querySelector('.close-btn').addEventListener('click', () => {
        dialog.hide();
      });
      
      // Equipment item clicks
      dialog.querySelectorAll('.equipment-item').forEach(item => {
        item.addEventListener('click', e => {
          const itemId = e.currentTarget.getAttribute('data-item-id');
          const slot = e.currentTarget.getAttribute('data-slot');
          
          if (itemId === 'none') {
            // Unequip
            this.unequipItem(monster.id, slot);
          } else {
            // Find equipment
            const equipment = slot === 'weapon' ? 
              weapons.find(w => w.id === itemId) : 
              armor.find(a => a.id === itemId);
            
            if (equipment) {
              this.equipItem(monster.id, slot, equipment);
            }
          }
          
          // Refresh UI
          dialog.hide();
          this.refreshPartyDialog();
        });
      });
    });
    
    // Show dialog
    document.body.appendChild(dialog);
    dialog.show();
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
  
  /**
   * Monster Recruitment Methods
   */
  
  // Show recruitment dialog when player encounters a monster
  showRecruitmentDialog(monster) {
    // Need to create monster from bestiary data
    const recruitMonster = monster.data ? monster : { data: monster };
    
    // Create overlay and dialog
    const overlay = document.createElement('div');
    overlay.className = 'recruitment-overlay';
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

    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'recruitment-dialog';
    dialogContainer.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.3s ease;
    `;

    // Create header
    const header = document.createElement('div');
    header.className = 'recruitment-header';
    header.style.cssText = `
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px 8px 0 0;
      text-align: center;
      position: relative;
    `;

    header.innerHTML = `
      <h2 style="margin: 0;">Monster Encounter</h2>
      <button class="close-dialog-btn" style="position: absolute; top: 12px; right: 12px; background: none; border: none; cursor: pointer;">
        <span class="material-icons">close</span>
      </button>
    `;

    // Create content
    const content = document.createElement('div');
    content.className = 'recruitment-content';
    content.style.cssText = `
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // Monster info section
    const monsterInfo = document.createElement('div');
    monsterInfo.className = 'monster-info-section';
    monsterInfo.style.cssText = `
      display: flex;
      gap: 16px;
      align-items: center;
    `;
    
    const name = recruitMonster.data.basic?.name || 'Unknown Monster';
    const size = recruitMonster.data.basic?.size || 'Medium';
    const type = recruitMonster.data.basic?.type || 'Unknown';
    const cr = recruitMonster.data.basic?.cr || '?';
    
    monsterInfo.innerHTML = `
      <div class="monster-image" style="flex: 0 0 100px;">
        <img src="${recruitMonster.thumbnail || recruitMonster.data.token?.data}" alt="${name}" style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; border: 2px solid #ddd;">
      </div>
      <div class="monster-details" style="flex: 1;">
        <h3 style="margin: 0 0 8px 0;">${name}</h3>
        <div style="color: #666; font-style: italic; margin-bottom: 4px;">${size} ${type}</div>
        <div style="display: inline-block; background: #f5f5f5; padding: 2px 8px; border-radius: 12px; font-size: 0.9em;">CR ${cr}</div>
      </div>
    `;

    // Approach options
    const approachSection = document.createElement('div');
    approachSection.className = 'approach-section';
    approachSection.style.cssText = `
      margin-top: 16px;
    `;

    approachSection.innerHTML = `
      <h3 style="margin: 0 0 16px 0;">Approach</h3>
      <div class="approach-options" style="display: flex; flex-direction: column; gap: 12px;">
        <button class="approach-btn negotiate" style="padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; display: flex; align-items: center;">
          <span class="material-icons" style="margin-right: 12px; color: #2196F3;">chat</span>
          <div style="flex: 1;">
            <div style="font-weight: bold;">Negotiate</div>
            <div style="color: #666; font-size: 0.9em;">Try to convince the monster to join your party</div>
          </div>
        </button>
        
        <button class="approach-btn impress" style="padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; display: flex; align-items: center;">
          <span class="material-icons" style="margin-right: 12px; color: #FF9800;">fitness_center</span>
          <div style="flex: 1;">
            <div style="font-weight: bold;">Impress</div>
            <div style="color: #666; font-size: 0.9em;">Demonstrate your strength to gain respect</div>
          </div>
        </button>
        
        <button class="approach-btn gift" style="padding: 12px; text-align: left; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; display: flex; align-items: center;">
          <span class="material-icons" style="margin-right: 12px; color: #9C27B0;">card_giftcard</span>
          <div style="flex: 1;">
            <div style="font-weight: bold;">Offer Gift</div>
            <div style="color: #666; font-size: 0.9em;">Give the monster a gift as a token of friendship</div>
          </div>
        </button>
      </div>
      
      <div class="approach-separator" style="margin: 20px 0; border-bottom: 1px solid #ddd;"></div>
      
      <div class="alternative-options" style="display: flex; gap: 12px;">
        <button class="approach-btn fight" style="flex: 1; padding: 12px; text-align: center; border: 1px solid #F44336; border-radius: 8px; background: white; color: #F44336; cursor: pointer;">
          <span class="material-icons" style="margin-right: 8px;">swords</span>
          Fight
        </button>
        
        <button class="approach-btn flee" style="flex: 1; padding: 12px; text-align: center; border: 1px solid #607D8B; border-radius: 8px; background: white; color: #607D8B; cursor: pointer;">
          <span class="material-icons" style="margin-right: 8px;">directions_run</span>
          Flee
        </button>
      </div>
    `;

    // Assemble dialog
    content.appendChild(monsterInfo);
    content.appendChild(approachSection);
    dialogContainer.appendChild(header);
    dialogContainer.appendChild(content);
    overlay.appendChild(dialogContainer);

    // Add event listeners
    const closeDialog = () => {
      overlay.style.opacity = '0';
      dialogContainer.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        overlay.remove();
      }, 300);
    };

    // Close button
    header.querySelector('.close-dialog-btn').addEventListener('click', closeDialog);

    // Approach buttons
    approachSection.querySelector('.negotiate').addEventListener('click', () => {
      this.handleRecruitmentAttempt(recruitMonster, 'negotiate', overlay);
    });

    approachSection.querySelector('.impress').addEventListener('click', () => {
      this.handleRecruitmentAttempt(recruitMonster, 'impress', overlay);
    });

    approachSection.querySelector('.gift').addEventListener('click', () => {
      this.handleRecruitmentAttempt(recruitMonster, 'gift', overlay);
    });

    approachSection.querySelector('.fight').addEventListener('click', () => {
      closeDialog();
      // Trigger combat with this monster
      if (window.combatSystem) {
        window.combatSystem.initiateCombat([recruitMonster]);
      } else {
        console.warn('Combat system not available');
      }
    });

    approachSection.querySelector('.flee').addEventListener('click', closeDialog);

    // Add to body and animate
    document.body.appendChild(overlay);
    
    // Force browser to process before animating
    setTimeout(() => {
      overlay.style.opacity = '1';
      dialogContainer.style.transform = 'scale(1)';
    }, 10);
  }
  
// Handle recruitment attempt
handleRecruitmentAttempt(monster, approach, overlay) {
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
  
  return success;
}

// Show recruitment result with animation
showRecruitmentResult(monster, success, approach, overlay) {
  // Hide previous content
  const dialogContainer = overlay.querySelector('.recruitment-dialog');
  const content = overlay.querySelector('.recruitment-content');
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
  
  // Add spinning dice animation
  diceContainer.innerHTML = `
    <div class="spinning-dice" style="font-size: 64px; animation: spin 1s ease-out forwards;">🎲</div>
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
        approachMessage = 'Your gift was well-received.';
        break;
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
    
    resultMessage.innerHTML = `
      <span class="material-icons" style="font-size: 48px; color: ${iconColor}; margin-bottom: 16px;">${icon}</span>
      <h2 style="margin: 0 0 8px 0; color: #D32F2F;">Failure!</h2>
      <p style="margin: 0 0 16px 0; font-size: 1.2em;">${message}</p>
      <p style="color: #666;">${approachMessage}</p>
      <div style="display: flex; gap: 16px; margin-top: 24px;">
        <sl-button class="fight-btn" variant="danger">Fight</sl-button>
        <sl-button class="flee-btn" variant="neutral">Flee</sl-button>
      </div>
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
        }, 300);
      });
    } else {
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
        }, 300);
      });
      
      // Flee button
      resultContent.querySelector('.flee-btn').addEventListener('click', () => {
        // Close overlay
        overlay.style.opacity = '0';
        dialogContainer.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          overlay.remove();
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

// Save party data to localStorage
saveParty() {
  try {
    const partyData = {
      active: this.party.active,
      reserve: this.party.reserve,
      maxActive: this.party.maxActive,
      maxTotal: this.party.maxTotal
    };
    
    localStorage.setItem('partyData', JSON.stringify(partyData));
    console.log('Party data saved');
    return true;
  } catch (error) {
    console.error('Error saving party data:', error);
    return false;
  }
}

// Load party data from localStorage
loadParty() {
  try {
    const savedData = localStorage.getItem('partyData');
    if (savedData) {
      const partyData = JSON.parse(savedData);
      
      this.party.active = partyData.active || [];
      this.party.reserve = partyData.reserve || [];
      this.party.maxActive = partyData.maxActive || 4;
      this.party.maxTotal = partyData.maxTotal || 20;
      
      console.log('Party data loaded');
      return true;
    }
  } catch (error) {
    console.error('Error loading party data:', error);
  }
  
  return false;
}
}