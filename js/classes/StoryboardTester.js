/**
 * StoryboardTester.js - Standalone testing system for storyboard flows
 * Allows testing narrative flows without requiring the editor interface
 */

// Add commented reference for Scene3DController integration
/**
 * REFERENCE FOR Scene3DController.js
 * Add these methods to your Scene3DController class:
 *
 * initStoryboardTesting() {
 *   // Create the tester if it doesn't exist
 *   if (!this.storyboardTester && window.storyboard) {
 *     this.storyboardTester = window.initStoryboardTester(
 *       window.storyboard,  // Global storyboard reference
 *       this,               // Scene controller reference
 *       window.resourceManager  // Global resource manager reference
 *     );
 *   }
 * }
 *
 * testStory(storyId) {
 *   if (this.storyboardTester) {
 *     this.storyboardTester.runInScene(this, storyId);
 *   }
 * }
 */

// Check if StoryboardTester already exists to prevent redeclaration
if (typeof window.StoryboardTester === "undefined") {
    window.StoryboardTester = class StoryboardTester {
        constructor(storyboardSystem, scene3D = null, resourceManager = null) {
            this.storyboard = storyboardSystem;
            this.scene3D = scene3D;
            this.resourceManager = resourceManager;
            this.currentStoryGraph = null;
            this.currentDialog = null;
            this.currentOverlay = null;
            this.useImmersiveMode = !!scene3D; // Use immersive mode if scene3D is provided

            console.log('StoryboardTester created:', {
                hasStoryboard: !!this.storyboard,
                hasScene3D: !!this.scene3D, 
                hasResourceManager: !!this.resourceManager,
                useImmersiveMode: this.useImmersiveMode
              });
        }




        // Create a new method for immersive overlays:
        /**
         * Show an immersive overlay for story content in 3D mode
         * @param {String} content - HTML content to display
         * @param {Object} options - Display options
         * @returns {HTMLElement} - The created overlay element
         */
        showImmersiveOverlay(content, options = {}) {
            // Pause controls
            if (this.scene3D && this.scene3D.pauseControls) {
                this.scene3D.pauseControls();
            }

            // Close any existing overlay
            this.closeCurrentOverlay();

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'story-overlay';
            overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

            overlay.innerHTML = `
      <div class="story-content" style="
        background: #242424;
        max-width: 800px;
        width: 80vw;
        max-height: 80vh;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        transform: scale(0.95);
        transition: transform 0.3s ease;
      ">
        ${options.title ? `
          <div class="story-header" style="
            padding: 16px;
            background: linear-gradient(135deg, #673ab7, #9c27b0);
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
          ">
            ${options.title}
          </div>
        ` : ''}
        
        <div class="story-body" style="
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: #e0e0e0;
        ">
          ${content}
        </div>
        
        ${options.showFooter !== false ? `
          <div class="story-footer" style="
            padding: 16px;
            background: #333;
            border-top: 1px solid #444;
            display: flex;
            justify-content: flex-end;
          ">
            <button class="story-continue-btn" style="
              padding: 8px 16px;
              background: #673ab7;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
            ">Continue</button>
          </div>
        ` : ''}
      </div>
    `;

            document.body.appendChild(overlay);
            this.currentOverlay = overlay;

            // // Set up continue button
            // const continueBtn = overlay.querySelector('.story-continue-btn');
            // if (continueBtn) {
            //     continueBtn.addEventListener('click', () => {
            //         this.closeCurrentOverlay();
            //         if (options.onContinue) {
            //             options.onContinue();
            //         }
            //     });
            // }

           // Set up continue button
const continueBtn = overlay.querySelector('.story-continue-btn');
if (continueBtn) {
  continueBtn.addEventListener('click', () => {
    // Store callback first
    const callback = options.onContinue;
    
    // Close overlay
    this.closeCurrentOverlay();
    
    // Call callback after a short delay
    if (callback) {
      setTimeout(() => {
        callback();
      }, 50);
    }
  });
} 

            // Animate in
            setTimeout(() => {
                overlay.style.opacity = '1';
                const content = overlay.querySelector('.story-content');
                if (content) {
                    content.style.transform = 'scale(1)';
                }
            }, 10);

            return overlay;
        }

        /**
       * Display content using either dialog or immersive overlay
       * @param {Object} options - Content options
       * @returns {HTMLElement} - The created UI element
       */
        displayContent(options) {
            // Close any existing UI
            // this.closeCurrentDialog();
            // this.closeCurrentOverlay();

            if (this.useImmersiveMode) {
                // Use immersive overlay
                return this.showImmersiveOverlay(
                    options.content,
                    {
                        title: options.title,
                        onContinue: options.onContinue,
                        showFooter: options.showFooter
                    }
                );
            } else {
                // Use dialog
                const dialog = document.createElement('sl-dialog');
                dialog.label = options.title || '';
                dialog.style.cssText = options.dialogCss || '--width: 500px;';

                // Set content with optional footer
                dialog.innerHTML = `
      <div style="padding: 16px;">${options.content}</div>
      ${options.showFooter !== false ? `
        <div slot="footer">
          <sl-button variant="primary" class="continue-btn">Continue</sl-button>
        </div>
      ` : ''}
    `;

                // Add to DOM
                document.body.appendChild(dialog);
                this.currentDialog = dialog;

                // Add continue button handler if present
                // const continueBtn = dialog.querySelector('.continue-btn');
                // if (continueBtn && options.onContinue) {
                //     continueBtn.addEventListener('click', () => {
                //         dialog.hide();
                //     });
                // }

                const continueBtn = dialog.querySelector('.continue-btn');
if (continueBtn && options.onContinue) {
  continueBtn.addEventListener('click', () => {
    // Store the callback before hiding dialog
    const callback = options.onContinue;
    
    // Hide and null out references
    this.closeCurrentDialog();
    
    // Only after dialog is hidden, call the continuation callback
    setTimeout(() => {
      callback();
    }, 50);
  });
}

                // Add close handler
                dialog.addEventListener('sl-after-hide', () => {
                    dialog.remove();
                    this.currentDialog = null;
                    if (typeof options.onContinue === 'function') {
                        options.onContinue();
                    }
                });

                // Show dialog
                dialog.show();
                // return dialog;
                // At the end of displayContent method:
console.log('Created UI:', {
    type: this.useImmersiveMode ? 'overlay' : 'dialog',
    uiElement: this.useImmersiveMode ? this.currentOverlay : this.currentDialog,
    visible: document.body.contains(this.useImmersiveMode ? this.currentOverlay : this.currentDialog)
  });
  
  return this.useImmersiveMode ? this.currentOverlay : this.currentDialog;
            }
        }

        /**
         * Begin testing a storyboard flow
         * @param {Object} storyGraph - The story graph to test, or null to use current graph from storyboard
         */
        //   startTesting(storyGraph = null) {
        //     // Use provided graph or get from storyboard
        //     this.currentStoryGraph = storyGraph || this.storyboard.currentGraph;
        //     if (!this.currentStoryGraph) {
        //       this.showTestingDialog('No storyboard available to test.', () => {});
        //       return;
        //     }

        //     // Find the starting node (look for trigger nodes first, then fall back to any node)
        //     let startNodeId = null;
        //     let startNode = null;

        //     // Look for trigger nodes first
        //     for (const [nodeId, nodeData] of this.currentStoryGraph.nodes) {
        //       if (nodeData.type === 'trigger') {
        //         startNodeId = nodeId;
        //         startNode = nodeData;
        //         break;
        //       }
        //     }

        //     // If no trigger nodes, use the first node
        //     if (!startNodeId && this.currentStoryGraph.nodes.size > 0) {
        //       const firstNode = this.currentStoryGraph.nodes.entries().next().value;
        //       startNodeId = firstNode[0];
        //       startNode = firstNode[1];
        //     }

        //     if (!startNodeId) {
        //       this.showTestingDialog('No nodes found in the storyboard.', () => {});
        //       return;
        //     }

        //     // Start executing the story from the start node
        //     this.showTestingDialog(`Starting test from: ${startNode.type} node`, () => {
        //       this.executeTestNode(startNodeId);
        //     });
        //   }

        /**
         * Begin testing a storyboard flow
         * @param {Object} storyGraph - The story graph to test, or null to use current graph from storyboard
         */
        /**
         * Begin testing a storyboard flow
         * @param {Object} storyGraph - The story graph to test, or null to use current graph from storyboard
         */
        startTesting(storyGraph = null) {
            // Use provided graph or get from storyboard
            this.currentStoryGraph = storyGraph || this.storyboard.currentGraph;
            if (!this.currentStoryGraph) {
                this.showTestingDialog('No storyboard available to test.', () => { });
                return;
            }

            console.log('Starting to test story graph');

            // Find the starting node (look for trigger nodes first, then fall back to any node)
            let startNodeId = null;
            let startNode = null;

            // Handle nodes stored as either a Map or a plain object
            const nodeEntries = this.currentStoryGraph.nodes instanceof Map
                ? Array.from(this.currentStoryGraph.nodes.entries())
                : Object.entries(this.currentStoryGraph.nodes);

            // Look for trigger nodes first
            for (const [nodeId, nodeData] of nodeEntries) {
                if (nodeData.type === 'trigger') {
                    startNodeId = nodeId;
                    startNode = nodeData;
                    break;
                }
            }

            // If no trigger nodes, use the first node
            if (!startNodeId && nodeEntries.length > 0) {
                startNodeId = nodeEntries[0][0];
                startNode = nodeEntries[0][1];
            }

            if (!startNodeId) {
                this.showTestingDialog('No nodes found in the storyboard.', () => { });
                return;
            }

            // Start executing the story from the start node
            this.showTestingDialog(`Starting test from: ${startNode.type} node`, () => {
                this.executeTestNode(startNodeId);
            });
        }

        /**
       * Get a node by ID, handling both Map and Object node structures
       * @param {String} nodeId - ID of the node to retrieve
       * @returns {Object} - The node data object or null if not found
       */
        getNode(nodeId) {
            if (!this.currentStoryGraph || !this.currentStoryGraph.nodes) return null;

            // Handle Map structure
            if (this.currentStoryGraph.nodes instanceof Map) {
                return this.currentStoryGraph.nodes.get(nodeId);
            }

            // Handle Object structure
            return this.currentStoryGraph.nodes[nodeId] || null;
        }

        /**
         * Execute a node in test mode
         */
        /**
         * Execute a node in test mode
         */
        executeTestNode(nodeId) {
            console.log(`Executing node: ${nodeId}`);
            
            // IMPORTANT CHECK: If we still have an active UI element, don't proceed yet
            if (this.currentDialog || this.currentOverlay) {
              console.log('Previous UI still active, waiting before executing next node');
              
              // Wait until current UI is closed before continuing
              const checkForClear = () => {
                if (this.currentDialog || this.currentOverlay) {
                  // Still showing UI, check again in a bit
                  setTimeout(checkForClear, 100);
                } else {
                  // UI clear, now safe to proceed
                  console.log('UI now clear, continuing to next node');
                  this._executeNodeInternal(nodeId);
                }
              };
              
              setTimeout(checkForClear, 100);
              return;
            }
            
            // No active UI, safe to proceed immediately
            this._executeNodeInternal(nodeId);
          }
          
          /**
           * Internal method to execute a node once UI is clear
           * @private
           */
          _executeNodeInternal(nodeId) {
            // Get the node data
            const nodeData = this.getNode(nodeId);
            if (!nodeData) {
              this.showTestingDialog('Error: Node not found', () => {});
              return;
            }
            
            // Process the node based on its type
            switch (nodeData.type) {
              case 'dialog':
                this.executeTestDialog(nodeData, nodeId);
                break;

                case 'choice':
                    this.executeTestChoice(nodeData, nodeId);
                    break;

                case 'condition':
                    this.executeTestCondition(nodeData, nodeId);
                    break;

                case 'event':
                    this.executeTestEvent(nodeData, nodeId);
                    break;

                case 'combat':
                    this.executeTestCombat(nodeData, nodeId);
                    break;

                case 'reward':
                    this.executeTestReward(nodeData, nodeId);
                    break;

                case 'trigger':
                    // For trigger nodes, just continue to the next connected node
                    this.findAndExecuteNextNode(nodeId);
                    break;

                default:
                    this.showTestingDialog(`Unsupported node type: ${nodeData.type}`, () => {
                        this.findAndExecuteNextNode(nodeId);
                    });
            }
        }

        /**
         * Show a simple dialog during testing
         */
        //   showTestingDialog(message, onClose) {
        //     // Close any existing UI
        //     this.closeCurrentDialog();
        //     this.closeCurrentOverlay();

        //     if (this.useImmersiveMode) {
        //       // Use immersive overlay
        //       const overlay = this.showImmersiveOverlay(`
        //         <div>${message}</div>
        //       `, {
        //         title: 'Story Preview',
        //         onContinue: onClose
        //       });
        //       return overlay;
        //     } else {
        //       // Use existing dialog code
        //       const dialog = document.createElement('sl-dialog');
        //       dialog.label = 'Story Preview';
        //       dialog.style.cssText = '--width: 500px;';

        //       // Set content
        //       dialog.innerHTML = `
        //         <div style="padding: 16px;">${message}</div>
        //         <div slot="footer">
        //           <sl-button variant="primary" class="continue-btn">Continue</sl-button>
        //         </div>
        //       `;

        //       // Add to DOM
        //       document.body.appendChild(dialog);
        //       this.currentDialog = dialog;

        //       // Add continue button handler
        //       const continueBtn = dialog.querySelector('.continue-btn');
        //       if (continueBtn) {
        //         continueBtn.addEventListener('click', () => {
        //           dialog.hide();
        //         });
        //       }

        //       // Add close handler
        //       dialog.addEventListener('sl-after-hide', () => {
        //         dialog.remove();
        //         this.currentDialog = null;
        //         if (typeof onClose === 'function') {
        //           onClose();
        //         }
        //       });

        //       // Show dialog
        //       dialog.show();
        //       return dialog;
        //     }
        //   }
        /**
         * Show a simple dialog during testing
         */
        showTestingDialog(message, onClose) {
            return this.displayContent({
                title: 'Story Preview',
                content: `<div>${message}</div>`,
                onContinue: onClose
            });
        }

        /**
         * Close the current dialog if one exists
         */
        closeCurrentDialog() {
            if (this.currentDialog) {
                this.currentDialog.hide();
                this.currentDialog = null;
            }
        }

        /**
         * Close the current overlay if one exists
         */
        closeCurrentOverlay() {
            if (this.currentOverlay) {
                // Animate out
                this.currentOverlay.style.opacity = '0';
                const content = this.currentOverlay.querySelector('.story-content');
                if (content) {
                    content.style.transform = 'scale(0.95)';
                }

                // Remove after animation
                setTimeout(() => {
                    if (document.body.contains(this.currentOverlay)) {
                        document.body.removeChild(this.currentOverlay);
                    }
                    this.currentOverlay = null;

                    // Resume controls if we have scene3D
                    if (this.scene3D && this.scene3D.resumeControls) {
                        this.scene3D.resumeControls();
                    }
                }, 300);
            }
        }

        /**
         * Test a dialog node
         */
        //   executeTestDialog(nodeData, nodeId) {
        //     // Get the dialog data
        //     const title = nodeData.data.title || 'Dialog';
        //     const text = nodeData.data.text || '';
        //     const image = nodeData.data.image;

        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = title;
        //     dialog.style.cssText = '--width: 600px;';

        //     // Create content with optional image
        //     let contentHtml = `<div style="padding: 16px;">${text}</div>`;

        //     if (image && this.resourceManager) {
        //       const imageUrl = this.getSplashArtUrl(image);
        //       if (imageUrl) {
        //         contentHtml = `
        //           <div style="padding: 16px;">
        //             <div style="margin-bottom: 16px; text-align: center;">
        //               <img src="${imageUrl}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
        //             </div>
        //             <div>${text}</div>
        //           </div>
        //         `;
        //       }
        //     }

        //     dialog.innerHTML = `
        //       ${contentHtml}
        //       <div slot="footer">
        //         <sl-button variant="primary" class="continue-btn">Continue</sl-button>
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add continue button handler
        //     const continueBtn = dialog.querySelector('.continue-btn');
        //     if (continueBtn) {
        //       continueBtn.addEventListener('click', () => {
        //         dialog.hide();
        //       });
        //     }

        //     // Add close handler
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //       // Continue to next node
        //       this.findAndExecuteNextNode(nodeId);
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test a dialog node
         */
/**
 * Test a dialog node
 */
executeTestDialog(nodeData, nodeId) {
    // Get the dialog data
    const title = nodeData.data.title || 'Dialog';
    const text = nodeData.data.text || '';
    const image = nodeData.data.image;
    
    // Create content with optional image
    let content = `<div>${text}</div>`;
    
    if (image && image.id) {
      console.log('Dialog has image reference:', image);
      let imageUrl = '';
      
      // Try to get image from the resource manager
      if (this.resourceManager && image.category && image.id) {
        // Try to get from splash art resources
        const art = this.resourceManager.resources?.splashArt?.[image.category]?.get(image.id);
        if (art && art.data) {
          imageUrl = art.data;
          console.log('Found image in resources');
        } else {
          console.log('Image not found in resources:', image);
        }
      }
      
      // If we found an image, add it to the content
      if (imageUrl) {
        content = `
          <div style="margin-bottom: 16px; text-align: center;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
          </div>
          <div>${text}</div>
        `;
      }
    }
    
    // Debug log content
    console.log('Dialog content:', { 
      title,
      hasImage: !!image,
      contentLength: content.length
    });
    
    return this.displayContent({
      title: title,
      content: content,
      dialogCss: '--width: 600px;',
      onContinue: () => {
        console.log(`Dialog node ${nodeId} completed, moving to next node`);
        this.findAndExecuteNextNode(nodeId);
      }
    });
  }

        /**
 * Force close all UI elements
 */
forceCloseAllUI() {
    console.log('Force closing all story UI elements');
    if (this.currentDialog) {
      this.closeCurrentDialog();
    }
    if (this.currentOverlay) {
      this.closeCurrentOverlay();
    }
  }

        /**
         * Test a choice node
         */
        //   executeTestChoice(nodeData, nodeId) {
        //     // Get the choice data
        //     const text = nodeData.data.text || 'What would you like to do?';
        //     const options = nodeData.data.options || [];

        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = 'Choice';
        //     dialog.style.cssText = '--width: 500px;';

        //     // Create options HTML
        //     let optionsHtml = '';
        //     if (options.length > 0) {
        //       optionsHtml = '<div class="choice-options" style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">';
        //       options.forEach((option, index) => {
        //         optionsHtml += `
        //           <sl-button class="option-btn" data-index="${index}" style="text-align: left;">
        //             ${option.text}
        //           </sl-button>
        //         `;
        //       });
        //       optionsHtml += '</div>';
        //     } else {
        //       optionsHtml = '<div style="color: #888; margin-top: 16px;">No options available</div>';
        //     }

        //     dialog.innerHTML = `
        //       <div style="padding: 16px;">
        //         <div>${text}</div>
        //         ${optionsHtml}
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add option button handlers
        //     const optionBtns = dialog.querySelectorAll('.option-btn');
        //     optionBtns.forEach(btn => {
        //       btn.addEventListener('click', () => {
        //         const index = parseInt(btn.getAttribute('data-index'));
        //         dialog.hide();

        //         // Find the next node for this option
        //         // First try explicit targetId from the option
        //         if (options[index].targetId) {
        //           this.executeTestNode(options[index].targetId);
        //           return;
        //         }

        //         // If no explicit targetId, find connections by option index
        //         const connections = this.currentStoryGraph.connections.filter(c => c.from === nodeId);

        //         if (connections.length > index) {
        //           this.executeTestNode(connections[index].to);
        //         } else if (connections.length > 0) {
        //           // Fall back to the first connection
        //           this.executeTestNode(connections[0].to);
        //         } else {
        //           this.showTestingDialog('End of story branch reached.', () => {});
        //         }
        //       });
        //     });

        //     // Add close handler for manually closing
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test a choice node
         */
        executeTestChoice(nodeData, nodeId) {
            // Get the choice data
            const text = nodeData.data.text || 'What would you like to do?';
            const options = nodeData.data.options || [];

            // Create options HTML
            let optionsHtml = '';
            if (options.length > 0) {
                optionsHtml = '<div class="choice-options" style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">';
                options.forEach((option, index) => {
                    optionsHtml += `
          <button class="option-btn" data-index="${index}" style="
            padding: 10px 16px;
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            text-align: left;
            cursor: pointer;
            margin-bottom: 4px;
            transition: background 0.2s;
          ">
            ${option.text}
          </button>
        `;
                });
                optionsHtml += '</div>';
            } else {
                optionsHtml = '<div style="color: #888; margin-top: 16px;">No options available</div>';
            }

            // Create content
            const content = `
      <div>${text}</div>
      ${optionsHtml}
    `;

            const ui = this.displayContent({
                title: 'Choice',
                content: content,
                showFooter: false
            });

            // Add option button handlers
            const optionBtns = ui.querySelectorAll('.option-btn');
            optionBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.getAttribute('data-index'));

                    if (this.useImmersiveMode) {
                        this.closeCurrentOverlay();
                    } else {
                        this.closeCurrentDialog();
                    }

                    // Find the next node for this option
                    // First try explicit targetId from the option
                    if (options[index].targetId) {
                        this.executeTestNode(options[index].targetId);
                        return;
                    }

                    // If no explicit targetId, find connections by option index
                    const connections = this.currentStoryGraph.connections.filter(c => c.from === nodeId);

                    if (connections.length > index) {
                        this.executeTestNode(connections[index].to);
                    } else if (connections.length > 0) {
                        // Fall back to the first connection
                        this.executeTestNode(connections[0].to);
                    } else {
                        this.showTestingDialog('End of story branch reached.', () => { });
                    }
                });
            });

            return ui;
        }

        /**
         * Test a condition node
         */
        //   executeTestCondition(nodeData, nodeId) {
        //     // Get the condition data
        //     const conditionType = nodeData.data.condition || 'unknown';
        //     let conditionText = '';

        //     switch (conditionType) {
        //       case 'hasMonster':
        //         conditionText = `Check if player has monster: ${nodeData.data.params?.monsterName || 'Unknown monster'}`;
        //         break;
        //       case 'hasItem':
        //         conditionText = `Check if player has item: ${nodeData.data.params?.itemName || 'Unknown item'} (Quantity: ${nodeData.data.params?.quantity || 1})`;
        //         break;
        //       case 'hasFlag':
        //         conditionText = `Check if game flag "${nodeData.data.params?.flag || 'Unknown'}" is ${nodeData.data.params?.value ? 'true' : 'false'}`;
        //         break;
        //       case 'monsterLevel':
        //         conditionText = `Check if monster ${nodeData.data.params?.monsterName || 'Unknown'} level is at least ${nodeData.data.params?.level || 1}`;
        //         break;
        //       default:
        //         conditionText = `Condition: ${conditionType}`;
        //     }

        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = 'Condition Check';
        //     dialog.style.cssText = '--width: 500px;';

        //     dialog.innerHTML = `
        //       <div style="padding: 16px;">
        //         <div style="font-weight: bold; margin-bottom: 8px;">Testing condition:</div>
        //         <div style="padding: 8px; background: #333; border-radius: 4px;">
        //           ${conditionText}
        //         </div>

        //         <div style="margin-top: 16px; font-style: italic; color: #aaa;">
        //           For testing purposes, choose which path to follow:
        //         </div>

        //         <div style="display: flex; gap: 8px; margin-top: 12px;">
        //           <sl-button class="true-btn" variant="primary" style="--sl-color-primary-600: #2196F3;">
        //             <span style="display: inline-block; width: 10px; height: 10px; background: #2196F3; border-radius: 50%; margin-right: 8px;"></span>
        //             True Path
        //           </sl-button>

        //           <sl-button class="false-btn" variant="primary" style="--sl-color-primary-600: #F44336;">
        //             <span style="display: inline-block; width: 10px; height: 10px; background: #F44336; border-radius: 50%; margin-right: 8px;"></span>
        //             False Path
        //           </sl-button>
        //         </div>
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add button handlers
        //     const trueBtn = dialog.querySelector('.true-btn');
        //     const falseBtn = dialog.querySelector('.false-btn');

        //     if (trueBtn) {
        //       trueBtn.addEventListener('click', () => {
        //         dialog.hide();
        //         this.followConditionPath(nodeId, true);
        //       });
        //     }

        //     if (falseBtn) {
        //       falseBtn.addEventListener('click', () => {
        //         dialog.hide();
        //         this.followConditionPath(nodeId, false);
        //       });
        //     }

        //     // Add close handler for manually closing
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test a condition node
         */
        executeTestCondition(nodeData, nodeId) {
            // Get the condition data
            const conditionType = nodeData.data.condition || 'unknown';
            let conditionText = '';

            switch (conditionType) {
                case 'hasMonster':
                    conditionText = `Check if player has monster: ${nodeData.data.params?.monsterName || 'Unknown monster'}`;
                    break;
                case 'hasItem':
                    conditionText = `Check if player has item: ${nodeData.data.params?.itemName || 'Unknown item'} (Quantity: ${nodeData.data.params?.quantity || 1})`;
                    break;
                case 'hasFlag':
                    conditionText = `Check if game flag "${nodeData.data.params?.flag || 'Unknown'}" is ${nodeData.data.params?.value ? 'true' : 'false'}`;
                    break;
                case 'monsterLevel':
                    conditionText = `Check if monster ${nodeData.data.params?.monsterName || 'Unknown'} level is at least ${nodeData.data.params?.level || 1}`;
                    break;
                default:
                    conditionText = `Condition: ${conditionType}`;
            }

            // Create content
            const content = `
      <div style="font-weight: bold; margin-bottom: 8px;">Testing condition:</div>
      <div style="padding: 8px; background: #333; border-radius: 4px;">
        ${conditionText}
      </div>
      
      <div style="margin-top: 16px; font-style: italic; color: #aaa;">
        For testing purposes, choose which path to follow:
      </div>
      
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="true-btn" style="
          padding: 8px 16px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">
          <span style="display: inline-block; width: 10px; height: 10px; background: #2196F3; border-radius: 50%; margin-right: 8px;"></span>
          True Path
        </button>
        
        <button class="false-btn" style="
          padding: 8px 16px;
          background: #F44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">
          <span style="display: inline-block; width: 10px; height: 10px; background: #F44336; border-radius: 50%; margin-right: 8px;"></span>
          False Path
        </button>
      </div>
    `;

            const ui = this.displayContent({
                title: 'Condition Check',
                content: content,
                showFooter: false
            });

            // Add button handlers
            const trueBtn = ui.querySelector('.true-btn');
            const falseBtn = ui.querySelector('.false-btn');

            if (trueBtn) {
                trueBtn.addEventListener('click', () => {
                    if (this.useImmersiveMode) {
                        this.closeCurrentOverlay();
                    } else {
                        this.closeCurrentDialog();
                    }
                    this.followConditionPath(nodeId, true);
                });
            }

            if (falseBtn) {
                falseBtn.addEventListener('click', () => {
                    if (this.useImmersiveMode) {
                        this.closeCurrentOverlay();
                    } else {
                        this.closeCurrentDialog();
                    }
                    this.followConditionPath(nodeId, false);
                });
            }

            return ui;
        }

        /**
         * Follow a specific condition path
         */
        followConditionPath(nodeId, isTrue) {
            // Find connection with matching path attribute
            const connections = this.currentStoryGraph.connections.filter(c => c.from === nodeId);

            // Find connection with matching path type
            const pathToFollow = isTrue ? 'true' : 'false';
            const matchingConnection = connections.find(c => c.path === pathToFollow);

            if (matchingConnection) {
                // Follow the matching path
                this.executeTestNode(matchingConnection.to);
            } else if (connections.length > 0) {
                // Fallback: If we can't find a connection with exact path match, use first (true) for true result, 
                // second (false) for false result
                const connectionIndex = isTrue ? 0 : Math.min(1, connections.length - 1);
                this.executeTestNode(connections[connectionIndex].to);
            } else {
                this.showTestingDialog('End of story branch reached.', () => { });
            }
        }

        /**
         * Test an event node
         */
        //   executeTestEvent(nodeData, nodeId) {
        //     // Get the event data
        //     const eventType = nodeData.data.eventType || 'unknown';
        //     let eventText = '';
        //     let imageHtml = '';

        //     switch (eventType) {
        //       case 'offerStarter':
        //         eventText = 'Offer starter monster to the player';
        //         imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🐲</div>';
        //         break;
        //       case 'showPartyManager':
        //         eventText = 'Show the party manager to the player';
        //         imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">📋</div>';
        //         break;
        //       case 'giveItem':
        //         const itemName = nodeData.data.params?.itemName || 'Unknown item';
        //         const quantity = nodeData.data.params?.quantity || 1;
        //         eventText = `Give item to player: ${itemName} (Quantity: ${quantity})`;

        //         // Try to get item image
        //         if (nodeData.data.params?.itemId && this.resourceManager) {
        //           const item = this.resourceManager.resources.textures.props.get(nodeData.data.params.itemId);
        //           if (item && item.thumbnail) {
        //             imageHtml = `
        //               <div style="text-align: center; margin: 20px 0;">
        //                 <img src="${item.thumbnail}" style="max-width: 100px; max-height: 100px; border: 2px solid #444; border-radius: 8px; padding: 4px;">
        //               </div>
        //             `;
        //           }
        //         }

        //         if (!imageHtml) {
        //           imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🎁</div>';
        //         }
        //         break;
        //       case 'setFlag':
        //         const flag = nodeData.data.params?.flag || 'Unknown flag';
        //         const value = nodeData.data.params?.value ? 'true' : 'false';
        //         eventText = `Set game flag: ${flag} = ${value}`;
        //         imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🚩</div>';
        //         break;
        //       case 'teleport':
        //         const x = nodeData.data.params?.x || 0;
        //         const y = nodeData.data.params?.y || 0;
        //         const z = nodeData.data.params?.z || 0;
        //         eventText = `Teleport player to position: X=${x}, Y=${y}, Z=${z}`;
        //         imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">✨</div>';
        //         break;
        //       default:
        //         eventText = `Event: ${eventType}`;
        //     }

        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = 'Game Event';
        //     dialog.style.cssText = '--width: 500px;';

        //     dialog.innerHTML = `
        //       <div style="padding: 16px;">
        //         ${imageHtml}
        //         <div style="font-weight: bold; margin-bottom: 8px;">Event triggered:</div>
        //         <div style="padding: 8px; background: #333; border-radius: 4px;">
        //           ${eventText}
        //         </div>
        //       </div>
        //       <div slot="footer">
        //         <sl-button variant="primary" class="continue-btn">Continue</sl-button>
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add continue button handler
        //     const continueBtn = dialog.querySelector('.continue-btn');
        //     if (continueBtn) {
        //       continueBtn.addEventListener('click', () => {
        //         dialog.hide();
        //       });
        //     }

        //     // Add close handler
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //       // Continue to next node
        //       this.findAndExecuteNextNode(nodeId);
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test an event node
         */
        executeTestEvent(nodeData, nodeId) {
            // Get the event data
            const eventType = nodeData.data.eventType || 'unknown';
            let eventText = '';
            let imageHtml = '';

            switch (eventType) {
                case 'offerStarter':
                    eventText = 'Offer starter monster to the player';
                    imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🐲</div>';
                    break;
                case 'showPartyManager':
                    eventText = 'Show the party manager to the player';
                    imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">📋</div>';
                    break;
                case 'giveItem':
                    const itemName = nodeData.data.params?.itemName || 'Unknown item';
                    const quantity = nodeData.data.params?.quantity || 1;
                    eventText = `Give item to player: ${itemName} (Quantity: ${quantity})`;

                    // Try to get item image
                    if (nodeData.data.params?.itemId && this.resourceManager) {
                        const item = this.resourceManager.resources.textures.props.get(nodeData.data.params.itemId);
                        if (item && item.thumbnail) {
                            imageHtml = `
              <div style="text-align: center; margin: 20px 0;">
                <img src="${item.thumbnail}" style="max-width: 100px; max-height: 100px; border: 2px solid #444; border-radius: 8px; padding: 4px;">
              </div>
            `;
                        }
                    }

                    if (!imageHtml) {
                        imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🎁</div>';
                    }
                    break;
                case 'setFlag':
                    const flag = nodeData.data.params?.flag || 'Unknown flag';
                    const value = nodeData.data.params?.value ? 'true' : 'false';
                    eventText = `Set game flag: ${flag} = ${value}`;
                    imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">🚩</div>';
                    break;
                case 'teleport':
                    const x = nodeData.data.params?.x || 0;
                    const y = nodeData.data.params?.y || 0;
                    const z = nodeData.data.params?.z || 0;
                    eventText = `Teleport player to position: X=${x}, Y=${y}, Z=${z}`;
                    imageHtml = '<div style="font-size: 48px; text-align: center; margin: 20px 0; color: #673ab7;">✨</div>';
                    break;
                default:
                    eventText = `Event: ${eventType}`;
            }

            // Create content
            const content = `
      ${imageHtml}
      <div style="font-weight: bold; margin-bottom: 8px;">Event triggered:</div>
      <div style="padding: 8px; background: #333; border-radius: 4px;">
        ${eventText}
      </div>
    `;

            return this.displayContent({
                title: 'Game Event',
                content: content,
                onContinue: () => this.findAndExecuteNextNode(nodeId)
            });
        }

        /**
         * Test a combat node
         */
        //   executeTestCombat(nodeData, nodeId) {
        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = 'Combat Encounter';
        //     dialog.style.cssText = '--width: 500px;';

        //     dialog.innerHTML = `
        //       <div style="padding: 16px;">
        //         <div style="font-size: 48px; text-align: center; margin: 20px 0; color: #F44336;">⚔️</div>

        //         <div style="font-weight: bold; margin-bottom: 8px;">Combat encountered:</div>
        //         <div style="padding: 8px; background: #333; border-radius: 4px;">
        //           ${nodeData.data.enemies?.length || 0} enemies
        //         </div>

        //         <div style="margin-top: 16px; font-style: italic; color: #aaa;">
        //           For testing purposes, choose battle outcome:
        //         </div>

        //         <div style="display: flex; gap: 8px; margin-top: 12px;">
        //           <sl-button class="victory-btn" variant="success">
        //             Victory
        //           </sl-button>

        //           <sl-button class="defeat-btn" variant="danger">
        //             Defeat
        //           </sl-button>
        //         </div>
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add button handlers
        //     const victoryBtn = dialog.querySelector('.victory-btn');
        //     const defeatBtn = dialog.querySelector('.defeat-btn');

        //     if (victoryBtn) {
        //       victoryBtn.addEventListener('click', () => {
        //         dialog.hide();
        //         this.followCombatPath(nodeId, true);
        //       });
        //     }

        //     if (defeatBtn) {
        //       defeatBtn.addEventListener('click', () => {
        //         dialog.hide();
        //         this.followCombatPath(nodeId, false);
        //       });
        //     }

        //     // Add close handler for manually closing
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test a combat node
         */
        executeTestCombat(nodeData, nodeId) {
            // Create content
            const content = `
      <div style="font-size: 48px; text-align: center; margin: 20px 0; color: #F44336;">⚔️</div>
      
      <div style="font-weight: bold; margin-bottom: 8px;">Combat encountered:</div>
      <div style="padding: 8px; background: #333; border-radius: 4px;">
        ${nodeData.data.enemies?.length || 0} enemies
      </div>
      
      <div style="margin-top: 16px; font-style: italic; color: #aaa;">
        For testing purposes, choose battle outcome:
      </div>
      
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="victory-btn" style="
          padding: 8px 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">
          Victory
        </button>
        
        <button class="defeat-btn" style="
          padding: 8px 16px;
          background: #F44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">
          Defeat
        </button>
      </div>
    `;

            const ui = this.displayContent({
                title: 'Combat Encounter',
                content: content,
                showFooter: false
            });

            // Add button handlers
            const victoryBtn = ui.querySelector('.victory-btn');
            const defeatBtn = ui.querySelector('.defeat-btn');

            if (victoryBtn) {
                victoryBtn.addEventListener('click', () => {
                    if (this.useImmersiveMode) {
                        this.closeCurrentOverlay();
                    } else {
                        this.closeCurrentDialog();
                    }
                    this.followCombatPath(nodeId, true);
                });
            }

            if (defeatBtn) {
                defeatBtn.addEventListener('click', () => {
                    if (this.useImmersiveMode) {
                        this.closeCurrentOverlay();
                    } else {
                        this.closeCurrentDialog();
                    }
                    this.followCombatPath(nodeId, false);
                });
            }

            return ui;
        }

        /**
         * Follow a specific combat outcome path
         */
        followCombatPath(nodeId, isVictory) {
            // Find connection with matching path attribute
            const connections = this.currentStoryGraph.connections.filter(c => c.from === nodeId);

            // Find connection with matching path type
            const pathToFollow = isVictory ? 'victory' : 'defeat';
            const matchingConnection = connections.find(c => c.path === pathToFollow);

            if (matchingConnection) {
                // Follow the matching path
                this.executeTestNode(matchingConnection.to);
            } else if (connections.length > 0) {
                // Fallback: Use first for victory, second for defeat
                const connectionIndex = isVictory ? 0 : Math.min(1, connections.length - 1);
                this.executeTestNode(connections[connectionIndex].to);
            } else {
                this.showTestingDialog('End of story branch reached.', () => { });
            }
        }

        /**
         * Test a reward node
         */
        //   executeTestReward(nodeData, nodeId) {
        //     // Close any existing dialog
        //     this.closeCurrentDialog();

        //     // Create dialog
        //     const dialog = document.createElement('sl-dialog');
        //     dialog.label = 'Rewards';
        //     dialog.style.cssText = '--width: 500px;';

        //     dialog.innerHTML = `
        //       <div style="padding: 16px;">
        //         <div style="font-size: 48px; text-align: center; margin: 20px 0; color: #FFD700;">🏆</div>

        //         <div style="font-weight: bold; margin-bottom: 8px;">Rewards received:</div>
        //         <div style="padding: 8px; background: #333; border-radius: 4px;">
        //           <div>Items: ${nodeData.data.items?.length || 0}</div>
        //           <div>Experience: ${nodeData.data.experience || 0}</div>
        //         </div>
        //       </div>
        //       <div slot="footer">
        //         <sl-button variant="primary" class="continue-btn">Continue</sl-button>
        //       </div>
        //     `;

        //     // Add to DOM
        //     document.body.appendChild(dialog);
        //     this.currentDialog = dialog;

        //     // Add continue button handler
        //     const continueBtn = dialog.querySelector('.continue-btn');
        //     if (continueBtn) {
        //       continueBtn.addEventListener('click', () => {
        //         dialog.hide();
        //       });
        //     }

        //     // Add close handler
        //     dialog.addEventListener('sl-after-hide', () => {
        //       dialog.remove();
        //       this.currentDialog = null;
        //       // Continue to next node
        //       this.findAndExecuteNextNode(nodeId);
        //     });

        //     // Show dialog
        //     dialog.show();
        //   }

        /**
         * Test a reward node
         */
        executeTestReward(nodeData, nodeId) {
            // Create reward item list if there are items
            let itemsList = '';
            if (nodeData.data.items && nodeData.data.items.length > 0) {
                itemsList = '<div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">';

                nodeData.data.items.forEach(item => {
                    let itemImage = '';

                    // Try to get item image
                    if (item.id && this.resourceManager) {
                        const itemResource = this.resourceManager.resources.textures.props.get(item.id);
                        if (itemResource && itemResource.thumbnail) {
                            itemImage = `
              <div style="width: 32px; height: 32px; margin-right: 8px; overflow: hidden; border-radius: 4px;">
                <img src="${itemResource.thumbnail}" style="width: 100%; height: 100%; object-fit: contain;">
              </div>
            `;
                        }
                    }

                    itemsList += `
          <div style="display: flex; align-items: center; background: #333; padding: 6px; border-radius: 4px;">
            ${itemImage || '<div style="width: 32px; height: 32px; margin-right: 8px; background: #555; border-radius: 4px;"></div>'}
            <div>
              <div>${item.name}</div>
              <div style="font-size: 0.8em; color: #aaa;">Quantity: ${item.quantity}</div>
            </div>
          </div>
        `;
                });

                itemsList += '</div>';
            }

            // Create content
            const content = `
      <div style="font-size: 48px; text-align: center; margin: 20px 0; color: #FFD700;">🏆</div>
      
      <div style="font-weight: bold; margin-bottom: 8px;">Rewards received:</div>
      <div style="padding: 8px; background: #333; border-radius: 4px;">
        <div>Experience: ${nodeData.data.experience || 0}</div>
        <div style="margin-top: 4px;">Items: ${nodeData.data.items?.length || 0}</div>
        ${itemsList}
      </div>
    `;

            return this.displayContent({
                title: 'Rewards',
                content: content,
                onContinue: () => this.findAndExecuteNextNode(nodeId)
            });
        }

        /**
         * Find and execute the next node in sequence
         */

        findAndExecuteNextNode(currentNodeId) {
            // Find outgoing connections
            const connections = this.currentStoryGraph.connections.filter(c => c.from === currentNodeId);

            if (connections.length > 0) {
                // Follow the first connection
                this.executeTestNode(connections[0].to);
            } else {
                // End of story
                this.showTestingDialog('End of story reached.', () => { });
            }
        }

        /**
         * Helper method to get splash art URL
         */
/**
 * Helper method to get splash art URL
 */
getSplashArtUrl(imageData) {
    if (!imageData || !imageData.id) return "";
    
    console.log('Getting splash art URL for:', imageData);
    
    try {
      // Try to get from resourceManager
      if (this.resourceManager && this.resourceManager.resources && 
          this.resourceManager.resources.splashArt && 
          imageData.category && 
          this.resourceManager.resources.splashArt[imageData.category]) {
        
        const art = this.resourceManager.resources.splashArt[imageData.category].get(imageData.id);
        console.log('Found art resource:', art);
        
        if (art) {
          // Use data or thumbnail, whichever is available
          return art.data || art.thumbnail || "";
        }
      }
      
      console.log('Art not found in resourceManager');
      return "";
    } catch (error) {
      console.error("Error getting splash art URL:", error);
      return "";
    }
  }

        /**
         * Run the tester in a 3D environment without the editor
         * @param {Object} scene3D - The Three.js scene controller
         * @param {String} storyId - ID of the story to test (optional)
         */
        runInScene(scene3D, storyId = null) {
            // Store scene reference
            this.scene3D = scene3D;

            // Get story data
            let storyGraph = null;
            if (storyId && this.storyboard.storyGraphs.has(storyId)) {
                storyGraph = this.storyboard.storyGraphs.get(storyId);
            } else if (this.storyboard.currentGraph) {
                storyGraph = this.storyboard.currentGraph;
            }

            if (!storyGraph) {
                console.error('No valid story found to test');
                return;
            }

            // Begin testing with this story graph
            this.startTesting(storyGraph);
        }

        /**
         * Determines if a connection is from a condition node
         * @param {HTMLElement} fromNode - The source node element
         * @param {String} pathType - The path type attribute value ("true" or "false")
         * @returns {Boolean} - Whether this is a condition-type connection
         */
        isConditionConnection(fromNode, pathType) {
            if (!fromNode) return false;

            // Check if the source node is a condition node
            const fromNodeType = fromNode.getAttribute("data-type");

            // It's a condition connection if:
            // 1. The node is of type 'condition'
            // 2. The path type is either 'true' or 'false'
            return fromNodeType === "condition" &&
                pathType &&
                (pathType === "true" || pathType === "false");
        }
        // isConditionConnection(fromNode, pathType) {
        //     if (!fromNode) return false;

        //     // Check if the source node is a condition node
        //     const fromNodeType = fromNode.getAttribute("data-type");

        //     // It's a condition connection if:
        //     // 1. The node is of type 'condition'
        //     // 2. The path type is either 'true' or 'false'
        //     return fromNodeType === "condition" && 
        //            pathType && 
        //            (pathType === "true" || pathType === "false");
        //   }
        // }



    }


    // Create global initializer
    window.initStoryboardTester = (storyboardSystem, scene3D = null, resourceManager = null) => {
        window.storyboardTester = new window.StoryboardTester(storyboardSystem, scene3D, resourceManager);
        return window.storyboardTester;
    };
}
