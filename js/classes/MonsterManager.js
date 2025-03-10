class MonsterManager {
  constructor(mapEditor) {
    this.mapEditor = mapEditor;
    this.monsterDatabase = this.loadDatabase();
    this.baseTokenUrl = "https://5e.tools/img/bestiary/tokens/";
    // Initialize IndexedDB
    this.dbInitPromise = this.initDatabase();
  }

  // Add this method to initialize the database
  async initDatabase() {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('monster-database', 1);
        
        request.onerror = (event) => {
          console.error('IndexedDB error:', event.target.error);
          // Fall back to localStorage
          this.useLocalStorage = true;
          resolve(false);
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('Database opened successfully');
          resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('monsters')) {
            db.createObjectStore('monsters', { keyPath: 'id' });
            console.log('Created monsters object store');
          }
        };
      });
    } catch (error) {
      console.error('Error initializing database:', error);
      this.useLocalStorage = true;
      return false;
    }
  }

  async storeMonsterImage(imgElement) {
    try {
      // Create a canvas to convert the image
      const canvas = document.createElement("canvas");
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgElement, 0, 0);

      // Convert to base64
      const base64Image = canvas.toDataURL("image/webp");
      return base64Image;
    } catch (error) {
      console.error("Error converting monster image:", error);
      return null;
    }
  }

    // Add this method to MonsterManager if it's not already there
  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem("monsterDatabase");
      if (data) {
        return JSON.parse(data);
      }
      return { monsters: {} };
    } catch (err) {
      console.warn("MonsterManager: Error loading from localStorage:", err);
      return { monsters: {} };
    }
  }

  loadDatabase() {
    try {
      const data = localStorage.getItem("monsterDatabase");
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error loading monster database:", e);
    }
    return { monsters: {} };
  }



async saveMonsterToDatabase(monsterData) {
  if (!monsterData || !monsterData.id) {
    console.error("Cannot save monster: Invalid data or missing ID");
    return false;
  }
  
  console.log(`MonsterManager: Saving monster ${monsterData.id} to database`);
  
  // Try to save to IndexedDB first
  let savedToIndexedDB = false;
  if (this.db) {
    try {
      const tx = this.db.transaction(['monsters'], 'readwrite');
      const store = tx.objectStore('monsters');
      await store.put(monsterData);
      await tx.complete;
      console.log(`MonsterManager: Successfully saved ${monsterData.id} to IndexedDB`);
      savedToIndexedDB = true;
    } catch (err) {
      console.warn(`MonsterManager: Failed to save to IndexedDB, falling back to localStorage:`, err);
      // Will fall back to localStorage below
    }
  } else {
    console.warn("MonsterManager: No IndexedDB connection, falling back to localStorage");
  }
  
  // Always save to localStorage as a backup
  try {
    let storage = this.loadFromLocalStorage() || { monsters: {} };
    storage.monsters[monsterData.id] = monsterData;
    localStorage.setItem('monsterDatabase', JSON.stringify(storage));
    console.log(`MonsterManager: Saved ${monsterData.id} to localStorage`);
    return true;
  } catch (err) {
    console.error("MonsterManager: Failed to save to localStorage:", err);
    // If we saved to IndexedDB, return success even if localStorage fails
    return savedToIndexedDB;
  }
}

// Add this method to MonsterManager - The key missing piece
async loadAllMonsters() {
  console.log("MonsterManager: Loading all monsters...");
  
  // Track where monsters came from for debugging
  let source = "none";
  let monsters = [];
  
  // Try IndexedDB first
  if (this.db) {
    try {
      console.log("MonsterManager: Attempting to load from IndexedDB");
      const tx = this.db.transaction(['monsters'], 'readonly');
      const store = tx.objectStore('monsters');
      
      // Use promise to handle async operation properly
      monsters = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
      
      source = "IndexedDB";
      console.log(`MonsterManager: Successfully loaded ${monsters.length} monsters from IndexedDB`);
    } catch (err) {
      console.warn("MonsterManager: IndexedDB access failed:", err);
    }
  }
  
  // If IndexedDB returned no monsters, try localStorage
  if (monsters.length === 0) {
    console.log("MonsterManager: Attempting to load from localStorage");
    const data = this.loadFromLocalStorage();
    
    if (data && data.monsters) {
      monsters = Object.values(data.monsters);
      source = "localStorage";
      console.log(`MonsterManager: Successfully loaded ${monsters.length} monsters from localStorage`);
    } else {
      console.warn("MonsterManager: No monsters found in localStorage");
    }
  }
  
  console.log(`MonsterManager: Returning ${monsters.length} monsters from ${source}`);
  return { monsters, source };
}

// Improve loadFromLocalStorage to provide more debug info
loadFromLocalStorage() {
  try {
    console.log("MonsterManager: Reading from localStorage...");
    const data = localStorage.getItem('monsterDatabase');
    
    if (data) {
      const parsed = JSON.parse(data);
      const monsterCount = parsed?.monsters ? Object.keys(parsed.monsters).length : 0;
      console.log(`MonsterManager: Found ${monsterCount} monsters in localStorage`);
      return parsed;
    }
    
    console.log("MonsterManager: No 'monsterDatabase' entry in localStorage");
    return { monsters: {} };
  } catch (err) {
    console.warn("MonsterManager: Error loading from localStorage:", err);
    return { monsters: {} };
  }
}

    // Delete monster from both IndexedDB and localStorage for consistency
    async deleteMonster(monsterId) {
      const key = typeof monsterId === 'string' ? 
          monsterId : 
          monsterId.basic?.name?.toLowerCase().replace(/\s+/g, "_");
      
      let success = false;
      
      // Delete from localStorage
      if (this.monsterDatabase.monsters[key]) {
        delete this.monsterDatabase.monsters[key];
        localStorage.setItem("monsterDatabase", JSON.stringify(this.monsterDatabase));
        success = true;
      }
      
      // Also delete from IndexedDB if available
      if (this.db) {
        try {
          const tx = this.db.transaction(['monsters'], 'readwrite');
          const store = tx.objectStore('monsters');
          await store.delete(key);
          success = true;
        } catch (e) {
          console.warn(`Could not delete from IndexedDB: ${e.message}`);
        }
      }
      
      return success;
    }  // Compress token image to save space
    async compressTokenImage(dataUrl, quality = 0.7) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Create a canvas for compression
          const canvas = document.createElement('canvas');
          // Scale down large images
          let targetWidth = img.width;
          let targetHeight = img.height;
          
          // Maximum token size - scale down if larger
          const MAX_TOKEN_SIZE = 256;
          if (img.width > MAX_TOKEN_SIZE || img.height > MAX_TOKEN_SIZE) {
            const scaleFactor = MAX_TOKEN_SIZE / Math.max(img.width, img.height);
            targetWidth = Math.floor(img.width * scaleFactor);
            targetHeight = Math.floor(img.height * scaleFactor);
          }
          
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Use webp for better compression
          const compressedDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          // If there's an error, just return the original
          resolve(dataUrl);
        };
        img.src = dataUrl;
      });
    }
  
    // Get storage usage statistics
    async getStorageUsage() {
      // Try to use the Storage API if available
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          return {
            usage: estimate.usage,
            quota: estimate.quota,
            percentUsed: (estimate.usage / estimate.quota) * 100
          };
        } catch (e) {
          console.warn('Error estimating storage', e);
        }
      }
      
      // Fallback - approximate based on existing monsters
      try {
        if (this.db) {
          const tx = this.db.transaction(['monsters'], 'readonly');
          const store = tx.objectStore('monsters');
          const monsters = await store.getAll();
          
          // Calculate total size
          let totalBytes = 0;
          for (const monster of monsters) {
            // Estimate size of monster data
            totalBytes += JSON.stringify(monster).length;
          }
          
          // Assume browser quota is around 5MB
          const estimatedQuota = 5 * 1024 * 1024;
          return {
            usage: totalBytes,
            quota: estimatedQuota,
            percentUsed: (totalBytes / estimatedQuota) * 100
          };
        } else {
          // Estimate from localStorage
          const totalBytes = JSON.stringify(this.monsterDatabase).length;
          const estimatedQuota = 5 * 1024 * 1024;
          return {
            usage: totalBytes,
            quota: estimatedQuota,
            percentUsed: (totalBytes / estimatedQuota) * 100
          };
        }
      } catch (e) {
        return { usage: 0, quota: 1, percentUsed: 0 };
      }
    }
  
    // Handle quota exceeded by implementing emergency measures
    async handleQuotaExceeded(newMonster) {
      console.warn('Storage quota exceeded, implementing emergency measures');
      
      // Create an alert to inform the user
      alert(`
        Storage limit reached for monster database!
        
        To add this monster, you'll need to:
        1. Export your current bestiary (backup)
        2. Delete some existing monsters
        3. Try adding this monster again
        
        The monster data will now be added to localStorage as a fallback.
      `);
      
      // Fall back to localStorage for this monster
      const key = newMonster.id;
      this.monsterDatabase.monsters[key] = newMonster;
      localStorage.setItem("monsterDatabase", JSON.stringify(this.monsterDatabase));
      
      return newMonster;
    }
    
  //   // Prompt to export current bestiary as backup
  //   await this.exportBestiary();
    
  //   // Throw a more user-friendly error
  //   throw new Error('Storage quota exceeded. Please delete some monsters and try again.');
  // }
  
  // Add export bestiary functionality
  async exportBestiary() {
    try {
      const tx = this.db.transaction(['monsters'], 'readonly');
      const store = tx.objectStore('monsters');
      const monsters = await store.getAll();
      
      // Create export file
      const exportData = {
        version: '1.0',
        date: new Date().toISOString(),
        monsters: monsters
      };
      
      // Convert to blob and download
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `bestiary_export_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      return true;
    } catch (e) {
      console.error('Error exporting bestiary:', e);
      return false;
    }
  }

  getTokenUrl(tokenPath) {
    // Clean up any double slashes and ensure proper path construction
    return this.baseTokenUrl + tokenPath.replace(/^\//, "");
  }

  async showMonsterSelector(marker) {
    const dialog = document.createElement("sl-dialog");
    dialog.label = "Import Monster";
    dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="instructions" style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                <p style="margin-top: 0;">To import monster data from 5e.tools:</p>
                <ol style="margin-left: 20px; margin-bottom: 0;">
                    <li>On 5e.tools, right-click on the monster's stat block</li>
                    <li>Select "Inspect Element" or press F12</li>
                    <li>Find the <code>&lt;div id="wrp-pagecontent"&gt;</code> element</li>
                    <li>Right-click the element and select:
                        <ul style="margin-left: 20px;">
                            <li>In Chrome/Edge: "Copy > Copy element"</li>
                            <li>In Firefox: "Copy > Outer HTML"</li>
                        </ul>
                    </li>
                    <li>Paste below</li>
                </ol>
            </div>
            
            <textarea id="monsterHtml" 
                rows="10" 
                style="width: 100%; font-family: monospace; padding: 8px;"
                placeholder="Paste monster stat block HTML here..."></textarea>

            <div id="monsterPreview" style="display: none; max-height: 60vh; overflow-y: auto;">
                <!-- Basic Info Section -->
                <div class="monster-header" style="margin-bottom: 16px;">
                    <h3 class="monster-name" style="margin: 0; font-size: 1.5em;"></h3>
                    <div style="color: #666; font-style: italic;">
                        <span class="monster-size"></span>
                        <span class="monster-type"></span>,
                        <span class="monster-alignment"></span>
                    </div>
                </div>

                <!-- Monster Image -->
                <div class="monster-image" style="margin-bottom: 16px; text-align: center;">
                    <img style="max-width: 200px; display: none;" />
                </div>

                <!-- Core Stats -->
                <div class="core-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: bold;">Armor Class</div>
                        <div class="monster-ac"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">Hit Points</div>
                        <div class="monster-hp"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">Speed</div>
                        <div class="monster-speed"></div>
                    </div>
                </div>

                <!-- Ability Scores -->
                <div class="ability-scores" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: bold;">STR</div>
                        <div class="monster-str"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">DEX</div>
                        <div class="monster-dex"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CON</div>
                        <div class="monster-con"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">INT</div>
                        <div class="monster-int"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">WIS</div>
                        <div class="monster-wis"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CHA</div>
                        <div class="monster-cha"></div>
                    </div>
                </div>

                <!-- Additional Traits -->
                <div class="additional-traits" style="margin-bottom: 16px;">
                    <div style="margin-bottom: 8px;">
                        <strong>Challenge Rating:</strong> <span class="monster-cr"></span>
                        (<span class="monster-xp"></span> XP)
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Proficiency Bonus:</strong> <span class="monster-prof"></span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Senses:</strong> <span class="monster-senses"></span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Languages:</strong> <span class="monster-languages"></span>
                    </div>
                    <div class="monster-immunities-container" style="margin-bottom: 8px; display: none;">
                        <strong>Immunities:</strong> <span class="monster-immunities"></span>
                    </div>
                </div>
            </div>

            <div id="loadingIndicator" style="display: none; text-align: center;">
                <sl-spinner></sl-spinner>
                <div>Processing monster data...</div>
            </div>

            <div id="errorMessage" style="display: none; color: #f44336;"></div>
        </div>
        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="save-btn" disabled>Save Monster</sl-button>
        </div>
    `;

    document.body.appendChild(dialog);
    dialog.show();

    const htmlInput = dialog.querySelector("#monsterHtml");
    const saveBtn = dialog.querySelector(".save-btn");
    const cancelBtn = dialog.querySelector(".cancel-btn");
    const loadingIndicator = dialog.querySelector("#loadingIndicator");
    const errorMessage = dialog.querySelector("#errorMessage");
    const preview = dialog.querySelector("#monsterPreview");

    let currentMonsterData = null;

    // Handle HTML paste
    htmlInput.addEventListener("input", async () => {
      const html = htmlInput.value.trim();
      if (html) {
        try {
          loadingIndicator.style.display = "block";
          errorMessage.style.display = "none";
          preview.style.display = "none";
          saveBtn.disabled = true;

          // Add await here since parseMonsterHtml returns a Promise now
          currentMonsterData = await this.parseMonsterHtml(html);
          console.log("Parsed monster data:", currentMonsterData); // Debug log

          if (currentMonsterData) {
            // Update basic info
            preview.querySelector(".monster-name").textContent =
              currentMonsterData.basic.name;
            preview.querySelector(".monster-size").textContent =
              currentMonsterData.basic.size;
            preview.querySelector(".monster-type").textContent =
              currentMonsterData.basic.type;
            preview.querySelector(".monster-alignment").textContent =
              currentMonsterData.basic.alignment;

            // Update core stats
            preview.querySelector(".monster-ac").textContent =
              currentMonsterData.stats.ac;
            preview.querySelector(
              ".monster-hp"
            ).textContent = `${currentMonsterData.stats.hp.average} (${currentMonsterData.stats.hp.roll})`;
            preview.querySelector(".monster-speed").textContent =
              currentMonsterData.stats.speed;

            // Update ability scores
            Object.entries(currentMonsterData.abilities).forEach(
              ([ability, data]) => {
                const element = preview.querySelector(
                  `.monster-${ability}`
                );
                if (element) {
                  element.textContent = `${data.score} (${data.modifier >= 0 ? "+" : ""
                    }${data.modifier})`;
                }
              }
            );

            // Update additional traits
            preview.querySelector(".monster-cr").textContent =
              currentMonsterData.basic.cr;
            preview.querySelector(".monster-xp").textContent =
              currentMonsterData.basic.xp;
            preview.querySelector(
              ".monster-prof"
            ).textContent = `+${currentMonsterData.basic.proficiencyBonus}`;
            preview.querySelector(".monster-senses").textContent =
              currentMonsterData.traits.senses.join(", ") || "None";
            preview.querySelector(".monster-languages").textContent =
              currentMonsterData.traits.languages;

            // Handle immunities
            const immunitiesContainer = preview.querySelector(
              ".monster-immunities-container"
            );
            const immunitiesSpan = preview.querySelector(
              ".monster-immunities"
            );
            if (currentMonsterData.traits.immunities.length > 0) {
              immunitiesSpan.textContent =
                currentMonsterData.traits.immunities.join(", ");
              immunitiesContainer.style.display = "block";
            } else {
              immunitiesContainer.style.display = "none";
            }

            const imageContainer = preview.querySelector(".monster-image");
            const imgElement = imageContainer.querySelector("img");
            const existingButton = imageContainer.querySelector(".capture-btn");
            if (existingButton) {
              existingButton.remove();
            }

            if (currentMonsterData?.token && (currentMonsterData.token.data || currentMonsterData.token.url)) {
              const imageUrl = currentMonsterData.token.data || currentMonsterData.token.url;
              imgElement.src = imageUrl;
              imgElement.style.display = "block";


              // In showMonsterSelector, make a button, tell the user to right-click the token image, and handle file selection:

              if (!currentMonsterData.token.data) {
                const captureBtn = document.createElement('sl-button');
                captureBtn.className = "capture-btn";
                captureBtn.variant = "primary";
                captureBtn.innerHTML = "Choose Token Image";
                captureBtn.style.marginTop = "8px";

                // Create hidden file input
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/webp,image/png';
                fileInput.style.display = 'none';
                imageContainer.appendChild(fileInput);

                // Show instructions when clicked
                captureBtn.addEventListener('click', () => {
                  const instructions = document.createElement('div');
                  instructions.innerHTML = '1. Right-click the token image above<br>2. Select "Save image as..."<br>3. Save it as WebP or PNG<br>4. Then click "Choose Token Image" again to select the saved file';
                  instructions.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 10px; border-radius: 5px; z-index: 9999;';
                  document.body.appendChild(instructions);

                  setTimeout(() => {
                    instructions.remove();
                    fileInput.click();
                  }, 3000);
                });

                // Handle file selection
                fileInput.addEventListener('change', (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      currentMonsterData.token.data = event.target.result;
                      captureBtn.innerHTML = "✓ Captured";
                      captureBtn.disabled = true;
                      imgElement.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }
                });

                imageContainer.appendChild(captureBtn);
              }

            } else {
              imgElement.style.display = "none";
            }

            preview.style.display = "block";
            saveBtn.disabled = false;
          }
        } catch (error) {
          console.error("Error in monster data processing:", error);
          errorMessage.textContent = "Error parsing monster data. Please check the HTML.";
          errorMessage.style.display = "block";
          saveBtn.disabled = true;
        } finally {
          loadingIndicator.style.display = "none";
        }
      }
    });

    return new Promise((resolve) => {
      saveBtn.addEventListener("click", async () => {
        if (currentMonsterData) {
          marker.data.monster = currentMonsterData;
          await this.saveMonsterToDatabase(currentMonsterData);
          this.mapEditor.updateMarkerAppearance(marker);
          dialog.hide();
          resolve(true);
        }
      });


      cancelBtn.addEventListener("click", () => {
        dialog.hide();
        resolve(false);
      });

      dialog.addEventListener("sl-after-hide", () => {
        dialog.remove();
      });
    });
  }

  generateDefaultMonsterToken(monsterName, size = "medium") {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set size based on monster size category
    const sizeMap = {
      tiny: 32,
      small: 32,
      medium: 32,
      large: 64,
      huge: 96,
      gargantuan: 128
    };

    const tokenSize = sizeMap[size.toLowerCase()] || 32;
    canvas.width = tokenSize;
    canvas.height = tokenSize;

    // Draw background circle
    ctx.fillStyle = '#f44336';  // Red background
    ctx.beginPath();
    ctx.arc(tokenSize / 2, tokenSize / 2, tokenSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Add border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add monster initial in white
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${tokenSize / 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(monsterName.charAt(0).toUpperCase(), tokenSize / 2, tokenSize / 2);

    return canvas.toDataURL('image/webp');
  }

  drawToCanvas(imgElement) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    ctx.drawImage(imgElement, 0, 0);

    return canvas.toDataURL("image/webp");
  }

  async extractMonsterData(url) {
    try {
      // Parse the URL to get monster ID
      const monsterId = url.split("#")[1]; // e.g., "zombie_xphb"
      if (!monsterId) {
        throw new Error("Invalid monster URL format");
      }

      // Since we can't fetch directly from 5e.tools,
      // we'll need the user to paste the monster data section
      const dialog = document.createElement("sl-dialog");
      dialog.label = "Monster Data Import";
      dialog.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="instructions">
            <p>To import monster data from 5e.tools:</p>
            <ol style="margin-left: 20px;">
                <li>On 5e.tools, right-click on the monster's stat block</li>
                <li>Select "Inspect Element" or press F12</li>
                <li>Find the <code>&lt;div id="wrp-pagecontent"&gt;</code> element</li>
                <li>Right-click the element and select:</li>
                <ul style="margin-left: 20px;">
                    <li>In Firefox: "Copy > Outer HTML"</li>
                    <li>In Chrome: "Copy > Copy element"</li>
                    <li>In Edge: "Copy > Outer HTML"</li>
                </ul>
                <li>Paste it below</li>
            </ol>
        </div>
        <div class="visual-guide" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <p style="margin: 0 0 10px 0;"><strong>The element should look like this:</strong></p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; margin: 0; font-size: 0.9em; overflow-x: auto;"><code>&lt;div id="wrp-pagecontent" class="relative wrp-stats-table..."&gt;</code></pre>
        </div>
        <textarea id="monsterHtml" 
                 rows="10" 
                 style="width: 100%; font-family: monospace;"
                 placeholder="Paste monster stat block HTML here..."></textarea>
        <div id="errorMessage" style="display: none; color: #f44336;"></div>
    </div>
    <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="import-btn">Import Monster</sl-button>
    </div>
`;

      document.body.appendChild(dialog);
      dialog.show();

      return new Promise((resolve, reject) => {
        const importBtn = dialog.querySelector(".import-btn");
        const cancelBtn = dialog.querySelector(".cancel-btn");
        const errorMsg = dialog.querySelector("#errorMessage");

        importBtn.addEventListener("click", () => {
          const html = dialog.querySelector("#monsterHtml").value;
          try {
            const monsterData = this.parseMonsterHtml(html);
            dialog.hide();
            resolve(monsterData);
          } catch (error) {
            errorMsg.textContent =
              "Error parsing monster data. Please check the HTML.";
            errorMsg.style.display = "block";
          }
        });

        cancelBtn.addEventListener("click", () => {
          dialog.hide();
          reject(new Error("Import cancelled"));
        });

        dialog.addEventListener("sl-after-hide", () => {
          dialog.remove();
        });
      });
    } catch (error) {
      console.error("Error extracting monster data:", error);
      throw error;
    }
  }

  getDefaultMonsterData() {
    return {
      basic: {
        name: "Unknown Monster",
        size: "Medium",
        type: "Unknown",
        alignment: "Unaligned",
        cr: "0",
        xp: 0,
        proficiencyBonus: 2
      },
      stats: {
        ac: 10,
        hp: { average: 1, roll: "1d4", max: 1 },
        speed: "30 ft."
      },
      abilities: {
        str: { score: 10, modifier: 0 },
        dex: { score: 10, modifier: 0 },
        con: { score: 10, modifier: 0 },
        int: { score: 10, modifier: 0 },
        wis: { score: 10, modifier: 0 },
        cha: { score: 10, modifier: 0 }
      },
      traits: {
        immunities: [],
        senses: [],
        languages: "None"
      },
      token: {
        url: null,
        data: null
      },
      actions: []
    };
  }

  // async parseMonsterHtml(html) {
  //   const parser = new DOMParser();
  //   const doc = parser.parseFromString(html, "text/html");
  
  //   try {
  //     // Required basic information
  //     const name = doc.querySelector(".stats__h-name")?.textContent?.trim() || "Unknown Monster";
      
  //     // Extract source abbreviation - NEW CODE
  //     let sourceAbbreviation = '';
  //     const sourceElement = doc.querySelector(".stats__h-source-abbreviation");
  //     if (sourceElement) {
  //       // Find the class that starts with "source__"
  //       const sourceClass = Array.from(sourceElement.classList)
  //         .find(cls => cls.startsWith('source__'));
  //       if (sourceClass) {
  //         sourceAbbreviation = sourceClass.replace('source__', '');
  //       }
  //     }
      
  //     // Create 5e.tools URL - NEW CODE
  //     let toolsUrl = '';
  //     if (name && sourceAbbreviation) {
  //       const urlSafeName = name.toLowerCase().replace(/\s+/g, '%20');
  //       toolsUrl = `https://5e.tools/bestiary.html#${urlSafeName}_${sourceAbbreviation.toLowerCase()}`;
  //     }
  
  //     // Rest of existing code for parsing monster info
  //     // const typeInfo = doc.querySelector("td i")?.textContent?.trim() || "Medium Unknown, Unaligned";
  //     // const [sizeTypeAlign = ""] = typeInfo.split(",");
  //     // const [size = "Medium", type = "Unknown"] = sizeTypeAlign.trim().split(/\s+/);
  //     // const alignment = typeInfo.split(",")[1]?.trim() || "Unaligned";
  

  //         // Handle size and type with special cases like "Small or Medium Humanoid"
  //   const typeInfo = doc.querySelector("td i")?.textContent?.trim() || "Medium Unknown, Unaligned";
  //   const [sizeTypeAlign = "", alignmentPart = "Unaligned"] = typeInfo.split(",").map(s => s.trim());
    
  //   // NEW CODE: Handle "Small or Medium" type format
  //   let size = "Medium";
  //   let type = "Unknown";
    
  //   // Check for common patterns with "or" in the size
  //   if (sizeTypeAlign.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i)) {
  //     // Example: "Small or Medium Humanoid"
  //     // Take the second size (usually the larger one) as default
  //     const match = sizeTypeAlign.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(\w+)\b/i);
  //     if (match) {
  //       size = match[2]; // Use the second size option
  //       type = match[3]; // Get the type after the "or" part
  //     }
  //   } else {
  //     // Standard format: "Medium Humanoid"
  //     const parts = sizeTypeAlign.trim().split(/\s+/);
  //     size = parts[0] || "Medium";
  //     type = parts[1] || "Unknown";
  //   }
    
  //   const alignment = alignmentPart || "Unaligned";

  //     // Required stats (with safe defaults)
  //     const stats = {
  //       ac: parseInt(
  //         doc.querySelector('[title="Armor Class"] + span')
  //           ?.textContent || "10"
  //       ),
  //       hp: {
  //         average: parseInt(
  //           doc.querySelector('[title="Hit Points"] + span')
  //             ?.textContent || "1"
  //         ),
  //         roll:
  //           doc
  //             .querySelector('[data-roll-name="Hit Points"]')
  //             ?.textContent?.trim() || "1d4",
  //         max: parseInt(
  //           doc.querySelector('[title="Maximum: "]')?.textContent || "1"
  //         )
  //       },
  //       speed: "30 ft."
  //     };

  //     // Try to get actual speed
  //     const speedNode = Array.from(doc.querySelectorAll("strong")).find(
  //       (el) => el.textContent === "Speed"
  //     );
  //     if (speedNode && speedNode.nextSibling) {
  //       stats.speed = speedNode.nextSibling.textContent.trim();
  //     }

  //     // Parse ability scores - Updated version
  //     // console.log("About to parse ability scores");
  //     // Parse ability scores
  //     const abilities = {};
  //     const abilityRows = Array.from(
  //       doc.querySelectorAll(".stats-tbl-ability-scores__lbl-abv")
  //     );

  //     abilityRows.forEach((labelCell) => {
  //       const abilityDiv = labelCell.querySelector(".bold.small-caps");
  //       if (abilityDiv) {
  //         const abilityName = abilityDiv.textContent.trim().toLowerCase();
  //         if (
  //           ["str", "dex", "con", "int", "wis", "cha"].includes(
  //             abilityName
  //           )
  //         ) {
  //           try {
  //             // Get score from the next cell's div directly
  //             const scoreDiv =
  //               labelCell.nextElementSibling.querySelector(
  //                 ".ve-text-center"
  //               );
  //             const score = parseInt(scoreDiv?.textContent || "10");

  //             // Get modifier from the next cell's roller span
  //             const modifierCell =
  //               scoreDiv?.parentElement.nextElementSibling;
  //             const modifierText =
  //               modifierCell?.querySelector(".roller")?.textContent ||
  //               "0";
  //             const modifier = parseInt(
  //               modifierText.match(/[+-]\d+/)?.[0] || "0"
  //             );

  //             abilities[abilityName] = { score, modifier };
  //             // console.log(`Parsed ${abilityName}:`, { score, modifier });
  //           } catch (e) {
  //             console.error(`Error parsing ${abilityName}:`, e);
  //             abilities[abilityName] = { score: 10, modifier: 0 };
  //           }
  //         }
  //       }
  //     });
  //     // console.log("Abilities parsed successfully:", abilities);

  //     // Optional extras
  //     let extras = {
  //       immunities: [],
  //       resistances: [],
  //       senses: [],
  //       languages: "None",
  //       cr: "0",
  //       xp: 0,
  //       proficiencyBonus: 2
  //     };

  //     try {
  //       const crNode = doc.querySelector(
  //         '[title="Challenge Rating"] + span'
  //       );
  //       if (crNode) {
  //         extras.cr = crNode.textContent.split("(")[0].trim();
  //         const xpMatch = crNode.textContent.match(/XP (\d+)/);
  //         if (xpMatch) extras.xp = parseInt(xpMatch[1]);
  //         // console.log("Parsed CR/XP:", extras.cr, extras.xp);
  //       }
  //     } catch (e) {
  //       console.log("Optional: Failed to parse CR/XP");
  //     }

  //     try {
  //       const immunityNode = Array.from(
  //         doc.querySelectorAll("strong")
  //       ).find((el) => el.textContent === "Immunities");
  //       if (immunityNode && immunityNode.nextSibling) {
  //         extras.immunities = immunityNode.nextSibling.textContent
  //           .split(";")
  //           .map((i) => i.trim())
  //           .filter((i) => i);
  //         // console.log("Parsed immunities:", extras.immunities);
  //       }
  //     } catch (e) {
  //       console.log("Optional: Failed to parse immunities");
  //     }

  //     try {
  //       const sensesNode = Array.from(
  //         doc.querySelectorAll("strong")
  //       ).find((el) => el.textContent === "Senses");
  //       if (sensesNode && sensesNode.nextSibling) {
  //         extras.senses = sensesNode.nextSibling.textContent
  //           .split(",")
  //           .map((s) => s.trim())
  //           .filter((s) => s);
  //         // console.log("Parsed senses:", extras.senses);
  //       }
  //     } catch (e) {
  //       console.log("Optional: Failed to parse senses");
  //     }

  //     try {
  //       const languagesNode = Array.from(
  //         doc.querySelectorAll("strong")
  //       ).find((el) => el.textContent === "Languages");
  //       if (languagesNode && languagesNode.nextSibling) {
  //         extras.languages =
  //           languagesNode.nextSibling.textContent.trim() || "None";
  //         // console.log("Parsed languages:", extras.languages);
  //       }
  //     } catch (e) {
  //       console.log("Optional: Failed to parse languages");
  //     }

  //     let tokenUrl = null;
  //     let tokenData = null;

  //     try {
  //       const tokenDiv = doc.querySelector("#float-token");
  //       if (tokenDiv) {
  //         const imgElement = tokenDiv.querySelector("img.stats__token");
  //         if (imgElement?.src) {
  //           const path = imgElement.src.replace(/.*\/bestiary\/tokens\//, "");
  //           tokenUrl = this.getTokenUrl(path);
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Error handling token:", error);
  //     }

  //     const actions = [];
    
  //     // Find the Actions section header
  //     const actionHeader = Array.from(doc.querySelectorAll("h3.stats__sect-header-inner"))
  //       .find(el => el.textContent.trim() === "Actions");
      
  //     if (actionHeader) {
  //       // Get the parent row then find all following action rows until the next section header
  //       const actionHeaderRow = actionHeader.closest("tr");
  //       let currentRow = actionHeaderRow.nextElementSibling;
        
  //       // Process each action row
  //       while (currentRow && !currentRow.querySelector("h3.stats__sect-header-inner")) {
  //         const actionDiv = currentRow.querySelector("[data-roll-name-ancestor]");
          
  //         if (actionDiv) {
  //           try {
  //             // Extract action name
  //             const actionName = actionDiv.getAttribute("data-roll-name-ancestor") || 
  //                               actionDiv.querySelector(".entry-title-inner")?.textContent.replace(/\.$/, '') || 
  //                               "Unknown Action";
              
  //             // Find attack bonus - look for the first roller with "hit" context
  //             const attackRoller = actionDiv.querySelector('.roller[data-packed-dice*=\'"type":"hit"\']') || 
  //                                 actionDiv.querySelector('.roller[data-packed-dice*=\'"context":{"type":"hit"}\']');
  //             let attackBonus = 0;
  //             if (attackRoller) {
  //               const bonusText = attackRoller.textContent.trim();
  //               attackBonus = parseInt(bonusText.match(/[+-]\d+/)?.[0] || "0");
  //             }
              
  //             // Find damage dice - look for roller after "Hit:" text
  //             const hitText = Array.from(actionDiv.querySelectorAll("i"))
  //               .find(el => el.textContent.trim() === "Hit:");
              
  //             let damageDice = "";
  //             let damageType = "";
              
  //             if (hitText) {
  //               const damageRoller = hitText.nextElementSibling?.nextElementSibling;
  //               if (damageRoller && damageRoller.classList.contains("roller")) {
  //                 damageDice = damageRoller.textContent.trim();
                  
  //                 // Get damage type from text after the damage roller
  //                 let nextNode = damageRoller.nextSibling;
  //                 if (nextNode && nextNode.textContent) {
  //                   const damageMatch = nextNode.textContent.match(/\)\s+([A-Za-z]+)\s+damage/);
  //                   if (damageMatch && damageMatch[1]) {
  //                     damageType = damageMatch[1];
  //                   }
  //                 }
  //               }
  //             }
              
  //             // Get full description
  //             const description = actionDiv.textContent.trim()
  //               .replace(actionName + ".", "")
  //               .replace(/Melee Attack Roll:.*?Hit:/, "")
  //               .replace(/\(\d+d\d+.*?\)/, "")
  //               .trim();
              
  //             // Add to actions array
  //             actions.push({
  //               name: actionName,
  //               attackBonus: attackBonus,
  //               damageDice: damageDice,
  //               damageType: damageType,
  //               description: description
  //             });
  //           } catch (e) {
  //             console.error("Error parsing action:", e);
  //           }
  //         }
          
  //         // Move to next row
  //         currentRow = currentRow.nextElementSibling;
  //         if (!currentRow) break;
  //       }
  //     }


  //     // Include token data in the return object (this should already be in your code)
  //     return {
  //       basic: {
  //         name,
  //         size,
  //         type,
  //         alignment,
  //         cr: extras.cr,
  //         xp: extras.xp,
  //         proficiencyBonus: extras.proficiencyBonus,
  //         source: sourceAbbreviation, // Add source abbreviation
  //         toolsUrl: toolsUrl           // Add URL to 5e.tools
  //       },
  //       stats,
  //       abilities,
  //       traits: {
  //         immunities: extras.immunities,
  //         senses: extras.senses,
  //         languages: extras.languages
  //       },
  //       token: {
  //         url: tokenUrl,
  //         data: tokenData
  //       },
  //       actions: actions
  //     };
  //   } catch (error) {
  //     console.error("Error parsing monster HTML:", error);
  //     return this.getDefaultMonsterData();
  //   }
  // }

    async parseMonsterHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    try {
      console.log("Beginning monster parsing...");
      
      // Required basic information
      const name = doc.querySelector(".stats__h-name")?.textContent?.trim() || "Unknown Monster";
      console.log(`Parsing monster: ${name}`);
      
      // CRITICAL FIX: Generate a unique ID for the monster
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${timestamp}_${randomSuffix}`;
      console.log(`Generated ID: ${id}`);
      
      // Extract source abbreviation
      let sourceAbbreviation = '';
      const sourceElement = doc.querySelector(".stats__h-source-abbreviation");
      if (sourceElement) {
        const sourceClass = Array.from(sourceElement.classList)
          .find(cls => cls.startsWith('source__'));
        if (sourceClass) {
          sourceAbbreviation = sourceClass.replace('source__', '');
        }
      }
      
      // Create 5e.tools URL
      let toolsUrl = '';
      if (name && sourceAbbreviation) {
        const urlSafeName = name.toLowerCase().replace(/\s+/g, '%20');
        toolsUrl = `https://5e.tools/bestiary.html#${urlSafeName}_${sourceAbbreviation.toLowerCase()}`;
      }
    
      // Handle size and type with special cases like "Small or Medium Humanoid"
      const typeInfo = doc.querySelector("td i")?.textContent?.trim() || "Medium Unknown, Unaligned";
      console.log(`Raw type info from HTML: "${typeInfo}"`);
      
      const [sizeTypeAlign = "", alignmentPart = "Unaligned"] = typeInfo.split(",").map(s => s.trim());
      console.log(`Parsed size/type part: "${sizeTypeAlign}"`);
      
      // IMPROVED HANDLING for "Small or Medium" format
      let size = "Medium";
      let type = "Unknown";
      
      // More robust regex that can handle multi-word types (like "Fey Creature")
      if (sizeTypeAlign.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i)) {
        console.log("Detected special size format with 'or'");
        
        // Extract everything after "Size1 or Size2" as the type
        const match = sizeTypeAlign.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.*?)$/i);
        if (match) {
          size = match[2]; // Use the second size option
          type = match[3].trim(); // Get the rest as type, and trim whitespace
          console.log(`Special format parsed: size="${size}", type="${type}"`);
        }
      } else {
        // Standard format: "Medium Humanoid"
        const firstWord = sizeTypeAlign.split(/\s+/)[0];
        
        // Check if the first word is a valid size
        if (["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].includes(firstWord)) {
          size = firstWord;
          // Get everything after the size as the type
          type = sizeTypeAlign.substring(size.length).trim();
          console.log(`Standard format parsed: size="${size}", type="${type}"`);
        } else {
          console.log(`Unknown size format, using defaults: size="Medium", type="${sizeTypeAlign}"`);
          size = "Medium";
          type = sizeTypeAlign;
        }
      }
      
      // If type is still empty or just "or", use a default
      if (!type || type === "or") {
        console.warn(`Invalid type "${type}", defaulting to "Unknown"`);
        type = "Unknown";
      }
      
      const alignment = alignmentPart || "Unaligned";
  
      // Required stats (with safe defaults)
      const stats = {
        ac: parseInt(
          doc.querySelector('[title="Armor Class"] + span')
            ?.textContent || "10"
        ),
        hp: {
          average: parseInt(
            doc.querySelector('[title="Hit Points"] + span')
              ?.textContent || "1"
          ),
          roll:
            doc
              .querySelector('[data-roll-name="Hit Points"]')
              ?.textContent?.trim() || "1d4",
          max: parseInt(
            doc.querySelector('[title="Maximum: "]')?.textContent || "1"
          )
        },
        speed: "30 ft."
      };
  
      // Try to get actual speed
      const speedNode = Array.from(doc.querySelectorAll("strong")).find(
        (el) => el.textContent === "Speed"
      );
      if (speedNode && speedNode.nextSibling) {
        stats.speed = speedNode.nextSibling.textContent.trim();
      }
  
      // Parse ability scores
      const abilities = {};
      const abilityRows = Array.from(
        doc.querySelectorAll(".stats-tbl-ability-scores__lbl-abv")
      );
  
      abilityRows.forEach((labelCell) => {
        const abilityDiv = labelCell.querySelector(".bold.small-caps");
        if (abilityDiv) {
          const abilityName = abilityDiv.textContent.trim().toLowerCase();
          if (
            ["str", "dex", "con", "int", "wis", "cha"].includes(
              abilityName
            )
          ) {
            try {
              // Get score from the next cell's div directly
              const scoreDiv =
                labelCell.nextElementSibling.querySelector(
                  ".ve-text-center"
                );
              const score = parseInt(scoreDiv?.textContent || "10");
  
              // Get modifier from the next cell's roller span
              const modifierCell =
                scoreDiv?.parentElement.nextElementSibling;
              const modifierText =
                modifierCell?.querySelector(".roller")?.textContent ||
                "0";
              const modifier = parseInt(
                modifierText.match(/[+-]\d+/)?.[0] || "0"
              );
  
              abilities[abilityName] = { score, modifier };
            } catch (e) {
              console.error(`Error parsing ${abilityName}:`, e);
              abilities[abilityName] = { score: 10, modifier: 0 };
            }
          }
        }
      });
  
      // Optional extras
      let extras = {
        immunities: [],
        resistances: [],
        senses: [],
        languages: "None",
        cr: "0",
        xp: 0,
        proficiencyBonus: 2
      };
  
      try {
        const crNode = doc.querySelector(
          '[title="Challenge Rating"] + span'
        );
        if (crNode) {
          extras.cr = crNode.textContent.split("(")[0].trim();
          const xpMatch = crNode.textContent.match(/XP (\d+)/);
          if (xpMatch) extras.xp = parseInt(xpMatch[1]);
        }
      } catch (e) {
        console.log("Optional: Failed to parse CR/XP");
      }
  
      try {
        const immunityNode = Array.from(
          doc.querySelectorAll("strong")
        ).find((el) => el.textContent === "Immunities");
        if (immunityNode && immunityNode.nextSibling) {
          extras.immunities = immunityNode.nextSibling.textContent
            .split(";")
            .map((i) => i.trim())
            .filter((i) => i);
        }
      } catch (e) {
        console.log("Optional: Failed to parse immunities");
      }
  
      try {
        const sensesNode = Array.from(
          doc.querySelectorAll("strong")
        ).find((el) => el.textContent === "Senses");
        if (sensesNode && sensesNode.nextSibling) {
          extras.senses = sensesNode.nextSibling.textContent
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      } catch (e) {
        console.log("Optional: Failed to parse senses");
      }
  
      try {
        const languagesNode = Array.from(
          doc.querySelectorAll("strong")
        ).find((el) => el.textContent === "Languages");
        if (languagesNode && languagesNode.nextSibling) {
          extras.languages =
            languagesNode.nextSibling.textContent.trim() || "None";
        }
      } catch (e) {
        console.log("Optional: Failed to parse languages");
      }
  
      let tokenUrl = null;
      let tokenData = null;
  
      try {
        const tokenDiv = doc.querySelector("#float-token");
        if (tokenDiv) {
          const imgElement = tokenDiv.querySelector("img.stats__token");
          if (imgElement?.src) {
            const path = imgElement.src.replace(/.*\/bestiary\/tokens\//, "");
            tokenUrl = this.getTokenUrl(path);
          }
        }
      } catch (error) {
        console.error("Error handling token:", error);
      }
  
      const actions = [];
    
      // Find the Actions section header
      const actionHeader = Array.from(doc.querySelectorAll("h3.stats__sect-header-inner"))
        .find(el => el.textContent.trim() === "Actions");
      
      if (actionHeader) {
        // Get the parent row then find all following action rows until the next section header
        const actionHeaderRow = actionHeader.closest("tr");
        let currentRow = actionHeaderRow.nextElementSibling;
        
        // Process each action row
        while (currentRow && !currentRow.querySelector("h3.stats__sect-header-inner")) {
          const actionDiv = currentRow.querySelector("[data-roll-name-ancestor]");
          
          if (actionDiv) {
            try {
              // Extract action name
              const actionName = actionDiv.getAttribute("data-roll-name-ancestor") || 
                                actionDiv.querySelector(".entry-title-inner")?.textContent.replace(/\.$/, '') || 
                                "Unknown Action";
              
              // Find attack bonus - look for the first roller with "hit" context
              const attackRoller = actionDiv.querySelector('.roller[data-packed-dice*=\'"type":"hit"\']') || 
                                  actionDiv.querySelector('.roller[data-packed-dice*=\'"context":{"type":"hit"}\']');
              let attackBonus = 0;
              if (attackRoller) {
                const bonusText = attackRoller.textContent.trim();
                attackBonus = parseInt(bonusText.match(/[+-]\d+/)?.[0] || "0");
              }
              
              // Find damage dice - look for roller after "Hit:" text
              const hitText = Array.from(actionDiv.querySelectorAll("i"))
                .find(el => el.textContent.trim() === "Hit:");
              
              let damageDice = "";
              let damageType = "";
              
              if (hitText) {
                const damageRoller = hitText.nextElementSibling?.nextElementSibling;
                if (damageRoller && damageRoller.classList.contains("roller")) {
                  damageDice = damageRoller.textContent.trim();
                  
                  // Get damage type from text after the damage roller
                  let nextNode = damageRoller.nextSibling;
                  if (nextNode && nextNode.textContent) {
                    const damageMatch = nextNode.textContent.match(/\)\s+([A-Za-z]+)\s+damage/);
                    if (damageMatch && damageMatch[1]) {
                      damageType = damageMatch[1];
                    }
                  }
                }
              }
              
              // Get full description
              const description = actionDiv.textContent.trim()
                .replace(actionName + ".", "")
                .replace(/Melee Attack Roll:.*?Hit:/, "")
                .replace(/\(\d+d\d+.*?\)/, "")
                .trim();
              
              // Add to actions array
              actions.push({
                name: actionName,
                attackBonus: attackBonus,
                damageDice: damageDice,
                damageType: damageType,
                description: description
              });
            } catch (e) {
              console.error("Error parsing action:", e);
            }
          }
          
          // Move to next row
          currentRow = currentRow.nextElementSibling;
          if (!currentRow) break;
        }
      }
  
      console.log(`Successfully completed parsing of monster: ${name} (ID: ${id})`);
  
      // Include token data and ID in the return object
      return {
        id, // This is the key addition - ensuring the ID is present
        basic: {
          name,
          size,
          type,
          alignment,
          cr: extras.cr,
          xp: extras.xp,
          proficiencyBonus: extras.proficiencyBonus,
          source: sourceAbbreviation,
          toolsUrl: toolsUrl
        },
        stats,
        abilities,
        traits: {
          immunities: extras.immunities,
          senses: extras.senses,
          languages: extras.languages
        },
        token: {
          url: tokenUrl,
          data: tokenData
        },
        actions: actions
      };
    } catch (error) {
      console.error("Error parsing monster HTML:", error);
      // Even if we fall back to default data, make sure it has an ID
      const defaultData = this.getDefaultMonsterData();
      defaultData.id = `unknown_monster_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      return defaultData;
    }
  }

  getStoredToken(monsterId) {
    try {
      const key = `monster_token_${monsterId}`;
      return localStorage.getItem(key);
    } catch (e) {
      console.error("Error retrieving stored token:", e);
      return null;
    }
  }

    // Add this simple helper method
  async isMonsterInIndexedDB(monsterId) {
    if (!this.db) return false;
    
    return new Promise(resolve => {
      try {
        const tx = this.db.transaction(['monsters'], 'readonly');
        const store = tx.objectStore('monsters');
        const request = store.get(monsterId);
        
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  cloneEncounter(marker) {
    // Clone an existing encounter marker
    const offset = 50;

    if (marker.type === "encounter" && marker.data.monster) {
      // Get the monster's size and calculate dimensions
      const monsterSize = this.mapEditor.getMonsterSizeInSquares(
        marker.data.monster.basic.size
      );
      const baseSize = 32;
      const scaledSize = baseSize * monsterSize / 2;

      console.log("Size calculations:", {
        monsterSize,
        baseSize,
        scaledSize
      });

      // Create new marker
      const newMarker = this.mapEditor.addMarker(
        "encounter",
        marker.x + offset,
        marker.y + offset,
        { ...marker.data }
      );

      // Force the correct size
      const tokenElement =
        newMarker.element.querySelector(".monster-token");
      if (tokenElement) {
        const styles = {
          width: `${scaledSize}px !important`,
          height: `${scaledSize}px !important`,
          borderRadius: "10%",
          border: "2px solid #f44336",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          left: `-${scaledSize / 2}px`,
          top: `-${scaledSize / 2}px`,
          transformOrigin: "center"
        };

        Object.assign(tokenElement.style, styles);
      }

      // Call updateMarkerAppearance but preserve our size
      this.mapEditor.updateMarkerAppearance(newMarker);

      // Re-apply size after updateMarkerAppearance
      if (tokenElement) {
        tokenElement.style.width = `${scaledSize}px`;
        tokenElement.style.height = `${scaledSize}px`;
        tokenElement.style.left = `-${scaledSize / 2}px`;
        tokenElement.style.top = `-${scaledSize / 2}px`;
      }

      return newMarker;
    } else {
      return this.mapEditor.addMarker(
        marker.type,
        marker.x + offset,
        marker.y + offset,
        { ...marker.data }
      );
    }
  }

  getMonsterTooltip(monster) {
    if (!monster) return "Unlinked Encounter";
    return `
            ${monster.basic.name}
            CR ${monster.basic.cr} (${monster.basic.xp} XP)
            HP: ${monster.stats.hp.average}
            AC: ${monster.stats.ac}
        `;
  }
}
