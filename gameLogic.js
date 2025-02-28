// Create the Three.js scene
const scene = new THREE.Scene();

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

// 3D array to store world data
const worldData = {};

function createBlock(type, x, y, z) {
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Create different materials based on block type
    let material;
        let block;
    
    switch(type) {
        case BLOCK_TYPES.GRASS:
            material = new THREE.MeshBasicMaterial({ color: 0x3bba1f });
            block = new THREE.Mesh(geometry, material);
            
            // Add outline to grass blocks
            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(
                edges,
                
                new THREE.LineBasicMaterial({ color: 0x000000 })
            );
            block.add(line);
            break;
        case BLOCK_TYPES.DIRT:
            material = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
            block = new THREE.Mesh(geometry, material);
            
            // Add outline to dirt blocks
            const dirtEdges = new THREE.EdgesGeometry(geometry);
            const dirtLine = new THREE.LineSegments(
                dirtEdges,
                new THREE.LineBasicMaterial({ color: 0x000000 })
            );
            block.add(dirtLine);
            break;
        case BLOCK_TYPES.STONE:
            material = new THREE.MeshBasicMaterial({ color: 0x808080 });
            block = new THREE.Mesh(geometry, material);
            
            // Add outline to stone blocks
            const stoneEdges = new THREE.EdgesGeometry(geometry);
            const stoneLine = new THREE.LineSegments(
                stoneEdges,
                new THREE.LineBasicMaterial({ color: 0x000000 })
            );
            block.add(stoneLine);
            break;
        default:
            return null;
    }

    block.position.set(x, y, z);
    return block;
}

function generateWorld() {
    // Simple terrain generation
    for(let x = 0; x < MAP_SIZE.width; x++) {
        for(let z = 0; z < MAP_SIZE.depth; z++) {
            // Generate a basic height using noise 
            // const height = Math.floor(Math.random() * 3) + 1;
            height = 2            
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

// Physics and movement constants
const GRAVITY = 0.003;
const JUMP_FORCE = 0.1;
const PLAYER_HEIGHT = 1.8;  // Minecraft player is ~1.8 blocks tall
const WALK_SPEED = 0.085;

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

// Set initial camera position
camera.position.set(5, PLAYER_HEIGHT, 10);

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
    // Simple ground collision for now
    // if (camera.position.y < PLAYER_HEIGHT) {
    //     camera.position.y = PLAYER_HEIGHT;
    //     player.velocity.y = 0;
    //     player.canJump = true;
    //     player.isJumping = false;
    // }
    
    // TODO: Add block collision detection here
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



function getNearbyBlocks(rad){
    // Get blocks within radius of player position
    const radius = rad; // Default radius if none provided
    const playerPos = camera.position;
    const nearbyBlocks = [];

    // Convert player position to block coordinates
    const playerBlockX = Math.floor(playerPos.x);
    const playerBlockY = Math.floor(playerPos.y);
    const playerBlockZ = Math.floor(playerPos.z);

    // Check blocks in a cube around the player
    for (let x = playerBlockX - radius; x <= playerBlockX + radius; x++) {
        for (let y = playerBlockY - radius; y <= playerBlockY + radius; y++) {
            for (let z = playerBlockZ - radius; z <= playerBlockZ + radius; z++) {
                // Skip if out of bounds
                if (x < 0 || x >= MAP_SIZE.width || 
                    y < 0 || y >= MAP_SIZE.height ||
                    z < 0 || z >= MAP_SIZE.depth) {
                    continue;
                }

                const key = `${x},${y},${z}`;
                if (worldData[key]) {
                    nearbyBlocks.push(worldData[key]);
                }
            }
        }
    }

    return nearbyBlocks;
}

// Update the animation loop
function animate() {
    requestAnimationFrame(animate);

    // Apply gravity
    if (camera.position.y > PLAYER_HEIGHT || player.velocity.y > 0) {
        player.velocity.y -= GRAVITY;
    }

    // Update vertical position
    camera.position.y += player.velocity.y;

    // Handle horizontal movement
    const direction = new THREE.Vector3();
    
    if (moveState.forward) direction.z -= 1;
    if (moveState.backward) direction.z += 1;
    if (moveState.left) direction.x -= 1;
    if (moveState.right) direction.x += 1;

    if (direction.length() > 0) {
        direction.normalize();
        direction.multiplyScalar(moveState.speed);
        
        controls.moveRight(direction.x);
        controls.moveForward(-direction.z);
    }

    // Check for collisions
    checkCollision();

    renderer.render(scene, camera);
}
animate();

// Add raycaster setup after the controls setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add click handler for breaking blocks
document.addEventListener('mousedown', (event) => {
    // Check if it's the left mouse button (button 0)
    if (event.button !== 0) return;
    
    if (!controls.isLocked) return; // Only break blocks when in pointer lock

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Get all nearby blocks for intersection testing
    const nearbyBlocks = getNearbyBlocks(3);
    const blockMeshes = nearbyBlocks.map(block => block.mesh);
    
    // Calculate intersections with blocks
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        // Get the first (closest) intersected block
        const intersectedMesh = intersects[0].object;
        
        // Find the block data using the mesh position
        const pos = intersectedMesh.position;
        const key = `${pos.x},${pos.y},${pos.z}`;
        
        // Remove the block from the scene and world data
        scene.remove(worldData[key].mesh);
        delete worldData[key];
    }
});
