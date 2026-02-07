(function () {
    const state = {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(), // 0-indexed
        data: null,
        selectedDate: null
    };

    const init = async () => {
        await fetchData();
        fetchAndDisplayGoalRoadmap(); // Correctly initialize the shifted roadmap
        renderHeatmap();
        renderCalendar();
        setupEventListeners();
    };

    async function fetchAndDisplayGoalRoadmap() {
        const foundationList = document.getElementById('foundation-goals-list');
        const dailyList = document.getElementById('daily-routine-list');
        const progressBar = document.getElementById('goal-progress-bar');
        const percentageText = document.getElementById('goal-percentage');

        if (!foundationList || !dailyList) return;

        try {
            const response = await fetch('api/performance/goal-status.php');
            const result = await response.json();

            if (result.success && result.goals) {
                const goals = result.goals;

                // 1. Render Foundation Goals
                foundationList.innerHTML = Object.keys(goals.setup).map(key => {
                    const goal = goals.setup[key];
                    const icon = goal.completed ? 'check_circle' : 'pending';
                    const iconColor = goal.completed ? 'text-emerald-500' : 'text-gray-300';
                    return `
                        <li class="flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined ${iconColor}">${icon}</span>
                                <span class="text-sm font-semibold ${goal.completed ? 'text-gray-900' : 'text-gray-600'}">${goal.title}</span>
                            </div>
                            <span class="text-xs font-bold ${goal.completed ? 'text-emerald-600' : 'text-gray-400'}">${goal.current}/${goal.total}</span>
                        </li>
                    `;
                }).join('');

                // 2. Render Daily Routine
                dailyList.innerHTML = Object.keys(goals.daily).map(key => {
                    const goal = goals.daily[key];
                    const icon = goal.completed ? 'verified' : 'circle';
                    const iconColor = goal.completed ? 'text-emerald-500' : 'text-indigo-200';
                    return `
                        <li class="flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined ${iconColor}">${icon}</span>
                                <span class="text-sm font-semibold ${goal.completed ? 'text-gray-900' : 'text-gray-600'}">${goal.title}</span>
                            </div>
                            ${goal.completed ? '<span class="text-[10px] font-black text-emerald-600 uppercase">Done</span>' : '<span class="text-[10px] font-bold text-indigo-400 uppercase">Pending</span>'}
                        </li>
                    `;
                }).join('');

                // 3. Update Overall Progress
                const allGoals = [...Object.values(goals.setup), ...Object.values(goals.daily)];
                const completedCount = allGoals.filter(g => g.completed).length;
                const totalCount = allGoals.length;
                const percentage = Math.round((completedCount / totalCount) * 100);

                if (progressBar) {
                    const circumference = 2 * Math.PI * 28;
                    const offset = circumference - (percentage / 100) * circumference;
                    progressBar.style.strokeDashoffset = offset;
                }
                if (percentageText) percentageText.textContent = `${percentage}%`;

                // Fetch and render small badge summary
                fetchAndRenderBadges();
            }
        } catch (error) {
            console.error("Error fetching goal roadmap:", error);
        }
    }

    async function fetchAndRenderBadges() {
        const summaryBadgeText = document.getElementById('earned-badge-text');
        const summaryBadgeEl = document.getElementById('dashboard-badge-summary');

        try {
            const response = await fetch('api/performance/badges.php');
            const result = await response.json();

            if (result.success && summaryBadgeText && summaryBadgeEl) {
                summaryBadgeText.textContent = `${result.earned_count} Badges Earned`;
                summaryBadgeEl.classList.remove('opacity-0');
            }
        } catch (error) {
            console.error("Error fetching badges:", error);
        }
    }

    const fetchData = async () => {
        try {
            const response = await fetch(`api/performance/study-discipline.php?month=${state.currentMonth + 1}&year=${state.currentYear}`);
            const result = await response.json();
            if (result.success) {
                state.data = result.data;
                updateStats();
            }
        } catch (error) {
            console.error("Failed to fetch discipline data:", error);
        }
    };


    const updateStats = () => {
        document.getElementById('current-streak').textContent = `${state.data.streak} Days`;

        const monthlyRecords = state.data.monthly_details || [];
        document.getElementById('total-exams-month').textContent = monthlyRecords.length;

        const activeDays = new Set(monthlyRecords.map(r => r.attempt_time.split(' ')[0])).size;
        document.getElementById('active-days-month').textContent = activeDays;

        const today = new Date().toISOString().split('T')[0];
        const todayExams = monthlyRecords.filter(r => r.attempt_time.startsWith(today)).length;
        const goal = 3;
        const goalEl = document.getElementById('today-goal-status');
        const barEl = document.getElementById('goal-mini-bar');

        if (goalEl) goalEl.textContent = `${todayExams} / ${goal}`;
        if (barEl) barEl.style.width = `${Math.min((todayExams / goal) * 100, 100)}%`;

        renderActivityList(monthlyRecords);
    };

    const renderHeatmap = () => {
        const container = document.getElementById('heatmap-grid');
        if (!container) return;
        container.innerHTML = '';

        const today = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 4);

        // Find the first Sunday
        while (startDate.getDay() !== 0) {
            startDate.setDate(startDate.getDate() - 1);
        }

        let currentDate = new Date(startDate);
        const activity = state.data.activity || {};

        for (let col = 0; col < 20; col++) { // Roughly 20 weeks
            const colDiv = document.createElement('div');
            colDiv.className = 'heatmap-col';

            for (let row = 0; row < 7; row++) {
                const dayDiv = document.createElement('div');
                const dateStr = currentDate.toISOString().split('T')[0];
                const count = activity[dateStr] || 0;

                dayDiv.className = 'heatmap-day';
                dayDiv.title = `${dateStr}: ${count} activities`;

                if (count === 0) dayDiv.classList.add('bg-gray-100');
                else if (count === 1) dayDiv.classList.add('bg-emerald-200'); // Lightest: 1 activity (Start)
                else if (count === 2) dayDiv.classList.add('bg-emerald-400'); // Medium: 2 activities
                else dayDiv.classList.add('bg-emerald-600'); // Deepest: 3+ activities (Goal Met)

                colDiv.appendChild(dayDiv);
                currentDate.setDate(currentDate.getDate() + 1);
                if (currentDate > today) break;
            }
            container.appendChild(colDiv);
            if (currentDate > today) break;
        }
    };

    const renderCalendar = () => {
        const grid = document.getElementById('calendar-grid');
        const header = document.getElementById('calendar-header');
        if (!grid || !header) return;

        grid.innerHTML = '';
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        header.textContent = `${monthNames[state.currentMonth]} ${state.currentYear}`;

        const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
        const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

        // Padding for empty days
        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('div'));
        }

        const today = new Date().toISOString().split('T')[0];
        const activityDates = new Set();
        (state.data.monthly_details || []).forEach(r => activityDates.add(r.attempt_time.split(' ')[0]));

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = day;

            const fullDate = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (fullDate === today) dayDiv.classList.add('today');
            if (activityDates.has(fullDate)) dayDiv.classList.add('has-activity');

            dayDiv.onclick = () => {
                document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                dayDiv.classList.add('selected');
                state.selectedDate = fullDate;
                filterActivitiesByDate(fullDate);
            };

            grid.appendChild(dayDiv);
        }
    };

    const renderActivityList = (activities) => {
        const list = document.getElementById('activity-details-list');
        if (!list) return;
        list.innerHTML = '';

        if (activities.length === 0) {
            list.innerHTML = `
                <div class="text-center py-10 text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2">history</span>
                    <p>No activities recorded for this period</p>
                </div>`;
            return;
        }

        activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-card animate-slide-in';
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-gray-800">${activity.exam_title}</p>
                        <p class="text-xs text-indigo-600 font-semibold">${activity.subject_name}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-indigo-700">${Math.round(activity.score_with_negative)}%</p>
                        <p class="text-[10px] text-gray-400 uppercase font-bold">${activity.attempt_time.split(' ')[1]}</p>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    };

    const filterActivitiesByDate = (date) => {
        document.getElementById('selected-date-label').textContent = date;
        const filtered = (state.data.monthly_details || []).filter(r => r.attempt_time.startsWith(date));
        renderActivityList(filtered);
    };

    const setupEventListeners = () => {
        document.getElementById('prev-month').onclick = async () => {
            state.currentMonth--;
            if (state.currentMonth < 0) {
                state.currentMonth = 11;
                state.currentYear--;
            }
            await fetchData();
            renderCalendar();
        };

        document.getElementById('next-month').onclick = async () => {
            state.currentMonth++;
            if (state.currentMonth > 11) {
                state.currentMonth = 0;
                state.currentYear++;
            }
            await fetchData();
            renderCalendar();
        };
    };

    init();
})();
