/**
 * АВТОЛОСК // Клиентский скрипт управления лендингом
 * Нативный Vanilla JS: маска телефона, выбор пакетов, модальное окно,
 * валидация и отправка заявок в Cloudflare Worker -> Telegram.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const WORKER_URL = 'https://barber-lead.o46164880.workers.dev/';

  // ==============================================================================
  // 1. НАВИГАЦИЯ И МОБИЛЬНОЕ МЕНЮ
  // ==============================================================================
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Закрытие меню при клике на любую ссылку
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ==============================================================================
  // 2. ОГРАНИЧЕНИЕ ВЫБОРА ПРОШЕДШИХ ДАТ (min = СЕГОДНЯ)
  // ==============================================================================
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const bookingDateInput = document.getElementById('bookingDate');
  const modalDateInput = document.getElementById('modalBookingDate');

  if (bookingDateInput) {
    bookingDateInput.min = todayStr;
    bookingDateInput.value = todayStr;
  }
  if (modalDateInput) {
    modalDateInput.min = todayStr;
    modalDateInput.value = todayStr;
  }

  // ==============================================================================
  // 3. МАСКА ТЕЛЕФОНА (+7 (XXX) XXX-XX-XX)
  // ==============================================================================
  function setupPhoneMask(input) {
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = input.value.replace(/\D/g, '');
      let formatted = '';

      if (!value) {
        input.value = '';
        return;
      }

      // Если вводят с 8 или 7, нормализуем
      if (['7', '8', '9'].includes(value[0])) {
        if (value[0] === '9') value = '7' + value;
        const firstDigit = '+7';
        formatted = firstDigit + ' ';

        if (value.length > 1) {
          formatted += '(' + value.substring(1, 4);
        }
        if (value.length >= 5) {
          formatted += ') ' + value.substring(4, 7);
        }
        if (value.length >= 8) {
          formatted += '-' + value.substring(7, 9);
        }
        if (value.length >= 10) {
          formatted += '-' + value.substring(9, 11);
        }
      } else {
        // Другие коды
        formatted = '+' + value.substring(0, 15);
      }

      input.value = formatted;
    });

    input.addEventListener('keydown', (e) => {
      // Очистка при Backspace на пустом вводе
      if (e.key === 'Backspace' && input.value.replace(/\D/g, '').length <= 1) {
        input.value = '';
      }
    });

    input.addEventListener('focus', () => {
      if (!input.value) {
        input.value = '+7 (';
      }
    });

    input.addEventListener('blur', () => {
      if (input.value === '+7 (' || input.value === '+7 ') {
        input.value = '';
      }
    });
  }

  setupPhoneMask(document.getElementById('clientPhone'));
  setupPhoneMask(document.getElementById('modalClientPhone'));

  // ==============================================================================
  // 4. ВЫБОР ПАКЕТА ИЗ ПРАЙС-ЛИСТА
  // ==============================================================================
  const selectPackageButtons = document.querySelectorAll('.select-package-btn');
  const workVolumeSelect = document.getElementById('workVolume');
  const modalWorkVolumeSelect = document.getElementById('modalWorkVolume');

  selectPackageButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPackage = btn.getAttribute('data-target-package');

      if (targetPackage && workVolumeSelect) {
        workVolumeSelect.value = targetPackage;

        // Плавная прокрутка к форме записи
        const bookingSection = document.getElementById('booking');
        if (bookingSection) {
          bookingSection.scrollIntoView({ behavior: 'smooth' });

          // Фокус на поле модели авто
          const carInput = document.getElementById('carModel');
          if (carInput) {
            setTimeout(() => carInput.focus(), 600);
          }
        }
      }

      if (targetPackage && modalWorkVolumeSelect) {
        modalWorkVolumeSelect.value = targetPackage;
      }
    });
  });

  // ==============================================================================
  // 5. МОДАЛЬНОЕ ОКНО
  // ==============================================================================
  const quickModal = document.getElementById('quickModal');
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');

  function openModal() {
    if (!quickModal) return;
    quickModal.classList.add('active');
    quickModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const firstInput = document.getElementById('modalClientName');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function closeModal() {
    if (!quickModal) return;
    quickModal.classList.remove('active');
    quickModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (quickModal) {
    quickModal.addEventListener('click', (e) => {
      if (e.target === quickModal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quickModal && quickModal.classList.contains('active')) {
      closeModal();
    }
  });

  // ==============================================================================
  // 6. ОТПРАВКА ЗАЯВКИ В CLOUDFLARE WORKER -> TELEGRAM
  // ==============================================================================
  async function handleFormSubmit(form, isModal = false) {
    const errorPrefix = isModal ? 'modal' : '';

    // Сброс ошибок
    const errorElements = form.querySelectorAll('.form-error-msg');
    errorElements.forEach(el => el.textContent = '');

    const nameInput = form.querySelector('input[name="name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const carInput = form.querySelector('input[name="carModel"]');
    const serviceSelect = form.querySelector('select[name="workVolume"]');
    const dateInput = form.querySelector('input[name="bookingDate"]');
    const timeSelect = form.querySelector('select[name="timeSlot"]');
    const honeypotInput = form.querySelector('input[name="website"]');
    const submitBtn = form.querySelector('.submit-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const carModel = carInput ? carInput.value.trim() : '';
    const workVolume = serviceSelect ? serviceSelect.value : '';
    const bookingDate = dateInput ? dateInput.value : '';
    const timeSlot = timeSelect ? timeSelect.value : '';

    // 1. Валидация полей
    let isValid = true;

    if (!name || name.length < 2) {
      isValid = false;
      const err = form.querySelector(`#${errorPrefix ? 'modalNameError' : 'nameError'}`);
      if (err) err.textContent = 'Пожалуйста, укажите ваше имя';
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 11) {
      isValid = false;
      const err = form.querySelector(`#${errorPrefix ? 'modalPhoneError' : 'phoneError'}`);
      if (err) err.textContent = 'Введите корректный номер телефона (11 цифр)';
    }

    if (!carModel || carModel.length < 2) {
      isValid = false;
      const err = form.querySelector(`#${errorPrefix ? 'modalCarError' : 'carError'}`);
      if (err) err.textContent = 'Укажите марку и модель авто (например, BMW X5)';
    }

    if (!workVolume) {
      isValid = false;
      const err = form.querySelector(`#${errorPrefix ? 'modalServiceError' : 'serviceError'}`);
      if (err) err.textContent = 'Выберите требуемый пакет услуг';
    }

    if (!isValid) return;

    // 2. Проверка Honeypot ловушки от ботов
    if (honeypotInput && honeypotInput.value.trim() !== '') {
      // Бот попался: имитируем мгновенный успех без отправки запроса
      showSuccess(form, { name, phone, carModel, workVolume, bookingDate, timeSlot }, isModal);
      return;
    }

    // 3. Форматирование поля service для воркера
    // Пример: "Комплекс «Стандарт» | Авто: BMW X5 | Дата: 2026-11-18 (День (12:00 – 16:00))"
    const formattedService = `${workVolume} | Авто: ${carModel} | Дата: ${bookingDate} (${timeSlot})`;

    const payload = {
      name: name,
      phone: phone,
      service: formattedService
    };

    // Блокировка кнопки
    const btnTextEl = submitBtn ? submitBtn.querySelector('.btn-text') : null;
    const originalBtnText = btnTextEl ? btnTextEl.textContent : 'Отправить';
    if (submitBtn) {
      submitBtn.disabled = true;
      if (btnTextEl) btnTextEl.textContent = 'Отправляем заявку в систему...';
    }

    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json().catch(() => ({ ok: true }));

      if (data && data.ok) {
        showSuccess(form, { name, phone, carModel, workVolume, bookingDate, timeSlot }, isModal);
      } else {
        throw new Error('Worker response not ok');
      }

    } catch (error) {
      console.error('Ошибка отправки заявки:', error);
      showError(form, isModal);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalBtnText;
      }
    }
  }

  // Отображение экрана успеха
  function showSuccess(form, data, isModal) {
    if (isModal) {
      const modalSuccessBox = document.getElementById('modalSuccessBox');
      if (modalSuccessBox) {
        form.style.display = 'none';
        modalSuccessBox.style.display = 'block';
      }
      return;
    }

    const formEl = document.getElementById('mainBookingForm');
    const successBox = document.getElementById('bookingSuccessBox');
    const summaryCard = document.getElementById('resultSummaryContent');

    if (formEl && successBox) {
      formEl.style.display = 'none';
      successBox.style.display = 'block';

      if (summaryCard) {
        summaryCard.innerHTML = `
          <div class="summary-row">
            <span class="summary-label">Заказчик:</span>
            <span class="summary-val">${escapeHtml(data.name)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Телефон:</span>
            <span class="summary-val">${escapeHtml(data.phone)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Автомобиль:</span>
            <span class="summary-val">${escapeHtml(data.carModel)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Пакет услуг:</span>
            <span class="summary-val">${escapeHtml(data.workVolume)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Дата и интервал:</span>
            <span class="summary-val">${escapeHtml(data.bookingDate)} (${escapeHtml(data.timeSlot)})</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Сушка турбофенами:</span>
            <span class="summary-val text-amber">Включена (0.0% влажности)</span>
          </div>
        `;
      }

      successBox.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Отображение экрана ошибки
  function showError(form, isModal) {
    if (isModal) {
      alert('Сетевая ошибка при связи с сервером. Пожалуйста, напишите нам напрямую в Telegram @avtolosk или позвоните +7 (495) 842-19-30.');
      return;
    }

    const formEl = document.getElementById('mainBookingForm');
    const errorBox = document.getElementById('bookingErrorBox');

    if (formEl && errorBox) {
      formEl.style.display = 'none';
      errorBox.style.display = 'block';

      const retryBtn = document.getElementById('retrySubmitBtn');
      if (retryBtn) {
        retryBtn.onclick = () => {
          errorBox.style.display = 'none';
          formEl.style.display = 'block';
        };
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Привязка обработчиков отправки форм
  const mainForm = document.getElementById('mainBookingForm');
  if (mainForm) {
    mainForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit(mainForm, false);
    });
  }

  const modalForm = document.getElementById('modalBookingForm');
  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit(modalForm, true);
    });
  }

});
