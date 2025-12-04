/**
 * CENTER.JS - Gerenciador Central de Interatividade
 * 
 * Responsabilidades principais:
 * 1. Renderização de cartões de álbuns populares (Tops de gêneros)
 * 2. Funcionalidade de busca com debounce (busca em tempo real)
 * 3. Player de música com controles básicos (play/pause)
 * 4. Integração com listas de músicas (song-item e result-item)
 * 5. Animações visuais (classe 'playing')
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("center.js carregado e pronto");

  // Renderização dinâmica dos álbuns populares 
  
  /**
   * Renderiza dinamicamente os cartões dos álbuns populares 
   * Cada cartão contém uma imagem, nome do gênero e link para página de top
   */
  const albunsgridElement = document.querySelector('.albunsgrid');
  if (albunsgridElement) {
    // Verifica se já foi renderizado para não duplicar
    if (albunsgridElement.children.length === 0) {
      
      // Define os álbuns/tops a serem exibidos
      const albumRoutes = [
        { 
          name: 'Tops Rock', 
          imagens: '/static/imagens/guns-n-roses-icon-logo-260nw-2410816231.webp', 
          route: '/tops-rock' 
        },
        { 
          name: 'Tops Sertanejo', 
          imagens: '/static/imagens/AMADO-BATISTA-AMOR3.jpg', 
          route: '/tops-sertanejo' 
        },
        { 
          name: 'Tops Eletrônica', 
          imagens: '/static/imagens/images.png', 
          route: '/tops-eletronica' 
        },
        { 
          name: 'Tops Pop', 
          imagens: '/static/imagens/images.jpeg', 
          route: '/tops-pop' 
        },
      ];

      // Renderiza cada álbum como um cartão clicável
      albumRoutes.forEach(album => {
        // Cria o link
        const albumCard = document.createElement('a');
        albumCard.href = album.route;
        albumCard.style.textDecoration = 'none';
        albumCard.style.color = 'inherit';
        albumCard.className = 'album-card-link';
        
        // Cria o cartão com imagem e nome
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
          <img src="${album.imagens}" alt="${escapeHtml(album.name)}">
          <p>${escapeHtml(album.name)}</p>
        `;
        
        // Monta a estrutura: link > cartão
        albumCard.appendChild(card);
        albunsgridElement.appendChild(albumCard);
      });
    }
  }

  // Funcionalidade de busca (search)

  /**
   * Sistema de busca em tempo real com debounce.
   * 
   * Fluxo:
   * 1. Usuário digita na barra de busca
   * 2. Espera 100ms para o usuário parar de digitar (debounce)
   * 3. Faz requisição GET para /search?query=...
   * 4. Recebe array JSON de resultados
   * 5. Renderiza resultados na tela
   */
  
  const inputSearch = document.getElementById("search-input");
  let searchResults = document.getElementById("results");
  
  if (!inputSearch) {
    console.warn("⚠️  #search-input não encontrado no DOM");
  } else {
    // Cria container de resultados se não existir
    if (!searchResults) {
      searchResults = document.createElement('div');
      searchResults.id = 'results';
      searchResults.className = 'search-results';
      
      // Encontra a barra de busca e insere resultados logo após
      const topBar = document.querySelector('.top-bar') || document.body;
      const searchBar = topBar.querySelector('.search-bar') || topBar.querySelector('.search-row') || topBar;
      searchBar && searchBar.insertAdjacentElement('afterend', searchResults);
    }

    // Busca com debounce (aguarda 100ms após o usuário parar de digitar)
    let searchTimeout = null;
    inputSearch.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      const searchQuery = inputSearch.value.trim();
      
      // Limpa resultados se a query estiver vazia
      if (!searchQuery) {
        searchResults.innerHTML = "";
        return;
      }
      
      // Aguarda 100ms antes de fazer a requisição (debounce)
      searchTimeout = setTimeout(async () => {
        try {
          // Faz requisição ao endpoint /search
          const response = await fetch(`/search?query=${encodeURIComponent(searchQuery)}`);
          
          if (!response.ok) {
            searchResults.innerHTML = "<p>❌ Erro na busca</p>";
            return;
          }
          
          const resultsData = await response.json();
          
          // Verifica se há resultados
          if (!Array.isArray(resultsData) || !resultsData.length) {
            searchResults.innerHTML = "<p>❌ Nenhuma música encontrada</p>";
            return;
          }
          
          // Renderiza cada resultado
          searchResults.innerHTML = resultsData.map(music =>
            `<div class="result-item"
              data-title="${escapeAttr(music.title)}"
              data-artist="${escapeAttr(music.artist)}"
              data-tempo="${escapeAttr(music.tempo || '')}"
              data-genre="${escapeAttr(music.genre || '')}">
              <strong>${escapeHtml(music.title)}</strong><br>
              <small>${escapeHtml(music.artist)}</small>
            </div>`
          ).join("");
          
        } catch (error) {
          console.error("❌ Erro ao fazer fetch /search:", error);
          searchResults.innerHTML = "<p>❌ Erro na busca</p>";
        }
      }, 100); // Debounce de 100ms
    });
  }

  // Player de música

  /**
   * Sistema de player com controles básicos:
   * - Exibe música atual (título + artista)
   * - Barra de progresso com tempo transcorrido
   * - Controle play/pause
   * - Animação visual na música tocando
   * 
   * Nota: Este é um player "fake" que simula a reprodução.
   *       Não toca áudio real, apenas controla visualmente.
   */

  // Elementos do player
  const playerBar = document.getElementById('player-bar');
  const currentSongDisplay = document.getElementById('current-song');
  const playButton = document.getElementById('play-btn');
  const elapsedTimeDisplay = document.getElementById('current-time');
  const progressBar = document.getElementById('progress-bar');
  const totalTimeDisplay = document.getElementById('total-time');

  // Estado do player
  let playbackInterval = null;           // Intervalo do timer
  let currentPlaybackTime = 0;           // Tempo atual em segundos
  let totalPlaybackTime = 0;             // Tempo total em segundos
  let currentlyPlayingElement = null;    // Elemento da música tocando (para animação)
  let currentPlaylist = [];              // Lista de elementos (playlist atual)
  let currentIndex = -1;                 // Índice da música atual na playlist
  let backgroundAudio = null;            // HTMLAudioElement para áudio de gênero
  let currentPlaylistGenre = null;       // Gênero detectado para a playlist atual
  let userHasInteracted = false;         // Marca se o usuário já interagiu (permitir autoplay apenas após interação)

  // Clique em Resultado de Busca

  searchResults?.addEventListener('click', event => {
    const resultItem = event.target.closest('.result-item');
    if (!resultItem) return;
    
    // Extrai dados do resultado
    const songTitle = resultItem.getAttribute('data-title') || resultItem.textContent.trim();
    const artistName = resultItem.getAttribute('data-artist') || '';
    const songDuration = resultItem.getAttribute('data-tempo') || '';
    
    // Abre o player
    openMusicPlayer(songTitle, artistName, songDuration, resultItem);
  });

  // Clique em Lista de Músicas

  const musicListContainer = document.querySelector('.song-list');
  if (musicListContainer) {
    musicListContainer.addEventListener('click', event => {
      const songItem = event.target.closest('.song-item');
      if (!songItem) return;
      
      // Extrai dados da música
      const songTitle = songItem.getAttribute('data-title') || songItem.textContent.trim();
      const artistName = songItem.getAttribute('data-artist') || '';
      const songDuration = songItem.getAttribute('data-tempo') || '';
      
      // Abre o player
      openMusicPlayer(songTitle, artistName, songDuration, songItem);
    });
  }

  // Função: Abrir Player

  /**
   * Abre o player e inicia a reprodução simulada.
   * 
   * Args:
   *   songTitle: Nome da música
   *   artistName: Nome do artista
   *   songDuration: Duração formatada (mm:ss)
   *   element: Elemento DOM da música (para animação)
   */

  function openMusicPlayer(songTitle, artistName, songDuration, element, options = {}) {
    // Remove animação da música anterior
    if (currentlyPlayingElement) {
      currentlyPlayingElement.classList.remove('playing');
    }
    
    // Adiciona animação à música atual
    if (element && element.classList) {
      element.classList.add('playing');
      currentlyPlayingElement = element;
    }
    
    // Exibe o título e artista no player
    if (currentSongDisplay) {
      currentSongDisplay.textContent = artistName ? 
        `${songTitle} — ${artistName}` : 
        songTitle;
    }
    // Se não houver playlist construída ou se pedirem rebuild, monta a playlist
    if (!Array.isArray(currentPlaylist) || currentPlaylist.length === 0 || options.rebuildPlaylist) {
      buildPlaylistForElement(element);
    }

    // Define currentIndex se o elemento estiver presente na playlist
    if (element) {
      const idx = currentPlaylist.findIndex(el => el === element);
      if (idx >= 0) currentIndex = idx;
      else {
        const title = songTitle;
        const artist = artistName;
        for (let i = 0; i < currentPlaylist.length; i++) {
          const el = currentPlaylist[i];
          const t = (el.getAttribute && el.getAttribute('data-title')) || el.textContent.trim();
          const a = (el.getAttribute && el.getAttribute('data-artist')) || '';
          if (t === title && a === artist) { currentIndex = i; break; }
        }
      }
    }

    // Seleciona e inicia o áudio de fundo baseado no gênero
    startGenreAudioForElement(element);

    // Converte duração "mm:ss" em segundos
    const durationMatch = /^(\d+):(\d+)$/.exec(songDuration);
    totalPlaybackTime = durationMatch ? 
      (parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2])) : 
      180; // Padrão: 3 minutos se não conseguir parse
    
    currentPlaybackTime = 0;

    // Atualiza displays
    if (totalTimeDisplay) totalTimeDisplay.textContent = formatTimeDisplay(totalPlaybackTime);
    if (elapsedTimeDisplay) elapsedTimeDisplay.textContent = '0:00';
    if (progressBar) progressBar.value = 0;

    // Mostra o player
    if (playerBar) {
      playerBar.classList.remove('hidden');
      playerBar.classList.add('visible');
    }

    // Muda ícone para pause e inicia reprodução
    if (playButton) {
      playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    startPlayback();
  }

  // Função: Pausar Reprodução

  function pausePlayback() {
    clearInterval(playbackInterval);
    playbackInterval = null;
      // Pausa também o áudio de fundo, se houver
      if (backgroundAudio && !backgroundAudio.paused) {
        try { backgroundAudio.pause(); } catch (e) { /* ignore */ }
      }
  }

  // Função: Atualizar Display do Timer
  function updatePlaybackDisplay() {
    if (elapsedTimeDisplay) {
      elapsedTimeDisplay.textContent = formatTimeDisplay(currentPlaybackTime);
    }

    if (progressBar) {
      progressBar.value = (currentPlaybackTime / totalPlaybackTime) * 100;
    }
  }

  // Função: Formatar Tempo (segundos → mm:ss)
  function formatTimeDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  // Função: Iniciar Reprodução
  function startPlayback() {
    clearInterval(playbackInterval);
      // Se houver áudio de fundo, tente retomá-lo (botão é um gesto do usuário)
      if (backgroundAudio && backgroundAudio.paused) {
        try { backgroundAudio.play().catch(() => {}); } catch (e) { /* ignore */ }
      }
    
    playbackInterval = setInterval(() => {
      if (currentPlaybackTime < totalPlaybackTime) {
        currentPlaybackTime++;
        updatePlaybackDisplay();
      } else {
        // Música terminou
        clearInterval(playbackInterval);
        // Avança automaticamente para próxima música se houver
        const nextIndex = (currentIndex || 0) + 1;
        if (Array.isArray(currentPlaylist) && nextIndex < currentPlaylist.length) {
          const nextEl = currentPlaylist[nextIndex];
          if (nextEl) {
            openMusicPlayer(
              (nextEl.getAttribute && nextEl.getAttribute('data-title')) || nextEl.textContent.trim(),
              (nextEl.getAttribute && nextEl.getAttribute('data-artist')) || '',
              (nextEl.getAttribute && nextEl.getAttribute('data-tempo')) || '',
              nextEl,
              { rebuildPlaylist: false }
            );
            return;
          }
        }
        if (playButton) {
          playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
      }
    }, 1000); // Atualiza a cada 1 segundo
  }

  // Função: Montar Playlist a partir do elemento clicado
  function buildPlaylistForElement(element) {
    try {
      // Tenta encontrar um container lógico 
      let container = null;
      if (element) {
        container = element.closest('.song-list') || element.closest('.search-results') || element.closest('.results');
      }
      if (!container) {
        // fallback: procura container padrão na página
        container = document.querySelector('.song-list') || document.getElementById('results') || document.querySelector('.search-results');
      }

      if (container) {
        const items = Array.from(container.querySelectorAll('.song-item, .result-item'));
        if (items && items.length) {
          currentPlaylist = items;
          // Define currentIndex se possível
          if (element) {
            const idx = items.indexOf(element);
            currentIndex = idx >= 0 ? idx : 0;
          } else {
            currentIndex = 0;
          }
          // Detecta gênero dominante na playlist e inicia áudio correspondente
          try {
            const genreCounts = {};
            items.forEach(it => {
              try {
                const g = (it.getAttribute && it.getAttribute('data-genre')) || '';
                if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
              } catch (e) {}
            });
            let best = null, bestCount = 0;
            Object.keys(genreCounts).forEach(k => {
              if (genreCounts[k] > bestCount) { best = k; bestCount = genreCounts[k]; }
            });
            currentPlaylistGenre = best;
            if (currentPlaylistGenre) startGenreAudioForElement(currentPlaylistGenre);
          } catch (err) {
            console.warn('Erro detectando gênero da playlist:', err);
          }
          return;
        }
      }

      // Se não encontrou container/itens, cria playlist com o próprio elemento 
      if (element) {
        currentPlaylist = [element];
        currentIndex = 0;
      } else {
        currentPlaylist = [];
        currentIndex = -1;
      }
    } catch (err) {
      console.error('Erro em buildPlaylistForElement:', err);
      currentPlaylist = element ? [element] : [];
      currentIndex = element ? 0 : -1;
    }
  }

  // Função: Iniciar áudio de fundo baseado no gênero da página/elemento
  function startGenreAudioForElement(element) {
    // Lista de arquivos disponíveis por gênero (caminhos relativos ao servidor)
    const genreMap = {
      rock: [
        '/static/Audios/rock/Guns N\' Roses - Sweet Child O\' Mine (Official Music Video) [1w7OgIMMRc4].mp3',
        '/static/Audios/rock/Metallica_ Enter Sandman (Official Music Video) [CD-E-LDc384].mp3'
      ],
      pop: [
        '/static/Audios/pop/Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars [OPf0YbXqDm0].mp3',
        '/static/Audios/pop/Michael Jackson - Billie Jean (Official Video) [Zi_XLOBDo_Y].mp3'
      ],
      jazz: [
        '/static/Audios/jazz/Louis Armstrong - What A Wonderful World (At The BBC) [CaCSuzR4DwM].mp3',
        '/static/Audios/jazz/My Way (2008 Remastered) [qQzdAsjWGPg].mp3'
      ],
      eletronica: [
        '/static/Audios/eletronica/Electro-Light - Symbolism _ Trap _ NCS - Copyright Free Music [__CRWE-L45k].mp3',
        '/static/Audios/eletronica/Summer [KSgKKSny0Qo].mp3'
      ],
      sertanejo: [
        '/static/Audios/sertanejo/Bruno & Marrone - Boate Azul (Ao Vivo) [8HVLFySv1yQ].mp3',
        '/static/Audios/sertanejo/Zezé Di Camargo & Luciano - Será Que Foi Saudade _ (Ao Vivo) [62ippjVhLdc].mp3'
      ]
    };

    // Permite passar diretamente o gênero como string
    let genre = null;
    try {
      if (typeof element === 'string') {
        genre = element;
      } else {
        // Para determinar gênero, tenta ordem: data-genre attr -> elemento mais próximo -> caminho da URL
        if (element && element.getAttribute) {
          genre = element.getAttribute('data-genre');
        }
        if (!genre) {
          const closest = element ? element.closest('[data-genre]') : null;
          if (closest && closest.getAttribute) genre = closest.getAttribute('data-genre');
        }
        if (!genre) {
          const path = window.location.pathname.toLowerCase();
          if (path.includes('rock')) genre = 'rock';
          else if (path.includes('pop')) genre = 'pop';
          else if (path.includes('jazz')) genre = 'jazz';
          else if (path.includes('eletronica') || path.includes('eletr')) genre = 'eletronica';
          else if (path.includes('sertanejo')) genre = 'sertanejo';
        }
      }
    } catch (err) {
      console.warn('Não foi possível determinar gênero:', err);
    }

    // Se não houver gênero conhecido, escolhe um aleatório como fallback
    if (!genre || !genreMap[genre]) {
      const keys = Object.keys(genreMap);
      if (keys.length > 0) {
        genre = keys[Math.floor(Math.random() * keys.length)];
      }
    }

    if (!genre || !genreMap[genre]) {
      if (backgroundAudio) {
        try { backgroundAudio.pause(); } catch (e) {}
        backgroundAudio = null;
      }
      return;
    }

    // Escolhe uma faixa 
    const choices = genreMap[genre];
    const idx = Math.floor(Math.random() * choices.length);
    const src = choices[idx];

    // Se já estiver tocando a mesma fonte, não reinicia
    if (backgroundAudio && backgroundAudio.src && backgroundAudio.src.includes(src)) return;

    // Para e remove o áudio anterior
    if (backgroundAudio) {
      try { backgroundAudio.pause(); } catch (e) {}
      backgroundAudio = null;
    }

    // Cria novo elemento de áudio
    try {
      backgroundAudio = new Audio(src);
      backgroundAudio.loop = true;
      backgroundAudio.volume = 0.15;
      // Inicia apenas se houver interação do usuário
      const playPromise = backgroundAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // Falha ao autoplay, silêncio: aguardaremos próxima interação do usuário
        });
      }
    } catch (err) {
      console.warn('Erro ao criar backgroundAudio:', err);
      backgroundAudio = null;
    }
  }

  // Inicia áudio automaticamente em páginas relevantes ao carregar
  try {
    // Pequeno timeout para garantir que o DOM foi totalmente processado
    setTimeout(() => {
      // Se houver barra de pesquisa ou lista de playlists, inicia áudio de fundo
      const hasSearch = !!document.getElementById('search-input');
      const hasPlaylistSection = !!document.querySelector('.genre-list') || !!document.querySelector('.my-playlists');
      const isHome = window.location.pathname === '/' || window.location.pathname.toLowerCase().includes('home');

      // Só inicia autoplay automático se o usuário já interagiu com a página 
      if (userHasInteracted && (hasSearch || hasPlaylistSection || isHome)) {
        // tenta detectar gênero a partir das músicas na página
        try {
          const items = Array.from(document.querySelectorAll('.song-item'));
          const counts = {};
          items.forEach(it => {
            const g = (it.getAttribute && it.getAttribute('data-genre')) || '';
            if (g) counts[g] = (counts[g] || 0) + 1;
          });
          let best = null, bestCount = 0;
          Object.keys(counts).forEach(k => {
            if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
          });
          if (best) startGenreAudioForElement(best);
          else startGenreAudioForElement(null);
        } catch (err) {
          startGenreAudioForElement(null);
        }
      }
    }, 250);
  } catch (err) {
    console.warn('Erro ao iniciar áudio automático:', err);
  }

  // Marca interação do usuário ao primeiro clique — usado para permitir autoplay futuro
  document.addEventListener('click', () => {
    userHasInteracted = true;
  }, { once: false });

  // Controles: Anterior / Próximo
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (!Array.isArray(currentPlaylist) || currentPlaylist.length === 0) return;
      const prevIndex = Math.max(0, (currentIndex || 0) - 1);
      const el = currentPlaylist[prevIndex];
      if (el) {
        openMusicPlayer(
          (el.getAttribute && el.getAttribute('data-title')) || el.textContent.trim(),
          (el.getAttribute && el.getAttribute('data-artist')) || '',
          (el.getAttribute && el.getAttribute('data-tempo')) || '',
          el,
          { rebuildPlaylist: false }
        );
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!Array.isArray(currentPlaylist) || currentPlaylist.length === 0) return;
      const nextIndex = Math.min(currentPlaylist.length - 1, (currentIndex || 0) + 1);
      const el = currentPlaylist[nextIndex];
      if (el) {
        openMusicPlayer(
          (el.getAttribute && el.getAttribute('data-title')) || el.textContent.trim(),
          (el.getAttribute && el.getAttribute('data-artist')) || '',
          (el.getAttribute && el.getAttribute('data-tempo')) || '',
          el,
          { rebuildPlaylist: false }
        );
      }
    });
  }

  // Evento: Botão Play/Pause
  if (playButton) {
    playButton.addEventListener('click', () => {
      const isCurrentlyPlaying = playButton.innerHTML.includes('pause');

      if (isCurrentlyPlaying) {
        // Está tocando = pausa
        pausePlayback();
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
      } else {
        // Está pausado = toca
        startPlayback();
        playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
      }
    });
  }

  // Pausar quando trocar de aba 
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Pausa timer e áudio de fundo
        try { pausePlayback(); } catch (e) { console.warn('Erro ao pausar na visibilitychange', e); }
      }
    });
  } catch (err) {
    console.warn('visibilitychange não suportado:', err);
  }

  // Pausar ao remover música/playlist (listeners globais)
  try {
    // Clique em botão inline de remoção de música
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.remove-song-btn-inline');
      if (btn) {
        try { pausePlayback(); } catch (e) { /* ignore */ }
      }
      // também pausa se clicar em botões de delete na sidebar
      const delBtn = ev.target.closest && ev.target.closest('.playlist-delete-btn');
      if (delBtn) {
        try { pausePlayback(); } catch (e) { /* ignore */ }
      }
    }, { capture: true });

    // Antes do submit dos formulários de exclusão de playlist, pausa o áudio
    const playlistDeleteForms = Array.from(document.querySelectorAll('form.playlist-delete-form'));
    playlistDeleteForms.forEach(f => {
      f.addEventListener('submit', (ev) => {
        try { pausePlayback(); } catch (e) { /* ignore */ }
      });
    });
  } catch (err) {
    console.warn('Erro ao registrar listeners de remoção:', err);
  }

  // FUNÇÕES AUXILIARES: ESCAPE (Segurança contra XSS)
  
  /**
   * Escapa caracteres especiais HTML para evitar injeção XSS.
   * Converte: & < > " '
   */
  function escapeHtml(textInput) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(textInput || '').replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Escapa caracteres especiais para atributos HTML.
   * Principalmente para data-* attributes.
   */
  function escapeAttr(textInput) {
    return String(textInput || '').replace(/["']/g, char => 
      char === '"' ? '&quot;' : '&#39;'
    );
  }
});
