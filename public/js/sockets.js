const socket = io();
console.log('Socket connected');

socket.on('usageChange', (usage) => {
    console.log(usage);
    updateAnalytics(usage);
});

// Analytics functionality
let usageChart;
let knownConnections = new Set(); // Track known connection timestamps

async function fetchUsageData() {
    try {
        const response = await fetch('/usage');
        if (!response.ok) {
            throw new Error('Failed to fetch usage data');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching usage data:', error);
        return [];
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    console.log("date:", date, dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimeSince(dateString) {
    console.log("date:", dateString)
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function truncateUserAgent(userAgent) {
    // Extract the most relevant part of the user agent string
    if (userAgent.includes('Chrome')) {
        return 'Chrome - ' + userAgent.split('Chrome/')[1].split(' ')[0];
    } else if (userAgent.includes('Firefox')) {
        return 'Firefox - ' + userAgent.split('Firefox/')[1].split(' ')[0];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        return 'Safari - ' + userAgent.split('Version/')[1].split(' ')[0];
    } else if (userAgent.includes('Edge')) {
        return 'Edge - ' + userAgent.split('Edge/')[1].split(' ')[0];
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
        return 'Internet Explorer';
    } else {
        // Return first 30 chars if no match
        return userAgent.length > 30 ? userAgent.substring(0, 30) + '...' : userAgent;
    }
}

function createUsageChart(data) {
    // Process data for chart
    const timestamps = [];
    const counts = [];
    
    // Get selected time filter
    const timeFilter = document.getElementById('timeFilter').value;
    
    // Filter data based on selected time period
    const filteredData = filterDataByTimeRange(data, timeFilter);
    
    // Group by appropriate time interval based on filter
    const groupedData = groupDataByTimeInterval(filteredData, timeFilter);
    
    // Convert grouped data to arrays for chart
    Object.keys(groupedData).sort().forEach(key => {
        timestamps.push(key);
        counts.push(groupedData[key]);
    });
    
    // Create chart
    const ctx = document.getElementById('usageChart').getContext('2d');
    
    if (usageChart) {
        usageChart.destroy();
    }
    
    usageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Usage Count',
                data: counts,
                borderColor: '#5c6bc0',
                backgroundColor: 'rgba(92, 107, 192, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#2a2a3a',
                    titleColor: '#a389f4',
                    bodyColor: '#e0e0f0',
                    borderColor: '#3a3a50',
                    borderWidth: 1,
                    callbacks: {
                        title: function(tooltipItems) {
                            // Format the title based on the time filter
                            const timestamp = tooltipItems[0].label;
                            return formatTooltipTitle(timestamp, timeFilter);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(58, 58, 80, 0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0c0',
                        callback: function(value, index, values) {
                            // Format x-axis labels based on time filter
                            return formatXAxisLabel(this.getLabelForValue(value), timeFilter, index, values.length);
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(58, 58, 80, 0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0c0',
                        precision: 0
                    }
                }
            }
        }
    });
}

// Helper function to filter data by time range
function filterDataByTimeRange(data, timeFilter) {
    if (timeFilter === 'all') {
        return data;
    }
    
    const now = new Date();
    let cutoffTime;
    
    // Calculate cutoff time based on filter
    switch (timeFilter) {
        case '10m':
            cutoffTime = new Date(now - 10 * 60 * 1000);
            break;
        case '30m':
            cutoffTime = new Date(now - 30 * 60 * 1000);
            break;
        case '1h':
            cutoffTime = new Date(now - 60 * 60 * 1000);
            break;
        case '3h':
            cutoffTime = new Date(now - 3 * 60 * 60 * 1000);
            break;
        case '6h':
            cutoffTime = new Date(now - 6 * 60 * 60 * 1000);
            break;
        case '12h':
            cutoffTime = new Date(now - 12 * 60 * 60 * 1000);
            break;
        case '1d':
            cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            cutoffTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000); // Default to 7 days
    }
    
    return data.filter(item => new Date(item.timestamp) >= cutoffTime);
}

// Helper function to group data by appropriate time interval
function groupDataByTimeInterval(data, timeFilter) {
    // Group data by appropriate interval based on filter
    const groupedData = {};
    
    data.forEach(item => {
        const date = new Date(item.timestamp);
        let key;
        
        // Group by different time intervals based on filter
        switch (timeFilter) {
            case '10m':
            case '30m':
            case '1h':
                // Group by minute for short time ranges
                key = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
                break;
            case '3h':
            case '6h':
            case '12h':
                // Group by 10-minute intervals for medium time ranges
                const minute = Math.floor(date.getMinutes() / 10) * 10;
                const paddedMinute = minute.toString().padStart(2, '0');
                key = `${date.toISOString().substring(0, 14)}${paddedMinute}`;
                break;
            case '1d':
                // Group by hour for 1 day
                key = date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
                break;
            case '7d':
                // Group by day for 1 week
                key = date.toISOString().substring(0, 10); // YYYY-MM-DD
                break;
            case '30d':
                // Group by day for 30 days
                key = date.toISOString().substring(0, 10); // YYYY-MM-DD
                break;
            default:
                // Group by day for all time
                key = date.toISOString().substring(0, 10); // YYYY-MM-DD
        }
        
        if (!groupedData[key]) {
            groupedData[key] = 0;
        }
        groupedData[key]++;
    });
    
    return groupedData;
}

// Format tooltip title based on time filter
function formatTooltipTitle(timestamp, timeFilter) {
    const date = new Date(timestamp);
    
    switch (timeFilter) {
        case '10m':
        case '30m':
        case '1h':
        case '3h':
        case '6h':
        case '12h':
            // Show date and time for shorter periods
            return date.toLocaleString([], { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        case '1d':
            // Show date and hour for 1 day
            return date.toLocaleString([], { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit' 
            });
        default:
            // Show just the date for longer periods
            return date.toLocaleDateString([], { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
    }
}

// Format x-axis labels based on time filter
function formatXAxisLabel(timestamp, timeFilter, index, totalLabels) {
    // Skip some labels if there are too many
    if (totalLabels > 15 && index % Math.ceil(totalLabels / 15) !== 0) {
        return '';
    }
    
    try {
        const date = new Date(timestamp);
        
        switch (timeFilter) {
            case '10m':
            case '30m':
            case '1h':
                // Show time for very short periods
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            case '3h':
            case '6h':
            case '12h':
                // Show time for medium periods
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            case '1d':
                // Show hour for 1 day
                return date.toLocaleTimeString([], { hour: '2-digit' });
            default:
                // Show date for longer periods
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    } catch (e) {
        console.error('Error formatting date:', e);
        return timestamp;
    }
}

function updateConnectionsList(data) {
    const container = document.getElementById('connectionsList');
    
    // Sort by timestamp, most recent first
    const sortedData = [...data].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Take only the latest 10
    const recentConnections = sortedData.slice(0, 10);
    
    if (recentConnections.length === 0) {
        container.innerHTML = '<div class="empty-state">No connections recorded yet</div>';
        return;
    }
    
    // Create a new set to check for new connections
    const currentConnections = new Set();
    
    // Store current content to avoid unnecessary DOM manipulation
    const fragment = document.createDocumentFragment();
    
    recentConnections.forEach(connection => {
        // Add to current set to track
        currentConnections.add(connection.timestamp);
        
        const connectionItem = document.createElement('div');
        connectionItem.className = 'connection-item';
        
        // Check if this is a new connection
        if (!knownConnections.has(connection.timestamp)) {
            connectionItem.classList.add('new-item');
            // Play sound alert for new connections (optional)
            // new Audio('/alert-sound.mp3').play().catch(e => console.log('Sound play prevented by browser'));
        }
        
        const connectionDetails = document.createElement('div');
        connectionDetails.className = 'connection-details';
        
        const connectionIp = document.createElement('div');
        connectionIp.className = 'connection-ip';
        connectionIp.textContent = connection.ip || 'Unknown IP';
        
        const connectionAgent = document.createElement('div');
        connectionAgent.className = 'connection-agent';
        connectionAgent.title = connection.userAgent || 'Unknown Client';
        connectionAgent.textContent = truncateUserAgent(connection.userAgent || 'Unknown Client');
        
        connectionDetails.appendChild(connectionIp);
        connectionDetails.appendChild(connectionAgent);
        
        const connectionTime = document.createElement('div');
        connectionTime.className = 'connection-time';
        connectionTime.textContent = formatTimeSince(connection.timestamp);
        connectionTime.title = formatDate(connection.timestamp);
        
        connectionItem.appendChild(connectionDetails);
        connectionItem.appendChild(connectionTime);
        fragment.appendChild(connectionItem);
    });
    
    // Efficiently update DOM in a single operation
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Update our known connections set
    knownConnections = currentConnections;
    
    // Set up periodic refresh of relative timestamps
    updateRelativeTimestamps();
}

// Function to periodically update relative timestamps (e.g., "2 minutes ago")
function updateRelativeTimestamps() {
    const connectionTimes = document.querySelectorAll('.connection-time');
    connectionTimes.forEach(timeElement => {
        const timestamp = timeElement.title;
        if (timestamp) {
            const dateObj = new Date(timestamp);
            console.log("dateObj:", dateObj, timestamp)
            timeElement.textContent = formatTimeSince(dateObj);
        }
    });
}

// Set up periodic refresh of timestamps every minute
setInterval(updateRelativeTimestamps, 60000);

async function updateAnalytics(usageData) {
    const data = usageData || await fetchUsageData();
    
    if (data && Array.isArray(data)) {
        createUsageChart(data);
        updateConnectionsList(data);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Load Chart.js library dynamically
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    chartScript.onload = async function() {
        // Initialize analytics after Chart.js is loaded
        await updateAnalytics();
        
        // Add event listener for time filter change after Chart.js is loaded
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            timeFilter.addEventListener('change', async function() {
                // Refresh chart with new time filter
                const data = await fetchUsageData();
                if (data && Array.isArray(data)) {
                    createUsageChart(data);
                }
            });
        }
    };
    document.head.appendChild(chartScript);
    
    // Set up settings button event listener
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
});