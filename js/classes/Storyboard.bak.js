// js/classes/Storyboard.js

class Storyboard {
    constructor() {
        this.storyPoints = new Map(); // Store story trigger points {position: {x, y}, splashArt: id, text: "story text"}
        this.triggeredStories = new Set(); // Track which stories have been shown
        this.currentOverlay = null;
        this.initStyles();
    }

    initStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .story-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            .story-content {
                background: #fff;
                padding: 2rem;
                border-radius: 8px;
                max-width: 80vw;
                max-height: 80vh;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 1rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .story-content img {
                max-width: 100%;
                height: auto;
                border-radius: 4px;
            }

            .story-text {
                font-size: 1.1rem;
                line-height: 1.6;
                color: #333;
            }

            .story-overlay .close-story {
                align-self: flex-end;
                margin-top: 1rem;
            }

            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .story-content {
                    background: #2a2a2a;
                }
                
                .story-text {
                    color: #e0e0e0;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    addStoryPoint(x, y, splashArtId, text) {
        const id = `story_${Date.now()}`;
        this.storyPoints.set(id, {
            position: { x, y },
            splashArtId,
            text,
            triggered: false
        });
        return id;
    }

    checkTrigger(playerX, playerY) {
        this.storyPoints.forEach((story, id) => {
            if (!this.triggeredStories.has(id) && 
                this.isPlayerOnTrigger(playerX, playerY, story.position)) {
                this.showStoryOverlay(id);
            }
        });
    }

    showStoryOverlay(storyId) {
        const story = this.storyPoints.get(storyId);
        if (!story) return;

        const overlay = document.createElement('div');
        overlay.className = 'story-overlay';
        overlay.innerHTML = `
            <div class="story-content">
                <img src="${this.getSplashArtUrl(story.splashArtId)}" alt="Story Image">
                <div class="story-text">${story.text}</div>
                <sl-button class="close-story">Continue</sl-button>
            </div>
        `;

        overlay.querySelector('.close-story').addEventListener('click', () => {
            this.closeOverlay();
            this.triggeredStories.add(storyId);
        });

        document.body.appendChild(overlay);
        this.currentOverlay = overlay;
    }

    closeOverlay() {
        if (this.currentOverlay) {
            this.currentOverlay.remove();
            this.currentOverlay = null;
        }
    }

    isPlayerOnTrigger(playerX, playerY, triggerPos) {
        // Add some tolerance for trigger area
        const tolerance = 0.5; // Half a grid cell
        return Math.abs(playerX - triggerPos.x) <= tolerance && 
               Math.abs(playerY - triggerPos.y) <= tolerance;
    }

    getSplashArtUrl(splashArtId) {
        // This would need to interface with ResourceManager
        return window.resourceManager.getSplashArtUrl(splashArtId);
    }

    // For saving/loading story points
    serialize() {
        return {
            storyPoints: Array.from(this.storyPoints.entries()),
            triggeredStories: Array.from(this.triggeredStories)
        };
    }

    deserialize(data) {
        this.storyPoints = new Map(data.storyPoints);
        this.triggeredStories = new Set(data.triggeredStories);
    }
}