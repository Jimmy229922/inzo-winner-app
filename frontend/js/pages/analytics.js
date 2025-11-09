// Use the globally available utilities
const { authedFetch: fetchWithAuth, showToast } = window.utils;

// Ensure Chart.js is loaded
if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded. Please include Chart.js before analytics.js');
    throw new Error('Chart.js dependency missing');
}

// Function to safely configure Chart.js
function configureChartDefaults() {
    if (!window.Chart) {
        console.error('Chart.js is not loaded');
        return false;
    }

    try {
        // Configure basic defaults
        Chart.defaults.font.family = 'Arial, sans-serif';
        Chart.defaults.color = '#333';

        // Configure RTL settings safely
        if (Chart.defaults.plugins) {
            if (Chart.defaults.plugins.tooltip) {
                Chart.defaults.plugins.tooltip.rtl = true;
            }
            if (Chart.defaults.plugins.legend) {
                Chart.defaults.plugins.legend.rtl = true;
            }
            if (Chart.defaults.plugins.datalabels) {
                Chart.defaults.plugins.datalabels.rtl = true;
            }
        }
        return true;
    } catch (error) {
        console.error('Error configuring Chart.js defaults:', error);
        return false;
    }
}

// Chart instances
let mostFrequentCompetitionsChart;
let peakHoursChart; // Declare here
let countryStatsChart; // Declare here
let topIPsChart; // Declare here

// Configure Chart.js when the script loads
configureChartDefaults();

// Arabic Labels
const ARABIC_LABELS = {
    mostFrequentCompetitions: 'المسابقات الأكثر تكرارًا',
    competitionName: 'اسم المسابقة',
    count: 'العدد',
    peakHours: 'ساعات الذروة للتقارير',
    hour: 'الساعة (UTC)',
    reportCount: 'عدد التقارير',
    countryStats: 'إحصائيات التقارير حسب الدولة',
    country: 'الدولة',
    topIPs: 'أكثر عناوين IP استخدامًا',
    ipAddress: 'عنوان IP',
    employeePerformance: 'أداء الموظفين',
    employee: 'الموظف',
    noData: 'لا توجد بيانات لعرضها.',
    errorFetchingData: 'حدث خطأ أثناء جلب البيانات.',
    copySuccess: 'تم نسخ عنوان IP إلى الحافظة!',
    copyFail: 'فشل نسخ عنوان IP.',
};

// Chart.js configuration is handled at script initialization

// Function to show/hide loading spinner
function showLoading(element, show) {
    if (element) {
        element.classList.toggle('active', show);
    }
}

// Function to show/hide error message
function showError(element, message, show) {
    if (element) {
        element.textContent = message;
        element.classList.toggle('active', show);
    }
}

// Function to get user role
function getUserRole() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.role;
    } catch (e) {
        console.error("Error parsing user from localStorage", e);
        return null;
    }
}

// Main data fetching function
async function fetchAnalyticsData(filter) {
    const mostFrequentCompetitionsLoading = document.getElementById('mostFrequentCompetitionsLoading');
    const employeePerformanceLoading = document.getElementById('employeePerformanceLoading');
    const mostFrequentCompetitionsError = document.getElementById('mostFrequentCompetitionsError');
    const employeePerformanceError = document.getElementById('employeePerformanceError');
    showLoading(mostFrequentCompetitionsLoading, true);
    showLoading(employeePerformanceLoading, true);
    showError(mostFrequentCompetitionsError, '', false);
    showError(employeePerformanceError, '', false);

    try {
        // Assuming fetchWithAuth is available globally or imported
        // build query params from provided filter object
        let url = '/api/analytics';
        console.log('DEBUG: fetchAnalyticsData - initial filter:', filter);
        const qp = new URLSearchParams();

        if (filter) {
            if (typeof filter === 'object') {
                const from = filter.from;
                const to = filter;
                const range = filter.range;

                if (from) qp.set('from', from);
                if (to) qp.set('to', to);
                if (range) qp.set('range', range);
            } else { // filter is a string (e.g., '7')
                qp.set('range', filter);
            }
        }

        const queryString = qp.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        console.log('DEBUG: fetchAnalyticsData - constructed URL:', url);
        const response = await fetchWithAuth(url);
        if (!response.ok) {
            throw new Error(ARABIC_LABELS.errorFetchingData);
        }
        const result = await response.json();
        return result; // backend returns object with analytics fields
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        showError(mostFrequentCompetitionsError, ARABIC_LABELS.errorFetchingData, true);
        showError(employeePerformanceError, ARABIC_LABELS.errorFetchingData, true);
        return null;
    } finally {
        showLoading(mostFrequentCompetitionsLoading, false);
        showLoading(employeePerformanceLoading, false);
    }
}

// Chart rendering functions (placeholders for now)
function renderMostFrequentCompetitionsChart(data) {
    const mostFrequentCompetitionsCanvas = document.getElementById('mostFrequentCompetitionsChart');
    const mostFrequentCompetitionsError = document.getElementById('mostFrequentCompetitionsError');
    if (!mostFrequentCompetitionsCanvas) return;
    if (mostFrequentCompetitionsChart) mostFrequentCompetitionsChart.destroy();

    if (!data || data.length === 0) {
        showError(mostFrequentCompetitionsError, ARABIC_LABELS.noData, true);
        return;
    }

    // support template_name (new aggregation) or competition_name (legacy)
    const labels = data.map(item => item.template_name || item.competition_name || item.template_id || 'غير معروف');
    const counts = data.map(item => item.count);

    mostFrequentCompetitionsChart = new Chart(mostFrequentCompetitionsCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: ARABIC_LABELS.count,
                data: counts,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: ARABIC_LABELS.mostFrequentCompetitions,
                    font: { size: 16 }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    color: '#333',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: ARABIC_LABELS.count
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: ARABIC_LABELS.competitionName
                    }
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

function renderPeakHoursChart(data) {
    if (!peakHoursCanvas) return;
    if (peakHoursChart) peakHoursChart.destroy();

    if (!data || data.length === 0) {
        showError(peakHoursError, ARABIC_LABELS.noData, true);
        return;
    }

    // Ensure all 24 hours are present, filling missing hours with 0
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    const reportCountsByHour = new Array(24).fill(0);

    data.forEach(item => {
        if (item.hour >= 0 && item.hour < 24) {
            reportCountsByHour[item.hour] = item.report_count;
        }
    });

    peakHoursChart = new Chart(peakHoursCanvas, {
        type: 'line',
        data: {
            labels: allHours.map(h => `${h}:00`),
            datasets: [{
                label: ARABIC_LABELS.reportCount,
                data: reportCountsByHour,
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: ARABIC_LABELS.peakHours,
                    font: { size: 16 }
                },
                datalabels: {
                    display: false, // Hide datalabels for line chart for cleaner look
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: ARABIC_LABELS.reportCount
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: ARABIC_LABELS.hour
                    }
                }
            }
        }
    });
}

function renderCountryStatsChart(data) {
    if (!countryStatsCanvas) return;
    if (countryStatsChart) countryStatsChart.destroy();

    if (!data || data.length === 0) {
        showError(countryStatsError, ARABIC_LABELS.noData, true);
        return;
    }

    // Take top 10 countries
    const sortedData = [...data].sort((a, b) => b.report_count - a.report_count).slice(0, 10);
    const labels = sortedData.map(item => item.country);
    const counts = sortedData.map(item => item.report_count);

    countryStatsChart = new Chart(countryStatsCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: ARABIC_LABELS.reportCount,
                data: counts,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: ARABIC_LABELS.countryStats,
                    font: { size: 16 }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    color: '#333',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: ARABIC_LABELS.reportCount
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: ARABIC_LABELS.country
                    }
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

function renderTopIPsChart(data) {
    if (!topIPsCanvas) return;
    if (topIPsChart) topIPsChart.destroy();

    if (!data || data.length === 0) {
        showError(topIPsError, ARABIC_LABELS.noData, true);
        return;
    }

    // Take top 10 IPs
    const sortedData = [...data].sort((a, b) => b.report_count - a.report_count).slice(0, 10);
    const labels = sortedData.map(item => item.ip);
    const counts = sortedData.map(item => item.report_count);

    topIPsChart = new Chart(topIPsCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: ARABIC_LABELS.reportCount,
                data: counts,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: ARABIC_LABELS.topIPs,
                    font: { size: 16 }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value,
                    color: '#333',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: ARABIC_LABELS.reportCount
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: ARABIC_LABELS.ipAddress
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const ip = topIPsChart.data.labels[index];
                    navigator.clipboard.writeText(ip)
                        .then(() => {
                            // Assuming showToast is available globally or imported
                            if (typeof showToast === 'function') {
                                showToast(ARABIC_LABELS.copySuccess, 'success');
                            } else {
                                alert(ARABIC_LABELS.copySuccess);
                            }
                        })
                        .catch(err => {
                            console.error('Failed to copy IP:', err);
                            if (typeof showToast === 'function') {
                                showToast(ARABIC_LABELS.copyFail, 'error');
                            } else {
                                alert(ARABIC_LABELS.copyFail);
                            }
                        });
                }
            }
        },
        plugins: [window.ChartDataLabels]
    });
}

function renderEmployeePerformanceTable(data) {
    const employeePerformanceTableBody = document.querySelector('#employeePerformanceTable tbody');
    const employeePerformanceCard = document.getElementById('employeePerformanceCard');
    if (!employeePerformanceTableBody) return;

    // Clear previous data
    employeePerformanceTableBody.innerHTML = '';

    const userRole = getUserRole();
    if (userRole !== 'admin') {
        employeePerformanceCard.style.display = 'none';
        return;
    } else {
        employeePerformanceCard.style.display = 'block';
    }

    if (!data || data.length === 0) {
        const row = employeePerformanceTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 2;
        cell.textContent = ARABIC_LABELS.noData;
        cell.style.textAlign = 'center';
        return;
    }

    data.forEach(employee => {
        const row = employeePerformanceTableBody.insertRow();
        const employeeCell = row.insertCell();
        const reportCountCell = row.insertCell();

        employeeCell.innerHTML = `
            <div class="employee-info">
                <span>${employee.username}</span>
                ${employee.avatar_url ? `<img src="${employee.avatar_url}" alt="${employee.username}" class="employee-avatar">` : ''}
            </div>
        `;
        reportCountCell.textContent = employee.report_count;
    });
}

// Function to update all charts and table
async function updateDashboard(filter) {
    const analyticsData = await fetchAnalyticsData(filter);
    if (analyticsData) {
        renderMostFrequentCompetitionsChart(analyticsData.most_frequent_competitions);
        renderEmployeePerformanceTable(analyticsData.employee_performance);
    }
}

// Initialization
export function init() {
    // DOM Elements - moved inside init()
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const applyDateFilterBtn = document.getElementById('applyDateFilter');
    // Initial load — default to last 7 days
    updateDashboard('7');

    // Apply date filter (from/to)
    if (applyDateFilterBtn) {
        applyDateFilterBtn.addEventListener('click', () => {
            const from = fromDateInput?.value || '';
            const to = toDateInput?.value || '';
            if (!from && !to) {
                // if both empty, fall back to 7-day range
                updateDashboard('7');
                return;
            }
            updateDashboard({ from, to });
        });
    }
}
