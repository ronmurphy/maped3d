// js/main.js

// Utility function for map dimensions
function parseMapDimensions(filename) {
    const dimensionMatch = filename.match(/(\d+)x(\d+)/i);
    if (dimensionMatch) {
        return {
            width: parseInt(dimensionMatch[1]),
            height: parseInt(dimensionMatch[2])
        };
    }
    return null;
}

// Function to update layers list height
function updateLayersListHeight() {
    const sidebar = document.querySelector(".sidebar");
    const sidebarContent = document.querySelector(".sidebar-content");
    const layersHeader = document.querySelector(".layers-header");
    const layersList = document.querySelector("#layersList");

    if (sidebar && sidebarContent && layersHeader && layersList) {
        const toolbarsHeight = sidebarContent.offsetHeight + layersHeader.offsetHeight;
        const availableHeight = sidebar.offsetHeight - toolbarsHeight;
        layersList.style.height = `${availableHeight}px`;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Initialize layers list height
    updateLayersListHeight();
    
    // Initialize map editor
    window.mapEditor = new MapEditor();
});

// Window resize handler
window.addEventListener("resize", updateLayersListHeight);