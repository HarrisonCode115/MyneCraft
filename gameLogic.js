// Create the Three.js scene
const scene = new THREE.Scene();

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Set up the WebGL renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


//Block size
const BLOCK_SIZE = 1

// Map Size
const MAP_SIZE = 10;

const blocks = []


function generateGrid(){
    for(let x = 0; x < MAP_SIZE; x++){
        for(let z = 0; z < MAP_SIZE; z++){
            // Create a cube (represents a Minecraft block)
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const block = new THREE.Mesh(geometry, material)
            block.position.set(x,0,z)

            //Adds block to the world
            scene.add(block)

            blocks.push(block)

        }
    }
}

generateGrid()
// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    renderer.render(scene, camera);
}
animate();
