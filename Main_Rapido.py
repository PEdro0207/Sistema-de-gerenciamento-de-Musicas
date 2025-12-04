"""
Algoritmos utilizados:
Busca: Binary Search (O(log n)) — divide o espaço de busca pela metade
Ordenação: QuickSort (O(n log n) médio) — divide e conquista com pivot
"""

from flask import Flask, redirect, render_template, request, jsonify, g
from flask import url_for, abort
import sqlite3
import unicodedata
import os
import time
from functools import wraps

# medidor de tempo de execução

def measure_time(func):
    """Decorator que mede e registra o tempo de execução de uma função."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        print(f"[RÁPIDO: {func.__name__}] Executado em {elapsed:.4f}s")
        return result
    return wrapper


# Instância da aplicação Flask
app = Flask(__name__)

# Configurações de banco de dados
DB_PATH = "spotify.db"


def normalize_text(text_string):
    """
    Normaliza texto removendo acentos e convertendo para minúsculas.
    
    Utilizada para buscas case-insensitive e sem acentuação.
    
    Args:
        text_string (str): Texto a ser normalizado
    
    Returns:
        str: Texto normalizado
    
    Exemplo:
        normalize_text("José") → "jose"
    """
    if not text_string:
        return ""
    
    # Converte para minúsculas e remove espaços em branco
    text_string = str(text_string).lower().strip()
    
    # Normaliza caracteres acentuados (NFD/NFKD)
    text_string = unicodedata.normalize('NFKD', text_string)
    
    # Remove marcas diacríticas (acentos)
    text_string = ''.join(ch for ch in text_string if not unicodedata.combining(ch))
    
    return text_string


def binary_search(sorted_items, key, key_extractor):
    """
    Busca binária (O(log n)) — reduz o espaço de busca pela metade a cada iteração.
    
    RÁPIDO: Requer lista pré-ordenada, mas é muito eficiente.
    
    Args:
        sorted_items: Lista de dicionários (DEVE estar ordenada pela chave)
        key: Chave a buscar
        key_extractor: Função para extrair a chave do item
    
    Returns:
        Índice do item ou -1 se não encontrado
    """
    left, right = 0, len(sorted_items) - 1
    
    while left <= right:
        mid = (left + right) // 2
        mid_key = key_extractor(sorted_items[mid])
        
        if mid_key == key:
            return mid
        elif mid_key < key:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1


def quick_sort(items, sort_key):
    """
    QuickSort (O(n log n) médio, O(n²) pior caso) — divide e conquista com pivot.
    
    RÁPIDO: Na maioria dos casos é muito mais rápido que BubbleSort.
    
    Args:
        items: Lista a ordenar
        sort_key: Função para extrair a chave de ordenação
    
    Returns:
        Lista ordenada
    """
    if len(items) <= 1:
        return items
    
    pivot_index = len(items) // 2
    pivot = sort_key(items[pivot_index])
    
    # Divide em três grupos: menor, igual, maior
    lesser = []
    equal = []
    greater = []
    
    for item in items:
        item_key = sort_key(item)
        if item_key < pivot:
            lesser.append(item)
        elif item_key == pivot:
            equal.append(item)
        else:
            greater.append(item)
    
    return quick_sort(lesser, sort_key) + equal + quick_sort(greater, sort_key)


def contains_substring_search(items, query, key_extractor):
    """
    Busca otimizada por substring com priorização.
    
    Combina rapidez com busca de substring (que não permite binary search puro).
    Filtra resultados por prioridade de match (prefix > anywhere).
    
    Args:
        items: Lista de dicionários
        query: String a buscar
        key_extractor: Função para extrair a chave do item
    
    Returns:
        Lista de items com match, ordenada por prioridade
    """
    results = []
    
    for item in items:
        item_key = key_extractor(item).lower()
        query_lower = query.lower()
        
        # Verifica se contém a substring
        if query_lower in item_key:
            # Calcula prioridade: prefix matches têm prioridade
            if item_key.startswith(query_lower):
                priority = 0 
            else:
                priority = 1 
            
            results.append((priority, item))
    
    # Ordena por prioridade 
    results = quick_sort(results, lambda x: x[0])
    
    # Remove a prioridade e retorna apenas os items
    return [item for _, item in results]


# Verifica se o arquivo de banco de dados existe no inicializar
if not os.path.exists(DB_PATH):
    print("Banco de dados 'spotify.db' não encontrado.")
else:
    print("Banco de dados carregado com sucesso!")


def get_db():
    """
    Obtém ou cria uma conexão com o banco de dados SQLite.
    
    """
    database = getattr(g, '_database', None)
    if database is None:
        # Cria nova conexão para este request
        database = g._database = sqlite3.connect(DB_PATH)
        
        # Registra a função de normalização como função SQL
        database.create_function("NORMALIZE", 1, normalize_text)
    
    return database


@app.teardown_appcontext
def close_database_connection(exception):
    """
    Fecha a conexão com o banco de dados ao finalizar o request.
    
    """
    database = getattr(g, '_database', None)
    if database is not None:
        database.close()


# rotas do site

@app.route('/')
def home():
    """Página inicial do site."""
    return render_template('home.html')


@app.route('/login')
def login():
    """Página de login (em desenvolvimento)."""
    return render_template('login.html')


@app.route('/registro')
def registro():
    """Página de registro de novo usuário (em desenvolvimento)."""
    return render_template('registro.html')


# rotas de gêneros 

def fetch_songs_by_genre(genre_keyword, limit=100):
    """
    Função auxiliar para buscar músicas de um gênero no banco de dados.
    
    """
    songs_list = []
    try:
        database = get_db()
        cursor = database.cursor()

        # Busca músicas que contenham a palavra-chave no campo 'genre'
        cursor.execute("""
            SELECT track_name, artist_name, popularity, formatted_duration
            FROM musicas
            WHERE LOWER(genre) LIKE ?
            LIMIT ?
        """, (f'%{genre_keyword}%', limit))

        rows = cursor.fetchall()

        # Converte cada linha em um dicionário
        for row in rows:
            songs_list.append({
                "title": row[0] or '',
                "artist": row[1] or '',
                "tempo": row[3] or ''
            })
    except Exception as error:
        print(f"Erro ao buscar músicas de {genre_keyword}:", error)

    return songs_list


@app.route('/rock')
@measure_time
def rock():

    songs = fetch_songs_by_genre('rock')
    return render_template('rock.html', songs=songs)


@app.route('/pop')
def pop():

    songs = fetch_songs_by_genre('pop')
    return render_template('pop.html', songs=songs)


@app.route('/eletrônica')
def eletronica():

    songs = fetch_songs_by_genre('trance')
    return render_template('eletrônica.html', songs=songs)


@app.route('/jazz')
def jazz():

    songs = fetch_songs_by_genre('jazz')
    return render_template('jazz.html', songs=songs)


@app.route('/sertanejo')
def sertanejo():

    songs = fetch_songs_by_genre('sertanejo')
    return render_template('sertanejo.html', songs=songs)


# rota de tops musicas

def fetch_top_songs_by_genre(genre_keyword, limit=100):
    """
    Função auxiliar para buscar as músicas mais populares de um gênero.
    
    """
    songs_list = []
    try:
        database = get_db()
        cursor = database.cursor()

        # Busca todas as músicas do gênero 
        cursor.execute("""
            SELECT track_name, artist_name, popularity, formatted_duration
            FROM musicas
            WHERE LOWER(genre) LIKE ?
            LIMIT ?
        """, (f'%{genre_keyword}%', limit * 2))  

        rows = cursor.fetchall()

        for row in rows:
            songs_list.append({
                "title": row[0] or '',
                "artist": row[1] or '',
                "popularity": row[2] or 0,
                "tempo": row[3] or ''
            })
        
        # Ordena usando QuickSort 
        start_time = time.time()
        songs_list = quick_sort(
            songs_list,
            lambda x: -x['popularity']  # Ordenação reversa 
        )
        elapsed = time.time() - start_time
        print(f" QuickSort levou {elapsed:.4f}s para ordenar {len(songs_list)} músicas")
        
        # Limita aos primeiros 100
        songs_list = songs_list[:limit]
    except Exception as error:
        print(f"Erro ao buscar tops de {genre_keyword}:", error)

    return songs_list


@app.route('/tops-rock')
@measure_time
def tops_rock():

    songs = fetch_top_songs_by_genre('rock')
    return render_template('tops-rock.html', songs=songs)


@app.route('/tops-sertanejo')
def tops_sertanejo():

    songs = fetch_top_songs_by_genre('sertanejo')
    return render_template('tops-sertanejo.html', songs=songs)


@app.route('/tops-eletronica')
def tops_eletronica():

    songs = fetch_top_songs_by_genre('trance')
    return render_template('tops-eletronica.html', songs=songs)


@app.route('/tops-pop')
def tops_pop():

    songs = fetch_top_songs_by_genre('pop')
    return render_template('tops-pop.html', songs=songs)


# rota de busca - Barra de pesquisa

@app.route('/search')
@measure_time
def search():
    """
    Endpoint de busca de músicas por título ou artista.
    
    Algoritmo: BUSCA POR SUBSTRING + QUICK SORT (O(n log n)) — RÁPIDO
    
    Estratégia:
    1. Carrega músicas e filtra por substring (busca otimizada)
    2. Prioriza matches por prefix (começo da palavra)
    3. Usa quick sort para ordenação rápida
    
    """
    search_query = request.args.get('query', '').strip()
    
    # Se a query está vazia, retorna resultado vazio
    if not search_query:
        return jsonify([])

    try:
        # Normaliza a query para comparação
        normalized_query = normalize_text(search_query)
        
        database = get_db()
        cursor = database.cursor()
        
        # passo 1: CARREGA apenas músicas relevantes 
        start_time = time.time()
        cursor.execute("""
            SELECT 
                track_name, 
                artist_name, 
                formatted_duration,
                normalized_track,
                normalized_artist
            FROM musicas
            WHERE normalized_track LIKE ? OR normalized_artist LIKE ?
            LIMIT 200
        """, (f"%{normalized_query}%", f"%{normalized_query}%"))
        rows = cursor.fetchall()
        load_time = time.time() - start_time
        print(f" Carregou {len(rows)} músicas (SQL LIKE) em {load_time:.4f}s")
        
        # passo 2: filtra e prioriza resultados 
        search_time = time.time()
        results = []
        
        for row in rows:
            track_name, artist_name, formatted_duration, norm_track, norm_artist = row
            
            # Verifica se está em título ou artista
            found_in_title = normalized_query in (norm_track or '')
            found_in_artist = normalized_query in (norm_artist or '')
            
            if found_in_title or found_in_artist:
                # Calcula prioridade
                if (norm_track or '').startswith(normalized_query):
                    priority = 0  # Título começa com a query
                elif (norm_artist or '').startswith(normalized_query):
                    priority = 1  # Artista começa com a query
                else:
                    priority = 2  # Outro match
                
                results.append({
                    'title': track_name or '',
                    'artist': artist_name or '',
                    'tempo': formatted_duration or '',
                    'priority': priority,
                    'artist_name': artist_name or '' 
                })
        
        search_elapsed = time.time() - search_time
        print(f"Filtro encontrou {len(results)} resultados em {search_elapsed:.4f}s")
        
        # passo 3: quick sort (O(n log n)) - ordena por prioridade
        sort_time = time.time()
        results = quick_sort(
            results,
            lambda x: (x['priority'], x['artist_name'], x['title'])  # Multi-key sort
        )
        sort_elapsed = time.time() - sort_time
        print(f" QuickSort levou {sort_elapsed:.4f}s para ordenar {len(results)} resultados")
        
        # Remove campo priority e limita a 8 resultados
        results = [
            {k: v for k, v in r.items() if k != 'priority' and k != 'artist_name'}
            for r in results[:8]
        ]
        
        total_time = time.time() - start_time
        print(f"BUSCA TOTAL: {total_time:.4f}s\n")
        
        return jsonify(results)
        
    except Exception as error:
        print(f"Erro na busca: {error}")
        return jsonify([])


# Lista de playlists
@app.route('/playlists')
@measure_time
def playlists():
    playlists = []
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT id, name, description, created_at FROM playlists ORDER BY created_at DESC")
        rows = cursor.fetchall()
        for row in rows:
            playlists.append({
                'id': row[0],
                'name': row[1] or '',
                'description': row[2] or '',
                'created_at': row[3] or ''
            })
    except Exception as e:
        print('Erro ao listar playlists:', e)

    return render_template('playlists.html', playlists=playlists)


@app.route('/playlist/<int:playlist_id>')
def playlist_detail(playlist_id):
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id, name, description, created_at FROM playlists WHERE id = ?', (playlist_id,))
        row = cursor.fetchone()
        if not row:
            abort(404)

        playlist = {
            'id': row[0],
            'name': row[1] or '',
            'description': row[2] or '',
            'created_at': row[3] or ''
        }

        # Buscar músicas da playlist via tabela playlist_tracks
        songs = []
        try:
            cursor.execute("""
                SELECT m.track_name, m.artist_name, m.formatted_duration, pt.id as track_id
                FROM playlist_tracks pt
                JOIN musicas m ON pt.music_id = m.rowid
                WHERE pt.playlist_id = ?
                ORDER BY pt.position ASC
            """, (playlist_id,))
            rows = cursor.fetchall()
            for row in rows:
                songs.append({
                    'title': row[0] or '',
                    'artist': row[1] or '',
                    'tempo': row[2] or '',
                    'track_id': row[3]
                })
        except Exception:
            pass
        
        # Buscar playlists para o sidebar
        playlists = []
        try:
            cursor.execute("SELECT id, name FROM playlists ORDER BY created_at DESC")
            rows = cursor.fetchall()
            for row in rows:
                playlists.append({'id': row[0], 'name': row[1] or ''})
        except Exception:
            pass
        
        return render_template('playlist_detail.html', playlist=playlist, songs=songs, playlists=playlists)
    except Exception as e:
        print('Erro ao carregar playlist:', e)
        abort(500)
    
# Criar playlist 
@app.route('/criar-playlist', methods=['GET', 'POST'])
def criar_playlist():
    success = False
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        if name:
            try:
                db = get_db()
                cursor = db.cursor()

                # cria a tabela de playlists no SQL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS playlists (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        created_at TEXT DEFAULT (datetime('now'))
                    )
                """)
                cursor.execute(
                    "INSERT INTO playlists (name, description) VALUES (?, ?)",
                    (name, description)
                )
                db.commit()
                
                # redireciona para evitar repost do form
                return redirect(request.path + "?success=1")
            except Exception as e:
                print("Erro ao criar playlist:", e)

    success = request.args.get('success') == '1'
    # Buscar playlists para exibir no sidebar
    playlists = []
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT id, name FROM playlists ORDER BY created_at DESC")
        rows = cursor.fetchall()
        for row in rows:
            playlists.append({'id': row[0], 'name': row[1] or ''})
    except Exception:
        pass

    return render_template('criar_playlist.html', success=success, playlists=playlists)


# Excluir playlist
@app.route('/playlist/<int:playlist_id>/delete', methods=['POST'])
def delete_playlist(playlist_id):
    try:
        db = get_db()
        cursor = db.cursor()
        # remove a playlist e suas músicas associadas
        cursor.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
        # Também remove as músicas associadas 
        try:
            cursor.execute('DELETE FROM playlist_tracks WHERE playlist_id = ?', (playlist_id,))
        except:
            pass
        db.commit()
        print(f"Playlist {playlist_id} deletada com sucesso")
    except Exception as e:
        print(f'Erro ao excluir playlist: {e}')
    # redireciona para a lista de playlists 
    return redirect(url_for('criar_playlist'))


# Adicionar música as playlists criadas
@app.route('/playlist/<int:playlist_id>/add-music', methods=['POST'])
def add_music_to_playlist(playlist_id):
    data = request.get_json() or {}
    title = data.get('title')
    artist = data.get('artist')
    
    if not title or not artist:
        return jsonify({'error': 'title e artist obrigatórios'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Cria a tabela playlist_tracks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL,
                music_id INTEGER NOT NULL,
                position INTEGER DEFAULT 0,
                added_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            )
        """)
        
        # Buscar música no banco de dados
        cursor.execute(
            'SELECT rowid FROM musicas WHERE track_name = ? AND artist_name = ?',
            (title, artist)
        )
        music_row = cursor.fetchone()
        if not music_row:
            return jsonify({'error': 'Música não encontrada'}), 404
        
        music_id = music_row[0]
        
        # Encontra a próxima posição
        cursor.execute(
            'SELECT MAX(position) FROM playlist_tracks WHERE playlist_id = ?',
            (playlist_id,)
        )
        max_pos = cursor.fetchone()[0] or -1
        next_pos = max_pos + 1
        
        # Insere a música
        cursor.execute(
            'INSERT INTO playlist_tracks (playlist_id, music_id, position) VALUES (?, ?, ?)',
            (playlist_id, music_id, next_pos)
        )
        db.commit()
        return jsonify({'success': True, 'track_id': cursor.lastrowid})
    except Exception as e:
        print('Erro ao adicionar música:', e)
        return jsonify({'error': str(e)}), 500


# Remover música das playlist criadas
@app.route('/playlist/<int:playlist_id>/remove-music/<int:track_id>', methods=['POST'])
def remove_music_from_playlist(playlist_id, track_id):
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            'DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?',
            (track_id, playlist_id)
        )
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        print('Erro ao remover música:', e)
        return jsonify({'error': str(e)}), 500

#Main - Rapido
if __name__ == "__main__":
    print("\n" + "="*60)
    print("VERSÃO RÁPIDA - Busca Otimizada (O(n)) + QuickSort (O(n log n))")
    print("="*60)
    print("Porta: 5002")
    print("="*60 + "\n")
    app.run(debug=True, port=5002)
