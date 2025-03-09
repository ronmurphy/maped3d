
window.ResourceManager = class {
    constructor() {
        this.resources = {
            textures: {
                walls: new Map(),
                doors: new Map(),
                environmental: new Map(),
                props: new Map()
            },
            sounds: {
                ambient: new Map(),
                effects: new Map()
            },
            splashArt: {
                title: new Map(),
                loading: new Map(),
                background: new Map()
            },
            effects: {
                particles: new Map(),
                lighting: new Map()
            },
            bestiary: new Map(),
            metadata: {}  // Add metadata storage
        };
    
        this.loadedPacks = new Map();
        this.activePackId = null;
        this.mapResourceLinks = new Map();
        this.activeResourcePack = null;
        this.thumbnailSize = 100;
    
        // Initialize textureAssignments map
        this.textureAssignments = new Map();
        this.defaultWallTextureId = null;
    
        // Initialize sound management
        this.activeAudio = new Map();
    
        // Initialize MonsterManager
        this.monsterManager = null;
    
        // Props filtering system
this.propFolderMap = new Map();
this.activeTagFilter = null;
this.lastSelectedCategory = null;

// Add metadata if it doesn't exist
if (!this.resources.metadata) {
    this.resources.metadata = {};
}
    }

    initStoryboard() {
        if (!window.Storyboard) {
          console.error('Storyboard class not available');
          return null;
        }
        
        // Create storyboard instance if not exists
        if (!this.storyboard) {
          this.storyboard = new window.Storyboard(this.scene3D);
          this.storyboard.connectToResourceManager(this);
        }
        
        return this.storyboard;
      }


    async loadResourcePack(file) {
        try {
            // Create loading progress overlay
            const overlay = this.createLoadProgressOverlay();
            document.body.appendChild(overlay);
            
            // Update initial progress
            this.updateLoadProgress(overlay, 0, 'Reading file...');
            
            // Read the file
            const text = await file.text();
            this.updateLoadProgress(overlay, 20, 'Parsing data...');
            
            // Parse the JSON data
            const packData = JSON.parse(text);
            
            // Count total items for progress tracking
            let totalTextures = 0;
            let processedTextures = 0;
            
            // Count textures in each category
            this.updateLoadProgress(overlay, 30, 'Counting resources...');
            
            for (const category in packData.textures) {
                totalTextures += Object.keys(packData.textures[category]).length;
            }
            
            this.updateLoadProgress(overlay, 40, `Found ${totalTextures} textures to process...`);
            
            // Clear existing resources
            this.resources.textures = {
                walls: new Map(),
                doors: new Map(),
                environmental: new Map(),
                props: new Map()
            };
            
            // First restore propFolderMap if it exists in metadata
            if (packData.metadata && packData.metadata.propFolders) {
                this.propFolderMap = new Map();
                
                packData.metadata.propFolders.forEach(folder => {
                    this.propFolderMap.set(folder.tag, {
                        label: folder.label,
                        files: folder.files
                    });
                });
                
                this.updateLoadProgress(overlay, 45, `Restored ${this.propFolderMap.size} folders...`);
            }
            
            // Process textures in chunks
            const chunkSize = 20; // Process more at once for loading since we don't need to compress
            let currentProgress = 45;
            
            // Process each texture category
            for (const category in packData.textures) {
                const textures = packData.textures[category];
                const textureIds = Object.keys(textures);
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                
                // Initialize category if needed
                if (!this.resources.textures[category]) {
                    this.resources.textures[category] = new Map();
                }
                
                // Process textures in chunks
                for (let i = 0; i < textureIds.length; i += chunkSize) {
                    // Update progress
                    const percentComplete = 45 + (processedTextures / totalTextures * 40);
                    this.updateLoadProgress(
                        overlay,
                        percentComplete,
                        `Loading ${categoryName}: ${processedTextures} of ${totalTextures} textures...`
                    );
                    
                    // Process this chunk
                    const chunk = textureIds.slice(i, i + chunkSize);
                    
                    // Add a small delay to allow UI to update and memory to be freed
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Process each texture in the chunk
                    for (const id of chunk) {
                        const texture = textures[id];
                        this.resources.textures[category].set(id, texture);
                        
                        // Set first wall texture as default if needed
                        if (category === 'walls' && !this.defaultWallTextureId) {
                            this.defaultWallTextureId = id;
                        }
                        
                        processedTextures++;
                    }
                }
            }
            
            // Continue with the rest of the deserialization (sounds, splashArt, effects)
            this.updateLoadProgress(overlay, 85, 'Loading other resources...');
            
            if (packData.sounds) {
                for (const [category, sounds] of Object.entries(packData.sounds)) {
                    if (!this.resources.sounds[category]) {
                        this.resources.sounds[category] = new Map();
                    }
                    for (const [id, sound] of Object.entries(sounds)) {
                        this.resources.sounds[category].set(id, sound);
                    }
                }
            }
    
            if (packData.splashArt) {
                for (const [category, artItems] of Object.entries(packData.splashArt)) {
                    if (!this.resources.splashArt[category]) {
                        this.resources.splashArt[category] = new Map();
                    }
                    for (const [id, art] of Object.entries(artItems)) {
                        this.resources.splashArt[category].set(id, art);
                    }
                }
            }
    
            if (packData.effects) {
                for (const [category, effects] of Object.entries(packData.effects)) {
                    if (!this.resources.effects[category]) {
                        this.resources.effects[category] = new Map();
                    }
                    for (const [id, effect] of Object.entries(effects)) {
                        this.resources.effects[category].set(id, effect);
                    }
                }
            }
            
            // Also save metadata
            if (packData.metadata) {
                this.resources.metadata = packData.metadata;
            }
            
            // Update active resource pack reference
            this.activeResourcePack = packData;
            
            // Complete progress
            this.updateLoadProgress(overlay, 100, 'Load complete!');
            
            // Add a short delay before removing the overlay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Show success notification
            this.showSuccessNotification(`Successfully loaded resource pack with ${totalTextures} textures`);
            
            // Remove the overlay
            overlay.remove();
            
            return true;
        } catch (error) {
            console.error('Error loading resource pack:', error);
            
            // Remove progress overlay if it exists
            document.querySelector('.load-progress-overlay')?.remove();
            
            // Show error notification
            this.showErrorNotification('Error loading resource pack: ' + error.message);
            
            return false;
        }
    }
    
    // Create loading progress overlay (similar to save progress but with different title)
    createLoadProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'load-progress-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const card = document.createElement('div');
        card.className = 'load-progress-card';
        card.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 24px;
            width: 400px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        `;
        
        card.innerHTML = `
            <h2 style="margin-top: 0; font-size: 1.5em; font-weight: 500;">Loading Resource Pack</h2>
            <p class="progress-status" style="margin-bottom: 16px; color: #666;">Reading file...</p>
            
            <div class="progress-container" style="width: 100%; height: 8px; background-color: #f0f0f0; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
                <div class="progress-bar" style="width: 0%; height: 100%; background-color: #3F51B5; transition: width 0.3s ease;"></div>
            </div>
            
            <div style="color: #666; font-size: 0.9em;">
                <p>Loading large resource packs may take a moment.</p>
                <p style="margin-bottom: 0;">Please don't close this window.</p>
            </div>
        `;
        
        overlay.appendChild(card);
        return overlay;
    }
    
    // Update progress bar and status text for loading
    updateLoadProgress(overlay, percent, statusText) {
        const progressBar = overlay.querySelector('.progress-bar');
        const progressStatus = overlay.querySelector('.progress-status');
        
        if (progressBar && progressStatus) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            progressStatus.textContent = statusText;
        }
    }
    
    async saveResourcePack(mapName = null) {
        try {
            // Create save progress overlay
            const overlay = this.createSaveProgressOverlay();
            document.body.appendChild(overlay);
            
            // Set initial progress
            this.updateSaveProgress(overlay, 0, 'Preparing resource pack...');
            
            // Small delay to let the UI update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Prepare basic pack data without texture data first
            const packData = {
                name: this.activeResourcePack?.name || 'New Resource Pack',
                version: '1.0',
                metadata: this.resources.metadata || {},
                chunks: []  // We'll track chunks here
            };
    
            // Create filename
            const filename = mapName ? 
                `${mapName}.resource.json` : 
                'resource-pack.json';
                
            console.log(`Starting chunked save of resource pack: ${filename}`);
            
            // Count total items for progress tracking
            let totalCategories = Object.keys(this.resources.textures).length;
            let processedCategories = 0;
            let totalTextures = 0;
            let processedTextures = 0;
            
            // Count total textures
            for (const [category, textures] of Object.entries(this.resources.textures)) {
                totalTextures += textures.size;
            }
            
            // Use more efficient method to serialize textures
            this.updateSaveProgress(overlay, 5, 'Processing textures...');
            packData.textures = {};
            
            // Process each texture category
            for (const [category, textures] of Object.entries(this.resources.textures)) {
                packData.textures[category] = {};
                
                const categoryDisplayName = category.charAt(0).toUpperCase() + category.slice(1);
                this.updateSaveProgress(
                    overlay, 
                    5 + (processedCategories / totalCategories * 50), 
                    `Processing ${categoryDisplayName}...`
                );
                
                // Break the operation into chunks
                const textureEntries = Array.from(textures.entries());
                const chunkSize = 10; // Process 10 textures at a time
                
                // Process in chunks to avoid memory issues
                for (let i = 0; i < textureEntries.length; i += chunkSize) {
                    // Create a small delay between chunks to allow garbage collection
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    const chunk = textureEntries.slice(i, i + chunkSize);
                    
                    // Process this chunk
                    for (const [id, texture] of chunk) {
                        // Optimize texture data by compressing images if they're large
                        let optimizedData = texture.data;
                        
                        // Update progress
                        processedTextures++;
                        const textureProgress = 5 + 
                            (processedCategories / totalCategories * 50) + 
                            (i / textureEntries.length * (50 / totalCategories));
                        
                        this.updateSaveProgress(
                            overlay, 
                            textureProgress, 
                            `Processing ${texture.name}...`
                        );
                        
                        // If data is a data URL and is large, try to compress it
                        if (typeof texture.data === 'string' && 
                            texture.data.startsWith('data:image/') && 
                            texture.data.length > 500000) { // 500KB threshold
                            
                            try {
                                // Create a more efficient compressed version
                                optimizedData = await this.compressImageData(texture.data);
                                console.log(`Compressed image: ${texture.name} (${Math.round(texture.data.length/1024)}KB → ${Math.round(optimizedData.length/1024)}KB)`);
                            } catch (e) {
                                console.warn(`Failed to compress image: ${texture.name}`, e);
                                optimizedData = texture.data;
                            }
                        }
                        
                        // Store optimized texture data
                        packData.textures[category][id] = {
                            id: texture.id,
                            name: texture.name,
                            category: texture.category,
                            subcategory: texture.subcategory,
                            data: optimizedData,
                            thumbnail: texture.thumbnail,
                            dateAdded: texture.dateAdded,
                            tags: texture.tags || [],
                            sourcePath: texture.sourcePath || null
                        };
                    }
                }
                
                processedCategories++;
            }
            
            // Update progress
            this.updateSaveProgress(overlay, 60, 'Processing other resources...');
            
            // Save smaller data categories normally
            packData.sounds = this.serializeSounds();
            packData.splashArt = this.serializeSplashArt();
            packData.effects = this.serializeEffects();
            
            // Update progress
            this.updateSaveProgress(overlay, 80, 'Creating file...');
            
            // Prepare the JSON data
            const jsonData = JSON.stringify(packData, null, 2);
            
            // Update progress
            this.updateSaveProgress(overlay, 90, 'Creating download...');
            
            // Save to file
            const blob = new Blob([jsonData], {
                type: 'application/json'
            });
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            
            // Show success before triggering download
            this.updateSaveProgress(overlay, 100, 'Save complete!');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Initiate download
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            
            // Show success notification
            this.showSuccessNotification(`Successfully saved ${filename}`);
            
            // Remove progress overlay
            overlay.remove();
            
            console.log(`Successfully saved resource pack: ${filename}`);
            return filename;
        } catch (error) {
            console.error('Error saving resource pack:', error);
            
            // Remove progress overlay if it exists
            document.querySelector('.save-progress-overlay')?.remove();
            
            // Show error notification
            this.showErrorNotification('Error saving resource pack: ' + error.message);
            return null;
        }
    }

    createSaveProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'save-progress-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const card = document.createElement('div');
        card.className = 'save-progress-card';
        card.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 24px;
            width: 400px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        `;
        
        card.innerHTML = `
            <h2 style="margin-top: 0; font-size: 1.5em; font-weight: 500;">Saving Resource Pack</h2>
            <p class="progress-status" style="margin-bottom: 16px; color: #666;">Preparing...</p>
            
            <div class="progress-container" style="width: 100%; height: 8px; background-color: #f0f0f0; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
                <div class="progress-bar" style="width: 0%; height: 100%; background-color: #3F51B5; transition: width 0.3s ease;"></div>
            </div>
            
            <div style="color: #666; font-size: 0.9em;">
                <p>Processing large resource packs may take a moment.</p>
                <p style="margin-bottom: 0;">Please don't close this window.</p>
            </div>
        `;
        
        overlay.appendChild(card);
        return overlay;
    }
    
    // Update progress bar and status text
    updateSaveProgress(overlay, percent, statusText) {
        const progressBar = overlay.querySelector('.progress-bar');
        const progressStatus = overlay.querySelector('.progress-status');
        
        if (progressBar && progressStatus) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            progressStatus.textContent = statusText;
        }
    }
    
    // Show success notification toast
    showSuccessNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease, fadeOut 0.5s ease 4.5s forwards;
        `;
        
        toast.innerHTML = `
            <span class="material-icons">check_circle</span>
            <span>${message}</span>
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        
        // Remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    // Show error notification toast
    showErrorNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #F44336;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        toast.innerHTML = `
            <span class="material-icons">error</span>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            margin-left: 8px;
            padding: 0;
        `;
        
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
        
        toast.appendChild(closeBtn);
        
        // Remove after 8 seconds if not closed manually
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.remove();
            }
        }, 8000);
    }


    // Add a method to save textures in chunks
    async saveTexturesChunked(packData, chunkSize = 10) {
        packData.textures = {};
        
        // Process each texture category
        for (const [category, textures] of Object.entries(this.resources.textures)) {
            packData.textures[category] = {};
            
            // Break the operation into chunks
            const textureEntries = Array.from(textures.entries());
            const totalTextures = textureEntries.length;
            
            console.log(`Saving ${totalTextures} textures in category: ${category}`);
            
            // Process in chunks to avoid memory issues
            for (let i = 0; i < totalTextures; i += chunkSize) {
                // Create a small delay between chunks to allow garbage collection
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                const chunk = textureEntries.slice(i, i + chunkSize);
                
                // Process this chunk
                chunk.forEach(([id, texture]) => {
                    // Optimize texture data by compressing images if they're large
                    let optimizedData = texture.data;
                    
                    // If data is a data URL and is large, try to compress it
                    if (typeof texture.data === 'string' && 
                        texture.data.startsWith('data:image/') && 
                        texture.data.length > 500000) { // 500KB threshold
                        
                        try {
                            // Create a more efficient compressed version
                            optimizedData = this.compressImageData(texture.data);
                            console.log(`Compressed image: ${texture.name} (${Math.round(texture.data.length/1024)}KB → ${Math.round(optimizedData.length/1024)}KB)`);
                        } catch (e) {
                            console.warn(`Failed to compress image: ${texture.name}`, e);
                            optimizedData = texture.data;
                        }
                    }
                    
                    // Store optimized texture data
                    packData.textures[category][id] = {
                        id: texture.id,
                        name: texture.name,
                        category: texture.category,
                        subcategory: texture.subcategory,
                        data: optimizedData,
                        thumbnail: texture.thumbnail,
                        dateAdded: texture.dateAdded,
                        tags: texture.tags || [],
                        sourcePath: texture.sourcePath || null
                    };
                });
                
                console.log(`Saved chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(totalTextures/chunkSize)} in ${category}`);
            }
        }
        
        return packData;
    }
    
    // Add a method to compress image data
    compressImageData(dataUrl, quality = 0.7) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set dimensions
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw at original size
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert to WebP with compression
                    const compressedData = canvas.toDataURL('image/webp', quality);
                    resolve(compressedData);
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image for compression'));
                };
                
                img.src = dataUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    serializeTextures() {
        const serialized = {};
        for (const [category, textures] of Object.entries(this.resources.textures)) {
            serialized[category] = {};
            textures.forEach((texture, id) => {
                serialized[category][id] = {
                    id: texture.id,
                    name: texture.name,
                    category: texture.category,
                    subcategory: texture.subcategory,
                    data: texture.data,
                    thumbnail: texture.thumbnail,
                    dateAdded: texture.dateAdded,
                    // Include tag information
                    tags: texture.tags || [],
                    sourcePath: texture.sourcePath || null
                };
            });
        }
        return serialized;
    }

    // Update serializeSounds method
    serializeSounds() {
        const serialized = {};
        for (const [category, sounds] of Object.entries(this.resources.sounds)) {
            serialized[category] = {};
            sounds.forEach((sound, id) => {
                serialized[category][id] = {
                    id: sound.id,
                    name: sound.name,
                    data: sound.data,
                    duration: sound.duration,
                    dateAdded: sound.dateAdded
                };
            });
        }
        return serialized;
    }

    // Update serializeSplashArt method
    serializeSplashArt() {
        const serialized = {};
        for (const [category, artMap] of Object.entries(this.resources.splashArt)) {
            serialized[category] = {};
            artMap.forEach((art, id) => {
                serialized[category][id] = {
                    id: art.id,
                    name: art.name,
                    data: art.data,
                    thumbnail: art.thumbnail,
                    description: art.description,
                    dateAdded: art.dateAdded
                };
            });
        }
        return serialized;
    }

    serializeEffects() {
        const serialized = {};
        for (const [category, effects] of Object.entries(this.resources.effects)) {
            serialized[category] = {};
            effects.forEach((effect, id) => {
                serialized[category][id] = {
                    id: effect.id,
                    name: effect.name,
                    data: effect.data,
                    thumbnail: effect.thumbnail,
                    dateAdded: effect.dateAdded
                };
            });
        }
        return serialized;
    }

    addSplashArtCategory(image, category = 'title') {
        return {
            ...image,
            category: category
        };
    }

    deserializeResourcePack(packData) {
        // First restore propFolderMap if it exists in metadata
        if (packData.metadata && packData.metadata.propFolders) {
            this.propFolderMap = new Map();
            
            packData.metadata.propFolders.forEach(folder => {
                this.propFolderMap.set(folder.tag, {
                    label: folder.label,
                    files: folder.files
                });
            });
            
            console.log('Restored prop folder map with tags:', this.propFolderMap);
        }
        
        // Handle texture deserialization - check if we're using chunked format
        if (packData.textures) {
            // Process each texture category
            for (const [category, textures] of Object.entries(packData.textures)) {
                if (!this.resources.textures[category]) {
                    this.resources.textures[category] = new Map();
                }
                
                // Process the textures
                for (const [id, texture] of Object.entries(textures)) {
                    this.resources.textures[category].set(id, texture);
    
                    // Set first wall texture as default
                    if (category === 'walls' && !this.defaultWallTextureId) {
                        this.defaultWallTextureId = id;
                    }
                }
            }
        }
        
        // Continue with the rest of the deserialization (sounds, splashArt, effects)
        if (packData.sounds) {
            for (const [category, sounds] of Object.entries(packData.sounds)) {
                if (!this.resources.sounds[category]) {
                    this.resources.sounds[category] = new Map();
                }
                for (const [id, sound] of Object.entries(sounds)) {
                    this.resources.sounds[category].set(id, sound);
                }
            }
        }
    
        if (packData.splashArt) {
            for (const [category, artItems] of Object.entries(packData.splashArt)) {
                if (!this.resources.splashArt[category]) {
                    this.resources.splashArt[category] = new Map();
                }
                for (const [id, art] of Object.entries(artItems)) {
                    this.resources.splashArt[category].set(id, art);
                }
            }
        }
    
        if (packData.effects) {
            for (const [category, effects] of Object.entries(packData.effects)) {
                if (!this.resources.effects[category]) {
                    this.resources.effects[category] = new Map();
                }
                for (const [id, effect] of Object.entries(effects)) {
                    this.resources.effects[category].set(id, effect);
                }
            }
        }
        
        // Also save metadata
        if (packData.metadata) {
            this.resources.metadata = packData.metadata;
        }
    }

    getDefaultWallTexture() {
        if (!this.defaultWallTextureId) return null;
        return this.resources.textures.walls.get(this.defaultWallTextureId);
    }

    serializeTextureAssignments() {
        return Array.from(this.textureAssignments.entries())
            .map(([wallId, data]) => ({
                wallId,
                textureId: data.textureId,
                type: data.type,
                dateAssigned: data.dateAssigned
            }));
    }

    deserializeTextureAssignments(data) {
        this.textureAssignments = new Map();
        data?.forEach(item => {
            this.textureAssignments.set(item.wallId, {
                textureId: item.textureId,
                type: item.type,
                dateAssigned: item.dateAssigned
            });
        });
    }

    // Method to link resources to a map
    linkMapToResources(mapName, resourceIds) {
        this.mapResourceLinks.set(mapName, {
            packId: this.activePackId,
            resources: resourceIds
        });
    }

    // Load additional resource pack without replacing current one
    async loadAdditionalPack(jsonFile) {
        try {
            const response = await fetch(jsonFile);
            const packData = await response.json();
            this.loadedPacks.set(packData.id, packData);

            // Optional: Switch to this pack
            // this.switchResourcePack(packData.id);

            return packData.id;
        } catch (error) {
            console.error('Error loading resource pack:', error);
            return null;
        }
    }

    // Switch between loaded resource packs
    switchResourcePack(packId) {
        if (this.loadedPacks.has(packId)) {
            this.activePackId = packId;
            // Update UI to reflect active pack
            this.updateResourceUI();
            return true;
        }
        return false;
    }

    // Get resource from any loaded pack
    getResourceFromPack(resourceId, packId = null) {
        const pack = packId ?
            this.loadedPacks.get(packId) :
            this.loadedPacks.get(this.activePackId);

        return pack?.resources[resourceId] || null;
    }

    async showTextureSelectionDialog(structure) {
        // Create dialog
        const dialog = document.createElement('sl-dialog');
        dialog.label = `Assign Texture to ${structure.type === 'wall' ? 'Wall' : 'Room'}`;

        // Get appropriate textures based on structure type
        const categories = structure.type === 'wall' ? ['walls', 'doors'] : ['floors'];

        // Create the dialog content
        dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Category Selection -->
            <sl-select label="Texture Type" id="textureCategory">
                ${categories.map(cat => `
                    <sl-option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</sl-option>
                `).join('')}
            </sl-select>

            <!-- Texture Gallery -->
            <div class="texture-selection-gallery" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 8px;
                max-height: 300px;
                overflow-y: auto;
                padding: 8px;
                background: var(--sl-color-neutral-50);
                border-radius: var(--sl-border-radius-medium);
            ">
                <!-- Textures will be loaded here -->
            </div>

            <!-- Preview Area -->
            <div class="texture-preview" style="
                display: none;
                padding: 16px;
                background: var(--sl-color-neutral-50);
                border-radius: var(--sl-border-radius-medium);
                text-align: center;
            ">
                <img style="max-width: 200px; max-height: 200px; object-fit: contain;">
                <div class="preview-name" style="margin-top: 8px; font-weight: 500;"></div>
            </div>
        </div>

        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="apply-btn" disabled>Apply</sl-button>
        </div>
    `;

        // Add to document
        document.body.appendChild(dialog);

        // Get references to elements
        const categorySelect = dialog.querySelector('#textureCategory');
        const gallery = dialog.querySelector('.texture-selection-gallery');
        const preview = dialog.querySelector('.texture-preview');
        const applyBtn = dialog.querySelector('.apply-btn');
        let selectedTextureId = null;

        // Function to update gallery based on category
        const updateGallery = (category) => {
            gallery.innerHTML = '';
            const textures = this.resources?.textures[category];

            if (!textures || textures.size === 0) {
                gallery.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 16px; color: var(--sl-color-neutral-500);">
                    No ${category} textures available
                </div>
            `;
                return;
            }

            textures.forEach((texture, id) => {
                const item = document.createElement('div');
                item.className = 'texture-item';
                item.style.cssText = `
                cursor: pointer;
                padding: 4px;
                border: 2px solid transparent;
                border-radius: var(--sl-border-radius-medium);
                transition: all 0.2s ease;
            `;
                item.innerHTML = `
                <img src="${texture.thumbnail}" 
                     alt="${texture.name}"
                     style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px;">
            `;

                item.addEventListener('click', () => {
                    // Update selection
                    gallery.querySelectorAll('.texture-item').forEach(i =>
                        i.style.borderColor = 'transparent');
                    item.style.borderColor = 'var(--sl-color-primary-500)';
                    selectedTextureId = id;
                    applyBtn.disabled = false;

                    // Update preview
                    preview.style.display = 'block';
                    preview.querySelector('img').src = texture.data;
                    preview.querySelector('.preview-name').textContent = texture.name;
                });

                gallery.appendChild(item);
            });
        };

        // Handle category changes
        categorySelect.addEventListener('sl-change', () => {
            updateGallery(categorySelect.value);
            selectedTextureId = null;
            applyBtn.disabled = true;
            preview.style.display = 'none';
        });

        // Initial gallery load
        updateGallery(categorySelect.value);

        // Return a promise that resolves with the selected texture or null if canceled
        return new Promise((resolve) => {
            dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                dialog.hide();
                resolve(null);
            });

            dialog.querySelector('.apply-btn').addEventListener('click', () => {
                const category = categorySelect.value;
                const texture = this.resources?.textures[category]?.get(selectedTextureId);
                dialog.hide();
                resolve(texture);
            });

            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
            });

            dialog.show();
        });
    }

    getSelectedTexture(category) {
        console.log('Getting selected texture for category:', category);
        if (!this.resources?.textures[category]) {
            console.warn(`No textures found for category: ${category}`);
            return null;
        }

        const textures = this.resources.textures[category];
        const firstTexture = textures.values().next().value;

        // console.log('Found texture:', firstTexture);
        return firstTexture;
    }

    // Add this method to the ResourceManager class

/**
 * Get a specific texture by ID, name, or other criteria
 * @param {string} category - The texture category (walls, doors, props, etc.)
 * @param {object} criteria - Object with criteria to match (id, name, etc.)
 * @return {object|null} - The matching texture or null if not found
 */
getSpecificTexture(category, criteria) {
    console.log('Getting specific texture:', { category, criteria });
    
    // Check if category exists
    if (!this.resources?.textures[category]) {
      console.warn(`No textures found for category: ${category}`);
      return null;
    }
    
    const textures = this.resources.textures[category];
    
    // If criteria is a string, assume it's an ID
    if (typeof criteria === 'string') {
      const texture = textures.get(criteria);
      if (texture) {
        console.log('Found texture by ID:', texture.name);
        return texture;
      }
      
      // If not found by ID, try to match by name
      for (const [id, texture] of textures.entries()) {
        if (texture.name === criteria) {
          console.log('Found texture by name:', texture.name);
          return texture;
        }
      }
      
      console.warn(`Texture not found with ID or name: ${criteria}`);
      return null;
    }
    
    // If criteria is an object, match by specified properties
    if (typeof criteria === 'object') {
      // Search through all textures in this category
      for (const [id, texture] of textures.entries()) {
        let isMatch = true;
        
        // Check each criteria property against the texture
        for (const [key, value] of Object.entries(criteria)) {
          if (texture[key] !== value) {
            isMatch = false;
            break;
          }
        }
        
        if (isMatch) {
          console.log('Found texture matching criteria:', texture.name);
          return texture;
        }
      }
      
      console.warn('No texture found matching criteria:', criteria);
      return null;
    }
    
    // If no match or invalid criteria, return null
    return null;
  }

async addTexture(file, category, options = {}) {
    if (!file || !category) {
        console.warn('Missing required parameters:', { file, category });
        return null;
    }

    try {
        console.log('Creating texture from file:', file);
        // Create thumbnail and base64 data
        const imageData = await this.createImageData(file);
        const thumbnail = await this.createThumbnail(file);

        // Extract a clean name from the filename for props
        let name = file.name;
        if (category === 'props') {
            // Remove file extension
            name = name.replace(/\.[^.]+$/, '');
            // Remove numbers and parentheses like (1), (2)
            name = name.replace(/\s*\(\d+\)\s*$/, '');
            // Convert to proper case (first letter capitalized)
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Enhanced texture data with tags
        const textureData = {
            id: `${category}_${Date.now()}`,
            name: name,
            originalFilename: file.name,
            category,
            subcategory: options.subcategory || null,
            data: imageData,
            thumbnail,
            dateAdded: new Date().toISOString(),
            // Add tags if available (for props folder import)
            tags: options.tags || [],
            sourcePath: options.sourcePath || null
        };

        console.log('Created texture data:', textureData);

        // Store in appropriate category
        if (!this.resources.textures[category]) {
            this.resources.textures[category] = new Map();
        }
        this.resources.textures[category].set(textureData.id, textureData);

        return textureData.id;
    } catch (error) {
        console.error('Error adding texture:', error);
        return null;
    }
}

    async addSplashArt(file, description = '', category = 'title') {
        if (!file) {
            console.warn('No file provided for splash art');
            return null;
        }
        
        try {
            // Create image data and thumbnail
            const imageData = await this.createImageData(file);
            const thumbnail = await this.createThumbnail(file);
            
            const splashArtData = {
                id: `splashArt_${Date.now()}`,
                name: file.name,
                description: description,
                category: category,
                data: imageData,
                thumbnail: thumbnail,
                dateAdded: new Date().toISOString()
            };
            
            // Initialize category if it doesn't exist
            if (!this.resources.splashArt[category]) {
                this.resources.splashArt[category] = new Map();
            }
            
            // Store in the correct category
            this.resources.splashArt[category].set(splashArtData.id, splashArtData);
            console.log('Added splash art:', splashArtData);
            
            return splashArtData.id;
        } catch (error) {
            console.error('Error adding splash art:', error);
            return null;
        }
    }


    async createImageData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async createThumbnail(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate thumbnail dimensions maintaining aspect ratio
                const ratio = img.width / img.height;
                let width = this.thumbnailSize;
                let height = this.thumbnailSize;

                if (ratio > 1) {
                    height = width / ratio;
                } else {
                    width = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/webp', 0.8));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    getTexture(id, category) {
        return this.resources.textures[category]?.get(id) || null;
    }

    assignTextureToWall(wallId, textureId) {
        if (!this.resources.textures.walls.has(textureId)) {
            console.warn('Texture not found:', textureId);
            return false;
        }

        this.textureAssignments.set(wallId, {
            textureId,
            type: 'wall',
            dateAssigned: new Date().toISOString()
        });

        console.log('Texture assigned:', {
            wallId,
            textureId,
            assignments: this.textureAssignments
        });

        return true;
    }

    // Add method to get texture assignment
    getWallTextureAssignment(wallId) {
        return this.textureAssignments.get(wallId);
    }

    // Add this method to the ResourceManager class

    getStructureTextureAssignment(structureId) {
        // This method will handle both walls and rooms
        const assignment = this.textureAssignments.get(structureId);
        if (assignment) {
            // console.log('Found texture assignment for structure:', {
            //     structureId,
            //     assignment
            // });
            return assignment;
        }
        // console.log('No texture assignment found for structure:', structureId);
        return null;
    }

    assignTextureToStructure(structureId, textureId, category) {
        if (!this.resources.textures[category]?.has(textureId)) {
            console.warn('Texture not found:', textureId);
            return false;
        }

        if (!this.textureAssignments) {
            this.textureAssignments = new Map();
        }

        this.textureAssignments.set(structureId, {
            textureId,
            type: category,
            dateAssigned: new Date().toISOString()
        });

        console.log('Texture assigned:', {
            structureId,
            textureId,
            category,
            assignments: this.textureAssignments
        });

        return true;
    }

    getDefaultRoomTexture() {
        if (!this.defaultRoomTextureId) return null;
        return this.resources.textures.rooms?.get(this.defaultRoomTextureId);
    }

    // Gallery UI methods can be added here
    createGalleryUI(container) {
        container.innerHTML = '';

        // Create category tabs
        const tabs = document.createElement('div');
        tabs.className = 'resource-tabs';

        Object.keys(this.resources.textures).forEach(category => {
            const tab = document.createElement('div');
            tab.className = 'resource-tab';
            tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            tab.onclick = () => this.showCategory(category, container);
            tabs.appendChild(tab);
        });

        container.appendChild(tabs);

        // Create gallery content area
        const content = document.createElement('div');
        content.className = 'resource-content';
        container.appendChild(content);

        // Show first category by default
        const firstCategory = Object.keys(this.resources.textures)[0];
        if (firstCategory) {
            this.showCategory(firstCategory, container);
        }
    }


updateGallery(drawer, category, view = 'grid') {
    // Determine which tab panel to use
    let tabPanelName;
    if (['ambient', 'effects'].includes(category)) {
        tabPanelName = 'sounds';
    } else if (['walls', 'doors', 'environmental', 'props'].includes(category)) {
        tabPanelName = 'textures';
    } else if (['title', 'loading', 'background'].includes(category)) {
        tabPanelName = 'splashArt';
    } else {
        tabPanelName = category;
    }
    
    console.log(`Looking for gallery in tab panel: ${tabPanelName}`);
    
    // Find the tab panel
    const tabPanel = drawer.querySelector(`sl-tab-panel[name="${tabPanelName}"]`);
    if (!tabPanel) {
        console.error(`Tab panel ${tabPanelName} not found`);
        return;
    }
    
    // Find or create container
    let container = drawer.querySelector(`#${category}Gallery`);
    if (!container) {
        console.log(`Creating new gallery container for ${category}`);
        container = document.createElement('div');
        container.id = `${category}Gallery`;
        container.className = `gallery-container ${view === 'grid' ? 'gallery-grid' : 'gallery-list'}`;
        tabPanel.appendChild(container);
    }

    // Hide all other galleries in the same tab panel and show this one
    tabPanel.querySelectorAll('.gallery-container').forEach(gallery => {
        gallery.style.display = gallery.id === `${category}Gallery` ? '' : 'none';
    });

    // Update container class based on view
    container.className = `gallery-container ${view === 'grid' ? 'gallery-grid' : 'gallery-list'}`;
    
    // IMPORTANT: Get resources FIRST before any UI code that uses them
    // Get resources based on category type
    let resources;
    if (['title', 'loading', 'background'].includes(category)) {
        resources = this.resources.splashArt[category];
        if (!resources) {
            this.resources.splashArt[category] = new Map();
            resources = this.resources.splashArt[category];
        }
    } else if (category === 'ambient' || category === 'effects') {
        resources = this.resources.sounds[category];
    } else {
        resources = this.resources.textures[category];
    }

    // Apply tag filter for props
    let filteredResources = resources;
    if (category === 'props' && this.activeTagFilter) {
        // Get list of file IDs that belong to this tag
        const tagData = this.propFolderMap?.get(this.activeTagFilter);
        if (tagData && tagData.files) {
            // Filter resources to only include files with this tag
            filteredResources = new Map();
            tagData.files.forEach(fileId => {
                if (resources.has(fileId)) {
                    filteredResources.set(fileId, resources.get(fileId));
                }
            });
        }
    }
    
    // NOW we can handle the UI elements that refer to resources
    
    // Handle view controls and search for props
    const viewControls = tabPanel.querySelector('.view-controls');
    if (viewControls) {
        // Remove any existing search controls and count displays
        const existingSearch = viewControls.querySelector('.props-search-controls');
        if (existingSearch) {
            existingSearch.remove();
        }
        
        const existingCount = viewControls.querySelector('.props-count');
        if (existingCount) {
            existingCount.remove();
        }
        
        // Add search controls if we're in props category
        if (category === 'props') {
            const searchControls = document.createElement('div');
            searchControls.className = 'props-search-controls';
            searchControls.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin-right: auto; // Push view toggles to the right
            `;
            
            searchControls.innerHTML = `
                <sl-input type="search" placeholder="Search props..." style="width: 200px;" id="props-search">
                    <span slot="prefix" class="material-icons" style="font-size: 16px; color: #666;">search</span>
                </sl-input>
                ${this.activeTagFilter ? `
                    <sl-button size="small" class="clear-tag-filter" variant="default">
                        <span class="material-icons" style="font-size: 16px;">filter_alt_off</span>
                        Clear Filter
                    </sl-button>
                ` : ''}
            `;
            
            // Add search controls before the view toggles
            viewControls.insertBefore(searchControls, viewControls.firstChild);
            
            // Register search handler
            const searchInput = searchControls.querySelector('#props-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterPropsByName(drawer, e.target.value);
                });
            }
            
            // Register clear filter handler
            const clearBtn = searchControls.querySelector('.clear-tag-filter');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.clearPropsTagFilter(drawer);
                });
            }
            
            // Now that resources and filteredResources are defined, add the count display
            const totalItems = resources ? resources.size : 0;
            const filteredItems = filteredResources ? filteredResources.size : 0;
            
            const countDisplay = document.createElement('div');
            countDisplay.className = 'props-count';
            countDisplay.style.cssText = `
                margin-left: 16px;
                font-size: 0.9em;
                color: #666;
            `;
            
            if (this.activeTagFilter) {
                countDisplay.textContent = `${filteredItems} of ${totalItems} items`;
            } else {
                countDisplay.textContent = `${totalItems} items`;
            }
            
            viewControls.appendChild(countDisplay);
        }
    }

    // Create two-column layout for props
    if (category === 'props') {
        // Check if we already have the layout container
        let layoutContainer = tabPanel.querySelector('.props-layout-container');
        if (!layoutContainer) {
            // Create the layout container
            layoutContainer = document.createElement('div');
            layoutContainer.className = 'props-layout-container';
            layoutContainer.style.cssText = `
                display: flex;
                gap: 16px;
                height: calc(100% - 60px); // Leave room for the controls
            `;
            
            // Move the container into the layout container
            if (container.parentNode) {
                container.parentNode.insertBefore(layoutContainer, container);
                layoutContainer.appendChild(container);
            }
        }
        
        // Update the container styles for the props grid
        container.style.cssText = `
            flex: 1;
            overflow-y: auto;
            height: 100%;
            padding: 8px;
        `;
        
        // Create or update the tag filter sidebar
        let tagSidebar = layoutContainer.querySelector('.props-tag-sidebar');
        if (!tagSidebar) {
            tagSidebar = document.createElement('div');
            tagSidebar.className = 'props-tag-sidebar';
            tagSidebar.style.cssText = `
                width: 250px;
                flex-shrink: 0;
                background: #f5f5f5;
                border-radius: 4px;
                padding: 12px;
                overflow-y: auto;
                height: 100%;
            `;
            
            // Add to layout before the main container
            layoutContainer.insertBefore(tagSidebar, container);
        }
        
        // Update tag filter content
        this.updateTagSidebar(drawer, tagSidebar);
    } else {
        // Reset container styles for non-props categories
        container.style.cssText = '';
    }

    // Check for empty resources case
    if (!filteredResources || filteredResources.size === 0) {
        container.innerHTML = `
            <sl-card class="empty-gallery">
                <div style="text-align: center; padding: 2rem;">
                    ${category === 'ambient' || category === 'effects' ? 
                        '<span class="material-icons" style="font-size: 3rem; opacity: 0.5;">volume_off</span>' :
                        '<span class="material-icons" style="font-size: 3rem; opacity: 0.5;">image_not_supported</span>'
                    }
                    <p>No ${category} added yet</p>
                </div>
            </sl-card>
        `;
        return;
    }

    // Clear the main container
    container.innerHTML = '';

    // Create cards for each resource
    filteredResources.forEach((resource, id) => {
        const card = document.createElement('sl-card');
        card.className = 'resource-item';

        // Build card HTML
        card.innerHTML = `
        ${view === 'grid' ? `
            <img 
                src="${resource.thumbnail}" 
                alt="${resource.name}"
                class="resource-thumbnail"
            />
            <div class="resource-info">
                <div class="resource-name" style="color: #666; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">${resource.name}</div>
                <div class="resource-meta" style="color: #777; font-size: 0.85em;">${this.formatDate(resource.dateAdded)}</div>
                ${resource.originalFilename ? 
                    `<div class="resource-filename" style="color: #999; font-size: 0.8em; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${resource.originalFilename}</div>` : ''}
                
                ${category === 'props' && resource.tags && resource.tags.length > 0 ? 
                    `<div class="resource-tags" style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                        ${resource.tags.map(tag => 
                            `<sl-tag size="small" style="cursor: pointer; max-width: 100%; overflow: hidden;" 
                                    data-tag="${tag}" 
                                    title="${this.formatTagDisplay(tag)}">
                                <span class="material-icons" style="font-size: 12px; margin-right: 4px;">folder</span>
                                ${this.formatTagDisplay(tag).split(' › ').pop()}
                            </sl-tag>`
                        ).join('')}
                    </div>` : ''}
            </div>
        ` : `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <img 
                    src="${resource.thumbnail}" 
                    alt="${resource.name}"
                    class="resource-thumbnail"
                    style="width: 50px; height: 50px;"
                />
                <div class="resource-info">
                    <div class="resource-name" style="color: #666; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">${resource.name}</div>
                    <div class="resource-meta" style="color: #777; font-size: 0.85em;">${this.formatDate(resource.dateAdded)}</div>
                    ${resource.originalFilename ? 
                        `<div class="resource-filename" style="color: #999; font-size: 0.8em; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${resource.originalFilename}</div>` : ''}
                    
                    ${category === 'props' && resource.tags && resource.tags.length > 0 ? 
                        `<div class="resource-tags" style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                            ${resource.tags.map(tag => 
                                `<sl-tag size="small" style="cursor: pointer; max-width: 100%; overflow: hidden;" 
                                        data-tag="${tag}" 
                                        title="${this.formatTagDisplay(tag)}">
                                    <span class="material-icons" style="font-size: 12px; margin-right: 4px;">folder</span>
                                    ${this.formatTagDisplay(tag).split(' › ').pop()}
                                </sl-tag>`
                            ).join('')}
                        </div>` : ''}
                </div>
            </div>
        `}
        <div slot="footer" class="resource-actions">
            <sl-button-group>
                <sl-button size="small" class="preview-btn">
                    <span class="material-icons">visibility</span>
                </sl-button>
                ${category === 'props' ? `
                <sl-button size="small" class="edit-name-btn">
                    <span class="material-icons">edit</span>
                </sl-button>
                ` : ''}
                <sl-button size="small" class="delete-btn" variant="danger">
                    <span class="material-icons">delete</span>
                </sl-button>
            </sl-button-group>
        </div>
        `;

        // Add tag click handlers
        if (category === 'props') {
            const tagElements = card.querySelectorAll('.resource-tags sl-tag');
            tagElements.forEach(tag => {
                tag.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tagValue = tag.dataset.tag;
                    this.setPropsTagFilter(drawer, tagValue);
                });
            });
        }

        // Add preview button handler
        card.querySelector('.preview-btn').addEventListener('click', () => {
            this.showResourcePreview(resource);
        });

        if (category === 'props') {
            card.querySelector('.edit-name-btn').addEventListener('click', () => {
                this.showNameEditor(resource, category, id, card);
            });
        }

        // Add delete button handler
        card.querySelector('.delete-btn').addEventListener('click', () => {
            const confirmMessage = `Delete ${category === 'ambient' || category === 'effects' ? 'sound' : 'resource'} "${resource.name}"?`;

            if (confirm(confirmMessage)) {
                if (category === 'ambient' || category === 'effects') {
                    this.deleteSound(id, category);
                } else {
                    this.deleteResource(category, id);
                }
                this.updateGallery(drawer, category, view);
            }
        });

        container.appendChild(card);
    });
}

// New method to update the tag sidebar
updateTagSidebar(drawer, sidebarElement) {
    sidebarElement.innerHTML = '';
    
    // Only proceed if we have folder data
    if (!this.propFolderMap || this.propFolderMap.size === 0) {
        // Add message about how to get tags
        sidebarElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <span class="material-icons" style="color: #666;">info</span>
                <span style="color: #666; font-size: 0.9em;">Import folders to enable tag filtering</span>
            </div>
        `;
        return;
    }
    
    // Create header section with active filter info
    const headerElement = document.createElement('div');
    headerElement.style.cssText = `
        margin-bottom: 16px;
        font-weight: 500;
        color: #333;
    `;
    
    if (this.activeTagFilter) {
        // Show active filter info
        const parentData = this.propFolderMap.get(this.activeTagFilter);
        
        headerElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
                <span class="material-icons" style="font-size: 18px; color: #666;">folder_open</span>
                <span>Current Filter:</span>
            </div>
            <div style="background: #e0e0e0; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                <div style="font-weight: bold;">${parentData ? parentData.label : this.formatTagDisplay(this.activeTagFilter)}</div>
            </div>
        `;
        
        // Add "up" button if not at root level
        if (this.activeTagFilter.includes('-')) {
            const upButton = document.createElement('sl-button');
            upButton.size = 'small';
            upButton.variant = 'neutral';
            upButton.style.width = '100%';
            upButton.style.marginBottom = '16px';
            upButton.innerHTML = `
                <span class="material-icons" style="font-size: 14px; margin-right: 4px;">arrow_upward</span>
                Up One Level
            `;
            
            // Go up one level on click
            upButton.addEventListener('click', () => {
                const tagParts = this.activeTagFilter.split('-');
                tagParts.pop();
                const parentFolder = tagParts.join('-');
                this.setPropsTagFilter(drawer, parentFolder);
            });
            
            headerElement.appendChild(upButton);
        }
    } else {
        // Show "All Props" header
        headerElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
                <span class="material-icons" style="font-size: 18px; color: #666;">folder</span>
                <span>All Categories</span>
            </div>
        `;
    }
    
    sidebarElement.appendChild(headerElement);
    
    // Determine which tags to show based on active filter
    let tagsToShow = new Map();
    
    if (this.activeTagFilter) {
        // Find all direct child tags
        const parentTag = this.activeTagFilter;
        
        this.propFolderMap.forEach((data, tag) => {
            // Tag starts with parent but is not the parent itself
            if (tag !== parentTag && tag.startsWith(parentTag + '-')) {
                // Direct child only (no grandchildren)
                const tagParts = tag.split('-');
                const parentParts = parentTag.split('-');
                
                if (tagParts.length === parentParts.length + 1) {
                    tagsToShow.set(tag, data);
                }
            }
        });
    } else {
        // Show only top-level tags
        this.propFolderMap.forEach((data, tag) => {
            // Get only top-level folders (no hyphens means it's a root folder)
            const tagParts = tag.split('-');
            if (tagParts.length === 1) {
                tagsToShow.set(tag, data);
            }
        });
    }
    
    // Create tag list
    const tagList = document.createElement('div');
    tagList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
    `;
    
    // Add tag entries
    tagsToShow.forEach((data, tag) => {
        const tagEntry = document.createElement('div');
        tagEntry.className = 'tag-entry';
        tagEntry.style.cssText = `
            background: white;
            border: 1px solid #e0e0e0;
            color: #000;
            border-radius: 4px;
            padding: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        // Just show the last part of the tag name
        const displayName = this.formatTagDisplay(tag).split(' › ').pop();
        
        tagEntry.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span class="material-icons" style="font-size: 16px; color: #666;">folder</span>
                <span>${displayName}</span>
            </div>
        `;
        
        // Add hover effect
        tagEntry.addEventListener('mouseenter', () => {
            tagEntry.style.background = '#f0f0f0';
        });
        
        tagEntry.addEventListener('mouseleave', () => {
            tagEntry.style.background = 'white';
        });
        
        // Add click handler
        tagEntry.addEventListener('click', () => {
            this.setPropsTagFilter(drawer, tag);
        });
        
        tagList.appendChild(tagEntry);
    });
    
    if (tagsToShow.size === 0) {
        tagList.innerHTML = `
            <div style="text-align: center; color: #666; padding: 12px;">
                No subfolders found
            </div>
        `;
    }
    
    sidebarElement.appendChild(tagList);
}

// Method to update the props tag filter UI
updatePropsTagFilter(drawer, container) {
    // Remove any existing tag filter
    const existingFilter = container.querySelector('.props-tag-filter');
    if (existingFilter) {
        existingFilter.remove();
    }

    // Create tag filter container
    const tagFilterContainer = document.createElement('div');
    tagFilterContainer.className = 'props-tag-filter';
    tagFilterContainer.style.cssText = `
        margin-bottom: 16px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
    `;

    // Only proceed if we have folder data
    if (!this.propFolderMap || this.propFolderMap.size === 0) {
        // Add message about how to get tags
        tagFilterContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-icons" style="color: #666;">info</span>
                <span style="color: #666; font-size: 0.9em;">Import folders to enable tag filtering</span>
            </div>
        `;
        container.prepend(tagFilterContainer);
        return;
    }

    // Add search box
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    searchContainer.innerHTML = `
        <sl-input type="search" placeholder="Search props..." style="flex: 1;" id="props-search">
            <span slot="prefix" class="material-icons" style="font-size: 16px; color: #666;">search</span>
        </sl-input>
        ${this.activeTagFilter ? `
            <sl-button size="small" class="clear-tag-filter" variant="default">
                <span class="material-icons" style="font-size: 16px;">clear</span>
                Clear Filter
            </sl-button>
        ` : ''}
    `;
    
    tagFilterContainer.appendChild(searchContainer);

    // Add tag cloud for top-level folders
    const tagCloud = document.createElement('div');
    tagCloud.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    `;

    // Get unique top-level tags
    const topLevelTags = new Map();
    
    this.propFolderMap.forEach((data, tag) => {
        // Get only top-level folders (no hyphens means it's a root folder)
        const tagParts = tag.split('-');
        if (tagParts.length === 1) {
            topLevelTags.set(tag, data);
        }
    });
    
    // Add tags to the cloud
    topLevelTags.forEach((data, tag) => {
        const tagElement = document.createElement('sl-tag');
        tagElement.variant = this.activeTagFilter === tag ? 'primary' : 'neutral';
        tagElement.size = 'medium';
        tagElement.style.cursor = 'pointer';
        tagElement.innerHTML = `
            <span class="material-icons" style="font-size: 14px; margin-right: 4px;">folder</span>
            ${data.label}
        `;
        tagElement.dataset.tag = tag;
        
        // Add click handler
        tagElement.addEventListener('click', () => {
            this.setPropsTagFilter(drawer, tag);
        });
        
        tagCloud.appendChild(tagElement);
    });
    
    tagFilterContainer.appendChild(tagCloud);
    
    // If a tag is active, show its subcategories
    if (this.activeTagFilter) {
        // Find all child tags that belong to this parent
        const childTags = new Map();
        const parentTag = this.activeTagFilter;
        
        this.propFolderMap.forEach((data, tag) => {
            // Tag starts with parent but is not the parent itself
            if (tag !== parentTag && tag.startsWith(parentTag + '-')) {
                // Direct child only (no grandchildren)
                const tagParts = tag.split('-');
                const parentParts = parentTag.split('-');
                
                if (tagParts.length === parentParts.length + 1) {
                    childTags.set(tag, data);
                }
            }
        });
        
        // Add subtitle showing current path
        const pathElement = document.createElement('div');
        pathElement.style.cssText = `
            margin: 8px 0;
            font-weight: 500;
            color: #333;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        
        // Show breadcrumb
        const parentData = this.propFolderMap.get(parentTag);
        
        pathElement.innerHTML = `
            <span class="material-icons" style="font-size: 16px; color: #666;">folder_open</span>
            <span>${parentData ? parentData.label : this.formatTagDisplay(parentTag)}</span>
        `;
        
        // Add "up" button if not at root level
        if (parentTag.includes('-')) {
            const upButton = document.createElement('sl-button');
            upButton.size = 'small';
            upButton.variant = 'neutral';
            upButton.style.marginLeft = 'auto';
            upButton.innerHTML = `
                <span class="material-icons" style="font-size: 14px;">arrow_upward</span>
                Up
            `;
            
            // Go up one level on click
            upButton.addEventListener('click', () => {
                const tagParts = parentTag.split('-');
                tagParts.pop();
                const parentFolder = tagParts.join('-');
                this.setPropsTagFilter(drawer, parentFolder);
            });
            
            pathElement.appendChild(upButton);
        }
        
        tagFilterContainer.appendChild(pathElement);
        
        // Add subcategory tags if any exist
        if (childTags.size > 0) {
            const subTagCloud = document.createElement('div');
            subTagCloud.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
                padding: 8px;
                background: #fff;
                border-radius: 4px;
            `;
            
            childTags.forEach((data, tag) => {
                const tagElement = document.createElement('sl-tag');
                tagElement.variant = 'neutral';
                tagElement.size = 'small';
                tagElement.style.cursor = 'pointer';
                
                // Just show the last part of the tag name
                const displayName = this.formatTagDisplay(tag).split(' › ').pop();
                
                tagElement.innerHTML = `
                    <span class="material-icons" style="font-size: 12px; margin-right: 4px;">folder</span>
                    ${displayName}
                `;
                tagElement.dataset.tag = tag;
                
                // Add click handler
                tagElement.addEventListener('click', () => {
                    this.setPropsTagFilter(drawer, tag);
                });
                
                subTagCloud.appendChild(tagElement);
            });
            
            tagFilterContainer.appendChild(subTagCloud);
        }
    }
    
    // Register search handler
    const searchInput = searchContainer.querySelector('#props-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.filterPropsByName(drawer, e.target.value);
        });
    }
    
    // Register clear filter handler
    const clearBtn = searchContainer.querySelector('.clear-tag-filter');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            this.clearPropsTagFilter(drawer);
        });
    }
    
    // Add the tag filter to the container
    container.prepend(tagFilterContainer);
}

// Method to set the active tag filter
setPropsTagFilter(drawer, tag) {
    console.log(`Setting props tag filter: ${tag}`);
    this.activeTagFilter = tag;
    this.updateGallery(drawer, 'props');
}

// Method to clear the active tag filter
clearPropsTagFilter(drawer) {
    console.log('Clearing props tag filter');
    this.activeTagFilter = null;
    this.updateGallery(drawer, 'props');
}

// Filter props by name without changing the tag filter
filterPropsByName(drawer, searchTerm) {
    console.log(`Filtering props by name: ${searchTerm}`);
    
    const container = drawer.querySelector('#propsGallery');
    if (!container) return;
    
    // Get all prop cards
    const cards = container.querySelectorAll('.resource-item');
    
    // Show/hide based on name match
    cards.forEach(card => {
        const nameElement = card.querySelector('.resource-name');
        if (!nameElement) return;
        
        const name = nameElement.textContent.toLowerCase();
        const isMatch = !searchTerm || name.includes(searchTerm.toLowerCase());
        
        card.style.display = isMatch ? '' : 'none';
    });
}

showNameEditor(resource, category, id, cardElement) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Edit Prop Name';
    
    dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; gap: 8px; align-items: center;">
                <img src="${resource.thumbnail}" alt="${resource.name}" 
                     style="width: 64px; height: 64px; object-fit: contain; border-radius: 4px;">
                <div>
                    <div style="font-weight: bold; margin-bottom: 4px;">Original Filename:</div>
                    <div style="color: #666; font-style: italic;">${resource.originalFilename || resource.name}</div>
                </div>
            </div>
            
            <sl-input label="Prop Name" id="propName" value="${resource.name}"></sl-input>
            
            <div>
                <div style="margin-bottom: 8px; color: #666;">
                    <small>Enter a descriptive name for this prop. This name will be used throughout the application.</small>
                </div>
            </div>
        </div>
        
        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="save-btn">Save Changes</sl-button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.show();
    
    const nameInput = dialog.querySelector('#propName');
    
    // Focus the input when the dialog opens
    dialog.addEventListener('sl-after-show', () => {
        nameInput.focus();
        // Select the text for easy editing
        nameInput.select();
    });
    
    // Handle save
    dialog.querySelector('.save-btn').addEventListener('click', () => {
        const newName = nameInput.value.trim();
        
        if (newName && newName !== resource.name) {
            // Update the resource name
            resource.name = newName;
            
            // Update UI
            const nameElement = cardElement.querySelector('.resource-name');
            if (nameElement) {
                nameElement.textContent = newName;
            }
            
            // If there's no originalFilename stored, store the current one
            if (!resource.originalFilename) {
                resource.originalFilename = resource.name;
            }
            
            console.log(`Updated prop name: ${id} -> "${newName}"`);
        }
        
        dialog.hide();
    });
    
    // Handle cancel
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        dialog.hide();
    });
    
    // Cleanup
    dialog.addEventListener('sl-after-hide', () => {
        dialog.remove();
    });
}

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    // Preview method
    async showResourcePreview(resource) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = resource.name;

        let cropActive = false;
        let cropStart = { x: 0, y: 0 };
        let currentCrop = null;

        dialog.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div class="image-container" style="position: relative; overflow: hidden; background: #333;">
                    <img src="${resource.data}" 
                         alt="${resource.name}"
                         style="max-width: 100%; max-height: 70vh; display: block; margin: auto; user-select: none; -webkit-user-drag: none;">
                    <div class="crop-overlay" style="display: none; position: absolute; 
                         border: 2px solid #4CAF50; background: rgba(76, 175, 80, 0.2);
                         pointer-events: none;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <sl-button class="crop-btn" variant="primary">
                        <span class="material-icons">crop</span>
                        Start Crop
                    </sl-button>
                    <sl-button class="apply-crop-btn" variant="success" disabled>
                        <span class="material-icons">save</span>
                        Apply Crop
                    </sl-button>
                    <sl-button class="reset-crop-btn" variant="neutral" disabled>
                        <span class="material-icons">restart_alt</span>
                        Reset
                    </sl-button>
                </div>
    
                <div class="crop-instructions" style="display: none; color: #666; text-align: center;">
                    Click and drag to select crop area
                </div>
            </div>
        `;

        const container = dialog.querySelector('.image-container');
        const img = dialog.querySelector('img');
        const overlay = dialog.querySelector('.crop-overlay');
        const cropBtn = dialog.querySelector('.crop-btn');
        const applyCropBtn = dialog.querySelector('.apply-crop-btn');
        const resetCropBtn = dialog.querySelector('.reset-crop-btn');
        const instructions = dialog.querySelector('.crop-instructions');

        // Prevent image dragging
        img.addEventListener('dragstart', (e) => e.preventDefault());
        img.addEventListener('mousedown', (e) => e.preventDefault());

        // Enable cropping
        cropBtn.addEventListener('click', () => {
            cropActive = !cropActive;
            if (cropActive) {
                cropBtn.variant = 'primary';
                container.style.cursor = 'crosshair';
                instructions.style.display = 'block';
            } else {
                cropBtn.variant = 'default';
                container.style.cursor = 'default';
                instructions.style.display = 'none';
                overlay.style.display = 'none';
            }
        });

        // Handle crop selection
        container.addEventListener('mousedown', (e) => {
            if (!cropActive) return;
            e.preventDefault(); // Prevent any dragging

            const rect = container.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Adjust start position to be relative to the image, not the container
            cropStart = {
                x: Math.max(imgRect.left, Math.min(imgRect.right, e.clientX)) - rect.left,
                y: Math.max(imgRect.top, Math.min(imgRect.bottom, e.clientY)) - rect.top
            };

            overlay.style.display = 'block';
            overlay.style.left = `${cropStart.x}px`;
            overlay.style.top = `${cropStart.y}px`;
            overlay.style.width = '0px';
            overlay.style.height = '0px';

            const moveHandler = (e) => {
                const currentX = Math.max(imgRect.left, Math.min(imgRect.right, e.clientX)) - rect.left;
                const currentY = Math.max(imgRect.top, Math.min(imgRect.bottom, e.clientY)) - rect.top;

                const width = currentX - cropStart.x;
                const height = currentY - cropStart.y;

                overlay.style.width = `${Math.abs(width)}px`;
                overlay.style.height = `${Math.abs(height)}px`;
                overlay.style.left = `${width < 0 ? currentX : cropStart.x}px`;
                overlay.style.top = `${height < 0 ? currentY : cropStart.y}px`;
            };

            const upHandler = () => {
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);

                // Store crop data
                const overlayRect = overlay.getBoundingClientRect();
                const imgRect = img.getBoundingClientRect();

                // Calculate crop relative to actual image dimensions
                currentCrop = {
                    x: (overlayRect.left - imgRect.left) / img.offsetWidth,
                    y: (overlayRect.top - imgRect.top) / img.offsetHeight,
                    width: overlayRect.width / img.offsetWidth,
                    height: overlayRect.height / img.offsetHeight
                };

                applyCropBtn.disabled = false;
                resetCropBtn.disabled = false;
            };

            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        });

        // Apply crop
        applyCropBtn.addEventListener('click', async () => {
            if (!currentCrop) return;

            try {
                // Create canvas for cropping
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Load image
                const tempImg = new Image();
                tempImg.src = resource.data;

                await new Promise((resolve, reject) => {
                    tempImg.onload = () => {
                        // Set canvas size to crop size
                        canvas.width = tempImg.width * currentCrop.width;
                        canvas.height = tempImg.height * currentCrop.height;

                        // Draw cropped portion
                        ctx.drawImage(
                            tempImg,
                            tempImg.width * currentCrop.x,
                            tempImg.height * currentCrop.y,
                            tempImg.width * currentCrop.width,
                            tempImg.height * currentCrop.height,
                            0, 0, canvas.width, canvas.height
                        );

                        // Update resource with cropped image
                        resource.data = canvas.toDataURL('image/png');

                        // Generate new thumbnail
                        const thumbnailCanvas = document.createElement('canvas');
                        const thumbCtx = thumbnailCanvas.getContext('2d');
                        thumbnailCanvas.width = 100;
                        thumbnailCanvas.height = 100;

                        // Draw thumbnail
                        thumbCtx.drawImage(canvas, 0, 0, 100, 100);
                        resource.thumbnail = thumbnailCanvas.toDataURL('image/png');

                        dialog.hide();
                        resolve();
                    };
                    tempImg.onerror = reject;
                });
            } catch (error) {
                console.error('Error applying crop:', error);
            }
        });

        // Reset crop
        resetCropBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
            currentCrop = null;
            applyCropBtn.disabled = true;
            resetCropBtn.disabled = true;
        });

        document.body.appendChild(dialog);
        dialog.show();
    }

    // Delete method
    deleteResource(category, id) {
        const resources = this.resources.textures[category];
        if (resources) {
            resources.delete(id);
        }
    }

    createResourceManagerUI() {
        // Create the drawer
        const drawer = document.createElement('sl-drawer');
        drawer.label = "Resource Manager";
        drawer.placement = "end";
        drawer.classList.add("resource-manager-drawer");
        drawer.style.cssText = '--size: calc(100vw - 260px);';

        // Add embedded styles
        const styles = document.createElement('style');

        // .resource-manager-drawer::part(panel) {
        //     width: 75vw;  // Changed from 50vw to 75vw
        //     max-width: 1200px;  // Also increased from 800px
        // }

        styles.textContent = `

    
            .resource-categories {
                margin-bottom: 1rem;
            }
    
            .gallery-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 1rem;
                padding: 1rem;
            }
    
            .resource-item {
                border: 1px solid var(--sl-color-neutral-200);
                border-radius: var(--sl-border-radius-medium);
                padding: 0.5rem;
                transition: all 0.2s ease;
            }
    
            .resource-item:hover {
                border-color: var(--sl-color-primary-500);
                transform: translateY(-2px);
            }
    
            .resource-thumbnail {
                width: 100%;
                aspect-ratio: 1;
                object-fit: cover;
                border-radius: var(--sl-border-radius-small);
                margin-bottom: 0.5rem;
            }
    
            .resource-info {
                font-size: var(--sl-font-size-small);
            }

                .view-controls {
        margin: 1rem 0;
        display: flex;
        justify-content: flex-end;
    }

    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .gallery-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
    }

    .gallery-list .resource-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem;
    }

    .gallery-list .resource-thumbnail {
        width: 50px;
        height: 50px;
    }

    .resource-preview-tooltip {
        position: fixed;
        z-index: 10000;
        background: white;
        padding: 4px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
        display: none;
    }

    .resource-preview-tooltip img {
        max-width: 200px;
        max-height: 200px;
        object-fit: contain;
    }

        .gallery-container {
        margin-top: 1rem;
        min-height: 200px;
    }

    .gallery-container.gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
    }

    .gallery-container.gallery-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .add-resources {
        display: flex;
        gap: 1rem;
    }

    sl-tab-panel {
        height: calc(100vh - 200px);
        overflow-y: auto;
    }

        .panel-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .flex-spacer {
        flex: 1;
    }

    .panel-header sl-button-group {
        flex: 0 0 auto;
    }

    .panel-header .material-icons {
        font-size: 18px;
    }

    .bestiary-buttons {
    margin-left: auto;
}

#bestiaryGallery .resource-item {
    transition: all 0.2s ease;
    border: 1px solid var(--sl-color-neutral-200);
}

#bestiaryGallery .resource-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    border-color: var(--sl-color-primary-300);
}

#bestiaryGallery .resource-name {
    font-weight: 500;
    margin-bottom: 4px;
}

#bestiaryGallery .resource-meta {
    font-size: 0.8em;
    color: var(--sl-color-neutral-600);
}

#bestiaryGallery .monster-badge {
    font-size: 0.75rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    position: absolute;
    top: 6px;
    right: 6px;
}

.gallery-grid .resource-thumbnail {
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 8px;
}

.gallery-list .resource-thumbnail {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    object-fit: cover;
}

.monster-filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.monster-filter-bar sl-select {
    min-width: 150px;
}

/* Monster detail dialog styles */
.monster-detail-dialog::part(panel) {
    max-width: 800px;
}

.monster-stat-block {
    font-family: "Noto Serif", serif;
    line-height: 1.5;
}

.monster-stat-block h3 {
    border-bottom: 1px solid #D3C4A2;
    padding-bottom: 4px;
    font-size: 1.3em;
}

.monster-abilities {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    text-align: center;
    background: #F5F0E5;
    padding: 10px;
    border-radius: 5px;
    margin: 16px 0;
}

.monster-ability-name {
    font-weight: bold;
}

    .resource-manager-drawer::part(panel) {
        --size: calc(100vw - 280px);
        background: #242424;
        color: #e0e0e0;
    }
    
    .resource-manager-drawer::part(header) {
        background: #333;
        padding: 16px;
        border-bottom: 1px solid #444;
        height: 48px;
    }
    
    .resource-manager-drawer::part(body) {
        padding: 0;
    }
    
    .resource-manager-drawer::part(footer) {
        background: #333;
        border-top: 1px solid #444;
        padding: 12px;
    }
    
    /* Tab styling */
    .resource-manager-drawer sl-tab-group::part(base) {
        background: #242424;
    }
    
    .resource-manager-drawer sl-tab-group::part(nav) {
        background: #333;
        border-bottom: 1px solid #444;
    }
    
    .resource-manager-drawer sl-tab::part(base) {
        color: #e0e0e0;
        border: none;
    }
    
    .resource-manager-drawer sl-tab[active]::part(base) {
        color: #673ab7;
        border-bottom-color: #673ab7;
    }
    
    .resource-manager-drawer sl-tab-panel::part(base) {
        padding: 16px;
    }
    
    /* Button styling */
    .resource-manager-drawer sl-button::part(base) {
        border: none;
    }
    
    .resource-manager-drawer sl-button[variant='primary']::part(base) {
        background: #673ab7;
        color: white;
    }
    
    .resource-manager-drawer sl-button[variant='primary']:hover::part(base) {
        background: #7e57c2;
    }
    
    .resource-manager-drawer sl-button[variant='default']::part(base) {
        background: #333;
        color: #e0e0e0;
    }
    
    .resource-manager-drawer sl-button[variant='default']:hover::part(base) {
        background: #444;
    }
    
    .resource-manager-drawer sl-button[variant='danger']::part(base) {
        background: #d32f2f;
        color: white;
    }
    
    /* Form elements */
    .resource-manager-drawer sl-input::part(base),
    .resource-manager-drawer sl-select::part(base),
    .resource-manager-drawer sl-textarea::part(base) {
        background: #333;
        color: #e0e0e0;
        border-color: #444;
    }
    
    .resource-manager-drawer sl-input:focus-within::part(base),
    .resource-manager-drawer sl-select:focus-within::part(base),
    .resource-manager-drawer sl-textarea:focus-within::part(base) {
        border-color: #673ab7;
    }
    
    /* Card styling */
    .resource-manager-drawer sl-card::part(base) {
        background: #333;
        color: #e0e0e0;
        border: 1px solid #444;
    }
    
    /* Gallery items */
    .resource-categories {
        margin-bottom: 1rem;
        background: #333;
        padding: 8px;
        border-radius: 4px;
    }

    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .resource-item {
        border: 1px solid #444;
        border-radius: 4px;
        padding: 0.5rem;
        transition: all 0.2s ease;
        background: #333;
    }

    .resource-item:hover {
        border-color: #673ab7;
        transform: translateY(-2px);
    }

    .resource-thumbnail {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }

    .resource-info {
        font-size: 0.9rem;
        color: #e0e0e0;
    }

    .view-controls {
        margin: 1rem 0;
        display: flex;
        justify-content: flex-end;
        background: #333;
        padding: 8px;
        border-radius: 4px;
    }

    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .gallery-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
    }
    
    /* Props section styling */
    .props-tag-sidebar {
        background: #333 !important;
        border: 1px solid #444;
    }
    
    .tag-entry {
        background: #242424 !important;
        border: 1px solid #444 !important;
        color: #e0e0e0 !important;
    }
    
    .tag-entry:hover {
        background: #333 !important;
    }
    
    /* Dialog styling */
    sl-dialog::part(panel) {
        background: #242424;
        color: #e0e0e0;
    }
    
    sl-dialog::part(header) {
        background: #333;
        border-bottom: 1px solid #444;
    }
    
    sl-dialog::part(footer) {
        background: #333;
        border-top: 1px solid #444;
    }
    
    /* Toast notifications */
    .notification-toast {
        background-color: #242424 !important;
        color: #e0e0e0 !important;
        border: 1px solid #444;
    }

        .resource-manager-drawer::part(panel) {
        --size: calc(100vw - 280px);
        background: #242424;
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
    }
    
    .resource-manager-drawer::part(header) {
        background: #333;
        padding: 16px;
        border-bottom: 1px solid #444;
        height: 48px;
        min-height: 48px; /* Ensure consistent height */
        flex-shrink: 0; /* Prevent shrinking */
    }
    
    .resource-manager-drawer::part(body) {
        padding: 0;
        flex: 1; /* Take up available space */
        display: flex;
        flex-direction: column;
        overflow: hidden; /* Important for proper scrolling */
    }
    
    .resource-manager-drawer::part(footer) {
        background: #333;
        border-top: 1px solid #444;
        padding: 12px;
        flex-shrink: 0; /* Prevent shrinking */
    }
    
    /* Make tab panels fill the container */
    .resource-manager-drawer sl-tab-group {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .resource-manager-drawer sl-tab-panel::part(base) {
        height: 100%;
        overflow-y: auto; /* Allow scrolling within tabs */
    }

        `;


        drawer.innerHTML = `
        ${styles.outerHTML}
        <div class="resource-manager-content">
            <sl-tab-group>
                <!-- Texture Panel -->
                <sl-tab slot="nav" panel="textures">
                    <span class="material-icons">image</span>
                    Textures
                </sl-tab>
                <sl-tab slot="nav" panel="sounds">
                    <span class="material-icons">volume_up</span>
                    Sounds
                </sl-tab>
                <sl-tab slot="nav" panel="splashArt">
                    <span class="material-icons">photo_library</span>
                    Splash Art
                </sl-tab>
                <sl-tab slot="nav" panel="bestiary">
                    <span class="material-icons">pets</span>
                    Bestiary
                </sl-tab>
    
                <!-- Texture Panel -->
                <sl-tab-panel name="textures">
                    <div class="panel-header">
                        <sl-button-group class="texture-categories">
                            <sl-button size="small" data-category="walls">Walls</sl-button>
                            <sl-button size="small" data-category="doors">Doors</sl-button>
                            <sl-button size="small" data-category="environmental">Environmental</sl-button>
                            <sl-button size="small" data-category="props">Props</sl-button>
                        </sl-button-group>
                        
                        <sl-button size="small" class="texture-upload-btn" variant="primary">
                            <span class="material-icons">add_circle</span>
                        </sl-button>
                        <input type="file" hidden accept="image/*" multiple class="texture-file-input">
                    </div>
    
                    <div class="view-controls">
                        <sl-button-group>
                            <sl-button size="small" class="view-toggle" data-view="grid" variant="primary">
                                <span class="material-icons">grid_view</span>
                            </sl-button>
                            <sl-button size="small" class="view-toggle" data-view="list">
                                <span class="material-icons">view_list</span>
                            </sl-button>
                        </sl-button-group>
                    </div>
    
                    <!-- Create containers for each texture category -->
                    <div id="wallsGallery" class="gallery-container gallery-grid"></div>
                    <div id="doorsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
                    <div id="environmentalGallery" class="gallery-container gallery-grid" style="display: none;"></div>
                    <div id="propsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
                </sl-tab-panel>
    
                <!-- Sounds Panel -->
                <sl-tab-panel name="sounds">
                    <div class="panel-header">
                        <sl-button-group class="sound-categories">
                            <sl-button size="small" data-category="ambient" variant="primary">Ambient</sl-button>
                            <sl-button size="small" data-category="effects">Effects</sl-button>
                        </sl-button-group>
                        
                        <sl-button size="small" class="sound-upload-btn" variant="primary">
                            <span class="material-icons">add_circle</span>
                        </sl-button>
                        <input type="file" hidden accept="audio/*" multiple class="sound-file-input">
                    </div>
    
                    <div class="view-controls">
                        <sl-button-group>
                            <sl-button size="small" class="view-toggle" data-view="grid" variant="primary">
                                <span class="material-icons">grid_view</span>
                            </sl-button>
                            <sl-button size="small" class="view-toggle" data-view="list">
                                <span class="material-icons">view_list</span>
                            </sl-button>
                        </sl-button-group>
                    </div>
    
                    <!-- Create containers for each sound category -->
                    <div id="ambientGallery" class="gallery-container gallery-grid"></div>
                    <div id="effectsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
                </sl-tab-panel>

<sl-tab-panel name="splashArt">
    <div class="panel-header">
        <div class="splash-art-controls" style="display: flex; align-items: center; gap: 16px;">
            <sl-button-group>
                <sl-button size="small" data-category="title" variant="primary">Title Screen</sl-button>
                <sl-button size="small" data-category="loading">Loading</sl-button>
                <sl-button size="small" data-category="background">Background</sl-button>
            </sl-button-group>
            
            <sl-button size="small" class="splashart-upload-btn" variant="primary">
                <span class="material-icons">add_circle</span>
            </sl-button>
            <input type="file" hidden accept="image/*" multiple class="splashart-file-input">
        </div>

        <div class="view-controls">
            <sl-button-group>
                <sl-button size="small" class="view-toggle" data-view="grid" variant="primary">
                    <span class="material-icons">grid_view</span>
                </sl-button>
                <sl-button size="small" class="view-toggle" data-view="list">
                    <span class="material-icons">view_list</span>
                </sl-button>
            </sl-button-group>
        </div>
    </div>

    <!-- Splash art galleries -->
    <div id="titleGallery" class="gallery-container gallery-grid"></div>
    <div id="loadingGallery" class="gallery-container gallery-grid" style="display: none;"></div>
    <div id="backgroundGallery" class="gallery-container gallery-grid" style="display: none;"></div>
</sl-tab-panel>


            <!-- Bestiary Panel -->
<sl-tab-panel name="bestiary">
    <div class="panel-header">

        <div class="flex-spacer"></div>
        <sl-button size="medium" class="add-monster-btn" variant="primary">
            <span class="material-icons" slot="prefix">add_circle</span>

        </sl-button>
    </div>

    <div class="view-controls">
        <sl-button-group>
            <sl-button size="small" class="view-toggle" data-view="grid" variant="primary">
                <span class="material-icons">grid_view</span>
            </sl-button>
            <sl-button size="small" class="view-toggle" data-view="list">
                <span class="material-icons">view_list</span>
            </sl-button>
        </sl-button-group>
    </div>

    <div id="bestiaryGallery" class="gallery-container gallery-grid"></div>
</sl-tab-panel>
    </sl-tab-group>

    <!-- Footer Actions -->
<div slot="footer" style="display: flex; justify-content: flex-end; width: 100%;">
    <!-- Bestiary-specific buttons (initially hidden) -->
    <sl-button variant="default" id="importBestiaryBtn" style="display: none; margin-right: 8px;">
        <span class="material-icons" slot="prefix">upload</span>
        Import
    </sl-button>
    <sl-button variant="default" id="exportBestiaryBtn" style="display: none; margin-right: 8px;">
        <span class="material-icons" slot="prefix">download</span>
        Export
    </sl-button>
    
    <!-- Standard buttons (always visible) -->
    <sl-button variant="primary" id="saveResourcePack">
        <span class="material-icons" slot="prefix">save</span>
        Save
    </sl-button>
    <sl-button variant="default" id="loadResourcePack" style="margin-left: 8px;">
        <span class="material-icons" slot="prefix">folder_open</span>
        Load
    </sl-button>
</div>
`;

const packNameInput = drawer.querySelector('#packNameInput');
if (packNameInput) {
    packNameInput.addEventListener('sl-change', (e) => {
        if (!this.activeResourcePack) {
            this.activeResourcePack = {};
        }
        this.activeResourcePack.name = e.target.value;
    });
}

        // Add pack selector to drawer header
        const packSelector = document.createElement('sl-select');
        packSelector.label = 'Resource Pack';

        this.loadedPacks.forEach((pack, id) => {
            const option = document.createElement('sl-option');
            option.value = id;
            option.textContent = pack.name;
            packSelector.appendChild(option);
        });

        packSelector.value = this.activePackId;
        packSelector.addEventListener('sl-change', (e) => {
            this.switchResourcePack(e.target.value);
        });

        // Add "Import Pack" button
        const importBtn = document.createElement('sl-button');
        importBtn.innerHTML = `
        <sl-icon slot="prefix" name="plus-circle"></sl-icon>
        Import Pack
    `;
        importBtn.addEventListener('click', () => {
            // Show pack import dialog
            this.showPackImportDialog();
        });

        // Add event handlers
        this.setupEventHandlers(drawer);

        document.body.appendChild(drawer);
        return drawer;
    }


setupEventHandlers(drawer) {
    const saveBtn = drawer.querySelector('#saveResourcePack');
    const loadBtn = drawer.querySelector('#loadResourcePack');
    const exportBestiaryBtn = drawer.querySelector('#exportBestiaryBtn');
    const importBestiaryBtn = drawer.querySelector('#importBestiaryBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const action = saveBtn.getAttribute('data-action') || 'save-resources';
            
            if (action === 'save-all') {
                // In bestiary tab, save both resources and bestiary
                this.saveResourcePack();
                
                // Also save bestiary if we have monsters
                if (this.resources.bestiary.size > 0) {
                    this.saveBestiaryToFile();
                }
            } else {
                // Default action - save resource pack only
                this.saveResourcePack();
            }
        });
    }

    if (loadBtn) {
        // Modify to handle bestiary uploads
        const originalLoadHandler = loadBtn.onclick;
        loadBtn.onclick = () => {
            // Create dialog with options
            const dialog = document.createElement('sl-dialog');
            dialog.label = 'Load File';
            dialog.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <sl-button class="load-resource-btn" size="large" style="justify-content: flex-start;">
                        <span class="material-icons" slot="prefix">folder_open</span>
                        Load Resource Pack
                        <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                            Load textures, sounds, and other resources
                        </div>
                    </sl-button>
                    <sl-button class="load-bestiary-btn" size="large" style="justify-content: flex-start;">
                        <span class="material-icons" slot="prefix">pets</span>
                        Load Bestiary File
                        <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                            Import monster data from a bestiary.json file
                        </div>
                    </sl-button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // Create hidden file inputs
            const resourceInput = document.createElement('input');
            resourceInput.type = 'file';
            resourceInput.accept = '.json';
            resourceInput.style.display = 'none';
            
            const bestiaryInput = document.createElement('input');
            bestiaryInput.type = 'file';
            bestiaryInput.accept = '.json';
            bestiaryInput.style.display = 'none';
            
            document.body.appendChild(resourceInput);
            document.body.appendChild(bestiaryInput);
            
            // Resource pack loading
            resourceInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Use the original load behavior
                    this.loadResourcePack(file).then(success => {
                        if (success) {
                            const currentCategory = drawer.querySelector('.texture-categories sl-button[variant="primary"]')?.dataset.category || 'walls';
                            this.updateGallery(drawer, currentCategory);
                            // alert('Resource pack loaded successfully');
                        } else {
                            alert('Failed to load resource pack');
                        }
                    });
                }
            });
            
            // Bestiary loading
            bestiaryInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const success = await this.loadBestiaryFromFile(file);
                    if (success) {
                        this.updateBestiaryGallery(drawer, 'grid');
                        alert(`Successfully loaded ${this.resources.bestiary.size} monsters`);
                    } else {
                        alert('Failed to load bestiary file');
                    }
                }
            });
            
            // Add button click handlers
            // dialog.querySelector('.load-resource-btn').addEventListener('click', () => {
            //     dialog.hide();
            //     resourceInput.click();
            // });

            dialog.querySelector('.load-resource-btn').addEventListener('click', () => {
                dialog.hide();
                resourceInput.click();
            });
            
            resourceInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Use our optimized loading function
                    this.loadResourcePack(file).then(success => {
                        if (success) {
                            const currentCategory = drawer.querySelector('.texture-categories sl-button[variant="primary"]')?.dataset.category || 'walls';
                            this.updateGallery(drawer, currentCategory);
                        }
                    });
                }
            });
            
            dialog.querySelector('.load-bestiary-btn').addEventListener('click', () => {
                dialog.hide();
                bestiaryInput.click();
            });
            
            // Clean up on close
            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
                resourceInput.remove();
                bestiaryInput.remove();
            });
            
            dialog.show();
        };
    }

    if (exportBestiaryBtn) {
        exportBestiaryBtn.addEventListener('click', () => {
            this.saveBestiaryToFile();
        });
    }
    
    if (importBestiaryBtn) {
        importBestiaryBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const success = await this.loadBestiaryFromFile(file);
                    if (success) {
                        this.updateBestiaryGallery(drawer, 'grid');
                        alert(`Successfully loaded ${this.resources.bestiary.size} monsters`);
                    } else {
                        alert('Failed to load bestiary file');
                    }
                }
            };
            input.click();
        });
    }

    // Update the view toggle handler
    drawer.querySelectorAll('.view-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const panel = toggle.closest('sl-tab-panel');
            if (!panel) return;

            const galleryContainer = panel.querySelector('.gallery-container');
            if (!galleryContainer) return;

            const view = toggle.dataset.view;

            // Update button states
            panel.querySelectorAll('.view-toggle').forEach(t => t.variant = 'default');
            toggle.variant = 'primary';

            // Update gallery view
            galleryContainer.className = `gallery-container ${view === 'grid' ? 'gallery-grid' : 'gallery-list'}`;

            // Refresh gallery content
            if (panel.getAttribute('name') === 'bestiary') {
                this.updateBestiaryGallery(drawer, view);
            } else {
                // Handle other gallery types (existing code)
                const category = panel.querySelector('[data-category]')?.dataset.category;
                if (category) {
                    this.updateGallery(drawer, category, view);
                }
            }
        });
    });

    // Setup category selection for textures
    const categoryBtns = drawer.querySelectorAll('.texture-categories sl-button');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button states
            categoryBtns.forEach(b => b.setAttribute('variant', 'default'));
            btn.setAttribute('variant', 'primary');

            const category = btn.dataset.category;
            this.lastSelectedCategory = category; // Track the last selected category

            // Hide all galleries first
            ['walls', 'doors', 'environmental', 'props'].forEach(cat => {
                const gallery = drawer.querySelector(`#${cat}Gallery`);
                if (gallery) {
                    gallery.style.display = 'none';
                }
            });

            // Show selected category's gallery
            const selectedGallery = drawer.querySelector(`#${category}Gallery`);
            if (selectedGallery) {
                selectedGallery.style.display = 'grid';
                // Update gallery content
                this.updateGallery(drawer, category);
            }
        });
    });

    this.setupSplashArtHandlers(drawer);

    // Handle tab changes to load bestiary when tab is activated
    const tabGroup = drawer.querySelector('sl-tab-group');
    if (tabGroup) {
        tabGroup.addEventListener('sl-tab-show', (e) => {
            const tabName = e.detail.name;
            
            // Toggle bestiary-specific buttons
            const exportBestiaryBtn = drawer.querySelector('#exportBestiaryBtn');
            const importBestiaryBtn = drawer.querySelector('#importBestiaryBtn');
            const saveResourceBtn = drawer.querySelector('#saveResourcePack');
            const loadResourceBtn = drawer.querySelector('#loadResourcePack');
            
            if (exportBestiaryBtn && importBestiaryBtn && saveResourceBtn && loadResourceBtn) {
                const isBestiaryTab = tabName === 'bestiary';
                
                // Show/hide bestiary buttons
                exportBestiaryBtn.style.display = isBestiaryTab ? 'inline-flex' : 'none';
                importBestiaryBtn.style.display = isBestiaryTab ? 'inline-flex' : 'none';
                
                // Update save/load button text based on context
                if (isBestiaryTab) {
                    saveResourceBtn.innerHTML = `
                        <span class="material-icons" slot="prefix">save</span>
                        Save All
                    `;
                    saveResourceBtn.setAttribute('data-action', 'save-all');
                } else {
                    saveResourceBtn.innerHTML = `
                        <span class="material-icons" slot="prefix">save</span>
                        Save
                    `;
                    saveResourceBtn.setAttribute('data-action', 'save-resources');
                }
            }
            
            // Update gallery if needed
            if (tabName === 'bestiary') {
                this.updateBestiaryGallery(drawer, 'grid');
            }
        });
    }

    // Handle file uploads for each type - KEEP THIS AS A CONST FUNCTION
    const setupUploadHandler = (btnClass, inputClass, type) => {
        const uploadBtn = drawer.querySelector(`.${btnClass}`);
        const fileInput = drawer.querySelector(`.${inputClass}`);

        if (!uploadBtn || !fileInput) {
            console.warn(`Upload elements not found for ${type}`);
            return;
        }

        uploadBtn.addEventListener('click', () => {
            if (type === 'texture' && this.lastSelectedCategory === 'props') {
                // Show dialog with options for props importing
                this.showPropsImportOptions(drawer);
            } else {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            const tabPanel = uploadBtn.closest('sl-tab-panel');

            if (!files.length) return;

            console.log(`Processing ${files.length} ${type} files`);

            // For folder import of props, extract folder information
            const isPropsImport = type === 'texture' && tabPanel?.querySelector('.texture-categories sl-button[variant="primary"]')?.dataset.category === 'props';
            const importedWithFolders = isPropsImport && fileInput.hasAttribute('webkitdirectory');

            if (importedWithFolders) {
                await this.processFolderImport(files);
            } else {
                // Regular file processing
                for (const file of files) {
                    try {
                        if (type === 'splashArt') {
                            const description = await this.promptForDescription(file.name);
                            await this.addSplashArt(file, description);
                        } else if (type === 'sound') {
                            const category = tabPanel?.querySelector('.sound-categories sl-button[variant="primary"]')?.dataset.category || 'ambient';
                            await this.addSound(file, category);
                        } else {
                            const category = tabPanel?.querySelector('.texture-categories sl-button[variant="primary"]')?.dataset.category || 'walls';
                            await this.addTexture(file, category);
                        }
                    } catch (error) {
                        console.error(`Error processing ${type} file:`, error);
                    }
                }
            }

            // Update gallery with correct category
            if (tabPanel) {
                const view = tabPanel.querySelector('.view-toggle[variant="primary"]')?.dataset.view || 'grid';
                const category = type === 'splashArt' ? 'splashArt' : 
                            tabPanel.querySelector('[data-category][variant="primary"]')?.dataset.category;
                
                if (category) {
                    this.updateGallery(drawer, category, view);
                }
            }

            // Reset file input
            fileInput.value = '';
        });
    };

    setupUploadHandler('texture-upload-btn', 'texture-file-input', 'texture');
    setupUploadHandler('sound-upload-btn', 'sound-file-input', 'sound');
    setupUploadHandler('splashart-upload-btn', 'splashart-file-input', 'splashArt');

    const soundCategoryBtns = drawer.querySelectorAll('.sound-categories sl-button');
    soundCategoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button states
            soundCategoryBtns.forEach(b => b.setAttribute('variant', 'default'));
            btn.setAttribute('variant', 'primary');

            const category = btn.dataset.category;
            this.updateGallery(drawer, category, 
                drawer.querySelector('.view-toggle[variant="primary"]')?.dataset.view || 'grid'
            );
        });
    });

    // Setup Bestiary tab handlers
    const addMonsterBtn = drawer.querySelector('.add-monster-btn');
    if (addMonsterBtn) {
        addMonsterBtn.addEventListener('click', async () => {
            await this.showMonsterImporter();
        });
    }

    // Add close handler
    drawer.addEventListener('sl-after-hide', () => {
        // Optional: Clean up any resources if needed
    });
}

showPropsImportOptions(drawer) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Import Props';
    
    dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <sl-button size="large" class="single-files-btn" style="justify-content: flex-start;">
                <span class="material-icons" slot="prefix">upload_file</span>
                Select Files
                <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                    Select individual prop files to import
                </div>
            </sl-button>
            
            <sl-button size="large" class="folder-btn" style="justify-content: flex-start;">
                <span class="material-icons" slot="prefix">folder_open</span>
                Select Folder
                <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
                    Import an entire folder of props with automatic tagging
                </div>
            </sl-button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Create hidden file inputs - these will be cleaned up with the dialog
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    const folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.accept = 'image/*';
    folderInput.multiple = true;
    folderInput.webkitdirectory = true;
    folderInput.directory = true;
    folderInput.style.display = 'none';
    
    // Append inputs to the dialog instead of document.body for better cleanup
    dialog.appendChild(fileInput);
    dialog.appendChild(folderInput);
    
    // File selection handler
    dialog.querySelector('.single-files-btn').addEventListener('click', () => {
        dialog.hide();
        fileInput.click();
    });
    
    // Folder selection handler
    dialog.querySelector('.folder-btn').addEventListener('click', () => {
        dialog.hide();
        folderInput.click();
    });
    
    // Handle file selections
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            for (const file of files) {
                await this.addTexture(file, 'props');
            }
            this.updateGallery(drawer, 'props');
        }
    });
    
    // Handle folder selections
    folderInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            await this.processFolderImport(files);
            this.updateGallery(drawer, 'props');
        }
    });
    
    // Clean up on dialog close - the dialog and all its children will be removed
    dialog.addEventListener('sl-after-hide', () => {
        dialog.remove(); // This also removes the file inputs that are children of the dialog
    });
    
    dialog.show();
}

// getSplashArtUrl(imageData) {
//     if (!imageData || !this.resourceManager) return '';

//     try {
//       const { id, category } = imageData;
//       const art = this.resourceManager.resources.splashArt[category]?.get(id);

//       return art?.base64Data || '';
//     } catch (error) {
//       console.error('Error getting splash art URL:', error);
//       return '';
//     }
//   }

getSplashArtUrl(imageData) {
    if (!imageData) return '';
    try {
      const { id, category } = imageData;
      const art = this.resources.splashArt[category]?.get(id);
      
      // Return the full image data, not just the thumbnail
      return art?.data || '';
    } catch (error) {
      console.error('Error getting splash art URL:', error);
      return '';
    }
  }

setupSplashArtHandlers(drawer) {
    console.log('Setting up splash art handlers');
    
    // Set up category buttons
    const categoryBtns = drawer.querySelectorAll('.splash-art-controls sl-button-group sl-button');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button states
            categoryBtns.forEach(b => b.setAttribute('variant', 'default'));
            btn.setAttribute('variant', 'primary');

            // Update gallery with selected category
            const category = btn.dataset.category;
            const currentView = drawer.querySelector('.splash-art-controls .view-toggle[variant="primary"]')?.dataset.view || 'grid';
            this.updateGallery(drawer, category, currentView);
        });
    });

    // Set up upload handling
    const uploadBtn = drawer.querySelector('.splashart-upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            // Create a new file input each time to ensure it triggers
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            // Set up the change handler before clicking
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;

                const activeCategory = drawer.querySelector('.splash-art-controls sl-button[variant="primary"]')?.dataset.category || 'title';
                
                for (const file of files) {
                    try {
                        const description = await this.promptForDescription(file.name);
                        await this.addSplashArt(file, description, activeCategory);
                    } catch (error) {
                        console.error('Error processing splash art file:', error);
                    }
                }

                // Update gallery
                this.updateGallery(drawer, activeCategory, 
                    drawer.querySelector('.splash-art-controls .view-toggle[variant="primary"]')?.dataset.view || 'grid'
                );

                // Clean up
                document.body.removeChild(fileInput);
            });

            // Now trigger the file input
            fileInput.click();
        });
    }

    // Set up view toggles
    const viewToggles = drawer.querySelectorAll('.splash-art-controls .view-toggle');
    viewToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            viewToggles.forEach(t => t.setAttribute('variant', 'default'));
            toggle.setAttribute('variant', 'primary');

            const currentCategory = drawer.querySelector('.splash-art-controls sl-button[variant="primary"]')?.dataset.category || 'title';
            this.updateGallery(drawer, currentCategory, toggle.dataset.view);
        });
    });
}

    async promptForDescription(filename) {
        return new Promise((resolve) => {
            const dialog = document.createElement('sl-dialog');
            dialog.label = `Add Description for ${filename}`;
            dialog.innerHTML = `
            <sl-input label="Description" id="description-input"></sl-input>
            <div slot="footer">
                <sl-button variant="primary" id="save-btn">Save</sl-button>
                <sl-button variant="default" id="cancel-btn">Cancel</sl-button>
            </div>
        `;

            document.body.appendChild(dialog);
            dialog.show();

            const input = dialog.querySelector('#description-input');
            const saveBtn = dialog.querySelector('#save-btn');
            const cancelBtn = dialog.querySelector('#cancel-btn');

            saveBtn.addEventListener('click', () => {
                dialog.hide();
                resolve(input.value);
            });

            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                resolve('');
            });

            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
            });
        });
    }

    initializeMonsterManager(mapEditor) {
        this.monsterManager = new MonsterManager(mapEditor);
        this.loadBestiaryFromDatabase();
    }


    loadBestiaryFromDatabase() {
        try {
            // Load from MonsterManager's database
            const database = this.monsterManager.loadDatabase();
            
            if (database && database.monsters) {
                let monstersLoaded = 0;
                let monstersSkipped = 0;
                
                // Convert to our resources format
                Object.entries(database.monsters).forEach(([key, monster]) => {
                    // Skip invalid entries
                    if (!monster || !monster.basic || !monster.basic.name) {
                        console.warn(`Skipping invalid monster entry: ${key}`);
                        monstersSkipped++;
                        return;
                    }
                    
                    this.resources.bestiary.set(key, {
                        id: key,
                        name: monster.basic.name,
                        data: monster, // Store the full monster data
                        thumbnail: monster.token?.data || this.generateMonsterThumbnail(monster),
                        cr: monster.basic.cr,
                        type: monster.basic.type,
                        size: monster.basic.size,
                        dateAdded: new Date().toISOString()
                    });
                    monstersLoaded++;
                });
                
                console.log(`Loaded ${monstersLoaded} monsters from database (skipped ${monstersSkipped} invalid entries)`);
            }
        } catch (error) {
            console.error("Error loading bestiary from database:", error);
        }
    }

    saveDatabase() {
        try {
            localStorage.setItem("monsterDatabase", JSON.stringify(this.monsterDatabase));
            return true;
        } catch (e) {
            console.error("Error saving monster database:", e);
            return false;
        }
    }

    deleteMonster(monsterId) {
        const key = typeof monsterId === 'string' ? 
            monsterId : 
            monsterId.basic?.name?.toLowerCase().replace(/\s+/g, "_");
        
        if (this.monsterDatabase.monsters[key]) {
            delete this.monsterDatabase.monsters[key];
            this.saveDatabase();
            return true;
        }
        return false;
    }
    
    generateMonsterThumbnail(monster) {
        // Create a canvas for the thumbnail
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Generate color based on monster name
        const hashCode = monster.basic.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        const hue = Math.abs(hashCode) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(0, 0, size, size);
        
        // Add border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, size-4, size-4);
        
        // Add initial
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(monster.basic.name.charAt(0).toUpperCase(), size/2, size/2);
        
        return canvas.toDataURL('image/webp');
    }
    
    async showMonsterImporter() {
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
                <sl-button variant="primary" class="save-btn" disabled>Add to Bestiary</sl-button>
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
                    currentMonsterData = await this.monsterManager.parseMonsterHtml(html);
                    console.log("Parsed monster data:", currentMonsterData); // Debug log
    
                    if (currentMonsterData) {
                        // Update basic info
                        preview.querySelector(".monster-name").textContent = currentMonsterData.basic.name;
                        preview.querySelector(".monster-size").textContent = currentMonsterData.basic.size;
                        preview.querySelector(".monster-type").textContent = currentMonsterData.basic.type;
                        preview.querySelector(".monster-alignment").textContent = currentMonsterData.basic.alignment;
    
                        // Update core stats
                        preview.querySelector(".monster-ac").textContent = currentMonsterData.stats.ac;
                        preview.querySelector(".monster-hp").textContent = 
                            `${currentMonsterData.stats.hp.average} (${currentMonsterData.stats.hp.roll})`;
                        preview.querySelector(".monster-speed").textContent = currentMonsterData.stats.speed;
    
                        // Update ability scores
                        Object.entries(currentMonsterData.abilities).forEach(([ability, data]) => {
                            const element = preview.querySelector(`.monster-${ability}`);
                            if (element) {
                                element.textContent = `${data.score} (${data.modifier >= 0 ? "+" : ""}${data.modifier})`;
                            }
                        });
    
                        // Update additional traits
                        preview.querySelector(".monster-cr").textContent = currentMonsterData.basic.cr;
                        preview.querySelector(".monster-xp").textContent = currentMonsterData.basic.xp;
                        preview.querySelector(".monster-prof").textContent = `+${currentMonsterData.basic.proficiencyBonus}`;
                        preview.querySelector(".monster-senses").textContent = 
                            currentMonsterData.traits.senses.join(", ") || "None";
                        preview.querySelector(".monster-languages").textContent = currentMonsterData.traits.languages;
    
                        // Handle immunities
                        const immunitiesContainer = preview.querySelector(".monster-immunities-container");
                        const immunitiesSpan = preview.querySelector(".monster-immunities");
                        if (currentMonsterData.traits.immunities.length > 0) {
                            immunitiesSpan.textContent = currentMonsterData.traits.immunities.join(", ");
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
    
                            // If we only have URL but not data, add button to capture image data
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
                    // Ensure we have token data
                    if (currentMonsterData.token && currentMonsterData.token.url && !currentMonsterData.token.data) {
                        const imgElement = preview.querySelector(".monster-image img");
                        if (imgElement && imgElement.complete) {
                            try {
                                const canvas = document.createElement('canvas');
                                canvas.width = imgElement.naturalWidth;
                                canvas.height = imgElement.naturalHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(imgElement, 0, 0);
                                currentMonsterData.token.data = canvas.toDataURL('image/webp');
                            } catch (error) {
                                console.error("Final token capture failed:", error);
                            }
                        }
                    }
                    
                    // Save to bestiary
                    const key = currentMonsterData.basic.name.toLowerCase().replace(/\s+/g, "_");
                    this.resources.bestiary.set(key, {
                        id: key,
                        name: currentMonsterData.basic.name,
                        data: currentMonsterData,
                        thumbnail: currentMonsterData.token?.data || this.generateMonsterThumbnail(currentMonsterData),
                        cr: currentMonsterData.basic.cr,
                        type: currentMonsterData.basic.type,
                        size: currentMonsterData.basic.size,
                        dateAdded: new Date().toISOString()
                    });
                    
                    // Save to MonsterManager database too
                    await this.monsterManager.saveMonsterToDatabase(currentMonsterData);
                    
                    // Refresh the gallery
                    const drawer = document.querySelector('.resource-manager-drawer');
                    if (drawer) {
                        const viewMode = drawer.querySelector('.view-toggle[variant="primary"]')?.dataset.view || 'grid';
                        this.updateBestiaryGallery(drawer, viewMode);
                    }
                    
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




    saveBestiaryToFile(filename = 'bestiary.json') {
        try {
            const bestiaryData = {
                version: "1.0",
                timestamp: new Date().toISOString(),
                monsters: {}
            };
            
            this.resources.bestiary.forEach((monster, key) => {
                bestiaryData.monsters[key] = monster.data;
            });
            
            const blob = new Blob([JSON.stringify(bestiaryData, null, 2)], {
                type: 'application/json'
            });
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            
            console.log(`Saved ${this.resources.bestiary.size} monsters to ${filename}`);
            return true;
        } catch (error) {
            console.error("Error saving bestiary:", error);
            return false;
        }
    }
    
    async loadBestiaryFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.monsters) {
                // Clear existing bestiary
                this.resources.bestiary.clear();
                
                // Load monsters
                Object.entries(data.monsters).forEach(([key, monster]) => {
                    this.resources.bestiary.set(key, {
                        id: key,
                        name: monster.basic.name,
                        data: monster,
                        thumbnail: monster.token?.data || this.generateMonsterThumbnail(monster),
                        cr: monster.basic.cr,
                        type: monster.basic.type,
                        size: monster.basic.size,
                        dateAdded: monster.dateAdded || new Date().toISOString()
                    });
                    
                    // Also add to MonsterManager database
                    this.monsterManager.saveMonsterToDatabase(monster);
                });
                
                console.log(`Loaded ${this.resources.bestiary.size} monsters from file`);
                return true;
            } else {
                throw new Error("Invalid bestiary file format");
            }
        } catch (error) {
            console.error("Error loading bestiary file:", error);
            return false;
        }
    }


    debugBestiarySearch(drawer) {
        console.group("Bestiary Search Debugging");
        
        // Check if bestiary panel exists
        const bestiaryPanel = drawer.querySelector('sl-tab-panel[name="bestiary"]');
        console.log("Bestiary panel found:", !!bestiaryPanel);
        
        if (bestiaryPanel) {
            // Check search elements
            const searchInput = bestiaryPanel.querySelector('#monster-search');
            const crFilter = bestiaryPanel.querySelector('#cr-filter');
            const typeFilter = bestiaryPanel.querySelector('#type-filter');
            const sizeFilter = bestiaryPanel.querySelector('#size-filter');
            const clearFiltersBtn = bestiaryPanel.querySelector('#clear-filters');
            
            console.log("Filter elements:", {
                searchInput: {
                    found: !!searchInput,
                    value: searchInput?.value || "N/A",
                    id: searchInput?.id || "N/A",
                    hasListeners: searchInput?._events?.length > 0
                },
                crFilter: {
                    found: !!crFilter,
                    value: crFilter?.value || "N/A",
                    id: crFilter?.id || "N/A",
                    hasListeners: crFilter?._events?.length > 0
                },
                typeFilter: {
                    found: !!typeFilter,
                    value: typeFilter?.value || "N/A",
                    id: typeFilter?.id || "N/A",
                    hasListeners: typeFilter?._events?.length > 0
                },
                sizeFilter: {
                    found: !!sizeFilter,
                    value: sizeFilter?.value || "N/A", 
                    id: sizeFilter?.id || "N/A",
                    hasListeners: sizeFilter?._events?.length > 0
                },
                clearBtn: {
                    found: !!clearFiltersBtn,
                    id: clearFiltersBtn?.id || "N/A",
                    hasListeners: clearFiltersBtn?._events?.length > 0
                }
            });
            
            // Check if monster data exists
            console.log("Bestiary data:", {
                totalMonsters: this.resources.bestiary.size,
                sampleMonster: this.resources.bestiary.size > 0 ? 
                    Array.from(this.resources.bestiary.values())[0].name : "None"
            });
            
            // Test a filter operation
            if (this.resources.bestiary.size > 0) {
                const testResults = Array.from(this.resources.bestiary.values()).filter(monster => 
                    monster.name.toLowerCase().includes('a'));
                console.log(`Test filter for names with 'a': ${testResults.length} results`);
            }
            
            // Check HTML structure
            console.log("Panel HTML structure:", bestiaryPanel.innerHTML.substring(0, 500) + "...");
        }
        
        console.groupEnd();
    }

updateBestiaryGallery(drawer, view = 'grid') {
    const container = drawer.querySelector('#bestiaryGallery');
    if (!container) {
        console.warn('Bestiary gallery container not found');
        return;
    }
    
    // Specifically find the bestiary panel header
    const bestiaryPanel = drawer.querySelector('sl-tab-panel[name="bestiary"]');
    if (!bestiaryPanel) {
        console.warn('Bestiary panel not found');
        return;
    }
    
    const panelHeader = bestiaryPanel.querySelector('.panel-header');
    if (panelHeader) {
        // If we've already added the filter controls, don't add them again
        if (!bestiaryPanel.querySelector('.monster-filter-bar')) {
            // Clear existing controls first
            const addMonsterBtn = panelHeader.querySelector('.add-monster-btn');
            panelHeader.innerHTML = '';
            
            // Get unique CR values and monster types for filters
            const crValues = new Set();
            const typeValues = new Set();
            const sizeValues = new Set(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']);
            
            this.resources.bestiary.forEach(monster => {
                if (monster.cr) crValues.add(monster.cr);
                if (monster.type) typeValues.add(monster.type);
            });
            
            // Create compact layout with flex
            panelHeader.style.display = 'flex';
            panelHeader.style.flexWrap = 'wrap';
            panelHeader.style.alignItems = 'flex-end';
            panelHeader.style.gap = '8px';
            
            panelHeader.innerHTML = `
    <!-- Native search input -->
    <div class="search-container" style="flex: 1; min-width: 120px; position: relative;">
        <input type="search" id="monster-search" placeholder="Search monsters..." 
               style="width: 100%; padding: 8px; padding-right: 30px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
        <button type="button" id="clear-search" 
                style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer;">
            <span class="material-icons" style="font-size: 18px; color: #666;">close</span>
        </button>
    </div>
    
    <!-- CR filter - temporarily shown but disabled 
    <select id="cr-filter" style="width: 80px; padding: 7px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background-color: #f0f0f0;" disabled>
        <option value="">CR</option>
        ${Array.from(crValues).sort((a, b) => {
            const numA = a === '0' ? 0 : eval(String(a).replace('/','/')); 
            const numB = b === '0' ? 0 : eval(String(b).replace('/','/')); 
            return numA - numB;
        }).map(cr => `<option value="${cr}">CR ${cr}</option>`).join('')}
    </select>
    -->
    
    <!-- Clear filters button -->
    <button type="button" id="clear-filters" 
            style="background: none; border: none; display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer;">
        <span class="material-icons" style="font-size: 18px; color: #666;">filter_alt_off</span>
    </button>
`;
            
            // Add the monster button at the end
            if (addMonsterBtn) {
                panelHeader.appendChild(addMonsterBtn);
            } else {
                const newAddBtn = document.createElement('sl-button');
                newAddBtn.setAttribute('size', 'small');
                newAddBtn.classList.add('add-monster-btn');
                newAddBtn.setAttribute('variant', 'primary'); 
                newAddBtn.setAttribute('circle', '');
                newAddBtn.innerHTML = `
                    <span class="material-icons">add</span>
                `;
                panelHeader.appendChild(newAddBtn);
                
                // Add event listener
                newAddBtn.addEventListener('click', async () => {
                    await this.showMonsterImporter();
                    // Refresh gallery after adding monster
                    this.updateBestiaryGallery(drawer, view);
                });
            }
            
            // Add event listeners for filtering
            this.setupBestiaryFilters(drawer, panelHeader);
        }
    }
    
    // Update container class based on view
    container.className = `gallery-container ${view === 'grid' ? 'gallery-grid' : 'gallery-list'}`;
    container.innerHTML = '';
    
    if (this.resources.bestiary.size === 0) {
        container.innerHTML = `
            <sl-card class="empty-gallery">
                <div style="text-align: center; padding: 2rem;">
                    <span class="material-icons" style="font-size: 3rem; opacity: 0.5;">pets</span>
                    <p>No monsters in bestiary yet</p>
                </div>
            </sl-card>
        `;
        return;
    }
    
    // Apply any active filters
    const filteredMonsters = this.getFilteredBestiary(drawer);
    
    if (filteredMonsters.length === 0) {
        container.innerHTML = `
            <sl-card class="empty-gallery">
                <div style="text-align: center; padding: 2rem;">
                    <span class="material-icons" style="font-size: 3rem; opacity: 0.5;">filter_alt_off</span>
                    <p>No monsters match your filters</p>
                </div>
            </sl-card>
        `;
        return;
    }
    
    // Create cards for each filtered monster
    filteredMonsters.forEach(monster => {
        const card = document.createElement('sl-card');
        card.className = 'resource-item';
        
        const displayCR = monster.cr || '?';
        const displayType = monster.type || 'Unknown';
        const isTokenUrl = monster.data?.token?.url && !monster.data.token.data?.startsWith('data:');
        
        card.innerHTML = `
            ${view === 'grid' ? `
                <div style="position: relative;">
                    <img 
                        src="${monster.thumbnail}" 
                        alt="${monster.name}"
                        class="resource-thumbnail"
                    />
                    <div class="monster-badge" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 10px; font-size: 0.75em;">
                        CR ${displayCR}
                    </div>
                    ${isTokenUrl ? `
                        <div class="token-warning" style="position: absolute; top: 5px; left: 5px; background: rgba(244, 67, 54, 0.8); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Token needs update. Delete and re-add this monster.">
                            <span class="material-icons" style="font-size: 14px;">warning</span>
                        </div>
                    ` : ''}
                </div>
                <div class="resource-info">
                    <div class="resource-name" style="color: #666; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">${monster.name} ${isTokenUrl ? `<span class="material-icons" style="font-size: 14px; color: #f44336; vertical-align: middle;">warning</span>` : ''}</div>
                    <div class="resource-meta">${monster.size} ${displayType}</div>
                </div>
            ` : `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="position: relative; flex-shrink: 0;">
                        <img 
                            src="${monster.thumbnail}" 
                            alt="${monster.name}"
                            class="resource-thumbnail"
                            style="width: 50px; height: 50px;"
                        />
                        ${isTokenUrl ? `
                            <div class="token-warning" style="position: absolute; top: -5px; left: -5px; background: rgba(244, 67, 54, 0.8); color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Token needs update. Delete and re-add this monster.">
                                <span class="material-icons" style="font-size: 10px;">warning</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="resource-info">
                        <div class="resource-name" style="color: #666; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 90%">${monster.name} ${isTokenUrl ? `<span class="material-icons" style="font-size: 14px; color: #f44336; vertical-align: middle;">warning</span>` : ''}</div>
                        <div class="resource-meta">CR ${displayCR} | ${monster.size} ${displayType}</div>
                    </div>
                </div>
            `}
            <div slot="footer" class="resource-actions">
                <sl-button-group>
                    <sl-button size="small" class="view-btn">
                        <span class="material-icons">visibility</span>
                    </sl-button>
                    <sl-button size="small" class="edit-btn">
                        <span class="material-icons">edit</span>
                    </sl-button>
                    <sl-button size="small" class="delete-btn" variant="danger">
                        <span class="material-icons">delete</span>
                    </sl-button>
                </sl-button-group>
            </div>
        `;
        
        // Add hover tooltip for warning
        if (isTokenUrl) {
            const warning = card.querySelector('.token-warning');
            if (warning) {
                warning.addEventListener('mouseenter', () => {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'token-warning-tooltip';
                    tooltip.style.cssText = `
                        position: fixed;
                        background: rgba(0,0,0,0.8);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 4px;
                        z-index: 10000;
                        max-width: 250px;
                        font-size: 0.9em;
                        pointer-events: none;
                    `;
                    tooltip.textContent = 'This monster uses a URL token which may not display correctly in 3D view. Delete and re-add this monster to fix.';
                    document.body.appendChild(tooltip);
                    
                    // Position the tooltip
                    const rect = warning.getBoundingClientRect();
                    tooltip.style.left = `${rect.right + 10}px`;
                    tooltip.style.top = `${rect.top}px`;
                    
                    warning.addEventListener('mouseleave', () => {
                        tooltip.remove();
                    }, { once: true });
                });
            }
        }
        
        // Add event listeners
        card.querySelector('.view-btn').addEventListener('click', () => {
            this.showMonsterDetails(monster.data);
        });
        
        card.querySelector('.edit-btn').addEventListener('click', () => {
            // TODO: Add monster editing capability later
            alert('Monster editing will be implemented in a future update');
        });
        
        card.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm(`Remove ${monster.name} from bestiary?`)) {
                // First, remove from the resource manager's bestiary collection
                this.resources.bestiary.delete(monster.id);
                
                // Then ensure it's deleted from persistent storage via MonsterManager
                if (this.monsterManager) {
                    // Use the new deleteMonster method if available
                    if (typeof this.monsterManager.deleteMonster === 'function') {
                        this.monsterManager.deleteMonster(monster.id);
                    } else {
                        // Fallback for older versions
                        const database = this.monsterManager.loadDatabase();
                        if (database && database.monsters) {
                            delete database.monsters[monster.id];
                            localStorage.setItem("monsterDatabase", JSON.stringify(database));
                        }
                    }
                    console.log(`Deleted monster '${monster.name}' (${monster.id}) from persistent storage`);
                }
                
                // Refresh the gallery to show changes
                this.updateBestiaryGallery(drawer, view);
            }
        });
        
        container.appendChild(card);
    });

    // Debugging
    // this.addDirectSearchToPanel(drawer);
}
setupBestiaryFilters(drawer, panelHeader) {
    // Ensure we're targeting elements within the bestiary panel
    const bestiaryPanel = drawer.querySelector('sl-tab-panel[name="bestiary"]');
    if (!bestiaryPanel) return;
    
    const searchInput = bestiaryPanel.querySelector('#monster-search');
    const clearSearchBtn = bestiaryPanel.querySelector('#clear-search');
    const clearFiltersBtn = bestiaryPanel.querySelector('#clear-filters');
    
    console.log("Setting up native search elements:", {
        searchInput: !!searchInput,
        clearSearchBtn: !!clearSearchBtn,
        clearFiltersBtn: !!clearFiltersBtn
    });
    
    // Direct search function that filters gallery items
    const filterGallery = (searchTerm) => {
        const gallery = bestiaryPanel.querySelector('#bestiaryGallery');
        if (!gallery) return;
        
        console.log(`Filtering monsters by name: "${searchTerm}"`);
        
        // Show or hide monster cards based on name match
        const cards = gallery.querySelectorAll('.resource-item');
        let matchCount = 0;
        
        cards.forEach(card => {
            const nameElement = card.querySelector('.resource-name');
            if (!nameElement) return;
            
            const monsterName = nameElement.textContent.replace(/⚠️|warning/, '').trim();
            const isMatch = !searchTerm || 
                           monsterName.toLowerCase().includes(searchTerm.toLowerCase());
            
            card.style.display = isMatch ? '' : 'none';
            if (isMatch) matchCount++;
        });
        
        // Show "no results" message if needed
        let noResultsMsg = gallery.querySelector('.no-results-message');
        if (matchCount === 0) {
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-results-message';
                noResultsMsg.style.cssText = 'text-align: center; padding: 32px; color: #666;';
                noResultsMsg.innerHTML = `
                    <span class="material-icons" style="font-size: 48px; opacity: 0.5;">search_off</span>
                    <p>No monsters match your search</p>
                `;
                gallery.appendChild(noResultsMsg);
            }
            noResultsMsg.style.display = 'block';
        } else if (noResultsMsg) {
            noResultsMsg.style.display = 'none';
        }
        
        console.log(`Found ${matchCount} matching monsters`);
    };
    
    // Add event listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterGallery(e.target.value);
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                filterGallery('');
            }
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                filterGallery('');
            }
        });
    }
}

addDirectSearchToPanel(drawer) {
    const bestiaryPanel = drawer.querySelector('sl-tab-panel[name="bestiary"]');
    if (!bestiaryPanel) return;
    
    // Check if search is already added
    if (bestiaryPanel.querySelector('#direct-search')) return;
    
    // Create a simple native search input
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'margin-bottom: 16px; position: sticky; top: 0; background: white; padding: 8px; z-index: 10;';
    searchContainer.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
            <input type="search" id="direct-search" placeholder="Search monsters..." 
                   style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <button id="clear-direct-search" style="background: #f44336; color: white; border: none; border-radius: 4px; padding: 8px;">
                Clear
            </button>
        </div>
    `;
    
    // Insert at the top of the panel
    bestiaryPanel.insertBefore(searchContainer, bestiaryPanel.firstChild);
    
    // Add event handlers
    const searchInput = bestiaryPanel.querySelector('#direct-search');
    const clearBtn = bestiaryPanel.querySelector('#clear-direct-search');
    
    // Simple search functionality
    searchInput.addEventListener('input', () => {
        this.filterBestiaryByName(drawer, searchInput.value);
    });
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.filterBestiaryByName(drawer, '');
    });
}

// Add this method to ResourceManager class
filterBestiaryByName(drawer, searchTerm) {
    const bestiaryPanel = drawer.querySelector('sl-tab-panel[name="bestiary"]');
    const gallery = bestiaryPanel?.querySelector('#bestiaryGallery');
    if (!gallery) return;
    
    console.log(`Filtering ${this.resources.bestiary.size} monsters by name: "${searchTerm}"`);
    
    // Show or hide monster cards based on name match
    const cards = gallery.querySelectorAll('.resource-item');
    let matchCount = 0;
    
    cards.forEach(card => {
        const nameElement = card.querySelector('.resource-name');
        if (!nameElement) return;
        
        const monsterName = nameElement.textContent.replace(/⚠️|warning/, '').trim();
        const isMatch = !searchTerm || 
                       monsterName.toLowerCase().includes(searchTerm.toLowerCase());
        
        card.style.display = isMatch ? '' : 'none';
        if (isMatch) matchCount++;
    });
    
    // Show "no results" message if needed
    let noResultsMsg = gallery.querySelector('.no-results-message');
    if (matchCount === 0) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            noResultsMsg.style.cssText = 'text-align: center; padding: 32px; color: #666;';
            noResultsMsg.innerHTML = `
                <span class="material-icons" style="font-size: 48px; opacity: 0.5;">search_off</span>
                <p>No monsters match your search</p>
            `;
            gallery.appendChild(noResultsMsg);
        }
        noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
    }
    
    console.log(`Found ${matchCount} matching monsters`);
}

// Super simple getFilteredBestiary that uses stored filters
getFilteredBestiary(drawer) {
    // Fallback if filters aren't initialized
    if (!this.bestiaryFilters) {
        return Array.from(this.resources.bestiary.values());
    }
    
    const { searchTerm, crFilter, typeFilter, sizeFilter } = this.bestiaryFilters;
    
    console.log("Filtering with stored values:", {
        searchTerm,
        crFilter,
        typeFilter,
        sizeFilter,
        monsterCount: this.resources.bestiary.size
    });
    
    return Array.from(this.resources.bestiary.values()).filter(monster => {
        // Name search - case insensitive
        const nameMatch = !searchTerm || 
            monster.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // CR filter - exact match
        const crMatch = !crFilter || monster.cr === crFilter;
        
        // Type filter - exact match
        const typeMatch = !typeFilter || monster.type === typeFilter;
        
        // Size filter - exact match
        const sizeMatch = !sizeFilter || monster.size === sizeFilter;
        
        return nameMatch && crMatch && typeMatch && sizeMatch;
    });
}



    showMonsterDetails(monsterData) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = monsterData.basic.name;
        
        // Generate full stat block HTML
        dialog.innerHTML = `
            <div style="max-height: 70vh; overflow-y: auto;">
                <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
                    ${monsterData.token?.data ? `
                        <div style="flex: 0 0 150px; text-align: center;">
                            <img src="${monsterData.token.data}" style="width: 150px; height: 150px; object-fit: contain; border-radius: 5px;">
                        </div>
                    ` : ''}
                    
                    <div style="flex: 1;">
                        <div style="font-style: italic; color: #666; margin-bottom: 8px;">
                            ${monsterData.basic.size} ${monsterData.basic.type}, ${monsterData.basic.alignment}
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                            <div>
                                <div style="font-weight: bold;">Armor Class</div>
                                <div>${monsterData.stats.ac}</div>
                            </div>
                            <div>
                                <div style="font-weight: bold;">Hit Points</div>
                                <div>${monsterData.stats.hp.average} (${monsterData.stats.hp.roll})</div>
                            </div>
                            <div>
                                <div style="font-weight: bold;">Speed</div>
                                <div>${monsterData.stats.speed}</div>
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-weight: bold;">Challenge Rating:</div>
                            <div>${monsterData.basic.cr} (${monsterData.basic.xp} XP)</div>
                        </div>
                    </div>
                </div>
                
                <!-- Ability Scores -->
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 16px;">
                    <div>
                        <div style="font-weight: bold;">STR</div>
                        <div>${monsterData.abilities.str.score} (${monsterData.abilities.str.modifier >= 0 ? "+" : ""}${monsterData.abilities.str.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">DEX</div>
                        <div>${monsterData.abilities.dex.score} (${monsterData.abilities.dex.modifier >= 0 ? "+" : ""}${monsterData.abilities.dex.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CON</div>
                        <div>${monsterData.abilities.con.score} (${monsterData.abilities.con.modifier >= 0 ? "+" : ""}${monsterData.abilities.con.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">INT</div>
                        <div>${monsterData.abilities.int.score} (${monsterData.abilities.int.modifier >= 0 ? "+" : ""}${monsterData.abilities.int.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">WIS</div>
                        <div>${monsterData.abilities.wis.score} (${monsterData.abilities.wis.modifier >= 0 ? "+" : ""}${monsterData.abilities.wis.modifier})</div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CHA</div>
                        <div>${monsterData.abilities.cha.score} (${monsterData.abilities.cha.modifier >= 0 ? "+" : ""}${monsterData.abilities.cha.modifier})</div>
                    </div>
                </div>
                
                <!-- Additional Traits -->
                <div style="margin-bottom: 16px;">
                    ${monsterData.traits.senses.length > 0 ? `
                        <div style="margin-bottom: 8px;">
                            <strong>Senses:</strong> ${monsterData.traits.senses.join(', ')}
                        </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 8px;">
                        <strong>Languages:</strong> ${monsterData.traits.languages}
                    </div>
                    
                    ${monsterData.traits.immunities.length > 0 ? `
                        <div style="margin-bottom: 8px;">
                            <strong>Immunities:</strong> ${monsterData.traits.immunities.join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div slot="footer">
                <sl-button class="close-btn" variant="neutral">Close</sl-button>
                <sl-button class="add-encounter-btn" variant="primary">
                    <span class="material-icons">add_location</span>
                    Add to Map
                </sl-button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event handlers
        dialog.querySelector('.close-btn').addEventListener('click', () => {
            dialog.hide();
        });
        
        dialog.querySelector('.add-encounter-btn').addEventListener('click', () => {
            dialog.hide();
            // Find the map editor instance
            const mapEditor = window.mapEditor || document.querySelector('.map-editor')?.mapEditor;
            if (mapEditor) {
                this.addMonsterToMap(monsterData, mapEditor);
            } else {
                alert('Map editor not found or not initialized');
            }
        });
        
        dialog.addEventListener('sl-after-hide', () => {
            dialog.remove();
        });
        
        dialog.show();
    }

    addMonsterToMap(monster, mapEditor) {
        if (!mapEditor) {
            console.error('Map editor not available');
            return false;
        }
        
        try {
            const monsterData = monster.data || monster;
            
            // Open a dialog to confirm placement
            const dialog = document.createElement('sl-dialog');
            dialog.label = `Add ${monsterData.basic.name} to Map`;
            
            dialog.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        ${monsterData.token?.data ? `
                            <img src="${monsterData.token.data}" 
                                 style="width: 80px; height: 80px; object-fit: contain; border-radius: 5px;">
                        ` : ''}
                        
                        <div>
                            <h3 style="margin: 0 0 8px 0;">${monsterData.basic.name}</h3>
                            <div style="color: #666;">
                                ${monsterData.basic.size} ${monsterData.basic.type}, CR ${monsterData.basic.cr}
                            </div>
                        </div>
                    </div>
                    
                    <div class="placement-option">
                        <sl-radio-group label="Placement Option" name="placement">
                            <sl-radio value="click" checked>Click on map to place</sl-radio>
                            <sl-radio value="random">Place randomly in selected area</sl-radio>
                        </sl-radio-group>
                    </div>
                    
                    <div class="quantity-control">
                        <sl-input type="number" label="Quantity" min="1" max="20" value="1" id="monsterQuantity"></sl-input>
                    </div>
                </div>
                
                <div slot="footer">
                    <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
                    <sl-button variant="primary" class="add-btn">Add to Map</sl-button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            return new Promise((resolve) => {
                dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                    dialog.hide();
                    resolve(false);
                });
                
                dialog.querySelector('.add-btn').addEventListener('click', () => {
                    const placementOption = dialog.querySelector('sl-radio-group').value;
                    const quantity = parseInt(dialog.querySelector('#monsterQuantity').value) || 1;
                    
                    const result = {
                        monster: monsterData,
                        placement: placementOption,
                        quantity: quantity
                    };
                    
                    dialog.hide();
                    
                    if (placementOption === 'click') {
                        // Find and close the resource manager drawer
                        const resourceDrawer = document.querySelector('.resource-manager-drawer');
                        if (resourceDrawer && resourceDrawer.open) {
                            resourceDrawer.hide();
                        }
                        
                        // Set map editor to encounter placement mode with this monster
                        this.setMapEditorToPlacementMode(mapEditor, result);
                    } else {
                        // Random placement - would need coordinates of a selected area
                        alert('Random placement coming in future update');
                    }
                    
                    resolve(true);
                });
                
                dialog.addEventListener('sl-after-hide', () => {
                    dialog.remove();
                });
                
                dialog.show();
            });
        } catch (error) {
            console.error('Error adding monster to map:', error);
            return false;
        }
    }


    setMapEditorToPlacementMode(mapEditor, placementData) {
        const { monster, quantity } = placementData;
        
        // Store the monster data temporarily
        mapEditor.pendingEncounterMonster = monster;
        mapEditor.pendingEncounterQuantity = quantity;
        
        // Switch to encounter marker placement mode
        mapEditor.setTool("marker-encounter");
        
        // Show instruction toast
        const toast = document.createElement('div');
        toast.className = 'placement-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        toast.innerHTML = `
            <span class="material-icons">touch_app</span>
            <span>Click on the map to place ${monster.basic.name}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        // Modify the MapEditor's addMarker method temporarily to use our monster data
        const originalAddMarker = mapEditor.addMarker;
        mapEditor.addMarker = function(type, x, y, data = {}) {
            if (type === "encounter" && this.pendingEncounterMonster) {
                // Setup the data with our monster
                data.monster = this.pendingEncounterMonster;
                
                // Create the marker with our monster data
                const marker = originalAddMarker.call(this, type, x, y, data);
                
                // Apply proper sizing based on monster size
                this.updateMarkerAppearance(marker);
                
                // Reset after placement
                this.pendingEncounterMonster = null;
                this.pendingEncounterQuantity = null;
                
                // Restore the original method
                this.addMarker = originalAddMarker;
                
                // Remove toast if it's still there
                document.querySelector('.placement-toast')?.remove();
                
                return marker;
            }
            
            return originalAddMarker.call(this, type, x, y, data);
        };
    }


    async addSound(file, category = 'ambient') {
        if (!file) {
            console.warn('No file provided for sound');
            return null;
        }
    
        try {
            console.log('Processing sound file:', file.name);
            
            // Create unique ID for the sound
            const soundId = `${category}_${Date.now()}`;
            
            // Convert file to base64
            const soundData = await this.createSoundData(file);
            
            // Get duration if possible
            let duration = await this.getSoundDuration(file);
            
            const soundInfo = {
                id: soundId,
                name: file.name,
                category,
                data: soundData,
                duration: duration || 0,
                dateAdded: new Date().toISOString()
            };
    
            // Store in appropriate category
            if (!this.resources.sounds[category]) {
                this.resources.sounds[category] = new Map();
            }
            this.resources.sounds[category].set(soundId, soundInfo);
            
            console.log('Added sound:', {
                id: soundId,
                name: file.name,
                category,
                duration
            });
    
            return soundId;
        } catch (error) {
            console.error('Error processing sound file:', error);
            return null;
        }
    }
    
    async createSoundData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    async getSoundDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
            });
            audio.addEventListener('error', () => {
                console.warn('Could not get audio duration');
                resolve(0);
            });
            audio.src = URL.createObjectURL(file);
        });
    }
    
    playSound(soundId, category) {
        const sound = this.resources.sounds[category]?.get(soundId);
        if (!sound?.data) {
            console.warn('Sound not found:', soundId);
            return;
        }
    
        // Create and configure audio element
        const audio = new Audio(sound.data);
        audio.volume = 1.0;
    
        // Store reference to stop playback if needed
        if (!this.activeAudio) {
            this.activeAudio = new Map();
        }
        
        // Stop any previous playback of this sound
        if (this.activeAudio.has(soundId)) {
            this.activeAudio.get(soundId).pause();
        }
        
        this.activeAudio.set(soundId, audio);
    
        // Play the sound
        audio.play().catch(error => {
            console.error('Error playing sound:', error);
        });
    
        // Remove reference when done
        audio.addEventListener('ended', () => {
            this.activeAudio.delete(soundId);
        });
    
        return audio;
    }
    
    stopSound(soundId) {
        if (this.activeAudio?.has(soundId)) {
            this.activeAudio.get(soundId).pause();
            this.activeAudio.delete(soundId);
        }
    }
    
    deleteSound(soundId, category) {
        // Stop playback if active
        this.stopSound(soundId);
        
        // Remove from storage
        const categoryMap = this.resources.sounds[category];
        if (categoryMap) {
            categoryMap.delete(soundId);
            return true;
        }
        return false;
    }
    
    async convertBase64ToAudioBuffer(base64Data, audioContext) {
        // Remove data URL prefix if present
        const base64String = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
        
        // Decode base64
        const binaryString = window.atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
    
        // Create audio buffer
        return new Promise((resolve, reject) => {
            audioContext.decodeAudioData(
                bytes.buffer,
                buffer => resolve(buffer),
                error => reject(error)
            );
        });
    }
    
    // Get sound for Three.js
    async getThreeJSSound(soundName, category = 'effects') {
        // Search through the category for a matching sound name
        const soundEntry = Array.from(this.resources.sounds[category].values())
            .find(sound => sound.name.toLowerCase() === soundName.toLowerCase());
        
        if (!soundEntry) {
            console.warn(`Sound "${soundName}" not found in category "${category}"`);
            return null;
        }
    
        return {
            data: soundEntry.data,
            volume: 0.5 // Default volume, could be made configurable
        };
    }
    
    // Load sound for Three.js
    async loadThreeJSSound(sound, listener) {
        if (!sound || !sound.data) {
            console.warn('Invalid sound data provided');
            return null;
        }
    
        const audioContext = listener.context;
        const threeSound = new THREE.Audio(listener);
    
        try {
            const buffer = await this.convertBase64ToAudioBuffer(sound.data, audioContext);
            threeSound.setBuffer(buffer);
            threeSound.setVolume(sound.volume);
            return threeSound;
        } catch (error) {
            console.error('Error loading sound:', error);
            return null;
        }
    }

// New method to process folder imports
async processFolderImport(files) {
    console.log(`Processing ${files.length} files from folder import`);
    
    // Create a new map for this import, or use existing one if it exists
    const folderMap = this.propFolderMap || new Map();
    
    // Process each file and extract its folder path
    for (const file of files) {
        // Get the file's folder path
        const path = file.webkitRelativePath || '';
        const pathParts = path.split('/');
        
        // Skip files that aren't in folders
        if (pathParts.length < 2) continue;
        
        // Skip non-image files
        if (!file.type.startsWith('image/')) {
            console.log(`Skipping non-image file: ${file.name}`);
            continue;
        }
        
        // Remove filename from path
        pathParts.pop();
        
        // Create tags from folder structure
        const tags = [];
        let currentPath = '';
        for (const part of pathParts) {
            if (currentPath) currentPath += '-';
            currentPath += part.toLowerCase().replace(/\s+/g, '-');
            tags.push(currentPath);
        }
        
        // Add file to the resource
        const textureId = await this.addTexture(file, 'props', {
            tags: tags,
            sourcePath: pathParts.join('/')
        });
        
        // Add folder information to the map
        if (textureId) {
            tags.forEach(tag => {
                // Create entry if it doesn't exist
                if (!folderMap.has(tag)) {
                    folderMap.set(tag, {
                        label: this.formatTagDisplay(tag),
                        files: []
                    });
                }
                
                // Add this file to the tag's files list
                folderMap.get(tag).files.push(textureId);
            });
        }
    }
    
    // Store folder mapping
    this.propFolderMap = folderMap;
    
    // Save folder mapping to resources
    if (!this.resources.metadata) {
        this.resources.metadata = {};
    }
    
    this.resources.metadata.propFolders = Array.from(folderMap.entries()).map(([tag, data]) => ({
        tag,
        label: data.label,
        files: data.files
    }));
    
    console.log(`Processed ${folderMap.size} total folders with tags:`, this.propFolderMap);
}

// Helper to format tag display from tag ID
formatTagDisplay(tag) {
    return tag.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' › ');
}



}

