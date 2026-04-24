/**
 * HITrack Nepal Dashboard - Main Application Logic
 */

// Terai Cities Configuration
const TERAI_CITIES = [
    { name: 'Biratnagar', lat: 26.4525, lon: 87.2717, region: 'East' },
    { name: 'Janakpur', lat: 26.7288, lon: 85.9252, region: 'Central-East' },
    { name: 'Birgunj', lat: 27.0105, lon: 84.8778, region: 'Central' },
    { name: 'Bharatpur', lat: 27.6833, lon: 84.4333, region: 'Central-West' },
    { name: 'Bhairahawa', lat: 27.5000, lon: 83.4500, region: 'West' },
    { name: 'Nepalgunj', lat: 28.0500, lon: 81.6167, region: 'Mid-West' },
    { name: 'Dhangadhi', lat: 28.6900, lon: 80.5900, region: 'Far-West' },
    { name: 'Rajbiraj', lat: 26.5400, lon: 86.7500, region: 'East' },
    { name: 'Kalaiya', lat: 27.0300, lon: 85.0000, region: 'Central' },
    { name: 'Gaur', lat: 26.7667, lon: 85.2667, region: 'Central' },
    { name: 'Kathmandu', lat: 27.7172, lon: 85.3240, region: 'Hill' }
];

let map, comparisonChart;
let cityData = [];

// Initialize Dashboard
async function initDashboard() {
    initMap();
    await refreshData();
    
    // Auto-refresh every 15 minutes
    setInterval(refreshData, 15 * 60 * 1000);
}

// Initialize Leaflet Map
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: false
    });

    // Precise bounds for Nepal
    const nepalBounds = L.latLngBounds([26.0, 80.0], [30.5, 88.5]);
    
    const fitNepal = () => {
        map.fitBounds(nepalBounds, { 
            padding: [20, 20],
            animate: false 
        });
    };

    fitNepal();

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Keep it centralized on window resize
    window.addEventListener('resize', fitNepal);
    
    // Optional: Lock bounds to prevent wandering too far
    map.setMaxBounds(nepalBounds.pad(0.5));
}

let sortConfig = { field: 'steadman', direction: 'desc' };
let currentMapModel = 'steadman'; // Default model for map

// Switch Map Model
function switchModel(model) {
    currentMapModel = model;
    
    // Update UI buttons
    document.getElementById('btn-steadman').classList.toggle('active', model === 'steadman');
    document.getElementById('btn-humidex').classList.toggle('active', model === 'humidex');
    
    // Update map markers
    updateMapMarkers();
}

// Fetch Real-time Weather Data
async function refreshData() {
    const tableBody = document.getElementById('city-table-body');
    const loader = document.getElementById('table-loader');
    const updateLabel = document.getElementById('last-update');
    
    if (!loader || !tableBody) return;

    loader.style.display = 'block';
    loader.innerHTML = 'Fetching Terai weather & 3D forecast...';

    try {
        const promises = TERAI_CITIES.map(city => 
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m&timezone=auto&forecast_days=3`)
                .then(async res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    // Calculate current indices
                    const currentTemp = data.current.temperature_2m;
                    const currentHum = data.current.relative_humidity_2m;
                    
                    // Process hourly forecast trend (Heat Index + raw temp)
                    const trend = [];
                    const tempTrend = data.hourly.temperature_2m;
                    data.hourly.temperature_2m.forEach((t, i) => {
                        const h = data.hourly.relative_humidity_2m[i];
                        trend.push(HITrack.calculateSteadman(t, h));
                    });

                    return {
                        ...city,
                        temp: currentTemp,
                        humidity: currentHum,
                        humidex: HITrack.calculateHumidex(currentTemp, currentHum),
                        steadman: HITrack.calculateSteadman(currentTemp, currentHum),
                        forecastTrend: trend,
                        tempTrend: tempTrend
                    };
                })
                .catch(err => {
                    console.warn(`Failed for ${city.name}:`, err);
                    return null;
                })
        );

        const results = await Promise.all(promises);
        cityData = results.filter(r => r !== null);

        if (cityData.length === 0) throw new Error("All weather requests failed.");

        loader.style.display = 'none';
        
        renderCityTable();
        updateMapMarkers();
        renderComparisonChart();
        autoRecordToGitHub(); // Auto-save observations to GitHub CSV
        
        const now = new Date();
        updateLabel.innerText = `Last updated: ${now.toLocaleTimeString()}`;
    } catch (error) {
        console.error("Critical Fetch Error:", error);
        loader.style.display = 'block';
        loader.innerHTML = `<span style="color: #f56565">Error fetching data.</span>`;
    }
}

let modalChart = null;

// Sparkline SVG Generator - REMOVED from table but keeping logic if needed
function generateSparkline(data) {
    return ''; // No longer used in table
}

// Show City Details Modal
function showCityDetails(cityName) {
    const city = cityData.find(c => c.name === cityName);
    if (!city) return;

    const modal = document.getElementById('city-modal');
    const level = HITrack.getDangerLevel(city.steadman);

    // Set Header & Current Data
    document.getElementById('modal-city-name').innerText = city.name;
    document.getElementById('modal-city-region').innerText = city.region;
    document.getElementById('modal-temp').innerText = `${city.temp}°C`;
    document.getElementById('modal-status').innerText = level.label;
    document.getElementById('modal-status').className = `heat-badge ${level.class}`;
    document.getElementById('modal-humidity').innerText = `${city.humidity}%`;
    document.getElementById('modal-humidex').innerText = city.humidex;
    document.getElementById('modal-steadman').innerText = city.steadman;

    // Process Daily Averages for 3 Days
    const dailyData = calculateDailyAverages(city.forecastTrend);
    renderModalForecastList(dailyData);
    renderModalChart(city.forecastTrend, city.tempTrend);

    modal.classList.add('active');
}

function closeModal(event) {
    const modal = document.getElementById('city-modal');
    modal.classList.remove('active');
}

function calculateDailyAverages(hourlyData) {
    const daily = [];
    for (let i = 0; i < 3; i++) {
        const start = i * 24;
        const end = start + 24;
        const daySlice = hourlyData.slice(start, end);
        const avg = daySlice.reduce((a, b) => a + b, 0) / daySlice.length;
        const max = Math.max(...daySlice);
        
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        daily.push({
            date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            avg: avg.toFixed(1),
            max: max.toFixed(1)
        });
    }
    return daily;
}

function renderModalForecastList(dailyData) {
    const container = document.getElementById('modal-forecast-list');
    container.innerHTML = dailyData.map(day => `
        <div class="f-day">
            <span class="f-date">${day.date}</span>
            <span class="f-temp">${day.max}°C</span>
            <span class="heat-badge ${HITrack.getDangerLevel(parseFloat(day.max)).class}">Peak</span>
        </div>
    `).join('');
}

function renderModalChart(hourlyData, hourlyTemp) {
    const ctx = document.getElementById('modalChart').getContext('2d');
    if (modalChart) modalChart.destroy();

    // Calculate 3-day daily max/min HI and daily avg temp
    const dailyMaxHI = [];
    const dailyMinHI = [];
    const dailyAvgTemp = [];
    const days = [];

    for (let i = 0; i < 3; i++) {
        const hiSlice = hourlyData.slice(i * 24, (i + 1) * 24);
        const tSlice = hourlyTemp ? hourlyTemp.slice(i * 24, (i + 1) * 24) : [];
        dailyMaxHI.push(Math.max(...hiSlice));
        dailyMinHI.push(Math.min(...hiSlice));
        if (tSlice.length) dailyAvgTemp.push(+(tSlice.reduce((a, b) => a + b, 0) / tSlice.length).toFixed(1));
        
        const date = new Date();
        date.setDate(date.getDate() + i);
        days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    modalChart = new Chart(ctx, {
        data: {
            labels: days,
            datasets: [
                {
                    type: 'line',
                    label: 'Peak HI',
                    data: dailyMaxHI,
                    borderColor: '#f56565',
                    backgroundColor: 'rgba(245, 101, 101, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Min HI',
                    data: dailyMinHI,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    yAxisID: 'y'
                },
                ...(dailyAvgTemp.length ? [{
                    type: 'line',
                    label: 'Avg Temp (°C)',
                    data: dailyAvgTemp,
                    borderColor: '#f6e05e',
                    backgroundColor: 'rgba(246, 224, 94, 0.1)',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#f6e05e',
                    yAxisID: 'y2'
                }] : [])
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#a0aec0', font: { family: 'Outfit' } }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    min: 15,
                    ticks: { color: '#a0aec0' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: 'Heat Index (°C)', color: '#718096' }
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#f6e05e' },
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Temp (°C)', color: '#f6e05e' }
                },
                x: {
                    ticks: { color: '#a0aec0' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Render UI Table
function renderCityTable() {
    const tableBody = document.getElementById('city-table-body');
    tableBody.innerHTML = '';

    const sortedData = [...cityData].sort((a, b) => {
        let valA = a[sortConfig.field];
        let valB = b[sortConfig.field];
        if (typeof valA === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    sortedData.forEach(city => {
        const level = HITrack.getDangerLevel(city.steadman);
        const humidexLevel = HITrack.getDangerLevel(city.humidex);
        
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => showCityDetails(city.name);
        row.innerHTML = `
            <td>
                <div class="cell-city">
                    <span class="cell-city-name">${city.name}</span>
                </div>
            </td>
            <td><span class="cell-value">${city.temp}°C</span></td>
            <td><span class="cell-value">${city.humidity}%</span></td>
            <td><span class="cell-value cell-index" style="color: ${humidexLevel.color}">${city.humidex}</span></td>
            <td><span class="cell-value cell-index" style="color: ${level.color}">${city.steadman}</span></td>
            <td><span class="heat-badge ${level.class}">${level.label}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// Update Map Markers
function updateMapMarkers() {
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    cityData.forEach(city => {
        const val = currentMapModel === 'steadman' ? city.steadman : city.humidex;
        const level = HITrack.getDangerLevel(val);
        
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class='marker-pin' style='background: ${level.color}'></div>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });

        L.marker([city.lat, city.lon], { icon })
            .bindPopup(`
                <div style="color: #333">
                    <strong>${city.name}</strong><br>
                    Model: ${currentMapModel.toUpperCase()}<br>
                    Index: ${val}<br>
                    Status: ${level.label}
                </div>
            `)
            .addTo(map);
    });
}

// Render Comparison Chart
function renderComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    if (comparisonChart) comparisonChart.destroy();

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: cityData.map(c => c.name),
            datasets: [
                {
                    label: 'Humidex',
                    data: cityData.map(c => c.humidex),
                    backgroundColor: 'rgba(66, 153, 225, 0.6)',
                    borderColor: '#4299e1',
                    borderWidth: 1
                },
                {
                    label: 'Steadman (HI)',
                    data: cityData.map(c => c.steadman),
                    backgroundColor: 'rgba(245, 101, 101, 0.6)',
                    borderColor: '#f56565',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#a0aec0', font: { family: 'Outfit', size: 11 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 20,
                    ticks: { color: '#a0aec0' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#a0aec0' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Auto-Record Observations to GitHub Repository CSV
async function autoRecordToGitHub() {
    // Skip if config is not filled in
    if (!GITHUB_CONFIG.token || GITHUB_CONFIG.token === 'YOUR_GITHUB_PAT') return;

    const { owner, repo, csvPath, token, branch } = GITHUB_CONFIG;
    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${csvPath}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
    };

    try {
        const now = new Date();
        const timestamp = now.toISOString();
        const dateLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeLabel = now.toLocaleTimeString('en-US', { hour12: false });

        const csvHeader = 'Timestamp,Date,Time,City,Region,Temperature_C,Humidity_pct,Humidex,Humidex_Level,Steadman_HI,Steadman_Level,Forecast_3D_Peak_HI,Forecast_3D_Min_HI';

        const newRows = cityData.map(city => {
            const humidexLevel = HITrack.getDangerLevel(city.humidex);
            const steadmanLevel = HITrack.getDangerLevel(city.steadman);
            const peakHI = city.forecastTrend ? Math.max(...city.forecastTrend).toFixed(1) : '';
            const minHI = city.forecastTrend ? Math.min(...city.forecastTrend).toFixed(1) : '';
            return [timestamp, dateLabel, timeLabel, city.name, city.region,
                    city.temp, city.humidity, city.humidex, humidexLevel.label,
                    city.steadman, steadmanLevel.label, peakHI, minHI].join(',');
        }).join('\n');

        // Step 1: Try to get existing file (to get its SHA for update)
        let existingContent = csvHeader;
        let fileSha = null;

        const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });

        if (getRes.ok) {
            const fileData = await getRes.json();
            fileSha = fileData.sha;
            existingContent = atob(fileData.content.replace(/\n/g, ''));
        }

        // Step 2: Append new rows (skip header if file already exists)
        const updatedContent = fileSha
            ? existingContent.trimEnd() + '\n' + newRows
            : csvHeader + '\n' + newRows;

        // Step 3: Commit updated CSV back to GitHub
        const body = JSON.stringify({
            message: `HITrack: auto-record ${dateLabel} ${timeLabel}`,
            content: btoa(unescape(encodeURIComponent(updatedContent))),
            branch,
            ...(fileSha && { sha: fileSha })
        });

        const putRes = await fetch(apiBase, { method: 'PUT', headers, body });

        if (putRes.ok) {
            console.log(`✅ HITrack: Observations recorded to ${csvPath}`);
            document.getElementById('last-update').innerText =
                `Last updated: ${now.toLocaleTimeString()} · Saved to GitHub ✓`;
        } else {
            const err = await putRes.json();
            console.warn('GitHub commit failed:', err.message);
        }
    } catch (e) {
        console.warn('autoRecordToGitHub error:', e.message);
    }
}

// Export Observations to CSV
function exportCSV() {
    if (!cityData || cityData.length === 0) {
        alert('No data available to export yet. Please wait for data to load.');
        return;
    }

    const timestamp = new Date().toISOString();
    const dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeLabel = new Date().toLocaleTimeString('en-US', { hour12: false });

    // CSV Header
    const headers = [
        'Timestamp', 'Date', 'Time', 'City', 'Region',
        'Temperature_C', 'Humidity_pct',
        'Humidex', 'Humidex_Level',
        'Steadman_HI', 'Steadman_Level',
        'Forecast_3D_Peak_HI', 'Forecast_3D_Min_HI'
    ];

    const rows = cityData.map(city => {
        const humidexLevel = HITrack.getDangerLevel(city.humidex);
        const steadmanLevel = HITrack.getDangerLevel(city.steadman);
        const peakHI = city.forecastTrend ? Math.max(...city.forecastTrend).toFixed(1) : '';
        const minHI = city.forecastTrend ? Math.min(...city.forecastTrend).toFixed(1) : '';

        return [
            timestamp,
            dateLabel,
            timeLabel,
            city.name,
            city.region,
            city.temp,
            city.humidity,
            city.humidex,
            humidexLevel.label,
            city.steadman,
            steadmanLevel.label,
            peakHI,
            minHI
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `HITrack_observations_${new Date().toISOString().slice(0,10)}_${timeLabel.replace(/:/g,'-')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Run App
window.addEventListener('DOMContentLoaded', initDashboard);
