class LayersPanel {
    constructor(editor) {
        this.editor = editor;
        this.panel = document.querySelector(".layers-panel");
        this.layersList = document.getElementById("layersList");
        // this.setupPanel();
        this.draggedItem = null;
        this.folders = [];
        this.setupDragAndDrop();
        this.setupFolderControls();
    }

    setupFolderControls() {
        // Add "New Folder" button to the panel header
        const header = document.querySelector('.layers-panel .tool-section-title');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const newFolderBtn = document.createElement('sl-button');
        newFolderBtn.size = 'small';
        newFolderBtn.innerHTML = '<span class="material-icons">create_new_folder</span>';
        newFolderBtn.style.marginLeft = 'auto';
        newFolderBtn.addEventListener('click', () => this.createNewFolder());
        header.appendChild(newFolderBtn);
    }

    async createNewFolder() {
        const dialog = document.createElement('sl-dialog');
        dialog.label = 'New Folder';
        dialog.innerHTML = `
      <sl-input
        id="folderNameInput"
        label="Folder Name"
        placeholder="Enter folder name"
        required
      ></sl-input>
      <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="create-btn">Create</sl-button>
      </div>
    `;

        document.body.appendChild(dialog);

        return new Promise(resolve => {
            const input = dialog.querySelector('#folderNameInput');
            const createBtn = dialog.querySelector('.create-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            const handleCreate = () => {
                const name = input.value.trim();
                if (name) {
                    this.addFolder(name);
                    dialog.hide();
                    resolve(true);
                }
            };

            createBtn.addEventListener('click', handleCreate);
            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                resolve(false);
            });

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') dialog.hide();
            });

            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
            });

            dialog.show();
            setTimeout(() => input.focus(), 100);
        });
    }

    addFolder(name) {
        const folder = {
            id: Date.now(),
            name: name,
            expanded: true,
            rooms: []
        };
        this.folders.push(folder);
        this.updateLayersList();
    }

    createFolderElement(folder) {
        const folderElement = document.createElement('div');
        folderElement.className = `layer-folder ${folder.locked ? 'locked' : ''}`;
        folderElement.dataset.folderId = folder.id;

        folderElement.innerHTML = `
    <div class="folder-header">
      <span class="material-icons folder-toggle">
        ${folder.expanded ? 'expand_more' : 'chevron_right'}
      </span>
      <span class="material-icons folder-icon" style="color: ${this.getFolderColor(folder)};">
        folder${folder.expanded ? '_open' : ''}
      </span>
      <span class="folder-name">${folder.name}</span>
      <div class="folder-controls">
        <span class="material-icons visibility-toggle" style="cursor: pointer;">visibility</span>
        <span class="material-icons lock-toggle" style="cursor: pointer; color: ${folder.locked ? '#f44336' : '#fff'
            };">${folder.locked ? 'lock' : 'lock_open'}</span>
        <span class="material-icons rename-folder">edit</span>
        <span class="material-icons delete-folder">delete</span>
      </div>
    </div>
    <div class="folder-content" style="display: ${folder.expanded ? 'block' : 'none'}">
    </div>
  `;

        const lockToggle = folderElement.querySelector('.lock-toggle');
        lockToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFolderLock(folder);
        });

        // Add event handlers
        const toggle = folderElement.querySelector('.folder-toggle');
        toggle.addEventListener('click', () => {
            console.log("Folder toggle clicked");
            this.toggleFolder(folder);
        });

        // Add visibility toggle event handler
        const visibilityToggle = folderElement.querySelector('.visibility-toggle');
        visibilityToggle.addEventListener('click', (e) => {
            console.log("Visibility toggle clicked for folder:", folder);
            e.stopPropagation();
            this.toggleFolderVisibility(folder);
        });

        const deleteBtn = folderElement.querySelector('.delete-folder');
        deleteBtn.addEventListener('click', () => {
            if (folder.locked) {
                this.editor.showLockedMessage();
                return;
            }
            this.deleteFolder(folder);
        });

        // Also add locked state check to rename
        const renameBtn = folderElement.querySelector('.rename-folder');
        renameBtn.addEventListener('click', () => {
            if (folder.locked) {
                this.editor.showLockedMessage();
                return;
            }
            this.renameFolder(folder);
        });

        return folderElement;
    }

    toggleFolderLock(folder) {
        folder.locked = !folder.locked;

        // Lock/unlock all rooms in the folder
        folder.rooms.forEach(room => {
            room.locked = folder.locked;
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                if (folder.locked) {
                    roomElement.classList.add('locked');
                } else {
                    roomElement.classList.remove('locked');
                }
            }
        });

        // Update the folder's appearance
        const folderElement = document.querySelector(`[data-folder-id="${folder.id}"]`);
        if (folderElement) {
            const lockIcon = folderElement.querySelector('.lock-toggle');
            lockIcon.textContent = folder.locked ? 'lock' : 'lock_open';
            lockIcon.style.color = folder.locked ? '#f44336' : '#666';
            folderElement.classList.toggle('locked', folder.locked);
        }

        this.updateLayersList();
    }

    // setupDragAndDrop() {
    //     this.layersList.addEventListener('dragstart', (e) => {
    //         if (!e.target.classList.contains('layer-item')) return;
    //         const roomId = parseInt(e.target.dataset.roomId);
    //         const room = this.editor.rooms.find(r => r.id === roomId);
    //         if (room && room.locked) {
    //             e.preventDefault();
    //             this.editor.showLockedMessage();
    //             return;
    //         }
    //     this.draggedItem = e.target;
    //     e.target.classList.add('dragging');
    //     e.dataTransfer.effectAllowed = 'move';
    //     e.dataTransfer.setData('text/plain', e.target.dataset.roomId);
    //   });

    //   this.layersList.addEventListener('dragend', (e) => {
    //     if (!e.target.classList.contains('layer-item')) return;
    //     e.target.classList.remove('dragging');
    //     this.draggedItem = null;
    //     this.updateRoomOrder();
    //   });

    //   // Update dragover to handle folders
    //   this.layersList.addEventListener('dragover', (e) => {
    //     e.preventDefault();
    //     if (!this.draggedItem) return;

    //     const folderContent = e.target.closest('.folder-content');
    //     const folderHeader = e.target.closest('.folder-header');

    //     // Remove any existing drag-over indicators
    //     document.querySelectorAll('.drag-over').forEach(el => 
    //       el.classList.remove('drag-over')
    //     );

    //     if (folderContent) {
    //       // Dragging within a folder
    //       const afterElement = this.getDragAfterElement(folderContent, e.clientY);
    //       if (afterElement) {
    //         folderContent.insertBefore(this.draggedItem, afterElement);
    //       } else {
    //         folderContent.appendChild(this.draggedItem);
    //       }
    //       folderContent.classList.add('drag-over');
    //     } else if (folderHeader) {
    //       // Dragging over a folder header - indicate can drop into folder
    //       folderHeader.classList.add('drag-over');
    //     } else {
    //       // Dragging in root list
    //       const afterElement = this.getDragAfterElement(this.layersList, e.clientY);
    //       if (afterElement) {
    //         this.layersList.insertBefore(this.draggedItem, afterElement);
    //       } else {
    //         this.layersList.appendChild(this.draggedItem);
    //       }
    //     }
    //   });

    //   // Add drop handling for folders
    // // In the drop handler in setupDragAndDrop:
    // this.layersList.addEventListener('drop', (e) => {
    //     e.preventDefault();
    //     if (!this.draggedItem) return;

    //     const folderHeader = e.target.closest('.folder-header');
    //     const folderContent = e.target.closest('.folder-content');

    //     if (folderHeader || folderContent) {
    //         const folderElement = folderHeader ? 
    //             folderHeader.closest('.layer-folder') : 
    //             folderContent.closest('.layer-folder');

    //         const folderId = folderElement.dataset.folderId;
    //         const folder = this.folders.find(f => f.id === parseInt(folderId));

    //         if (folder) {
    //             const roomId = parseInt(this.draggedItem.dataset.roomId);
    //             const room = this.editor.rooms.find(r => r.id === roomId);
    //             if (room && room.locked) {
    //         this.editor.showLockedMessage();
    //         return;
    //     }

    //             if (room) {
    //                 console.log("Adding room to folder:", {
    //                     roomId,
    //                     roomName: room.name,
    //                     folderId,
    //                     folderName: folder.name
    //                 });

    //                 // Remove from any other folder first
    //                 this.folders.forEach(f => {
    //                     f.rooms = f.rooms.filter(r => r.id !== roomId);
    //                 });

    //                 // Add to new folder
    //                 folder.rooms.push(room);
    //                 console.log("Folder rooms after add:", folder.rooms);
    //             }
    //         }

    //         this.updateLayersList();
    //     }

    //     // Remove drag-over indicators
    //     document.querySelectorAll('.drag-over').forEach(el => 
    //         el.classList.remove('drag-over')
    //     );
    // });
    // }

    // Update getDragAfterElement to work with folders

    setupDragAndDrop() {
        this.layersList.addEventListener('dragstart', (e) => {
            // Only handle layer-item elements
            if (!e.target.classList.contains('layer-item')) return;

            // Get room ID and check if locked
            const roomId = parseInt(e.target.dataset.roomId);
            const room = this.editor.rooms.find(r => r.id === roomId);

            if (room && room.locked) {
                e.preventDefault();
                this.editor.showLockedMessage();
                return;
            }

            // Store the dragged element and add dragging class
            this.draggedItem = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.dataset.roomId);

            // Add helper text to indicate what's being dragged
            const ghostText = document.createElement('div');
            ghostText.textContent = room ? room.name : 'Layer item';
            ghostText.style.position = 'absolute';
            ghostText.style.top = '-1000px'; // Off-screen
            document.body.appendChild(ghostText);

            // Clean up ghost element after dragend
            setTimeout(() => {
                if (document.body.contains(ghostText)) {
                    document.body.removeChild(ghostText);
                }
            }, 100);
        });

        this.layersList.addEventListener('dragend', (e) => {
            if (!e.target.classList.contains('layer-item')) return;

            e.target.classList.remove('dragging');
            this.draggedItem = null;

            // Remove any drag-over indicators
            document.querySelectorAll('.drag-over').forEach(el =>
                el.classList.remove('drag-over')
            );

            this.updateRoomOrder();
        });

        // Improved dragover event with better target detection
        this.layersList.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedItem) return;

            // Remove any existing drag-over indicators
            document.querySelectorAll('.drag-over').forEach(el =>
                el.classList.remove('drag-over')
            );

            // Find the closest relevant container
            const folderContent = this.findClosestElement(e.target, '.folder-content');
            const folderHeader = this.findClosestElement(e.target, '.folder-header');
            const layerFolder = this.findClosestElement(e.target, '.layer-folder');

            if (folderContent) {
                // Dragging within a folder's content area
                const afterElement = this.getDragAfterElement(folderContent, e.clientY);
                if (afterElement) {
                    folderContent.insertBefore(this.draggedItem, afterElement);
                } else {
                    folderContent.appendChild(this.draggedItem);
                }
                folderContent.classList.add('drag-over');
            }
            else if (folderHeader) {
                // Dragging over a folder header - indicate can drop into folder
                folderHeader.classList.add('drag-over');
            }
            else if (layerFolder && !folderContent && !folderHeader) {
                // Dragging over the folder but not specifically header or content
                // Find the folder's content area and use that
                const content = layerFolder.querySelector('.folder-content');
                if (content) {
                    content.classList.add('drag-over');
                }
            }
            else {
                // Dragging in root list
                const afterElement = this.getDragAfterElement(this.layersList, e.clientY);
                if (afterElement) {
                    // Don't insert before a folder
                    if (!afterElement.classList.contains('layer-folder')) {
                        this.layersList.insertBefore(this.draggedItem, afterElement);
                    }
                } else {
                    this.layersList.appendChild(this.draggedItem);
                }
            }
        });

        // Improved drop handler with better folder detection
        this.layersList.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.draggedItem) return;

            // Find relevant container elements
            const folderHeader = this.findClosestElement(e.target, '.folder-header');
            const folderContent = this.findClosestElement(e.target, '.folder-content');
            const layerFolder = this.findClosestElement(e.target, '.layer-folder');

            let targetFolder = null;

            // Determine the target folder based on where the drop occurred
            if (folderHeader) {
                // Dropped on folder header
                targetFolder = folderHeader.closest('.layer-folder');
            }
            else if (folderContent) {
                // Dropped in folder content
                targetFolder = folderContent.closest('.layer-folder');
            }
            else if (layerFolder) {
                // Dropped on folder but not on header or content
                targetFolder = layerFolder;
            }

            if (targetFolder) {
                const folderId = parseInt(targetFolder.dataset.folderId);
                const folder = this.folders.find(f => f.id === folderId);

                if (folder) {
                    const roomId = parseInt(this.draggedItem.dataset.roomId);
                    const room = this.editor.rooms.find(r => r.id === roomId);

                    // Double-check that room is not locked
                    if (room && room.locked) {
                        this.editor.showLockedMessage();
                        return;
                    }

                    if (room) {
                        console.log("Adding room to folder:", {
                            roomId,
                            roomName: room.name,
                            folderId,
                            folderName: folder.name
                        });

                        // Remove from any other folder first
                        this.folders.forEach(f => {
                            f.rooms = f.rooms.filter(r => r.id !== roomId);
                        });

                        // Add to new folder
                        folder.rooms.push(room);
                    }
                }
            } else {
                // Dropped outside any folder - remove from all folders
                const roomId = parseInt(this.draggedItem.dataset.roomId);
                this.folders.forEach(f => {
                    f.rooms = f.rooms.filter(r => r.id !== roomId);
                });
            }

            // Remove all drag-over indicators
            document.querySelectorAll('.drag-over').forEach(el =>
                el.classList.remove('drag-over')
            );

            // Update the UI
            this.updateLayersList();
        });
    }

    // Add this helper method to find the closest parent with a specific selector
    findClosestElement(element, selector) {
        // Check if element itself matches
        if (element.matches && element.matches(selector)) {
            return element;
        }

        // Walk up the DOM tree
        let current = element;
        while (current && current !== document) {
            if (current.matches && current.matches(selector)) {
                return current;
            }
            current = current.parentElement;
        }

        return null;
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.layer-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            // We're looking for the element that has the smallest negative offset
            // (meaning the cursor is just above it)
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    getFolderColor(folder) {
        // If folder has a custom color, use that
        if (folder.color) return folder.color;

        // Otherwise generate a consistent color based on folder name
        // This ensures the same folder always gets the same color
        const hash = folder.name.split('').reduce((hash, char) => {
            return ((hash << 5) - hash) + char.charCodeAt(0);
        }, 0);

        // Generate a pastel color (lighter and less saturated)
        // Using HSL for more pleasing colors
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 80%)`;
    }

    // getDragAfterElement(container, y) {
    //   const draggableElements = [...container.querySelectorAll('.layer-item:not(.dragging)')];
    //   return draggableElements.reduce((closest, child) => {
    //     const box = child.getBoundingClientRect();
    //     const offset = y - box.top - box.height / 2;
    //     if (offset < 0 && offset > closest.offset) {
    //       return { offset: offset, element: child };
    //     } else {
    //       return closest;
    //     }
    //   }, { offset: Number.NEGATIVE_INFINITY }).element;
    // }

    updateRoomOrder() {
        const newOrder = [...this.layersList.querySelectorAll('.layer-item')]
            .map(item => {
                return this.editor.rooms.find(room => room.id === parseInt(item.dataset.roomId));
            })
            .filter(room => room); // Filter out any undefined rooms
        this.editor.rooms = newOrder;
    }
    setupPanel() {
        // Get the existing Add Room button and set up its event listener
        const addRoomBtn = document.getElementById("addRoomBtn");
        if (addRoomBtn) {
            addRoomBtn.addEventListener("click", () =>
                this.editor.startRoomCreation()
            );
        }
    }


    updateLayersList() {
        this.layersList.innerHTML = '';

        // Make sure we have folders initialized
        if (!this.folders) {
            this.folders = [];
        }

        // Add folders and their contents
        this.folders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            this.layersList.appendChild(folderElement);

            // Add rooms in this folder's content area
            const folderContent = folderElement.querySelector('.folder-content');
            folder.rooms.forEach(room => {
                const roomElement = this.createLayerItem(room);
                folderContent.appendChild(roomElement);
            });
        });

        // Only show unassigned rooms (not in any folder)
        const unassignedRooms = this.editor.rooms.filter(room =>
            !this.folders.some(folder => folder.rooms.includes(room))
        );
        unassignedRooms.forEach(room => {
            const roomElement = this.createLayerItem(room);
            this.layersList.appendChild(roomElement);
        });
    }


    toggleFolder(folder) {
        folder.expanded = !folder.expanded;
        const folderElement = document.querySelector(`[data-folder-id="${folder.id}"]`);
        if (folderElement) {
            const folderContent = folderElement.querySelector('.folder-content');
            const folderIcon = folderElement.querySelector('.folder-icon');
            const folderToggle = folderElement.querySelector('.folder-toggle');

            if (folder.expanded) {
                folderContent.style.display = 'block';
                folderIcon.textContent = 'folder_open';
                folderToggle.textContent = 'expand_more';
            } else {
                folderContent.style.display = 'none';
                folderIcon.textContent = 'folder';
                folderToggle.textContent = 'chevron_right';
            }
        }
    }

    toggleFolderVisibility(folder) {
        console.log("toggleFolderVisibility called with folder:", folder);
        const folderElement = document.querySelector(`[data-folder-id="${folder.id}"]`);
        const folderVisibilityIcon = folderElement.querySelector('.visibility-toggle');

        // Get current state
        const anyVisible = folder.rooms.some(room => room.visible);
        console.log("Current visibility state:", { anyVisible, roomCount: folder.rooms.length });

        // For each room in the folder, find its visibility toggle and click it
        folder.rooms.forEach(room => {
            console.log("Toggling visibility for room:", room.name);
            // Use the room's own toggle method
            room.visible = !anyVisible;  // Set all to opposite of current state
            if (room.element) {
                room.element.style.display = room.visible ? 'block' : 'none';
                // Update the room's visibility icon
                const roomVisibilityToggle = document.querySelector(`#room-${room.id} .visibility-toggle`);
                if (roomVisibilityToggle) {
                    roomVisibilityToggle.textContent = room.visible ? 'visibility' : 'visibility_off';
                    roomVisibilityToggle.style.color = room.visible ? '#fff' : '#666';
                }
            }
        });

        // Update folder visibility icon
        folderVisibilityIcon.textContent = anyVisible ? 'visibility_off' : 'visibility';
        folderVisibilityIcon.style.color = anyVisible ? '#666' : '#fff';
    }

    async renameFolder(folder) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = 'Rename Folder';
        dialog.innerHTML = `
      <sl-input
        id="folderNameInput"
        label="Folder Name"
        value="${folder.name}"
        required
      ></sl-input>
      <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="save-btn">Save</sl-button>
      </div>
    `;

        document.body.appendChild(dialog);

        return new Promise(resolve => {
            const input = dialog.querySelector('#folderNameInput');
            const saveBtn = dialog.querySelector('.save-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            const handleSave = () => {
                const name = input.value.trim();
                if (name) {
                    folder.name = name;
                    this.updateLayersList();
                    dialog.hide();
                    resolve(true);
                }
            };

            saveBtn.addEventListener('click', handleSave);
            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                resolve(false);
            });

            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
            });

            dialog.show();
            setTimeout(() => input.focus(), 100);
        });
    }

    async deleteFolder(folder) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = 'Delete Folder';
        dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <p>What would you like to do with "${folder.name}" and its contents?</p>
                <p style="color: #666; font-size: 0.9em;">Folder contains ${folder.rooms.length} item${folder.rooms.length !== 1 ? 's' : ''}</p>
            </div>
            
            <sl-radio-group label="Delete Options" name="deleteOption" value="move">
                <sl-radio value="move">Move contents to root and delete folder</sl-radio>
                <sl-radio value="delete">Delete folder and all contents</sl-radio>
            </sl-radio-group>
        </div>
        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="danger" class="confirm-btn">Delete</sl-button>
        </div>
    `;

        document.body.appendChild(dialog);

        return new Promise(resolve => {
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const radioGroup = dialog.querySelector('sl-radio-group');

            confirmBtn.addEventListener('click', () => {
                const option = radioGroup.value;
                if (option === 'move') {
                    // Move contents to root
                    folder.rooms.length = 0;
                } else if (option === 'delete') {
                    // Delete all contents and their DOM elements
                    folder.rooms.forEach(room => {
                        // Remove from editor's rooms array
                        const index = this.editor.rooms.indexOf(room);
                        if (index > -1) {
                            this.editor.rooms.splice(index, 1);
                        }
                        // Remove the DOM element
                        if (room.element) {
                            room.element.remove();
                        }
                        // Get any associated room element by ID and remove it
                        const roomElement = document.getElementById(`room-${room.id}`);
                        if (roomElement) {
                            roomElement.remove();
                        }
                    });
                }
                // Remove folder
                this.folders = this.folders.filter(f => f.id !== folder.id);
                this.updateLayersList();
                dialog.hide();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                resolve(false);
            });

            dialog.addEventListener('sl-after-hide', () => {
                dialog.remove();
            });

            dialog.show();
        });
    }

    createLayerItem(room) {
        const layerItem = document.createElement('div');

        if (room.id === this.editor.selectedRoomId) {
            layerItem.classList.add('selected');
        }

        layerItem.className = `layer-item ${room.type}-room ${room.finalized ? '' : 'editing'
            } ${room.id === this.editor.selectedRoomId ? 'selected' : ''} ${room.locked ? 'locked' : ''
            }`;

        layerItem.draggable = true;
        layerItem.dataset.roomId = room.id;

        layerItem.addEventListener('mousedown', (e) => {
            if (room.locked && e.button === 0) { // Left click only
                e.preventDefault();
                e.stopPropagation();
                this.editor.showLockedMessage();
                return;
            }
        });

        // Add data attributes for room type and texture
        layerItem.setAttribute("data-room-type", room.type);
        if (room.name === "WallTexture" || room.name === "RoomTexture") {
            layerItem.setAttribute("data-texture-room", "true");
        }

        const getTooltipText = (room) => {
            if (room.name === "WallTexture")
                return "Wall Texture Definition - Used for wall surfaces in 3D view";
            if (room.name === "RoomTexture")
                return "Room Texture Definition - Used for room surfaces in 3D view";
            return room.type === "wall" ? "Wall Definition" : "Room Definition";
        };

        // Add tooltip to layer name
        const layerName = layerItem.querySelector(".layer-name");
        if (layerName) {
            layerName.setAttribute("title", getTooltipText(room));
        }


        layerItem.innerHTML = `
        <div class="layer-content">
            <div class="layer-controls">
                <span class="material-icons visibility-toggle" style="cursor: pointer; color: ${room.visible ? '#fff' : '#666'
            };">
                    ${room.visible ? 'visibility' : 'visibility_off'}
                </span>
                <span class="material-icons lock-toggle" style="cursor: pointer; color: ${room.locked ? '#f44336' : '#fff'
            };">
                    ${room.locked ? 'lock' : 'lock_open'}
                </span>
            </div>
<div class="layer-thumbnail">
    ${(() => {
                if (!room.thumbnail) {
                    room.createThumbnail();
                }
                return room.thumbnail ?
                    `<img src="${room.thumbnail}" alt="Room thumbnail">` :
                    `<div class="thumbnail-placeholder"></div>`;
            })()}
</div>
            <div class="layer-info">
                <div class="layer-name">${room.name}</div>
                <div class="layer-dimensions">${Math.round(room.bounds.width)}×${Math.round(
                room.bounds.height
            )}</div>
            </div>
            <div class="layer-controls">
                <span class="material-icons edit-btn" style="color: #2196F3; cursor: pointer;">edit</span>
                <span class="material-icons delete-btn" style="color: #f44336; cursor: pointer;">delete</span>
            </div>
        </div>
    `;

        const lockToggle = layerItem.querySelector('.lock-toggle');
        lockToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (room.locked) {
                room.locked = false;
                lockToggle.textContent = 'lock_open';
                lockToggle.style.color = '#fff';
                layerItem.classList.remove('locked');
            } else {
                room.locked = true;
                lockToggle.textContent = 'lock';
                lockToggle.style.color = '#f44336';
                layerItem.classList.add('locked');
            }
        });


        // Add hover effect
        layerItem.addEventListener("mouseenter", () => {
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                roomElement.classList.add("highlighted");
            }
        });

        layerItem.addEventListener("mouseleave", () => {
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                roomElement.classList.remove("highlighted");
            }
        });

        layerItem.addEventListener("mouseenter", () => {
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                roomElement.classList.add("highlighted");
                // Force reflow for polygon highlights
                if (room.shape === "polygon") {
                    roomElement.style.transform = "translateZ(0)";
                }
            }
        });

        layerItem.addEventListener("mouseleave", () => {
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                roomElement.classList.remove("highlighted");
                // Reset transform
                if (room.shape === "polygon") {
                    roomElement.style.transform = "";
                }
            }
        });

        layerItem.addEventListener('click', (e) => {
            // Don't trigger for clicks on controls
            if (e.target.closest('.layer-controls')) return;

            // Remove selected class from all items
            document.querySelectorAll('.layer-item').forEach(item => {
                item.classList.remove('selected');
            });

            // Add selected class to this item
            layerItem.classList.add('selected');

            // Update editor's selected room id
            this.editor.selectedRoomId = room.id;

            // Optionally, add any selection behaviors here
            // For example, highlight the room in the canvas
            const roomElement = document.getElementById(`room-${room.id}`);
            if (roomElement) {
                roomElement.classList.add('selected-in-canvas');

                // Remove the highlight after a delay
                setTimeout(() => {
                    roomElement.classList.remove('selected-in-canvas');
                }, 1500);
            }
        });

        const visibilityToggle =
            layerItem.querySelector(".visibility-toggle");
        visibilityToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            room.toggleVisibility();
            visibilityToggle.textContent = room.visible
                ? "visibility"
                : "visibility_off";
            visibilityToggle.style.color = room.visible ? "#fff" : "#666";
        });



        layerItem
            .querySelector(".edit-btn")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                if (room.locked) {
                    this.editor.showLockedMessage();
                    return;
                }
                this.showRenameDialog(room);
            });

        layerItem
            .querySelector(".delete-btn")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                if (room.locked) {
                    this.editor.showLockedMessage();
                    return;
                }
                this.editor.deleteRoom(room);
            });

        // Add double-click handler for renaming
        layerItem.addEventListener("dblclick", () => {
            this.showRenameDialog(room);
        });

        return layerItem;
    }




    async showRenameDialog(room) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = 'Area Properties';

        // Force type to wall
        room.type = 'wall';

        const assignedTextureId = this.editor.resourceManager?.textureAssignments?.get(room.id)?.textureId;
        const wallTextures = this.editor.resourceManager?.resources.textures.walls;
        const hasTextures = wallTextures && wallTextures.size > 0;
        const currentFolder = this.folders.find(folder => folder.rooms.includes(room));

        // Check for legacy texture setting
        const isLegacyTexture = room.name === "WallTexture";

        dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <sl-input 
                id="roomNameInput" 
                value="${room.name}" 
                label="Area Name"
            ></sl-input>

            <!-- Folder Selection -->
            <sl-select 
                id="folderSelect" 
                label="Folder"
                value="${currentFolder ? currentFolder.id : ''}"
            >
                <sl-option value="">No Folder</sl-option>
                ${this.folders.map(folder => `
                    <sl-option value="${folder.id}">${folder.name}</sl-option>
                `).join('')}
            </sl-select>

            ${hasTextures ? `
              <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
                  <div style="margin-bottom: 16px;">
                      <label style="display: block; margin-bottom: 8px; font-weight: bold;">Wall Properties</label>
                      
                      <!-- Modified to show checkbox for regular wall -->
                      <div style="display: flex; flex-direction: column; gap: 12px;">
                          <!-- Wall Height Selector -->
                          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                              <sl-checkbox id="isRegularWall" 
                                  ${room.isRegularWall ? 'checked' : ''}
                                  ${room.blockHeight === 0 && room.type === 'wall' && !room.isRaisedBlock ? 'checked' : ''}>
                                  Regular Wall (Full Height)
                              </sl-checkbox>
                          </div>
                          
                          <!-- Block height slider - disabled when isRegularWall is checked -->
                          <sl-range 
                              id="blockHeight" 
                              label="Height" 
                              min="0" max="101" 
                              step="1" 
                              tooltip="top" 
                              value="${room.blockHeight ? Math.round(room.blockHeight * 2) : '0'}"
                              help-text="0 = No raised block, 1 = ½ block, 2 = 1 block, etc."
                              style="margin-bottom: 16px;"
                              ${room.isRegularWall ? 'disabled' : ''}
                          ></sl-range>
                      </div>
          
                      <label style="display: block; margin: 16px 0 8px 0;">Texture:</label>
                      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
                          ${Array.from(wallTextures.entries()).map(([id, texture]) => `
                              <div class="texture-option" data-texture-id="${id}" 
                                  style="cursor: pointer; border: 2px solid ${assignedTextureId === id ? 'var(--sl-color-primary-600)' : 'transparent'
            }; padding: 4px; border-radius: 4px; position: relative;">
                                  <img src="${texture.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 2px;">
                                  <div style="font-size: 0.8em; text-align: center; margin-top: 4px;">${texture.name}</div>
                                  ${assignedTextureId === id ? `
                                      <span class="material-icons" style="position: absolute; top: 4px; right: 4px; color: #4CAF50; 
                                          background: rgba(0,0,0,0.5); border-radius: 50%; padding: 2px;">
                                          check_circle
                                      </span>
                                  ` : ''}
                              </div>
                          `).join('')}
                      </div>
                  </div>
              </div>
          ` : ''}

            <!-- Legacy Wall Texture Option -->
            ${room.shape === 'rectangle' ? `
                <div style="border: 1px solid #444; padding: 12px; border-radius: 4px;">
                    <sl-checkbox id="setAsTexture" ${isLegacyTexture ? 'checked' : ''}>
                        Set as Wall Texture Source
                    </sl-checkbox>
                </div>
            ` : ''}
        </div>
        
<-- Dock/Undock position holder -->
    
    <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="save-btn">Save</sl-button>
    </div>
`;


        // <div style="margin-top: 16px;">
        //     <sl-button class="dock-room-btn" variant="neutral" style="width: 100%;">
        //         <span class="material-icons" style="margin-right: 8px;">link</span>
        //         Dock to Another Room
        //     </sl-button>
        // </div>

        document.body.appendChild(dialog);

        return new Promise((resolve) => {
            const nameInput = dialog.querySelector('#roomNameInput');
            const folderSelect = dialog.querySelector('#folderSelect');
            const setAsTextureCheckbox = dialog.querySelector('#setAsTexture');
            const saveBtn = dialog.querySelector('.save-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const isRegularWallCheckbox = dialog.querySelector('#isRegularWall');

            const textureOptions = dialog.querySelectorAll('.texture-option');
            textureOptions.forEach(option => {
                option.addEventListener('click', () => {
                    textureOptions.forEach(opt => opt.style.border = '2px solid transparent');
                    option.style.border = '2px solid var(--sl-color-primary-600)';
                    dialog.selectedTextureId = option.dataset.textureId;
                });
            });


            const blockHeightSlider = dialog.querySelector('#blockHeight');
            if (blockHeightSlider) {
                // Set initial value if room is a raised block
                if (room.isRaisedBlock && room.blockHeight) {
                    blockHeightSlider.value = Math.round(room.blockHeight * 2);
                }

                blockHeightSlider.addEventListener('sl-input', (e) => {
                    // Update label while sliding
                    const value = parseInt(e.target.value);
                    const height = value / 2;
                    blockHeightSlider.label = `Block Height: ${height} ${height === 1 ? 'block' : 'blocks'}`;

                    // Handle Prop- naming as slider moves
                    const currentName = nameInput.value.trim();
                    if (value > 0) {  // If any height is set
                        if (currentName.startsWith("Wall")) {
                            nameInput.value = currentName.replace("Wall", "Prop");
                        } else if (!currentName.startsWith("Prop-")) {
                            nameInput.value = `Prop-${currentName}`;
                        }
                    } else {  // If height is 0
                        if (currentName.startsWith("Prop-")) {
                            nameInput.value = currentName.substring(5);  // Remove Prop- prefix
                        }
                    }
                });
            }


            if (isRegularWallCheckbox && blockHeightSlider) {
                isRegularWallCheckbox.addEventListener('sl-change', (e) => {
                    if (e.target.checked) {
                        blockHeightSlider.disabled = true;
                        blockHeightSlider.value = 0; // Set height to 0 for regular walls
                    } else {
                        blockHeightSlider.disabled = false;
                    }
                });
            }

            const handleSave = () => {
                const newName = nameInput.value.trim();
                if (newName) {
                    room.name = setAsTextureCheckbox?.checked ? "WallTexture" : newName;


                    // Handle wall type settings
                    if (isRegularWallCheckbox && isRegularWallCheckbox.checked) {
                        // Regular wall settings
                        room.isRegularWall = true;
                        room.isRaisedBlock = false;
                        room.blockHeight = 0;
                        room.type = 'wall';
                    } else if (blockHeightSlider) {
                        // Raised block settings
                        room.isRegularWall = false;
                        const blockHeight = parseInt(blockHeightSlider.value) / 2;
                        room.isRaisedBlock = blockHeight > 0;
                        room.blockHeight = room.isRaisedBlock ? blockHeight : undefined;
                    }



                    if (dialog.selectedTextureId && this.editor.resourceManager) {
                        this.editor.resourceManager.assignTextureToStructure(room.id, dialog.selectedTextureId, 'walls');
                    }

                    // Handle folder assignment
                    if (folderSelect.value) {
                        this.folders.forEach(folder => {
                            folder.rooms = folder.rooms.filter(r => r.id !== room.id);
                        });
                        const newFolder = this.folders.find(f => f.id === parseInt(folderSelect.value));
                        if (newFolder) {
                            newFolder.rooms.push(room);
                        }
                    }

                    this.updateLayersList();
                    dialog.hide();
                    resolve(true);
                }
            };

            saveBtn.addEventListener('click', handleSave);
            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                resolve(false);
            });

            const dockBtn = dialog.querySelector('.dock-room-btn');
            if (dockBtn) {
                dockBtn.addEventListener('click', () => {
                    dialog.hide();
                    this.showDockDialog(room);
                });
            }

            const undockBtn = dialog.querySelector('.undock-room-btn');
            if (undockBtn) {
                undockBtn.addEventListener('click', () => {
                    this.editor.undockRoom(room);
                    dialog.hide();
                });
            }

            dialog.addEventListener('sl-after-hide', () => dialog.remove());
            dialog.show();
        });
    }

    async showDockDialog(room) {
        const dialog = document.createElement('sl-dialog');
        dialog.label = 'Dock Room';
        dialog.style.setProperty('--width', '800px');

        let selectedRoom = null;
        let selectedPosition = null;  // Add this declaration

        const availableRooms = this.editor.rooms.filter(r =>
            r.id !== room.id && !this.editor.dockedRooms.has(r.id)
        );

        dialog.innerHTML = `
    <div style="display: grid; grid-template-columns: 250px 1fr; gap: 16px;">
        <!-- Room List - left side -->
        <div class="room-list" style="border-right: 1px solid #444; padding-right: 16px; overflow-y: auto; max-height: 500px;">
            <div style="margin-bottom: 8px; font-weight: bold;">Available Rooms</div>
            ${availableRooms.map(r => `
                <div class="room-option" data-room-id="${r.id}" style="cursor: pointer; padding: 8px; margin-bottom: 8px; border: 1px solid #666; border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 4px;">${r.name}</div>
                    <div style="width: 100%; height: 80px; background: #333; border-radius: 2px; overflow: hidden;">
                        ${r.thumbnail ? `<img src="${r.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Docking Grid - right side -->
        <div class="dock-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; padding: 20px;">
            <!-- Row 1 -->
            <div class="dock-spacer"></div>
            <button class="dock-button" data-position="top-left">⬆</button>
            <button class="dock-button" data-position="top-center">⬆</button>
            <button class="dock-button" data-position="top-right">⬆</button>
            <div class="dock-spacer"></div>

            <!-- Row 2 -->
            <button class="dock-button" data-position="left-top">⬅</button>
            <div class="dock-spacer"></div>
            <div class="dock-spacer"></div>
            <div class="dock-spacer"></div>
            <button class="dock-button" data-position="right-top">➡</button>

            <!-- Row 3 (Center) -->
            <button class="dock-button" data-position="left-middle">⬅</button>
            <div class="dock-spacer"></div>
            <div class="room-preview">
                <img src="${room.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div class="dock-spacer"></div>
            <button class="dock-button" data-position="right-middle">➡</button>

            <!-- Row 4 -->
            <button class="dock-button" data-position="left-bottom">⬅</button>
            <div class="dock-spacer"></div>
            <div class="dock-spacer"></div>
            <div class="dock-spacer"></div>
            <button class="dock-button" data-position="right-bottom">➡</button>

            <!-- Row 5 -->
            <div class="dock-spacer"></div>
            <button class="dock-button" data-position="bottom-left">⬇</button>
            <button class="dock-button" data-position="bottom-center">⬇</button>
            <button class="dock-button" data-position="bottom-right">⬇</button>
            <div class="dock-spacer"></div>
        </div>
    </div>


        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="dock-btn" disabled>Dock</sl-button>
        </div>
    `;

        document.body.appendChild(dialog);

        return new Promise((resolve) => {
            let selectedRoom = null;
            let selectedPosition = null;

            // Room selection
            dialog.querySelectorAll('.room-option').forEach(option => {
                option.addEventListener('click', () => {
                    console.log('Room selected:', option.dataset.roomId);
                    dialog.querySelectorAll('.room-option').forEach(opt =>
                        opt.classList.remove('selected'));
                    option.classList.add('selected');
                    selectedRoom = availableRooms.find(r =>
                        r.id === parseInt(option.dataset.roomId));
                    dialog.querySelector('.dock-btn').disabled = !(selectedRoom && selectedPosition);
                    console.log('Dock button state:', {
                        selectedRoom: !!selectedRoom,
                        selectedPosition: !!selectedPosition,
                        buttonDisabled: dialog.querySelector('.dock-btn').disabled
                    });
                });
            });

            // Position selection using grid buttons
            dialog.querySelectorAll('.dock-button').forEach(button => {
                button.addEventListener('click', () => {
                    console.log('Position selected:', button.dataset.position);
                    dialog.querySelectorAll('.dock-button').forEach(btn =>
                        btn.classList.remove('selected'));
                    button.classList.add('selected');
                    selectedPosition = button.dataset.position;
                    dialog.querySelector('.dock-btn').disabled = !(selectedRoom && selectedPosition);
                    console.log('Dock button state:', {
                        selectedRoom: !!selectedRoom,
                        selectedPosition: !!selectedPosition,
                        buttonDisabled: dialog.querySelector('.dock-btn').disabled
                    });
                });
            });

            // Dock button handler
            dialog.querySelector('.dock-btn').addEventListener('click', () => {
                if (selectedRoom && selectedPosition) {
                    this.editor.dockRooms(room, selectedRoom, selectedPosition);
                    dialog.hide();
                    resolve(true);
                }
            });

            // Cancel button handler
            dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                dialog.hide();
                resolve(false);
            });

            dialog.addEventListener('sl-after-hide', () => dialog.remove());
            dialog.show();
        });

    }


}
