// Create the Three.js scene
const scene = new THREE.Scene();
// Set the background color to sky blue
scene.background = new THREE.Color(0x87CEEB); // Sky blue color

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 1.8, 10); 

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
    width: 50,
    height: 64,  // Typical Minecraft chunks are 16x256x16, but we'll use 64 for now
    depth: 50
};

// Block types
const BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3
};


// Physics and movement constants
const GRAVITY = 0.005;
const JUMP_FORCE = 0.1;
const PLAYER_HEIGHT = 1.8;
const WALK_SPEED = 0.085; // Increased to feel right with delta time
const SPRINT_SPEED = 0.15; // Increased to feel right with delta time

// 3D array to store world data
const worldData = {};

// Add these constants for terrain generation
const NOISE_SCALE = 25;
const TERRAIN_AMPLITUDE = 8;
const BASE_HEIGHT = 5;

// Player state
const player = {
    velocity: new THREE.Vector3(0, 0, 0),
    canJump: false,
    isJumping: false
};

// Update moveState
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    speed: WALK_SPEED
};

// Update keyboard controls
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
        case 'Space':
            moveState.jump = true;
            if (player.canJump) {
                player.velocity.y = JUMP_FORCE;
                player.canJump = false;
                player.isJumping = true;
            }
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
        case 'Space':
            moveState.jump = false;
            player.isJumping = false;
            break;
    }
});

// Add collision detection
function checkCollision() {
    nearbyBlocks = getNearbyBlocks(2)    
    for(block in nearbyBlocks){
        // Get block position and mesh
        const blockMesh = nearbyBlocks[block].mesh;
        const blockPos = blockMesh.position;
        
        // Create bounding boxes for collision detection
        const playerBox = new THREE.Box3().setFromObject(new THREE.Object3D());
        playerBox.min.set(
            camera.position.x - 0.3,  // Player width/2
            camera.position.y - PLAYER_HEIGHT,  // Full height from feet
            camera.position.z - 0.3
        );
        playerBox.max.set(
            camera.position.x + 0.3,
            camera.position.y,  // Camera position is at eye level
            camera.position.z + 0.3
        );

        const blockBox = new THREE.Box3().setFromObject(blockMesh);

        // Check for intersection
        if (playerBox.intersectsBox(blockBox)) {
            // Calculate overlap on each axis
            const xOverlap = Math.min(
                Math.abs(playerBox.max.x - blockBox.min.x),
                Math.abs(blockBox.max.x - playerBox.min.x)
            );
            const yOverlap = Math.min(
                Math.abs(playerBox.max.y - blockBox.min.y),
                Math.abs(blockBox.max.y - playerBox.min.y)
            );
            const zOverlap = Math.min(
                Math.abs(playerBox.max.z - blockBox.min.z),
                Math.abs(blockBox.max.z - playerBox.min.z)
            );

            // Push back on axis with smallest overlap
            if (xOverlap < yOverlap && xOverlap < zOverlap) {
                if (camera.position.x > blockPos.x) {
                    camera.position.x = blockBox.max.x + 0.3;
                } else {
                    camera.position.x = blockBox.min.x - 0.3;
                }
            } else if (yOverlap < xOverlap && yOverlap < zOverlap) {
                if (camera.position.y > blockPos.y) {
                    camera.position.y = blockBox.max.y + PLAYER_HEIGHT;
                    player.velocity.y = 0;
                    player.canJump = true;
                } else {
                    camera.position.y = blockBox.min.y - PLAYER_HEIGHT;
                    player.velocity.y = 0;
                }
            } else {
                if (camera.position.z > blockPos.z) {
                    camera.position.z = blockBox.max.z + 0.3;
                } else {
                    camera.position.z = blockBox.min.z - 0.3;
                }
            }
        }
    }
}

// Modify getNearbyBlocks to use chunks
function getNearbyBlocks(rad) {
    const playerPos = camera.position;
    const nearbyBlocks = [];
    
    // Calculate block coordinates
    const minX = Math.floor(playerPos.x - rad);
    const maxX = Math.floor(playerPos.x + rad);
    const minY = Math.floor(playerPos.y - rad);
    const maxY = Math.floor(playerPos.y + rad);
    const minZ = Math.floor(playerPos.z - rad);
    const maxZ = Math.floor(playerPos.z + rad);

    // Only check blocks within the calculated bounds
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${y},${z}`;
                if (worldData[key]) {
                    nearbyBlocks.push(worldData[key]);
                }
            }
        }
    }
    
    return nearbyBlocks;
}

// Add this variable to track the currently highlighted block
let highlightedBlock = null;

// Add this function to update the block highlight
function updateBlockHighlight() {
    if (!controls.isLocked) return;

    // Remove highlight from previously highlighted block
    if (highlightedBlock) {
        highlightedBlock.remove(highlightedBlock.children[0]);
    }

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Get all nearby blocks for intersection testing
    const nearbyBlocks = getNearbyBlocks(3);
    const blockMeshes = nearbyBlocks.map(block => block.mesh);
    
    // Calculate intersections with blocks
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        
        // Add outline to intersected block
        const edges = new THREE.EdgesGeometry(intersectedMesh.geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        intersectedMesh.add(line);
        highlightedBlock = intersectedMesh;
    } else {
        highlightedBlock = null;
    }
}

// Add these variables at the top with other constants
const clock = new THREE.Clock(); // Add this near other THREE.js initializations

// Update the animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Get delta time (in seconds) - only call this once
    const deltaTime = clock.getDelta();

    // Apply gravity
    if (camera.position.y > PLAYER_HEIGHT || player.velocity.y > 0) {
        player.velocity.y -= GRAVITY * deltaTime * 60;
    }

    // Update vertical position
    camera.position.y += player.velocity.y * deltaTime * 60;

    // Handle horizontal movement
    const direction = new THREE.Vector3();
    
    if (moveState.forward) direction.z -= 1;
    if (moveState.backward) direction.z += 1;
    if (moveState.left) direction.x -= 1;
    if (moveState.right) direction.x += 1;

    if (direction.length() > 0) {
        direction.normalize();
        direction.multiplyScalar(moveState.speed * deltaTime * 60);
        
        controls.moveRight(direction.x);
        controls.moveForward(-direction.z);
    }

    checkCollision();
    updateBlockHighlight();
    renderer.render(scene, camera);
}
animate();

// Add raycaster setup after the controls setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add click handler for breaking blocks
document.addEventListener('mousedown', (event) => {
    if (!controls.isLocked) return; // Only interact with blocks when in pointer lock

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Get all nearby blocks for intersection testing
    const nearbyBlocks = getNearbyBlocks(4);
    const blockMeshes = nearbyBlocks.map(block => block.mesh);
    
    // Calculate intersections with blocks
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        const pos = intersectedMesh.position;
        const key = `${pos.x},${pos.y},${pos.z}`;
        
        if (event.button === 0) {  // Left click - break block
            // Remove the block from the scene and world data
            scene.remove(worldData[key].mesh);
            delete worldData[key];
        } else if (event.button === 2) {  // Right click - place block
            // Calculate the position for the new block based on intersection point
            const normal = intersects[0].face.normal;
            const newX = pos.x + normal.x;
            const newY = pos.y + normal.y;
            const newZ = pos.z + normal.z;
            
        

            // Create bounding boxes for collision detection so we dont place the block where player
                const playerBox = new THREE.Box3().setFromObject(new THREE.Object3D());
                playerBox.min.set(
                    camera.position.x - 0.2,  // Reduced from 0.3
                    camera.position.y - PLAYER_HEIGHT + 0.1,  // Added small offset from bottom
                    camera.position.z - 0.2   // Reduced from 0.3
                );
                playerBox.max.set(
                    camera.position.x + 0.2,  // Reduced from 0.3
                    camera.position.y - 0.1,  // Added small offset from top
                    camera.position.z + 0.2   // Reduced from 0.3
                );
            // Check if position is valid (within bounds and not occupied)
            if (newX >= 0 && newX < MAP_SIZE.width &&
                newY >= 0 && newY < MAP_SIZE.height &&
                newZ >= 0 && newZ < MAP_SIZE.depth){
                
                const newKey = `${newX},${newY},${newZ}`;
                if (!worldData[newKey]) {
                    // Create new block (using dirt for now)
                    const newBlock = createBlock(BLOCK_TYPES.DIRT, newX, newY, newZ);
                    if (newBlock) {
                        const blockBox = new THREE.Box3().setFromObject(newBlock);
                        if(!playerBox.intersectsBox(blockBox)){
                            scene.add(newBlock);
                            worldData[newKey] = {
                                type: BLOCK_TYPES.DIRT,
                                mesh: newBlock
                            };
                        }
                        
                    }
                }
            }
        }
    }
});

// Prevent context menu from showing on right click
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

function createBlock(type, x, y, z) {
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    let material;
    let block;
    
    switch(type) {
        case BLOCK_TYPES.GRASS:
            material = new THREE.MeshBasicMaterial({ color: 0x3bba1f });
            block = new THREE.Mesh(geometry, material);
            break;
        case BLOCK_TYPES.DIRT:
            material = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
            block = new THREE.Mesh(geometry, material);
            break;
        case BLOCK_TYPES.STONE:
            material = new THREE.MeshBasicMaterial({ color: 0x808080 });
            block = new THREE.Mesh(geometry, material);
            break;
        default:
            return null;
    }

    block.position.set(x, y, z);
    return block;
}

// Add this function to find the surface height at a given x,z coordinate
function getSurfaceHeight(x, z) {
    for (let y = MAP_SIZE.height - 1; y >= 0; y--) {
        const key = `${x},${y},${z}`;
        if (worldData[key]) {
            return y + 1; // Return one block above the surface
        }
    }
    return BASE_HEIGHT; // Fallback height if no surface found
}

// Modify the world generation to set player spawn after world is generated
function generateWorld() {
    const noise = new SimplexNoise();
    
    // Generate terrain
    for(let x = 0; x < MAP_SIZE.width; x++) {
        for(let z = 0; z < MAP_SIZE.depth; z++) {
            const nx = x / NOISE_SCALE;
            const nz = z / NOISE_SCALE;
            const height = Math.floor(
                BASE_HEIGHT + 
                (noise.noise2D(nx, nz) + 1) * 0.5 * TERRAIN_AMPLITUDE
            );
            
            for(let y = 0; y < height; y++) {
                let blockType;
                if (y < height - 4) {
                    blockType = BLOCK_TYPES.STONE;
                } else if (y < height - 1) {
                    blockType = BLOCK_TYPES.DIRT;
                } else if (y === height - 1) {
                    blockType = BLOCK_TYPES.GRASS;
                }
                
                if (blockType) {
                    const block = createBlock(blockType, x, y, z);
                    if (block) {
                        scene.add(block);
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

    // Set player spawn position
    const spawnX = Math.floor(MAP_SIZE.width / 2);
    const spawnZ = Math.floor(MAP_SIZE.depth / 2);
    const spawnY = getSurfaceHeight(spawnX, spawnZ);
    camera.position.set(spawnX, spawnY + PLAYER_HEIGHT, spawnZ);
}

// Initialize the world
generateWorld();

