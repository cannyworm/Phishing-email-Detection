function initDarkMode() {
    // Check for saved preference
    const darkModeSetting = localStorage.getItem('darkMode');
    
    // If user has a saved preference, use that
    if (darkModeSetting === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (darkModeSetting === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        // If no saved preference, check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'dark');
        }
    }
}

// Toggle dark mode
function toggleDarkMode() {
    if (document.documentElement.classList.contains('light')) {
        document.documentElement.classList.remove('light');
        localStorage.setItem('darkMode', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'dark');
    }
}

// Format timestamps
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark mode
    initDarkMode();
    
    // Add event listener for dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Format timestamps
    document.querySelectorAll('.timestamp').forEach(function(element) {
        const timestamp = element.textContent.trim();
        try {
            const formattedDate = moment(timestamp).format('MMM D, YYYY h:mm A');
            element.textContent = formattedDate;
        } catch (e) {
            console.error('Error formatting date:', e);
        }
    });
});

// Search functionality
document.getElementById('searchInput').addEventListener('keyup', function() {
    const searchQuery = this.value.toLowerCase();
    const rows = document.querySelectorAll('.email-row');
    
    rows.forEach(function(row) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchQuery) ? '' : 'none';
    });
});

// Modal functionality
function showEmailDetails(item) {
    // Set values in modal
    const modalPrediction = document.getElementById('modal-prediction');
    modalPrediction.textContent = item.prediction;
    
    // Set classes for prediction
    if (item.prediction.includes('Social Engineering Detected')) {
        modalPrediction.className = 'text-lg font-semibold text-red-600 dark:text-red-400';
    } else {
        modalPrediction.className = 'text-lg font-semibold text-green-600 dark:text-green-400';
    }
    
    document.getElementById('modal-risk').textContent = item.Risk;
    
    // Set risk bar
    const riskValue = parseFloat(item.Risk.replace('%', ''));
    const riskBar = document.getElementById('modal-risk-indicator');
    riskBar.style.width = `${riskValue}%`;
    
    if (riskValue > 70) {
        riskBar.className = 'bg-red-600 h-2.5 rounded-full';
    } else if (riskValue > 30) {
        riskBar.className = 'bg-yellow-400 h-2.5 rounded-full';
    } else {
        riskBar.className = 'bg-green-500 h-2.5 rounded-full';
    }
    
    // Format and set timestamp
    try {
        const formattedDate = moment(item.timestamp).format('MMM D, YYYY h:mm A');
        document.getElementById('modal-timestamp').textContent = formattedDate;
    } catch (e) {
        document.getElementById('modal-timestamp').textContent = item.timestamp;
    }
    
    // Set language
    document.getElementById('modal-language').textContent = item.original_language;
    
    // Set original text
    document.getElementById('modal-original-text').textContent = item.original_text;
    
    // Handle translated text if available
    const translationSection = document.getElementById('translation-section');
    if (item.translated_text && item.translated_text !== 'N/A') {
        translationSection.classList.remove('hidden');
        document.getElementById('modal-translated-text').textContent = item.translated_text;
    } else {
        translationSection.classList.add('hidden');
    }
    
    // Handle URLs
    const urlsEmpty = document.getElementById('modal-urls-empty');
    const urlsList = document.getElementById('modal-urls-list');
    const urlsTable = document.getElementById('modal-urls-table');
    
    if (item.urls_found && item.urls_found.length > 0) {
        urlsEmpty.classList.add('hidden');
        urlsList.classList.remove('hidden');
        
        // Clear previous URLs
        urlsTable.innerHTML = '';
        
        // Add each URL to the table
        item.urls_found.forEach(url => {
            const isMalicious = item.malicious_urls && item.malicious_urls.includes(url);
            
            const row = document.createElement('tr');
            
            const urlCell = document.createElement('td');
            urlCell.className = 'px-4 py-2 text-sm text-gray-900 dark:text-darkText';
            urlCell.textContent = url;
            
            const statusCell = document.createElement('td');
            statusCell.className = 'px-4 py-2 text-sm';
            
            if (isMalicious) {
                statusCell.innerHTML = '<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">Malicious</span>';
            } else {
                statusCell.innerHTML = '<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Safe</span>';
            }
            
            row.appendChild(urlCell);
            row.appendChild(statusCell);
            urlsTable.appendChild(row);
        });
    } else {
        urlsEmpty.classList.remove('hidden');
        urlsList.classList.add('hidden');
    }
    
    // Show modal
    document.getElementById('detailsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
}

// Close modal when clicking outside of it
document.getElementById('detailsModal').addEventListener('click', function(event) {
    if (event.target === this) {
        closeModal();
    }
});

// Close modal with ESC key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !document.getElementById('detailsModal').classList.contains('hidden')) {
        closeModal();
    }
});