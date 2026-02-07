(function () {
    const state = {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(), // 0-indexed
        data: null,
        selectedDate: null
    };

    const init = async () => {
        await fetchData();
        renderHeatmap();
        renderCalendar();
        setupEventListeners();
    };

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

        if (monthlyRecords.length > 0) {
            const avgScore = monthlyRecords.reduce((acc, curr) => acc + parseFloat(curr.score_with_negative), 0) / monthlyRecords.length;
            document.getElementById('avg-score-month').textContent = `${Math.round(avgScore)}%`;
        } else {
            document.getElementById('avg-score-month').textContent = `0%`;
        }

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
                else if (count <= 2) dayDiv.classList.add('bg-emerald-200');
                else if (count <= 5) dayDiv.classList.add('bg-emerald-400');
                else dayDiv.classList.add('bg-emerald-600');

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
