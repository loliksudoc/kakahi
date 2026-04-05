/**
 * 📖 Логика электронной книги
 * Перелистывание, звуки, сохранение состояния
 */

// ═══════════════════════════════════════════════════════════
// 🎵 ЗВУКОВЫЕ ЭФФЕКТЫ (Web Audio API)
// ═══════════════════════════════════════════════════════════

class PageFlipSound {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            const audioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new audioContextClass();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API не поддерживается');
            this.initialized = false;
        }
    }

    // Генерируем звук перелистывания
    playFlipSound() {
        if (!this.initialized || !this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // Осциллятор для "шелестящего" звука
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        
        // Создаём шум
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        noise.loop = false;
        
        // Параметры звука
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        
        osc2.frequency.setValueAtTime(300, now);
        osc2.frequency.exponentialRampToValueAtTime(250, now + 0.15);
        
        // Громкость
        const gainOsc1 = ctx.createGain();
        const gainOsc2 = ctx.createGain();
        const gainNoise = ctx.createGain();
        const gainMaster = ctx.createGain();
        
        gainOsc1.gain.setValueAtTime(0.1, now);
        gainOsc1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        gainOsc2.gain.setValueAtTime(0.08, now);
        gainOsc2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        gainNoise.gain.setValueAtTime(0.15, now);
        gainNoise.gain.exponentialRampToValueAtTime(0.02, now + 0.15);
        
        gainMaster.gain.setValueAtTime(0.3, now);
        
        // Подключаем
        osc1.connect(gainOsc1);
        osc2.connect(gainOsc2);
        noise.connect(gainNoise);
        
        gainOsc1.connect(gainMaster);
        gainOsc2.connect(gainMaster);
        gainNoise.connect(gainMaster);
        
        gainMaster.connect(ctx.destination);
        
        // Запускаем
        osc1.start(now);
        osc2.start(now);
        noise.start(now);
        
        // Останавливаем
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.15);
        noise.stop(now + 0.15);
    }
}

// ═══════════════════════════════════════════════════════════
// 📖 КЛАСС УПРАВЛЕНИЯ ПРИЛОЖЕНИЕМ
// ═══════════════════════════════════════════════════════════

class BookApp {
    constructor() {
        this.coverView = document.getElementById('coverView');
        this.readerView = document.getElementById('readerView');
        this.book3dContainer = document.getElementById('book3dContainer');
        this.reader = null;
        
        this.init();
    }

    init() {
        // Клик по 3D книге - открываем читателя
        this.book3dContainer.addEventListener('click', (e) => {
            this.openBook();
        });
    }

    openBook() {
        try {
            // Скрываем обложку
            this.coverView.style.display = 'none';
            this.readerView.classList.remove('hidden');
            
            // Инициализируем читателя если его ещё нет
            if (!this.reader) {
                this.reader = new BookReader(true, this);
            }
        } catch (error) {
            console.error('Ошибка при открытии книги:', error);
        }
    }

    closeBook() {
        // Возвращаемся к обложке
        this.readerView.classList.add('hidden');
        this.coverView.style.display = 'flex';
    }
}

function createEmojiDecor(emoji) {
    const background = document.getElementById('emojiBackground');
    if (!background) return;
    background.innerHTML = '';

    for (let i = 0; i < 12; i += 1) {
        const span = document.createElement('span');
        span.className = 'bg-emoji';
        span.textContent = emoji;
        const size = 28 + Math.round(Math.random() * 32);
        const left = Math.round(Math.random() * 100);
        const top = Math.round(Math.random() * 100);
        const duration = 8 + Math.random() * 6;
        const delay = Math.random() * -6;
        span.style.fontSize = `${size}px`;
        span.style.left = `${left}%`;
        span.style.top = `${top}%`;
        span.style.animationDuration = `${duration}s`;
        span.style.animationDelay = `${delay}s`;
        span.style.opacity = `${0.08 + Math.random() * 0.16}`;
        background.appendChild(span);
    }
}

function setActiveEmoji(button) {
    const buttons = document.querySelectorAll('.emoji-btn');
    buttons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    createEmojiDecor(button.dataset.emoji || '🌸');
}

function initEmojiSidebar() {
    const buttons = document.querySelectorAll('.emoji-btn');
    buttons.forEach((button) => {
        button.addEventListener('click', () => setActiveEmoji(button));
    });
    if (buttons.length) {
        setActiveEmoji(buttons[0]);
    }
}

document.addEventListener('DOMContentLoaded', initEmojiSidebar);

// ═══════════════════════════════════════════════════════════

class BookReader {
    constructor(fromCover = false, app = null) {
        // 📚 Данные
        this.book = BOOK;
        this.app = app;  // Ссылка на родительское приложение
        
        // Если открыли с 3D обложки - начинаем с первого разворота
        if (fromCover) {
            this.currentPageIndex = 0;
        } else {
            // Иначе загружаем сохранённое состояние
            this.currentPageIndex = this.loadPageState();
        }
        
        // 🎵 Звук
        this.sound = new PageFlipSound();
        
        // 🎯 DOM элементы
        this.elements = {
            pageLeft: document.getElementById('pageLeftContent'),
            pageRight: document.getElementById('pageRightContent'),
            pageNumberLeft: document.getElementById('pageNumberLeft'),
            pageNumberRight: document.getElementById('pageNumberRight'),
            btnPrev: document.getElementById('btnPrev'),
            btnNext: document.getElementById('btnNext'),
            pageIndicator: document.getElementById('pageIndicator'),
            book: document.getElementById('book')
        };
        
        // 🔧 Инициализируем
        this.init();
    }

    // ────────────────────────────────────────────────────────
    // 🚀 ИНИЦИАЛИЗАЦИЯ
    // ────────────────────────────────────────────────────────

    init() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        // Кнопки навигации
        this.elements.btnPrev.addEventListener('click', () => this.prevPage());
        this.elements.btnNext.addEventListener('click', () => this.nextPage());
        
        // Клавиатура
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Клик по страницам
        this.elements.pageLeft.parentElement.addEventListener('click', () => this.prevPage());
        this.elements.pageRight.parentElement.addEventListener('click', () => this.nextPage());
    }

    // ────────────────────────────────────────────────────────
    // ⌨️ ОБРАБОТКА КЛАВИАТУРЫ
    // ────────────────────────────────────────────────────────

    handleKeyboard(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            this.prevPage();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            this.nextPage();
        }
    }

    // ────────────────────────────────────────────────────────
    // 📖 НАВИГАЦИЯ
    // ────────────────────────────────────────────────────────

    nextPage() {
        // Листаем на следующий разворот (две страницы), если он есть
        if (this.currentPageIndex + 2 < this.book.pages.length) {
            this.currentPageIndex += 2;
            this.savePageState();
            this.playSound();
            this.render();
        }
    }

    prevPage() {
        // Листаем на предыдущий разворот (две страницы)
        if (this.currentPageIndex >= 2) {
            this.currentPageIndex -= 2;
            this.savePageState();
            this.playSound();
            this.render();
        } else if (this.currentPageIndex > 0) {
            // На первом разворте - закрыть книгу
            if (this.app) {
                this.app.closeBook();
                this.app.reader = null;
            }
        } else {
            // На первой странице - закрыть книгу и вернуться на 3D обложку
            if (this.app) {
                this.app.closeBook();
                this.app.reader = null;
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 🎨 ОТРИСОВКА
    // ────────────────────────────────────────────────────────
    // 🎨 ОТРИСОВКА
    // ────────────────────────────────────────────────────────

    render() {
        // Всегда показываем страницы (обложка только в 3D виде)
        this.renderPages();
        this.updateControls();
    }

    renderPages() {
        // Показываем обе страницы
        this.elements.pageLeft.parentElement.style.display = 'flex';
        this.elements.pageRight.parentElement.style.display = 'flex';
        
        // Левая страница - показываем текущую страницу
        this.elements.pageLeft.innerHTML = this.book.pages[this.currentPageIndex] || '';
        this.elements.pageNumberLeft.textContent = `${this.currentPageIndex + 1}`;
        
        // Правая страница - показываем следующую страницу
        const hasNextPage = this.currentPageIndex + 1 < this.book.pages.length;
        if (hasNextPage) {
            const isLastSpread = this.currentPageIndex + 2 >= this.book.pages.length;
            const nextPageIndex = this.currentPageIndex + 1;
            this.elements.pageRight.innerHTML = isLastSpread
                ? this.renderUniversalLastPage()
                : this.book.pages[nextPageIndex];
            this.elements.pageNumberRight.textContent = isLastSpread ? '' : `${nextPageIndex + 1}`;
        } else {
            this.elements.pageRight.innerHTML = this.renderUniversalLastPage();
            this.elements.pageNumberRight.textContent = '';
        }
        
        // Индикатор - показываем разворот
        const totalPages = this.book.pages.length;
        const leftPageNum = this.currentPageIndex + 1;
        const rightPageNum = Math.min(this.currentPageIndex + 2, totalPages);
        this.elements.pageIndicator.textContent = `📖 Страницы ${leftPageNum}-${rightPageNum} из ${totalPages}`;
    }

    renderUniversalLastPage() {
        return `
            <div class="universal-end">
                <h2>Какашки</h2>
                <p>Руфина какаха ок.</p>
            </div>
        `;
    }

    updateControls() {
        // Блокируем кнопки если нужно
        this.elements.btnPrev.disabled = false;
        this.elements.btnNext.disabled = false;
    }

    // ────────────────────────────────────────────────────────
    // 🎵 ЗВУК
    // ────────────────────────────────────────────────────────

    playSound() {
        this.sound.playFlipSound();
    }

    // ────────────────────────────────────────────────────────
    // 💾 СОХРАНЕНИЕ СОСТОЯНИЯ
    // ────────────────────────────────────────────────────────

    savePageState() {
        // Сохраняем индекс левой страницы разворота
        localStorage.setItem('bookReader_currentPage', JSON.stringify(this.currentPageIndex));
    }

    loadPageState() {
        const saved = localStorage.getItem('bookReader_currentPage');
        if (saved !== null) {
            const index = JSON.parse(saved);
            // Округляем до четного индекса (для разворотов)
            const evenIndex = Math.floor(index / 2) * 2;
            return Math.max(0, Math.min(evenIndex, this.book.pages.length - 2));
        }
        // По умолчанию начинаем с первого разворота (страницы 0-1)
        return 0;
    }
}

// ═══════════════════════════════════════════════════════════
// 🚀 ЗАПУСК
// ═══════════════════════════════════════════════════════════

// Инициализируем приложение когда DOM готов
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.bookApp = new BookApp();
    });
} else {
    window.bookApp = new BookApp();
}
