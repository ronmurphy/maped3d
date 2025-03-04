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
      this.monsterDatabase =
        this.monsterManager.monsterDatabase ||
        this.monsterManager.loadDatabase();
      console.log(
        "CombatSystem: Access to monster database:",
        !!this.monsterDatabase
      );
    } else {
      console.warn("CombatSystem: Could not create MonsterManager");
    }

    // Now get direct access to database if possible
    if (this.monsterManager) {
      this.monsterDatabase =
        this.monsterManager.monsterDatabase ||
        this.monsterManager.loadDatabase();
      console.log(
        "CombatSystem: Access to monster database:",
        !!this.monsterDatabase
      );
    } else {
      console.warn(
        "CombatSystem: Could not connect to MonsterManager database"
      );
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

    // combo system
    this.addCombatAnimations();
    this.initializeComboSystem();

    console.log("Combat System initialized");
  }

  createCombatStyles() {
    const styleElement = document.createElement("style");
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

.enemy-layout-quad {
  width: 100%;
  height: 200px;
  position: relative;
}

.enemy-layout-quad .combat-monster:nth-child(1) {
  position: absolute;
  top: 10px;
  left: 25%;
  transform: translateX(-50%) rotate(-2deg);
  z-index: 4;
}

.enemy-layout-quad .combat-monster:nth-child(2) {
  position: absolute;
  top: 10px;
  left: 75%;
  transform: translateX(-50%) rotate(2deg);
  z-index: 3;
}

.enemy-layout-quad .combat-monster:nth-child(3) {
  position: absolute;
  bottom: 10px;
  left: 25%;
  transform: translateX(-50%) rotate(-4deg);
  z-index: 2;
}

.enemy-layout-quad .combat-monster:nth-child(4) {
  position: absolute;
  bottom: 10px;
  left: 75%;
  transform: translateX(-50%) rotate(4deg);
  z-index: 1;
}

/* Make enemy cards slightly smaller when multiple */
.enemy-layout-duo .combat-monster,
.enemy-layout-trio .combat-monster,
.enemy-layout-quad .combat-monster {
  width: 160px; /* Slightly smaller than the standard 180px */
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

.initiative-list {
  max-height: 300px; /* Increase from 200px */
  overflow-y: auto;
}

/* Visual combat log styles */
.log-entry {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.9em;
  border-left: 4px solid;
  animation: slideIn 0.3s ease-out;
}

.log-entry.action {
  background: rgba(239, 68, 68, 0.1);
  border-left-color: #ef4444;
}

.log-entry.heal {
  background: rgba(16, 185, 129, 0.1);
  border-left-color: #10b981;
}

.log-action {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-combatants {
  display: flex;
  align-items: center;
}

.log-token {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
}

.log-token img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.log-token.attacker {
  border: 2px solid #ef4444;
}

.log-token.healer {
  border: 2px solid #10b981;
}

.log-verb {
  margin: 0 6px;
  font-weight: bold;
}

.log-result {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 32px;
  font-size: 0.9em;
}

.log-damage {
  font-weight: bold;
  color: #ef4444;
}

.log-heal {
  font-weight: bold;
  color: #10b981;
}

.log-intensity {
  font-style: italic;
  margin-right: 4px;
}

.critical-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
  border: 1px solid white;
}

/* Log animations */
@keyframes slideIn {
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.log-critical {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-2px); }
  40%, 80% { transform: translateX(2px); }
}

.log-heavy {
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.defeated-enemies-row {
  position: absolute;
  top: 16px;
  left: 230px; /* Position right after initiative tracker */
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 8px;
  color: white;
  font-size: 0.9em;
}

.defeated-header {
  opacity: 0.8;
  font-size: 0.9em;
}

.defeated-token {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.defeated-token img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
  filter: grayscale(80%);
}

.defeated-x {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-weight: bold;
  text-shadow: 0 0 2px black;
}

// In your createCombatStyles method, update these styles:
.battle-scene {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  position: relative;
  overflow: hidden;
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
  z-index: 50; /* Ensure it's above other elements */
}

.enemy-area {
  margin-left: 220px; /* Clear the initiative tracker */
  margin-top: 16px;
  width: calc(100% - 240px); /* Leave room for initiative tracker */
  height: 250px; /* Fixed height square area */
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.defeated-enemies-row {
  position: absolute;
  top: 230px; /* Position below initiative tracker */
  left: 16px;
  width: 200px; /* Same width as initiative tracker */
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 4px 8px;
  gap: 6px;
  color: white;
  font-size: 0.9em;
  max-height: 100px;
  overflow-y: auto;
  z-index: 50;
}

/* Add to createCombatStyles method */
/* Visual combat log styles */
.log-entry {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.9em;
  border-left: 4px solid;
  animation: slideIn 0.3s ease-out;
}

.log-entry.action {
  background: rgba(239, 68, 68, 0.1);
  border-left-color: #ef4444;
}

.log-entry.heal {
  background: rgba(16, 185, 129, 0.1);
  border-left-color: #10b981;
}

.log-action {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-combatants {
  display: flex;
  align-items: center;
}

.log-token {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
}

.log-token img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.log-token.attacker {
  border: 2px solid #ef4444;
}

.log-token.healer {
  border: 2px solid #10b981;
}

.log-verb {
  margin: 0 6px;
  font-weight: bold;
}

.log-result {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 32px;
  font-size: 0.9em;
}

.log-damage {
  font-weight: bold;
  color: #ef4444;
}

.log-heal {
  font-weight: bold;
  color: #10b981;
}

.log-intensity {
  font-style: italic;
  margin-right: 4px;
}

.critical-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
  border: 1px solid white;
}

/* Log animations */
@keyframes slideIn {
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.log-critical {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-2px); }
  40%, 80% { transform: translateX(2px); }
}

.log-heavy {
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.defeated-enemies-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 2px 8px;
  height: 32px;
}

.defeated-token {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.defeated-token img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
  filter: grayscale(80%);
}

.defeated-x {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-weight: bold;
  text-shadow: 0 0 2px black;
}

/* Add these styles to your createCombatStyles method */

/* HP bar fill colors */
.hp-bar-fill.high {
  background: #10b981;
}

.hp-bar-fill.medium {
  background: #f59e0b;
}

.hp-bar-fill.low {
  background: #ef4444;
}

/* Combat monster card styling */
.combat-monster {
  position: relative;
  margin: 4px;
  transition: all 0.3s ease;
}

.combat-monster.enemy {
  transform: rotate(4deg);
}

.combat-monster.player {
  transform: rotate(-4deg);
}

/* Active animation */
.combat-monster.active .active-indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.1); }
  100% { transform: translateX(-50%) scale(1); }
}

/* Targeting states for combat cards */
.combat-monster.targetable {
  cursor: pointer;
  animation: targetPulse 1.5s infinite;
}

@keyframes targetPulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* Automatic targeting animation */
.auto-targeted {
  animation: auto-target-pulse 0.8s ease;
}

@keyframes auto-target-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* Make enemy cards slightly smaller when multiple */
.enemy-layout-duo .combat-monster,
.enemy-layout-trio .combat-monster,
.enemy-layout-quad .combat-monster {
  width: 160px; /* Slightly smaller than the standard 180px */
}
`;

    return styleElement;
  }

  setCombatBackground() {
    console.log("Setting combat background...");

    // First, check if dialogContainer exists
    if (!this.dialogContainer) {
      console.error("setCombatBackground: dialogContainer is not available");
      return false;
    }

    // Safely check the resource manager and splashArt structure
    if (!this.resourceManager) {
      console.error("setCombatBackground: resourceManager is not available");
      return false;
    }

    if (
      !this.resourceManager.resources ||
      !this.resourceManager.resources.splashArt
    ) {
      console.error(
        "setCombatBackground: splashArt property not found in resources"
      );
      return false;
    }

    if (!this.resourceManager.resources.splashArt.background) {
      console.error(
        "setCombatBackground: background category not found in splashArt"
      );
      return false;
    }

    // Try to get a random background art
    const backgrounds = this.resourceManager.resources.splashArt.background;
    console.log(
      `Found ${backgrounds.size} backgrounds in splashArt.background`
    );

    if (backgrounds.size <= 0) {
      console.warn("setCombatBackground: No backgrounds available");
      return false;
    }

    // Log available backgrounds for debugging
    if (backgrounds.size > 0) {
      console.log("Available backgrounds:");
      backgrounds.forEach((bg, id) => {
        console.log(
          `- ID: ${id}, Name: ${
            bg.name
          }, Has data: ${!!bg.data}, Data length: ${
            bg.data ? bg.data.substring(0, 30) + "..." : "N/A"
          }`
        );
      });
    }

    // Get random splash art
    const randomIndex = Math.floor(Math.random() * backgrounds.size);
    const backgroundValues = Array.from(backgrounds.values());
    const backgroundArt = backgroundValues[randomIndex];

    console.log(
      `Selected background index ${randomIndex}: ${
        backgroundArt?.name || "Unknown"
      }`
    );

    if (!backgroundArt) {
      console.error(
        "setCombatBackground: Selected background is null or undefined"
      );
      return false;
    }

    if (!backgroundArt.data) {
      console.error(
        "setCombatBackground: Selected background does not have data property"
      );
      return false;
    }

    try {
      // Apply as background
      console.log("Applying background image...");
      this.dialogContainer.style.backgroundImage = `url(${backgroundArt.data})`;

      // Randomly choose styling approach
      const stylingOption = Math.floor(Math.random() * 5);
      console.log(`Using styling option: ${stylingOption}`);

      switch (stylingOption) {
        case 0:
          // Full cover (default)
          this.dialogContainer.style.backgroundSize = "cover";
          this.dialogContainer.style.backgroundPosition = "center";
          console.log("Applied style: Full cover");
          break;

        case 1:
          // Contained with possible repetition
          this.dialogContainer.style.backgroundSize = "contain";
          this.dialogContainer.style.backgroundPosition = "center";
          this.dialogContainer.style.backgroundRepeat = "repeat";
          console.log("Applied style: Contained with repetition");
          break;

        case 2:
          // Zoomed in on a section
          this.dialogContainer.style.backgroundSize = "150%";

          // Pick a random focus point
          const positions = [
            "top left",
            "top center",
            "top right",
            "center left",
            "center",
            "center right",
            "bottom left",
            "bottom center",
            "bottom right"
          ];
          const randomPosition =
            positions[Math.floor(Math.random() * positions.length)];
          this.dialogContainer.style.backgroundPosition = randomPosition;
          console.log(`Applied style: Zoomed in (${randomPosition})`);
          break;

        case 3:
          // Slightly tilted background (adds distinctive look)
          this.dialogContainer.style.backgroundSize = "cover";
          this.dialogContainer.style.backgroundPosition = "center";

          // Use a separate element for rotation to avoid conflicts
          // Check if we already have a rotated background layer
          let bgLayer = this.dialogContainer.querySelector(".combat-bg-layer");
          if (!bgLayer) {
            // Create a new background layer element
            bgLayer = document.createElement("div");
            bgLayer.className = "combat-bg-layer";
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
          const rotation = Math.random() > 0.5 ? "1deg" : "-1deg";
          bgLayer.style.transform = `rotate(${rotation})`;
          console.log(`Applied style: Tilted (${rotation})`);
          break;

        case 4:
          // Panoramic-style with fixed width
          this.dialogContainer.style.backgroundSize = "auto 100%";
          this.dialogContainer.style.backgroundPosition = `${Math.floor(
            Math.random() * 100
          )}% center`;
          console.log("Applied style: Panoramic");
          break;
      }

      // Make sure position is relative for absolute positioning to work
      const computedStyle = window.getComputedStyle(this.dialogContainer);
      if (computedStyle.position === "static") {
        this.dialogContainer.style.position = "relative";
      }

      // Add overlay to ensure text remains readable regardless of background
      const overlayColor = "rgba(46, 16, 101, 0.75)"; // Semi-transparent purple

      // Use a background blend mode for more interesting effects
      const blendModes = ["normal", "multiply", "overlay", "darken"];
      const randomBlend =
        blendModes[Math.floor(Math.random() * blendModes.length)];

      this.dialogContainer.style.backgroundColor = overlayColor;
      this.dialogContainer.style.backgroundBlendMode = randomBlend;
      console.log(
        `Applied overlay: ${overlayColor} with blend mode: ${randomBlend}`
      );

      return true;
    } catch (error) {
      console.error("Error applying background:", error);
      return false;
    }
  }

  addTestBackgrounds() {
    if (!this.resourceManager) {
      console.error(
        "Cannot add test backgrounds - no ResourceManager connected"
      );
      return false;
    }

    console.log("Adding test backgrounds to ResourceManager");

    // Make sure the splashArt object exists
    if (!this.resourceManager.resources.splashArt) {
      this.resourceManager.resources.splashArt = {};
    }

    // Initialize the background category as a Map if it doesn't exist
    if (!this.resourceManager.resources.splashArt["background"]) {
      this.resourceManager.resources.splashArt["background"] = new Map();
    }

    // Create some simple SVG backgrounds for testing
    const backgrounds = [
      {
        name: "Purple Gradient",
        data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%234338ca;stop-opacity:1" /><stop offset="100%" style="stop-color:%237e22ce;stop-opacity:1" /></linearGradient></defs><rect width="800" height="600" fill="url(%23grad)" /></svg>'
      },
      {
        name: "Dungeon Pattern",
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
        category: "background",
        dateAdded: new Date().toISOString()
      };

      this.resourceManager.resources.splashArt["background"].set(
        id,
        backgroundData
      );
      console.log(`Added test background: ${bg.name}`);
    });

    return true;
  }

  /**
   * Combat Initialization Methods
   */

  async initiateCombat(enemies) {
    console.log("========== COMBAT INITIALIZATION ==========");
    if (this.inCombat) {
      console.warn("Already in combat");
      return false;
    }

    // Check if player has active monsters
    console.log(
      "Checking player party:",
      this.partyManager.party.active.length,
      "active monsters"
    );
    if (!this.partyManager.party.active.length) {
      console.log("No active monsters in party, showing dialog");
      this.showNeedMonstersDialog();
      return false;
    }

    // Set combat state
    this.inCombat = true;

    // Setup player party
    this.playerParty = [...this.partyManager.party.active];
    console.log(`Player party: ${this.playerParty.length} monsters`);
    console.log(
      "Player names:",
      this.playerParty.map((p) => p.name).join(", ")
    );

    console.log("=== COMBAT PARTY DEBUG ===");
this.playerParty.forEach(monster => {
  console.log(`Monster: ${monster.name}, Type: ${monster.type}, Normalized Type: ${this.getNormalizedType(monster.type)}`);
});
console.log("=========================");

console.log("Available Combo Keys:", Object.keys(this.comboAbilities).join(", "));

    // Handle enemy setup
    console.log(
      "Enemy parameter type:",
      enemies
        ? Array.isArray(enemies)
          ? "Array"
          : typeof enemies
        : "undefined"
    );

    if (Array.isArray(enemies) && enemies.length > 0) {
      console.log(`Using provided enemy list: ${enemies.length} enemies`);
      this.enemyParty = enemies.map((enemy) =>
        this.prepareEnemyForCombat(enemy)
      );
    } else if (enemies) {
      console.log("Single enemy provided, wrapping in array");
      this.enemyParty = [this.prepareEnemyForCombat(enemies)];
    } else {
      console.log("No enemies provided, generating random enemy party");

      try {
        // Generate random enemies asynchronously
        const generatedEnemies = await this.generateEnemyParty(
          this.playerParty
        );

        if (generatedEnemies && generatedEnemies.length > 0) {
          this.enemyParty = generatedEnemies;
        } else {
          // Fallback to a default enemy if generation failed
          console.log("Enemy generation failed, using default enemy");
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
    console.log("Enemy names:", this.enemyParty.map((e) => e.name).join(", "));

    // Roll initiative
    this.rollInitiative();
    console.log(
      "Initiative order:",
      this.initiativeOrder
        .map((c) => `${c.monster.name} (${c.initiative})`)
        .join(", ")
    );

    // Show combat UI
    console.log("Showing combat interface");
    this.showCombatInterface();
    console.log("========== COMBAT INITIALIZATION COMPLETE ==========");

    return true;
  }

  // Roll initiative for all participants
  rollInitiative() {
    const allParticipants = [];

    // Add player monsters with initiative rolls
    this.playerParty.forEach((monster) => {
      // Base initiative on DEX
      const dexMod = monster.abilities?.dex?.modifier || 0;
      const initiativeRoll = this.rollDice(20) + dexMod;

      allParticipants.push({
        monster,
        initiative: initiativeRoll,
        side: "player"
      });
    });

    // Add enemy monsters with initiative rolls
    this.enemyParty.forEach((monster) => {
      // Base initiative on DEX
      const dexMod = monster.abilities?.dex?.modifier || 0;
      const initiativeRoll = this.rollDice(20) + dexMod;

      allParticipants.push({
        monster,
        initiative: initiativeRoll,
        side: "enemy"
      });
    });

    // Sort by initiative (highest first)
    this.initiativeOrder = allParticipants.sort(
      (a, b) => b.initiative - a.initiative
    );

    // Reset turn counter
    this.currentTurn = 0;
    this.roundNumber = 1;

    console.log("Initiative order:", this.initiativeOrder);
  }

  /**
   * Combat UI Methods
   */

  showCombatInterface() {
    // Add our custom styles to the document
    document.head.appendChild(this.createCombatStyles());

    // Create overlay
    this.combatOverlay = document.createElement("div");
    this.combatOverlay.className = "combat-overlay";

    // Create main combat container
    this.dialogContainer = document.createElement("div");
    this.dialogContainer.className = "combat-container";

    // Try to set background from splash art, fallback to gradient is already in CSS
    this.setCombatBackground();

    // Create header
    const header = document.createElement("div");
    header.className = "combat-header";
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
    const combatArea = document.createElement("div");
    combatArea.className = "battle-scene";

    // Create enemy area at top
    const enemyArea = document.createElement("div");
    enemyArea.className = "enemy-area";

    // Create player area at bottom
    const playerArea = document.createElement("div");
    playerArea.className = "player-area";

    // this.updateEnemyArea(enemyArea);

    setTimeout(() => {
      this.updateEnemyArea(enemyArea);
      console.log("Delayed enemy area update complete");
    }, 50);

    // Add player monsters
    this.playerParty.forEach((monster, index) => {
      const monsterCard = this.createMonsterCard(monster, "player", index);
      // Position each monster card with a slight offset
      monsterCard.style.transform = `translateY(${index * 15}px) translateX(${
        index * 20
      }px)`;
      playerArea.appendChild(monsterCard);
    });

    // Create initiative tracker
    const initiativeTracker = document.createElement("div");
    initiativeTracker.className = "initiative-tracker";
    initiativeTracker.innerHTML = `
      <div class="initiative-header">Initiative Order</div>
      <div class="initiative-list">
        ${this.renderInitiativeList()}
      </div>
    `;

    // Create battle notification (current turn)
    const battleNotification = document.createElement("div");
    battleNotification.className = "battle-notification fade-in";
    const currentMonster = this.getCurrentMonster();
    if (currentMonster) {
      battleNotification.textContent = `${currentMonster.name}'s Turn`;
    }

    // Create combat log
    const combatLog = document.createElement("div");
    combatLog.className = "combat-log";
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
    const actionBar = document.createElement("div");
    actionBar.className = "action-bar";

    // Only show action buttons if it's player's turn
    const currentCombatant = this.initiativeOrder[this.currentTurn];
    if (currentCombatant && currentCombatant.side === "player") {
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
    const mainContent = document.createElement("div");
    mainContent.style.display = "flex";
    mainContent.style.flex = "1";
    mainContent.style.overflow = "hidden";

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
      this.combatOverlay.style.opacity = "1";
      this.dialogContainer.style.transform = "scale(1)";

      // If it's enemy's turn, start AI processing
      if (currentCombatant && currentCombatant.side === "enemy") {
        setTimeout(() => this.processEnemyTurn(), 1000);
      }
    }, 10);
  }

createMonsterCard(monster, side, index) {
  console.log(
    `Creating monster card: ${monster.name}, type: ${side}, index: ${index}`
  );

  const isPlayer = side === "player";
  const isActive = this.isMonsterActive(monster);
  const isDefeated = monster.currentHP <= 0;

  // Calculate HP percentage
  const hpPercent = (monster.currentHP / monster.maxHP) * 100;
  let hpBarColorClass = "high";
  if (hpPercent < 30) {
    hpBarColorClass = "low";
  } else if (hpPercent < 70) {
    hpBarColorClass = "medium";
  }

  // Get monster type color
  const typeColor = this.getMonsterTypeColor(monster.type || "beast");
  
  // Calculate tilt angle based on monster ID (consistent per monster)
  // Less tilt in combat (from -3 to 3 degrees) to keep the UI cleaner
  const idHash = monster.id.toString().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tiltAngle = ((idHash % 7) - 3) * (side === "player" ? 1 : -1);

  // Generate token or placeholder
  const tokenSource = monster.token?.data || monster.token?.url || null;

  // Create card wrapper
  const card = document.createElement("div");
  card.className = `combat-monster ${side}`;
  if (isActive) card.classList.add("active");
  if (isDefeated) card.classList.add("defeated");
  card.setAttribute("data-monster-id", monster.id);
  
  // Apply tilt effect
  card.style.transform = `rotate(${tiltAngle}deg)`;
  card.style.transition = "all 0.3s ease";
  
  // Add card HTML content with the new design
  card.innerHTML = `
    <div class="monster-content" style="
      position: relative;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      overflow: visible; /* Changed from hidden to visible to allow active indicator to be fully visible */
      width: 180px;
    ">
      <!-- Active indicator - moved above header to ensure visibility -->
      ${
        isActive
          ? `
        <div class="active-indicator" style="
          position: absolute;
          top: -12px; /* Moved up slightly */
          left: 50%;
          transform: translateX(-50%);
          background: #3b82f6;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.7em;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 100; /* Ensure it's above everything */
        ">ACTIVE</div>
      `
          : ""
      }
      
      <!-- Header banner with monster name and type - NOW SWAPPED: token left, info right -->
      <div class="monster-header" style="
        background: linear-gradient(135deg, ${typeColor}dd, ${typeColor});
        padding: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        color: white;
      ">
        <!-- Monster image/token NOW ON LEFT -->
        <div class="monster-image" style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
          border: 2px solid ${side === "player" ? "#3b82f6" : "#ef4444"};
          background-color: ${side === "player" ? "#3b82f6" : "#ef4444"};
          margin-right: 8px;
        ">
          ${
            tokenSource
              ? `<img src="${tokenSource}" alt="${monster.name}" style="width: 100%; height: 100%; object-fit: cover;">`
              : `<span>${monster.name.charAt(0)}</span>`
          }
        </div>
        
        <!-- Monster info NOW ON RIGHT -->
        <div class="monster-info" style="
          flex: 1;
          overflow: hidden;
        ">
          <div class="monster-name" style="
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          ">${monster.name}</div>
          
          <div class="monster-type" style="
            font-size: 0.8em;
            opacity: 0.9;
          ">
            ${monster.size} ${monster.type || ""}
          </div>
        </div>
      </div>
      
      <!-- Monster stats section -->
      <div class="monster-stats" style="
        padding: 8px;
        background: #f9fafb;
      ">
        <!-- HP Bar -->
        <div class="hp-bar-label" style="
          display: flex;
          justify-content: space-between;
          font-size: 0.8em;
          margin-bottom: 4px;
        ">
          <span>HP</span>
          <span>${monster.currentHP}/${monster.maxHP}</span>
        </div>
        
        <div class="hp-bar-bg" style="
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          margin-bottom: 8px;
          overflow: hidden;
        ">
          <div class="hp-bar-fill ${hpBarColorClass}" style="
            height: 100%;
            width: ${hpPercent}%;
            border-radius: 4px;
            transition: width 0.3s ease;
          "></div>
        </div>
        
        <!-- Stats and Equipment Row -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <!-- Stats (left side) -->
          <div style="
            display: flex;
            gap: 10px;
          ">
            <!-- AC -->
            <div class="stat-display" style="
              text-align: center;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: #f3f4f6;
                border: 2px solid ${typeColor};
                color: #374151;
                font-weight: bold;
                font-size: 0.75rem;
                margin: 0 auto;
              ">
                ${monster.armorClass || monster.stats?.ac || 10}
              </div>
              <span style="font-size: 0.65rem; color: #6b7280;">AC</span>
            </div>
            
            <!-- EXP/CR -->
            <div class="stat-display" style="
              text-align: center;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: #f3f4f6;
                border: 2px solid ${side === "player" ? "#3b82f6" : "#ef4444"};
                color: #374151;
                font-weight: bold;
                font-size: 0.75rem;
                margin: 0 auto;
              ">
                ${isPlayer ? 
                  (monster.level || 1) : 
                  (monster.cr || monster.basic?.cr || "?")
                }
              </div>
              <span style="font-size: 0.65rem; color: #6b7280;">${isPlayer ? "LVL" : "CR"}</span>
            </div>
          </div>
          
          <!-- Equipment icons (right side) -->
          <div class="equipment-icons" style="
            display: flex;
            gap: 4px;
          ">
            ${monster.equipment?.weapon ?
              `<div class="equipment-icon weapon-icon" title="${monster.equipment.weapon.name || 'Weapon'}" style="
                width: 24px;
                height: 24px;
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
              `<div class="equipment-icon armor-icon" title="${monster.equipment.armor.name || 'Armor'}" style="
                width: 24px;
                height: 24px;
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
          </div>
        </div>
      </div>
      
      ${
        isDefeated
          ? `
        <div class="defeated-indicator" style="
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
          z-index: 90; /* High but below active indicator */
        ">✕</div>
      `
          : ""
      }
    </div>
  `;

  // Add hover effects
  card.addEventListener('mouseenter', () => {
    // Only apply hover effects if not defeated
    if (!isDefeated) {
      card.style.transform = `rotate(${tiltAngle}deg) translateY(-5px) scale(1.02)`;
      card.style.boxShadow = '0 10px 15px rgba(0, 0, 0, 0.3)';
      card.style.zIndex = '10';
    }
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = `rotate(${tiltAngle}deg)`;
    card.style.boxShadow = '';
    // Keep z-index higher if it's active
    card.style.zIndex = isActive ? '5' : '';
  });

  return card;
}

  renderMonsterGroup(monsters, side) {
    if (!monsters || monsters.length === 0) {
      return `<div class="empty-party-message">No ${side} monsters</div>`;
    }
  
    let html = "";
  
    monsters.forEach((monster) => {
      // Create the card using our new method to ensure consistent styling
      const monsterCard = this.createMonsterCard(monster, side, 0);
      html += monsterCard.outerHTML;
    });
  
    return html;
  }


  getMonsterTypeColor(type) {
    const typeColors = {
      aberration: "#5500AA",
      beast: "#44AA44",
      celestial: "#FFD700",
      construct: "#999999",
      dragon: "#FF4444",
      elemental: "#FF8800",
      fey: "#DD66FF",
      fiend: "#AA2222",
      giant: "#AA7722",
      humanoid: "#4444FF",
      monstrosity: "#886600",
      ooze: "#66CC66",
      plant: "#228B22",
      undead: "#663366",
      vermin: "#996633",

      // Subtypes
      demon: "#990000",
      devil: "#660000",
      lich: "#330066",
      ghost: "#9999FF",
      skeleton: "#CCCCCC",
      vampire: "#550000",
      lycanthrope: "#775500",
      mimic: "#AA33CC",
      aberrant_horror: "#220044",
      swamp_beast: "#556B2F",
      sea_monster: "#008080",
      storm_creature: "#708090",
      fire_entity: "#FF4500",
      frost_monster: "#00FFFF",
      shadow_creature: "#222222",
      celestial_guardian: "#FFFFCC",
      arcane_construct: "#6666FF",
      ancient_horror: "#3B3B6D",
      chaos_entity: "#FF00FF",
      nature_spirit: "#32CD32",
      sand_creature: "#D2B48C"
    };

    return typeColors[type.toLowerCase()] || "#6B7280"; // Default gray if not found
  }

  // Add helper method to generate default token image
  generateDefaultTokenImage(monster) {
    const canvas = document.createElement("canvas");
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Generate color based on monster type
    const color = this.getMonsterTypeColor(monster.basic.type);

    // Draw circle background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Add border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add monster initial
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(monster.name.charAt(0).toUpperCase(), size / 2, size / 2);

    return canvas.toDataURL("image/webp");
  }

  addVisualLogEntry(data) {
    // Get log container
    const logEntries = this.dialogContainer.querySelector(".log-entries");
    if (!logEntries) return;

    // Handle different types of log entries
    if (data.type === "damage") {
      const { attacker, target, damage, isCritical } = data;

      // Get miniature tokens (or generate placeholder)
      const attackerToken =
        attacker.token?.data || this.generateDefaultTokenImage(attacker);
      const targetToken =
        target.token?.data || this.generateDefaultTokenImage(target);

      // Choose appropriate verb based on damage amount
      let verb = "hit";
      let intensity = "";

      // Base verb on percentage of target's max HP
      const damagePercent = (damage / target.maxHP) * 100;

      if (isCritical) {
        verb = this.getRandomVerb("critical");
        intensity = "critically";
      } else if (damagePercent < 10) {
        verb = this.getRandomVerb("light");
      } else if (damagePercent > 25) {
        verb = this.getRandomVerb("heavy");
        intensity = "heavily";
      }

      // Create new entry
      const entry = document.createElement("div");
      entry.className = "log-entry action";

      // Apply subtle animation based on damage level
      let animation = "";
      if (isCritical) {
        animation = "log-critical";
        entry.classList.add("critical");
      } else if (damagePercent > 25) {
        animation = "log-heavy";
        entry.classList.add("heavy");
      }

      entry.innerHTML = `
      <div class="log-action ${animation}">
        <div class="log-combatants">
          <div class="log-token attacker">
            <img src="${attackerToken}" alt="${attacker.name}" title="${
        attacker.name
      }">
            ${isCritical ? '<div class="critical-indicator"></div>' : ""}
          </div>
          <span class="log-verb">${verb}</span>
          <div class="log-token target">
            <img src="${targetToken}" alt="${target.name}" title="${
        target.name
      }">
          </div>
        </div>
        <div class="log-result">
          ${intensity ? `<span class="log-intensity">${intensity}</span>` : ""}
          for <span class="log-damage">${damage}</span> damage
        </div>
      </div>
    `;

      // Add to log
      logEntries.appendChild(entry);
    } else if (data.type === "heal") {
      // Similar to damage but for healing
      const { healer, target, amount } = data;

      const healerToken =
        healer.token?.data || this.generateDefaultTokenImage(healer);
      const targetToken =
        target.token?.data || this.generateDefaultTokenImage(target);

      const entry = document.createElement("div");
      entry.className = "log-entry heal";

      entry.innerHTML = `
      <div class="log-action">
        <div class="log-combatants">
          <div class="log-token healer">
            <img src="${healerToken}" alt="${healer.name}" title="${healer.name}">
          </div>
          <span class="log-verb">healed</span>
          <div class="log-token target">
            <img src="${targetToken}" alt="${target.name}" title="${target.name}">
          </div>
        </div>
        <div class="log-result">
          for <span class="log-heal">${amount}</span> health
        </div>
      </div>
    `;

      logEntries.appendChild(entry);
    } else {
      // Default text-based log for other types
      const entry = document.createElement("div");
      entry.className = "log-entry";
      entry.textContent = data.message;
      logEntries.appendChild(entry);
    }

    // Scroll to bottom
    logEntries.scrollTop = logEntries.scrollHeight;
  }

  // Helper to get random verb based on damage level
  getRandomVerb(level) {
    const verbs = {
      light: ["grazed", "scratched", "nicked", "clipped", "poked"],
      medium: ["hit", "struck", "attacked", "wounded", "bashed"],
      heavy: ["slammed", "crushed", "thrashed", "walloped", "clobbered"],
      critical: [
        "devastated",
        "decimated",
        "annihilated",
        "obliterated",
        "pulverized"
      ]
    };

    const options = verbs[level] || verbs.medium;
    return options[Math.floor(Math.random() * options.length)];
  }

  renderInitiativeList() {
    if (!this.initiativeOrder || this.initiativeOrder.length === 0) {
      return '<div style="padding: 8px; text-align: center;">No combatants</div>';
    }

    let html = "";

    this.initiativeOrder.forEach((combatant, index) => {
      const { monster, initiative, side } = combatant;
      const isCurrentTurn = index === this.currentTurn;
      const isDefeated = monster.currentHP <= 0;

      const classes = ["initiative-item"];
      if (isCurrentTurn) classes.push("active");
      if (isDefeated) classes.push("defeated");

      html += `
        <div class="${classes.join(" ")}">
          ${
            isCurrentTurn
              ? `<span class="material-icons" style="margin-right: 8px; font-size: 16px; color: #fcd34d;">play_arrow</span>`
              : `<span style="width: 24px; display: inline-block;"></span>`
          }
          <div class="initiative-marker ${side}"></div>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${
            monster.name
          }</span>
          <span style="margin-left: 4px; font-weight: bold;">${initiative}</span>
        </div>
      `;
    });

    return html;
  }


//   renderActionBar(monster) {
//     if (!monster || monster.currentHP <= 0) {
//       return '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>This monster is defeated</em></div>';
//     }
  
//     let html = `<div class="abilities-container">`;
  
//     // Check if it's a player monster and if we should show combo abilities
//     const isPlayerMonster = this.playerParty.some(m => m.id === monster.id);
    
//     // Check for combo abilities
//     const availableCombos = [];
    
//     if (isPlayerMonster && this.partyManager) {
//       // Get combo abilities for this monster
//       const allCombos = this.getAvailableComboAbilities();

//       console.log("ALL AVAILABLE COMBOS FOR ACTION BAR:", allCombos.map(c => c.name));

// // If filtering is happening, add before and after logs:
// console.log("BEFORE FILTERING:", allCombos.map(c => c.name));

      
//       // Filter to only those involving this monster
//       const monsterCombos = allCombos.filter(combo => 
//         combo.monsters.some(m => m.id === monster.id)
//       );
      
//       if (monsterCombos.length > 0) {
//         // Add combos to the available abilities
//         availableCombos.push(...monsterCombos);
//       }
//     }
// // // [filtering code]
// // console.log("AFTER FILTERING:", filteredCombos.map(c => c.name));

  
//     // First show combo abilities if available (at the top)
//     if (availableCombos.length > 0) {
//       html += `<div class="combo-abilities-header" style="
//         display: flex;
//         align-items: center;
//         margin-bottom: 8px;
//         padding: 4px 8px;
//         background: rgba(255, 215, 0, 0.1);
//         border-radius: 8px;
//       ">
//         <span class="material-icons" style="margin-right: 8px; color:rgb(231, 24, 24);">auto_awesome</span>
//         <span style="color:rgb(252, 127, 77); font-weight: 500;">Combo Abilities</span>
//       </div>
      
//       <div class="combo-abilities" style="
//         display: flex;
//         flex-wrap: wrap;
//         gap: 8px;
//         margin-bottom: 12px;
//       ">`;

//       console.log(`Action bar for ${monster.name} (${monster.id})`);
// console.log(`All available combos: ${this.getAvailableComboAbilities().map(c => c.name).join(', ')}`);
// console.log(`Combos being shown in action bar: ${availableCombos.map(c => c.name).join(', ')}`);
// console.log(`Combos filtered for this monster: ${availableCombos.filter(c => 
//   c.monsters.some(m => m.id === monster.id)
// ).map(c => c.name).join(', ')}`);
      
//       // Add each combo ability
//       availableCombos.forEach(combo => {
//         const partnerMonster = combo.monsters.find(m => m.id !== monster.id);
        
//         html += `
//           <button class="ability-btn combo" data-ability="${combo.id}" style="
//             display: flex;
//             align-items: center;
//             padding: 8px 12px;
//             border-radius: 8px;
//             cursor: pointer;
//             border: 1px solid ${combo.color}50;
//             background: ${combo.color}15;
//             color: ${combo.color};
//             transition: all 0.2s ease;
//             position: relative;
//             overflow: hidden;
//           ">
//             <span class="material-icons" style="margin-right: 8px; font-size: 18px;">${combo.icon || 'auto_awesome'}</span>
//             <div style="flex: 1; text-align: left;">
//               <div style="font-weight: 500;">${combo.name}</div>
//               <div style="font-size: 0.75rem; opacity: 0.9;">With: ${partnerMonster.name}</div>
//             </div>
//             ${combo.damage ? `
//               <div style="
//                 margin-left: 8px;
//                 padding: 2px 6px;
//                 border-radius: 12px;
//                 background: ${combo.color}30;
//                 font-size: 0.75rem;
//                 font-weight: 500;
//               ">${combo.damage}</div>
//             ` : ''}
            
//             <!-- Sparkle animation effect in background -->
//             <div class="sparkle-bg" style="
//               position: absolute;
//               top: 0;
//               left: 0;
//               right: 0;
//               bottom: 0;
//               background-image: radial-gradient(circle, ${combo.color}20 1px, transparent 1px);
//               background-size: 12px 12px;
//               pointer-events: none;
//               opacity: 0.5;
//             "></div>
//           </button>
//         `;
//       });
      
//       html += `</div>
      
//       <div class="regular-abilities-header" style="
//         display: flex;
//         align-items: center;
//         margin-bottom: 8px;
//         padding: 4px 8px;
//       ">
//         <span class="material-icons" style="margin-right: 8px; color: #9ca3af; font-size: 16px;">play_arrow</span>
//         <span style="color: #9ca3af; font-size: 0.9rem;">Regular Abilities</span>
//       </div>`;
//     }
  
//     // Add regular abilities
//     if (!monster.monsterAbilities || monster.monsterAbilities.length === 0) {
//       html += '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>No abilities available</em></div>';
//     } else {
//       html += `<div class="regular-abilities" style="display: flex; flex-wrap: wrap; gap: 8px;">`;
      
//       // Add abilities with icons
//       monster.monsterAbilities.forEach((ability) => {
//         // Determine icon based on ability type
//         let icon = 'sports_martial_arts'; // Default for attack
  
//         switch (ability.type) {
//           case 'attack':
//             icon = 'sports_martial_arts';
//             break;
//           case 'area':
//             icon = 'blur_circular';
//             break;
//           case 'buff':
//             icon = 'upgrade';
//             break;
//           case 'debuff':
//             icon = 'threat';
//             break;
//           case 'defense':
//             icon = 'shield';
//             break;
//           case 'healing':
//             icon = 'healing';
//             break;
//           case 'reaction':
//             icon = 'autorenew';
//             break;
//           case 'support':
//             icon = 'group';
//             break;
//         }
  
//         html += `
//           <button class="ability-btn ${ability.type}" data-ability="${ability.name.replace(/\s+/g, "_")}">
//             <span class="material-icons" style="margin-right: 8px; font-size: 18px;">${icon}</span>
//             <span>${ability.name}</span>
//             ${ability.damage ? `<span style="margin-left: 8px; color: #ef4444; font-size: 0.8em;">${ability.damage}</span>` : ''}
//           </button>
//         `;
//       });
      
//       html += `</div>`;
//     }
  
//     // Close abilities container
//     html += `</div>`;
  
//     // Add utility buttons
//     html += `
//       <div class="utility-buttons">
//         <button class="utility-btn use-item-btn">
//           <span class="material-icons" style="margin-right: 8px; font-size: 18px;">inventory_2</span>
//           Use Item
//         </button>
//         <button class="utility-btn skip-turn-btn">
//           <span class="material-icons" style="margin-right: 8px; font-size: 18px;">skip_next</span>
//           Skip Turn
//         </button>
//       </div>
//     `;
  
//     return html;
//   }

renderActionBar(monster) {
  if (!monster || monster.currentHP <= 0) {
    return '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>This monster is defeated</em></div>';
  }

  let html = `<div class="abilities-container">`;

  // Check if it's a player monster and if we should show combo abilities
  const isPlayerMonster = this.playerParty.some(m => m.id === monster.id);

  // Get all available combos
  const allAvailableCombos = this.getAvailableComboAbilities();
  
  // Filter for just this monster's combos
  const availableCombos = allAvailableCombos.filter(combo => 
    combo.monsters.some(m => m.id === monster.id)
  );
  
  // Show combo abilities if available
  if (isPlayerMonster && availableCombos.length > 0) {
    html += `<div class="combo-abilities-header" style="
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      padding: 4px 8px;
      background: rgba(255, 215, 0, 0.1);
      border-radius: 8px;
    ">
      <span class="material-icons" style="margin-right: 8px; color:rgb(231, 24, 24);">auto_awesome</span>
      <span style="color:rgb(252, 127, 77); font-weight: 500;">Combo Abilities</span>
    </div>
    
    <div class="combo-abilities" style="
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    ">`;
    
    // Add each combo ability
    availableCombos.forEach(combo => {
      const partnerMonster = combo.monsters.find(m => m.id !== monster.id);
      
      html += `
        <button class="ability-btn combo" data-ability="${combo.id}" style="
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid ${combo.color}50;
          background: ${combo.color}15;
          color: ${combo.color};
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        ">
          <span class="material-icons" style="margin-right: 8px; font-size: 18px;">${combo.icon || 'auto_awesome'}</span>
          <div style="flex: 1; text-align: left;">
            <div style="font-weight: 500;">${combo.name}</div>
            <div style="font-size: 0.75rem; opacity: 0.9;">With: ${partnerMonster.name}</div>
          </div>
          ${combo.damage ? `
            <div style="
              margin-left: 8px;
              padding: 2px 6px;
              border-radius: 12px;
              background: ${combo.color}30;
              font-size: 0.75rem;
              font-weight: 500;
            ">${combo.damage}</div>
          ` : ''}
          
          <!-- Sparkle animation effect in background -->
          <div class="sparkle-bg" style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: radial-gradient(circle, ${combo.color}20 1px, transparent 1px);
            background-size: 12px 12px;
            pointer-events: none;
            opacity: 0.5;
          "></div>
        </button>
      `;
    });
    
    html += `</div>
    
    <div class="regular-abilities-header" style="
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      padding: 4px 8px;
    ">
      <span class="material-icons" style="margin-right: 8px; color: #9ca3af; font-size: 16px;">play_arrow</span>
      <span style="color: #9ca3af; font-size: 0.9rem;">Regular Abilities</span>
    </div>`;
  }

  // Add regular abilities
  if (!monster.monsterAbilities || monster.monsterAbilities.length === 0) {
    html += '<div style="text-align: center; color: rgba(255, 255, 255, 0.7);"><em>No abilities available</em></div>';
  } else {
    html += `<div class="regular-abilities" style="display: flex; flex-wrap: wrap; gap: 8px;">`;
    
    // Add abilities with icons
    monster.monsterAbilities.forEach((ability) => {
      // Determine icon based on ability type
      let icon = 'sports_martial_arts'; // Default for attack

      switch (ability.type) {
        case 'attack':
          icon = 'sports_martial_arts';
          break;
        case 'area':
          icon = 'blur_circular';
          break;
        case 'buff':
          icon = 'upgrade';
          break;
        case 'debuff':
          icon = 'threat';
          break;
        case 'defense':
          icon = 'shield';
          break;
        case 'healing':
          icon = 'healing';
          break;
        case 'reaction':
          icon = 'autorenew';
          break;
        case 'support':
          icon = 'group';
          break;
      }

      html += `
        <button class="ability-btn ${ability.type}" data-ability="${ability.name.replace(/\s+/g, "_")}">
          <span class="material-icons" style="margin-right: 8px; font-size: 18px;">${icon}</span>
          <span>${ability.name}</span>
          ${ability.damage ? `<span style="margin-left: 8px; color: #ef4444; font-size: 0.8em;">${ability.damage}</span>` : ''}
        </button>
      `;
    });
    
    html += `</div>`;
  }

  // Close abilities container
  html += `</div>`;

  // Add utility buttons
  html += `
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
    const skipBtn = this.dialogContainer.querySelector(".skip-turn-btn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        this.addLogEntry(`${this.getCurrentMonster().name} skips their turn.`);
        this.nextTurn();
      });
    }


    const abilityBtns = this.dialogContainer.querySelectorAll(".ability-btn");
    abilityBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const abilityName = e.currentTarget
          .getAttribute("data-ability")
          .replace(/_/g, " ");
        this.useMonsterAbility(abilityName);
      });
    });

    // Use item button
    const itemBtn = this.dialogContainer.querySelector(".use-item-btn");
    if (itemBtn) {
      itemBtn.addEventListener("click", () => {
        alert("Item usage not implemented yet");
      });
    }
  }

  // Show dialog when player has no monsters in party
  showNeedMonstersDialog() {
    const dialog = document.createElement("sl-dialog");
    dialog.label = "No Active Monsters";

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
    dialog.addEventListener("sl-after-show", () => {
      dialog
        .querySelector(".manage-party-btn")
        .addEventListener("click", () => {
          dialog.hide();
          this.partyManager.showPartyManager();
        });

      dialog.querySelector(".close-btn").addEventListener("click", () => {
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
    if (side === "player") {
      // Update UI to show it's player's turn
      this.updateActionBar(monster);
      return true;
    }

    // If it's enemy's turn, process AI
    if (side === "enemy") {
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
      if (!currentCombatant || currentCombatant.side !== "enemy") return;

      const monster = currentCombatant.monster;

      // Simple AI: select random ability and random target
      if (monster.monsterAbilities && monster.monsterAbilities.length > 0) {
        // Choose random ability
        const randomAbilityIndex = Math.floor(
          Math.random() * monster.monsterAbilities.length
        );
        const ability = monster.monsterAbilities[randomAbilityIndex];

        // Find valid targets (non-defeated player monsters)
        const validTargets = this.playerParty.filter((m) => m.currentHP > 0);

        if (validTargets.length > 0) {
          // Select random target
          const randomTargetIndex = Math.floor(
            Math.random() * validTargets.length
          );
          const target = validTargets[randomTargetIndex];

          // Use ability
          this.resolveAbility(monster, ability, target);
        } else {
          this.addLogEntry(`${monster.name} has no valid targets.`);
        }
      } else {
        this.addLogEntry(
          `${monster.name} has no abilities and skips their turn.`
        );
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
      const roundDisplay = this.dialogContainer.querySelector(
        ".combat-header span:last-child"
      );
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
      this.addLogEntry(
        `${currentCombatant.monster.name} is defeated and cannot act.`
      );
      // Call nextTurn again to skip to the next combatant
      this.nextTurn();
      return;
    }

    // Process the turn for a non-defeated monster
    this.addLogEntry(`${currentCombatant.monster.name}'s turn.`);

    // Update action bar for player turn
    if (currentCombatant.side === "player") {
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
    const allPlayerDefeated = this.playerParty.every(
      (monster) => monster.currentHP <= 0
    );
    if (allPlayerDefeated) {
      this.endCombat("defeat");
      return true;
    }

    // Check if all enemy monsters are defeated
    const allEnemiesDefeated = this.enemyParty.every(
      (monster) => monster.currentHP <= 0
    );
    if (allEnemiesDefeated) {
      this.endCombat("victory");
      return true;
    }

    return false;
  }

  // End combat and show results
  endCombat(result) {
    // Set combat state
    this.inCombat = false;

    // Create result overlay
    const resultOverlay = document.createElement("div");
    resultOverlay.className = "combat-result-overlay";
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
    const resultCard = document.createElement("div");
    resultCard.className = "combat-result-card";
    resultCard.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    // Set content based on result
    if (result === "victory") {
      resultCard.innerHTML = `
          <span class="material-icons" style="font-size: 64px; color: #FFD700; margin-bottom: 16px;">emoji_events</span>
          <h2 style="margin: 0 0 16px 0; color: #4CAF50;">Victory!</h2>
          <p style="margin-bottom: 24px;">Your party has defeated all enemies.</p>
          
          <div class="rewards" style="margin-bottom: 24px; background:rgb(116, 8, 218); padding: 16px; border-radius: 8px;">
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
      this.playerParty.forEach((monster) => {
        if (monster.currentHP > 0) {
          // Only award XP to surviving monsters
          this.partyManager.awardExperience(monster.id, 100);
        }
      });

      // Store enemy data for recruitment opportunity
      if (this.enemyParty.length > 0) {
        // Get a random enemy that wasn't defeated (or first one if all defeated)
        const recruitableEnemies = this.enemyParty.filter(
          (enemy) => enemy.currentHP > 0
        );
        const targetEnemy =
          recruitableEnemies.length > 0
            ? recruitableEnemies[0]
            : this.enemyParty[0];

        // Store for potential recruitment
        window.lastDefeatedEnemy = targetEnemy;

        // Show recruitment hint
        const hintElement = document.createElement("div");
        hintElement.style.cssText = `
            margin-top: 12px;
            font-size: 0.9em;
            color: #666;
            text-align: center;
          `;
        hintElement.innerHTML =
          "Press <strong>E</strong> after closing to attempt recruitment";
        resultCard.appendChild(hintElement);
      }
    } else if (result === "defeat") {
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
    resultCard.querySelector(".continue-btn").addEventListener("click", () => {
      this.closeCombat();
    });
  }

  closeCombat() {
    // Animate out
    this.combatOverlay.style.opacity = "0";
    this.dialogContainer.style.transform = "scale(0.95)";

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
          if (e.key.toLowerCase() === "e") {
            // Remove this listener to prevent multiple dialogs
            document.removeEventListener("keydown", handleRecruitKey);

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
          document.addEventListener("keydown", handleRecruitKey);

          // Show recruitment prompt
          const promptElement = document.createElement("div");
          promptElement.className = "recruitment-prompt";
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
          promptElement.innerHTML =
            "Press <strong>E</strong> to attempt recruitment";
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
      this.partyManager.party.active.forEach((monster) => {
        monster.currentHP = monster.maxHP;
      });

      // Save party state
      this.partyManager.saveParty();

      console.log("Combat ended and state reset");
    }, 300);
  }

  /**
   * Combat Action Methods
   */



getWeaponDamage(weaponName) {
  // Simple roll method - returns a random number between 1 and sides
  const roll = (sides) => Math.floor(Math.random() * sides) + 1;
  
  // Default for unarmed/missing weapon
  if (!weaponName) {
    const damage = roll(4); // 1d4 unarmed attack
    console.log(`Unarmed attack rolled 1d4: ${damage}`);
    return damage;
  }
  
  const name = weaponName.toLowerCase();
  let damage = 0;
  let diceNotation = "";
  
  // Determine weapon type and roll appropriate dice
  if (name.includes('dagger') || name.includes('knife')) {
    // 1d4 damage
    damage = roll(4);
    diceNotation = "1d4";
  } else if (name.includes('short') && name.includes('sword') || name.includes('shortsword')) {
    // 1d6 damage
    damage = roll(6);
    diceNotation = "1d6";
  } else if (name.includes('sword') || name.includes('saber') || name.includes('rapier')) {
    // 1d8 damage
    damage = roll(8);
    diceNotation = "1d8";
  } else if (name.includes('axe') || name.includes('battleaxe')) {
    // 1d10 damage
    damage = roll(10);
    diceNotation = "1d10";
  } else if (name.includes('great') && (name.includes('sword') || name.includes('axe'))) {
    // 2d6 damage for greatsword/greataxe
    damage = roll(6) + roll(6);
    diceNotation = "2d6";
  } else if (name.includes('mace') || name.includes('club')) {
    // 1d6 damage
    damage = roll(6);
    diceNotation = "1d6";
  } else if (name.includes('hammer') || name.includes('warhammer')) {
    // 1d8 damage
    damage = roll(8);
    diceNotation = "1d8";
  } else if (name.includes('maul') || name.includes('great hammer')) {
    // 2d6 damage
    damage = roll(6) + roll(6);
    diceNotation = "2d6";
  } else if (name.includes('spear')) {
    // 1d6 damage
    damage = roll(6);
    diceNotation = "1d6";
  } else {
    // Default 1d6 for unknown weapons
    damage = roll(6);
    diceNotation = "1d6";
  }
  
  console.log(`Weapon "${weaponName}" rolled ${diceNotation}: ${damage}`);
  return damage;
}

// Add a method to get just the dice notation for display purposes
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


// Add this function to CombatSystem.js
parseComboAbilityId(abilityName) {
  // Check for both potential formats
  if (abilityName.startsWith('combo_')) {
    // Already in the correct format like "combo_123_456"
    const parts = abilityName.split('_');
    if (parts.length >= 3) {
      return {
        isCombo: true,
        monster1Id: parts[1],
        monster2Id: parts[2]
      };
    }
  } else if (abilityName.includes('combo monster')) {
    // Format like "combo monster 123 monster 456"
    const regex = /combo monster (\d+) monster (\d+)/;
    const match = abilityName.match(regex);
    if (match && match.length >= 3) {
      return {
        isCombo: true,
        monster1Id: match[1],
        monster2Id: match[2]
      };
    }
  }
  
  return { isCombo: false };
}

ensureMonsterIdFormat(id) {
  // Check if the ID already has the 'monster_' prefix
  if (typeof id === 'string' && !id.includes('monster_')) {
    return `monster_${id}`;
  }
  return id; // Return as is if it already has the prefix or isn't a string
}

// Then add this method to handle combo ID formatting
formatComboId(comboInfo) {
  // Add proper prefix to monster IDs
  const monster1Id = this.ensureMonsterIdFormat(comboInfo.monster1Id);
  const monster2Id = this.ensureMonsterIdFormat(comboInfo.monster2Id);
  
  // Return properly formatted combo ID
  return `combo_${monster1Id}_${monster2Id}`;
}


  // Use a monster's ability
  useMonsterAbility(abilityName) {

      console.log(`Attempting to use ability: ${abilityName}`);
      const currentMonster = this.getCurrentMonster();
      if (!currentMonster) {
        console.error("No active monster found for ability use");
        return false;
      }
    
      // Check if this is a combo ability (combo IDs start with "combo_")
      // if (abilityName.startsWith('combo_')) {
      //   return this.useComboAbility(abilityName, currentMonster);
      // }

      const comboInfo = this.parseComboAbilityId(abilityName);
      if (comboInfo.isCombo) {
        // Convert to the standard format for consistency
        const standardComboId = this.formatComboId(comboInfo);
        return this.useComboAbility(standardComboId, currentMonster);
      }
    

    // // Find the ability
    const ability = currentMonster.monsterAbilities.find(
      (a) => a.name === abilityName
    );
    if (!ability) {
      console.error(
        `Ability "${abilityName}" not found for ${currentMonster.name}`
      );
      return false;
    }

    console.log(`Found ability: ${ability.name}, type: ${ability.type}`);

    // Show target selection for attack abilities
    if (ability.type === "attack" || ability.type === "debuff") {
      console.log("Initiating target selection for attack/debuff ability");
      this.markTargetableEnemies(currentMonster, ability);
    }
    // For self-buff abilities, apply directly
    else if (ability.type === "buff" || ability.type === "defense") {
      console.log("Applying self-buff ability directly");
      this.resolveAbility(currentMonster, ability, currentMonster);
      this.nextTurn();
    }
    // For area abilities, apply to all valid targets
    else if (ability.type === "area") {
      console.log("Processing area effect ability");
      // Get all valid enemy targets
      const targets = this.enemyParty.filter(
        (monster) => monster.currentHP > 0
      );
      if (targets.length > 0) {
        let totalDamage = 0;

        // Process each target
        targets.forEach((target) => {
          const damage = this.calculateAbilityDamage(
            ability,
            currentMonster,
            target
          );
          this.applyDamage(target, damage, currentMonster);
          totalDamage += damage;
        });

        // Log the area attack
        this.addLogEntry(
          `${currentMonster.name} uses ${ability.name}, dealing ${totalDamage} total damage to ${targets.length} targets.`
        );

        // Move to next turn
        this.nextTurn();
      } else {
        this.addLogEntry(
          `${currentMonster.name} has no valid targets for ${ability.name}.`
        );
      }
    }
    // For healing abilities, show friendly target selection
    else if (ability.type === "healing") {
      console.log("Initiating friendly target selection for healing ability");
      this.showFriendlyTargetSelection(currentMonster, ability);
    } else {
      // For other ability types
      console.log(`Using generic ability type: ${ability.type}`);
      this.addLogEntry(`${currentMonster.name} uses ${ability.name}.`);
      this.nextTurn();
    }

    return true;
  }

  applyRelationshipBonuses(attacker, target) {
    // First, check if attacker exists and has required properties
    if (
      !attacker ||
      !target ||
      !this.partyManager ||
      !this.partyManager.relationshipMap
    ) {
      return 0; // No relationship system active or missing parameters
    }

    // IMPORTANT: Only apply relationship bonuses for player monsters, not enemies
    // Find which side the attacker is on by checking the initiative order
    const attackerEntry = this.initiativeOrder.find(
      (combatant) => combatant.monster.id === attacker.id
    );

    // If attacker isn't found or is on enemy side, return 0 (no bonus)
    if (!attackerEntry || attackerEntry.side !== "player") {
      return 0; // No relationship bonuses for enemies
    }

    let bonus = 0;

    // Only proceed if this is a player monster
    // Check relationships with other active player monsters
    const activePlayerMonsters = this.initiativeOrder
      .filter(
        (combatant) =>
          combatant.side === "player" && combatant.monster.id !== attacker.id
      )
      .map((combatant) => combatant.monster);

    // Apply bonuses from all allies with relationships
    activePlayerMonsters.forEach((ally) => {
      bonus += this.partyManager.getCombatModifier(attacker.id, ally.id);
    });

    // If bonus exists, log it and create visual effect
    if (bonus !== 0) {
      this.addLogEntry(
        `${attacker.name} ${
          bonus > 0 ? "strengthened" : "hindered"
        } by party relationships (${bonus > 0 ? "+" : ""}${bonus})`
      );

      // Show relationship effect visualization
      const attackerCard = this.dialogContainer.querySelector(
        `.combat-monster[data-monster-id="${attacker.id}"]`
      );
      if (attackerCard) {
        const effect = document.createElement("div");
        effect.className = "relationship-effect";
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
        <span class="material-icons" style="font-size: 36px; color: ${
          bonus > 0 ? "#ff6b6b" : "#6b7280"
        };">
          ${bonus > 0 ? "favorite" : "heart_broken"}
        </span>
      `;

        attackerCard.style.position = "relative";
        attackerCard.appendChild(effect);

        // Remove effect after animation
        setTimeout(() => effect.remove(), 1000);
      }
    }

    return bonus;
  }

  markTargetableEnemies(monster, ability) {
    console.log(
      `Setting up targeting for ${monster.name} using ${ability.name}`
    );
  
    // Find all enemy cards
    const enemyCards = Array.from(
      this.dialogContainer.querySelectorAll(".combat-monster.enemy")
    );
    console.log(`Found ${enemyCards.length} enemy cards for targeting`);
  
    // Find viable targets (enemies with HP > 0)
    const viableTargets = [];
  
    enemyCards.forEach((card) => {
      const enemyId = card.getAttribute("data-monster-id");
      const enemy = this.enemyParty.find((e) => e.id === enemyId);
  
      if (enemy && enemy.currentHP > 0) {
        viableTargets.push({ card, enemy });
        console.log(
          `Viable target found: ${enemy.name} (HP: ${enemy.currentHP}/${enemy.maxHP})`
        );
      }
    });
  
    console.log(`Total viable targets: ${viableTargets.length}`);
  
    // If there's only one viable target, auto-target it
    if (viableTargets.length === 1) {
      const { enemy, card } = viableTargets[0];
      console.log(`Auto-targeting single enemy: ${enemy.name}`);
  
      // Create a quick highlight effect
      card.classList.add("auto-targeted");
  
      // Create a temporary message
      const battleScene = this.dialogContainer.querySelector(".battle-scene");
      const autoMessage = document.createElement("div");
      autoMessage.className = "battle-notification fade-in";
      autoMessage.textContent = `Auto-targeting ${enemy.name}`;
      autoMessage.style.backgroundColor = "rgba(239, 68, 68, 0.8)";
      battleScene.appendChild(autoMessage);
  
      // Remove the message and execute the ability after a short delay
      setTimeout(() => {
        autoMessage.classList.remove("fade-in");
        autoMessage.style.opacity = "0";
  
        console.log(`Resolving ability ${ability.name} against ${enemy.name}`);
        this.resolveAbility(monster, ability, enemy);
  
        // Move to next turn
        this.nextTurn();
  
        // Clean up
        setTimeout(() => {
          autoMessage.remove();
          card.classList.remove("auto-targeted");
        }, 300);
      }, 800);
  
      return;
    }
  
    // If we have multiple targets, proceed with manual targeting
    console.log(
      `Setting up manual targeting for ${viableTargets.length} enemies`
    );
  
    viableTargets.forEach(({ card, enemy }) => {
      // Add targetable class and hint
      card.classList.add("targetable");
  
      // Add targeting hint
      const hint = document.createElement("div");
      hint.className = "targeting-hint";
      hint.textContent = `Click to target with ${ability.name}`;
      hint.style.position = "absolute";
      hint.style.top = "-30px";
      hint.style.left = "50%";
      hint.style.transform = "translateX(-50%)";
      hint.style.background = "rgba(0, 0, 0, 0.7)";
      hint.style.color = "white";
      hint.style.padding = "4px 8px";
      hint.style.borderRadius = "4px";
      hint.style.fontSize = "0.8em";
      hint.style.whiteSpace = "nowrap";
      hint.style.pointerEvents = "none";
      hint.style.opacity = "0";
      hint.style.transition = "opacity 0.3s ease";
      card.appendChild(hint);
      
      // Show hint on hover
      card.addEventListener('mouseenter', () => {
        hint.style.opacity = "1";
      });
      
      card.addEventListener('mouseleave', () => {
        hint.style.opacity = "0";
      });
  
      // Create new click handler
      const targetClickHandler = () => {
        console.log(`Target selected: ${enemy.name}`);
  
        // Remove targeting from all cards
        enemyCards.forEach((c) => {
          c.classList.remove("targetable");
          const h = c.querySelector(".targeting-hint");
          if (h) h.remove();
  
          // Important: Remove all previous click handlers
          c.removeEventListener("click", targetClickHandler);
        });
  
        // Execute ability on the target
        this.resolveAbility(monster, ability, enemy);
  
        // Move to next turn
        this.nextTurn();
  
        // Remove battle notification if present
        const notification = this.dialogContainer.querySelector(
          ".battle-notification"
        );
        if (notification) notification.remove();
      };
  
      // Add click handler
      card.addEventListener("click", targetClickHandler);
    });
  
    // Add the targeting instruction message
    const battleScene = this.dialogContainer.querySelector(".battle-scene");
    const indicator = document.createElement("div");
    indicator.className = "battle-notification fade-in";
    indicator.textContent = "Select an enemy to target";
    indicator.style.backgroundColor = "rgba(239, 68, 68, 0.8)";
    battleScene.appendChild(indicator);
  
    // Remove after a few seconds to avoid clutter
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.classList.remove("fade-in");
        indicator.style.opacity = "0";
        setTimeout(() => {
          if (indicator.parentNode) indicator.remove();
        }, 300);
      }
    }, 3000);
  }



  showTargetSelection(monster, ability) {
    // Get valid targets (non-defeated enemies)
    const validTargets = this.enemyParty.filter((enemy) => enemy.currentHP > 0);

    if (validTargets.length === 0) {
      this.addLogEntry(
        `${monster.name} has no valid targets for ${ability.name}.`
      );
      return;
    }

    // Create targeting overlay
    const targetingOverlay = document.createElement("div");
    targetingOverlay.className = "targeting-overlay";
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
    const instructions = document.createElement("div");
    instructions.className = "targeting-instructions";
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
    const battleScene = this.dialogContainer.querySelector(".battle-scene");
    battleScene.appendChild(targetingOverlay);

    // Highlight enemy monsters as targetable
    const enemyCards = this.dialogContainer.querySelectorAll(
      ".combat-monster.enemy"
    );
    enemyCards.forEach((card) => {
      const enemyId = card.getAttribute("data-monster-id");
      const enemy = this.enemyParty.find((e) => e.id === enemyId);

      if (enemy && enemy.currentHP > 0) {
        card.style.cursor = "pointer";
        card.style.boxShadow = "0 0 10px rgba(244, 67, 54, 0.7)";
        card.style.transform = "scale(1.05)";

        // Add click handler
        card.addEventListener("click", () => {
          // Remove overlay
          targetingOverlay.remove();

          // Reset styling
          enemyCards.forEach((c) => {
            c.style.cursor = "";
            c.style.boxShadow = "";
            c.style.transform = "";
          });

          // Resolve the ability
          this.resolveAbility(monster, ability, enemy);

          // Move to next turn
          this.nextTurn();
        });
      }
    });

    // Add cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-targeting-btn";
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

    cancelBtn.addEventListener("click", () => {
      // Remove overlay
      targetingOverlay.remove();

      // Reset styling
      enemyCards.forEach((card) => {
        card.style.cursor = "";
        card.style.boxShadow = "";
        card.style.transform = "";
      });
    });

    targetingOverlay.appendChild(cancelBtn);
  }

  // Show friendly target selection overlay
  showFriendlyTargetSelection(monster, ability) {
    // Get valid targets (non-defeated player monsters)
    const validTargets = this.playerParty.filter((m) => m.currentHP > 0);

    if (validTargets.length === 0) {
      this.addLogEntry(
        `${monster.name} has no valid targets for ${ability.name}.`
      );
      return;
    }

    // Create targeting overlay
    const targetingOverlay = document.createElement("div");
    targetingOverlay.className = "targeting-overlay";
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
    const instructions = document.createElement("div");
    instructions.className = "targeting-instructions";
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
    const battleScene = this.dialogContainer.querySelector(".battle-scene");
    battleScene.appendChild(targetingOverlay);

    // Highlight player monsters as targetable
    const playerCards = this.dialogContainer.querySelectorAll(
      ".combat-monster.player"
    );
    playerCards.forEach((card) => {
      const playerId = card.getAttribute("data-monster-id");
      const playerMonster = this.playerParty.find((p) => p.id === playerId);

      if (playerMonster && playerMonster.currentHP > 0) {
        card.style.cursor = "pointer";
        card.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.7)";
        card.style.transform = "scale(1.05)";

        // Add click handler
        card.addEventListener("click", () => {
          // Remove overlay
          targetingOverlay.remove();

          // Reset styling
          playerCards.forEach((c) => {
            c.style.cursor = "";
            c.style.boxShadow = "";
            c.style.transform = "";
          });

          // Resolve the ability
          this.resolveHealingAbility(monster, ability, playerMonster);

          // Move to next turn
          this.nextTurn();
        });
      }
    });

    // Add cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-targeting-btn";
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

    cancelBtn.addEventListener("click", () => {
      // Remove overlay
      targetingOverlay.remove();

      // Reset styling
      playerCards.forEach((card) => {
        card.style.cursor = "";
        card.style.boxShadow = "";
        card.style.transform = "";
      });
    });

    targetingOverlay.appendChild(cancelBtn);
  }

  // Updated resolveAbility method
  resolveAbility(monster, ability, target) {
    console.log(`${monster.name} uses ${ability.name} on ${target.name}`);

    // Log the ability use
    this.addLogEntry(`${monster.name} uses ${ability.name} on ${target.name}.`);

    // Process based on ability type
    switch (ability.type) {
      case "attack":
        console.log(`Processing attack ability: ${ability.name}`);
        // Calculate and apply damage
        const damage = this.calculateAbilityDamage(ability, monster, target);
        console.log(`Calculated damage: ${damage}`);
        this.applyDamage(target, damage, monster);
        break;

      case "buff":
        // Apply buff to monster
        console.log(`Applying buff: ${ability.name}`);
        this.addLogEntry(`${monster.name} gains a beneficial effect.`);

        // Here you could implement actual stat buffs
        // For example: monster.tempStatBonus = { type: 'ac', value: 2, duration: 3 };
        break;

      case "debuff":
        // Apply debuff to target
        console.log(`Applying debuff: ${ability.name}`);
        this.addLogEntry(`${target.name} is afflicted with a negative effect.`);

        // Here you could implement actual debuffs
        // For example: target.tempStatPenalty = { type: 'ac', value: -2, duration: 3 };
        break;

      default:
        console.log(`Using generic ability type: ${ability.type}`);
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
    this.addLogEntry(
      `${monster.name} uses ${ability.name} on ${target.name}, healing for ${actualHealing} HP.`
    );

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
    if (damageFormula.includes("d")) {
      const [dice, modifier] = damageFormula.split("+");
      const [numDice, dieSize] = dice.split("d").map((n) => parseInt(n));

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
  
    // If this is an attack ability and attacker has a weapon, add weapon damage
    if (attacker && ability.type === "attack") {
      const weapon = attacker.equipment?.weapon;
      
      if (weapon) {
        // Get weapon damage directly
        const weaponDamage = this.getWeaponDamage(weapon.name);
        console.log(`Weapon ${weapon.name} dealt ${weaponDamage} damage`);
        damage += weaponDamage;
      }
    }
  
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
    if (healingFormula.includes("d")) {
      const [dice, modifier] = healingFormula.split("+");
      const [numDice, dieSize] = dice.split("d").map((n) => parseInt(n));

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

  // Update applyDamage to use the visual log
  applyDamage(target, damage, attacker, isCritical = false) {
    // Store original HP for log
    const originalHP = target.currentHP;

    // Apply damage
    target.currentHP = Math.max(0, target.currentHP - damage);

    // Log using the visual system
    if (attacker) {
      this.addVisualLogEntry({
        type: "damage",
        attacker: attacker,
        target: target,
        damage: damage,
        isCritical: isCritical
      });
    } else {
      // Fallback to text log for damage without a clear source
      this.addLogEntry(
        `${target.name} takes ${damage} damage${
          target.currentHP <= 0 ? " and is defeated!" : "."
        }`
      );
    }

    // Update UI to reflect changes
    this.updateCombatDisplay();

    // Check if this was an enemy that just got defeated
    if (target.currentHP <= 0 && target.currentHP !== originalHP) {
      // Enemy was just defeated
      const isEnemy = this.enemyParty.some((m) => m.id === target.id);
      if (isEnemy) {
        // Refresh enemy area
        this.updateEnemyArea();
      }
    }

    // Check if combat should end
    this.checkCombatEnd();
  }

  // Similarly for healing
  resolveHealingAbility(monster, ability, target) {
    // Calculate healing amount
    const healing = this.calculateHealingAmount(ability);

    // Apply healing
    const originalHP = target.currentHP;
    target.currentHP = Math.min(target.maxHP, target.currentHP + healing);
    const actualHealing = target.currentHP - originalHP;

    // Log using visual system
    this.addVisualLogEntry({
      type: "heal",
      healer: monster,
      target: target,
      amount: actualHealing
    });

    // Update UI
    this.updateCombatDisplay();
  }

  /**
   * UI Update Methods
   */

  // Update action bar based on current monster
  updateActionBar(monster) {
    const actionBar = this.dialogContainer.querySelector(".action-bar");
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
    const initiativeList =
      this.dialogContainer.querySelector(".initiative-list");
    if (!initiativeList) return;

    initiativeList.innerHTML = this.renderInitiativeList();
  }

  updateCombatDisplay() {
    console.log("Updating combat display");
    
    // Update enemy display
    const enemyArea = this.dialogContainer.querySelector(".enemy-area");
    if (enemyArea) {
      // Clear existing content
      enemyArea.innerHTML = '';
      
      // Add active enemies directly to maintain styling
      this.enemyParty.forEach((monster, index) => {
        if (monster.currentHP > 0) {
          const monsterCard = this.createMonsterCard(monster, "enemy", index);
          enemyArea.appendChild(monsterCard);
        }
      });
      
      // Update class based on number of enemies
      const activeEnemies = this.enemyParty.filter(m => m.currentHP > 0);
      if (activeEnemies.length === 1) {
        enemyArea.className = "enemy-area enemy-layout-single";
      } else if (activeEnemies.length === 2) {
        enemyArea.className = "enemy-area enemy-layout-duo";
      } else if (activeEnemies.length === 3) {
        enemyArea.className = "enemy-area enemy-layout-trio";
      } else if (activeEnemies.length >= 4) {
        enemyArea.className = "enemy-area enemy-layout-quad";
      }
    }
  
    // Update player display
    const playerArea = this.dialogContainer.querySelector(".player-area");
    if (playerArea) {
      // Clear existing content
      playerArea.innerHTML = '';
      
      // Add player monsters directly
      this.playerParty.forEach((monster, index) => {
        const monsterCard = this.createMonsterCard(monster, "player", index);
        playerArea.appendChild(monsterCard);
      });
    }
  
    // Update initiative display
    this.updateInitiativeTracker();
    
    // Update defeated enemies row
    this.updateDefeatedEnemiesRow();
  }
  

  // Add entry to combat log
  addLogEntry(message, isRoundHeader = false) {
    // Get log container
    const logEntries = this.dialogContainer.querySelector(".log-entries");
    if (!logEntries) return;

    // Create new entry
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.style.cssText = `
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
    ${
      isRoundHeader
        ? "font-weight: bold; background-color: #f5f5f5; padding: 4px;"
        : ""
    }
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
      console.log(
        "CombatSystem: Attempting to re-establish connection to monster database"
      );

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
        this.monsterDatabase =
          this.monsterManager.monsterDatabase ||
          this.monsterManager.loadDatabase();
        console.log("CombatSystem: Created new connection");
      }
    }

    console.log(
      "CombatSystem: Connection status - MonsterManager:",
      !!this.monsterManager,
      "MonsterDatabase:",
      !!this.monsterDatabase
    );

    return !!this.monsterDatabase;
  }

  async ensureDatabaseConnection() {
    console.log("CombatSystem: Checking database connection");

    // If we don't have a monster database, try to get it
    if (
      !this.monsterDatabase ||
      (this.monsterDatabase.monsters &&
        Object.keys(this.monsterDatabase.monsters).length === 0)
    ) {
      console.log(
        "CombatSystem: Database missing or empty, attempting to reconnect"
      );

      // Try connections in order of likelihood
      if (this.partyManager && this.partyManager.monsterManager) {
        console.log("CombatSystem: Connecting via PartyManager");
        this.monsterManager = this.partyManager.monsterManager;
        this.monsterDatabase =
          this.monsterManager.monsterDatabase ||
          (await this.monsterManager.loadDatabase());
      } else if (this.resourceManager && this.resourceManager.monsterManager) {
        console.log("CombatSystem: Connecting via ResourceManager");
        this.monsterManager = this.resourceManager.monsterManager;
        this.monsterDatabase =
          this.monsterManager.monsterDatabase ||
          (await this.monsterManager.loadDatabase());
      } else {
        console.log("CombatSystem: Creating new connection");
        this.monsterManager = new MonsterManager(this);
        this.monsterDatabase = await this.monsterManager.loadDatabase();
      }
    }

    const hasConnection =
      this.monsterDatabase &&
      this.monsterDatabase.monsters &&
      Object.keys(this.monsterDatabase.monsters).length > 0;

    console.log(`CombatSystem: Database connection ${
      hasConnection ? "successful" : "failed"
    }, 
               Found ${
                 hasConnection
                   ? Object.keys(this.monsterDatabase.monsters).length
                   : 0
               } monsters`);

    return hasConnection;
  }

  getEnemiesFromManager(targetCR, manager = null) {
    const mm = manager || this.monsterManager;
    console.log("========== DATABASE SEARCH START ==========");
    console.log(`Manager provided: ${!!manager}, Using: ${!!mm}`);

    if (!mm || !mm.monsterDatabase) {
      console.warn("No monster database available for enemy selection");
      console.log("MonsterManager:", mm);
      console.log("Database:", mm?.monsterDatabase);
      console.log("========== DATABASE SEARCH END (FAILED) ==========");
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
      console.log(
        "Sample monster from DB:",
        allMonsters.length > 0
          ? JSON.stringify(allMonsters[0].basic || allMonsters[0]).substring(
              0,
              100
            ) + "..."
          : "None"
      );

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
        if (typeof crValue === "string") {
          // Handle fractional CR values
          if (crValue.includes("/")) {
            const [numerator, denominator] = crValue.split("/").map(Number);
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

      console.log("Database search stats:");
      console.log(`- Monsters missing 'basic': ${noBasicCount}`);
      console.log(`- Monsters missing CR: ${noCRCount}`);
      console.log(`- Monsters with invalid CR: ${invalidCRCount}`);
      console.log(`- Monsters in CR range: ${inRangeCount}`);

      if (candidates.length > 0) {
        console.log(
          "Sample candidate monster:",
          JSON.stringify(candidates[0].basic || candidates[0]).substring(
            0,
            100
          ) + "..."
        );
      }

      console.log(
        `Found ${candidates.length} suitable enemies in CR range ${minCR} - ${maxCR}`
      );
    } catch (error) {
      console.error("Error searching monster database:", error);
    }

    console.log("========== DATABASE SEARCH END ==========");
    return candidates;
  }

  // Helper methods for CR conversion
  parseCR(cr) {
    if (typeof cr === "number") return cr;
    if (typeof cr !== "string") return 0;

    // Handle fractional CR values like "1/4"
    if (cr.includes("/")) {
      const [numerator, denominator] = cr.split("/").map(Number);
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

  async generateEnemyParty(playerParty) {
    console.log("========== ENEMY PARTY GENERATION START ==========");

    // Get player party strength metrics
    const partySize = playerParty.length;
    const averageLevel =
      playerParty.reduce((sum, monster) => sum + monster.level, 0) / partySize;
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

    console.log(
      `Generating enemy party with ${enemyCount} monsters for player party of ${partySize}`
    );

    // Calculate target CR
    const targetCR = averageLevel * 0.75;
    console.log(`Target CR: ${targetCR}`);

    // Ensure database connection before searching
    await this.ensureDatabaseConnection();

    // Try to get monsters from the database
    let potentialEnemies = [];

    try {
      // Make sure we have a connection
      if (this.monsterDatabase && this.monsterDatabase.monsters) {
        console.log("MonsterDatabase type:", typeof this.monsterDatabase);
        console.log(
          "MonsterDatabase has monsters property:",
          !!this.monsterDatabase.monsters
        );

        // Get all monsters from database
        let allMonsters = [];

        // MonsterManager's database is an object with a 'monsters' property (not a Map)
        if (this.monsterDatabase && this.monsterDatabase.monsters) {
          console.log("Accessing via monsterDatabase.monsters object");
          allMonsters = Object.values(this.monsterDatabase.monsters);
        }

        console.log(`Got ${allMonsters.length} total monsters from database`);

        // Filter by CR range - USE MORE FLEXIBLE RANGE
        const minCR = Math.max(0.125, targetCR * 0.5); // Minimum CR of 1/8
        const maxCR = Math.min(30, targetCR * 2); // More generous upper bound

        console.log(`Initial CR range: ${minCR} to ${maxCR}`);

        potentialEnemies = allMonsters.filter((monster) => {
          // Check if monster has basic data
          if (!monster.basic || !monster.basic.cr) return false;

          // Parse CR value
          let crValue = monster.basic.cr;
          if (typeof crValue === "string") {
            if (crValue.includes("/")) {
              const [num, denom] = crValue.split("/").map(Number);
              crValue = num / denom;
            } else {
              crValue = Number(crValue);
            }
          }

          // Include if in range
          return !isNaN(crValue) && crValue >= minCR && crValue <= maxCR;
        });

        console.log(
          `Found ${potentialEnemies.length} monsters within CR range ${minCR} to ${maxCR}`
        );

        // If we find few monsters, retry with even wider range
        if (potentialEnemies.length < enemyCount) {
          console.log("Too few monsters found, expanding CR range further");
          const widerMinCR = Math.max(0.125, targetCR * 0.25); // Very low minimum
          const widerMaxCR = Math.min(30, targetCR * 3); // Very high maximum

          console.log(`Expanded CR range: ${widerMinCR} to ${widerMaxCR}`);

          potentialEnemies = allMonsters.filter((monster) => {
            if (!monster.basic || !monster.basic.cr) return false;

            // Parse CR value
            let crValue = monster.basic.cr;
            if (typeof crValue === "string") {
              if (crValue.includes("/")) {
                const [num, denom] = crValue.split("/").map(Number);
                crValue = num / denom;
              } else {
                crValue = Number(crValue);
              }
            }

            return (
              !isNaN(crValue) && crValue >= widerMinCR && crValue <= widerMaxCR
            );
          });

          console.log(
            `With expanded range ${widerMinCR} to ${widerMaxCR}, found ${potentialEnemies.length} monsters`
          );
        }

        // Log found monster CRs to help debug
        if (potentialEnemies.length > 0) {
          console.log("Found monsters with following CRs:");
          const crValues = potentialEnemies.map((m) => m.basic.cr);
          const uniqueCRs = [...new Set(crValues)].sort((a, b) => {
            // Convert both to numbers for comparison
            const aNum = a.includes("/")
              ? Number(a.split("/")[0]) / Number(a.split("/")[1])
              : Number(a);
            const bNum = b.includes("/")
              ? Number(b.split("/")[0]) / Number(b.split("/")[1])
              : Number(b);
            return aNum - bNum;
          });
          console.log(uniqueCRs.join(", "));
        }

        // If still no monsters, grab a random selection
        if (potentialEnemies.length < enemyCount && allMonsters.length > 0) {
          console.log(
            "Still insufficient monsters, selecting random monsters from full database"
          );
          // Just randomly select from all available monsters
          potentialEnemies = [...allMonsters]
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(10, allMonsters.length));
          console.log(
            `Selected ${potentialEnemies.length} random monsters from full database`
          );
        }
      }
    } catch (error) {
      console.error("Error accessing monster database:", error);
    }

    // If we don't have enough monsters, use default enemies
    if (!potentialEnemies || potentialEnemies.length < enemyCount) {
      console.log(
        "Using default enemy templates - not enough monsters in database"
      );
      potentialEnemies = this.generateDefaultEnemies(targetCR);
      console.log(`Generated ${potentialEnemies.length} default enemies`);
    }

    // Select random enemies from potential pool
    const selectedEnemies = [];
    for (let i = 0; i < enemyCount; i++) {
      if (potentialEnemies.length > 0) {
        const randomIndex = Math.floor(Math.random() * potentialEnemies.length);
        const enemy = potentialEnemies.splice(randomIndex, 1)[0];

        console.log(
          `Selected enemy ${i + 1}: ${
            enemy.basic ? enemy.basic.name : enemy.name
          }`
        );

        // Prepare enemy for combat
        const combatEnemy = this.prepareEnemyForCombat(enemy, targetCR);
        selectedEnemies.push(combatEnemy);
      }
    }

    console.log(`Final enemy party size: ${selectedEnemies.length}`);
    console.log(
      `Enemy names: ${selectedEnemies.map((e) => e.name).join(", ")}`
    );
    console.log("========== ENEMY PARTY GENERATION END ==========");

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
    console.log("========== PREPARING ENEMY FOR COMBAT ==========");
    console.log(
      "Enemy before preparation:",
      enemy.basic ? enemy.basic.name : enemy.name
    );

    // If it's already in combat format, return as is
    if (enemy.currentHP && enemy.maxHP && enemy.monsterAbilities) {
      console.log("Enemy already in combat format");
      return enemy;
    }

    // Otherwise, convert from bestiary format using PartyManager's prepare method
    if (this.partyManager) {
      console.log("Using PartyManager to prepare monster");
      console.log("PartyManager available:", !!this.partyManager);
      console.log(
        "prepareMonster method available:",
        typeof this.partyManager.prepareMonster === "function"
      );

      const preparedEnemy = this.partyManager.prepareMonster(enemy);

      // Add some randomization to make fights more interesting
      // Vary HP between 90-110% of base
      const hpVariance = 0.9 + Math.random() * 0.2;
      preparedEnemy.maxHP = Math.floor(preparedEnemy.maxHP * hpVariance);
      preparedEnemy.currentHP = preparedEnemy.maxHP;

      // Give it a unique ID
      preparedEnemy.id = `enemy_${Date.now()}_${Math.floor(
        Math.random() * 1000
      )}`;

      console.log("Enemy after preparation:", preparedEnemy.name);
      console.log(`HP: ${preparedEnemy.currentHP}/${preparedEnemy.maxHP}`);
      console.log(`Abilities: ${preparedEnemy.monsterAbilities?.length || 0}`);
      console.log("========== ENEMY PREPARATION COMPLETE ==========");

      return preparedEnemy;
    }

    // Fallback if no party manager
    console.log("No PartyManager available, returning unprepared enemy");
    console.log("========== ENEMY PREPARATION FAILED ==========");
    return enemy;
  }

  updateEnemyArea(providedEnemyArea = null) {
    // Use provided area or find it
    const enemyArea =
      providedEnemyArea || this.dialogContainer.querySelector(".enemy-area");
  
    if (!enemyArea) {
      console.error("Enemy area not found and not provided");
      return;
    }
  
    // Remove any transitions temporarily to prevent race conditions
    enemyArea.style.transition = "none";
  
    // Clear existing content
    enemyArea.innerHTML = "";
  
    // Get active (non-defeated) enemies
    const activeEnemies = this.enemyParty.filter(
      (monster) => monster.currentHP > 0
    );
    const count = activeEnemies.length;
  
    // Update enemy area class based on count
    if (count === 1) {
      enemyArea.className = "enemy-area enemy-layout-single";
    } else if (count === 2) {
      enemyArea.className = "enemy-area enemy-layout-duo";
    } else if (count === 3) {
      enemyArea.className = "enemy-area enemy-layout-trio";
    } else if (count >= 4) {
      enemyArea.className = "enemy-area enemy-layout-quad";
    }
  
    // Add cards with explicit, fixed positioning
    if (count === 1) {
      // Single enemy - centered
      const monster = activeEnemies[0];
      const card = this.createMonsterCard(monster, "enemy", 0);
  
      // Fixed position
      card.style.position = "absolute";
      card.style.left = "calc(50% - 90px)"; // Half card width
      card.style.top = "calc(50% - 100px)"; // Position in middle
      // Don't override the tilt applied in createMonsterCard
      card.style.transition = "none"; // Prevent transitions
  
      enemyArea.appendChild(card);
    } else if (count === 2) {
      // Two enemies - diagonal arrangement
      activeEnemies.forEach((monster, index) => {
        const card = this.createMonsterCard(monster, "enemy", index);
  
        // Fixed position
        card.style.position = "absolute";
        card.style.transition = "none"; // Prevent transitions
  
        if (index === 0) {
          // Top left
          card.style.left = "calc(35% - 80px)";
          card.style.top = "calc(35% - 100px)";
          // Keep the base tilt but add small adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt - 2}deg)`;
        } else {
          // Bottom right
          card.style.left = "calc(65% - 80px)";
          card.style.top = "calc(65% - 100px)";
          // Keep the base tilt but add small adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt + 2}deg)`;
        }
  
        enemyArea.appendChild(card);
      });
    } else if (count === 3) {
      // Three enemies - triangle arrangement
      activeEnemies.forEach((monster, index) => {
        const card = this.createMonsterCard(monster, "enemy", index);
  
        // Fixed position
        card.style.position = "absolute";
        card.style.transition = "none"; // Prevent transitions
  
        if (index === 0) {
          // Top center
          card.style.left = "calc(50% - 80px)";
          card.style.top = "20px";
          card.style.zIndex = "3";
        } else if (index === 1) {
          // Bottom left
          card.style.left = "calc(30% - 80px)";
          card.style.top = "130px";
          // Add extra tilt
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt - 3}deg)`;
          card.style.zIndex = "2";
        } else {
          // Bottom right
          card.style.left = "calc(70% - 80px)";
          card.style.top = "130px";
          // Add extra tilt
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt + 3}deg)`;
          card.style.zIndex = "1";
        }
  
        enemyArea.appendChild(card);
      });
    } else if (count >= 4) {
      // Four enemies - 2x2 grid
      activeEnemies.slice(0, 4).forEach((monster, index) => {
        const card = this.createMonsterCard(monster, "enemy", index);
  
        // Fixed position
        card.style.position = "absolute";
        card.style.transition = "none"; // Prevent transitions
  
        const row = Math.floor(index / 2);
        const col = index % 2;
  
        // Position in grid
        if (row === 0 && col === 0) {
          // Top left
          card.style.left = "calc(30% - 80px)";
          card.style.top = "30px";
          // Add slight tilt adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt - 2}deg)`;
          card.style.zIndex = "4";
        } else if (row === 0 && col === 1) {
          // Top right
          card.style.left = "calc(70% - 80px)";
          card.style.top = "30px";
          // Add slight tilt adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt + 2}deg)`;
          card.style.zIndex = "3";
        } else if (row === 1 && col === 0) {
          // Bottom left
          card.style.left = "calc(30% - 80px)";
          card.style.top = "150px";
          // Add slight tilt adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt - 5}deg)`;
          card.style.zIndex = "2";
        } else {
          // Bottom right
          card.style.left = "calc(70% - 80px)";
          card.style.top = "150px";
          // Add slight tilt adjustment
          const currentTilt = parseFloat(card.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
          card.style.transform = `rotate(${currentTilt + 5}deg)`;
          card.style.zIndex = "1";
        }
  
        enemyArea.appendChild(card);
      });
    }
  
    // Create the defeated enemy token row
    this.updateDefeatedEnemiesRow();
  
    // Force a reflow to ensure all positions are applied immediately
    enemyArea.offsetHeight;
  
    // Re-enable transitions after a delay
    setTimeout(() => {
      enemyArea.style.transition = "";
  
      // Re-enable transitions on cards
      const cards = enemyArea.querySelectorAll(".combat-monster");
      cards.forEach((card) => {
        card.style.transition = "";
      });
    }, 50);
  }


  updateDefeatedEnemiesRow() {
    // Find the header area
    const header = this.dialogContainer.querySelector(".combat-header");
    if (!header) return;

    // Find or create the defeated enemies container
    let defeatedRow = this.dialogContainer.querySelector(
      ".defeated-enemies-row"
    );

    if (!defeatedRow) {
      // Create container for defeated enemies
      defeatedRow = document.createElement("div");
      defeatedRow.className = "defeated-enemies-row";

      // Add to the header
      header.appendChild(defeatedRow);
    }

    // Update styling to fit in header
    defeatedRow.style.position = "relative"; // Not absolute
    defeatedRow.style.top = "auto";
    defeatedRow.style.left = "auto";
    defeatedRow.style.marginLeft = "16px";
    defeatedRow.style.display = "flex";
    defeatedRow.style.alignItems = "center";

    // Clear existing content
    defeatedRow.innerHTML = "";

    // Get defeated enemies
    const defeatedEnemies = this.enemyParty.filter(
      (monster) => monster.currentHP <= 0
    );

    // If none, hide the row
    if (defeatedEnemies.length === 0) {
      defeatedRow.style.display = "none";
      return;
    }

    // Show the row and add tokens
    defeatedRow.style.display = "flex";

    // Add header with count
    defeatedRow.innerHTML = `
    <span style="margin-right: 8px; opacity: 0.8;">Defeated: ${defeatedEnemies.length}</span>
  `;

    // Add tokens for each defeated enemy
    defeatedEnemies.forEach((monster) => {
      const token = document.createElement("div");
      token.className = "defeated-token";
      token.title = monster.name;

      // Get token image or create placeholder
      const tokenImage =
        monster.token?.data || this.generateDefaultTokenImage(monster);

      token.innerHTML = `
      <img src="${tokenImage}" alt="${monster.name}">
      <div class="defeated-x">✕</div>
    `;

      defeatedRow.appendChild(token);
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
    // Add at the end of initializeComboSystem method
console.log("=== COMBO ABILITIES DEBUG ===");
console.log("Combo abilities initialized with keys:", Object.keys(this.comboAbilities));
console.log("Looking for Undead-Fiend combo...");
console.log("Direct access test:", this.comboAbilities["Undead-Fiend"]);
console.log("Case insensitive test:", this.comboAbilities["undead-fiend"] || 
                                     this.comboAbilities["UNDEAD-FIEND"] || 
                                     this.comboAbilities["Undead-FIEND"]);
console.log("Reverse order test:", this.comboAbilities["Fiend-Undead"]);
console.log("========================");
  }

  // Add this function to extract base type without size prefix
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
  
  // Check for available combo abilities based on active party members
  getAvailableComboAbilities() {
    // Ensure the partyManager is available
    if (!this.partyManager || !this.partyManager.relationshipMap) {
      console.warn("Can't check for combo abilities - no party relationship data available");
      return [];
    }
  
    const availableCombos = [];
    
    // Get all player monsters in combat
    const playerMonsters = this.playerParty;
    
    // Check each pair of active player monsters
    for (let i = 0; i < playerMonsters.length; i++) {
      const monster1 = playerMonsters[i];
      
      // Skip defeated monsters
      if (monster1.currentHP <= 0) continue;
      
      for (let j = i + 1; j < playerMonsters.length; j++) {
        const monster2 = playerMonsters[j];
        
        // Skip defeated monsters
        if (monster2.currentHP <= 0) continue;
        
        // Get monster types
        // const type1 = monster1.type;
        // const type2 = monster2.type;
        
        const type1 = this.getNormalizedType(monster1.type);
        const type2 = this.getNormalizedType(monster2.type);

        // Generate keys for both possible orders
        const comboKey1 = `${type1}-${type2}`;
        const comboKey2 = `${type2}-${type1}`;

        console.log(`Checking combo for monsters: ${monster1.name} (${type1}) and ${monster2.name} (${type2})`);

// After generating combo keys:
console.log(`Combo keys to check: ${comboKey1}, ${comboKey2}`);
        
        // Check if a combo ability exists for these types
        // const comboAbility = this.comboAbilities[comboKey1] || this.comboAbilities[comboKey2];
        
        // if (comboAbility) {
        //   // Check if the monsters have the required affinity level
        //   const affinityScore = this.partyManager.getCombatModifier(monster1.id, monster2.id);
        //   let affinityLevel;
          
        //   // Convert numeric bonus to affinity level
        //   if (affinityScore >= 7) affinityLevel = 'High';
        //   else if (affinityScore >= 5) affinityLevel = 'Medium';
        //   else if (affinityScore > 0) affinityLevel = 'Low';
        //   else affinityLevel = 'None';
          
        //   const requiredLevel = comboAbility.requiredAffinity;
          
        //   // Convert levels to numeric for comparison
        //   const levelValues = { 'High': 3, 'Medium': 2, 'Low': 1, 'None': 0 };
          
        //   if (levelValues[affinityLevel] >= levelValues[requiredLevel]) {
        //     // This combo is available - create a copy with the monsters
        //     const combo = {
        //       ...comboAbility,
        //       id: `combo_${monster1.id}_${monster2.id}`,
        //       monsters: [monster1, monster2]
        //     };
            
        //     availableCombos.push(combo);
        //     console.log(`Found available combo: ${combo.name} between ${monster1.name} and ${monster2.name}`);
        //   }
        // }

// Replace the combo lookup code with this more verbose version
console.log(`Checking for combo with keys: ${comboKey1} or ${comboKey2}`);
let comboAbility = null;

// Try direct access
if (this.comboAbilities[comboKey1]) {
  comboAbility = this.comboAbilities[comboKey1];
  console.log(`Found combo using key: ${comboKey1}`);
} else if (this.comboAbilities[comboKey2]) {
  comboAbility = this.comboAbilities[comboKey2];
  console.log(`Found combo using key: ${comboKey2}`);
} else {
  // Try case-insensitive search
  const keys = Object.keys(this.comboAbilities);
  console.log(`Available combo keys: ${keys.join(', ')}`);
  
  const matchingKey = keys.find(key => 
    key.toLowerCase() === comboKey1.toLowerCase() || 
    key.toLowerCase() === comboKey2.toLowerCase()
  );
  
  if (matchingKey) {
    comboAbility = this.comboAbilities[matchingKey];
    console.log(`Found combo using case-insensitive key: ${matchingKey}`);
  } else {
    console.log(`No combo found for ${comboKey1} or ${comboKey2}`);
  }
}


      }



    }
    
    return availableCombos;
  }

  showComboTargetSelection(activeMonster, partnerMonster, combo) {
    console.log(`Setting up targeting for ${combo.name} combo ability`);
    
    // Find all enemy cards
    const enemyCards = Array.from(
      this.dialogContainer.querySelectorAll(".combat-monster.enemy")
    );
    
    // Find viable targets (enemies with HP > 0)
    const viableTargets = [];
    
    enemyCards.forEach((card) => {
      const enemyId = card.getAttribute("data-monster-id");
      const enemy = this.enemyParty.find((e) => e.id === enemyId);
    
      if (enemy && enemy.currentHP > 0) {
        viableTargets.push({ card, enemy });
      }
    });
    
    // If there's only one viable target, auto-target it
    if (viableTargets.length === 1) {
      const { enemy, card } = viableTargets[0];
      
      // Create a quick highlight effect
      card.classList.add("auto-targeted");
    
      // Create a temporary message
      const battleScene = this.dialogContainer.querySelector(".battle-scene");
      const autoMessage = document.createElement("div");
      autoMessage.className = "battle-notification fade-in";
      autoMessage.textContent = `Auto-targeting ${enemy.name} with ${combo.name}`;
      autoMessage.style.backgroundColor = `${combo.color}cc`;
      battleScene.appendChild(autoMessage);
    
      // Remove the message and execute the ability after a short delay
      setTimeout(() => {
        autoMessage.classList.remove("fade-in");
        autoMessage.style.opacity = "0";
    
        // Resolve the combo ability
        this.resolveComboAttackAbility(activeMonster, partnerMonster, combo, enemy);
    
        // Move to next turn
        this.nextTurn();
    
        // Clean up
        setTimeout(() => {
          autoMessage.remove();
          card.classList.remove("auto-targeted");
        }, 300);
      }, 800);
    
      return;
    }
    
    // If we have multiple targets, proceed with manual targeting
    viableTargets.forEach(({ card, enemy }) => {
      // Add targetable class and hint
      card.classList.add("targetable");
    
      // Add targeting hint
      const hint = document.createElement("div");
      hint.className = "targeting-hint";
      hint.textContent = `Click to target with ${combo.name}`;
      hint.style.position = "absolute";
      hint.style.top = "-30px";
      hint.style.left = "50%";
      hint.style.transform = "translateX(-50%)";
      hint.style.background = `${combo.color}cc`;
      hint.style.color = "white";
      hint.style.padding = "4px 8px";
      hint.style.borderRadius = "4px";
      hint.style.fontSize = "0.8em";
      hint.style.whiteSpace = "nowrap";
      hint.style.pointerEvents = "none";
      hint.style.opacity = "0";
      hint.style.transition = "opacity 0.3s ease";
      card.appendChild(hint);
      
      // Show hint on hover
      card.addEventListener('mouseenter', () => {
        hint.style.opacity = "1";
      });
      
      card.addEventListener('mouseleave', () => {
        hint.style.opacity = "0";
      });
    
      // Create new click handler
      const targetClickHandler = () => {
        // Remove targeting from all cards
        enemyCards.forEach((c) => {
          c.classList.remove("targetable");
          const h = c.querySelector(".targeting-hint");
          if (h) h.remove();
    
          // Important: Remove all previous click handlers
          c.removeEventListener("click", targetClickHandler);
        });
    
        // Execute combo ability on the target
        this.resolveComboAttackAbility(activeMonster, partnerMonster, combo, enemy);
    
        // Move to next turn
        this.nextTurn();
    
        // Remove battle notification if present
        const notification = this.dialogContainer.querySelector(
          ".battle-notification"
        );
        if (notification) notification.remove();
      };
    
      // Add click handler
      card.addEventListener("click", targetClickHandler);
    });
    
    // Add the targeting instruction message
    const battleScene = this.dialogContainer.querySelector(".battle-scene");
    const indicator = document.createElement("div");
    indicator.className = "battle-notification fade-in";
    indicator.textContent = `Select an enemy for ${combo.name}`;
    indicator.style.backgroundColor = `${combo.color}cc`;
    battleScene.appendChild(indicator);
    
    // Remove after a few seconds to avoid clutter
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.classList.remove("fade-in");
        indicator.style.opacity = "0";
        setTimeout(() => {
          if (indicator.parentNode) indicator.remove();
        }, 300);
      }
    }, 3000);
  }

  // Add this method to your CombatSystem class
// useComboAbility(comboId, activeMonster) {
//   console.log(`Processing combo ability: ${comboId}`);
  
//   // Parse the combo ID to get monster IDs
//   const comboIdParts = comboId.split('_');
//   if (comboIdParts.length < 3) {
//     console.error(`Invalid combo ID format: ${comboId}`);
//     return false;
//   }
  
//   const monster1Id = comboIdParts[1];
//   const monster2Id = comboIdParts[2];
  
//   console.log(`Looking for monsters with IDs: ${monster1Id} and ${monster2Id}`);
//   console.log(`Active monster ID: ${activeMonster.id}`);
//   console.log(`Current player party has ${this.playerParty.length} monsters with IDs: ${this.playerParty.map(m => m.id).join(', ')}`);
  
//   // First, identify the partner monster - this is the one that's not the active monster
//   // Since we know the active monster is valid and in combat, we only need to find the partner
//   let partnerMonster;
  
//   // Find the partner monster - it must be one of the IDs from the combo
//   if (monster1Id === activeMonster.id || String(monster1Id) === String(activeMonster.id)) {
//     // Monster 2 is the partner
//     partnerMonster = this.playerParty.find(m => 
//       m.id === monster2Id || String(m.id) === String(monster2Id)
//     );
//   } else {
//     // Monster 1 is the partner
//     partnerMonster = this.playerParty.find(m => 
//       m.id === monster1Id || String(m.id) === String(monster1Id)
//     );
//   }
  
//   if (!partnerMonster) {
//     console.error(`Could not find partner monster in the player party. Active monster: ${activeMonster.name}, IDs from combo: ${monster1Id}, ${monster2Id}`);
//     return false;
//   }
  
//   // Get all available combo abilities
//   const availableCombos = this.getAvailableComboAbilities();
//   console.log(`Available combos: ${availableCombos.length}`);
  
//   // Find this specific combo
//   const combo = availableCombos.find(c => {
//     const comboMonsterIds = c.monsters.map(m => m.id);
//     return comboMonsterIds.includes(activeMonster.id) && 
//            comboMonsterIds.includes(partnerMonster.id);
//   });
  
//   if (!combo) {
//     console.error(`Combo ability not found for monsters ${activeMonster.name} and ${partnerMonster.name}`);
//     return false;
//   }
  
//   console.log(`Found combo: ${combo.name} (${combo.type})`);
  
//   // Process based on combo type
//   switch (combo.type) {
//     case 'attack':
//       // Show target selection for attack combos
//       this.showComboTargetSelection(activeMonster, partnerMonster, combo);
//       return true;
    
//     case 'area':
//       // Area combos affect all enemies
//       this.resolveComboAreaAbility(activeMonster, partnerMonster, combo);
//       return true;
    
//     case 'buff':
//       // Buff combos affect all allies
//       this.resolveComboBuffAbility(activeMonster, partnerMonster, combo);
//       return true;
    
//     default:
//       // Default to attack behavior
//       this.showComboTargetSelection(activeMonster, partnerMonster, combo);
//       return true;
//   }
// }

useComboAbility(comboId, activeMonster) {
  console.log(`Processing combo ability: ${comboId}`);
  
  // First, check if the combo ID has double underscores from formatting
  if (comboId.includes('_monster_')) {
    // We have the monster_ prefix in the string, need to parse carefully
    const regex = /combo_(monster_\d+)_(monster_\d+)/;
    const match = comboId.match(regex);
    
    if (match && match.length >= 3) {
      // Successfully extracted the full monster IDs
      const monster1Id = match[1];
      const monster2Id = match[2];
      
      console.log(`Looking for monsters with IDs: ${monster1Id} and ${monster2Id}`);
      console.log(`Active monster ID: ${activeMonster.id}`);
      console.log(`Current player party has ${this.playerParty.length} monsters with IDs: ${this.playerParty.map(m => m.id).join(', ')}`);
      
      // First, identify the partner monster - this is the one that's not the active monster
      let partnerMonster;
      
      if (monster1Id === activeMonster.id) {
        // Monster 2 is the partner
        partnerMonster = this.playerParty.find(m => m.id === monster2Id);
      } else if (monster2Id === activeMonster.id) {
        // Monster 1 is the partner
        partnerMonster = this.playerParty.find(m => m.id === monster1Id);
      } else {
        // If active monster doesn't match either ID, try to find both monsters
        const monster1 = this.playerParty.find(m => m.id === monster1Id);
        const monster2 = this.playerParty.find(m => m.id === monster2Id);
        
        // Use whichever one isn't the active monster
        if (monster1 && monster1.id !== activeMonster.id) {
          partnerMonster = monster1;
        } else if (monster2 && monster2.id !== activeMonster.id) {
          partnerMonster = monster2;
        }
      }
      
      if (!partnerMonster) {
        console.error(`Could not find partner monster in the player party. Active monster: ${activeMonster.name}, IDs from combo: ${monster1Id}, ${monster2Id}`);
        return false;
      }
      
      // Get all available combo abilities
      const availableCombos = this.getAvailableComboAbilities();
      console.log(`Available combos: ${availableCombos.length}`);
      
      // Find this specific combo
      const combo = availableCombos.find(c => {
        const comboMonsterIds = c.monsters.map(m => m.id);
        return comboMonsterIds.includes(activeMonster.id) && 
               comboMonsterIds.includes(partnerMonster.id);
      });
      
      if (!combo) {
        console.error(`Combo ability not found for monsters ${activeMonster.name} and ${partnerMonster.name}`);
        return false;
      }
      
      console.log(`Found combo: ${combo.name} (${combo.type})`);
      
      // Process based on combo type
      switch (combo.type) {
        case 'attack':
          // Show target selection for attack combos
          this.showComboTargetSelection(activeMonster, partnerMonster, combo);
          return true;
        
        case 'area':
          // Area combos affect all enemies
          this.resolveComboAreaAbility(activeMonster, partnerMonster, combo);
          return true;
        
        case 'buff':
          // Buff combos affect all allies
          this.resolveComboBuffAbility(activeMonster, partnerMonster, combo);
          return true;
        
        default:
          // Default to attack behavior
          this.showComboTargetSelection(activeMonster, partnerMonster, combo);
          return true;
      }
    }
  }
  
  // If we get here, something went wrong with the parsing
  console.error(`Invalid combo ID format: ${comboId}`);
  return false;
}
  
  // Resolve a combo attack ability against a single target
  resolveComboAttackAbility(activeMonster, partnerMonster, combo, target) {
    console.log(`Resolving combo attack: ${combo.name} against ${target.name}`);
    
    // Create a special combo animation
    this.showComboAnimation(activeMonster, partnerMonster, combo);
    
    // Calculate damage - combo abilities use their own damage formula
    let damage = 0;
    
    // Parse damage formula (e.g., "3d8+6")
    if (combo.damage) {
      const damageFormula = combo.damage;
      
      // Check if it has dice notation
      if (damageFormula.includes("d")) {
        const parts = damageFormula.split("+");
        const diceNotation = parts[0];
        const modifier = parts.length > 1 ? parseInt(parts[1]) : 0;
        
        const [numDice, dieSize] = diceNotation.split("d").map((n) => parseInt(n));
        
        // Roll the dice
        for (let i = 0; i < numDice; i++) {
          damage += this.rollDice(dieSize);
        }
        
        // Add modifier
        damage += modifier;
      } else {
        // Fixed damage
        damage = parseInt(damageFormula);
      }
      
      // Add the combined level of both monsters to the damage
      const levelBonus = Math.floor((activeMonster.level + partnerMonster.level) / 3);
      damage += levelBonus;
      
      console.log(`Calculated combo damage: ${damage} (including level bonus of +${levelBonus})`);
    }
    
    // Apply damage
    this.applyDamage(target, damage, activeMonster, false);
    
    // Log the combo use with both monster names
    this.addLogEntry(`${activeMonster.name} and ${partnerMonster.name} used ${combo.name} on ${target.name} for ${damage} damage!`);
    
    // Handle life steal if applicable
    if (combo.lifeSteal) {
      const healAmount = Math.floor(damage * 0.5); // 50% of damage
      
      // Heal both monsters that participated in the combo
      activeMonster.currentHP = Math.min(activeMonster.maxHP, activeMonster.currentHP + healAmount);
      partnerMonster.currentHP = Math.min(partnerMonster.maxHP, partnerMonster.currentHP + healAmount);
      
      this.addLogEntry(`The attack drained life, healing both monsters for ${healAmount} HP!`);
      this.updateCombatDisplay();
    }
    
    // Handle any other special effects
    if (combo.effectDescription) {
      this.addLogEntry(combo.effectDescription);
    }
  }
  
  // Resolve a combo area ability against all enemies
  resolveComboAreaAbility(activeMonster, partnerMonster, combo) {
    console.log(`Resolving combo area ability: ${combo.name}`);
    
    // Create combo animation
    this.showComboAnimation(activeMonster, partnerMonster, combo);
    
    // Calculate base damage
    let baseDamage = 0;
    
    // Parse damage formula
    if (combo.damage) {
      const damageFormula = combo.damage;
      
      // Check if it has dice notation
      if (damageFormula.includes("d")) {
        const parts = damageFormula.split("+");
        const diceNotation = parts[0];
        const modifier = parts.length > 1 ? parseInt(parts[1]) : 0;
        
        const [numDice, dieSize] = diceNotation.split("d").map((n) => parseInt(n));
        
        // Roll the dice
        for (let i = 0; i < numDice; i++) {
          baseDamage += this.rollDice(dieSize);
        }
        
        // Add modifier
        baseDamage += modifier;
      } else {
        // Fixed damage
        baseDamage = parseInt(damageFormula);
      }
    }
    
    // Apply to all enemies
    let totalDamage = 0;
    let targetCount = 0;
    
    // Get all active enemies
    const activeEnemies = this.enemyParty.filter(enemy => enemy.currentHP > 0);
    
    // Apply damage to each enemy
    activeEnemies.forEach(enemy => {
      // Small variation in damage for each target (+/- 20%)
      const damageVariation = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      const damage = Math.floor(baseDamage * damageVariation);
      
      // Apply damage
      this.applyDamage(enemy, damage, activeMonster, false);
      
      totalDamage += damage;
      targetCount++;
    });
    
    // Log the combo use
    this.addLogEntry(`${activeMonster.name} and ${partnerMonster.name} used ${combo.name}, dealing ${totalDamage} total damage to ${targetCount} enemies!`);
    
    // Apply healing to allies if applicable
    if (combo.healing) {
      this.applyComboHealing(activeMonster, partnerMonster, combo);
    }
    
    // Move to next turn
    this.nextTurn();
  }
  
  // Resolve a combo buff ability on allies
  resolveComboBuffAbility(activeMonster, partnerMonster, combo) {
    console.log(`Resolving combo buff ability: ${combo.name}`);
    
    // Create combo animation
    this.showComboAnimation(activeMonster, partnerMonster, combo);
    
    // Apply healing to allies if applicable
    if (combo.healing) {
      this.applyComboHealing(activeMonster, partnerMonster, combo);
    }
    
    // Apply defensive bonus if applicable
    if (combo.defensiveBonus) {
      this.addLogEntry(`${combo.name} increases everyone's defense by ${combo.defensiveBonus}!`);
    }
    
    // Apply attack bonus if applicable
    if (combo.attackBonus) {
      this.addLogEntry(`${combo.name} increases everyone's attack by ${combo.attackBonus}!`);
    }
    
    // Log duration if applicable
    if (combo.duration) {
      this.addLogEntry(`The effect will last for ${combo.duration} turns.`);
    }
    
    // Move to next turn
    this.nextTurn();
  }
  
  // Apply healing from a combo ability to player party
  applyComboHealing(activeMonster, partnerMonster, combo) {
    if (!combo.healing) return;
    
    console.log(`Applying combo healing from ${combo.name}`);
    
    // Calculate healing amount
    let healingBase = 0;
    
    // Parse healing formula
    const healingFormula = combo.healing;
    
    // Check if it has dice notation
    if (healingFormula.includes("d")) {
      const parts = healingFormula.split("+");
      const diceNotation = parts[0];
      const modifier = parts.length > 1 ? parseInt(parts[1]) : 0;
      
      const [numDice, dieSize] = diceNotation.split("d").map((n) => parseInt(n));
      
      // Roll the dice
      for (let i = 0; i < numDice; i++) {
        healingBase += this.rollDice(dieSize);
      }
      
      // Add modifier
      healingBase += modifier;
    } else {
      // Fixed healing
      healingBase = parseInt(healingFormula);
    }
    
    // Apply healing to all player monsters
    this.playerParty.forEach(monster => {
      // Skip dead monsters
      if (monster.currentHP <= 0) return;
      
      // Apply healing
      const originalHP = monster.currentHP;
      monster.currentHP = Math.min(monster.maxHP, monster.currentHP + healingBase);
      const actualHealing = monster.currentHP - originalHP;
      
      if (actualHealing > 0) {
        // Only log if actual healing occurred
        this.addLogEntry(`${monster.name} was healed for ${actualHealing} HP.`);
      }
    });
    
    // Update combat display
    this.updateCombatDisplay();
  }
  
  // Show a special animation when a combo ability is used
  showComboAnimation(monster1, monster2, combo) {
    console.log(`Showing combo animation for ${combo.name}`);
    
    const battleScene = this.dialogContainer.querySelector(".battle-scene");
    
    // Create animation overlay
    const animationOverlay = document.createElement('div');
    animationOverlay.className = 'combo-animation-overlay';
    animationOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      pointer-events: none;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    `;
    
    // Create animation container
    const animation = document.createElement('div');
    animation.className = 'combo-animation';
    animation.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: scale(0);
      opacity: 0;
      transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease;
    `;
    
    // Create animation content
    animation.innerHTML = `
      <div class="combo-flash" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${combo.color}; 
        opacity: 0;
        animation: comboFlash 0.5s ease-out;
      "></div>
      <div class="combo-title" style="
        font-size: 2.5rem;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 10px ${combo.color}, 0 0 20px ${combo.color}, 0 0 30px ${combo.color};
        margin-bottom: 16px;
        transform: scale(0.8);
        opacity: 0;
        animation: comboTextAppear 0.5s ease-out 0.2s forwards;
      ">
        ${combo.name}
      </div>
      <div class="combo-monsters" style="
        display: flex;
        align-items: center;
        transform: scale(0.8);
        opacity: 0;
        animation: comboMonstersAppear 0.5s ease-out 0.4s forwards;
      ">
        <div class="combo-monster" style="text-align: center; margin-right: 20px;">
          <div style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${this.getMonsterTypeColor(monster1.type)};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 8px;
            border: 2px solid white;
            box-shadow: 0 0 10px ${combo.color};
          ">
            ${monster1.token?.data ? 
              `<img src="${monster1.token.data}" alt="${monster1.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` :
              `<span style="color: white; font-weight: bold; font-size: 24px;">${monster1.name.charAt(0)}</span>`
            }
          </div>
          <div style="color: white; font-size: 0.9rem; text-shadow: 0 0 5px rgba(0,0,0,0.5);">
            ${monster1.name}
          </div>
        </div>
        
        <div class="combo-plus" style="
          margin: 0 20px;
          font-size: 2rem;
          color: white;
          text-shadow: 0 0 10px rgba(0,0,0,0.5);
        ">+</div>
        
        <div class="combo-monster" style="text-align: center; margin-left: 20px;">
          <div style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${this.getMonsterTypeColor(monster2.type)};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 8px;
            border: 2px solid white;
            box-shadow: 0 0 10px ${combo.color};
          ">
            ${monster2.token?.data ? 
              `<img src="${monster2.token.data}" alt="${monster2.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` :
              `<span style="color: white; font-weight: bold; font-size: 24px;">${monster2.name.charAt(0)}</span>`
            }
          </div>
          <div style="color: white; font-size: 0.9rem; text-shadow: 0 0 5px rgba(0,0,0,0.5);">
            ${monster2.name}
          </div>
        </div>
      </div>
      
      <style>
        @keyframes comboFlash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        
        @keyframes comboTextAppear {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes comboMonstersAppear {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      </style>
    `;
    
    // Add animation to overlay
    animationOverlay.appendChild(animation);
    
    // Add overlay to battle scene
    battleScene.appendChild(animationOverlay);
    
    // Trigger animation
    setTimeout(() => {
      animation.style.transform = 'scale(1)';
      animation.style.opacity = '1';
      
      // Remove after animation completes
      setTimeout(() => {
        animation.style.transform = 'scale(1.1)';
        animation.style.opacity = '0';
        
        setTimeout(() => {
          animationOverlay.remove();
        }, 500);
      }, 2500);
    }, 100);
  }

  // Add to CombatSystem.js
addCombatAnimations() {
  // Attack animation
  this.animateAttack = (attackerCard, targetCard) => {
    // Clone the attacker card for animation
    const clone = attackerCard.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.zIndex = '1000';
    clone.style.opacity = '0.8';
    clone.style.pointerEvents = 'none';
    
    // Get positions
    const attackerRect = attackerCard.getBoundingClientRect();
    const targetRect = targetCard.getBoundingClientRect();
    const battleScene = this.dialogContainer.querySelector('.battle-scene');
    const battleSceneRect = battleScene.getBoundingClientRect();
    
    // Position clone at source
    clone.style.top = (attackerRect.top - battleSceneRect.top) + 'px';
    clone.style.left = (attackerRect.left - battleSceneRect.left) + 'px';
    clone.style.width = attackerRect.width + 'px';
    clone.style.height = attackerRect.height + 'px';
    
    // Add to scene
    battleScene.appendChild(clone);
    
    // Calculate target position
    const targetX = targetRect.left - battleSceneRect.left + (targetRect.width / 2) - (attackerRect.width / 2);
    const targetY = targetRect.top - battleSceneRect.top + (targetRect.height / 2) - (attackerRect.height / 2);
    
    // Animate!
    setTimeout(() => {
      clone.style.transition = 'all 0.3s ease-in-out';
      clone.style.transform = 'scale(1.1)';
      
      setTimeout(() => {
        clone.style.transition = 'all 0.2s ease-in';
        clone.style.transform = 'scale(0.9)';
        clone.style.top = targetY + 'px';
        clone.style.left = targetX + 'px';
        
        // Flash target
        targetCard.style.boxShadow = '0 0 20px #ff0000';
        targetCard.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
          // Reset target
          targetCard.style.boxShadow = '';
          targetCard.style.transform = '';
          
          // Remove clone
          clone.remove();
        }, 300);
      }, 200);
    }, 10);
  };
  
  // Modify resolveAbility to use animation
  const originalResolveAbility = this.resolveAbility;
  this.resolveAbility = (monster, ability, target) => {
    // Find cards
    const attackerCard = this.dialogContainer.querySelector(`.combat-monster[data-monster-id="${monster.id}"]`);
    const targetCard = this.dialogContainer.querySelector(`.combat-monster[data-monster-id="${target.id}"]`);
    
    // Animate if cards found and it's an attack
    if (attackerCard && targetCard && ability.type === 'attack') {
      this.animateAttack(attackerCard, targetCard);
      
      // Delay the actual resolution slightly for animation
      setTimeout(() => {
        originalResolveAbility.call(this, monster, ability, target);
      }, 500);
    } else {
      // No animation, just resolve
      originalResolveAbility.call(this, monster, ability, target);
    }
  };
}

}
