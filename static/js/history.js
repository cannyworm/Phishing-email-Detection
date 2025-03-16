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
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'dark');
    }
}

// Calculates relative time (e.g., "2 hours ago")
function updateRelativeTimes() {
    document.querySelectorAll('.timestamp').forEach(function(element) {
        const timestamp = element.textContent.trim();
        try {
            const relativeTime = moment(timestamp).fromNow();
            const relativeTimeElement = element.parentElement.querySelector('.relative-time');
            if (relativeTimeElement) {
                relativeTimeElement.textContent = relativeTime;
            }
        } catch (e) {
            console.error('Error calculating relative time:', e);
        }
    });
}

// Filter functionality
function applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const riskFilter = document.getElementById('filterRisk').value;
    const resultFilter = document.getElementById('filterResult').value;
    const rows = document.querySelectorAll('.email-row');
    
    let visibleCount = 0;
    
    rows.forEach(function(row) {
        const text = row.textContent.toLowerCase();
        const risk = parseFloat(row.dataset.risk);
        const result = row.dataset.result;
        
        let visible = text.includes(searchQuery);
        
        // Apply risk filter
        if (visible && riskFilter !== 'all') {
            if (riskFilter === 'high' && risk <= 70) visible = false;
            else if (riskFilter === 'medium' && (risk <= 30 || risk > 70)) visible = false;
            else if (riskFilter === 'low' && risk > 30) visible = false;
        }
        
        // Apply result filter
        if (visible && resultFilter !== 'all' && result !== resultFilter) {
            visible = false;
        }
        
        row.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
    });
    
    // Update counter
    document.getElementById('visibleCount').textContent = visibleCount;
    updatePagination();
}

// Sorting functionality
let currentSort = { column: 'date', direction: 'desc' };

function sortTable(column) {
    const table = document.getElementById('historyTable');
    const rows = Array.from(table.querySelectorAll('tr.email-row'));
    
    // Update sort direction
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { column: column, direction: 'desc' };
    }
    
    // Sort rows
    rows.sort((a, b) => {
        let valueA, valueB;
        
        if (column === 'date') {
            valueA = new Date(a.querySelector('.timestamp').textContent);
            valueB = new Date(b.querySelector('.timestamp').textContent);
        } else if (column === 'risk') {
            valueA = parseFloat(a.dataset.risk);
            valueB = parseFloat(b.dataset.risk);
        } else if (column === 'result') {
            valueA = a.dataset.result;
            valueB = b.dataset.result;
        }
        
        // Reverse for descending order
        return currentSort.direction === 'asc' 
            ? (valueA > valueB ? 1 : -1) 
            : (valueA < valueB ? 1 : -1);
    });
    
    // Update table
    rows.forEach(row => table.appendChild(row));
    
    // Update sort icons
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        `;
    });
    
    // Update the active sort icon
    const activeIcon = document.querySelector(`th[onclick="sortTable('${column}')"] .sort-icon`);
    if (activeIcon) {
        activeIcon.innerHTML = currentSort.direction === 'asc' 
            ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6" />`
            : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9" />`;
    }
    
    updatePagination();
}

// Pagination functionality
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

function updatePagination() {
    const rows = document.querySelectorAll('.email-row');
    const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
    const totalPages = Math.ceil(visibleRows.length / ITEMS_PER_PAGE);
    
    // Adjust current page if needed
    if (currentPage > totalPages) {
        currentPage = Math.max(1, totalPages);
    }
    
    // Show/hide rows based on current page
    visibleRows.forEach((row, index) => {
        const shouldShow = Math.floor(index / ITEMS_PER_PAGE) + 1 === currentPage;
        row.style.display = shouldShow ? '' : 'none';
    });
    
    // Update pagination controls
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    // Generate page buttons
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage 
            ? 'px-3 py-1 bg-blue-600 text-white rounded' 
            : 'px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800';
        button.addEventListener('click', () => {
            currentPage = i;
            updatePagination();
        });
        paginationContainer.appendChild(button);
    }
    
    // Update prev/next buttons
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Modal functionality
function showEmailDetails(item) {
    // Set values in modal
    const modalPrediction = document.getElementById('modal-prediction');
    modalPrediction.innerHTML = '';
    
    // Add icon to prediction
    const icon = document.createElement('span');
    icon.className = 'mr-2';
    
    if (item.prediction.includes('Social Engineering Detected')) {
        icon.innerHTML = `<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>`;
        modalPrediction.className = 'text-lg font-semibold text-red-600 dark:text-red-400 flex items-center';
        
        // Show warning banner
        const warningBanner = document.getElementById('warning-banner');
        warningBanner.classList.remove('hidden');
        
        // Add warning reasons
        const warningReasons = document.getElementById('warning-reasons');
        warningReasons.innerHTML = '';
        
        // Add some example reasons based on risk level
        const riskValue = parseFloat(item.Risk.replace('%', ''));
        if (riskValue > 70) {
            addWarningReason(warningReasons, 'Contains suspicious URLs or links');
            addWarningReason(warningReasons, 'Requests sensitive personal information');
            addWarningReason(warningReasons, 'Uses urgent or threatening language');
        } else {
            addWarningReason(warningReasons, 'Contains suspicious formatting or wording');
            addWarningReason(warningReasons, 'Message appears to be impersonating a trusted entity');
        }
    } else {
        icon.innerHTML = `<svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>`;
        modalPrediction.className = 'text-lg font-semibold text-green-600 dark:text-green-400 flex items-center';
        
        // Hide warning banner
        document.getElementById('warning-banner').classList.add('hidden');
    }
    
    modalPrediction.appendChild(icon);
    modalPrediction.appendChild(document.createTextNode(item.prediction));
    
    // Set risk level
    document.getElementById('modal-risk').textContent = item.Risk;
    
    // Set risk bar
    const riskValue = parseFloat(item.Risk.replace('%', ''));
    const riskBar = document.getElementById('modal-risk-indicator');
    riskBar.style.width = `${riskValue}%`;
    
    if (riskValue > 70) {
        riskBar.className = 'bg-danger h-2.5 rounded-full';
        document.getElementById('modal-risk').className = 'font-semibold text-danger dark:text-red-400';
    } else if (riskValue > 30) {
        riskBar.className = 'bg-warning h-2.5 rounded-full';
        document.getElementById('modal-risk').className = 'font-semibold text-warning dark:text-yellow-300';
    } else {
        riskBar.className = 'bg-safe h-2.5 rounded-full';
        document.getElementById('modal-risk').className = 'font-semibold text-safe dark:text-green-300';
    }
    
    // Format and set timestamp
    try {
        const formattedDate = moment(item.timestamp).format('MMM D, YYYY h:mm A');
        document.getElementById('modal-timestamp').textContent = formattedDate;
        document.getElementById('modal-relative-time').textContent = moment(item.timestamp).fromNow();
    } catch (e) {
        document.getElementById('modal-timestamp').textContent = item.timestamp;
        document.getElementById('modal-relative-time').textContent = '';
    }
    
    // Set language and translation status
    document.getElementById('modal-language').textContent = item.original_language;
    if (item.original_language !== "English") {
        document.getElementById('modal-language').innerHTML = `${item.original_language} <span class="text-xs text-blue-600 dark:text-blue-400">(Translated)</span>`;
    }
    
    // Set email length
    document.getElementById('modal-length').textContent = `${item.original_text.length} characters`;
    
    // Set original text
    document.getElementById('modal-original-text').textContent = item.original_text;
    
    // Handle URLs
    const urlsSection = document.getElementById('urls-section');
    const modalUrls = document.getElementById('modal-urls');
    modalUrls.innerHTML = '';
    
    if (item.urls && item.urls.length > 0) {
        urlsSection.classList.remove('hidden');
        document.getElementById('modal-url-count').textContent = item.urls.length;
        
        // Add each URL to the list
        item.urls.forEach(url => {
            // Create URL card
            const urlCard = document.createElement('div');
            urlCard.className = 'p-3 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700';
            
            // Determine if URL is suspicious (for demo purposes, URLs containing certain keywords)
            const isSuspicious = url.includes('login') || url.includes('account') || url.includes('verify') || url.includes('secure');
            
            // Create URL content
            urlCard.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="truncate mr-2">
                        <span class="font-mono text-sm break-all">${url}</span>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full 
                        ${isSuspicious ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : 
                        'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}">
                        ${isSuspicious ? 'Suspicious' : 'Safe'}
                    </span>
                </div>
                ${isSuspicious ? `
                <div class="mt-2 text-xs text-red-600 dark:text-red-400">
                    This URL matches common patterns used in phishing attempts.
                </div>` : ''}
            `;
            
            modalUrls.appendChild(urlCard);
        });
    } else {
        urlsSection.classList.add('hidden');
        document.getElementById('modal-url-count').textContent = '0';
    }
    
    // Set risk factors
    const factorsElement = document.getElementById('modal-factors');
    factorsElement.innerHTML = '';
    
    // Add risk factors based on risk level
    if (riskValue > 70) {
        addRiskFactor(factorsElement, 'Request for sensitive information');
        addRiskFactor(factorsElement, 'Suspicious URL detected');
        addRiskFactor(factorsElement, 'Urgent or threatening language');
        addRiskFactor(factorsElement, 'Impersonation of a trusted entity');
    } else if (riskValue > 30) {
        addRiskFactor(factorsElement, 'Unusual sender address');
        addRiskFactor(factorsElement, 'Uncommon formatting or grammar issues');
        addRiskFactor(factorsElement, 'Contains attachment or link requests');
    } else {
        addRiskFactor(factorsElement, 'No high-risk factors detected');
        addRiskFactor(factorsElement, 'Message appears to be legitimate');
    }
    
    // Set recommendations
    const recommendationsElement = document.getElementById('modal-recommendations');
    recommendationsElement.innerHTML = '';
    
    if (riskValue > 30) {
        addRecommendation(recommendationsElement, 'Do not click on any links in this email');
        addRecommendation(recommendationsElement, 'Do not reply with any personal information');
        addRecommendation(recommendationsElement, 'Contact the purported sender through official channels to verify');
        addRecommendation(recommendationsElement, 'Report this email as phishing to your IT department');
    } else {
        addRecommendation(recommendationsElement, 'This email appears safe, but always remain cautious');
        addRecommendation(recommendationsElement, 'Verify sender identity if anything seems unusual');
    }
    
    // Set up copy button
    document.getElementById('copy-content').addEventListener('click', function() {
        navigator.clipboard.writeText(item.original_text).then(() => {
            this.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                this.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2">
                        </path>
                    </svg>
                    Copy Text
                `;
            }, 2000);
        });
    });
    
    // Show modal
    document.getElementById('detailsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function addWarningReason(container, text) {
    const li = document.createElement('li');
    li.textContent = text;
    container.appendChild(li);
}

function addRiskFactor(container, text) {
    const li = document.createElement('li');
    li.textContent = text;
    container.appendChild(li);
}

function addRecommendation(container, text) {
    const li = document.createElement('li');
    li.textContent = text;
    container.appendChild(li);
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
}

// Document ready event listener
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark mode
    initDarkMode();
    
    // Add event listener for dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Format timestamps and update relative times
    document.querySelectorAll('.timestamp').forEach(function(element) {
        const timestamp = element.textContent.trim();
        try {
            const formattedDate = moment(timestamp).format('MMM D, YYYY h:mm A');
            element.textContent = formattedDate;
        } catch (e) {
            console.error('Error formatting date:', e);
        }
    });
    
    updateRelativeTimes();
    
    // Set up filter event listeners
    document.getElementById('searchInput').addEventListener('keyup', applyFilters);
    document.getElementById('filterRisk').addEventListener('change', applyFilters);
    document.getElementById('filterResult').addEventListener('change', applyFilters);
    
    // Set up pagination button listeners
    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', function() {
        const visibleRows = Array.from(document.querySelectorAll('.email-row')).filter(row => getComputedStyle(row).display !== 'none');
        const totalPages = Math.ceil(visibleRows.length / ITEMS_PER_PAGE);
        
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
        }
    });
    
    // Initialize pagination
    updatePagination();
    
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
    
    // Update export PDF button
    document.getElementById('exportPdfBtn').addEventListener('click', function() {
        alert('PDF export functionality would be implemented here');
    });
});