      class Scene3DController {
        constructor() {
          this.clear();
        }

        clear() {
          this.scene = null;
          this.camera = null;
          this.renderer = null;
          this.controls = null;
          this.animationFrameId = null;
          this.isActive = false;
          this.keyHandlers = {
            keydown: null,
            keyup: null
          };
          this.keys = {};
        }

        initialize(container, width, height) {
          // Scene
          this.scene = new THREE.Scene();
          this.scene.background = new THREE.Color(0x222222);

          // Camera
          this.camera = new THREE.PerspectiveCamera(
            75,
            width / height,
            0.1,
            1000
          );
          this.camera.position.set(0, 6, 50); // Adjusted starting position

          // Renderer
          this.renderer = new THREE.WebGLRenderer({ antialias: true });
          this.renderer.setSize(width, height);
          container.appendChild(this.renderer.domElement);

          // Controls
          this.controls = new THREE.PointerLockControls(this.camera, container);

          // Setup key handlers
          this.keyHandlers.keydown = (e) =>
            (this.keys[e.key.toLowerCase()] = true);
          this.keyHandlers.keyup = (e) =>
            (this.keys[e.key.toLowerCase()] = false);

          document.addEventListener("keydown", this.keyHandlers.keydown);
          document.addEventListener("keyup", this.keyHandlers.keyup);

          this.isActive = true;
        }

        cleanup() {
          this.isActive = false;

          if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
          }

          if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement?.parentNode) {
              this.renderer.domElement.parentNode.removeChild(
                this.renderer.domElement
              );
            }
          }

          if (this.controls) {
            this.controls.dispose();
          }

          if (this.keyHandlers.keydown) {
            document.removeEventListener("keydown", this.keyHandlers.keydown);
          }
          if (this.keyHandlers.keyup) {
            document.removeEventListener("keyup", this.keyHandlers.keyup);
          }

          this.clear();
        }
      }
