// Description: This class is responsible for handling the physics of the player in the 3D scene.
class PhysicsController {
    constructor(scene3D) {
        this.scene3D = scene3D;
        this.playerHeight = 1.7;
        this.currentGroundHeight = 0;
        this.stepHeight = 0.5;
        this.halfBlockSize = 0.5;
        this.debug = true;
        this.fallSpeed = 0.03; // Speed of falling
        this.isFalling = false;
    }

    checkCollision(direction, speed) {
        if (this.debug) {
            console.log("Current ground height:", this.currentGroundHeight);
        }

        const collision = this.checkForwardCollision(direction, speed);

        if (collision.canMove) {
            return this.updatePlayerHeight(direction, speed);
        }

        // Check if we hit a half block we can step onto
        const hitObject = collision.hitObject;
        if (hitObject?.userData?.isWall && hitObject?.userData?.blockHeight > 0) {
            const blockHeight = hitObject.userData.blockHeight;
            const heightDiff = blockHeight - this.currentGroundHeight;

            if (this.debug) {
                console.log("Hit raised block:", {
                    blockHeight,
                    currentHeight: this.currentGroundHeight,
                    diff: heightDiff,
                    nextHalfBlock: this.currentGroundHeight + this.stepHeight
                });
            }

            // Can only step up one half-block at a time
            if (heightDiff === this.stepHeight) {
                this.currentGroundHeight = blockHeight;
                return true;
            }
        }

        return false;
    }
    


    // walk on halfblocks code
    // checkForwardCollision(direction, speed) {
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

    //     // Check at current height and slightly above for stair stepping
    //     const intersects = raycaster.intersectObjects(
    //         this.scene3D.scene.children.filter(obj => {
    //             if (!obj.userData?.isWall) return false;

    //             // Full walls always block
    //             if (obj.userData.blockHeight === 0) return true;

    //             // For half blocks, only allow stepping up to next sequential height
    //             const heightDiff = obj.userData.blockHeight - this.currentGroundHeight;
    //             return heightDiff > this.stepHeight;
    //         })
    //     );



    //     if (this.debug && intersects.length > 0) {
    //         console.log("Forward collision check:", {
    //             hit: true,
    //             object: intersects[0].object.userData,
    //             blockHeight: intersects[0].object.userData?.blockHeight,
    //             currentHeight: this.currentGroundHeight,
    //             position: intersects[0].point
    //         });
    //     }

    //     return {
    //         canMove: intersects.length === 0,
    //         hitObject: intersects[0]?.object || null
    //     };
    // }

    checkForwardCollision(direction, speed) {
        const positions = [
            // Current ground level check
            new THREE.Vector3(
                this.scene3D.camera.position.x,
                this.currentGroundHeight + 0.1,
                this.scene3D.camera.position.z
            ),
            // Base ground level check for full walls
            new THREE.Vector3(
                this.scene3D.camera.position.x,
                0.1,
                this.scene3D.camera.position.z
            )
        ];
    
        const objects = this.scene3D.scene.children.filter(obj => {
            if (!obj.userData?.isWall) return false;
    
            if (obj.userData.blockHeight === 0) return true; // Always check full walls
    
            const heightDiff = obj.userData.blockHeight - this.currentGroundHeight;
            return heightDiff > this.stepHeight;
        });
    
        let intersects = [];
        positions.forEach(position => {
            const raycaster = new THREE.Raycaster(
                position,
                direction.clone().normalize(),
                0,
                speed + this.halfBlockSize
            );
            intersects = intersects.concat(raycaster.intersectObjects(objects, true));
        });
    
        if (this.debug && intersects.length > 0) {
            console.log("Forward collision check:", {
                hit: true,
                object: intersects[0].object.userData,
                blockHeight: intersects[0].object.userData?.blockHeight,
                currentHeight: this.currentGroundHeight,
                position: intersects[0].point
            });
        }
    
        return {
            canMove: intersects.length === 0,
            hitObject: intersects[0]?.object || null
        };
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

        // If we're at wall height and hit a wall, maintain wall height
        if (this.currentGroundHeight >= 4.0 && hitObject.userData?.isWall && hitObject.userData?.blockHeight === 0) {
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

    
    update() {
        // Handle falling even when not moving
        if (this.isFalling) {
            const downRay = new THREE.Raycaster(
                new THREE.Vector3(
                    this.scene3D.camera.position.x,
                    this.currentGroundHeight + 2,
                    this.scene3D.camera.position.z
                ),
                new THREE.Vector3(0, -1, 0),
                0,
                4
            );

            const intersectsDown = downRay.intersectObjects(
                this.scene3D.scene.children.filter(obj =>
                    obj.userData?.isWall ||
                    obj.userData?.blockHeight !== undefined
                )
            );

            if (intersectsDown.length === 0) {
                this.currentGroundHeight = Math.max(0, this.currentGroundHeight - this.fallSpeed);
            } else {
                const groundHeight = intersectsDown[0].object.userData?.blockHeight ?? 0;
                if (this.currentGroundHeight > groundHeight) {
                    this.currentGroundHeight = Math.max(
                        groundHeight,
                        this.currentGroundHeight - this.fallSpeed
                    );
                } else {
                    this.isFalling = false;
                    this.currentGroundHeight = groundHeight;
                }
            }
        }

        return this.currentGroundHeight + this.playerHeight;
    }
}