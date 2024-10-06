let showConstellations = true; // 초기 상태: 별자리가 보이도록 설정
let stars = []; // 별 데이터를 저장할 배열
const path = './data/StarCatalogue_OGLE2003BLG235Lb.csv';

document.addEventListener('DOMContentLoaded', () => {
    const skyCanvas = document.getElementById('skyCanvas');
    const viewToggleButton = document.getElementById('viewToggle');
    const container = document.getElementById('container');

    // 초기 상태 설정
    skyCanvas.style.display = 'none'; // 기본적으로 3D 뷰가 활성화
    container.style.display = 'block';
    viewToggleButton.textContent = 'Switch to 2D View';

    // 버튼 클릭 시 2D 또는 3D 전환 로직
    viewToggleButton.addEventListener('click', () => {
        if (skyCanvas.style.display === 'block') {
            // 2D에서 3D로 전환
            skyCanvas.style.display = 'none';
            container.style.display = 'block';
            viewToggleButton.textContent = 'Switch to 2D View';
        } else {
            // 3D에서 2D로 전환
            skyCanvas.style.display = 'block';
            container.style.display = 'none';
            viewToggleButton.textContent = 'Switch to 3D View';
            loadAndPlotSky(); // 2D 뷰로 전환 시 업데이트된 값 반영
        }
    });

    // C 키를 눌러 별자리 표시/숨기기 토글
    document.addEventListener('keydown', (event) => {
        if (event.key === 'c' || event.key === 'C') {
            showConstellations = !showConstellations;
            plotConstellations(); // 별자리 상태에 따라 업데이트
        }
    });

    loadAndPlotSky(); // 초기 로드 시 별 그리기
});

async function loadAndPlotSky() {
    try {
        // Load CSV using fetch
        const response = await fetch(path);
        const csvText = await response.text();

        // Parse CSV text using d3-dsv's csvParse
        const starEq = d3.csvParse(csvText).map(d => ({
            newmag: +d.newmag,
            newra: +d.newra,
            newdec: +d.newdec,
            name: d.name
        }));

        const lat = parseFloat(localStorage.getItem('currentDec')) || 0; // 저장된 적위를 위도로 사용
        const sid = parseFloat(localStorage.getItem('currentRa')) || 0; // 저장된 적경을 항성시로 사용
        stars = sList(lat, sid, 180, starEq); // 별 데이터를 저장
        plotSky(stars); // 별 그리기

        // 초기 상태에 따라 별자리 그리기
        if (showConstellations) {
            plotConstellations();
        }
        
    } catch (error) {
        console.error("Error loading CSV file:", error);
    }
}

function deg2rad(deg) {
    return deg * Math.PI / 180;
}

function sList(lat, siderealTime, off, starEq) {
    let sd = deg2rad(siderealTime); // Convert sidereal time to radians
    let visibleStars = [];

    starEq.forEach(star => {
        let h = deg2rad(star.newra) - sd;

        let d = deg2rad(star.newdec);

        let phi = deg2rad(lat);
        const offset = deg2rad(off);

        let sina = Math.cos(h) * Math.cos(d) * Math.cos(phi) + Math.sin(d) * Math.sin(phi);
        if (sina < Math.sin(2 * Math.PI / 180)) {
            visibleStars.push({ NaN, NaN, mag: star.newmag });
            return;
        }
        if (star.mag > 6) {
            visibleStars.push({ NaN, NaN, mag: star.newmag });
            return;
        }

        let cosa = Math.sqrt(1 - sina * sina);
        let s1 = Math.sin(h) * Math.cos(d);
        let sinA = s1 / cosa;
        let s2 = Math.cos(h) * Math.cos(d) * Math.sin(phi) - Math.sin(d) * Math.cos(phi);
        let cosA = s2 / cosa;

        // Adjust with offset
        let tempSinA = sinA * Math.cos(offset) + cosA * Math.sin(offset);
        let tempCosA = cosA * Math.cos(offset) - sinA * Math.sin(offset);
        sinA = tempSinA;
        cosA = tempCosA;

        let r = 1 - (Math.asin(sina) * 2 / Math.PI);
        let x = r * sinA;
        let y = -r * cosA;

        visibleStars.push({ x, y, mag: star.newmag });
    });

    return visibleStars;
}

function plotSky(stars) {
    const canvas = document.getElementById("skyCanvas");
    const ctx = canvas.getContext("2d");

    // Set canvas size to match the window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Set the background color to black
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw circle for the sky view boundary
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 50.2 / 100;
    const radius = Math.min(centerX, centerY, canvas.height - centerY) - 20; // Ensure the circle fits within the canvas
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "white"; // Circle color set to white
    ctx.lineWidth = 2; // Make the border more visible
    ctx.stroke();

    // Draw the stars
    stars.forEach(star => {
        if (star.x) {
            const x = centerX + star.x * radius;
            const y = centerY + star.y * radius;
            const size = Math.min(10, 6 * Math.exp(-0.38 * star.mag)); // Scale star size by magnitude
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fillStyle = "white"; // Stars color set to white
            ctx.fill();
        }
    });
}

function plotConstellations() {
    const canvas = document.getElementById("skyCanvas");
    const ctx = canvas.getContext("2d");

    // Clear only the constellation layer
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 50.2 / 100;
    const radius = Math.min(centerX, centerY, canvas.height - centerY) - 20;

    // 별자리를 그릴 때마다 캔버스를 별 부분에 영향 없이 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    plotSky(stars); // 별은 그대로 유지하고 다시 그리기

    // 별자리 그리기 여부 결정
    if (showConstellations) {
        const constellationData = JSON.parse(localStorage.getItem('ownConstellation')) || [];
        constellationData.forEach(pair => {
            const star1 = stars[pair.starIndex1];
            const star2 = stars[pair.starIndex2];
            if (star1 && star2 && star1.x && star2.x) {
                const x1 = centerX + star1.x * radius;
                const y1 = centerY + star1.y * radius;
                const x2 = centerX + star2.x * radius;
                const y2 = centerY + star2.y * radius;

                // Draw line between stars
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = "#00ff00"; // Set line color for constellations
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    loadAndPlotSky();
});
