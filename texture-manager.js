/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
window.TextureManager = class {
    constructor(mapEditor) {
        this.mapEditor = mapEditor;
        // Make sure ResourceManager is initialized before using it
        if (mapEditor && mapEditor.resourceManager) {
            this.resourceManager = mapEditor.resourceManager;
            console.log('ResourceManager connected to TextureManager:', {
                isInitialized: !!this.resourceManager,
                resources: this.resourceManager.resources
            });
        } else {
            console.warn('ResourceManager not found in MapEditor');
            this.resourceManager = null;
        }
        this.textureAssignments = new Map();
    }

createDoorMesh(marker, boxWidth, boxHeight, boxDepth) {
    // Check for required data
    if (!marker?.data?.parentStructure) {
        console.warn('Door marker missing parent structure reference:', marker);
        return null;
    }

    const structure = marker.data.parentStructure;
    const doorPos = marker.data.door?.position;
    
    if (!doorPos) {
        console.warn('Door position data missing:', marker);
        return null;
    }

    // Calculate door dimensions
    const doorHeight = boxHeight * 0.8;
    const doorWidth = this.mapEditor.cellSize / 50;
    const doorDepth = 0.1;  // Standard door depth

    // Create door geometry
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
    const doorTexture = new THREE.TextureLoader().load(marker.data.texture.data);
    doorTexture.encoding = THREE.sRGBEncoding;

    const doorMaterial = new THREE.MeshStandardMaterial({
        map: doorTexture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -9, // -1
        polygonOffsetUnits: -9 // -1
    });

    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);

    // Get door orientation from position data
    const isVertical = doorPos.edge === 'left' || doorPos.edge === 'right';

    // Apply rotation based on edge
    switch(doorPos.edge) {
        case 'left':
            doorMesh.rotation.y = Math.PI / 2;
            doorMesh.position.set(
                (doorPos.x / 50 - boxWidth / 2) - doorDepth/2,
                doorHeight / 2,
                doorPos.y / 50 - boxDepth / 2
            );
            break;
        case 'right':
            doorMesh.rotation.y = Math.PI / 2;
            doorMesh.position.set(
                (doorPos.x / 50 - boxWidth / 2) + doorDepth/2,
                doorHeight / 2,
                doorPos.y / 50 - boxDepth / 2
            );
            break;
        case 'top':
            doorMesh.rotation.y = 0;
            doorMesh.position.set(
                doorPos.x / 50 - boxWidth / 2,
                doorHeight / 2,
                (doorPos.y / 50 - boxDepth / 2) - doorDepth/2
            );
            break;
        case 'bottom':
            doorMesh.rotation.y = 0;
            doorMesh.position.set(
                doorPos.x / 50 - boxWidth / 2,
                doorHeight / 2,
                (doorPos.y / 50 - boxDepth / 2) + doorDepth/2
            );
            break;
    }

    doorMesh.renderOrder = 1;
    return doorMesh;
}


        createMaterial(structure, textureRoom) {
            // Treat everything as a wall for texture purposes
            // console.log('Creating material for:', {
            //     structureId: structure.id,
            //     type: structure.type,  // Keep this for logging only
            //     hasResourceManager: !!this.resourceManager,
            //     hasTextureRoom: !!textureRoom
            // });
        
            // First try resource pack textures
            if (this.resourceManager) {
                const assignment = this.resourceManager.getStructureTextureAssignment(structure.id);
                if (assignment) {
                    const textures = this.resourceManager.resources.textures.walls;  // Always use walls collection
                    
                    if (textures && textures.get(assignment.textureId)) {
                        const texture = textures.get(assignment.textureId);
                        return this.createMaterialFromTexture(
                            texture,
                            structure.bounds.width,
                            structure.bounds.height,
                            this.mapEditor.cellSize
                        );
                    }
                }
            }
    
        // Legacy texture handling
        if (textureRoom) {
            console.log(`Using legacy ${structure.type} texture for:`, structure.id);
            const texture = this.createTextureFromRoom(textureRoom);
            return this.createMaterialFromTexture({
                data: texture,
                category: structure.type === 'wall' ? 'walls' : 'rooms'
            }, structure.bounds.width, structure.bounds.height, this.mapEditor.cellSize);
        }
    
        // Default fallback material
        console.log(`Using default material for ${structure.type}:`, structure.id);
        return new THREE.MeshStandardMaterial({
            color: structure.type === 'wall' ? 0xcccccc : 0x666666,
            roughness: 0.7,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
    }


createMaterialFromTexture(textureData, roomWidth = 1000, roomHeight = 1000, cellSize = 50) {
    const texture = new THREE.TextureLoader().load(textureData.data);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // console.log('Texture data:', textureData.category);

    // Check texture category for special handling
    switch (textureData.category) {
        case 'walls':
            return new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.DoubleSide
            });

        default:
            return new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.DoubleSide
            });
    }
}

    createWallMaterial(wall, wallTextureRoom) {
        // Try resource pack first
        console.log('Checking resource pack...', {
            hasResourceManager: !!this.resourceManager,
            hasTextureAssignments: !!this.resourceManager?.textureAssignments,
            wallId: wall.id,
            assignments: this.resourceManager?.textureAssignments
        });

        if (this.resourceManager) {
            // First check for specific assignment
            const assignment = this.resourceManager.getWallTextureAssignment(wall.id);
            if (assignment) {
                const texture = this.resourceManager.resources.textures.walls.get(assignment.textureId);
                if (texture) {
                    console.log('Using assigned wall texture:', texture.name);
                    return this.createMaterialFromTexture(texture);
                }
            }

            // If no specific assignment, try default texture
            const defaultTexture = this.resourceManager.getDefaultWallTexture();
            if (defaultTexture) {
                console.log('Using default wall texture:', defaultTexture.name);
                return this.createMaterialFromTexture(defaultTexture);
            }
        }

        // Try legacy WallTexture if no resource pack texture found
        if (wallTextureRoom) {
            console.log('Using legacy WallTexture for wall:', wall.id);
            const texture = this.createTextureFromRoom(wallTextureRoom);
            return new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture,
                roughness: 0.8,
                metalness: 0.1,
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide,
                depthWrite: true
            });
        }

        // Fallback to basic material
        console.log('Using fallback material for wall:', wall.id);
        return new THREE.MeshStandardMaterial({
            color: 0x505050,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
    }

    createTextureFromRoom(room) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = room.bounds.width;
        canvas.height = room.bounds.height;

        // Draw the portion of the map that contains the texture
        ctx.drawImage(
            this.mapEditor.baseImage,
            room.bounds.x,
            room.bounds.y,
            room.bounds.width,
            room.bounds.height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        // Calculate repeats based on grid cell size
        const horizontalRepeats = Math.round(room.bounds.width / this.mapEditor.cellSize);
        const verticalRepeats = Math.round(room.bounds.height / this.mapEditor.cellSize);

        texture.repeat.set(horizontalRepeats, verticalRepeats);
        texture.needsUpdate = true;

        return texture;
    }


    assignTexture(elementId, textureId, type) {
        this.textureAssignments.set(elementId, {
            textureId,
            type,
            dateAssigned: new Date().toISOString()
        });
    }

    getAssignedTexture(elementId) {
        return this.textureAssignments.get(elementId);
    }

    serializeTextureAssignments() {
        return Array.from(this.textureAssignments.entries())
            .map(([elementId, data]) => ({
                elementId,
                ...data
            }));
    }

    deserializeTextureAssignments(data) {
        this.textureAssignments.clear();
        data.forEach(item => {
            this.textureAssignments.set(item.elementId, {
                textureId: item.textureId,
                type: item.type,
                dateAssigned: item.dateAssigned
            });
        });
    }
}