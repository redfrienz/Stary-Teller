const style = document.createElement('style');
style.innerHTML = `
    body {
        display: flex;
        flex-direction: column;
        align-items: center;
        background-color: #000;
        font-family: Arial, sans-serif;
        margin: 0;
        overflow: hidden;
    }
    #map {
        border: 2px solid white;
    }
    text {
        fill: white; 
        font-size: 10px;
    }
    .tooltip {
        position: absolute;
        background: rgba(255, 255, 255, 0.5);
        padding: 5px;
        border-radius: 5px;
        pointer-events: none;
        display: none;
        z-index: 10;
    }
    .arrow-button {
        position: absolute;
        top: 30px;
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        z-index: 20;
    }
    .left-arrow {
        right: 160px;
    }
    .right-arrow {
        right: 120px;
    }
`;
document.head.appendChild(style);

// Adding the arrow buttons to the document
const leftArrow = document.createElement('button');
leftArrow.innerText = '◀';
leftArrow.classList.add('arrow-button', 'left-arrow');
document.body.appendChild(leftArrow);

const rightArrow = document.createElement('button');
rightArrow.innerText = '▶';
rightArrow.classList.add('arrow-button', 'right-arrow');
document.body.appendChild(rightArrow);

function setMapVisibility(isVisible) {
    if (isVisible) {
        leftArrow.style.display = 'block';
        rightArrow.style.display = 'block';
        helpButton.style.display = 'block';
    } else {
        leftArrow.style.display = 'none';
        rightArrow.style.display = 'none';
        helpButton.style.display = 'none';
    }
}

// Tooltip logic
const tooltip = document.createElement('div');
tooltip.classList.add('tooltip');
document.body.appendChild(tooltip);

document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    }
});

function showTooltip(text, event) {
    tooltip.innerText = text;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
}

function hideTooltip() {
    tooltip.style.display = 'none';
}



window.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('mapVisibilityChange', (event) => {
        const { isVisible } = event.detail;
        setMapVisibility(isVisible);
        updateMap();
    });


    const svg = d3.select("#map");
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.8;
    const margin = 20;
    const path = './data/StarCatalogue_PSRB125712b.csv';

    let raOffset = 0;

    svg.attr("width", width + 2 * margin).attr("height", height + 2 * margin);

    const tooltip = d3.select("#tooltip");

    const raScale = d3.scaleLinear().domain([0, 360]).range([0, width]);
    const decScale = d3.scaleLinear().domain([-90, 90]).range([height, 0]);

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin}, ${margin})`);
    data = [];
    loadStarData()
    async function loadStarData() {
        try {
            const response = await fetch(path);
            const csvText = await response.text();
            data = csvParse(csvText); 
        } catch (error) {
            data = [];
        }
    }

    // Function to update star connections
    function updateMap() {
        chartGroup.selectAll("*").remove();
      
        for (let i = 0; i <= 360; i += 15) {
            const adjustedRa = (i - raOffset + 360) % 360;

            chartGroup.append("text")
                .attr("x", raScale(i))
                .attr("y", height + 15)
                .attr("text-anchor", "middle")
                .text(adjustedRa + "°");
          
            if (adjustedRa >= 0 && adjustedRa <= 360) {
                chartGroup.append("text")
                    .attr("x", raScale(i))
                    .attr("y", -5)
                    .attr("text-anchor", "middle")
                    .text(adjustedRa + "°");
            }
        }

        for (let i = -90; i <= 90; i += 15) {
            chartGroup.append("text")
                .attr("x", -20)
                .attr("y", decScale(i))
                .attr("text-anchor", "end")
                .attr("alignment-baseline", "middle")
                .text(i + "°");

            chartGroup.append("text")
                .attr("x", width + 5)
                .attr("y", decScale(i))
                .attr("alignment-baseline", "middle")
                .text(i + "°");
        }

        for (let i = 0; i <= 360; i += 15) {
            chartGroup.append("line")
                .attr("x1", raScale(i))
                .attr("y1", 0)
                .attr("x2", raScale(i))
                .attr("y2", height)
                .attr("stroke", "gray")
                .attr("stroke-width", 0.5);
        }

        for (let i = -90; i <= 90; i += 15) {
            chartGroup.append("line")
                .attr("x1", 0)
                .attr("y1", decScale(i))
                .attr("x2", width)
                .attr("y2", decScale(i))
                .attr("stroke", "gray")
                .attr("stroke-width", 0.5);
        }

        d3.csv(path).then(data => {
            data.forEach(d => {
                d.newra = +d.newra;
                d.newdec = +d.newdec;
                d.newmag = +d.newmag;
            });
    
            chartGroup.selectAll("circle")
                .data(data.filter(d => d.newmag < 6))
                .enter()
                .append("circle")
                .attr("cx", d => raScale((d.newra + raOffset) % 360))
                .attr("cy", d => decScale(d.newdec))
                .attr("r", d => Math.max(Math.min(4, 6 * Math.exp(-0.38 * d.newmag))), 0.1)
                .attr("fill", "white")
                .on("click", (event, d) => {
                    const clickX = raScale(d.newra);
                    const clickY = decScale(d.newdec);
                    const searchRadius = 3;
    
                    let closestStar = null;
                    let minMag = Infinity;
    
                    data.forEach(star => {
                        const starX = raScale(star.newra);
                        const starY = decScale(star.newdec);
                        const distance = Math.sqrt((starX - clickX) ** 2 + (starY - clickY) ** 2);
                        if (distance <= searchRadius && star.newmag < minMag) {
                            closestStar = star;
                            minMag = star.newmag;
                        }
                    });
    
                    function getStarDisplayName(starData) {
                        if (starData.proper) {
                            return `${starData.proper} (${starData.name})`;
                        } else {
                            return starData.name;
                        }
                    }
    
                    if (closestStar) {
                        const tooltipText = `${getStarDisplayName(closestStar)} Ra: ${parseFloat(closestStar.newra).toFixed(1)}°, Dec: ${parseFloat(closestStar.newdec).toFixed(1)}°, Mag: ${parseFloat(closestStar.newmag).toFixed(1)}`;
                        tooltip
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px")
                            .style("display", "block")
                            .html(tooltipText);
                    }
                });
            const connections = JSON.parse(localStorage.getItem('ownConstellation6')) || [];
            drawConnections(data, connections);
        });

        function drawConnections(data, connections) {
            const x = raOffset;
    
            connections.forEach(pair => {
                const star1 = data[pair.starIndex1];
                const star2 = data[pair.starIndex2];
    
                if (star1 && star2) {
                    const ra1 = star1.newra;
                    const ra2 = star2.newra;
    
                    const p1 = (ra1 + x + 360) % 360; 
    
                    const p2 = (ra2 + x + 360) % 360;
    
                    const deltaP = Math.abs(p1 - p2);
                    if (deltaP < 180) {
                        chartGroup.append("line")
                            .attr("x1", raScale((ra1 + raOffset) % 360))
                            .attr("y1", decScale(star1.newdec))
                            .attr("x2", raScale((ra2 + raOffset) % 360))
                            .attr("y2", decScale(star2.newdec))
                            .attr("stroke", "#00FF00") 
                            .attr("stroke-width", 1);
                    }
                }
            });
        }
        
    }

    d3.select("body").on("click", (event) => {
        if (event.target.tagName !== "circle") {
            tooltip.style("display", "none");
        }
    });

    d3.select(".left-arrow").on("click", () => {
        raOffset = (raOffset - 15 + 360) % 360;  
        updateMap();
    });

    d3.select(".right-arrow").on("click", () => {
        raOffset = (raOffset + 15) % 360; 
        updateMap();
    });

    updateMap();
});

// Create a help button
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
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">◀ ▶</span> : Shift the Right Ascension of the map
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">Click</span> : Show the information of the star
        </li>
        <li style="margin-bottom: 10px;">
            <span style="display: inline-block; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-weight: bold; border: 1px solid #ccc;">X</span> : Escape from the map
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

