// Description: This class is responsible for handling the physics of the player in the 3D scene.
class PhysicsController {
    constructor(scene3D) {
        this.scene3D = scene3D;
        this.playerHeight = 1.7;
        this.currentGroundHeight = 0;
        this.stepHeight = 0.5;
        this.halfBlockSize = 0.5;
        this.debug = false; // Set to true to enable debug logs
        this.fallSpeed = 0.03; // Speed of falling
        this.isFalling = false;
        this.insideRoomWall = false;

        this.isJumping = false;
        this.jumpHeight = 1.7; // Maximum jump height - slightly higher than 1 block
        this.jumpSpeed = 0.09; // Initial upward velocity - increased for higher jumps
        this.jumpVelocity = 0;
        this.gravity = 0.004; // Gravity pulling player down
        this.jumpStartHeight = 0; // Track where jump started from
        this.lastJumpCheck = 0; // Track last time we checked for landing surfaces
        this.jumpCheckInterval = 5; // Check every 5 frames
        this.jumpFrameCount = 0; // Frame counter for jump checks

this.onTopOfWall = false;        // Flag for walking on top of a wall
this.wallTopHeight = 0;
    }

    
    checkCollision(direction, speed) {
        const collision = this.checkForwardCollision(direction, speed);

        if (collision.canMove) {
            // If jumping or falling, allow horizontal movement without height changes
            if (this.isJumping || this.isFalling) {
                return true;
            }
            
            // Normal ground movement with step detection
            return this.updatePlayerHeight(direction, speed);
        }

        // When jumping, allow moving slightly closer to walls
        if (this.isJumping || this.isFalling) {
            // Adjust collision distance during jumps to allow getting closer to edges
            const distanceToWall = collision.distance || 0;
            if (distanceToWall > 0.2) {
                return true;
            }
        }

        // Check if we hit a half block we can step onto (only when not jumping/falling)
        if (!this.isJumping && !this.isFalling) {
            const hitObject = collision.hitObject;
            if (hitObject?.userData?.isWall && hitObject?.userData?.blockHeight > 0) {
                const blockHeight = hitObject.userData.blockHeight;
                const heightDiff = blockHeight - this.currentGroundHeight;

                // Can only step up one half-block at a time
                if (heightDiff === this.stepHeight) {
                    this.currentGroundHeight = blockHeight;
                    return true;
                }
            }
        }

        return false;
    }


    // checkForwardCollision(direction, speed) {

    //     if (this.insideRoomWall) {
    //         return {
    //             canMove: true,
    //             hitObject: null
    //         };
    //     }

    //     const groundPosition = new THREE.Vector3(
    //         this.scene3D.camera.position.x,
    //         this.currentGroundHeight + 0.1,
    //         this.scene3D.camera.position.z
    //     );
    
    //     const raycaster = new THREE.Raycaster(
    //         groundPosition,
    //         direction,
    //         0,
    //         speed + 0.5
    //     );
    
    //     const intersects = raycaster.intersectObjects(
    //         this.scene3D.scene.children.filter(obj => obj.userData?.isWall)
    //     );
    
    //     if (intersects.length > 0) {
    //         const hitObject = intersects[0].object;
            
    //         // If it's a half block
    //         if (hitObject.userData.isRaisedBlock && hitObject.userData.blockHeight > 0) {
    //             const heightDiff = hitObject.userData.blockHeight - this.currentGroundHeight;
    //             // Allow stepping if height difference is manageable
    //             return {
    //                 canMove: heightDiff <= this.stepHeight,
    //                 hitObject: hitObject
    //             };
    //         }
            
    //         // Regular wall - no passing
    //         return {
    //             canMove: false,
    //             hitObject: hitObject
    //         };
    //     }
    
    //     // No collision
    //     return {
    //         canMove: true,
    //         hitObject: null
    //     };
    // }


    checkForwardCollision(direction, speed) {
        const playerPos = this.scene3D.camera.position;
        
        // Calculate player's feet position
        const playerFeetY = playerPos.y - this.playerHeight;
        
        // First, check if we're on top of a wall
        // We're on top if our feet are at the top height of the wall
        if (this.onTopOfWall) {
            // When on top of a wall, we still want collision detection
            // but we need to ensure the player doesn't fall through
            
            // Check if we're about to walk off the edge
            const nextPos = new THREE.Vector3(
                playerPos.x + direction.x * speed,
                playerPos.y,
                playerPos.z + direction.z * speed
            );
            
            // Cast a ray downward from the next position
            const downRay = new THREE.Raycaster(
                nextPos,
                new THREE.Vector3(0, -1, 0),
                0,
                2  // Check a reasonable distance below
            );
            
            const downHits = downRay.intersectObjects(
                this.scene3D.scene.children.filter(obj => obj.userData?.isWall)
            );
            
            // If we didn't hit anything, we're about to walk off the edge
            // Or if we hit something that's too far below our current height
            if (downHits.length === 0 || 
                Math.abs(downHits[0].point.y - this.wallTopHeight) > 0.1) {
                console.log("Would walk off edge of wall");
                return {
                    canMove: false,
                    hitObject: null
                };
            }
        }
        
        // If we're inside a room wall (not on top), allow free movement
        if (this.insideRoomWall && !this.onTopOfWall) {
            return {
                canMove: true,
                hitObject: null
            };
        }
    
        // Regular collision detection for walls
        const groundPosition = new THREE.Vector3(
            playerPos.x,
            this.currentGroundHeight + 0.1,
            playerPos.z
        );
    
        const raycaster = new THREE.Raycaster(
            groundPosition,
            direction,
            0,
            speed + 0.5
        );
    
        const intersects = raycaster.intersectObjects(
            this.scene3D.scene.children.filter(obj => obj.userData?.isWall)
        );
    
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            
            // If it's a half block
            if (hitObject.userData.isRaisedBlock && hitObject.userData.blockHeight > 0) {
                const heightDiff = hitObject.userData.blockHeight - this.currentGroundHeight;
                // Allow stepping if height difference is manageable
                return {
                    canMove: heightDiff <= this.stepHeight,
                    hitObject: hitObject
                };
            }
            
            // Regular wall - no passing
            return {
                canMove: false,
                hitObject: hitObject
            };
        }
    
        // No collision
        return {
            canMove: true,
            hitObject: null
        };
    }


    checkWalkingSurface() {
        const playerPos = this.scene3D.camera.position;
        
        // Calculate player's feet position
        const playerFeetY = playerPos.y - this.playerHeight;
        
        // Cast ray downward to see what we're standing on
        const downRay = new THREE.Raycaster(
            playerPos,
            new THREE.Vector3(0, -1, 0),
            0,
            this.playerHeight + 0.2  // Check slightly beyond feet
        );
        
        const wallHits = downRay.intersectObjects(
            this.scene3D.scene.children.filter(obj => obj.userData?.isWall)
        );
        
        if (wallHits.length > 0) {
            const hit = wallHits[0];
            const hitY = hit.point.y;
            const wallHeight = this.scene3D.boxHeight || 4;
            
            // Check if we're standing on top of a wall (feet at wall height)
            if (Math.abs(playerFeetY - wallHeight) < 0.2) {
                this.onTopOfWall = true;
                this.wallTopHeight = wallHeight;
                console.log("On top of wall at height", wallHeight);
                return;
            }
            
            // Check if we're inside a wall (not at the top)
            const hitObject = hit.object;
            if (hitObject.userData?.isWall) {
                // If our head is below wall top, we're inside
                if (playerPos.y < wallHeight - 0.2) {
                    this.insideRoomWall = true;
                    this.onTopOfWall = false;
                    console.log("Inside wall room");
                    return;
                }
            }
        }
        
        // If we got here, we're not on top of or inside a wall
        this.onTopOfWall = false;
        this.insideRoomWall = false;
    }

    // updateGroundHeightAtPosition(x, z) {
    //     // Get elevation at new position
    //     const downRay = new THREE.Raycaster(
    //       new THREE.Vector3(x, this.currentGroundHeight + 2, z),
    //       new THREE.Vector3(0, -1, 0),
    //       0,
    //       4
    //     );
      
    //     const intersectsDown = downRay.intersectObjects(
    //       this.scene3D.scene.children.filter(obj =>
    //         obj.userData?.isWall ||
    //         obj.userData?.isRegularWall ||
    //         obj.userData?.blockHeight !== undefined
    //       )
    //     );
      
    //     if (intersectsDown.length > 0) {
    //       const hitObject = intersectsDown[0].object;
    //       let groundHeight;
      
    //       // Handle different surface types
    //       if (hitObject.userData?.isRegularWall) {
    //         const wallHeight = this.scene3D.boxHeight || 4;
            
    //         // If we're at or near wall height, snap to it
    //         if (Math.abs(this.currentGroundHeight - wallHeight) < 0.3) {
    //           groundHeight = wallHeight;
    //         } else {
    //           groundHeight = 0; // Default case - not on top of wall
    //         }
    //       }
    //       else if (this.currentGroundHeight >= 4.0 && 
    //                hitObject.userData?.isWall && 
    //                hitObject.userData?.blockHeight === 0) {
    //         groundHeight = 4.0; // Keep height at wall level
    //       } else {
    //         groundHeight = hitObject.userData?.blockHeight ?? 0;
    //       }
      
    //       // Update the ground height
    //       this.currentGroundHeight = groundHeight;
    //     } else {
    //       // If no ground found, use default height
    //       this.currentGroundHeight = 0;
    //     }
    //   }

        // Handle jump initiation
        

        updateGroundHeightAtPosition(x, z) {
            // Create ray starting above the destination position
            const rayStart = new THREE.Vector3(
              x,
              this.currentGroundHeight + 2, // Start ray above current ground level
              z
            );
            
            const downRay = new THREE.Raycaster(
              rayStart,
              new THREE.Vector3(0, -1, 0), // cast straight down
              0,
              4 // reasonable search distance
            );
            
            // Filter objects we can stand on
            const intersects = downRay.intersectObjects(
              this.scene3D.scene.children.filter(obj =>
                obj.userData?.isWall ||
                obj.userData?.isRegularWall ||
                obj.userData?.blockHeight !== undefined
              )
            );
            
            if (intersects.length > 0) {
              const hitObject = intersects[0].object;
              
              // Handle different types of surfaces
              if (hitObject.userData?.isRaisedBlock) {
                // Raised blocks - stand on top of them
                this.currentGroundHeight = hitObject.userData.blockHeight || 0;
              }
              else if (hitObject.userData?.isRegularWall) {
                const wallHeight = this.scene3D.boxHeight || 4;
                
                // If we're at or near wall height, we can stand on top of the wall
                if (Math.abs(this.currentGroundHeight - wallHeight) < 0.3) {
                  this.currentGroundHeight = wallHeight;
                } else {
                  // Not on top of the wall, so we're at ground level
                  this.currentGroundHeight = 0;
                }
              }
              else {
                // Default ground level
                this.currentGroundHeight = 0;
              }
            } else {
              // No surface found below, default to ground level
              this.currentGroundHeight = 0;
            }
            
            console.log(`Updated ground height at (${x.toFixed(2)}, ${z.toFixed(2)}): ${this.currentGroundHeight.toFixed(2)}`);
            
            // Reset jumping and falling state
            this.isJumping = false;
            this.isFalling = false;
          }

        updatePlayerHeight(direction, speed) {
            const nextPosition = new THREE.Vector3(
                this.scene3D.camera.position.x + direction.x * speed,
                0,
                this.scene3D.camera.position.z + direction.z * speed
            );
        
            // Check for ground/blocks below
            const downRay = new THREE.Raycaster(
                new THREE.Vector3(nextPosition.x, this.currentGroundHeight + 2, nextPosition.z),
                new THREE.Vector3(0, -1, 0),
                0,
                4
            );
        
            const intersectsDown = downRay.intersectObjects(
                this.scene3D.scene.children.filter(obj =>
                    obj.userData?.isWall ||
                    obj.userData?.isRegularWall ||  // Add check for regular walls
                    obj.userData?.blockHeight !== undefined
                )
            );
        
            if (intersectsDown.length === 0) {
                this.isFalling = true;
                this.currentGroundHeight = Math.max(0, this.currentGroundHeight - this.fallSpeed);
                return true;
            }
        
            const hitObject = intersectsDown[0].object;
            let groundHeight;
        
            // Handle different surface types
            if (hitObject.userData?.isRegularWall) {
                // Handle regular walls - allow walking on top
                const wallHeight = this.scene3D.boxHeight || 4;
                
                // If we're at or near wall height, snap to it
                if (Math.abs(this.currentGroundHeight - wallHeight) < 0.3) {
                    groundHeight = wallHeight;
                } else {
                    groundHeight = 0; // Default case - not on top of wall
                }
            }
            // If we're at wall height and hit a wall, maintain wall height
            else if (this.currentGroundHeight >= 4.0 && 
                     hitObject.userData?.isWall && 
                     hitObject.userData?.blockHeight === 0) {
                groundHeight = 4.0; // Keep height at wall level
            } else {
                groundHeight = hitObject.userData?.blockHeight ?? 0;
            }
        
            const heightDiff = groundHeight - this.currentGroundHeight;
        
            if (this.debug) {
                console.log("Ground check:", {
                    groundHeight,
                    currentHeight: this.currentGroundHeight,
                    diff: heightDiff,
                    isFalling: this.isFalling,
                    nextValidHeight: this.currentGroundHeight + this.stepHeight,
                    objectData: hitObject.userData
                });
            }
        
            // Handle falling
            if (this.isFalling) {
                if (this.currentGroundHeight > groundHeight) {
                    this.currentGroundHeight = Math.max(
                        groundHeight,
                        this.currentGroundHeight - this.fallSpeed
                    );
                    return true;
                } else {
                    this.isFalling = false;
                    this.currentGroundHeight = groundHeight;
                }
            }
        
            // Stepping logic
            if (heightDiff < 0) {
                // Allow stepping down
                this.isFalling = true;
                return true;
            } else if (heightDiff === this.stepHeight) {
                // Only allow stepping up to next sequential height
                this.currentGroundHeight = groundHeight;
                return true;
            } else if (heightDiff === 0) {
                // Allow moving on same level
                return true;
            }
        
            return false;
        }
        
        
        
        startJump() {
            // Only allow jumping when on the ground (not already jumping or falling)
            if (!this.isJumping && !this.isFalling) {
                this.isJumping = true;
                this.jumpVelocity = this.jumpSpeed;
                this.jumpStartHeight = this.currentGroundHeight;
                this.jumpFrameCount = 0;
                
                if (this.debug) {
                    console.log(`Jump started from height: ${this.jumpStartHeight.toFixed(2)}`);
                }
                return true;
            }
            return false;
        }
    

        checkForLandingSurfaces() {
            const playerPos = this.scene3D.camera.position;
            const rayStart = new THREE.Vector3(
                playerPos.x,
                this.currentGroundHeight + 0.1,
                playerPos.z
            );
            
            // Cast rays at different angles to check for landing spots
            const rayDirections = [
                new THREE.Vector3(0, -1, 0), // Straight down
                new THREE.Vector3(0.1, -0.9, 0).normalize(), // Slightly forward
                new THREE.Vector3(-0.1, -0.9, 0).normalize(), // Slightly backward
                new THREE.Vector3(0, -0.9, 0.1).normalize(), // Slightly left
                new THREE.Vector3(0, -0.9, -0.1).normalize(), // Slightly right
            ];
            
            let closestHit = null;
            let closestDistance = Infinity;
            
            // Check each direction for potential landing surfaces
            for (const direction of rayDirections) {
                const downRay = new THREE.Raycaster(
                    rayStart,
                    direction,
                    0,
                    2 // Reasonable range to focus on closer surfaces
                );
                
                // Filter objects that can be landed on
                const intersects = downRay.intersectObjects(
                    this.scene3D.scene.children.filter(obj => {
                        // Include raised blocks
                        if (obj.userData?.isRaisedBlock && obj.userData.blockHeight > 0) {
                            return true;
                        }
                        
                        // Include regular walls (using new flag)
                        if (obj.userData?.isRegularWall) {
                            return true;
                        }
                        
                        // Fallback to old method for compatibility
                        if (obj.userData?.isWall && 
                            !obj.userData.isRaisedBlock && 
                            obj.userData.blockHeight === 0) {
                            return true;
                        }
                        
                        return false;
                    })
                );
                
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    
                    // Determine if this is a valid landing surface
                    let isValidLandingSurface = true;
                    let surfaceHeight = hit.point.y;
                    
                    // For regular walls, check if we're hitting the top face
                    if (hit.object.userData?.isRegularWall || 
                        (hit.object.userData?.isWall && 
                         !hit.object.userData.isRaisedBlock && 
                         hit.object.userData.blockHeight === 0)) {
                        
                        // Get standard wall height
                        const wallHeight = this.scene3D.boxHeight || 4;
                        
                        // Check if we're hitting close to the top surface
                        isValidLandingSurface = Math.abs(surfaceHeight - wallHeight) < 0.3;
                        
                        if (isValidLandingSurface && this.debug) {
                            console.log(`Hit top of regular wall at height ${surfaceHeight.toFixed(2)}`);
                        }
                    }
                    
                    if (isValidLandingSurface) {
                        const distance = Math.abs(this.currentGroundHeight - surfaceHeight);
                        
                        // Keep track of closest landing surface
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestHit = hit;
                            
                            if (this.debug) {
                                console.log(`Potential landing surface found: ${surfaceHeight.toFixed(2)}, type: ${
                                    hit.object.userData.isRaisedBlock ? 'raised block' : 
                                    hit.object.userData.isRegularWall ? 'regular wall' :
                                    hit.object.userData.isWall ? 'wall' : 'unknown'
                                }, distance: ${distance.toFixed(2)}`);
                            }
                        }
                    }
                }
            }
            
            return closestHit;
        }
        

        update() {

            this.checkWalkingSurface();
            
            this.jumpFrameCount++;
            
            // Handle jumping physics
            if (this.isJumping) {
                // Apply jump velocity and gravity
                this.currentGroundHeight += this.jumpVelocity;
                this.jumpVelocity -= this.gravity;
                
                // Enhanced landing detection during jump ascent
                if (this.jumpFrameCount % this.jumpCheckInterval === 0) {
                    const landingSurface = this.checkForLandingSurfaces();
                    if (landingSurface) {
                        const hitPoint = landingSurface.point.y;
                        const heightDiff = hitPoint - this.currentGroundHeight;
                        
                        // If we're close to a landing surface above us, snap to it
                        if (heightDiff > 0 && heightDiff < 0.2 && this.jumpVelocity > 0) {
                            this.currentGroundHeight = hitPoint;
                            this.isJumping = false;
                            
                            if (this.debug) {
                                console.log(`Landed on surface during ascent at height: ${hitPoint.toFixed(2)}`);
                            }
                            return this.currentGroundHeight + this.playerHeight;
                        }
                    }
                }
                
                // Check if reached apex and starting to fall
                if (this.jumpVelocity <= 0) {
                    // Transition from jumping to falling
                    if (this.debug) {
                        console.log(`Jump apex reached at height: ${
                            (this.currentGroundHeight - this.jumpStartHeight).toFixed(2)}`);
                    }
                    this.isJumping = false;
                    this.isFalling = true;
                }
                
                // Debug output
                if (this.debug && (this.jumpFrameCount % 10 === 0)) {
                    console.log(`Jump height: ${
                        (this.currentGroundHeight - this.jumpStartHeight).toFixed(2)}, 
                        Velocity: ${this.jumpVelocity.toFixed(3)}`);
                }
            }
            
            // Handle falling (either from jump or walking off edge)
            else if (this.isFalling) {
                // More frequent landing checks during falling
                if (this.jumpFrameCount % 3 === 0) {
                    const landingSurface = this.checkForLandingSurfaces();
                    
                    if (landingSurface) {
                        const hitPoint = landingSurface.point.y;
                        const distanceToGround = this.currentGroundHeight - hitPoint;
                        
                        // Enhanced landing detection - allow landing when very close or slightly above
                        if (Math.abs(distanceToGround) <= 0.15) {
                            // Close enough to land (either slightly above or below)
                            this.isFalling = false;
                            this.currentGroundHeight = hitPoint;
                            
                            if (this.debug) {
                                console.log(`Landed precisely at height: ${hitPoint.toFixed(2)}`);
                            }
                            
                            return this.currentGroundHeight + this.playerHeight;
                        }
                        // Landing on surface below current position
                        else if (distanceToGround > 0 && distanceToGround <= this.fallSpeed * 2) {
                            this.isFalling = false;
                            this.currentGroundHeight = hitPoint;
                            
                            if (this.debug) {
                                console.log(`Landed on surface below at height: ${hitPoint.toFixed(2)}`);
                            }
                            
                            return this.currentGroundHeight + this.playerHeight;
                        }
                    }
                }
                
                // Regular falling - apply fall speed
                this.currentGroundHeight -= this.fallSpeed;
                
                // Prevent falling below absolute ground (y=0)
                if (this.currentGroundHeight < 0) {
                    this.currentGroundHeight = 0;
                    this.isFalling = false;
                    
                    if (this.debug) {
                        console.log("Landed on absolute ground");
                    }
                }
            }
            
            // Return the camera Y position
            return this.currentGroundHeight + this.playerHeight;
        }

}