
let currentUserCode = null;
let currentStatus = null;
let updateInterval = null;

// Check if user code exists in memory
function init() {
    currentUserCode = localStorage.getItem('libraryUserCode');
    
    if (currentUserCode) {
        document.getElementById('setupView').classList.add('hidden');
        document.getElementById('mainView').classList.remove('hidden');
        document.getElementById('displayCode').textContent = currentUserCode;
        loadCurrentStatus();
    }

    // Load people in library
    loadPeopleInLibrary();

    // Update every 30 seconds
    updateInterval = setInterval(loadPeopleInLibrary, 30000);
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

function updateUI() {
    const statusText = document.getElementById('statusText');
    const toggleButton = document.getElementById('toggleButton');

    if (currentStatus === 'in') {
        statusText.textContent = 'In Library';
        statusText.classList.remove('out');
        toggleButton.textContent = 'Check Out';
    } else {
        statusText.textContent = 'Not in Library';
        statusText.classList.add('out');
        toggleButton.textContent = 'Check In';
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

        // Refresh the people table
        loadPeopleInLibrary();
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('Error updating status. Please try again.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function loadPeopleInLibrary() {
    try {
        // Get all users and their most recent status
        const { data, error } = await supabase
            .from('library_status')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        // Group by user_code and get the latest status for each
        const latestStatuses = {};
        data.forEach(record => {
            if (!latestStatuses[record.user_code]) {
                latestStatuses[record.user_code] = record;
            }
        });

        // Filter only those currently in the library
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

// Initialize on load
init();
