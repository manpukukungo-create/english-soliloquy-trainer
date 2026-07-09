// Application State
const state = {
  partsA: [],
  partsB: [],
  selectedPartA: null,
  selectedPartB: null,
  activeTypeFilter: 'all',
  activeCategoryFilter: 'all',
  searchQueryB: '',
  speechSpeed: 1.0
};

// Type specific color tokens (matching style.css)
const typeColors = {
  'Type 1': '#ff5e7e',
  'Type 2': '#ff9f43',
  'Type 3': '#00d2d3',
  'Type 4': '#10ac84',
  'Type 5': '#54a0ff'
};

const typeGlows = {
  'Type 1': 'rgba(255, 94, 126, 0.15)',
  'Type 2': 'rgba(255, 159, 67, 0.15)',
  'Type 3': 'rgba(0, 210, 243, 0.15)',
  'Type 4': 'rgba(16, 172, 132, 0.15)',
  'Type 5': 'rgba(84, 160, 255, 0.15)'
};

// DOM Elements
const elements = {
  partsAList: document.getElementById('parts-a-list'),
  partsBList: document.getElementById('parts-b-list'),
  typeTabsContainer: document.getElementById('type-tabs'),
  partsBSearch: document.getElementById('parts-b-search'),
  categoryStrip: document.getElementById('category-strip'),
  resultCard: document.getElementById('result-card'),
  resultPlaceholder: document.getElementById('result-placeholder'),
  resultContent: document.getElementById('result-content'),
  resultText: document.getElementById('result-text'),
  resultKana: document.getElementById('result-kana'),
  resultTranslation: document.getElementById('result-translation'),
  speedSlider: document.getElementById('speed-slider'),
  speedVal: document.getElementById('speed-val'),
  speakBtn: document.getElementById('speak-btn'),
  recordBtn: document.getElementById('record-btn'),
  feedbackBox: document.getElementById('feedback-box'),
  feedbackScore: document.getElementById('feedback-score'),
  feedbackText: document.getElementById('feedback-text'),
  partsACount: document.getElementById('parts-a-count'),
  partsBCount: document.getElementById('parts-b-count'),
  appContainer: document.getElementById('app-container')
};

// Web Speech APIs
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

// Initialize Application
async function init() {
  setupEventListeners();
  await loadData();
  renderPartsA();
  updateCategoryStrip();
  renderPartsB();
}

// Load JSON Data
async function loadData() {
  try {
    const [resA, resB] = await Promise.all([
      fetch('data/parts_a.json'),
      fetch('data/parts_b.json')
    ]);
    state.partsA = await resA.json();
    state.partsB = await resB.json();
    
    // Sort items by No.
    state.partsA.sort((a, b) => parseInt(a.no) - parseInt(b.no));
    state.partsB.sort((a, b) => parseInt(a.no) - parseInt(b.no));
    
    // Assign clean unique IDs to avoid escaping/whitespace issues in DOM attributes
    state.partsA.forEach((item, index) => {
      item.id = `a-${index}`;
    });
    state.partsB.forEach((item, index) => {
      item.id = `b-${index}`;
    });
    
    console.log(`Loaded ${state.partsA.length} Parts A`);
    console.log(`Loaded ${state.partsB.length} Parts B`);
  } catch (error) {
    console.error('Failed to load JSON data:', error);
    elements.partsAList.innerHTML = '<div class="loading-placeholder" style="color:#ff5e7e;">データの読み込みに失敗しました。</div>';
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Type Tabs
  elements.typeTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-tab-btn');
    if (!btn) return;
    
    document.querySelectorAll('.type-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.activeTypeFilter = btn.getAttribute('data-type');
    renderPartsA();
  });

  // Search input for Part B
  elements.partsBSearch.addEventListener('input', (e) => {
    state.searchQueryB = e.target.value.toLowerCase();
    renderPartsB();
  });

  // Category filter strip (delegation)
  elements.categoryStrip.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.activeCategoryFilter = btn.getAttribute('data-category');
    renderPartsB();
  });

  // Speech Speed Slider
  elements.speedSlider.addEventListener('input', (e) => {
    state.speechSpeed = parseFloat(e.target.value);
    elements.speedVal.textContent = state.speechSpeed.toFixed(1);
  });

  // Speak Button (TTS)
  elements.speakBtn.addEventListener('click', speakSentence);

  // Record Button (STT)
  if (recognition) {
    elements.recordBtn.addEventListener('click', toggleRecording);
    
    recognition.onstart = () => {
      elements.recordBtn.classList.add('listening');
      elements.recordBtn.innerHTML = '<i data-lucide="mic-off"></i>録音中...';
      lucide.createIcons();
      hideFeedback();
    };

    recognition.onend = () => {
      elements.recordBtn.classList.remove('listening');
      elements.recordBtn.innerHTML = '<i data-lucide="mic"></i>発話練習';
      lucide.createIcons();
    };

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      evaluateSpeech(speechToText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      elements.recordBtn.classList.remove('listening');
      elements.recordBtn.innerHTML = '<i data-lucide="mic"></i>発話練習';
      lucide.createIcons();
      showFeedback('retry', '聞き取れませんでした', 'もう一度はっきりと発音してください。');
    };
  } else {
    elements.recordBtn.style.display = 'none'; // Hide if browser doesn't support STT
  }
}

// Render Parts A
function renderPartsA() {
  const filtered = state.activeTypeFilter === 'all' 
    ? state.partsA 
    : state.partsA.filter(item => item.type === state.activeTypeFilter);

  elements.partsACount.textContent = filtered.length;

  if (filtered.length === 0) {
    elements.partsAList.innerHTML = '<div class="loading-placeholder">項目がありません。</div>';
    return;
  }

  elements.partsAList.innerHTML = filtered.map(item => {
    const isActive = state.selectedPartA && state.selectedPartA.id === item.id;
    const typeNum = item.type.split(' ')[1]; // 1, 2, 3...
    
    return `
      <button class="list-row-card ${isActive ? 'active' : ''}" data-id="${item.id}" type="button">
        <span class="card-left">
          <span class="card-eng">${item.eng}</span>
          <span class="card-subtext">${item.kana} / ${item.meaning}</span>
        </span>
        <span class="card-right">
          <span class="type-badge t${typeNum}">${item.type}</span>
        </span>
      </button>
    `;
  }).join('');

  // Add click listener to A list cards
  elements.partsAList.querySelectorAll('.list-row-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const item = state.partsA.find(a => a.id === id);
      
      if (!item) return;

      // Update selected A
      state.selectedPartA = item;
      
      // Dynamic color theme update based on selected Part A Type
      const color = typeColors[item.type] || '#ff5e7e';
      const glow = typeGlows[item.type] || 'rgba(255, 94, 126, 0.15)';
      document.documentElement.style.setProperty('--theme-color', color);
      document.documentElement.style.setProperty('--theme-color-glow', glow);
      
      // Reset Part B selection if it doesn't match the new Type
      if (state.selectedPartB && state.selectedPartB.type !== item.type) {
        state.selectedPartB = null;
      }

      // Re-render lists
      renderPartsA();
      updateCategoryStrip();
      renderPartsB();
      updateResultCard();
    });
  });
}

// Update Category Filter Strip based on selected Type's Part B items
function updateCategoryStrip() {
  if (!state.selectedPartA) {
    elements.categoryStrip.innerHTML = '<button class="cat-btn active" data-category="all">すべて</button>';
    state.activeCategoryFilter = 'all';
    return;
  }

  // Get categories from B items that match current Type
  const matchingB = state.partsB.filter(item => item.type === state.selectedPartA.type);
  const categories = ['all', ...new Set(matchingB.map(item => item.category).filter(Boolean))];
  
  elements.categoryStrip.innerHTML = categories.map(cat => {
    const label = cat === 'all' ? 'すべて' : cat;
    const isActive = state.activeCategoryFilter === cat;
    return `
      <button class="cat-btn ${isActive ? 'active' : ''}" data-category="${cat}">${label}</button>
    `;
  }).join('');
  
  // If active filter is no longer available in this set, reset to 'all'
  if (!categories.includes(state.activeCategoryFilter)) {
    state.activeCategoryFilter = 'all';
    const allBtn = elements.categoryStrip.querySelector('.cat-btn[data-category="all"]');
    if (allBtn) allBtn.classList.add('active');
  }
}

// Render Parts B
function renderPartsB() {
  if (!state.selectedPartA) {
    elements.partsBCount.textContent = 0;
    elements.partsBList.innerHTML = '<div class="select-a-prompt-placeholder">先に上のパーツAを選択してください。</div>';
    return;
  }

  // Filter B by matching Type
  let filtered = state.partsB.filter(item => item.type === state.selectedPartA.type);

  // Filter by Category
  if (state.activeCategoryFilter !== 'all') {
    filtered = filtered.filter(item => item.category === state.activeCategoryFilter);
  }

  // Filter by Search Query
  if (state.searchQueryB) {
    filtered = filtered.filter(item => 
      item.eng.toLowerCase().includes(state.searchQueryB) || 
      item.meaning.toLowerCase().includes(state.searchQueryB)
    );
  }

  elements.partsBCount.textContent = filtered.length;

  if (filtered.length === 0) {
    elements.partsBList.innerHTML = '<div class="loading-placeholder">条件に一致する項目がありません。</div>';
    return;
  }

  elements.partsBList.innerHTML = filtered.map(item => {
    const isActive = state.selectedPartB && state.selectedPartB.id === item.id;
    
    return `
      <button class="list-row-card ${isActive ? 'active' : ''}" data-id="${item.id}" type="button">
        <span class="card-left">
          <span class="card-eng">${item.eng}</span>
          <span class="card-subtext">${item.kana} / ${item.meaning}</span>
        </span>
        <span class="card-right">
          ${item.category ? `<span class="card-cat">${item.category}</span>` : ''}
        </span>
      </button>
    `;
  }).join('');

  // Add click listener to B list cards
  elements.partsBList.querySelectorAll('.list-row-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const item = state.partsB.find(b => b.id === id);
      
      if (!item) return;

      state.selectedPartB = item;
      renderPartsB();
      updateResultCard();
    });
  });
}

// Get Combined Sentence string
function getCombinedSentence() {
  if (!state.selectedPartA || !state.selectedPartB) return '';
  
  const aEng = state.selectedPartA.eng;
  const bEng = state.selectedPartB.eng;
  
  let combined = aEng.includes('...') 
    ? aEng.replace('...', ' ' + bEng) 
    : aEng + ' ' + bEng;
    
  combined = combined.trim().replace(/\s+/g, ' ');
  
  // Format punctuation nicely
  if (!combined.endsWith('.') && !combined.endsWith('?') && !combined.endsWith('!')) {
    combined += '.';
  }
  
  return combined;
}

// Update Result Card UI
function updateResultCard() {
  hideFeedback();
  
  if (!state.selectedPartA || !state.selectedPartB) {
    elements.resultPlaceholder.style.display = 'flex';
    elements.resultContent.style.display = 'none';
    elements.resultCard.classList.remove('active');
    return;
  }

  elements.resultPlaceholder.style.display = 'none';
  elements.resultContent.style.display = 'block';
  elements.resultCard.classList.add('active');

  const sentence = getCombinedSentence();
  elements.resultText.textContent = sentence;
  
  // Concatenate Kana
  elements.resultKana.textContent = `${state.selectedPartA.kana} ${state.selectedPartB.kana}`;
  
  // Display A and B Japanese translations side-by-side
  elements.resultTranslation.innerHTML = `
    <strong>[${state.selectedPartB.meaning}]</strong> ＋ <span>[${state.selectedPartA.meaning}]</span>
  `;
  
  // Apply nice enter/active animation
  elements.resultCard.style.animation = 'none';
  elements.resultCard.offsetHeight; // trigger reflow
  elements.resultCard.style.animation = 'slideDown 0.3s ease';
}

// Speak sentence using Speech Synthesis
function speakSentence() {
  const sentence = getCombinedSentence();
  if (!sentence) return;

  // Cancel speaking if already active
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = 'en-US';
  
  // Search for high-quality native English voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(voice => 
    voice.lang.startsWith('en') && 
    (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Samantha') || voice.name.includes('Microsoft Zira'))
  );
  
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  
  utterance.rate = state.speechSpeed;
  window.speechSynthesis.speak(utterance);
}

// Toggle Speech Recognition
function toggleRecording() {
  if (!recognition) return;
  
  if (elements.recordBtn.classList.contains('listening')) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.error('Speech recognition failed to start:', e);
    }
  }
}

// Evaluate spoken speech vs target sentence
function evaluateSpeech(spokenText) {
  const target = getCombinedSentence();
  if (!target) return;

  const normalize = (str) => str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
  
  const normTarget = normalize(target);
  const normSpoken = normalize(spokenText);
  
  const targetWords = normTarget.split(' ');
  const spokenWords = normSpoken.split(' ');
  
  let matchCount = 0;
  const processedSpoken = [];
  
  targetWords.forEach((word) => {
    const idx = spokenWords.indexOf(word);
    if (idx !== -1) {
      matchCount++;
      processedSpoken.push(`<span class="highlight-match">${word}</span>`);
      spokenWords.splice(idx, 1); // prevent duplicate matches
    } else {
      processedSpoken.push(`<span class="highlight-diff">${word}</span>`);
    }
  });

  const accuracy = targetWords.length > 0 ? (matchCount / targetWords.length) * 100 : 0;
  
  let scoreClass = 'retry';
  let scoreLabel = 'もう一度！';
  if (accuracy >= 85) {
    scoreClass = 'match';
    scoreLabel = '素晴らしい！ (Excellent)';
  } else if (accuracy >= 50) {
    scoreClass = 'partial';
    scoreLabel = '惜しい！ (Good Try)';
  }
  
  const feedbackHTML = `
    <div>聞き取り: <span class="transcription">"${spokenText}"</span></div>
    <div style="margin-top: 4px; font-weight: 500;">チェック: ${processedSpoken.join(' ')}</div>
  `;
  
  showFeedback(scoreClass, scoreLabel, feedbackHTML);
}

// Show Speech Feedback Box
function showFeedback(scoreClass, label, contentHTML = '') {
  elements.feedbackBox.style.display = 'flex';
  elements.feedbackScore.className = `score-badge ${scoreClass}`;
  elements.feedbackScore.textContent = label;
  elements.feedbackText.innerHTML = contentHTML;
}

// Hide Speech Feedback Box
function hideFeedback() {
  elements.feedbackBox.style.display = 'none';
  elements.feedbackText.innerHTML = '';
}

// Initialize voices loading
if (window.speechSynthesis) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
}

// Run Initializer
init();
lucide.createIcons();
