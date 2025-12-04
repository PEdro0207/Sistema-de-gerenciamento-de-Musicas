/**
 * PLAYLIST_DETAIL.JS - Gerenciador de Detalhe de Playlists
 * 
 * Responsabilidades:
 * 1. Integração da funcionalidade de busca e adição de músicas
 * 2. Envio de requisições para adicionar músicas à playlist
 * 3. Envio de requisições para remover músicas da playlist
 * 4. Manipulação de confirmações de ação (remover música)
 * 5. Tratamento de erros e feedback ao usuário
 * 
 * Fluxo de uso:
 * - Usuário está na página de detalhe de uma playlist
 * - Digita o nome de uma música na barra de busca
 * - Clica no botão "+" para adicionar a música à playlist
 * - Ou clica no ícone de remoção para remover música da playlist
 * 
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("playlist_detail.js carregado e pronto");

  // OBTER ID DA PLAYLIST
  
  /**
   * Encontra o ID da playlist a partir do atributo data-playlist-id
   * Este atributo está no elemento que engloba toda a página de detalhe
   */
  const playlistContainer = document.querySelector('[data-playlist-id]');
  const playlistId = playlistContainer ? parseInt(playlistContainer.dataset.playlistId) : 0;
  
  if (!playlistId) {
    console.error("ID da playlist não encontrado no DOM");
    console.error("Esperado: elemento com atributo data-playlist-id");
    return;
  }
  
  console.log(`Playlist ID encontrado: ${playlistId}`);
  
  // Tempo de espera (debounce) entre digitação e busca
  const SEARCH_DEBOUNCE_DELAY_MS = 300;
  
  let searchDebounceTimer = null;

  // SEÇÃO 1: FUNCIONALIDADE DE BUSCA E ADIÇÃO DE MÚSICA

  /**
   * Sistema de busca integrado para adicionar músicas à playlist.
   * 
   * Fluxo:
   * 1. Usuário digita na barra de busca
   * 2. Espera SEARCH_DEBOUNCE_DELAY_MS antes de fazer requisição
   * 3. Requisição GET /search?query=...
   * 4. Recebe resultados e renderiza com botão "+" para adicionar
   * 5. Clique no botão desencadeia adicionar música
   */

  const searchInputElement = document.getElementById('search-input');
  const resultsContainerElement = document.getElementById('results');
  
  if (searchInputElement) {
    // Captura eventos de digitação
    searchInputElement.addEventListener('input', function(inputEvent) {
      clearTimeout(searchDebounceTimer);
      
      const searchQuery = inputEvent.target.value.trim();
      
      // Se a query está vazia, limpa os resultados
      if (!searchQuery) {
        resultsContainerElement.innerHTML = '';
        return;
      }
      
      // Aguarda o usuário parar de digitar antes de fazer a requisição
      searchDebounceTimer = setTimeout(() => {
        // Faz requisição de busca ao servidor
        fetch(`/search?query=${encodeURIComponent(searchQuery)}`)
          .then(response => response.json())
          .then(musicResults => {
            // Limpa resultados anteriores
            resultsContainerElement.innerHTML = '';
            
            // Renderiza cada resultado com botão de adição
            musicResults.forEach(musicItem => {
              const resultElement = document.createElement('div');
              resultElement.className = 'result-item';
              
              // HTML com layout: informações + botão adicionar
              resultElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <div>
                    <strong>${escapeHtmlContent(musicItem.title)}</strong><br>
                    <small>${escapeHtmlContent(musicItem.artist)}</small>
                  </div>
                  <button class="add-to-playlist-btn" 
                          type="button" 
                          title="Adicionar esta música à playlist"
                          style="background: #9345ee; border: none; color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-left: 8px;">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              `;
              
              // Adiciona listener ao botão de adicionar
              resultElement.querySelector('.add-to-playlist-btn').addEventListener('click', (clickEvent) => {
                clickEvent.preventDefault();
                addMusicToPlaylistAction(musicItem.title, musicItem.artist);
              });
              
              // Adiciona o resultado ao container
              resultsContainerElement.appendChild(resultElement);
            });
          })
          .catch(error => {
            console.error("Erro ao fazer busca:", error);
            resultsContainerElement.innerHTML = "<p>Erro ao buscar músicas</p>";
          });
      }, SEARCH_DEBOUNCE_DELAY_MS); // Debounce configurado
    });
  }

  // SEÇÃO 2: AÇÃO DE ADICIONAR MÚSICA À PLAYLIST

  /**
   * Adiciona uma música à playlist via requisição POST JSON.
   * 
   * Processo:
   * 1. Faz POST para /playlist/{id}/add-music com título e artista
   * 2. Servidor busca a música e a adiciona à tabela playlist_tracks
   * 3. Se sucesso: recarrega a página para mostrar a nova música
   * 4. Se erro: mostra mensagem de erro
   * 
   * @param {string} musicTitle - Título da música a adicionar
   * @param {string} musicArtist - Artista da música a adicionar
   */
  function addMusicToPlaylistAction(musicTitle, musicArtist) {
    console.log(`Adicionando música: "${musicTitle}" de ${musicArtist}`);
    
    // Faz requisição POST com os dados da música
    fetch(`/playlist/${playlistId}/add-music`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        title: musicTitle,
        artist: musicArtist
      })
    })
    .then(response => response.json())
    .then(responseData => {
      if (responseData.success) {
        console.log("Música adicionada com sucesso!");
        // Recarrega a página para mostrar a nova música
        location.reload();
      } else {
        // Exibe mensagem de erro
        const errorMessage = responseData.error || 'Erro ao adicionar música';
        alert(`${errorMessage}`);
        console.error(`Erro: ${errorMessage}`);
      }
    })
    .catch(error => {
      console.error("Erro ao adicionar música:", error);
      alert("Erro ao adicionar música à playlist");
    });
  }

  // SEÇÃO 3: AÇÃO DE REMOVER MÚSICA DA PLAYLIST

  /**
   * Remove uma música da playlist via requisição POST.
   * 
   * Esta função é chamada pela template (inline onclick) e deve estar
   * disponível globalmente (window.removeSongFromPlaylist).
   * 
   * Processo:
   * 1. Pede confirmação ao usuário
   * 2. Faz POST para /playlist/{id}/remove-music/{track_id}
   * 3. Se sucesso: recarrega a página
   * 4. Se erro: mostra mensagem de erro
   * 
   * @param {Event} clickEvent - Evento do clique no botão
   * @param {number} trackId - ID da música na tabela playlist_tracks
   */
  window.removeSongFromPlaylist = function(clickEvent, trackId) {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    
    // Pede confirmação do usuário
    if (confirm('Tem certeza que deseja remover esta música da playlist?')) {
      console.log(`Removendo música ID: ${trackId}`);
      
      fetch(`/playlist/${playlistId}/remove-music/${trackId}`, {
        method: 'POST'
      })
      .then(response => response.json())
      .then(responseData => {
        if (responseData.success) {
          console.log("Música removida com sucesso!");
          // Recarrega a página para refletir a remoção
          location.reload();
        } else {
          // Exibe mensagem de erro
          const errorMessage = responseData.error || 'Erro ao remover música';
          alert(`${errorMessage}`);
          console.error(`Erro: ${errorMessage}`);
        }
      })
      .catch(error => {
        console.error("Erro ao remover música:", error);
        alert("Erro ao remover música da playlist");
      });
    }
  };

  // FUNÇÕES AUXILIARES: ESCAPE (Segurança XSS)

  /**
   * Escapa caracteres especiais HTML para evitar injeção XSS.
   * Converte caracteres perigosos para suas entidades HTML correspondentes.
   * 
   * Caracteres escapeados:
   * - & → &amp;
   * - < → &lt;
   * - > → &gt;
   * - " → &quot;
   * - ' → &#039;
   * 
   * @param {string} textContent - Texto a ser escapado
   * @returns {string} Texto com caracteres escapados
   */
  function escapeHtmlContent(textContent) {
    const escapeCharacterMap = { 
      '&': '&amp;', 
      '<': '&lt;', 
      '>': '&gt;', 
      '"': '&quot;', 
      "'": '&#039;' 
    };
    return String(textContent || '').replace(/[&<>"']/g, char => escapeCharacterMap[char]);
  }

  /**
   * Escapa caracteres especiais para atributos HTML (como data-*).
   * 
   * Caracteres escapeados:
   * - " → &quot;
   * - ' → &#039;
   * 
   * @param {string} textContent - Texto a ser escapado
   * @returns {string} Texto com caracteres escapados
   */
  function escapeAttributeContent(textContent) {
    return String(textContent || '')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
