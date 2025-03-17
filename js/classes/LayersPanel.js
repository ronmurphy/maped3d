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
        this.initTabSwitcher();
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
  
    // Get folder color - either from property or generate one
    const folderColor = this.getFolderColor(folder);
  
    folderElement.innerHTML = `
      <div class="folder-header" style="display: flex; align-items: center; padding: 6px 8px; cursor: pointer; background-color: rgba(40, 40, 40, 0.5);">
        <span class="material-icons folder-toggle" style="margin-right: 4px; font-size: 16px; transition: transform 0.2s;">
          ${folder.expanded ? 'expand_more' : 'chevron_right'}
        </span>
        <span class="material-icons folder-icon" style="margin-right: 6px; color: ${folderColor}; font-size: 18px;">
          folder${folder.expanded ? '_open' : ''}
        </span>
        <span class="folder-name" style="flex: 1; font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${folder.name}
        </span>
        <div class="folder-controls" style="display: flex; gap: 4px; margin-left: auto;">
          <span class="material-icons visibility-toggle" title="${folder.anyVisible ? 'Hide All' : 'Show All'}" 
                style="cursor: pointer; font-size: 16px; color: ${folder.anyVisible ? '#fff' : '#666'};">
            ${folder.anyVisible ? 'visibility' : 'visibility_off'}
          </span>
          <span class="material-icons lock-toggle" title="${folder.locked ? 'Unlock' : 'Lock'}" 
                style="cursor: pointer; font-size: 16px; color: ${folder.locked ? '#f44336' : '#fff'};">
            ${folder.locked ? 'lock' : 'lock_open'}
          </span>
          <span class="material-icons rename-folder" title="Rename" 
                style="cursor: pointer; font-size: 16px; color: #2196F3;">
            edit
          </span>
          <span class="material-icons delete-folder" title="Delete Folder" 
                style="cursor: pointer; font-size: 16px; color: #f44336;">
            delete
          </span>
        </div>
      </div>
      <div class="folder-content" style="display: ${folder.expanded ? 'block' : 'none'}; padding-left: 12px; border-left: 2px solid ${folderColor};">
      </div>
    `;
  
    // Add lock toggle handler
    const lockToggle = folderElement.querySelector('.lock-toggle');
    lockToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFolderLock(folder);
    });
  
    // Add folder toggle handler
    const toggleButton = folderElement.querySelector('.folder-toggle');
    const folderHeader = folderElement.querySelector('.folder-header');
    folderHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking a control button
      if (e.target.closest('.folder-controls') && 
          !e.target.classList.contains('folder-toggle')) return;
      
      this.toggleFolder(folder);
    });
  
    // Add visibility toggle handler
    const visibilityToggle = folderElement.querySelector('.visibility-toggle');
    visibilityToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFolderVisibility(folder);
    });
  
    // Add delete handler
    const deleteBtn = folderElement.querySelector('.delete-folder');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (folder.locked) {
        this.editor.showLockedMessage();
        return;
      }
      this.deleteFolder(folder);
    });
  
    // Add rename handler
    const renameBtn = folderElement.querySelector('.rename-folder');
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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


    updateRoomOrder() {
        const newOrder = [...this.layersList.querySelectorAll('.layer-item')]
            .map(item => {
                return this.editor.rooms.find(room => room.id === parseInt(item.dataset.roomId));
            })
            .filter(room => room); // Filter out any undefined rooms
        this.editor.rooms = newOrder;
    }


// Add this method to the LayersPanel class
initTabSwitcher() {
    // Get the header element where the folder button is
    const header = document.querySelector('.layers-panel .tool-section-title');
    if (!header) return;
    
    // Create tab switcher container
    const tabSwitcher = document.createElement('div');
    tabSwitcher.className = 'tab-switcher';
    tabSwitcher.style.cssText = `
      display: flex; 
      border-radius: 4px; 
      overflow: hidden;
      margin-right: auto;
      border: 1px solid #555;
    `;
    
    // Create Layers tab button
    const layersTab = document.createElement('button');
    layersTab.className = 'tab-button active';
    layersTab.textContent = 'Areas';
    layersTab.style.cssText = `
      padding: 4px 8px; 
      border: none; 
      background: none; 
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      flex: 1;
    `;
    
    // // Create Markers tab button
    const markersTab = document.createElement('button');
    markersTab.className = 'tab-button';
    markersTab.textContent = 'Markers';
    markersTab.style.cssText = `
      padding: 4px 8px; 
      border: none; 
      background: none; 
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      flex: 1;
    `;
    
    // Add styles for active tab
    document.head.appendChild(document.createElement('style')).textContent = `
  .tab-button.active {
    background-color: #555;
    color: white;
  }
  .tab-button:not(.active) {
    background-color: transparent;
    color: #aaa;
  }
  .tab-button:hover:not(.active) {
    background-color: rgba(85, 85, 85, 0.3);
  }
  .marker-item {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px solid #444;
    cursor: pointer;
  }
  .marker-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  .marker-icon {
    margin-right: 8px;
    width: 24px;
    text-align: center;
  }
  .marker-info {
    flex: 1;
    overflow: hidden;
  }
  .marker-name {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .marker-location {
    font-size: 10px;
    color: #999;
  }
  .marker-controls {
    display: flex;
    gap: 4px;
  }
  .marker-controls .material-icons {
    padding: 2px;
    cursor: pointer;
  }
  .marker-controls .material-icons:hover {
    opacity: 0.8;
  }
  .marker-filter {
    padding: 8px;
    background-color: #333;
    border-bottom: 1px solid #444;
  }
  
  /* Highlight pulse animation */
  @keyframes highlight-pulse {
    0%, 100% { box-shadow: 0 0 0 rgba(33, 150, 243, 0.5); }
    50% { box-shadow: 0 0 30px rgba(33, 150, 243, 0.8); }
  }
  
  .highlight-pulse {
    animation: highlight-pulse 1.5s ease-in-out;
  }

      // Add this to the style element in initTabSwitcher or add it separately
@keyframes highlight-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(33, 150, 243, 0.5); }
  50% { box-shadow: 0 0 30px rgba(33, 150, 243, 0.8); }
}

.highlight-pulse {
  animation: highlight-pulse 1.5s ease-in-out;
}

    `;
    
    // Add tab buttons to switcher
    tabSwitcher.appendChild(layersTab);
    tabSwitcher.appendChild(markersTab);
    
    // Add switcher to header (before the folder button)
    header.insertBefore(tabSwitcher, header.firstChild);
    
    // Store DOM references
    this.layersTab = layersTab;
    this.markersTab = markersTab;
    this.folderButton = header.querySelector('sl-button');
    
    // Add event listeners
    layersTab.addEventListener('click', () => {
      layersTab.classList.add('active');
      markersTab.classList.remove('active');
      this.showLayersPanel();
    });
    
    markersTab.addEventListener('click', () => {
      markersTab.classList.add('active');
      layersTab.classList.remove('active');
      this.showMarkersPanel();
    });
  }
  
  // New method to show the original layers panel
  showLayersPanel() {
    // Show the layers list and folder button
    const layersList = document.getElementById('layersList');
    if (layersList) layersList.style.display = 'block';
    
    // Remove markers panel if it exists
    const markersPanel = document.getElementById('markersPanel');
    if (markersPanel) markersPanel.style.display = 'none';
    
    // Show folder button
    if (this.folderButton) this.folderButton.style.display = 'flex';
    
    // Update layers list
    this.updateLayersList();
  }
  
  // New method to show markers panel
  showMarkersPanel() {
    // Hide the layers list and folder button
    const layersList = document.getElementById('layersList');
    if (layersList) layersList.style.display = 'none';
    
    // Hide folder button
    if (this.folderButton) this.folderButton.style.display = 'none';
    
    // Get or create markers panel
    let markersPanel = document.getElementById('markersPanel');
    
    if (!markersPanel) {
      markersPanel = document.createElement('div');
      markersPanel.id = 'markersPanel';
      markersPanel.style.cssText = `
        height: 100%;
        overflow-y: auto;
        color: #fff;
      `;
      
      // Add to the layers panel container
      const layersPanel = document.querySelector('.layers-panel');
      layersPanel.appendChild(markersPanel);
    }
    
    markersPanel.style.display = 'block';
    
    // Update markers panel content
    this.updateMarkersPanel();
  }
  
  // Method to update markers panel content
  updateMarkersPanel() {
    const markersPanel = document.getElementById('markersPanel');
    if (!markersPanel) return;
    
    // Get markers from editor
    const markers = this.editor.markers || [];
    const playerStart = this.editor.playerStart;
    
    // Clear existing content
    markersPanel.innerHTML = '';
    
    // Add filter section
    const filterSection = document.createElement('div');
    filterSection.className = 'marker-filter';
    filterSection.innerHTML = `
      <select id="markerTypeFilter" style="width: 100%; padding: 4px; border-radius: 4px; background: #222; color: #eee; border: 1px solid #555;">
        <option value="all">All Marker Types</option>
        <option value="door">Doors</option>
        <option value="prop">Props</option>
        <option value="teleport">Teleporters</option>
        <option value="encounter">Encounters</option>
        <option value="splash-art">Splash Art</option>
        <option value="treasure">Treasure</option>
        <option value="trap">Traps</option>
        <option value="storyboard">Story Triggers</option>
      </select>
    `;
    markersPanel.appendChild(filterSection);
    
    // Hook up filter change event
    const filter = filterSection.querySelector('#markerTypeFilter');
    filter.addEventListener('change', () => {
      this.updateMarkersPanel(); // Refresh with new filter
    });
    
    // Add player start marker if it exists
    if (playerStart) {
      const playerStartItem = this.createMarkerItem(playerStart, 'player-start');
      markersPanel.appendChild(playerStartItem);
    }
    
    // Filter markers if needed
    const selectedFilter = filter ? filter.value : 'all';
    const filteredMarkers = selectedFilter === 'all' 
      ? markers 
      : markers.filter(m => m.type === selectedFilter);
    
    // Add marker count
    const countInfo = document.createElement('div');
    countInfo.style.cssText = `
      padding: 8px; 
      font-size: 12px; 
      color: #999; 
      text-align: center;
      border-bottom: 1px solid #444;
    `;
    countInfo.textContent = `${filteredMarkers.length} marker${filteredMarkers.length !== 1 ? 's' : ''}`;
    markersPanel.appendChild(countInfo);
    
    // Add filtered markers
    if (filteredMarkers.length > 0) {
      const markersList = document.createElement('div');
      markersList.className = 'markers-list';
      
      filteredMarkers.forEach(marker => {
        const markerItem = this.createMarkerItem(marker);
        markersList.appendChild(markerItem);
      });
      
      markersPanel.appendChild(markersList);
    } else {
      // No markers message
      const emptyMessage = document.createElement('div');
      emptyMessage.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
      `;
      emptyMessage.textContent = selectedFilter === 'all' 
        ? 'No markers on this map' 
        : `No ${selectedFilter} markers on this map`;
      markersPanel.appendChild(emptyMessage);
    }
  }
  

// Update the createMarkerItem method to match the colors and styles
createMarkerItem(marker, forcedType = null) {
    const item = document.createElement('div');
    item.className = 'marker-item';
    item.dataset.markerId = marker.id;
    
    const type = forcedType || marker.type;
    
    // Determine name and icon based on marker type
    let name, icon;
    
    switch (type) {
      case 'player-start':
        name = 'Player Start';
        icon = 'person_pin_circle';
        break;
      case 'door':
        name = 'Door';
        icon = 'door_front';
        break;
      case 'prop':
        name = marker.data?.texture?.name || 'Prop';
        icon = 'category';
        break;
      case 'teleport':
        name = marker.data?.isPointA ? 'Teleport A' : 'Teleport B';
        icon = 'swap_calls';
        break;
      case 'encounter':
        name = marker.data?.monster?.basic?.name || 'Encounter';
        icon = 'local_fire_department';
        break;
      case 'splash-art':
        name = marker.data?.splashArt?.name || 'Splash Art';
        icon = 'add_photo_alternate';
        break;
      case 'treasure':
        name = marker.data?.description || 'Treasure';
        icon = 'workspace_premium';
        break;
      case 'trap':
        name = marker.data?.description || 'Trap';
        icon = 'warning';
        break;
      case 'storyboard':
        name = marker.data?.label || 'Story Trigger';
        icon = 'auto_stories';
        break;
      default:
        name = 'Marker';
        icon = 'place';
    }
    
    // Format marker position
    const x = Math.round(marker.x);
    const y = Math.round(marker.y);
    
    item.innerHTML = `
      <div class="marker-icon">
        <span class="material-icons">${icon}</span>
      </div>
      <div class="marker-info">
        <div class="marker-name">${name}</div>
        <div class="marker-location">x: ${x}, y: ${y}</div>
      </div>
      <div class="marker-controls">
        <span class="material-icons locate-marker" title="Locate" 
              style="color: #FFC107; font-size: 16px;">my_location</span>
        <span class="material-icons edit-marker" title="Edit" 
              style="color: #2196F3; font-size: 16px;">edit</span>
        <span class="material-icons delete-marker" title="Delete" 
              style="color: #f44336; font-size: 16px;">delete</span>
      </div>
    `;
    
    // Add event handlers
    item.querySelector('.locate-marker').addEventListener('click', e => {
      e.stopPropagation();
      this.centerOnMarker(marker);
    });
    
    item.querySelector('.edit-marker').addEventListener('click', e => {
      e.stopPropagation();
      this.editMarker(marker);
    });
    
    item.querySelector('.delete-marker').addEventListener('click', e => {
      e.stopPropagation();
      this.deleteMarker(marker);
    });
    
    // Main item click centers on marker
    item.addEventListener('click', () => {
      this.centerOnMarker(marker);
    });
    
    return item;
  }
  

centerOnMarker(marker) {
    // Calculate center position
    const canvasRect = this.editor.canvas.getBoundingClientRect();
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    // Calculate new offset to center on marker
    this.editor.offset.x = centerX - marker.x * this.editor.scale;
    this.editor.offset.y = centerY - marker.y * this.editor.scale;
    
    // Update and render
    this.editor.updateMarkerPositions();
    this.editor.render();
    
    // Highlight the marker briefly
    if (marker.element) {
      marker.element.classList.add('highlight-pulse');
      setTimeout(() => {
        marker.element.classList.remove('highlight-pulse');
      }, 1500);
    }
  }
  
  // Helper method to edit marker
  editMarker(marker) {
    // Open marker context menu using existing method
    if (typeof this.editor.showMarkerContextMenu === 'function') {
      this.editor.showMarkerContextMenu(marker, { preventDefault: () => {} });
    }
  }
  
  // Helper method to delete marker
  deleteMarker(marker) {
    // Confirm deletion
    const confirmDelete = confirm(`Delete this ${marker.type} marker?`);
    if (confirmDelete) {
      this.editor.removeMarker(marker);
      this.updateMarkersPanel();
    }
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
    if (!this.layersList) return;
    this.layersList.innerHTML = '';
    
    // Make sure we have folders initialized
    if (!this.folders) {
      this.folders = [];
    }
    
    // Pre-process folders to check visibility status
    this.folders.forEach(folder => {
      folder.anyVisible = folder.rooms.some(room => room.visible);
    });
    
    // Add folders and their contents - this is the critical part
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
    
    // Get unassigned rooms (not in any folder)
    const unassignedRooms = this.editor.rooms.filter(room =>
      !this.folders.some(folder => folder.rooms.includes(room))
    );
    
    // Add section for unassigned rooms if any exist
    if (unassignedRooms.length > 0) {
      // Only add a divider if we have folders
      if (this.folders.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'folder-divider';
        divider.style.cssText = `
          height: 1px;
          background-color: #444;
          margin: 8px 0;
        `;
        this.layersList.appendChild(divider);
      }
      
      // Add unassigned rooms section header
      const unassignedHeader = document.createElement('div');
      unassignedHeader.className = 'unassigned-header';
      unassignedHeader.style.cssText = `
        padding: 4px 8px;
        font-size: 11px;
        color: #888;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: rgba(0, 0, 0, 0.2);
      `;
      unassignedHeader.innerHTML = `
        <span>Unassigned Areas (${unassignedRooms.length})</span>
      `;
      this.layersList.appendChild(unassignedHeader);
      
      // Add unassigned rooms with improved layout
      unassignedRooms.forEach(room => {
        const roomElement = this.createLayerItem(room);
        this.layersList.appendChild(roomElement);
      });
    }
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
            folderToggle.style.transform = 'rotate(0deg)';
          } else {
            folderContent.style.display = 'none';
            folderIcon.textContent = 'folder';
            folderToggle.textContent = 'chevron_right';
            folderToggle.style.transform = 'rotate(0deg)';
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
    
    // Add classes for current state
    layerItem.className = `layer-item ${room.type}-room${room.finalized ? '' : ' editing'}${
      room.id === this.editor.selectedRoomId ? ' selected' : ''}${
      room.locked ? ' locked' : ''}`;
    
    layerItem.draggable = true;
    layerItem.dataset.roomId = room.id;
    
    // Prevent interaction if locked
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
    
    // Determine tooltip text based on room type
    const getTooltipText = (room) => {
      if (room.name === "WallTexture")
        return "Wall Texture Definition - Used for wall surfaces in 3D view";
      if (room.name === "RoomTexture")
        return "Room Texture Definition - Used for room surfaces in 3D view";
      return room.type === "wall" ? "Wall Definition" : "Room Definition";
    };
    
    // Determine icon based on room type and shape
    let icon = 'crop_square'; // Default icon
    if (room.shape === 'circle') {
      icon = 'circle';
    } else if (room.shape === 'polygon') {
      icon = 'pentagon';
    } else if (room.type === 'water') {
      icon = 'water_drop';
    }
    
    // Create thumbnail or placeholder
    const thumbnailHtml = room.thumbnail ? 
      `<img src="${room.thumbnail}" alt="Room thumbnail" style="width: 100%; height: 100%; object-fit: cover;">` :
      `<div class="thumbnail-placeholder" style="width: 100%; height: 100%; background: #333; display: flex; align-items: center; justify-content: center;">
        <span class="material-icons" style="color: #666; font-size: 20px;">${icon}</span>
      </div>`;
    
    // Build improved layer item HTML
    layerItem.innerHTML = `
      <div class="layer-content" style="display: flex; align-items: center; padding: 6px 8px; gap: 8px;">
        <!-- Left controls: visibility and lock -->
        <div class="layer-controls" style="display: flex; flex-direction: column; gap: 4px;">
          <span class="material-icons visibility-toggle" title="${room.visible ? 'Hide' : 'Show'}" 
                style="cursor: pointer; color: ${room.visible ? '#fff' : '#666'}; font-size: 16px;">
            ${room.visible ? 'visibility' : 'visibility_off'}
          </span>
          <span class="material-icons lock-toggle" title="${room.locked ? 'Unlock' : 'Lock'}" 
                style="cursor: pointer; color: ${room.locked ? '#f44336' : '#fff'}; font-size: 16px;">
            ${room.locked ? 'lock' : 'lock_open'}
          </span>
        </div>
        
        <!-- Thumbnail -->
        <div class="layer-thumbnail" style="width: 32px; height: 32px; overflow: hidden; border-radius: 2px;">
          ${thumbnailHtml}
        </div>
        
        <!-- Layer info -->
        <div class="layer-info" style="flex: 1; overflow: hidden;">
          <div class="layer-name" title="${getTooltipText(room)}" 
               style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${room.name}
          </div>
          <div class="layer-dimensions" style="font-size: 10px; color: #999;">
            ${Math.round(room.bounds.width)}×${Math.round(room.bounds.height)}
            ${room.isRaisedBlock ? ` • Height: ${room.blockHeight}` : ''}
          </div>
        </div>
        
        <!-- Right controls: edit, locate, delete -->
        <div class="layer-controls" style="display: flex; gap: 4px;">
          <span class="material-icons edit-btn" title="Edit" 
                style="color: #2196F3; cursor: pointer; font-size: 16px;">edit</span>
          <span class="material-icons locate-btn" title="Locate" 
                style="color: #FFC107; cursor: pointer; font-size: 16px;">my_location</span>
          <span class="material-icons delete-btn" title="Delete" 
                style="color: #f44336; cursor: pointer; font-size: 16px;">delete</span>
        </div>
      </div>
    `;

  // Visibility toggle
  const visibilityToggle = layerItem.querySelector('.visibility-toggle');
  visibilityToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    room.toggleVisibility();
    visibilityToggle.textContent = room.visible ? 'visibility' : 'visibility_off';
    visibilityToggle.style.color = room.visible ? '#fff' : '#666';
    visibilityToggle.title = room.visible ? 'Hide' : 'Show';
  });
  
  // Lock toggle
  const lockToggle = layerItem.querySelector('.lock-toggle');
  lockToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (room.locked) {
      room.locked = false;
      lockToggle.textContent = 'lock_open';
      lockToggle.style.color = '#fff';
      layerItem.classList.remove('locked');
      lockToggle.title = 'Lock';
    } else {
      room.locked = true;
      lockToggle.textContent = 'lock';
      lockToggle.style.color = '#f44336';
      layerItem.classList.add('locked');
      lockToggle.title = 'Unlock';
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

  // Add hover effect for highlighting room on canvas
  layerItem.addEventListener('mouseenter', () => {
    const roomElement = document.getElementById(`room-${room.id}`);
    if (roomElement) {
      roomElement.classList.add('highlighted');
      // Force reflow for polygon highlights
      if (room.shape === 'polygon') {
        roomElement.style.transform = 'translateZ(0)';
      }
    }
  });
  
  layerItem.addEventListener('mouseleave', () => {
    const roomElement = document.getElementById(`room-${room.id}`);
    if (roomElement) {
      roomElement.classList.remove('highlighted');
      // Reset transform
      if (room.shape === 'polygon') {
        roomElement.style.transform = '';
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
    
    // Highlight the room in the canvas
    const roomElement = document.getElementById(`room-${room.id}`);
    if (roomElement) {
      roomElement.classList.add('selected-in-canvas');
      
      // Remove the highlight after a delay
      setTimeout(() => {
        roomElement.classList.remove('selected-in-canvas');
      }, 1500);
    }
  });

  // Edit button
  layerItem.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (room.locked) {
      this.editor.showLockedMessage();
      return;
    }
    this.showPropertiesDialog(room);
  });

// Locate button
layerItem.querySelector('.locate-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    // Center the canvas on this room
    const canvasRect = this.editor.canvas.getBoundingClientRect();
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    const roomCenterX = room.bounds.x + room.bounds.width / 2;
    const roomCenterY = room.bounds.y + room.bounds.height / 2;
    
    this.editor.offset.x = centerX - roomCenterX * this.editor.scale;
    this.editor.offset.y = centerY - roomCenterY * this.editor.scale;
    
    this.editor.rooms.forEach(r => r.updateElement());
    this.editor.updateMarkerPositions();
    this.editor.render();
    
    // Highlight the room briefly
    const roomElement = document.getElementById(`room-${room.id}`);
    if (roomElement) {
      roomElement.classList.add('highlight-pulse');
      setTimeout(() => {
        roomElement.classList.remove('highlight-pulse');
      }, 1500);
    }
  });
  
  // Delete button
  layerItem.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (room.locked) {
      this.editor.showLockedMessage();
      return;
    }
    
    // Confirm deletion
    const confirmDelete = confirm(`Delete "${room.name}"?`);
    if (confirmDelete) {
      this.editor.deleteRoom(room);
    }
  });

  // Add double-click handler for editing
  layerItem.addEventListener('dblclick', () => {
    if (!room.locked) {
      this.showPropertiesDialog(room);
    }
  });

        return layerItem;
    }


// Updated showRenameDialog method for LayersPanel
// now the showPropertiesDialog
async showPropertiesDialog(room) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = 'Area Properties';
    
    // Force type to wall (keeping your logic)
    room.type = 'wall';
  
    const assignedTextureId = this.editor.resourceManager?.textureAssignments?.get(room.id)?.textureId;
    const wallTextures = this.editor.resourceManager?.resources.textures.walls;
    const hasTextures = wallTextures && wallTextures.size > 0;
    const currentFolder = this.folders.find(folder => folder.rooms.includes(room));
    
    // Check for legacy texture setting
    const isLegacyTexture = room.name === "WallTexture";
    
    dialog.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Name and folder in the same row -->
        <div style="display: flex; gap: 8px; align-items: flex-end;">
          <sl-input 
            id="roomNameInput" 
            value="${room.name}" 
            label="Area Name"
            style="flex: 1;"
          ></sl-input>
  
          <select 
            id="folderSelect" 
            class="native-select" 
            aria-label="Folder"
            style="width: 40%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;"
            title="Assign to folder"
          >
            <option value="">No Folder</option>
            ${this.folders.map(folder => `
              <option value="${folder.id}" ${currentFolder && currentFolder.id === folder.id ? 'selected' : ''}>${folder.name}</option>
            `).join('')}
          </select>
        </div>
        
        <!-- Accordion-style interface instead of tabs -->
        <sl-details summary="Area Type & Properties" open>
          <div style="padding: 8px 0; display: flex; flex-direction: column; gap: 12px;">
            <!-- Area Type Selection -->
            <div class="form-group">
              <label for="areaTypeSelect">Area Type</label>
              <select 
                id="areaTypeSelect" 
                class="native-select" 
                style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;"
              >
                <option value="wall" selected>Wall</option>
                <option value="water">Water Area</option>
                <option value="prop">Prop Placeholder</option>
              </select>
            </div>
            
            <!-- Wall properties with combined checkboxes -->
            <div id="wallProperties">
              <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px;">
                <sl-checkbox id="isRegularWall" 
                  ${room.isRegularWall ? 'checked' : ''}
                  ${room.blockHeight === 0 && room.type === 'wall' && !room.isRaisedBlock ? 'checked' : ''}>
                  Full Height
                </sl-checkbox>
                
                ${room.shape === 'rectangle' ? `
                  <sl-checkbox id="setAsTexture" ${isLegacyTexture ? 'checked' : ''}>
                    Legacy Texture
                  </sl-checkbox>
                ` : ''}
              </div>
              
              <sl-range 
                id="blockHeight" 
                label="Height" 
                min="0" max="20" 
                step="0.5" 
                tooltip="top" 
                value="${room.blockHeight || '0'}"
                help-text="0 = Full height wall"
                ${room.isRegularWall ? 'disabled' : ''}
              ></sl-range>
            </div>
            
            <div id="waterProperties" style="display: none;">
              <sl-range 
                id="waterDepth" 
                label="Water Depth" 
                min="0.1" max="3" 
                step="0.1" 
                tooltip="top" 
                value="${room.waterDepth || '1.0'}"
                help-text="Depth affects opacity"
              ></sl-range>
              
              <sl-color-picker 
                id="waterColor" 
                label="Water Color" 
                value="${room.waterColor || '#4488aa'}"
              ></sl-color-picker>
            </div>
            
            <div id="propProperties" style="display: none;">
              <div style="color: #666; font-size: 0.9em; margin-bottom: 8px;">
                Props are placed using the Prop tool in the toolbar.
              </div>
              
              <sl-button id="createPropBtn" size="small">
                <span slot="prefix" class="material-icons">add_circle</span>
                Create Prop at Center
              </sl-button>
            </div>
          </div>
        </sl-details>
        
<sl-details summary="Texture" ${hasTextures ? 'open' : ''}>
  <div style="max-height: 200px; overflow-y: auto; padding: 8px 0;">
    ${hasTextures ? `
      <style>
        /* Scoped styles to ensure consistency */
        .texture-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: space-between;
        }
        .texture-item {
          width: 80px;
          height: 100px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 2px solid transparent;
          border-radius: 4px;
          padding: 3px;
          cursor: pointer;
          position: relative;
        }
        .texture-item.selected {
          border-color: var(--sl-color-primary-600);
          background-color: rgba(var(--sl-color-primary-500-rgb), 0.1);
        }
        .texture-image-container {
          width: 70px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
          overflow: hidden;
        }
        .texture-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .texture-name {
          font-size: 9px;
          text-align: center;
          margin-top: 3px;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .texture-selected-icon {
          position: absolute;
          top: 0;
          right: 0;
          font-size: 12px;
          background: rgba(0,0,0,0.5);
          color: #4CAF50;
          border-radius: 50%;
          padding: 1px;
        }
      </style>
      
      <div class="texture-grid">
        ${Array.from(wallTextures.entries()).map(([id, texture]) => `
          <div class="texture-item ${assignedTextureId === id ? 'selected' : ''}" data-texture-id="${id}">
            <div class="texture-image-container">
              <img src="${texture.data}" class="texture-image" alt="${texture.name}">
            </div>
            <div class="texture-name">${texture.name}</div>
            ${assignedTextureId === id ? `
              <span class="material-icons texture-selected-icon">check_circle</span>
            ` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<p>No wall textures available</p>'}
  </div>
</sl-details>
      </div>
      
      <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="save-btn">Save</sl-button>
      </div>`;
  
    document.body.appendChild(dialog);
  
    // Show/hide property sections based on area type selection
    const areaTypeSelect = dialog.querySelector('#areaTypeSelect');
    const wallProperties = dialog.querySelector('#wallProperties');
    const waterProperties = dialog.querySelector('#waterProperties');
    const propProperties = dialog.querySelector('#propProperties');
    
    areaTypeSelect.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      
      // Hide all property sections first
      wallProperties.style.display = 'none';
      waterProperties.style.display = 'none';
      propProperties.style.display = 'none';
      
      // Show the selected property section
      if (selectedType === 'wall') {
        wallProperties.style.display = 'block';
      } else if (selectedType === 'water') {
        waterProperties.style.display = 'block';
      } else if (selectedType === 'prop') {
        propProperties.style.display = 'block';
      }
    });
    
    // Handle regular wall checkbox toggling
    const isRegularWallCheckbox = dialog.querySelector('#isRegularWall');
    const blockHeightSlider = dialog.querySelector('#blockHeight');
    
    if (isRegularWallCheckbox && blockHeightSlider) {
      isRegularWallCheckbox.addEventListener('sl-change', (e) => {
        blockHeightSlider.disabled = e.target.checked;
        if (e.target.checked) {
          blockHeightSlider.value = 0;
        }
      });
    }


    // Texture selection handler
const textureItems = dialog.querySelectorAll('.texture-item');
textureItems.forEach(item => {
  item.addEventListener('click', () => {
    // Clear previous selections
    textureItems.forEach(opt => opt.classList.remove('selected'));
    
    // Set new selection
    item.classList.add('selected');
    
    // Store selected texture ID
    dialog.selectedTextureId = item.dataset.textureId;
  });
});
    
    // Create prop button handler
    const createPropBtn = dialog.querySelector('#createPropBtn');
    if (createPropBtn) {
      createPropBtn.addEventListener('click', () => {
        const center = {
          x: room.bounds.x + room.bounds.width/2,
          y: room.bounds.y + room.bounds.height/2
        };
        
        // Use the marker system to create a prop
        this.editor.addMarker("prop", center.x, center.y);
        
        // Close the dialog
        dialog.hide();
      });
    }
  
    return new Promise((resolve) => {
      const nameInput = dialog.querySelector('#roomNameInput');
      const folderSelect = dialog.querySelector('#folderSelect');
      const setAsTextureCheckbox = dialog.querySelector('#setAsTexture');
      const saveBtn = dialog.querySelector('.save-btn');
      const cancelBtn = dialog.querySelector('.cancel-btn');
  
      const handleSave = () => {
        const newName = nameInput.value.trim();
        if (newName) {
          // Handle special texture name override
          room.name = setAsTextureCheckbox?.checked ? "WallTexture" : newName;
  
          // Update room type
          const newType = areaTypeSelect.value;
          room.type = newType;
          
          // Handle property-specific settings
          if (newType === 'wall') {
            // Wall settings - make extra sure these are properly set
            const heightValue = parseFloat(blockHeightSlider.value);
            
            // Handle regular walls vs. raised blocks
            if (isRegularWallCheckbox.checked) {
              room.isRegularWall = true;
              room.isRaisedBlock = false;
              room.blockHeight = 0;
              console.log("Setting as regular (full height) wall");
            } else {
              room.isRegularWall = false;
              room.isRaisedBlock = heightValue > 0;
              room.blockHeight = heightValue;
              console.log(`Setting as raised block with height: ${heightValue}`);
            }
            
            // Remove water properties
            delete room.waterDepth;
            delete room.waterColor;
            
            // Remove water visual style
            if (room.element) {
              room.element.classList.remove('water-area');
              room.element.style.backgroundColor = "";
              room.element.style.border = "";
            }
          } 
          else if (newType === 'water') {
            // Set BOTH the type AND the name for maximum compatibility
            room.type = 'water';
            room.isWaterArea = true;
            
            // Force the name to start with "Water" for detection
            if (!room.name.startsWith("Water")) {
              room.name = "Water " + room.name;
            }
            
            // Store water properties
            room.waterDepth = parseFloat(dialog.querySelector('#waterDepth').value);
            room.waterColor = dialog.querySelector('#waterColor').value;
            
            // Apply water styling
            if (room.element) {
              room.element.classList.add('water-area');
              
              // Convert hex to rgba for styling
              const hex = room.waterColor.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              
              room.element.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${room.waterDepth * 0.2})`;
              room.element.style.border = `1px solid rgba(${r}, ${g}, ${b}, 0.7)`;
            }
          }
  
          // Handle texture assignment
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
          } else {
            // Remove from all folders if "No Folder" selected
            this.folders.forEach(folder => {
              folder.rooms = folder.rooms.filter(r => r.id !== room.id);
            });
          }
  
          // Update visual appearance based on new type
          if (room.element) {
            room.element.classList.remove('wall-room', 'water-room');
            room.element.classList.add(`${room.type}-room`);
            
            if (room.type === 'water') {
              room.element.classList.add('water-area');
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
