let currentUserCode = null;
let currentStatus = null;
let updateInterval = null;
let locationWatchId = null;
let autoCheckEnabled = false;

// Define your library coordinates (CHANGE THESE!)
const LIBRARY_LOCATION = {
    latitude: 32.880908,  
    longitude: -117.237081, 
    radius: 50 
};

// Check if user code exists in memory
function init() {
    currentUserCode = localStorage.getItem('libraryUserCode');
    autoCheckEnabled = localStorage.getItem('autoCheckEnabled') === 'true';
    
    if (currentUserCode) {
        document.getElementById('setupView').classList.add('hidden');
        document.getElementById('mainView').classList.remove('hidden');
        document.getElementById('displayCode').textContent = currentUserCode;
        document.getElementById('autoCheckToggle').checked = autoCheckEnabled;
        loadCurrentStatus();
        loadUserStats();
        
        if (autoCheckEnabled) {
            startLocationTracking();
        }
    }

    // Load people in library and leaderboard
    loadPeopleInLibrary();
    loadLeaderboard();

    // Update every 30 seconds
    updateInterval = setInterval(() => {
        loadPeopleInLibrary();
        loadLeaderboard();
        if (currentUserCode) {
            loadUserStats();
        }
    }, 30000);
}

function saveUserCode() {
    const code = document.getElementById('userCode').value.trim().toUpperCase();
    
    if (!code) {
        showMessage('Please enter a code', 'error');
        return;
    }

    currentUserCode = code;
    localStorage.setItem('libraryUserCode', code);
    
    document.getElementById('setupView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('displayCode').textContent = code;
    
    loadCurrentStatus();
    loadUserStats();
}

async function loadCurrentStatus() {
    try {
        const { data, error } = await supabase
            .from('library_status')
            .select('*')
            .eq('user_code', currentUserCode)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        currentStatus = data?.status || 'out';
        updateUI();
    } catch (error) {
        console.error('Error loading status:', error);
        currentStatus = 'out';
        updateUI();
    }
}

async function loadUserStats() {
    try {
        const { data, error } = await supabase
            .from('library_status')
            .select('*')
            .eq('user_code', currentUserCode)
            .order('timestamp', { ascending: true });

        if (error) throw error;

        const totalTime = calculateTotalTime(data);
        displayUserStats(totalTime);
    } catch (error) {
        console.error('Error loading user stats:', error);
        displayUserStats(0);
    }
}

function calculateTotalTime(records) {
    let totalMilliseconds = 0;
    let lastCheckIn = null;

    records.forEach(record => {
        if (record.status === 'in') {
            lastCheckIn = new Date(record.timestamp);
        } else if (record.status === 'out' && lastCheckIn) {
            const checkOut = new Date(record.timestamp);
            totalMilliseconds += checkOut - lastCheckIn;
            lastCheckIn = null;
        }
    });

    // If currently checked in, add time until now
    if (lastCheckIn) {
        totalMilliseconds += new Date() - lastCheckIn;
    }

    return totalMilliseconds;
}

function displayUserStats(totalMilliseconds) {
    const hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    const statsElement = document.getElementById('userStats');
    statsElement.innerHTML = `
        <div class="stat-label">Your Total Time</div>
        <div class="stat-value">${hours}h ${minutes}m</div>
    `;
}

async function loadLeaderboard() {
    try {
        const { data, error } = await supabase
            .from('library_status')
            .select('*')
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Calculate total time for each user
        const userTimes = {};
        const userSessions = {};

        data.forEach(record => {
            if (!userSessions[record.user_code]) {
                userSessions[record.user_code] = { lastCheckIn: null, totalTime: 0 };
            }

            const session = userSessions[record.user_code];

            if (record.status === 'in') {
                session.lastCheckIn = new Date(record.timestamp);
            } else if (record.status === 'out' && session.lastCheckIn) {
                const checkOut = new Date(record.timestamp);
                session.totalTime += checkOut - session.lastCheckIn;
                session.lastCheckIn = null;
            }
        });

        // Add current session time if checked in
        const now = new Date();
        Object.keys(userSessions).forEach(userCode => {
            const session = userSessions[userCode];
            if (session.lastCheckIn) {
                session.totalTime += now - session.lastCheckIn;
            }
            userTimes[userCode] = session.totalTime;
        });

        displayLeaderboard(userTimes);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        document.getElementById('leaderboardTable').innerHTML = 
            '<div class="empty-state">Error loading leaderboard</div>';
    }
}

function displayLeaderboard(userTimes) {
    const container = document.getElementById('leaderboardTable');
    
    // Sort users by total time
    const sortedUsers = Object.entries(userTimes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    if (sortedUsers.length === 0) {
        container.innerHTML = '<div class="empty-state">No data yet</div>';
        return;
    }

    let html = '<div class="leaderboard-table">';
    html += '<div class="leaderboard-header"><div>Rank</div><div>User</div><div>Total Time</div></div>';
    
    sortedUsers.forEach(([userCode, totalTime], index) => {
        const hours = Math.floor(totalTime / (1000 * 60 * 60));
        const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));
        
        const isCurrentUser = userCode === currentUserCode;
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        const highlightClass = isCurrentUser ? 'current-user' : '';
        
        let rankDisplay = index + 1;
        if (index === 0) rankDisplay = '🥇';
        else if (index === 1) rankDisplay = '🥈';
        else if (index === 2) rankDisplay = '🥉';

        html += `
            <div class="leaderboard-row ${rankClass} ${highlightClass}">
                <div class="rank">${rankDisplay}</div>
                <div class="leaderboard-user">${escapeHtml(userCode)}${isCurrentUser ? ' (You)' : ''}</div>
                <div class="time">${hours}h ${minutes}m</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function updateUI() {
    const statusText = document.getElementById('statusText');
    const toggleButton = document.getElementById('toggleButton');

    if (currentStatus === 'in') {
        statusText.textContent = 'In Library';
        statusText.classList.remove('out');
        toggleButton.textContent = 'Check Out';
        toggleButton.classList.add('checkout');
    } else {
        statusText.textContent = 'Not in Library';
        statusText.classList.add('out');
        toggleButton.textContent = 'Check In';
        toggleButton.classList.remove('checkout');
    }
}

async function toggleStatus() {
    const button = document.getElementById('toggleButton');
    button.disabled = true;

    try {
        const newStatus = currentStatus === 'in' ? 'out' : 'in';

        const { error } = await supabase
            .from('library_status')
            .insert({
                user_code: currentUserCode,
                status: newStatus,
                timestamp: new Date().toISOString()
            });

        if (error) throw error;

        currentStatus = newStatus;
        updateUI();
        
        const action = newStatus === 'in' ? 'checked in' : 'checked out';
        showMessage(`Successfully ${action}!`, 'success');

        // Refresh everything
        loadPeopleInLibrary();
        loadLeaderboard();
        loadUserStats();
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('Error updating status. Please try again.', 'error');
    } finally {
        button.disabled = false;
    }
}

// Location tracking functions
function toggleAutoCheck() {
    autoCheckEnabled = document.getElementById('autoCheckToggle').checked;
    localStorage.setItem('autoCheckEnabled', autoCheckEnabled);
    
    if (autoCheckEnabled) {
        requestLocationPermission();
    } else {
        stopLocationTracking();
        showMessage('Auto check-in disabled', 'success');
    }
}

function requestLocationPermission() {
    if (!navigator.geolocation) {
        showMessage('Geolocation not supported by your browser', 'error');
        document.getElementById('autoCheckToggle').checked = false;
        autoCheckEnabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            showMessage('Location access granted! Auto check-in enabled', 'success');
            startLocationTracking();
        },
        (error) => {
            let message = 'Location permission denied';
            if (error.code === error.PERMISSION_DENIED) {
                message = 'Location permission denied. Please enable in browser settings.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Location unavailable. Please check your device settings.';
            }
            showMessage(message, 'error');
            document.getElementById('autoCheckToggle').checked = false;
            autoCheckEnabled = false;
            localStorage.setItem('autoCheckEnabled', 'false');
        }
    );
}

function startLocationTracking() {
    if (locationWatchId) return;

    locationWatchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        handleLocationError,
        {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        }
    );
    
    updateLocationStatus('Tracking location...');
}

function stopLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    updateLocationStatus('');
}

function handleLocationUpdate(position) {
    const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        LIBRARY_LOCATION.latitude,
        LIBRARY_LOCATION.longitude
    );

    const isInLibrary = distance <= LIBRARY_LOCATION.radius;
    
    updateLocationStatus(`Distance: ${Math.round(distance)}m from library`);

    if (isInLibrary && currentStatus === 'out') {
        autoToggleStatus('in', 'Auto checked in (arrived at library)');
    } else if (!isInLibrary && currentStatus === 'in') {
        autoToggleStatus('out', 'Auto checked out (left library)');
    }
}

function handleLocationError(error) {
    console.error('Location error:', error);
    updateLocationStatus('Location tracking error');
}

async function autoToggleStatus(newStatus, message) {
    try {
        const { error } = await supabase
            .from('library_status')
            .insert({
                user_code: currentUserCode,
                status: newStatus,
                timestamp: new Date().toISOString()
            });

        if (error) throw error;

        currentStatus = newStatus;
        updateUI();
        showMessage(message, 'success');
        loadPeopleInLibrary();
        loadLeaderboard();
        loadUserStats();
    } catch (error) {
        console.error('Error auto-updating status:', error);
    }
}

function updateLocationStatus(text) {
    const statusElement = document.getElementById('locationStatus');
    if (statusElement) {
        statusElement.textContent = text;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

async function loadPeopleInLibrary() {
    try {
        const { data, error } = await supabase
            .from('library_status')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        const latestStatuses = {};
        data.forEach(record => {
            if (!latestStatuses[record.user_code]) {
                latestStatuses[record.user_code] = record;
            }
        });

        const peopleIn = Object.values(latestStatuses)
            .filter(record => record.status === 'in')
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        displayPeopleTable(peopleIn);
    } catch (error) {
        console.error('Error loading people:', error);
        document.getElementById('peopleTable').innerHTML = 
            '<div class="empty-state">Error loading data</div>';
    }
}

function displayPeopleTable(people) {
    const container = document.getElementById('peopleTable');
    
    if (people.length === 0) {
        container.innerHTML = '<div class="empty-state">No one is currently in the library</div>';
        return;
    }

    const now = new Date();
    
    let html = '<div class="people-table">';
    html += '<div class="table-header"><div>User</div><div>Duration</div></div>';
    
    people.forEach(person => {
        const checkinTime = new Date(person.timestamp);
        const duration = formatDuration(now - checkinTime);
        
        html += `
            <div class="table-row">
                <div class="user-name">${escapeHtml(person.user_code)}</div>
                <div class="duration">${duration}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return 'Just now';
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showMessage(text, type) {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');

    setTimeout(() => {
        message.classList.add('hidden');
    }, 3000);
}

init();