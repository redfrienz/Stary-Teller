let showConstellations = true;
let stars = [];
const path = './data/StarCatalogue_OGLE2003BLG235Lb.csv';

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
    loadingOverlay.style.opacity = '1';
    loadingOverlay.innerHTML = '<p>Loading, please wait...</p>';
    document.body.appendChild(loadingOverlay);
    
    const skyCanvas = document.getElementById('skyCanvas');
    const viewToggleButton = document.getElementById('viewToggle');
    const container = document.getElementById('container');

    skyCanvas.style.display = 'none';
    container.style.display = 'block';
    viewToggleButton.textContent = '2D View';

    viewToggleButton.addEventListener('click', async () => {
        loadingOverlay.style.display = 'flex';

        if (skyCanvas.style.display === 'block') {
            skyCanvas.style.display = 'none';
            container.style.display = 'block';
            viewToggleButton.textContent = '2D View';
            
            loadingOverlay.style.display = 'none';
        } else {
            skyCanvas.style.display = 'block';
            container.style.display = 'none';
            viewToggleButton.textContent = '3D View';

            await loadAndPlotSky();

            loadingOverlay.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'c' || event.key === 'C') {
            showConstellations = !showConstellations;
            plotConstellations();
        }
    });

    loadAndPlotSky().then(() => {
        loadingOverlay.style.display = 'none';
    });
});

async function loadAndPlotSky() {
    try {
        const response = await fetch(path);
        const csvText = await response.text();

        const starEq = d3.csvParse(csvText).map(d => ({
            newmag: +d.newmag,
            newra: +d.newra,
            newdec: +d.newdec,
            name: d.name
        }));

        const lat = parseFloat(localStorage.getItem('currentDec')) || 0; 
        const sid = parseFloat(localStorage.getItem('currentRa')) || 0; 
        stars = sList(lat, sid, 180, starEq);
        plotSky(stars);

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

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw circle for the sky view boundary
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 50.2 / 100;
    const radius = Math.min(centerX, centerY, canvas.height - centerY) - 20;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw the stars
    stars.forEach(star => {
        if (star.x) {
            const x = centerX + star.x * radius;
            const y = centerY + star.y * radius;
            const size = Math.min(10, 6 * Math.exp(-0.38 * star.mag));
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fillStyle = "white";
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    plotSky(stars); 

    if (showConstellations) {
        const constellationData = JSON.parse(localStorage.getItem('ownConstellation4')) || [];
        constellationData.forEach(pair => {
            const star1 = stars[pair.starIndex1];
            const star2 = stars[pair.starIndex2];
            if (star1 && star2 && star1.x && star2.x) {
                const x1 = centerX + star1.x * radius;
                const y1 = centerY + star1.y * radius;
                const x2 = centerX + star2.x * radius;
                const y2 = centerY + star2.y * radius;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = "#00ff00";
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
