/**
 * GameMenu - A class to handle the in-game menu system with card-based UI
 * Provides start menu, save/load functionality, settings, and help screens
 */
class GameMenu {
    constructor(scene3D, container) {
      // Store reference to the Scene3DController
      this.scene3D = scene3D;
      this.container = container;
      
      // Set initial state if not already set
      if (!this.scene3D.hasOwnProperty('gameStarted')) {
        this.scene3D.gameStarted = false;
      }
      
      // Add initialMenu flag to scene3D - this stays true until the player explicitly starts the game
      if (!this.scene3D.hasOwnProperty('initialMenu')) {
        this.scene3D.initialMenu = true; 
      }
      
      // Menu state
      this.isVisible = false;
      this.menuType = 'main'; // 'main', 'save', 'load', 'settings', etc.
      
      // DOM elements
      this.menuContainer = null;
      this.cardsContainer = null;
      
      // Initialize menu system
      this.initialize();
      
      // Bind event methods
      this.handleEscapeKey = this.handleEscapeKey.bind(this);
      
      // Set up event listeners
      document.addEventListener('keydown', this.handleEscapeKey, true);
    }
    
    // Initialize the menu system
    initialize() {
      // Create the main menu container (initially hidden)
      this.menuContainer = document.createElement('div');
      this.menuContainer.className = 'game-menu-container';
      this.menuContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9000;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      
      // Add to container
      this.container.appendChild(this.menuContainer);
      
      // Create main menu (starting menu)
      this.createMainMenu();
      
      // Show menu automatically if it's the initial game load
      if (this.isInitialMenu()) {
        // Use setTimeout to ensure the menu shows after the 3D view is fully set up
        setTimeout(() => this.show(), 100);
      }
    }
    
    // Handle the ESC key
    handleEscapeKey(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      
      // If the menu is visible, hide it
      // If not visible, show it
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
      
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Show the menu
    show(menuType = 'main') {
      // Set state
      this.isVisible = true;
      
      // If we're changing menu type, update it
      if (menuType !== this.menuType) {
        this.switchMenu(menuType);
      }
      
      // Make menu visible
      this.menuContainer.style.opacity = '1';
      this.menuContainer.style.pointerEvents = 'auto';
      
      // Pause game
      this.setGamePaused(true);
    }
    
    // Hide the menu
    hide() {
      // Set state
      this.isVisible = false;
      
      // Hide menu with animation
      this.menuContainer.style.opacity = '0';
      this.menuContainer.style.pointerEvents = 'none';
      
      // Resume game
      this.setGamePaused(false);
    }
    
    // Helper to set game paused/resumed state
    setGamePaused(isPaused) {
      if (isPaused) {
        // Unlock controls to allow menu interaction
        if (this.scene3D.controls && this.scene3D.controls.isLocked) {
          this.scene3D.controls.unlock();
        }
        
        // Pause 3D controls
        if (this.scene3D.pauseControls) {
          this.scene3D.pauseControls();
        }
      } else {
        // Resume controls
        if (this.scene3D.resumeControls) {
          this.scene3D.resumeControls();
        }
        
        // Only lock controls if this was an in-game menu (not the start menu)
        // Or if the player just clicked "Start Game"
        if ((this.scene3D.gameStarted || !this.isInitialMenu()) && 
            this.scene3D.controls && 
            !this.scene3D.controls.isLocked) {
          // For pointer lock to work, we need a slight delay
          setTimeout(() => {
            this.scene3D.controls.lock();
          }, 100);
        }
      }
    }
    
    // Switch to a different menu type
    switchMenu(menuType) {
      console.log(`Switching to ${menuType} menu`);
      
      // Store current menu type
      this.menuType = menuType;
      
      // Clear current menu
      this.menuContainer.innerHTML = '';
      
      // Make sure menu is visible - in case we're switching menus
      this.menuContainer.style.opacity = '1';
      this.menuContainer.style.pointerEvents = 'auto';
      
      // Create new menu based on type
      switch (menuType) {
        case 'main':
          this.createMainMenu();
          break;
        case 'save':
          this.createSaveMenu();
          break;
        case 'load':
          this.createLoadMenu();
          break;
        case 'settings':
          this.createSettingsMenu();
          break;
        case 'help':
          this.createHelpMenu();
          break;
        default:
          this.createMainMenu();
      }
      
      // Make sure the menu is now visible
      this.isVisible = true;
    }
    
    // Create the main menu
    createMainMenu() {
      console.log("Creating main menu, isInitialMenu:", this.isInitialMenu());
      
      // Clear container first
      this.menuContainer.innerHTML = '';
      
      // Create title
      const title = document.createElement('h1');
      title.textContent = this.isInitialMenu() ? 'Adventure Awaits' : 'Game Paused';
      title.style.cssText = `
        color: white;
        font-family: 'Cinzel', serif;
        font-size: 42px;
        margin-bottom: 40px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      `;
      this.menuContainer.appendChild(title);
      
      // Add brief instructions if this is the initial menu
      if (this.isInitialMenu()) {
        const instructions = document.createElement('div');
        instructions.style.cssText = `
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
          margin-bottom: 40px;
          font-size: 18px;
          line-height: 1.6;
        `;
        instructions.innerHTML = `
          <div>WASD or Arrow Keys to move • Mouse to look • Shift to sprint</div>
          <div>E to interact • I for inventory • P for party • ESC to pause</div>
        `;
        this.menuContainer.appendChild(instructions);
      }
      
      // Create cards container
      this.cardsContainer = document.createElement('div');
      this.cardsContainer.className = 'menu-cards';
      this.cardsContainer.style.cssText = `
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 20px;
        max-width: 800px;
        perspective: 1000px;
      `;
      this.menuContainer.appendChild(this.cardsContainer);
      
      // Define menu options - we're adding a console log to track which menu we're showing
      let menuOptions;
      
      if (this.isInitialMenu()) {
        console.log("Showing INITIAL menu options");
        menuOptions = [
          { id: 'play', label: 'Start Game', icon: 'play_arrow', handler: () => {
              console.log("Start Game clicked");
              // Set game as started when player clicks play
              if (this.scene3D) {
                this.scene3D.gameStarted = true;
                this.scene3D.initialMenu = false;
              }
              this.hide();
            }
          },
          { id: 'save', label: 'Save Game', icon: 'save', handler: () => {
              console.log("Save Game clicked");
              this.switchMenu('save');
            }
          },
          { id: 'load', label: 'Load Game', icon: 'folder_open', handler: () => {
              console.log("Load Game clicked");
              this.switchMenu('load');
            }
          },
          { id: 'party', label: 'Party Manager', icon: 'groups', handler: () => {
              console.log("Party Manager clicked");
              this.openPartyManager();
            }
          },
          { id: 'settings', label: 'Settings', icon: 'settings', handler: () => {
              console.log("Settings clicked");
              this.switchMenu('settings');
            }
          },
          { id: 'help', label: 'How to Play', icon: 'help_outline', handler: () => {
              console.log("Help clicked");
              this.switchMenu('help');
            }
          },
          { id: 'exit', label: 'Exit Game', icon: 'exit_to_app', handler: () => {
              console.log("Exit clicked");
              this.confirmExit();
            }
          }
        ];
      } else {
        console.log("Showing IN-GAME menu options");
        menuOptions = [
          { id: 'continue', label: 'Continue', icon: 'play_arrow', handler: () => {
              console.log("Continue clicked");
              this.hide();
            }
          },
          { id: 'save', label: 'Save Game', icon: 'save', handler: () => {
              console.log("Save Game clicked");
              this.switchMenu('save');
            }
          },
          { id: 'load', label: 'Load Game', icon: 'folder_open', handler: () => {
              console.log("Load Game clicked");
              this.switchMenu('load');
            }
          },
          { id: 'party', label: 'Party Manager', icon: 'groups', handler: () => {
              console.log("Party Manager clicked");
              this.openPartyManager();
            }
          },
          { id: 'settings', label: 'Settings', icon: 'settings', handler: () => {
              console.log("Settings clicked");
              this.switchMenu('settings');
            }
          },
          { id: 'help', label: 'How to Play', icon: 'help_outline', handler: () => {
              console.log("Help clicked");
              this.switchMenu('help');
            }
          },
          { id: 'exit', label: 'Exit Game', icon: 'exit_to_app', handler: () => {
              console.log("Exit clicked");
              this.confirmExit();
            }
          }
        ];
      }
      
      // Create menu cards
      menuOptions.forEach(option => this.createMenuCard(option));
      
      // Add click-to-start message if initial menu
      if (this.isInitialMenu()) {
        const clickMessage = document.createElement('div');
        clickMessage.textContent = 'Click anywhere to begin your adventure';
        clickMessage.style.cssText = `
          color: rgba(255, 255, 255, 0.6);
          margin-top: 30px;
          font-size: 16px;
        `;
        this.menuContainer.appendChild(clickMessage);
        
        // Allow clicking anywhere to start
        const handleBackgroundClick = (e) => {
          // Only hide if clicking the background (not a card)
          if (e.target === this.menuContainer || e.target === clickMessage) {
            console.log("Background clicked, starting game");
            if (this.scene3D) {
              this.scene3D.gameStarted = true;
              this.scene3D.initialMenu = false;
              
              // After a brief delay to allow state to update, lock controls
              setTimeout(() => {
                if (this.scene3D.controls && !this.scene3D.controls.isLocked) {
                  this.scene3D.controls.lock();
                }
              }, 200);
            }
            this.hide();
            // Remove this event listener after first use
            this.menuContainer.removeEventListener('click', handleBackgroundClick);
          }
        };
        
        this.menuContainer.addEventListener('click', handleBackgroundClick);
      }
      
      // Add version info
      const versionInfo = document.createElement('div');
      versionInfo.textContent = 'v0.9.0 Beta';
      versionInfo.style.cssText = `
        color: rgba(255, 255, 255, 0.5);
        position: absolute;
        bottom: 20px;
        right: 20px;
        font-size: 14px;
      `;
      this.menuContainer.appendChild(versionInfo);
    }
    
    // Create a menu card
    createMenuCard(option) {
      // Calculate tilt angle based on option ID (consistent per option)
      // This creates a random but consistent tilt between -5 and 5 degrees
      const idNum = option.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const tiltAngle = ((idNum % 11) - 5);
      
      const card = document.createElement('div');
      card.className = 'menu-card';
      card.id = `menu-option-${option.id}`;
      card.style.cssText = `
        background: rgba(40, 44, 52, 0.8);
        border: 2px solid #4a5568;
        border-radius: 10px;
        width: 180px;
        height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        transform-style: preserve-3d;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        transform: rotate(${tiltAngle}deg);
        margin: 0 8px 16px 8px; /* Add margin for the tilt */
      `;
      
      // Icon
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = option.icon;
      icon.style.cssText = `
        font-size: 48px;
        color: #90cdf4;
        margin-bottom: 16px;
        transition: transform 0.3s ease;
      `;
      card.appendChild(icon);
      
      // Label
      const label = document.createElement('div');
      label.textContent = option.label;
      label.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: bold;
        transition: transform 0.3s ease;
      `;
      card.appendChild(label);
      
      // Hover effect - tilt card
      card.addEventListener('mouseenter', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `rotate(${tiltAngle}deg) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05) translateY(-5px)`;
        card.style.boxShadow = `0 15px 30px rgba(0, 0, 0, 0.4)`;
        icon.style.transform = `translateZ(20px)`;
        label.style.transform = `translateZ(15px)`;
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = `rotate(${tiltAngle}deg) perspective(1000px) rotateX(0) rotateY(0) scale(1)`;
        card.style.boxShadow = `0 10px 20px rgba(0, 0, 0, 0.3)`;
        icon.style.transform = `translateZ(0)`;
        label.style.transform = `translateZ(0)`;
      });
      
      // Click handler
      card.addEventListener('click', option.handler);
      
      // Add to container
      this.cardsContainer.appendChild(card);
      
      return card;
    }
    
    // Check if this is the initial menu (shown at game start)
    isInitialMenu() {
      // If the scene has a specific initialMenu flag, use that
      if (this.scene3D.hasOwnProperty('initialMenu')) {
        return this.scene3D.initialMenu;
      }
      
      // Otherwise, check if the game has started or if controls are locked (indicating in-game)
      // Controls might not be locked in settings menus, so primarily use gameStarted
      return !this.scene3D.gameStarted;
    }
    
    // Create the settings menu
    createSettingsMenu() {
      // Create title
      const title = document.createElement('h1');
      title.textContent = 'Settings';
      title.style.cssText = `
        color: white;
        font-family: 'Cinzel', serif;
        font-size: 42px;
        margin-bottom: 30px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      `;
      this.menuContainer.appendChild(title);
      
      // Create settings container
      const settingsContainer = document.createElement('div');
      settingsContainer.style.cssText = `
        background: rgba(30, 34, 42, 0.8);
        border-radius: 10px;
        padding: 20px;
        width: 500px;
        max-width: 90%;
        margin-bottom: 30px;
      `;
      this.menuContainer.appendChild(settingsContainer);
      
      // Add settings options
      this.addGraphicsSettings(settingsContainer);
      this.addAudioSettings(settingsContainer);
      this.addControlsSettings(settingsContainer);
      
      // Add back button
      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Menu';
      backButton.style.cssText = `
        background: #4a5568;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      backButton.addEventListener('mouseover', () => {
        backButton.style.background = '#2d3748';
      });
      backButton.addEventListener('mouseout', () => {
        backButton.style.background = '#4a5568';
      });
      backButton.addEventListener('click', () => {
        this.switchMenu('main');
      });
      this.menuContainer.appendChild(backButton);
    }
    
    // Add graphics settings
    addGraphicsSettings(container) {
      const section = document.createElement('div');
      section.style.cssText = `
        margin-bottom: 20px;
      `;
      
      const heading = document.createElement('h3');
      heading.textContent = 'Graphics';
      heading.style.cssText = `
        color: white;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 5px;
      `;
      section.appendChild(heading);
      
      // Quality preset selector
      const qualityRow = document.createElement('div');
      qualityRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        color: white;
      `;
      
      const qualityLabel = document.createElement('label');
      qualityLabel.textContent = 'Quality:';
      qualityRow.appendChild(qualityLabel);
      
      const qualitySelect = document.createElement('select');
      qualitySelect.style.cssText = `
        background: #2d3748;
        color: white;
        border: 1px solid #4a5568;
        border-radius: 4px;
        padding: 5px 10px;
      `;
      
      ['Auto', 'Low', 'Medium', 'High'].forEach(level => {
        const option = document.createElement('option');
        option.value = level.toLowerCase();
        option.textContent = level;
        qualitySelect.appendChild(option);
      });
      
      // Set current value
      let currentQuality = 'auto';
      if (this.scene3D.preferences && this.scene3D.preferences.qualityPreset) {
        currentQuality = this.scene3D.preferences.qualityPreset;
      }
      qualitySelect.value = currentQuality;
      
      qualitySelect.addEventListener('change', () => {
        if (this.scene3D.setQualityLevel) {
          this.scene3D.setQualityLevel(qualitySelect.value);
        }
      });
      
      qualityRow.appendChild(qualitySelect);
      section.appendChild(qualityRow);
      
      // Shadows toggle
      this.addToggleSetting(
        section, 
        'Shadows:', 
        this.scene3D.preferences?.shadowsEnabled ?? false,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.shadowsEnabled = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
          }
        }
      );
      
      // Anti-aliasing toggle
      this.addToggleSetting(
        section, 
        'Anti-aliasing:', 
        this.scene3D.preferences?.antialiasEnabled ?? true,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.antialiasEnabled = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
          }
        }
      );
      
      // FPS Counter toggle
      this.addToggleSetting(
        section, 
        'FPS Counter:', 
        this.scene3D.preferences?.showFps ?? false,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.showFps = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
            // Update FPS counter visibility
            if (this.scene3D.showStats !== value) {
              this.scene3D.toggleStats();
            }
          }
        }
      );
      
      container.appendChild(section);
    }
    
    // Add audio settings
    addAudioSettings(container) {
      const section = document.createElement('div');
      section.style.cssText = `
        margin-bottom: 20px;
      `;
      
      const heading = document.createElement('h3');
      heading.textContent = 'Audio';
      heading.style.cssText = `
        color: white;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 5px;
      `;
      section.appendChild(heading);
      
      // Add volume slider
      this.addSliderSetting(
        section,
        'Master Volume:',
        this.scene3D.preferences?.masterVolume ?? 100,
        0,
        100,
        1,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.masterVolume = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
            // Apply volume if supported
            if (this.scene3D.setMasterVolume) {
              this.scene3D.setMasterVolume(value / 100);
            }
          }
        }
      );
      
      // Sound effects toggle
      this.addToggleSetting(
        section, 
        'Sound Effects:', 
        this.scene3D.preferences?.soundEffectsEnabled ?? true,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.soundEffectsEnabled = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
          }
        }
      );
      
      container.appendChild(section);
    }
    
    // Add controls settings
    addControlsSettings(container) {
      const section = document.createElement('div');
      section.style.cssText = `
        margin-bottom: 20px;
      `;
      
      const heading = document.createElement('h3');
      heading.textContent = 'Controls';
      heading.style.cssText = `
        color: white;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 5px;
      `;
      section.appendChild(heading);
      
      // Movement speed slider
      this.addSliderSetting(
        section,
        'Movement Speed:',
        this.scene3D.preferences?.movementSpeed ?? 1.0,
        0.5,
        2.0,
        0.1,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.movementSpeed = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
            // Apply movement speed if supported
            if (this.scene3D.moveState) {
              this.scene3D.moveState.baseSpeed = 0.025 * value;
              if (!this.scene3D.moveState.sprint) {
                this.scene3D.moveState.speed = this.scene3D.moveState.baseSpeed;
              }
            }
          }
        }
      );
      
      // Mouse sensitivity slider (if supported)
      this.addSliderSetting(
        section,
        'Mouse Sensitivity:',
        this.scene3D.preferences?.mouseSensitivity ?? 1.0,
        0.1,
        2.0,
        0.1,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.mouseSensitivity = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
            // Apply mouse sensitivity if supported
            // (This would need to be implemented in Scene3DController)
          }
        }
      );
      
      // Invert Y axis toggle
      this.addToggleSetting(
        section, 
        'Invert Y-Axis:', 
        this.scene3D.preferences?.invertYAxis ?? false,
        (value) => {
          if (this.scene3D.preferences) {
            this.scene3D.preferences.invertYAxis = value;
            localStorage.setItem('appPreferences', JSON.stringify(this.scene3D.preferences));
            // Apply invert Y setting if supported
            // (This would need to be implemented in Scene3DController)
          }
        }
      );
      
      container.appendChild(section);
    }
    
    // Helper to add toggle setting
    addToggleSetting(container, label, initialValue, onChange) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        color: white;
      `;
      
      const textLabel = document.createElement('label');
      textLabel.textContent = label;
      row.appendChild(textLabel);
      
      const toggle = document.createElement('div');
      toggle.style.cssText = `
        width: 50px;
        height: 24px;
        background: ${initialValue ? '#4299e1' : '#2d3748'};
        border-radius: 12px;
        position: relative;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      
      const slider = document.createElement('div');
      slider.style.cssText = `
        position: absolute;
        top: 2px;
        left: ${initialValue ? '26px' : '2px'};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        transition: left 0.2s ease;
      `;
      toggle.appendChild(slider);
      
      let isOn = initialValue;
      toggle.addEventListener('click', () => {
        isOn = !isOn;
        toggle.style.background = isOn ? '#4299e1' : '#2d3748';
        slider.style.left = isOn ? '26px' : '2px';
        if (onChange) onChange(isOn);
      });
      
      row.appendChild(toggle);
      container.appendChild(row);
      
      return row;
    }
    
    // Helper to add slider setting
    addSliderSetting(container, label, initialValue, min, max, step, onChange) {
      const row = document.createElement('div');
      row.style.cssText = `
        margin-bottom: 15px;
        color: white;
      `;
      
      const textLabel = document.createElement('label');
      textLabel.textContent = label;
      textLabel.style.marginBottom = '5px';
      textLabel.style.display = 'block';
      row.appendChild(textLabel);
      
      const sliderContainer = document.createElement('div');
      sliderContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
      `;
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = initialValue;
      slider.style.cssText = `
        flex: 1;
        -webkit-appearance: none;
        height: 8px;
        border-radius: 4px;
        background: #2d3748;
        outline: none;
      `;
      
      // Style the slider thumb
      const thumbStyle = `
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
      `;
      
      // Apply thumb styles for different browsers
      const style = document.createElement('style');
      style.textContent = `
        input[type=range]::-webkit-slider-thumb {
          ${thumbStyle}
        }
        input[type=range]::-moz-range-thumb {
          ${thumbStyle}
        }
        input[type=range]::-ms-thumb {
          ${thumbStyle}
        }
      `;
      document.head.appendChild(style);
      
      const valueDisplay = document.createElement('div');
      valueDisplay.textContent = initialValue;
      valueDisplay.style.cssText = `
        width: 40px;
        text-align: center;
      `;
      
      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
        if (onChange) onChange(parseFloat(slider.value));
      });
      
      sliderContainer.appendChild(slider);
      sliderContainer.appendChild(valueDisplay);
      row.appendChild(sliderContainer);
      container.appendChild(row);
      
      return row;
    }
    
    // Create the help menu
    createHelpMenu() {
      // Create title
      const title = document.createElement('h1');
      title.textContent = 'How to Play';
      title.style.cssText = `
        color: white;
        font-family: 'Cinzel', serif;
        font-size: 42px;
        margin-bottom: 30px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      `;
      this.menuContainer.appendChild(title);
      
      // Create help content
      const helpContent = document.createElement('div');
      helpContent.style.cssText = `
        background: rgba(30, 34, 42, 0.8);
        border-radius: 10px;
        padding: 20px;
        width: 600px;
        max-width: 90%;
        margin-bottom: 30px;
        color: white;
        max-height: 60vh;
        overflow-y: auto;
      `;
      
      helpContent.innerHTML = `
        <h3>Controls</h3>
        <div class="help-section" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">WASD</div>
            <div>Move around</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">Mouse</div>
            <div>Look around</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">Shift</div>
            <div>Sprint</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">Space</div>
            <div>Jump</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">E</div>
            <div>Interact with objects and NPCs</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">I</div>
            <div>Open inventory</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">P</div>
            <div>Party Manager</div>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="background: #2d3748; color: white; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center; font-family: monospace; margin-right: 12px;">ESC</div>
            <div>Open/close game menu</div>
          </div>
        </div>
        
        <h3>Exploration</h3>
        <div style="margin-bottom: 20px; line-height: 1.6;">
          <p>Explore the 3D environment to discover:</p>
          <ul style="margin-left: 20px; margin-top: 8px;">
            <li>Interactive objects that can be picked up and used</li>
            <li>Doors that lead to new areas</li>
            <li>Teleporters that can transport you to different locations</li>
            <li>Monster encounters for combat or recruitment</li>
            <li>Special items and artwork that provide lore and story</li>
          </ul>
        </div>
        
        <h3>Monster Party</h3>
        <div style="margin-bottom: 20px; line-height: 1.6;">
          <p>You can recruit monsters to your party for assistance:</p>
          <ul style="margin-left: 20px; margin-top: 8px;">
            <li>Approach monsters and press E to interact</li>
            <li>Use the Party Manager (P key) to organize your monsters</li>
            <li>Different monsters have different abilities and affinities</li>
            <li>Some monsters work better together than others</li>
          </ul>
        </div>
        
        <h3>Items & Inventory</h3>
        <div style="margin-bottom: 20px; line-height: 1.6;">
          <p>Manage your collected items:</p>
          <ul style="margin-left: 20px; margin-top: 8px;">
            <li>Press E to pick up items you find</li>
            <li>Open your inventory with the I key</li>
            <li>Items can be used, equipped, or placed in the world</li>
            <li>Some items provide special abilities or bonuses</li>
          </ul>
        </div>
      `;
      
      this.menuContainer.appendChild(helpContent);
      
      // Add back button
      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Menu';
      backButton.style.cssText = `
        background: #4a5568;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      backButton.addEventListener('mouseover', () => {
        backButton.style.background = '#2d3748';
      });
      backButton.addEventListener('mouseout', () => {
        backButton.style.background = '#4a5568';
      });
      backButton.addEventListener('click', () => {
        this.switchMenu('main');
      });
      this.menuContainer.appendChild(backButton);
    }
    
    // Create the save game menu
    createSaveMenu() {
      console.log("Creating save game menu");
      
      // First clear the container
      this.menuContainer.innerHTML = '';
      
      // Create title
      const title = document.createElement('h1');
      title.textContent = 'Save Game';
      title.style.cssText = `
        color: white;
        font-family: 'Cinzel', serif;
        font-size: 42px;
        margin-bottom: 30px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      `;
      this.menuContainer.appendChild(title);
      
      // Create save slots container
      const saveSlotsContainer = document.createElement('div');
      saveSlotsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
        width: 500px;
        max-width: 90%;
        margin-bottom: 30px;
      `;
      
      // Load any existing saves from localStorage
      const savedGames = this.getSavedGames();
      console.log("Found saved games:", Object.keys(savedGames).length);
      
      // Create save slots (3 slots for now)
      for (let i = 1; i <= 3; i++) {
        const saveSlot = this.createSaveSlot(i, savedGames[`slot${i}`]);
        saveSlotsContainer.appendChild(saveSlot);
      }
      
      this.menuContainer.appendChild(saveSlotsContainer);
      
      // Add back button
      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Menu';
      backButton.style.cssText = `
        background: #4a5568;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      backButton.addEventListener('mouseover', () => {
        backButton.style.background = '#2d3748';
      });
      backButton.addEventListener('mouseout', () => {
        backButton.style.background = '#4a5568';
      });
      backButton.addEventListener('click', () => {
        this.switchMenu('main');
      });
      this.menuContainer.appendChild(backButton);
    }
    
    // Helper method to capture a screenshot thumbnail from the current scene
    // captureScreenshot(width = 200, height = 120) {
    //   if (!this.scene3D || !this.scene3D.renderer) {
    //     console.error("Cannot capture screenshot: renderer not available");
    //     return null;
    //   }
      
    //   try {
    //     // Create a small canvas for the thumbnail
    //     const canvas = document.createElement('canvas');
    //     canvas.width = width;
    //     canvas.height = height;
    //     const context = canvas.getContext('2d');
        
    //     // Get the original renderer canvas
    //     const rendererCanvas = this.scene3D.renderer.domElement;
        
    //     // Draw the current frame to our thumbnail canvas, resizing it
    //     context.drawImage(rendererCanvas, 0, 0, width, height);
        
    //     // Convert to base64 data URL (JPEG for smaller size)
    //     return canvas.toDataURL('image/jpeg', 0.7);
    //   } catch (error) {
    //     console.error("Error capturing screenshot:", error);
    //     return null;
    //   }

      
    // }
    
// Helper method to capture a screenshot thumbnail from the current scene
captureScreenshot(width = 200, height = 120) {
    if (!this.scene3D || !this.scene3D.renderer || !this.scene3D.scene || !this.scene3D.camera) {
      console.error("Cannot capture screenshot: renderer not available");
      return null;
    }
    
    try {
      // First, make sure we render the latest state of the scene
      this.scene3D.renderer.render(this.scene3D.scene, this.scene3D.camera);
      
      // Get the original renderer canvas
      const rendererCanvas = this.scene3D.renderer.domElement;
      
      // Create a temp canvas for the screenshot at desired dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempContext = tempCanvas.getContext('2d');
      
      // Draw the current frame to our screenshot canvas, resizing it
      // The renderer canvas might be transparent, so fill with black first
      tempContext.fillStyle = '#000000';
      tempContext.fillRect(0, 0, width, height);
      tempContext.drawImage(rendererCanvas, 0, 0, width, height);
      
      // Convert to data URL (use JPEG for smaller size)
      const screenshotDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
      
      // Debug info
      console.log("Screenshot captured successfully:", 
                   `Renderer Canvas: ${rendererCanvas.width}x${rendererCanvas.height}`, 
                   `Screenshot: ${width}x${height}`);
      
      return screenshotDataUrl;
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      return null;
    }
  }

    // Helper method to get active party token images
    getActivePartyTokens(maxTokens = 3) {
      const tokens = [];
      
      try {
        // Check if party manager exists and has active party
        if (window.partyManager && window.partyManager.party && 
            window.partyManager.party.active && 
            window.partyManager.party.active.length > 0) {
              
          // Get up to maxTokens active party members
          for (let i = 0; i < Math.min(maxTokens, window.partyManager.party.active.length); i++) {
            const monster = window.partyManager.party.active[i];
            if (monster) {
              // Get token image source - could be data URL or image path
              const tokenSource = monster.token?.data || 
                                 (typeof monster.token === 'string' ? monster.token : null);
              
              if (tokenSource) {
                tokens.push({
                  id: monster.id,
                  name: monster.name,
                  tokenSource: tokenSource,
                  level: monster.level || 1,
                  type: monster.type || 'unknown'
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error getting party tokens:", error);
      }
      
      return tokens;
    }
    
    // Create a save slot card
    createSaveSlot(slotNumber, savedData) {
      // Generate a random tilt for the card
      const tiltAngle = (Math.random() * 4) - 2;
      
      const slotCard = document.createElement('div');
      slotCard.className = 'save-slot';
      slotCard.style.cssText = `
        background: rgba(40, 44, 52, 0.8);
        border: 2px solid ${savedData ? '#4299e1' : '#4a5568'};
        border-radius: 10px;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transform: rotate(${tiltAngle}deg);
        transform-style: preserve-3d;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        position: relative;
        width: 100%;
      `;
      
      // If we have a screenshot, use it as a background
      if (savedData && savedData.screenshot) {
        const bgOverlay = document.createElement('div');
        bgOverlay.style.cssText = `
          position: absolute;
          inset: 0;
          background-image: url(${savedData.screenshot});
          background-size: cover;
          background-position: center;
          opacity: 0.15;
          filter: blur(2px);
          z-index: 0;
        `;
        slotCard.appendChild(bgOverlay);
      }
      
      // Left side with slot info and screenshot
      const slotInfo = document.createElement('div');
      slotInfo.style.cssText = `
        display: flex;
        flex-direction: column;
        z-index: 1;
        flex: 1;
      `;
      
      // Slot title
      const slotTitle = document.createElement('div');
      slotTitle.textContent = `Save Slot ${slotNumber}`;
      slotTitle.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 6px;
      `;
      slotInfo.appendChild(slotTitle);
      
      // Slot details
      const slotDetails = document.createElement('div');
      slotDetails.style.cssText = `
        color: #a0aec0;
        font-size: 14px;
        margin-bottom: 10px;
      `;
      
      if (savedData) {
        const saveDate = new Date(savedData.timestamp);
        slotDetails.textContent = `${savedData.locationName || 'Unknown Location'} • ${saveDate.toLocaleString()}`;
      } else {
        slotDetails.textContent = 'Empty slot';
      }
      
      slotInfo.appendChild(slotDetails);
      
      // Add screenshot if available
      if (savedData && savedData.screenshot) {
        const screenshotContainer = document.createElement('div');
        screenshotContainer.style.cssText = `
          width: 200px;
          height: 120px;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 10px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s ease;
        `;
        
        const screenshot = document.createElement('img');
        screenshot.src = savedData.screenshot;
        screenshot.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        
        screenshotContainer.appendChild(screenshot);
        slotInfo.appendChild(screenshotContainer);
      }
      
      // Add party tokens if available
      if (savedData && savedData.partyTokens && savedData.partyTokens.length > 0) {
        const partyContainer = document.createElement('div');
        partyContainer.style.cssText = `
          display: flex;
          gap: 8px;
          margin-top: 8px;
        `;
        
        savedData.partyTokens.forEach(token => {
          const tokenContainer = document.createElement('div');
          tokenContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid #4299e1;
            background-color: #2d3748;
            position: relative;
            transition: transform 0.2s ease;
          `;
          
          // Token image
          if (token.tokenSource) {
            const tokenImg = document.createElement('img');
            tokenImg.src = token.tokenSource;
            tokenImg.style.cssText = `
              width: 100%;
              height: 100%;
              object-fit: cover;
            `;
            tokenContainer.appendChild(tokenImg);
          } else {
            // Fallback if no token image
            tokenContainer.textContent = token.name.charAt(0);
            tokenContainer.style.display = 'flex';
            tokenContainer.style.alignItems = 'center';
            tokenContainer.style.justifyContent = 'center';
            tokenContainer.style.color = 'white';
            tokenContainer.style.fontWeight = 'bold';
          }
          
          // Level badge
          const levelBadge = document.createElement('div');
          levelBadge.textContent = token.level || 1;
          levelBadge.style.cssText = `
            position: absolute;
            bottom: -2px;
            right: -2px;
            background-color: #4299e1;
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            border: 1px solid white;
          `;
          tokenContainer.appendChild(levelBadge);
          
          // Hover effect
          tokenContainer.addEventListener('mouseenter', () => {
            tokenContainer.style.transform = 'scale(1.15)';
          });
          
          tokenContainer.addEventListener('mouseleave', () => {
            tokenContainer.style.transform = 'scale(1)';
          });
          
          // Add tooltip
          tokenContainer.title = `${token.name} (Lvl ${token.level})`;
          
          partyContainer.appendChild(tokenContainer);
        });
        
        slotInfo.appendChild(partyContainer);
      }
      
      slotCard.appendChild(slotInfo);
      
      // Right side with save button
      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
      saveButton.style.cssText = `
        background: #4299e1;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 8px 16px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s ease;
        z-index: 1;
        margin-left: 16px;
      `;
      
      saveButton.addEventListener('mouseover', () => {
        saveButton.style.background = '#3182ce';
      });
      
      saveButton.addEventListener('mouseout', () => {
        saveButton.style.background = '#4299e1';
      });
      
      saveButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveGame(slotNumber);
      });
      
      slotCard.appendChild(saveButton);
      
      // Hover effect
      slotCard.addEventListener('mouseenter', () => {
        slotCard.style.transform = `rotate(${tiltAngle}deg) scale(1.03) translateY(-5px)`;
        slotCard.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
        
        // Enhance screenshot on hover if it exists
        const screenshot = slotCard.querySelector('img');
        if (screenshot) {
          screenshot.style.transform = 'scale(1.05)';
        }
      });
      
      slotCard.addEventListener('mouseleave', () => {
        slotCard.style.transform = `rotate(${tiltAngle}deg)`;
        slotCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        
        // Reset screenshot
        const screenshot = slotCard.querySelector('img');
        if (screenshot) {
          screenshot.style.transform = 'scale(1)';
        }
      });
      
      return slotCard;
    }
    
    // Create the load game menu
    createLoadMenu() {
      // Create title
      const title = document.createElement('h1');
      title.textContent = 'Load Game';
      title.style.cssText = `
        color: white;
        font-family: 'Cinzel', serif;
        font-size: 42px;
        margin-bottom: 30px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      `;
      this.menuContainer.appendChild(title);
      
      // Create load slots container
      const loadSlotsContainer = document.createElement('div');
      loadSlotsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
        width: 500px;
        max-width: 90%;
        margin-bottom: 30px;
      `;
      
      // Load any existing saves from localStorage
      const savedGames = this.getSavedGames();
      
      // Create load slots (3 slots for now)
      for (let i = 1; i <= 3; i++) {
        const loadSlot = this.createLoadSlot(i, savedGames[`slot${i}`]);
        loadSlotsContainer.appendChild(loadSlot);
      }
      
      this.menuContainer.appendChild(loadSlotsContainer);
      
      // Add back button
      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Menu';
      backButton.style.cssText = `
        background: #4a5568;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      backButton.addEventListener('mouseover', () => {
        backButton.style.background = '#2d3748';
      });
      backButton.addEventListener('mouseout', () => {
        backButton.style.background = '#4a5568';
      });
      backButton.addEventListener('click', () => {
        this.switchMenu('main');
      });
      this.menuContainer.appendChild(backButton);
    }
    
    // Create a load slot card
    createLoadSlot(slotNumber, savedData) {
      // Generate a random tilt for the card
      const tiltAngle = (Math.random() * 4) - 2;
      
      const slotCard = document.createElement('div');
      slotCard.className = 'load-slot';
      slotCard.style.cssText = `
        background: rgba(40, 44, 52, 0.8);
        border: 2px solid ${savedData ? '#4299e1' : '#4a5568'};
        border-radius: 10px;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: ${savedData ? 'pointer' : 'not-allowed'};
        transform: rotate(${tiltAngle}deg);
        transform-style: preserve-3d;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        opacity: ${savedData ? '1' : '0.7'};
        overflow: hidden;
        position: relative;
        width: 100%;
      `;
      
      // If we have a screenshot, use it as a background
      if (savedData && savedData.screenshot) {
        const bgOverlay = document.createElement('div');
        bgOverlay.style.cssText = `
          position: absolute;
          inset: 0;
          background-image: url(${savedData.screenshot});
          background-size: cover;
          background-position: center;
          opacity: 0.15;
          filter: blur(2px);
          z-index: 0;
        `;
        slotCard.appendChild(bgOverlay);
      }
      
      // Left side with slot info and screenshot
      const slotInfo = document.createElement('div');
      slotInfo.style.cssText = `
        display: flex;
        flex-direction: column;
        z-index: 1;
        flex: 1;
      `;
      
      // Slot title
      const slotTitle = document.createElement('div');
      slotTitle.textContent = `Save Slot ${slotNumber}`;
      slotTitle.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 6px;
      `;
      slotInfo.appendChild(slotTitle);
      
      // Slot details
      const slotDetails = document.createElement('div');
      slotDetails.style.cssText = `
        color: #a0aec0;
        font-size: 14px;
        margin-bottom: 10px;
      `;
      
      if (savedData) {
        const saveDate = new Date(savedData.timestamp);
        slotDetails.textContent = `${savedData.locationName || 'Unknown Location'} • ${saveDate.toLocaleString()}`;
      } else {
        slotDetails.textContent = 'Empty slot';
      }
      
      slotInfo.appendChild(slotDetails);
      
      // Add screenshot if available
      if (savedData && savedData.screenshot) {
        const screenshotContainer = document.createElement('div');
        screenshotContainer.style.cssText = `
          width: 200px;
          height: 120px;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 10px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s ease;
        `;
        
        const screenshot = document.createElement('img');
        screenshot.src = savedData.screenshot;
        screenshot.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        
        screenshotContainer.appendChild(screenshot);
        slotInfo.appendChild(screenshotContainer);
      }
      
      // Add party tokens if available
      if (savedData && savedData.partyTokens && savedData.partyTokens.length > 0) {
        const partyContainer = document.createElement('div');
        partyContainer.style.cssText = `
          display: flex;
          gap: 8px;
          margin-top: 8px;
        `;
        
        savedData.partyTokens.forEach(token => {
          const tokenContainer = document.createElement('div');
          tokenContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid #4299e1;
            background-color: #2d3748;
            position: relative;
            transition: transform 0.2s ease;
          `;
          
          // Token image
          if (token.tokenSource) {
            const tokenImg = document.createElement('img');
            tokenImg.src = token.tokenSource;
            tokenImg.style.cssText = `
              width: 100%;
              height: 100%;
              object-fit: cover;
            `;
            tokenContainer.appendChild(tokenImg);
          } else {
            // Fallback if no token image
            tokenContainer.textContent = token.name.charAt(0);
            tokenContainer.style.display = 'flex';
            tokenContainer.style.alignItems = 'center';
            tokenContainer.style.justifyContent = 'center';
            tokenContainer.style.color = 'white';
            tokenContainer.style.fontWeight = 'bold';
          }
          
          // Level badge
          const levelBadge = document.createElement('div');
          levelBadge.textContent = token.level || 1;
          levelBadge.style.cssText = `
            position: absolute;
            bottom: -2px;
            right: -2px;
            background-color: #4299e1;
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            border: 1px solid white;
          `;
          tokenContainer.appendChild(levelBadge);
          
          // Hover effect
          tokenContainer.addEventListener('mouseenter', () => {
            tokenContainer.style.transform = 'scale(1.15)';
          });
          
          tokenContainer.addEventListener('mouseleave', () => {
            tokenContainer.style.transform = 'scale(1)';
          });
          
          // Add tooltip
          tokenContainer.title = `${token.name} (Lvl ${token.level})`;
          
          partyContainer.appendChild(tokenContainer);
        });
        
        slotInfo.appendChild(partyContainer);
      }
      
      slotCard.appendChild(slotInfo);
      
      // Right side with load button (only if there's saved data)
      if (savedData) {
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load';
        loadButton.style.cssText = `
          background: #4299e1;
          color: white;
          border: none;
          border-radius: 5px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s ease;
          z-index: 1;
          margin-left: 16px;
        `;
        
        loadButton.addEventListener('mouseover', () => {
          loadButton.style.background = '#3182ce';
        });
        
        loadButton.addEventListener('mouseout', () => {
          loadButton.style.background = '#4299e1';
        });
        
        loadButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.loadGame(slotNumber);
        });
        
        slotCard.appendChild(loadButton);
        
        // Click handler for the entire card
        slotCard.addEventListener('click', () => {
          this.loadGame(slotNumber);
        });
        
        // Hover effect
        slotCard.addEventListener('mouseenter', () => {
          slotCard.style.transform = `rotate(${tiltAngle}deg) scale(1.03) translateY(-5px)`;
          slotCard.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
          
          // Enhance screenshot on hover if it exists
          const screenshot = slotCard.querySelector('img');
          if (screenshot) {
            screenshot.style.transform = 'scale(1.05)';
          }
        });
        
        slotCard.addEventListener('mouseleave', () => {
          slotCard.style.transform = `rotate(${tiltAngle}deg)`;
          slotCard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
          
          // Reset screenshot
          const screenshot = slotCard.querySelector('img');
          if (screenshot) {
            screenshot.style.transform = 'scale(1)';
          }
        });
      }
      
      return slotCard;
    }
    
    // Helper method to get saved games from localStorage
    getSavedGames() {
      try {
        const savedGames = localStorage.getItem('savedGames');
        return savedGames ? JSON.parse(savedGames) : {};
      } catch (error) {
        console.error('Error loading saved games:', error);
        return {};
      }
    }
    
    // Save the current game state
    saveGame(slotNumber) {
      console.log(`Saving game to slot ${slotNumber}`);
      
      // Try to get current location name
      let locationName = 'Current Location';
      if (this.scene3D.currentLocation) {
        locationName = this.scene3D.currentLocation;
      }
      
      // Capture a screenshot thumbnail
      const screenshot = this.captureScreenshot(200, 120);
      
      // Get active party tokens
      const partyTokens = this.getActivePartyTokens(3);
      
      // Create a save game object
      const saveData = {
        timestamp: Date.now(),
        locationName: locationName,
        screenshot: screenshot,
        partyTokens: partyTokens,
        playerPosition: this.scene3D.camera ? {
          x: this.scene3D.camera.position.x,
          y: this.scene3D.camera.position.y,
          z: this.scene3D.camera.position.z
        } : null,
        playerRotation: this.scene3D.camera ? {
          x: this.scene3D.camera.rotation.x,
          y: this.scene3D.camera.rotation.y,
          z: this.scene3D.camera.rotation.z
        } : null,
        // Game state flags
        gameStarted: true,
        initialMenu: false,
        // Add other game state data as needed
        inventory: this.scene3D.inventory ? 
          Array.from(this.scene3D.inventory.entries()) : []
      };
      
      // Save to localStorage
      try {
        // Get existing saves
        const savedGames = this.getSavedGames();
        
        // Add new save
        savedGames[`slot${slotNumber}`] = saveData;
        
        // Save back to localStorage
        localStorage.setItem('savedGames', JSON.stringify(savedGames));
        
        // Show success notification
        this.showNotification('Game saved successfully!');
        
        // Refresh save menu to show updated state
        this.switchMenu('save');
      } catch (error) {
        console.error('Error saving game:', error);
        this.showNotification('Failed to save game', 'error');
      }
    }
    
    // Load a saved game
    loadGame(slotNumber) {
      console.log(`Loading game from slot ${slotNumber}`);
      
      try {
        // Get saved games
        const savedGames = this.getSavedGames();
        const saveData = savedGames[`slot${slotNumber}`];
        
        if (!saveData) {
          this.showNotification('No save data found', 'error');
          return;
        }
        
        // Apply the save data to the game state
        if (saveData.playerPosition && this.scene3D.camera) {
          this.scene3D.camera.position.set(
            saveData.playerPosition.x,
            saveData.playerPosition.y,
            saveData.playerPosition.z
          );
        }
        
        if (saveData.playerRotation && this.scene3D.camera) {
          this.scene3D.camera.rotation.set(
            saveData.playerRotation.x,
            saveData.playerRotation.y,
            saveData.playerRotation.z
          );
        }
        
        // Restore inventory if available
        if (saveData.inventory && this.scene3D.inventory) {
          // Clear current inventory
          this.scene3D.inventory.clear();
          
          // Restore saved inventory items
          saveData.inventory.forEach(item => {
            if (item && item.length === 2) {
              const [key, value] = item;
              this.scene3D.inventory.set(key, value);
            }
          });
        }
        
        // Set game state flags
        this.scene3D.gameStarted = true;
        this.scene3D.initialMenu = false;
        
        // Hide the menu and resume gameplay
        this.hide();
        
        // Show success notification
        this.showNotification('Game loaded successfully!');
      } catch (error) {
        console.error('Error loading game:', error);
        this.showNotification('Failed to load game', 'error');
      }
    }
    
    // Show a notification message
    showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = 'game-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? 'rgba(72, 187, 120, 0.9)' : 'rgba(245, 101, 101, 0.9)'};
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        font-size: 16px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Fade in
      setTimeout(() => {
        notification.style.opacity = '1';
      }, 10);
      
      // Fade out and remove after delay
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
    
    // Open the party manager
    openPartyManager() {
      console.log("Opening Party Manager");
      
      // Pause controls first to prevent 3D world from moving in background
      if (this.scene3D && this.scene3D.pauseControls) {
        this.scene3D.pauseControls();
      }
      
      // Hide the menu
      this.hide();
      
      // Show the party manager if available
      if (window.partyManager) {
        window.partyManager.showPartyManager();
        
        // Set up an interval to check when the party manager closes
        // so we can resume controls
        const checkForDialog = setInterval(() => {
          const dialog = document.querySelector('sl-dialog[label="Monster Party"]');
          if (!dialog) {
            if (this.scene3D && this.scene3D.resumeControls) {
              this.scene3D.resumeControls();
            }
            clearInterval(checkForDialog);
          }
        }, 100);
      } else {
        this.showNotification('Party Manager not available', 'error');
        
        // Resume controls even if party manager failed to open
        if (this.scene3D && this.scene3D.resumeControls) {
          this.scene3D.resumeControls();
        }
      }
    }
    
    // Show exit confirmation
    confirmExit() {
      // Create container for the modal
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      `;
      
      // Create confirmation modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: #2d3748;
        border-radius: 10px;
        padding: 20px;
        width: 400px;
        max-width: 90%;
        text-align: center;
        transform: rotate(-1deg);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
      `;
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = 'Exit Game?';
      title.style.cssText = `
        color: white;
        font-size: 24px;
        margin-bottom: 15px;
      `;
      modal.appendChild(title);
      
      // Add message
      const message = document.createElement('p');
      message.textContent = 'Are you sure you want to exit? Any unsaved progress will be lost.';
      message.style.cssText = `
        color: #a0aec0;
        margin-bottom: 20px;
      `;
      modal.appendChild(message);
      
      // Add buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 15px;
      `;
      
      // Cancel button
      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancel';
      cancelButton.style.cssText = `
        background: #4a5568;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      cancelButton.addEventListener('mouseover', () => {
        cancelButton.style.background = '#2d3748';
      });
      cancelButton.addEventListener('mouseout', () => {
        cancelButton.style.background = '#4a5568';
      });
      cancelButton.addEventListener('click', () => {
        modalOverlay.remove();
      });
      buttonsContainer.appendChild(cancelButton);
      
      // Exit button
      const exitButton = document.createElement('button');
      exitButton.textContent = 'Exit Game';
      exitButton.style.cssText = `
        background: #e53e3e;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      `;
      exitButton.addEventListener('mouseover', () => {
        exitButton.style.background = '#c53030';
      });
      exitButton.addEventListener('mouseout', () => {
        exitButton.style.background = '#e53e3e';
      });
      exitButton.addEventListener('click', () => {
        // Clean up event listeners
        document.removeEventListener('keydown', this.handleEscapeKey, true);
        
        // Hide the game menu
        this.hide();
        
        // Close the 3D view by finding and closing the drawer
        const drawer = document.querySelector('.drawer-3d-view');
        if (drawer && drawer.hide) {
          drawer.hide();
        }
        
        // Remove the modal
        modalOverlay.remove();
      });
      buttonsContainer.appendChild(exitButton);
      
      modal.appendChild(buttonsContainer);
      modalOverlay.appendChild(modal);
      document.body.appendChild(modalOverlay);
    }
    
    // Clean up the menu system
    dispose() {
      // Remove the menu container if it exists
      if (this.menuContainer && this.menuContainer.parentNode) {
        this.menuContainer.parentNode.removeChild(this.menuContainer);
      }
      
      // Remove event listeners
      document.removeEventListener('keydown', this.handleEscapeKey, true);
      
      // Clean up any other resources
      this.scene3D = null;
      this.container = null;
      this.menuContainer = null;
      this.cardsContainer = null;
    }
  }