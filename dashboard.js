document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logoutBtn.disabled = true;
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' }
                });
            } finally {
                // The server invalidates the session and expires the HttpOnly cookie.
                window.location.replace('/index.html');
            }
        });
    }

    let sessionData;
    try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (response.status === 401) {
            window.location.replace('/index.html');
            return;
        }
        if (!response.ok) throw new Error('Unable to verify your sign-in.');
        if (!response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('The sign-in service returned an unexpected response.');
        }
        sessionData = await response.json();
    } catch (error) {
        const notice = document.createElement('p');
        notice.className = 'schedule-notice error';
        notice.setAttribute('role', 'alert');
        notice.textContent = `${error.message} Reload the page or contact your administrator.`;
        document.querySelector('.main-content').prepend(notice);
        return;
    }

    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    const userAvatarEl = document.getElementById('userAvatar');

    const displayName = sessionData.name || sessionData.email || 'Technician';
    if (userNameEl) userNameEl.textContent = displayName;
    if (userRoleEl) userRoleEl.textContent = sessionData.email || 'Authorised staff';

    if (userAvatarEl) {
        const initials = displayName
            .split(' ')
            .map(name => name[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
        userAvatarEl.textContent = initials || 'TC';
    }

    // Sidebar Tab Navigation Switcher
    const navItems = document.querySelectorAll('.sidebar-menu .nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.getAttribute('data-target');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            viewSections.forEach(section => {
                section.classList.toggle('hidden', section.id !== `section-${targetSection}`);
            });
        });
    });

    const quickIntakeBtn = document.getElementById('quickIntakeBtn');
    if (quickIntakeBtn) {
        quickIntakeBtn.addEventListener('click', () => {
            document.querySelector('[data-target="job-intake"]').click();
        });
    }

    const scheduleForm = document.getElementById('scheduleForm');
    const scheduleWeek = document.getElementById('scheduleWeek');
    const scheduleNotice = document.getElementById('scheduleNotice');
    const scheduleWeekLabel = document.getElementById('scheduleWeekLabel');
    const toggleScheduleForm = document.getElementById('toggleScheduleForm');
    const scheduleDateInput = document.getElementById('scheduleDate');
    const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });
    const weekdayFormatter = new Intl.DateTimeFormat('en-AU', { weekday: 'short' });
    const monthFormatter = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' });

    let appointments = [];
    let scheduleLoadId = 0;
    let isSavingBooking = false;
    let displayedWeek = getMonday(new Date());

    function toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getMonday(date) {
        const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        return monday;
    }

    function showScheduleNotice(message, isError = false) {
        scheduleNotice.textContent = message;
        scheduleNotice.classList.toggle('hidden', !message);
        scheduleNotice.classList.toggle('error', isError);
    }

    function setScheduleControlsEnabled(enabled) {
        scheduleForm.querySelectorAll('input, button[type="submit"]').forEach(control => {
            control.disabled = !enabled || (isSavingBooking && control.type === 'submit');
        });
        toggleScheduleForm.disabled = !enabled;
    }

    async function scheduleRequest(url, options = {}) {
        const response = await fetch(url, {
            cache: 'no-store',
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        });
        if (response.status === 401) {
            window.location.replace('/index.html');
            throw new Error('Your sign-in could not be verified.');
        }
        if (!response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('The timetable API returned an unexpected response.');
        }
        const result = await response.json();
        if (!response.ok) {
            const error = new Error(result.error || 'The timetable request failed.');
            error.status = response.status;
            throw error;
        }
        return result;
    }

    async function refreshSchedule() {
        const loadId = ++scheduleLoadId;
        const weekEnd = new Date(displayedWeek);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const query = new URLSearchParams({ from: toDateKey(displayedWeek), to: toDateKey(weekEnd) });

        try {
            const result = await scheduleRequest(`/api/schedule?${query}`);
            if (loadId !== scheduleLoadId) return false;
            if (!Array.isArray(result)) throw new Error('The server returned an invalid timetable.');
            appointments = result;
            renderSchedule();
            setScheduleControlsEnabled(true);
            return true;
        } catch (error) {
            if (loadId === scheduleLoadId) showScheduleNotice(`Unable to load timetable: ${error.message}`, true);
            return false;
        }
    }

    function formatTime(time) {
        const [hour, minute] = time.split(':').map(Number);
        const period = hour >= 12 ? 'pm' : 'am';
        return `${hour % 12 || 12}:${String(minute).padStart(2, '0')}${period}`;
    }

    function renderSchedule() {
        const weekEnd = new Date(displayedWeek);
        weekEnd.setDate(weekEnd.getDate() + 6);
        scheduleWeekLabel.textContent = `${monthFormatter.format(displayedWeek)} · ${dateFormatter.format(displayedWeek)} – ${dateFormatter.format(weekEnd)}`;
        scheduleWeek.replaceChildren();

        for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
            const day = new Date(displayedWeek);
            day.setDate(day.getDate() + dayOffset);
            const dateKey = toDateKey(day);
            const dayColumn = document.createElement('section');
            dayColumn.className = 'schedule-day';
            dayColumn.setAttribute('aria-label', `${weekdayFormatter.format(day)} ${dateFormatter.format(day)}`);

            const dayHeader = document.createElement('div');
            dayHeader.className = 'schedule-day-header';
            const weekday = document.createElement('span');
            weekday.className = 'schedule-weekday';
            weekday.textContent = weekdayFormatter.format(day);
            const date = document.createElement('span');
            date.className = 'schedule-date';
            date.textContent = dateFormatter.format(day);
            dayHeader.append(weekday, date);
            dayColumn.append(dayHeader);

            const dayAppointments = appointments
                .filter(appointment => appointment.date === dateKey)
                .sort((first, second) => first.start.localeCompare(second.start));

            if (!dayAppointments.length) {
                const emptyMessage = document.createElement('p');
                emptyMessage.className = 'schedule-empty';
                emptyMessage.textContent = 'No jobs scheduled';
                dayColumn.append(emptyMessage);
            }

            dayAppointments.forEach(appointment => {
                const booking = document.createElement('article');
                booking.className = 'schedule-booking';
                const time = document.createElement('p');
                time.className = 'schedule-booking-time';
                time.textContent = `${formatTime(appointment.start)} – ${formatTime(appointment.end)}`;
                const job = document.createElement('h4');
                job.textContent = appointment.job;
                const technician = document.createElement('p');
                technician.className = 'schedule-booking-technician';
                technician.textContent = appointment.technician;
                const location = document.createElement('p');
                location.className = 'schedule-booking-location';
                location.textContent = appointment.location;
                const removeButton = document.createElement('button');
                removeButton.className = 'schedule-remove';
                removeButton.type = 'button';
                removeButton.textContent = 'Remove';
                removeButton.setAttribute('aria-label', `Remove ${appointment.job} booking`);
                removeButton.addEventListener('click', async () => {
                    removeButton.disabled = true;
                    try {
                        await scheduleRequest(`/api/schedule?id=${encodeURIComponent(appointment.id)}`, { method: 'DELETE' });
                        if (await refreshSchedule()) showScheduleNotice('Booking removed.');
                    } catch (error) {
                        showScheduleNotice(`Unable to remove booking: ${error.message}`, true);
                        removeButton.disabled = false;
                    }
                });
                booking.append(time, job, technician, location, removeButton);
                dayColumn.append(booking);
            });
            scheduleWeek.append(dayColumn);
        }
    }

    function closeScheduleForm() {
        scheduleForm.classList.add('hidden');
        toggleScheduleForm.setAttribute('aria-expanded', 'false');
    }

    scheduleDateInput.value = toDateKey(new Date());
    scheduleDateInput.min = toDateKey(new Date());
    setScheduleControlsEnabled(false);
    scheduleWeek.setAttribute('aria-busy', 'true');
    refreshSchedule().finally(() => scheduleWeek.setAttribute('aria-busy', 'false'));

    toggleScheduleForm.addEventListener('click', () => {
        const isOpening = scheduleForm.classList.contains('hidden');
        scheduleForm.classList.toggle('hidden', !isOpening);
        toggleScheduleForm.setAttribute('aria-expanded', String(isOpening));
        if (isOpening) document.getElementById('scheduleJob').focus();
    });

    document.getElementById('cancelSchedule').addEventListener('click', closeScheduleForm);

    scheduleForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (isSavingBooking) return;
        showScheduleNotice('');

        const formData = new FormData(scheduleForm);
        const booking = {
            job: String(formData.get('job') || '').trim(),
            technician: String(formData.get('technician') || '').trim(),
            date: formData.get('date'),
            start: formData.get('start'),
            end: formData.get('end'),
            location: String(formData.get('location') || '').trim()
        };

        if (!booking.job || !booking.technician || !booking.date || !booking.start || !booking.end || !booking.location) {
            showScheduleNotice('Complete all booking fields before saving.', true);
            return;
        }
        if (booking.end <= booking.start) {
            showScheduleNotice('End time must be later than start time.', true);
            return;
        }
        const hasConflict = appointments.some(appointment =>
            appointment.date === booking.date &&
            appointment.technician.toLocaleLowerCase() === booking.technician.toLocaleLowerCase() &&
            booking.start < appointment.end && booking.end > appointment.start
        );
        if (hasConflict) {
            showScheduleNotice('This technician already has a booking during that time.', true);
            return;
        }

        isSavingBooking = true;
        scheduleForm.querySelector('button[type="submit"]').disabled = true;
        try {
            await scheduleRequest('/api/schedule', { method: 'POST', body: JSON.stringify(booking) });
            displayedWeek = getMonday(new Date(`${booking.date}T00:00:00`));
            scheduleForm.reset();
            scheduleDateInput.value = booking.date;
            closeScheduleForm();
            if (await refreshSchedule()) showScheduleNotice('Job booking saved.');
        } catch (error) {
            if (error.status === 409) {
                const refreshed = await refreshSchedule();
                showScheduleNotice(refreshed
                    ? error.message
                    : `${error.message} Timetable refresh failed; reload the page to see current bookings.`, true);
            } else {
                showScheduleNotice(`Unable to save booking: ${error.message}`, true);
            }
        } finally {
            isSavingBooking = false;
            setScheduleControlsEnabled(true);
        }
    });

    document.getElementById('previousWeek').addEventListener('click', () => {
        displayedWeek.setDate(displayedWeek.getDate() - 7);
        refreshSchedule();
    });
    document.getElementById('nextWeek').addEventListener('click', () => {
        displayedWeek.setDate(displayedWeek.getDate() + 7);
        refreshSchedule();
    });
    document.getElementById('currentWeek').addEventListener('click', () => {
        displayedWeek = getMonday(new Date());
        refreshSchedule();
    });

    window.addEventListener('focus', () => {
        if (!document.hidden) refreshSchedule();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshSchedule();
    });
    window.setInterval(() => {
        if (!document.hidden && !isSavingBooking) refreshSchedule();
    }, 30000);
});
