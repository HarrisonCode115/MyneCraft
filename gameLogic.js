// Create the Three.js scene
const scene = new THREE.Scene();

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 2, 10); 

// Set up the WebGL renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// Pointer lock controls (for first-person movement)
const controls = new THREE.PointerLockControls(camera, document.body);

// Click to enter first-person mode
document.addEventListener("click", () => {
    controls.lock();
});

// Block size and map configuration
const BLOCK_SIZE = 1;
const MAP_SIZE = {
    width: 16,
    height: 64,  // Typical Minecraft chunks are 16x256x16, but we'll use 64 for now
    depth: 16
};

// Block types
const BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3
};

// 3D array to store world data
const worldData = {};

function createBlock(type, x, y, z) {
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Create different materials based on block type
    let material;
    switch(type) {
        case BLOCK_TYPES.GRASS:
            material = new THREE.MeshBasicMaterial({ color: 0x3bba1f });
            break;
        case BLOCK_TYPES.DIRT:
            material = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
            break;
        case BLOCK_TYPES.STONE:
            material = new THREE.MeshBasicMaterial({ color: 0x808080 });
            break;
        default:
            return null;
    }

    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    return block;
}

function generateWorld() {
    // Simple terrain generation
    for(let x = 0; x < MAP_SIZE.width; x++) {
        for(let z = 0; z < MAP_SIZE.depth; z++) {
            // Generate a basic height using noise 
            // const height = Math.floor(Math.random() * 3) + 1;
            height = 1            
            for(let y = 0; y < MAP_SIZE.height; y++) {
                let blockType = BLOCK_TYPES.AIR;
                
                if (y < height - 1) {
                    blockType = BLOCK_TYPES.DIRT;
                } else if (y === height - 1) {
                    blockType = BLOCK_TYPES.GRASS;
                }
                
                if (blockType !== BLOCK_TYPES.AIR) {
                    const block = createBlock(blockType, x, y, z);
                    if (block) {
                        scene.add(block);
                        // Store block in world data
                        const key = `${x},${y},${z}`;
                        worldData[key] = {
                            type: blockType,
                            mesh: block
                        };
                    }
                }
            }
        }
    }
}

// Replace generateGrid() call with generateWorld()
generateWorld();

// Add movement state object
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    speed: 0.1  // Adjust this value to change movement speed
};

// Add keyboard event listeners
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW':
            moveState.forward = true;
            break;
        case 'KeyS':
            moveState.backward = true;
            break;
        case 'KeyA':
            moveState.left = true;
            break;
        case 'KeyD':
            moveState.right = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
            moveState.forward = false;
            break;
        case 'KeyS':
            moveState.backward = false;
            break;
        case 'KeyA':
            moveState.left = false;
            break;
        case 'KeyD':
            moveState.right = false;
            break;
    }
});

// Update the animation loop
function animate() {
    requestAnimationFrame(animate);

    // Handle movement
    const direction = new THREE.Vector3();
    
    // Calculate movement direction based on key states
    if (moveState.forward) direction.z -= 1;
    if (moveState.backward) direction.z += 1;
    if (moveState.left) direction.x -= 1;
    if (moveState.right) direction.x += 1;

    // Normalize the direction vector and apply speed
    if (direction.length() > 0) {
        direction.normalize();
        direction.multiplyScalar(moveState.speed);
        
        controls.moveRight(direction.x);
        controls.moveForward(-direction.z);
    }

    renderer.render(scene, camera);
}
animate();
