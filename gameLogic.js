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

// Add these constants near the top
const CHUNK_SIZE = 16;
const CHUNKS = {};
const RENDER_DISTANCE = 32;
const loadedChunks = new Set();  // Move this to the top

// Add chunk helper functions
function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

function getChunkCoords(x, z) {
    return {
        chunkX: Math.floor(x / CHUNK_SIZE),
        chunkZ: Math.floor(z / CHUNK_SIZE),
        localX: Math.floor(x % CHUNK_SIZE),
        localZ: Math.floor(z % CHUNK_SIZE)
    };
}

// Update generateWorld to use chunks
function generateWorld() {
    const noise = new SimplexNoise();
    
    // Calculate number of chunks needed
    const chunksX = Math.ceil(MAP_SIZE.width / CHUNK_SIZE);
    const chunksZ = Math.ceil(MAP_SIZE.depth / CHUNK_SIZE);
    
    // Generate chunks
    for(let cx = 0; cx < chunksX; cx++) {
        for(let cz = 0; cz < chunksZ; cz++) {
            generateChunk(cx, cz, noise);
        }
    }

    // Set player spawn position
    const spawnX = Math.floor(MAP_SIZE.width / 2);
    const spawnZ = Math.floor(MAP_SIZE.depth / 2);
    const spawnY = getSurfaceHeight(spawnX, spawnZ);
    camera.position.set(spawnX, spawnY + PLAYER_HEIGHT, spawnZ);
}

function generateChunk(chunkX, chunkZ, noise) {
    const chunk = {
        blocks: {},
        loaded: false
    };
    
    // Generate terrain for this chunk
    for(let lx = 0; lx < CHUNK_SIZE; lx++) {
        for(let lz = 0; lz < CHUNK_SIZE; lz++) {
            const worldX = chunkX * CHUNK_SIZE + lx;
            const worldZ = chunkZ * CHUNK_SIZE + lz;
            
            if(worldX >= MAP_SIZE.width || worldZ >= MAP_SIZE.depth) continue;

            const nx = worldX / NOISE_SCALE;
            const nz = worldZ / NOISE_SCALE;
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
                    const key = `${lx},${y},${lz}`;
                    chunk.blocks[key] = {
                        type: blockType,
                        worldX: worldX,
                        worldY: y,
                        worldZ: worldZ
                    };
                }
            }
        }
    }
    
    CHUNKS[getChunkKey(chunkX, chunkZ)] = chunk;
}

// Update visibility based on chunks
function updateVisibility() {
    const playerPos = camera.position;
    const { chunkX: playerChunkX, chunkZ: playerChunkZ } = getChunkCoords(playerPos.x, playerPos.z);
    
    const renderChunks = Math.ceil(RENDER_DISTANCE / CHUNK_SIZE);
    
    // Load chunks in range
    for (let dx = -renderChunks; dx <= renderChunks; dx++) {
        for (let dz = -renderChunks; dz <= renderChunks; dz++) {
            const cx = playerChunkX + dx;
            const cz = playerChunkZ + dz;
            const chunkKey = getChunkKey(cx, cz);
            
            if (dx * dx + dz * dz <= renderChunks * renderChunks) {
                const chunk = CHUNKS[chunkKey];
                if (chunk && !chunk.loaded) {
                    loadChunk(cx, cz, chunk);
                    loadedChunks.add(chunkKey);
                }
            }
        }
    }
    
    // Unload distant chunks
    for (const chunkKey of Array.from(loadedChunks)) {
        const [cx, cz] = chunkKey.split(',').map(Number);
        const dx = cx - playerChunkX;
        const dz = cz - playerChunkZ;
        
        if (dx * dx + dz * dz > renderChunks * renderChunks) {
            const chunk = CHUNKS[chunkKey];
            if (chunk && chunk.loaded) {
                unloadChunk(cx, cz, chunk);
                loadedChunks.delete(chunkKey);
            }
        }
    }
}

function loadChunk(chunkX, chunkZ, chunk) {
    for(const blockKey in chunk.blocks) {
        const block = chunk.blocks[blockKey];
        if(!block.mesh) {
            const mesh = createBlock(block.type, block.worldX, block.worldY, block.worldZ);
            if(mesh) {
                scene.add(mesh);
                block.mesh = mesh;
            }
        }
    }
    chunk.loaded = true;
}

function unloadChunk(chunkX, chunkZ, chunk) {
    for(const blockKey in chunk.blocks) {
        const block = chunk.blocks[blockKey];
        if(block.mesh) {
            scene.remove(block.mesh);
            block.mesh.geometry.dispose();
            
            // Handle both single materials and material arrays
            if (Array.isArray(block.mesh.material)) {
                block.mesh.material.forEach(material => material.dispose());
            } else {
                block.mesh.material.dispose();
            }
            
            block.mesh = null;
        }
    }
    chunk.loaded = false;
}

// Update getNearbyBlocks to work with chunks
function getNearbyBlocks(rad) {
    const playerPos = camera.position;
    const nearbyBlocks = [];

    const minX = Math.floor(playerPos.x - rad);
    const maxX = Math.floor(playerPos.x + rad);
    const minY = Math.floor(playerPos.y - rad);
    const maxY = Math.floor(playerPos.y + rad);
    const minZ = Math.floor(playerPos.z - rad);
    const maxZ = Math.floor(playerPos.z + rad);

    for(let x = minX; x <= maxX; x++) {
        for(let y = minY; y <= maxY; y++) {
            for(let z = minZ; z <= maxZ; z++) {
                const { chunkX, chunkZ, localX, localZ } = getChunkCoords(x, z);
                const chunk = CHUNKS[getChunkKey(chunkX, chunkZ)];
                
                if(chunk && chunk.loaded) {
                    const block = chunk.blocks[`${localX},${y},${localZ}`];
                    if(block && block.mesh) {
                        nearbyBlocks.push({ mesh: block.mesh });
                    }
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

    updateVisibility();
    checkCollision();
    updateBlockHighlight();
    renderer.render(scene, camera);
}
animate();

// Add raycaster setup after the controls setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add this helper function to check if a position would intersect with the player
function wouldIntersectPlayer(x, y, z) {
    const playerBox = new THREE.Box3();
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

    const blockBox = new THREE.Box3();
    blockBox.min.set(x - 0.5, y - 0.5, z - 0.5);
    blockBox.max.set(x + 0.5, y + 0.5, z + 0.5);

    return playerBox.intersectsBox(blockBox);
}

// Add click handler for breaking blocks
document.addEventListener('mousedown', (event) => {
    if (!controls.isLocked) return;

    raycaster.setFromCamera(mouse, camera);
    const nearbyBlocks = getNearbyBlocks(4);
    const blockMeshes = nearbyBlocks.map(block => block.mesh);
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        const pos = intersectedMesh.position;
        
        // Get chunk coordinates for the block
        const { chunkX, chunkZ, localX, localZ } = getChunkCoords(pos.x, pos.z);
        const chunk = CHUNKS[getChunkKey(chunkX, chunkZ)];
        
        if (event.button === 0) {  // Left click - break block
            if (chunk && chunk.loaded) {
                const key = `${localX},${Math.floor(pos.y)},${localZ}`;
                if (chunk.blocks[key]) {
                    scene.remove(chunk.blocks[key].mesh);
                    delete chunk.blocks[key];
                }
            }
        } else if (event.button === 2) {  // Right click - place block
            const normal = intersects[0].face.normal;
            const newX = pos.x + normal.x;
            const newY = pos.y + normal.y;
            const newZ = pos.z + normal.z;
            
            // Check if the new block would intersect with the player
            if (!wouldIntersectPlayer(newX, newY, newZ)) {
                const { chunkX: newChunkX, chunkZ: newChunkZ, localX: newLocalX, localZ: newLocalZ } = getChunkCoords(newX, newZ);
                const newChunk = CHUNKS[getChunkKey(newChunkX, newChunkZ)];
                
                if (newChunk && newChunk.loaded) {
                    const newKey = `${newLocalX},${Math.floor(newY)},${newLocalZ}`;
                    if (!newChunk.blocks[newKey]) {
                        const block = {
                            type: BLOCK_TYPES.DIRT,
                            worldX: newX,
                            worldY: Math.floor(newY),
                            worldZ: newZ
                        };
                        
                        const mesh = createBlock(block.type, block.worldX, block.worldY, block.worldZ);
                        if (mesh) {
                            scene.add(mesh);
                            block.mesh = mesh;
                            newChunk.blocks[newKey] = block;
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

// Cache geometry and materials
const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const blockMaterials = {
    [BLOCK_TYPES.GRASS]: [
        new THREE.MeshBasicMaterial({ color: 0x8B4513 }), // Right
        new THREE.MeshBasicMaterial({ color: 0x8B4513 }), // Left
        new THREE.MeshBasicMaterial({ color: 0x3bba1f }), // Top
        new THREE.MeshBasicMaterial({ color: 0x8B4513 }), // Bottom
        new THREE.MeshBasicMaterial({ color: 0x8B4513 }), // Front
        new THREE.MeshBasicMaterial({ color: 0x8B4513 })  // Back
    ],
    [BLOCK_TYPES.DIRT]: new THREE.MeshBasicMaterial({ color: 0x8B4513 }),
    [BLOCK_TYPES.STONE]: new THREE.MeshBasicMaterial({ color: 0x808080 })
};

// Update createBlock to handle arrays of materials
function createBlock(type, x, y, z) {
    if (!blockMaterials[type]) return null;
    
    // If the material is an array, use it directly, otherwise create an array of 6 identical materials
    const materials = Array.isArray(blockMaterials[type]) 
        ? blockMaterials[type] 
        : Array(6).fill(blockMaterials[type]);
    
    const block = new THREE.Mesh(blockGeometry, materials);
    block.position.set(x, y, z);
    return block;
}

// Update getSurfaceHeight to work with chunks
function getSurfaceHeight(x, z) {
    const { chunkX, chunkZ, localX, localZ } = getChunkCoords(x, z);
    const chunk = CHUNKS[getChunkKey(chunkX, chunkZ)];
    
    if (!chunk) return BASE_HEIGHT;
    
    for (let y = MAP_SIZE.height - 1; y >= 0; y--) {
        const key = `${localX},${y},${localZ}`;
        if (chunk.blocks[key]) {
            return y + 1;
        }
    }
    return BASE_HEIGHT;
}

// Add this to track loaded chunks

// Initialize the world
generateWorld();

