// Add comment near the splash art panel:
/* TODO: Splash art upload functionality not fully implemented
   Known issues:
   - File upload not working
   - Preview/gallery not updating
   Consider hiding this tab until functionality is complete
*/

window.ResourceManager = class {
    constructor() {
        this.resources = {
            textures: {
                walls: new Map(),
                doors: new Map(),
                floors: new Map(),
                props: new Map()
            },
            sounds: {
                ambient: new Map(),
                effects: new Map()
            },
            splashArt: new Map(),
            effects: {
                particles: new Map(),
                lighting: new Map()
            }
        };

        this.loadedPacks = new Map();
        this.activePackId = null;
        this.mapResourceLinks = new Map();
        this.activeResourcePack = null;
        this.thumbnailSize = 100;

        // Initialize textureAssignments map in constructor
        this.textureAssignments = new Map();
        this.defaultWallTextureId = null;
    }

    // Resource pack methods
    async loadResourcePack(file) {
        try {
            // Read the file as text
            const text = await file.text();
            const packData = JSON.parse(text);

            // Load the data into our resources
            this.deserializeResourcePack(packData);
            this.activeResourcePack = packData;

            return true;
        } catch (error) {
            console.error('Error loading resource pack:', error);
            return false;
        }
    }

    async saveResourcePack(filename = 'resource-pack.json') {
        const packData = {
            name: this.activeResourcePack?.name || 'New Resource Pack',
            version: '1.0',
            textures: this.serializeTextures(),
            sounds: this.serializeSounds(),
            splashArt: this.serializeSplashArt()
        };

        const blob = new Blob([JSON.stringify(packData, null, 2)],
            { type: 'application/json' });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    // Add these methods to ResourceManager class
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
                    dateAdded: texture.dateAdded
                };
            });
        }
        return serialized;
    }

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

    serializeSplashArt() {
        const serialized = {};
        this.resources.splashArt.forEach((art, id) => {
            serialized[id] = {
                id: art.id,
                name: art.name,
                data: art.data,
                thumbnail: art.thumbnail,
                description: art.description,
                dateAdded: art.dateAdded
            };
        });
        return serialized;
    }



    deserializeResourcePack(packData) {
        if (packData.textures) {
            for (const [category, textures] of Object.entries(packData.textures)) {
                if (!this.resources.textures[category]) {
                    this.resources.textures[category] = new Map();
                }
                for (const [id, texture] of Object.entries(textures)) {
                    this.resources.textures[category].set(id, texture);

                    // Add this: Set first wall texture as default
                    if (category === 'walls' && !this.defaultWallTextureId) {
                        this.defaultWallTextureId = id;
                        console.log('Set default wall texture:', id);
                    }
                }
            }
        }


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
            for (const [id, art] of Object.entries(packData.splashArt)) {
                this.resources.splashArt.set(id, art);
            }
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

        console.log('Found texture:', firstTexture);
        return firstTexture;
    }


    async addTexture(file, category, subcategory) {
        if (!file || !category) {
            console.warn('Missing required parameters:', { file, category });
            return null;
        }

        try {
            console.log('Creating texture from file:', file);
            // Create thumbnail and base64 data
            const imageData = await this.createImageData(file);
            const thumbnail = await this.createThumbnail(file);

            const textureData = {
                id: `${category}_${Date.now()}`,
                name: file.name,
                category,
                subcategory,
                data: imageData,
                thumbnail,
                dateAdded: new Date().toISOString()
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
        console.log('Updating gallery:', { category, view });
        const container = drawer.querySelector(`#${category}Gallery`);
        if (!container) {
            console.warn(`Gallery container not found for ${category}`);
            return;
        }

        // Update container class based on view
        container.className = `gallery-container ${view === 'grid' ? 'gallery-grid' : 'gallery-list'}`;

        // Clear existing content
        container.innerHTML = '';

        // Get resources for the selected category
        const resources = this.resources.textures[category];
        if (!resources || resources.size === 0) {
            container.innerHTML = `
                <sl-card class="empty-gallery">
                    <div style="text-align: center; padding: 2rem;">
                        <span class="material-icons" style="font-size: 3rem; opacity: 0.5;">image_not_supported</span>
                        <p>No ${category} added yet</p>
                    </div>
                </sl-card>
            `;
            return;
        }

        // Create cards for each resource
        resources.forEach((resource, id) => {
            // console.log('Creating card for resource:', resource);
            const card = document.createElement('sl-card');
            card.className = 'resource-item';

            // Create content based on view type
            card.innerHTML = `
                ${view === 'grid' ? `
                    <img 
                        src="${resource.thumbnail}" 
                        alt="${resource.name}"
                        class="resource-thumbnail"
                    />
                    <div class="resource-info">
                        <div class="resource-name">${resource.name}</div>
                        <div class="resource-meta">${this.formatDate(resource.dateAdded)}</div>
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
                            <div class="resource-name">${resource.name}</div>
                            <div class="resource-meta">${this.formatDate(resource.dateAdded)}</div>
                        </div>
                    </div>
                `}
                <div slot="footer" class="resource-actions">
                    <sl-button-group>
                        <sl-button size="small" class="preview-btn">
                            <span class="material-icons">visibility</span>
                        </sl-button>
                        <sl-button size="small" class="delete-btn" variant="danger">
                            <span class="material-icons">delete</span>
                        </sl-button>
                    </sl-button-group>
                </div>
            `;

            // Add event listeners
            card.querySelector('.preview-btn').addEventListener('click', () => {
                this.showResourcePreview(resource);
            });

            card.querySelector('.delete-btn').addEventListener('click', () => {
                this.deleteResource(category, id);
                this.updateGallery(drawer, category, view);
            });

            container.appendChild(card);
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

        // Add embedded styles
        const styles = document.createElement('style');
        styles.textContent = `
            .resource-manager-drawer::part(panel) {
                width: 50vw;
                max-width: 800px;
            }
    
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
        `;


        drawer.innerHTML = `
    ${styles.outerHTML}
    <div class="resource-manager-content">
        <sl-tab-group>
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

<!-- Texture Panel -->
<sl-tab-panel name="textures">
    <div class="panel-header">
<sl-button-group class="texture-categories">
    <sl-button size="small" data-category="walls">Walls</sl-button>
    <sl-button size="small" data-category="doors">Doors</sl-button>
    <sl-button size="small" data-category="floors" disabled tooltip="Floor textures coming soon">
        Floors <sl-badge variant="neutral" pill>WIP</sl-badge>
    </sl-button>
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

    <!-- Create separate containers for each texture category -->
    <div id="wallsGallery" class="gallery-container gallery-grid"></div>
    <div id="doorsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
    <div id="floorsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
    <div id="propsGallery" class="gallery-container gallery-grid" style="display: none;"></div>
</sl-tab-panel>

            <!-- Sounds Panel -->
            <sl-tab-panel name="sounds">
                <div class="panel-header">
                    <sl-button-group class="sound-categories">
                        <sl-button size="small" data-category="ambient">Ambient</sl-button>
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

                <div class="gallery-container" id="soundGallery"></div>
            </sl-tab-panel>

            <!-- Splash Art Panel -->
            <sl-tab-panel name="splashArt">
                <div class="panel-header">
                    <div class="flex-spacer"></div>
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

                <div class="gallery-container" id="splashArtGallery"></div>
            </sl-tab-panel>
        </sl-tab-group>
    </div>

    <!-- Footer Actions -->
    <div slot="footer">
        <sl-button-group>
            <sl-button variant="primary" id="saveResourcePack">
                <span class="material-icons" slot="prefix">save</span>
                Save Pack
            </sl-button>
            <sl-button variant="default" id="loadResourcePack">
                <span class="material-icons" slot="prefix">folder_open</span>
                Load Pack
            </sl-button>
        </sl-button-group>
    </div>
`;

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

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveResourcePack();
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const success = await this.loadResourcePack(file);
                        if (success) {
                            const currentCategory = drawer.querySelector('.texture-categories sl-button[variant="primary"]')?.dataset.category || 'walls';
                            this.updateGallery(drawer, currentCategory);
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
                const category = panel.querySelector('[data-category]')?.dataset.category;
                if (category) {
                    this.updateGallery(drawer, category, view);
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

                // Hide all galleries first
                ['walls', 'doors', 'floors', 'props'].forEach(cat => {
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

        // Handle file uploads for each type
        // Handle file uploads for each type
        const setupUploadHandler = (btnClass, inputClass, type) => {
            const uploadBtn = drawer.querySelector(`.${btnClass}`);
            const fileInput = drawer.querySelector(`.${inputClass}`);

            if (!uploadBtn || !fileInput) {
                console.warn(`Upload elements not found for ${type}`);
                return;
            }

            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                const tabPanel = uploadBtn.closest('sl-tab-panel');

                if (!files.length) return;

                console.log(`Processing ${files.length} ${type} files`);

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

                // Refresh the appropriate gallery
                if (tabPanel) {
                    const view = tabPanel.querySelector('.view-toggle[variant="primary"]')?.dataset.view || 'grid';
                    const category = tabPanel.querySelector('[data-category][variant="primary"]')?.dataset.category;
                    this.updateGallery(drawer, category, view);
                }

                // Reset file input
                fileInput.value = '';
            });
        };

        setupUploadHandler('texture-upload-btn', 'texture-file-input', 'texture');
        setupUploadHandler('sound-upload-btn', 'sound-file-input', 'sound');
        setupUploadHandler('splashart-upload-btn', 'splashart-file-input', 'splashArt');




        // Add close handler
        drawer.addEventListener('sl-after-hide', () => {
            // Optional: Clean up any resources if needed
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




}