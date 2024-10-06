// main.js - 기존의 Three.js 설정을 3D view에서만 실행되도록 수정합니다.

import * as THREE from './js/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';
import { csvParse } from './js/d3-dsv.module.js';
//data 경로
const path = './data/StarCatalogue_PSRB125712b.csv';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(0, 0, 1);
const raDecGroup = new THREE.Group();
const constellationLinesGroup = new THREE.Group();
scene.add(constellationLinesGroup);
scene.add(raDecGroup);
scene.background = new THREE.Color(0x000000); // 배경을 검정색으로 설정

let starsData;
let stars;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.rotateSpeed = 0.75;


document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');
    const skyCanvas = document.getElementById('skyCanvas');
    const viewToggleButton = document.getElementById('viewToggle');

    // 기본적으로 3D view를 활성화된 상태로 시작
    container.style.display = 'block';
    skyCanvas.style.display = 'none';
    viewToggleButton.textContent = 'Switch to 2D View';

    async function initThreeJS() {
        await loadStarData(); // 별 데이터를 로드할 때까지 대기
        createStars(starsData); // 별들을 생성

        // 별 데이터를 모두 로드한 후에 대원을 로드
        loadOwnConstellation();
        addRaDecLines();
        animate();
    }

    initThreeJS();

    // 버튼 클릭 시 2D 또는 3D 전환 로직
    viewToggleButton.addEventListener('click', () => {
        if (skyCanvas.style.display === 'none') {
            // 2D에서 3D로 전환
            container.style.display = 'block';
            skyCanvas.style.display = 'none';
            viewToggleButton.textContent = 'Switch to 2D View';
        } else {
            // 3D에서 2D로 전환
            const { ra, dec } = getCameraRaDec();

            // 값을 localStorage에 저장하여 skyview.js에서 사용하도록 설정
            localStorage.setItem('currentRa', ra);
            localStorage.setItem('currentDec', dec);

            // 뷰 전환
            container.style.display = 'none';
            skyCanvas.style.display = 'block';
            viewToggleButton.textContent = 'Switch to 3D View';
        }
    });
});



// 별 정보 툴팁 HTML 요소 추가
const starInfoTooltip = document.createElement('div');
starInfoTooltip.style.position = 'absolute';
starInfoTooltip.style.top = '10px';
starInfoTooltip.style.left = '10px';
starInfoTooltip.style.padding = '10px';
starInfoTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
starInfoTooltip.style.color = 'white';
starInfoTooltip.style.borderRadius = '5px';
starInfoTooltip.style.zIndex = '100';
starInfoTooltip.style.display = 'none'; // 기본적으로 숨김
document.body.appendChild(starInfoTooltip);

// 마우스 좌표와 별의 화면 좌표 간의 거리 계산
function getScreenPosition(position) {
    const vector = position.clone().project(camera); // 3D 좌표를 2D 화면 좌표로 변환
    const x = (vector.x + 1) / 2 * window.innerWidth;
    const y = -(vector.y - 1) / 2 * window.innerHeight;
    return { x, y };
}

// 구면 좌표계로 별의 위치 계산 (적경, 적위 기반)
function celestialToSpherical(ra, dec, radius) {
    const raRad = -THREE.MathUtils.degToRad(ra); // 적경을 라디안으로 변환
    const decRad = THREE.MathUtils.degToRad(dec);

    const x = radius * Math.cos(decRad) * Math.cos(raRad);
    const y = radius * Math.sin(decRad);
    const z = radius * Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z);
}

// 적경선 및 적위선 추가 함수
function addRaDecLines() {
    const radius = 1000; // 천구의 반지름
    const raSegments = 12; // 적경선을 30도 간격으로 나눔 (360도 / 30도 = 12개)
    const decSegments = 6;  // 적위선을 30도 간격으로 나눔 (-90도에서 90도까지 6개)

    // 적경선 (RA) 추가
    for (let i = 0; i < raSegments; i++) {
        const raAngle = i * 30; // 적경을 30도 간격으로 선을 그림
        const raGeometry = new THREE.BufferGeometry();
        const raPositions = [];
        for (let j = 0; j <= 64; j++) {
            const decAngle = (j / 64) * Math.PI - Math.PI / 2; // -90도에서 90도까지
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

    // 적위선 (DEC) 추가
    for (let i = -decSegments; i <= decSegments; i++) {
        const decAngle = i * 30; // 적위를 30도 간격으로 선을 그림
        const decGeometry = new THREE.BufferGeometry();
        const decPositions = [];
        for (let j = 0; j <= 360; j++) {
            const raAngle = (j / 360) * Math.PI * 2; // 0도에서 360도까지 적경을 그림
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

let circleOutlineMesh;  // To store the current circle outline

// Function to create a red circle outline around a star that doesn't scale with FOV
function createCircleOutlineAroundStar(starData, starPosition) {
    // Remove existing circle if it exists
    if (circleOutlineMesh) {
        scene.remove(circleOutlineMesh);
    }

    // Create sprite material using the provided circle texture
    const textureLoader = new THREE.TextureLoader();
    const spriteMaterial = new THREE.SpriteMaterial({
        map: textureLoader.load('./textures/circle.png'), // 사용할 원 텍스처
        color: 0xff0000,
        transparent: true,
        opacity: 0.7
    });

    // Create the sprite
    circleOutlineMesh = new THREE.Sprite(spriteMaterial);

    // Set the initial scale of the sprite
    circleOutlineMesh.starData = starData;
    updateCircleOutlineScale(starData, starPosition);

    // Position the sprite at the star's position
    circleOutlineMesh.position.copy(starPosition);

    // Add the sprite to the scene
    scene.add(circleOutlineMesh);
}

// Function to update the circle outline's scale based on the camera distance and FOV
function updateCircleOutlineScale(starData, starPosition) {
    if (!circleOutlineMesh) return;
    const magnitude = parseFloat(starData.newmag);
    const distance = camera.position.distanceTo(starPosition);
    const screenSize = 30 * Math.max(Math.exp(-0.2 * magnitude), 0.7); // Desired size relative to screen height

    // Calculate the physical size of the circle based on distance and FOV
    const scale = (screenSize * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) / (window.innerHeight / 2);

    // Set the scale of the circle outline
    circleOutlineMesh.scale.set(scale, scale, 1);
}

// Function to remove the circle outline
function removeCircleOutline() {
    if (circleOutlineMesh) {
        scene.remove(circleOutlineMesh);
        circleOutlineMesh = null;  // Clear the reference
    }
}

// CSV 파일에서 별 데이터를 불러오는 함수 (전역 변수 starsData에 저장)
// 데이터 로드 함수 (`loadStarData`)
async function loadStarData() {
    try {
        const response = await fetch(path);
        const csvText = await response.text();
        starsData = csvParse(csvText); // CSV 데이터를 파싱하고 전역 변수 starsData에 저장
    } catch (error) {
        console.error('CSV 데이터 로드 중 오류 발생:', error);
        starsData = []; // 로드 실패 시 빈 배열로 초기화
    }
}

function createStars(starsData) {
    const radius = 1000; // 천구의 반지름
    const positions = [];
    const colors = [];
    const sizes = [];
    const originalColors = []; // 초기 색상을 저장하기 위한 배열

    starsData.forEach(star => {
        const { mag, newra, newdec, newmag, spectral_type } = star;

        // 적경과 적위를 기반으로 별의 위치를 계산
        const pos = celestialToSpherical(parseFloat(newra), parseFloat(newdec), radius);
        positions.push(pos.x, pos.y, pos.z);

        // 밝기 등급에 따른 별의 크기 설정
        const magnitude = parseFloat(newmag);
        const size = Math.max(Math.exp(-0.28 * magnitude), 0.1); // 밝기 등급에 따른 지수 함수 크기
        sizes.push(size * 200); // 크기 조정

        // 밝기 등급에 따른 기본 밝기 계산
        const brightnessFactor = Math.min(30 * Math.pow(10, -0.3 * magnitude), 1.0); // 밝기 등급에 따른 지수 함수 (0 ~ 1 범위로 조정)

        // 분광형에 따른 색상 설정 (brightnessFactor를 사용해 색상에 밝기 반영)
        let color;
        switch (spectral_type.charAt(0)) {
            case 'O':
                color = new THREE.Color(0.5, 0.5, 1.0).multiplyScalar(brightnessFactor); // 파란색
                break;
            case 'B':
                color = new THREE.Color(0.7, 0.7, 1.0).multiplyScalar(brightnessFactor); // 푸른색
                break;
            case 'A':
                color = new THREE.Color(0.9, 0.9, 1.0).multiplyScalar(brightnessFactor); // 청백색
                break;
            case 'F':
                color = new THREE.Color(1.0, 1.0, 0.9).multiplyScalar(brightnessFactor); // 흰색
                break;
            case 'G':
                color = new THREE.Color(1.0, 0.9, 0.7).multiplyScalar(brightnessFactor); // 황백색
                break;
            case 'K':
                color = new THREE.Color(1.0, 0.8, 0.6).multiplyScalar(brightnessFactor); // 주황색
                break;
            case 'M':
                color = new THREE.Color(1.0, 0.7, 0.7).multiplyScalar(brightnessFactor); // 붉은색
                break;
            default:
                color = new THREE.Color(1.0, 1.0, 1.0).multiplyScalar(brightnessFactor); // 기본값: 흰색
                break;
        }

        // 초기 색상과 현재 색상 배열에 값 추가
        originalColors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
    });

    // BufferGeometry를 사용해 별의 위치와 색상, 크기를 설정
    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

    const colorArray = new Float32Array(colors);
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const sizeArray = new Float32Array(sizes);
    geometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

    // 초기 색상을 저장한 배열을 geometry에 추가
    geometry.setAttribute('originalColor', new THREE.BufferAttribute(new Float32Array(originalColors), 3));

    // ShaderMaterial을 사용해 별을 생성
    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: new THREE.TextureLoader().load('./textures/star.png') },
            projectionType: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            uniform float projectionType;
            uniform mat4 orthographicMatrix;

            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                // 투영 타입에 따라 직교 또는 기본 투영 선택
                vec4 projectedPosition = mvPosition;
                if (projectionType == 1.0) {
                    projectedPosition = orthographicMatrix * mvPosition; // 직교 투영
                }

                // 화면 공간으로 변환된 z 좌표를 기반으로 크기 보정
                float dist = length(mvPosition.xyz);
                gl_PointSize = size * (100.0 / dist); // 거리에 따라 점 크기 보정
                gl_PointSize = clamp(gl_PointSize, 1.0, 50.0); // 최소/최대 크기 제한
                gl_Position = projectionMatrix * projectedPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;

            void main() {
                gl_FragColor = vec4(vColor, 1.0);
                gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
            }
        `,
        vertexColors: true,
        transparent: true
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

// 마우스 클릭 좌표와 지정한 mag 등급보다 밝은 별들 중 가장 가까운 별을 찾기 함수
function findClosestStar(mouseX, mouseY, maxMagnitude) {
    let closestStar = null;
    let minDistance = Infinity;

    const positions = stars.geometry.attributes.position.array;
    
    // Loop through all stars in the data and filter by magnitude
    for (let i = 0; i < positions.length; i += 3) {
        const starData = starsData[i / 3]; // Get the star data from the starsData array
        const magnitude = parseFloat(starData.newmag); // Get the magnitude of the star

        // Only consider stars with a magnitude brighter (lower) than maxMagnitude
        if (magnitude <= maxMagnitude) {
            const starPosition = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const screenPos = getScreenPosition(starPosition);

            const dx = screenPos.x - mouseX;
            const dy = screenPos.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Update closest star if this one is closer
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
    // Check if the 'proper' property exists and is not null or undefined
    if (starData.proper) {
        return `${starData.proper} (${starData.name})`;  // Return proper(name) format
    } else {
        return starData.name;  // Return name only if proper doesn't exist
    }
}

// 마우스 우클릭 이벤트 처리
window.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const closestStar = findClosestStar(event.clientX, event.clientY, 6);
    removeCircleOutline();

    if (closestStar && starsData) {
        const starData = starsData[closestStar.index]; // starsData에서 해당 별의 데이터를 가져옴

        if (starData) {
            // 별 정보를 툴팁에 표시
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

let mousePosition = { x: 0, y: 0 }; // 현재 마우스 위치를 저장하는 변수
let minSelectionDistance = 13; // 별자리와의 최소 선택 거리

// 마우스 이동 시 현재 마우스 위치를 저장
window.addEventListener('mousemove', (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;

    constellationLinesGroup.children.forEach(line => {
        if (line !== blinkingCircle) {
            line.material.opacity = 1.0;
            line.material.transparent = true;
            line.material.needsUpdate = true;
        }
    });

    // 가장 가까운 별자리를 찾고, 거리가 1보다 작으면 투명도를 낮춤
    const { closestLine, minDistance } = findClosestLine(mousePosition.x, mousePosition.y);

    if (closestLine && minDistance < minSelectionDistance) {
        if (closestLine !== blinkingCircle){
            closestLine.material.transparent = true;
            closestLine.material.opacity = 0.5; 
            closestLine.material.needsUpdate = true; // 업데이트 필요
        }
    }
});

// 마우스를 클릭했을 때 가장 가까운 별자리를 깜빡이도록 설정
window.addEventListener('click', (event) => {
    const { closestLine, minDistance } = findClosestLine(mousePosition.x, mousePosition.y);

    if (closestLine && minDistance < minSelectionDistance) {
        // 이전에 깜빡이고 있던 대원이 있다면 투명도 초기화
        if (blinkingCircle) {
            blinkingCircle = null;
        }

        // 새로 깜빡이는 대원 설정
        blinkingCircle = closestLine;
        blinkingCircle.material.transparent = true; // 투명도 조절을 위해 transparent를 true로 설정
    }
});




// FOV 조정 함수 (스크롤 이벤트를 통해 FOV를 조정)
function adjustFOV(event) {
    const zoomSpeed = 1; // 줌 속도
    const fovMin = 10; // 최소 FOV 값
    const fovMax = 75; // 최대 FOV 값

    // 스크롤 방향에 따라 FOV 조정
    if (event.deltaY > 0) {
        camera.fov = Math.min(fovMax, camera.fov + zoomSpeed);
    } else {
        camera.fov = Math.max(fovMin, camera.fov - zoomSpeed);
    }

    camera.updateProjectionMatrix(); // 변경된 FOV를 반영
    controls.rotateSpeed = camera.fov / 75;
    if (circleOutlineMesh) {
        updateCircleOutlineScale(circleOutlineMesh.starData, circleOutlineMesh.position);
    }
}

// 스크롤 이벤트 리스너 추가
window.addEventListener('wheel', adjustFOV);

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    if (circleOutlineMesh) {
        updateCircleOutlineScale(circleOutlineMesh.starData, circleOutlineMesh.position);
    }
    updateBlinkingStar();
    updateBlinkingCircle();
}

// 윈도우 리사이즈 처리
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add event listener for "D" key to toggle RA/DEC lines
window.addEventListener('keydown', (event) => {
    if (event.key === 'D' || event.key === 'd' || event.key === 'ㅇ') {
        raDecGroup.visible = !raDecGroup.visible;
    }

    if (event.key === 'C' || event.key === 'c' || event.key === 'ㅊ') {
        constellationLinesGroup.clear()
        isConstellationVisible = !isConstellationVisible; // 상태 토글
    }
    
    if (event.code === 'Backspace') {
        if (blinkingCircle) {
            const lineIndex = constellationLinesGroup.children.indexOf(blinkingCircle);
            if (lineIndex >= 0) {
                ownConstellationData.splice(lineIndex, 1); // 해당 데이터를 제거
                saveOwnConstellationData(); // 업데이트된 데이터를 로컬 저장소에 저장
                loadOwnConstellation(); // 대원 다시 로드
            }
        }
    }

    if (event.key === 'Escape') {
        starInfoTooltip.style.display = 'none';
        removeCircleOutline();
        stopStarBlinking();
        selectedStars = [];
        blinkingCircle = null;
        loadOwnConstellation();
    }
});

let blinkingStarIndex = null;
let isConstellationVisible = true;
let blinkingCircle = null; // 현재 깜빡이는 대원

// 대원 데이터를 저장할 배열 (전역 변수로 선언)
let ownConstellationData = JSON.parse(localStorage.getItem('ownConstellation')) || [];

// 선택된 별 인덱스를 저장할 배열 (전역 변수로 선언)
let selectedStars = [];

// 대원 데이터를 로컬 스토리지에 저장하는 함수
function saveOwnConstellationData() {
    localStorage.setItem('ownConstellation', JSON.stringify(ownConstellationData));
}

// 대원 데이터 로드 및 렌더링 함수
function loadOwnConstellation() {
    // 기존 대원들을 모두 제거하고 다시 그리기
    constellationLinesGroup.clear();
    if (isConstellationVisible) {
        // ownConstellationData를 기반으로 대원 다시 그리기
        ownConstellationData.forEach(data => {

            const star1 = starsData[data.starIndex1];
            const star2 = starsData[data.starIndex2];
            const radius = 1000;
            const ra1 = parseFloat(star1.newra);
            const dec1 = parseFloat(star1.newdec);
            const ra2 = parseFloat(star2.newra);
            const dec2 = parseFloat(star2.newdec);

            // 좌표 변환 시 필요한 라디안 값으로 변환
            const pos1 = celestialToSpherical(ra1, dec1, radius);
            const pos2 = celestialToSpherical(ra2, dec2, radius);

            // 두 위치 사이의 대원 경로를 계산
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

        });
    }
}


// Shift + 클릭으로 별 선택
function selectStar(mouseX, mouseY) {
    const closestStar = findClosestStar(mouseX, mouseY, 6); // 마우스 클릭 위치에서 가장 가까운 별을 찾음
    if (closestStar && starsData) {
        const starIndex = closestStar.index;
        // 선택된 별을 배열에 추가
        selectedStars.push(starIndex);

        // 두 별이 선택되었을 때 대원 데이터 추가
        if (selectedStars.length === 1) {
            blinkingStarIndex = closestStar.index;
            const starData1 = starsData[blinkingStarIndex]
            // 별 정보를 툴팁에 표시
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
            // 별 정보를 툴팁에 표시
            starInfoTooltip.innerHTML = `
            <strong>Second Star: ${getStarDisplayName(starData2)}</strong><br>
            Constellation: ${starData2.con}<br>
            Right Ascension: ${degreesToHMS(parseFloat(starData2.newra))}<br>
            Declination: ${degreesToDMS(parseFloat(starData2.newdec))}<br>
            Apperent Mag.: ${parseFloat(starData2.newmag).toFixed(2)}<br>
            `;
            starInfoTooltip.style.display = 'block';

            // 선택 초기화
            selectedStars = [];
        }
    }
}

// 마우스 클릭 이벤트 핸들러 추가 (Shift + Click으로 별 선택)
window.addEventListener('click', (event) => {
    if (event.shiftKey) { // Shift 키가 눌렸을 때만 별을 선택
        selectStar(event.clientX, event.clientY);
        removeCircleOutline();
        loadOwnConstellation();
    }
});

// 모달 요소 생성
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

// 모달 내부 텍스트 추가
const modalText = document.createElement('p');
modalText.innerText = 'Would you like to load the existing data or start fresh?';
modalText.style.marginBottom = '20px';
modalContent.appendChild(modalText);

// 'Load Existing Data' 버튼
const loadButton = document.createElement('button');
loadButton.innerText = 'Load Existing Data';
loadButton.style.padding = '10px 20px';
loadButton.style.marginRight = '10px';
loadButton.style.backgroundColor = '#4caf50';
loadButton.style.color = 'white';
loadButton.style.border = 'none';
loadButton.style.cursor = 'pointer';
modalContent.appendChild(loadButton);

// 'Reset Data' 버튼
const resetButton = document.createElement('button');
resetButton.innerText = 'Reset Data';
resetButton.style.padding = '10px 20px';
resetButton.style.backgroundColor = '#f44336';
resetButton.style.color = 'white';
resetButton.style.border = 'none';
resetButton.style.cursor = 'pointer';
modalContent.appendChild(resetButton);

// 데이터 로드 함수
loadButton.addEventListener('click', () => {
    ownConstellationData = JSON.parse(localStorage.getItem('ownConstellation')) || [];
    if (!Array.isArray(ownConstellationData)) {
        ownConstellationData = []; // 잘못된 데이터인 경우 빈 배열로 초기화
    }
    loadOwnConstellation();
    closeModal();
});

// 데이터 리셋 함수
resetButton.addEventListener('click', () => {
    localStorage.removeItem('ownConstellation');
    ownConstellationData = [];
    raDecGroup.children = raDecGroup.children.filter(child => !(child instanceof THREE.Line && child.material.color.equals(new THREE.Color(0x00ff00))));
    closeModal();
});

// 모달 닫기 함수
function closeModal() {
    modalOverlay.style.display = 'none';
}

// 페이지가 로드될 때 모달을 띄움
window.addEventListener('load', () => {
    modalOverlay.style.display = 'flex';
});


// Function to stop blinking
function stopStarBlinking() {
    if (blinkingStarIndex !== null && blinkingStarIndex >= 0 && stars) {
        // 'color' 속성 배열 업데이트
        const colorsArray = stars.geometry.attributes.color.array;
        const originalColorsArray = stars.geometry.attributes.originalColor.array;

        // 선택된 별의 인덱스에 대한 색상 복원 (각 별의 색상은 r, g, b 3개의 값으로 구성됨)
        const index = blinkingStarIndex * 3; // 각 별의 색상은 r, g, b로 구성되어 있으므로 3을 곱함

        // 원래 색상으로 복원
        colorsArray[index] = originalColorsArray[index];       // r
        colorsArray[index + 1] = originalColorsArray[index + 1];   // g
        colorsArray[index + 2] = originalColorsArray[index + 2];   // b

        // 속성 업데이트 반영
        stars.geometry.attributes.color.needsUpdate = true;
    }

    // Set blinkingStarIndex to null to stop blinking
    blinkingStarIndex = null;
}

let blinkTime = 0; // 깜빡임을 위한 시간 변수
function updateBlinkingStar() {
    if (blinkingStarIndex !== null && blinkingStarIndex >= 0 && stars) {
        blinkTime += 0.07;
        const blinkFactor = 0.1 + 0.9 * Math.abs(Math.sin(blinkTime));

        // 'color' 속성 배열 업데이트
        const colorsArray = stars.geometry.attributes.color.array;
        const originalColorsArray = stars.geometry.attributes.originalColor.array;

        // 선택된 별의 인덱스에 대한 색상 업데이트 (각 별의 색상은 r, g, b 3개의 값으로 구성됨)
        const index = blinkingStarIndex * 3; // 각 별의 색상은 r, g, b로 구성되어 있으므로 3을 곱함

        // 초기 색상을 기반으로 깜빡임 계수 적용
        colorsArray[index] = originalColorsArray[index] * blinkFactor;       // r
        colorsArray[index + 1] = originalColorsArray[index + 1] * blinkFactor;   // g
        colorsArray[index + 2] = originalColorsArray[index + 2] * blinkFactor;   // b

        // 속성 업데이트 반영
        stars.geometry.attributes.color.needsUpdate = true;
    }
}

function getCameraRaDec() {
    // 카메라의 월드 좌표에서 방향 계산
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 카메라의 현재 위치를 구함
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    // 카메라의 위치와 방향을 이용하여 충분히 먼 점을 가정해 계산
    const targetPosition = cameraPosition.clone().add(direction.multiplyScalar(1000)); // 충분히 큰 값

    // RA와 Dec 계산 (적경과 적위)
    const ra = THREE.MathUtils.radToDeg(Math.atan2(-targetPosition.z, targetPosition.x));
    const dec = THREE.MathUtils.radToDeg(Math.asin(targetPosition.y / targetPosition.length()));
    // ra를 0-360 범위로 변환
    return { ra, dec };
}

// 마우스와 대원 간의 거리 계산하여 가장 가까운 대원 찾기
function findClosestLine(mouseX, mouseY) {
    let closestLine = null;
    let minDistance = Infinity;

    constellationLinesGroup.children.forEach(line => {
        const positions = line.geometry.attributes.position.array;
        let linePoints = [];

        for (let i = 0; i < positions.length; i += 3) {
            const segmentPosition = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            linePoints.push(segmentPosition);
        }

        // 각 대원의 중간점을 계산
        const midpoint = new THREE.Vector3();
        linePoints.forEach(point => midpoint.add(point));
        midpoint.divideScalar(linePoints.length);

        const screenPos = getScreenPosition(midpoint);
        const dx = screenPos.x - mouseX;
        const dy = screenPos.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            minDistance = distance;
            closestLine = line;
        }
    });

    return { closestLine, minDistance };
}



// 깜빡임 애니메이션 업데이트
let blinkTime2 = 0; // 깜빡임을 위한 시간 변수
function updateBlinkingCircle() {
    if (blinkingCircle) {
        blinkTime2 += 0.07;
        const blinkFactor = 0.1 + 0.9 * Math.abs(Math.sin(blinkTime2)); // 0.5 ~ 1 사이의 값으로 깜빡임
        blinkingCircle.material.opacity = blinkFactor; // 깜빡임 효과 적용
        blinkingCircle.material.needsUpdate = true; // 재질 업데이트 필요
    }
}



