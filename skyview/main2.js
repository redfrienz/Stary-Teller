import * as THREE from './js/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';
import { csvParse } from './js/d3-dsv.module.js';
import { CSS2DRenderer, CSS2DObject } from './js/CSS2DRenderer.js';


// Set a path to the data
const path = './data/StarCatalogue_HD100546b.csv';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(0, 0, 1);
const raDecGroup = new THREE.Group();
const constellationLinesGroup = new THREE.Group();
scene.add(constellationLinesGroup);
scene.add(raDecGroup);
scene.background = new THREE.Color(0x000000);

let starsData;
let stars;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.rotateSpeed = 0.75;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

function setMapVisibilityState(isVisible) {
    const event = new CustomEvent('mapVisibilityChange', { detail: { isVisible } });
    document.dispatchEvent(event);
}

let isGalaxyVisible = true;

document.addEventListener('DOMContentLoaded', () => {

    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingOverlay.style.color = 'white';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '1000';
    loadingOverlay.innerHTML = '<p>Loading, please wait...</p>';
    document.body.appendChild(loadingOverlay);

    async function initThreeJS() {
        await loadStarData();
        createStars(starsData);
        loadOwnConstellation();
        addRaDecLines();
        animate();
        setMapVisibilityState(false);
        addMilkyWayTexture(122.932, 27.128, 80.1578);

        loadingOverlay.style.display = 'none';
    }
    

    initThreeJS();

    const container = document.getElementById('container');
    const skyCanvas = document.getElementById('skyCanvas');
    const viewToggleButton = document.getElementById('viewToggle');
    const mapContainer = document.getElementById('mapContainer');
    const mapToggleButton = document.getElementById('mapToggle');
    mapToggleButton.textContent = 'Map';

    container.style.display = 'block';
    skyCanvas.style.display = 'none';
    mapContainer.style.display = 'none';
    viewToggleButton.textContent = '2D View';

    // Logic for switching between 2D or 3D when the button is clicked
    viewToggleButton.addEventListener('click', async () => {
        loadingOverlay.style.display = 'flex';

        if (skyCanvas.style.display === 'none') {
            container.style.display = 'block';
            skyCanvas.style.display = 'none';
            viewToggleButton.textContent = '2D View';
            isConstellationVisible = true;
            loadOwnConstellation();
            loadingOverlay.style.display = 'none';
        } else {
            // 3D to 2D
            const { ra, dec } = getCameraRaDec();

            localStorage.setItem('currentRa', ra);
            localStorage.setItem('currentDec', dec);
            container.style.display = 'none';
            skyCanvas.style.display = 'block';
            viewToggleButton.textContent = '3D View';
            isConstellationVisible = false;
            await loadOwnConstellation();
            loadingOverlay.style.display = 'none';
        }
    });

    mapToggleButton.addEventListener('click', () => {
        if (mapContainer.style.display === 'none') {
            container.style.display = 'none';
            skyCanvas.style.display = 'none';
            isConstellationVisible = false;
            viewToggleButton.style.display = 'none';
            loadOwnConstellation();
            mapToggleButton.textContent = 'X';
            mapContainer.style.display = 'block';
            saveOwnConstellationData();
            setMapVisibilityState(true);
            helpButton.style.display = 'none';
        } else {
            mapContainer.style.display = 'none';
            isConstellationVisible = true;
            container.style.display = 'block';
            skyCanvas.style.display = 'none';
            mapToggleButton.textContent = 'Map';
            viewToggleButton.style.display = 'block';
            helpButton.style.display = 'block';
            loadOwnConstellation();
            setMapVisibilityState(false);
        }
    });

});




// Add an HTML element for the star information tooltip
const starInfoTooltip = document.createElement('div');
starInfoTooltip.style.position = 'absolute';
starInfoTooltip.style.top = '10px';
starInfoTooltip.style.left = '10px';
starInfoTooltip.style.padding = '10px';
starInfoTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
starInfoTooltip.style.color = 'white';
starInfoTooltip.style.borderRadius = '5px';
starInfoTooltip.style.zIndex = '100';
starInfoTooltip.style.display = 'none';
document.body.appendChild(starInfoTooltip);

// Calculate the distance between the mouse coordinates and the star's screen coordinates
function getScreenPosition(position) {
    const vector = position.clone().project(camera);
    const x = (vector.x + 1) / 2 * window.innerWidth;
    const y = -(vector.y - 1) / 2 * window.innerHeight;
    return { x, y };
}

// Calculate the star's position in spherical coordinates (based on right ascension and declination)
function celestialToSpherical(ra, dec, radius) {
    const raRad = -THREE.MathUtils.degToRad(ra);
    const decRad = THREE.MathUtils.degToRad(dec);

    const x = radius * Math.cos(decRad) * Math.cos(raRad);
    const y = radius * Math.sin(decRad);
    const z = radius * Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z);
}

// Function to add right ascension and declination lines
function addRaDecLines() {
    const radius = 1000;
    const raSegments = 12;
    const decSegments = 6;

    // Add RA lines
    for (let i = 0; i < raSegments; i++) {
        const raAngle = i * 30;
        const raGeometry = new THREE.BufferGeometry();
        const raPositions = [];
        for (let j = 0; j <= 64; j++) {
            const decAngle = (j / 64) * Math.PI - Math.PI / 2;
            const x = radius * Math.cos(decAngle) * Math.cos(THREE.MathUtils.degToRad(raAngle));
            const y = radius * Math.sin(decAngle);
            const z = radius * Math.cos(decAngle) * Math.sin(THREE.MathUtils.degToRad(raAngle));
            raPositions.push(x, y, z);
        }
        raGeometry.setAttribute('position', new THREE.Float32BufferAttribute(raPositions, 3));
        const raMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff });
        const raLine = new THREE.Line(raGeometry, raMaterial);
        raDecGroup.add(raLine);  // Add line to group
    }

    // Add DEC lines
    for (let i = -decSegments; i <= decSegments; i++) {
        const decAngle = i * 30;
        const decGeometry = new THREE.BufferGeometry();
        const decPositions = [];
        for (let j = 0; j <= 360; j++) {
            const raAngle = (j / 360) * Math.PI * 2;
            const x = radius * Math.cos(THREE.MathUtils.degToRad(decAngle)) * Math.cos(raAngle);
            const y = radius * Math.sin(THREE.MathUtils.degToRad(decAngle));
            const z = radius * Math.cos(THREE.MathUtils.degToRad(decAngle)) * Math.sin(raAngle);
            decPositions.push(x, y, z);
        }
        decGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decPositions, 3));
        const decMaterial = new THREE.LineBasicMaterial({ color: 0xff4444 });
        const decLine = new THREE.Line(decGeometry, decMaterial);
        raDecGroup.add(decLine);  // Add line to group
    }
}

let circleOutlineMesh;

//Fuction to create circle ouline around the selected star
function createCircleOutlineAroundStar(starData, starPosition) {
    if (circleOutlineMesh) {
        scene.remove(circleOutlineMesh);
    }

    const textureLoader = new THREE.TextureLoader();
    const spriteMaterial = new THREE.SpriteMaterial({
        map: textureLoader.load('./textures/circle.png'),
        color: 0xff0000,
        transparent: true,
        opacity: 0.7
    });

    circleOutlineMesh = new THREE.Sprite(spriteMaterial);
    circleOutlineMesh.starData = starData;
    updateCircleOutlineScale(starData, starPosition);
    circleOutlineMesh.position.copy(starPosition);
    scene.add(circleOutlineMesh);
}

// Function to update the circle outline's scale based on the camera distance and FOV
function updateCircleOutlineScale(starData, starPosition) {
    if (!circleOutlineMesh) return;
    const magnitude = parseFloat(starData.newmag);
    const distance = camera.position.distanceTo(starPosition);
    const screenSize = 30 * Math.max(Math.exp(-0.2 * magnitude), 0.7);
    const scale = (screenSize * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) / (window.innerHeight / 2);
    circleOutlineMesh.scale.set(scale, scale, 1);
}

// Function to remove the circle outline
function removeCircleOutline() {
    if (circleOutlineMesh) {
        scene.remove(circleOutlineMesh);
        circleOutlineMesh = null;
    }
}

// Function to load star data from a CSV file (stored in the global variable starsData)
async function loadStarData() {
    try {
        const response = await fetch(path);
        const csvText = await response.text();
        starsData = csvParse(csvText); 
    } catch (error) {
        starsData = [];
    }
}

//Function to create stars
function createStars(starsData) {
    const radius = 1000;
    const positions = [];
    const colors = [];
    const sizes = [];
    const originalColors = [];

    starsData.forEach(star => {
        const { newra, newdec, newmag, spectral_type } = star;

        const pos = celestialToSpherical(parseFloat(newra), parseFloat(newdec), radius);
        positions.push(pos.x, pos.y, pos.z);

        const magnitude = parseFloat(newmag);
        const size = Math.exp(-0.28 * magnitude);
        sizes.push(size * 200);

        const brightnessFactor = Math.min(Math.max(0.8, 1 - 0.03 * magnitude), 1);

        let color;
        switch (spectral_type.charAt(0)) {
            case 'O':
                color = new THREE.Color(0.5, 0.5, 1.0).multiplyScalar(brightnessFactor);
                break;
            case 'B':
                color = new THREE.Color(0.7, 0.7, 1.0).multiplyScalar(brightnessFactor);
                break;
            case 'A':
                color = new THREE.Color(0.9, 0.9, 1.0).multiplyScalar(brightnessFactor);
                break;
            case 'F':
                color = new THREE.Color(1.0, 1.0, 0.9).multiplyScalar(brightnessFactor);
                break;
            case 'G':
                color = new THREE.Color(1.0, 0.9, 0.7).multiplyScalar(brightnessFactor);
                break;
            case 'K':
                color = new THREE.Color(1.0, 0.8, 0.6).multiplyScalar(brightnessFactor);
                break;
            case 'M':
                color = new THREE.Color(1.0, 0.7, 0.7).multiplyScalar(brightnessFactor);
                break;
            default:
                color = new THREE.Color(1.0, 1.0, 1.0).multiplyScalar(brightnessFactor);
                break;
        }
        originalColors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
    });

    // Set the star positions, colors, and sizes using BufferGeometry
    const geometry = new THREE.BufferGeometry();

    const positionArray = new Float32Array(positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

    const colorArray = new Float32Array(colors);
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const sizeArray = new Float32Array(sizes);
    geometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

    geometry.setAttribute('originalColor', new THREE.BufferAttribute(new Float32Array(originalColors), 3));

    // Create stars using ShaderMaterial
    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: new THREE.TextureLoader().load('./textures/star.png') },
            projectionType: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;

            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vec4 projectedPosition = mvPosition;
                float dist = length(mvPosition.xyz);
                gl_PointSize = size * (100.0 / dist);
                gl_PointSize = clamp(gl_PointSize, 1.0, 50.0);
                gl_Position = projectionMatrix * projectedPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;

            void main() {
            vec4 color = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
            if (color.a < 0.5) discard;
            gl_FragColor = color;
        }
        `,
        vertexColors: true,
        transparent: true,
        lights: false,
        alphaTest: 0.5
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

// Function to find the closest star to the mouse click coordinates among stars brighter than the specified magnitude
function findClosestStar(mouseX, mouseY, maxMagnitude) {
    let closestStar = null;
    let minDistance = Infinity;

    const positions = stars.geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
        const starData = starsData[i / 3];
        const magnitude = parseFloat(starData.newmag);

        if (magnitude <= maxMagnitude) {
            const starPosition = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const screenPos = getScreenPosition(starPosition);

            const dx = screenPos.x - mouseX;
            const dy = screenPos.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                closestStar = { index: i / 3, screenPos };
            }
        }
    }

    return closestStar;
}


function degreesToDMS(degrees) {
    const sign = degrees < 0 ? "-" : "";
    const absDegrees = Math.abs(degrees);
    const d = Math.floor(absDegrees);
    const m = Math.floor((absDegrees - d) * 60);
    const s = ((absDegrees - d) * 60 - m) * 60;

    return `${sign}${d}° ${m}' ${s.toFixed(1)}"`;
}

function degreesToHMS(degrees) {
    const sign = degrees < 0 ? "-" : "";
    const absDegrees = Math.abs(degrees);
    const hours = Math.floor(absDegrees / 15);
    const minutes = Math.floor((absDegrees % 15) * 4);
    const seconds = (((absDegrees % 15) * 4) - minutes) * 60;

    return `${sign}${hours}h ${minutes}m ${seconds.toFixed(1)}s`;
}

function getStarDisplayName(starData) {
    if (starData.proper) {
        return `${starData.proper} (${starData.name})`;
    } else {
        return starData.name;
    }
}

window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const closestStar = findClosestStar(event.clientX, event.clientY, 6);
    removeCircleOutline();

    if (closestStar && starsData) {
        const starData = starsData[closestStar.index];

        if (starData) {
            // Display star information in the tooltip
            starInfoTooltip.innerHTML = `
                <strong>${getStarDisplayName(starData)}</strong><br>
                Constellation: ${starData.con}<br>
                Right Ascension: ${degreesToHMS(parseFloat(starData.newra))}<br>
                Declination: ${degreesToDMS(parseFloat(starData.newdec))}<br>
                Apperent Mag.: ${parseFloat(starData.newmag).toFixed(2)}<br>
                Absolute Mag.: ${parseFloat(starData.absmag).toFixed(2)}<br>
                Distance: ${Number(parseFloat(starData.newdist).toPrecision(3))} pc <br>
                Temperature: ${parseFloat(starData.temperature).toFixed(0)}K
            `;
            starInfoTooltip.style.display = 'block';
            const starPosition = new THREE.Vector3(
                stars.geometry.attributes.position.getX(closestStar.index),
                stars.geometry.attributes.position.getY(closestStar.index),
                stars.geometry.attributes.position.getZ(closestStar.index)
            );
            createCircleOutlineAroundStar(starData, starPosition);
        }
    }
});

let mousePosition = { x: 0, y: 0 };
let minSelectionDistance = 10;

// Store the current mouse position when the mouse moves
window.addEventListener('mousemove', (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;

    constellationLinesGroup.children.forEach(line => {
        if (line instanceof THREE.Line) {
            if (!blinkingCircles.includes(line)) {
                line.material.opacity = 1.0;
                line.material.transparent = true;
                line.material.needsUpdate = true;
            }
        }
    });

    const { closestLine, minDistance } = findClosestLine(mousePosition.x, mousePosition.y);

    if (closestLine && minDistance < minSelectionDistance) {
        closestLine.material.transparent = true;
        closestLine.material.opacity = 0.5; 
        closestLine.material.needsUpdate = true;
    }
});

// Set the closest constellation to blink when the mouse is clicked
let blinkingCircles = [];

window.addEventListener('click', (event) => {
    const { closestLine, minDistance } = findClosestLine(mousePosition.x, mousePosition.y);

    if (closestLine && minDistance < minSelectionDistance) {
        const index = blinkingCircles.indexOf(closestLine);

        if (index > -1) {
            blinkingCircles.splice(index, 1);
            closestLine.material.opacity = 1.0;
            closestLine.material.needsUpdate = true;
        } else {
            blinkingCircles.push(closestLine);
            closestLine.material.transparent = true;
        }
    }
});

// FOV adjustment function (adjust FOV through scroll events)
function adjustFOV(event) {
    const zoomSpeed = 1;
    const fovMin = 10;
    const fovMax = 75;

    if (event.deltaY > 0) {
        camera.fov = Math.min(fovMax, camera.fov + zoomSpeed);
    } else {
        camera.fov = Math.max(fovMin, camera.fov - zoomSpeed);
    }

    camera.updateProjectionMatrix();
    controls.rotateSpeed = camera.fov / 75;
    if (circleOutlineMesh) {
        updateCircleOutlineScale(circleOutlineMesh.starData, circleOutlineMesh.position);
    }
}

// Add scroll event listener
window.addEventListener('wheel', adjustFOV);

// Function to initiate the camera movement
function rotateCameraToStar(position, starData) {
    starInfoTooltip.innerHTML = `
    <strong>${getStarDisplayName(starData)}</strong><br>
    Constellation: ${starData.con}<br>
    Right Ascension: ${degreesToHMS(parseFloat(starData.newra))}<br>
    Declination: ${degreesToDMS(parseFloat(starData.newdec))}<br>
    Apperent Mag.: ${parseFloat(starData.newmag).toFixed(2)}<br>
    Absolute Mag.: ${parseFloat(starData.absmag).toFixed(2)}<br>
    Distance: ${Number(parseFloat(starData.newdist).toPrecision(3))} pc <br>
    Temperature: ${parseFloat(starData.temperature).toFixed(0)}K
    `;
    starInfoTooltip.style.display = 'block';
    createCircleOutlineAroundStar(starData, position);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (circleOutlineMesh) {
        updateCircleOutlineScale(circleOutlineMesh.starData, circleOutlineMesh.position);
    }
    updateBlinkingStar();
    updateBlinkingCircles();

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Add event listener for "D" key to toggle RA/DEC lines
window.addEventListener('keydown', (event) => {
    if (event.key === 'D' || event.key === 'd' || event.key === 'ㅇ') {
        raDecGroup.visible = !raDecGroup.visible;
    }

    if (event.key === 'C' || event.key === 'c' || event.key === 'ㅊ') {
        if (skyCanvas.style.display === 'none') {
            isConstellationVisible = !isConstellationVisible;
            loadOwnConstellation();
        }
    }
    
    if (event.code === 'Backspace') {
        if (blinkingCircles.length > 0) {
            blinkingCircles.forEach(circle => {
                const lineIndex = constellationLinesGroup.children.indexOf(circle);
                if (lineIndex !== -1) {
                    if (constellationLinesGroup.children.includes(circle)) {
                        constellationLinesGroup.remove(circle);
                        constellationLinesGroup.updateMatrixWorld(true);
                    }
                    Object.keys(groupedLines).forEach(name => {
                        groupedLines[name] = groupedLines[name].filter(line => line !== circle);
                    });
    
                    constellationNamesData = constellationNamesData.filter(data => data.lineIndex !== lineIndex);
                    ownConstellationData = ownConstellationData.filter((_, index) => index !== lineIndex);
                }
            });
    
            saveConstellationNamesData();
            saveOwnConstellationData();
    
            blinkingCircles = [];
            loadOwnConstellation();
        }
    }

    if (event.key === 'Escape') {
        starInfoTooltip.style.display = 'none';
        removeCircleOutline();
        stopStarBlinking();
        selectedStars = [];
        blinkingCircles = [];
        constellationNameModal.style.display = 'none';
        constellationNameModal.style.display = 'none';
        searchModalOverlay.style.display = 'none';
        helpModal.style.display = 'none';
        loadOwnConstellation();
    }

    if (event.key === 'g' || event.key === 'g' || event.key === 'ㅎ'){
        isGalaxyVisible = !isGalaxyVisible;
        toggleMilkyWayVisibility();
        loadOwnConstellation();
    }
});

let blinkingStarIndex = null;
let isConstellationVisible = true;

let ownConstellationData = JSON.parse(localStorage.getItem('ownConstellation')) || [];

let selectedStars = [];

// Function to save astronaut data to local storage
function saveOwnConstellationData() {
    localStorage.setItem('ownConstellation', JSON.stringify(ownConstellationData));
}

let groupedLines = {};
// Function to load and render data
function loadOwnConstellation() {
    constellationLinesGroup.clear();
    groupedLines = {};
    if (isConstellationVisible){
        ownConstellationData.forEach((data, index) => {
            const star1 = starsData[data.starIndex1];
            const star2 = starsData[data.starIndex2];
            const radius = 1000;
            const ra1 = parseFloat(star1.newra);
            const dec1 = parseFloat(star1.newdec);
            const ra2 = parseFloat(star2.newra);
            const dec2 = parseFloat(star2.newdec);

            const pos1 = celestialToSpherical(ra1, dec1, radius);
            const pos2 = celestialToSpherical(ra2, dec2, radius);

            function calculateGreatCircle(pos1, pos2, segments = 100) {
                const points = [];
                const startVector = pos1.clone().normalize();
                const endVector = pos2.clone().normalize();

                for (let i = 0; i <= segments; i++) {
                    const fraction = i / segments;
                    const point = new THREE.Vector3().copy(startVector).lerp(endVector, fraction).normalize().multiplyScalar(radius);
                    points.push(point);
                }

                return points;
            }

            const greatCirclePoints = calculateGreatCircle(pos1, pos2);
            const geometry = new THREE.BufferGeometry().setFromPoints(greatCirclePoints);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            const greatCircleLine = new THREE.Line(geometry, material);
            greatCircleLine.material.transparent = true;
            constellationLinesGroup.add(greatCircleLine);

            const nameData = constellationNamesData.find(nameData => nameData.lineIndex === index);
            if (nameData) {
                if (!groupedLines[nameData.name]) {
                    groupedLines[nameData.name] = [];
                }
                groupedLines[nameData.name].push(greatCircleLine);
            }
        });

        Object.keys(groupedLines).forEach(name => {
            const lines = groupedLines[name];
            let totalPosition = new THREE.Vector3();

            lines.forEach(line => {
                const positions = line.geometry.attributes.position.array;
                const pos1 = new THREE.Vector3(positions[0], positions[1], positions[2]);
                const pos2 = new THREE.Vector3(positions[positions.length - 3], positions[positions.length - 2], positions[positions.length - 1]);
                const centerPosition = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
                totalPosition.add(centerPosition);
            });

            const averagePosition = totalPosition.divideScalar(lines.length);

            const div = document.createElement('div');
            div.className = 'label';
            div.textContent = name;
            div.style.marginTop = '-1em';
            div.style.color = '#00ff00';
            div.style.pointerEvents = 'auto';

            const nameLabel = new CSS2DObject(div);
            nameLabel.position.set(averagePosition.x, averagePosition.y, averagePosition.z);

            // Add click event to the label
            div.addEventListener('click', (event) => {
                event.stopPropagation();
                changeConstellationColor(name, '#ffff00');
            });
            constellationLinesGroup.add(nameLabel);
        });
    }
}

function selectStar(mouseX, mouseY) {
    const closestStar = findClosestStar(mouseX, mouseY, 6);
    if (closestStar && starsData) {
        const starIndex = closestStar.index;
        selectedStars.push(starIndex);

        if (selectedStars.length === 1) {
            blinkingStarIndex = closestStar.index;
            const starData1 = starsData[blinkingStarIndex]
            starInfoTooltip.innerHTML = `
            <strong>First Star: ${getStarDisplayName(starData1)}</strong><br>
            Constellation: ${starData1.con}<br>
            Right Ascension: ${degreesToHMS(parseFloat(starData1.newra))}<br>
            Declination: ${degreesToDMS(parseFloat(starData1.newdec))}<br>
            Apperent Mag.: ${parseFloat(starData1.newmag).toFixed(2)}<br>
            `;
            starInfoTooltip.style.display = 'block';
        }

        if (selectedStars.length === 2) {
            const starIndex1 = selectedStars[0];
            const starIndex2 = selectedStars[1];
            
            ownConstellationData.push({ starIndex1, starIndex2 });
            saveOwnConstellationData();
            stopStarBlinking();
            const starData2 = starsData[starIndex2]
            starInfoTooltip.innerHTML = `
            <strong>Second Star: ${getStarDisplayName(starData2)}</strong><br>
            Constellation: ${starData2.con}<br>
            Right Ascension: ${degreesToHMS(parseFloat(starData2.newra))}<br>
            Declination: ${degreesToDMS(parseFloat(starData2.newdec))}<br>
            Apperent Mag.: ${parseFloat(starData2.newmag).toFixed(2)}<br>
            `;
            starInfoTooltip.style.display = 'block';

            selectedStars = [];
            loadOwnConstellation();
        }
    }
}

window.addEventListener('click', (event) => {
    if (event.shiftKey) {
        selectStar(event.clientX, event.clientY);
        removeCircleOutline();
        loadOwnConstellation();
    }
});

const modalOverlay = document.createElement('div');
modalOverlay.style.position = 'fixed';
modalOverlay.style.top = '0';
modalOverlay.style.left = '0';
modalOverlay.style.width = '100%';
modalOverlay.style.height = '100%';
modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
modalOverlay.style.display = 'flex';
modalOverlay.style.justifyContent = 'center';
modalOverlay.style.alignItems = 'center';
modalOverlay.style.zIndex = '1000';
document.body.appendChild(modalOverlay);

const modalContent = document.createElement('div');
modalContent.style.backgroundColor = '#ffffff';
modalContent.style.padding = '20px';
modalContent.style.borderRadius = '10px';
modalContent.style.textAlign = 'center';
modalContent.style.maxWidth = '400px';
modalContent.style.width = '100%';
modalOverlay.appendChild(modalContent);

const modalText2 = document.createElement('p');
modalText2.innerText = 'Would you like to load the existing data or start fresh?';
modalText2.style.marginBottom = '20px';
modalContent.appendChild(modalText2);

const loadButton = document.createElement('button');
loadButton.innerText = 'Load Existing Data';
loadButton.style.padding = '10px 20px';
loadButton.style.marginRight = '10px';
loadButton.style.backgroundColor = '#4caf50';
loadButton.style.color = 'white';
loadButton.style.border = 'none';
loadButton.style.cursor = 'pointer';
modalContent.appendChild(loadButton);

const resetButton = document.createElement('button');
resetButton.innerText = 'Reset Data';
resetButton.style.padding = '10px 20px';
resetButton.style.backgroundColor = '#f44336';
resetButton.style.color = 'white';
resetButton.style.border = 'none';
resetButton.style.cursor = 'pointer';
modalContent.appendChild(resetButton);

loadButton.addEventListener('click', () => {
    ownConstellationData = JSON.parse(localStorage.getItem('ownConstellation')) || [];
    if (!Array.isArray(ownConstellationData)) {
        ownConstellationData = [];
    }
    loadOwnConstellation();
    closeModal();
});

resetButton.addEventListener('click', () => {
    localStorage.removeItem('ownConstellation');
    localStorage.removeItem('constellationNames');
    ownConstellationData = [];
    constellationNamesData = [];
    raDecGroup.children = raDecGroup.children.filter(child => !(child instanceof THREE.Line && child.material.color.equals(new THREE.Color(0x00ff00))));
    loadOwnConstellation();
    closeModal();
});

function closeModal() {
    modalOverlay.style.display = 'none';
}

window.addEventListener('load', () => {
    modalOverlay.style.display = 'flex';
});


// Function to stop blinking
function stopStarBlinking() {
    if (blinkingStarIndex !== null && blinkingStarIndex >= 0 && stars) {
        const colorsArray = stars.geometry.attributes.color.array;
        const originalColorsArray = stars.geometry.attributes.originalColor.array;

        const index = blinkingStarIndex * 3

        colorsArray[index] = originalColorsArray[index];
        colorsArray[index + 1] = originalColorsArray[index + 1];
        colorsArray[index + 2] = originalColorsArray[index + 2];

        stars.geometry.attributes.color.needsUpdate = true;
    }

    blinkingStarIndex = null;
}

let blinkTime = 0;
function updateBlinkingStar() {
    if (blinkingStarIndex !== null && blinkingStarIndex >= 0 && stars) {
        blinkTime += 0.07;
        const blinkFactor = 0.1 + 0.9 * Math.abs(Math.sin(blinkTime));

        const colorsArray = stars.geometry.attributes.color.array;
        const originalColorsArray = stars.geometry.attributes.originalColor.array;

        const index = blinkingStarIndex * 3;

        colorsArray[index] = originalColorsArray[index] * blinkFactor;
        colorsArray[index + 1] = originalColorsArray[index + 1] * blinkFactor;
        colorsArray[index + 2] = originalColorsArray[index + 2] * blinkFactor;

        stars.geometry.attributes.color.needsUpdate = true;
    }
}

function getCameraRaDec() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    const targetPosition = cameraPosition.clone().add(direction.multiplyScalar(1000));

    const ra = THREE.MathUtils.radToDeg(Math.atan2(-targetPosition.z, targetPosition.x));
    const dec = THREE.MathUtils.radToDeg(Math.asin(targetPosition.y / targetPosition.length()));
    return { ra, dec };
}

function findClosestLine(mouseX, mouseY) {
    let closestLine = null;
    let minDistance = Infinity;

    constellationLinesGroup.children.forEach(line => {
    if (line instanceof THREE.Line) {
        const positions = line.geometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 3) {
            const segmentPosition = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const screenPos = getScreenPosition(segmentPosition);
            const dx = screenPos.x - mouseX;
            const dy = screenPos.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                closestLine = line;
            }
        }
    }
});


    return { closestLine, minDistance };
}

let blinkTime2 = 0;
function updateBlinkingCircles() {
    blinkTime2 += 0.07;
    const blinkFactor = 0.1 + 0.9 * Math.abs(Math.sin(blinkTime2));
    blinkingCircles.forEach(circle => {
        circle.material.opacity = blinkFactor;
        circle.material.needsUpdate = true;
    });
}

// Create a modal window element for naming constellations
const constellationNameModal = document.createElement('div');
constellationNameModal.style.position = 'fixed';
constellationNameModal.style.top = '50%';
constellationNameModal.style.left = '50%';
constellationNameModal.style.transform = 'translate(-50%, -50%)';
constellationNameModal.style.backgroundColor = 'white';
constellationNameModal.style.width = '400px';
constellationNameModal.style.padding = '15px';
constellationNameModal.style.borderRadius = '10px';
constellationNameModal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
constellationNameModal.style.zIndex = '1000';
constellationNameModal.style.display = 'none';
constellationNameModal.style.maxHeight = '80vh';
constellationNameModal.style.overflowY = 'auto';
document.body.appendChild(constellationNameModal);

const draggableHeader = document.createElement('div');
draggableHeader.style.width = '100%';
draggableHeader.style.height = '30px';
draggableHeader.style.cursor = 'move';
draggableHeader.style.position = 'absolute';
draggableHeader.style.top = '0';
draggableHeader.style.left = '0';
constellationNameModal.appendChild(draggableHeader);

const closeButton = document.createElement('button');
closeButton.textContent = 'X';
closeButton.style.position = 'absolute';
closeButton.style.top = '5px';
closeButton.style.right = '10px';
closeButton.style.backgroundColor = 'transparent';
closeButton.style.border = 'none';
closeButton.style.fontSize = '20px';
closeButton.style.cursor = 'pointer';
closeButton.style.color = '#333';
closeButton.addEventListener('mouseenter', () => {
    closeButton.style.color = 'red'; 
});
closeButton.addEventListener('mouseleave', () => {
    closeButton.style.color = '#333'; 
});
closeButton.addEventListener('click', () => {
    constellationNameModal.style.display = 'none';
});
constellationNameModal.appendChild(closeButton);

const modalText = document.createElement('p');
modalText.textContent = 'Choose a constellation name:';
modalText.style.marginBottom = '10px';
constellationNameModal.appendChild(modalText);

const ConSearchInput = document.createElement('input');
ConSearchInput.type = 'text';
ConSearchInput.placeholder = 'Search for a name...';
ConSearchInput.style.width = '90%';
ConSearchInput.style.marginBottom = '10px';
ConSearchInput.style.padding = '10px';
constellationNameModal.appendChild(ConSearchInput);

const nameListContainer = document.createElement('div');
nameListContainer.style.maxHeight = '300px'; 
nameListContainer.style.overflowY = 'auto'; 
nameListContainer.style.border = '1px solid #ddd';
nameListContainer.style.padding = '10px';
nameListContainer.style.borderRadius = '5px';
constellationNameModal.appendChild(nameListContainer);

const addButton = document.createElement('button');
addButton.textContent = '+ Add new name';
addButton.style.display = 'block';
addButton.style.width = '80%';
addButton.style.margin = '10px auto';
addButton.style.padding = '10px';
addButton.style.cursor = 'pointer';
addButton.style.fontWeight = 'bold';
constellationNameModal.appendChild(addButton);

// Create a list of names (load from local storage)
let constellationNamesData = JSON.parse(localStorage.getItem('constellationNames')) || [];
const nameList = [...new Set(constellationNamesData.map(data => data.name))];
nameList.sort();
const nameButtons = [];

function createNameButton(name) {
    const nameButton = document.createElement('button');
    nameButton.textContent = name;
    nameButton.style.display = 'block';
    nameButton.style.width = '100%';
    nameButton.style.margin = '5px 0';
    nameButton.style.padding = '10px';
    nameButton.style.cursor = 'pointer';
    nameButton.addEventListener('click', () => {
        saveConstellationName(name, blinkingCircles);
        constellationNameModal.style.display = 'none';
    });
    nameListContainer.appendChild(nameButton);
    nameButtons.push(nameButton);
}

nameList.forEach(name => {
    createNameButton(name);
});

ConSearchInput.addEventListener('input', () => {
    const searchTerm = ConSearchInput.value.toLowerCase();
    nameButtons.forEach(button => {
        if (button.textContent.toLowerCase().includes(searchTerm)) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }
    });
});

addButton.addEventListener('click', () => {
    const newName = prompt('Enter the new constellation name:');
    if (newName) {
        if (!nameList.includes(newName)) {
            nameList.push(newName);
            constellationNamesData.push({ name: newName });
            createNameButton(newName);
            saveConstellationNamesData();
            nameList.sort();
        } else {
            alert('The name already exists in the list.');
        }
    }
});

let isDragging = false;
let offsetX, offsetY;

const handleMouseDown = (event) => {
    isDragging = true;
    offsetX = event.clientX - constellationNameModal.getBoundingClientRect().left;
    offsetY = event.clientY - constellationNameModal.getBoundingClientRect().top;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (event) => {
    if (isDragging) {
        constellationNameModal.style.left = `${event.clientX - offsetX}px`;
        constellationNameModal.style.top = `${event.clientY - offsetY}px`;
        constellationNameModal.style.transform = ''; // 드래그 중에는 transform 제거
    }
};

const handleMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
};

draggableHeader.addEventListener('mousedown', handleMouseDown);

function saveConstellationName(name, blinkingCircles) {
    if (blinkingCircles.length > 0) {
        blinkingCircles.forEach(circle => {
            const index = constellationLinesGroup.children.indexOf(circle);
            if (index !== -1) {
                const existingNameData = constellationNamesData.find(data => data.lineIndex === index);
                if (existingNameData) {
                    existingNameData.name = name;
                } else {
                    constellationNamesData.push({ lineIndex: index, name });
                }
            }
        });

        loadOwnConstellation();
        saveConstellationNamesData();
        blinkingCircles = [];
    }
}

// Function to save constellation name data to local storage
function saveConstellationNamesData() {
    localStorage.setItem('constellationNames', JSON.stringify(constellationNamesData));
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'N' || event.key === 'n' || event.key ==='ㅜ') {
        if (blinkingCircles.length > 0) {
            ConSearchInput.value = '';
            nameButtons.forEach(button => button.style.display = 'block');
            constellationNameModal.style.display = 'block';
        }
    }
});

function changeConstellationColor(name, color) {
    if (groupedLines[name]) {
        const lines = groupedLines[name];
        const isRed = lines.every(line => line.material.color.equals(new THREE.Color(0xffff00)));

        const newColor = isRed ? 0x00ff00 : 0xffff00;
        lines.forEach(line => {
            line.material.color.set(newColor);
            line.material.needsUpdate = true;
        });

        constellationLinesGroup.children.forEach(child => {
            if (child instanceof CSS2DObject && child.element.textContent === name) {
                child.element.style.color = newColor === 0xffff00 ? '#ffff00' : '#00ff00';
            }
        });
    }
}

// Modal for searching star names
const searchModalOverlay = document.createElement('div');
searchModalOverlay.style.position = 'fixed';
searchModalOverlay.style.top = '0';
searchModalOverlay.style.left = '0';
searchModalOverlay.style.width = '100%';
searchModalOverlay.style.height = '100%';
searchModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
searchModalOverlay.style.display = 'flex';
searchModalOverlay.style.justifyContent = 'center';
searchModalOverlay.style.alignItems = 'center';
searchModalOverlay.style.zIndex = '1000';
searchModalOverlay.style.display = 'none'; // Initially hidden
document.body.appendChild(searchModalOverlay);

const searchModalContent = document.createElement('div');
searchModalContent.style.backgroundColor = '#ffffff';
searchModalContent.style.padding = '20px';
searchModalContent.style.borderRadius = '10px';
searchModalContent.style.textAlign = 'center';
searchModalContent.style.maxWidth = '400px';
searchModalContent.style.width = '100%';
searchModalOverlay.appendChild(searchModalContent);

const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search for a star...';
searchInput.style.width = '90%';
searchInput.style.marginBottom = '10px';
searchInput.style.padding = '10px';
searchModalContent.appendChild(searchInput);

const searchResultsContainer = document.createElement('div');
searchResultsContainer.style.padding = '10px';
searchResultsContainer.style.border = '1px solid #ddd';
searchResultsContainer.style.borderRadius = '5px';
searchModalContent.appendChild(searchResultsContainer);

// Function to filter stars by name and display in the modal
function searchStarsByName(query) {
    searchResultsContainer.innerHTML = '';
    if (query.trim() === '') {
        return;
    }

    const results = starsData
        .filter(star => {
            const starName = star.proper ? star.proper : star.name;
            return starName.toLowerCase().includes(query.toLowerCase());
        })
        .slice(0, 5);

    results.forEach(star => {
        const resultButton = document.createElement('button');
        resultButton.textContent = star.proper ? `${star.proper} (${star.name})` : star.name;
        resultButton.style.display = 'block';
        resultButton.style.width = '100%';
        resultButton.style.margin = '5px 0';
        resultButton.style.padding = '10px';
        resultButton.style.cursor = 'pointer';
        resultButton.addEventListener('click', () => {
            const starPosition = celestialToSpherical(parseFloat(star.newra), parseFloat(star.newdec), 1000);
            rotateCameraToStar(starPosition, star);
            searchModalOverlay.style.display = 'none';
        });
        searchResultsContainer.appendChild(resultButton);
    });
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'F' || event.key === 'f') {
        searchModalOverlay.style.display = 'flex';
        searchInput.value = '';
        searchResultsContainer.innerHTML = '';
        searchInput.focus();
    }
});

// Add input event listener to filter stars as the user types
searchInput.addEventListener('input', () => {
    searchStarsByName(searchInput.value);
});

const helpButton = document.createElement('button');
helpButton.style.position = 'fixed';
helpButton.style.bottom = '20px';
helpButton.style.right = '20px';
helpButton.style.width = '50px';
helpButton.style.height = '50px';
helpButton.style.borderRadius = '50%';
helpButton.style.backgroundColor = '#007bff';
helpButton.style.color = 'white';
helpButton.style.border = 'none';
helpButton.style.cursor = 'pointer';
helpButton.style.fontSize = '24px';
helpButton.style.fontWeight = 'bold';
helpButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
helpButton.style.transition = 'transform 0.2s, box-shadow 0.2s';
helpButton.textContent = '?';
helpButton.style.zIndex = '1000';

document.body.appendChild(helpButton);

const helpModal = document.createElement('div');
helpModal.style.position = 'fixed';
helpModal.style.top = '50%';
helpModal.style.left = '50%';
helpModal.style.transform = 'translate(-50%, -50%)';
helpModal.style.backgroundColor = 'white';
helpModal.style.padding = '30px';
helpModal.style.borderRadius = '15px';
helpModal.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.5)';
helpModal.style.zIndex = '1000';
helpModal.style.display = 'none';
helpModal.style.maxWidth = '500px';
helpModal.style.width = '100%';
helpModal.style.fontFamily = 'Arial, sans-serif';

document.body.appendChild(helpModal);

helpModal.innerHTML = `
    <h3 style="margin-top: 0; text-align: center;">Key Functions</h3>
    <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">C</span> : Toggle constellations
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">D</span> : Toggle RA/DEC lines
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">G</span> : Toggle Milkyway Texture
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">N</span> : Name selected constellation
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">F</span> : Search for a star
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">Click</span> : Select lines and cancel the selection
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">Right-click</span> : Show the information of the star
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">Shift + Click</span> : Create a line between the stars
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">ESC</span> : Hide tooltips and stop blinking
        </li>

        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">3D View / 2D View</span> : Change the dimension of the view
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">Map</span> : Show the entire map of the sky
        </li>

    </ul>
    <button id="closeHelpButton" style="padding: 10px 20px; margin-top: 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);">Close</button>
`;

helpButton.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

helpModal.addEventListener('click', (event) => {
    const target = event.target;

    if (target.id === 'closeHelpButton') {
        helpModal.style.display = 'none';
    }
});

let milkyWay = null;

function addMilkyWayTexture(galacticNorthRa, galacticNorthDec, galacticCenterRa) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('./textures/milkyway.png', (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(1, 1);

        const milkyWayMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            color: 0xffffff
        });

        const milkyWayRadius  = 1200;
        const milkyWayHeight = 1600;
        const milkyWayGeometry = new THREE.CylinderGeometry(
            milkyWayRadius,
            milkyWayRadius,
            milkyWayHeight,
            128,
            1,
            true,
            0,
            Math.PI * 2.003
        );
    
        milkyWay = new THREE.Mesh(milkyWayGeometry, milkyWayMaterial);

        const galacticNorthRadRa = THREE.MathUtils.degToRad(galacticNorthRa);
        const galacticNorthRadDec = THREE.MathUtils.degToRad(galacticNorthDec);
        const galacticCenterRadRa = THREE.MathUtils.degToRad(galacticCenterRa);

        milkyWay.rotation.order = 'YXZ';
        milkyWay.rotation.y = -galacticNorthRadRa;
        milkyWay.rotation.x = galacticNorthRadDec;

        milkyWay.rotateZ(-galacticCenterRadRa);

        if (isGalaxyVisible) {
            scene.add(milkyWay);
        }
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambientLight);
}

function toggleMilkyWayVisibility() {
    if (milkyWay) {
        if (isGalaxyVisible) {
            scene.add(milkyWay);
        } else {
            scene.remove(milkyWay);
        }
    }
}
