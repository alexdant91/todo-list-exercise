/**
 * Dobbiamo sviluppare un sistema di gestione per una todo-list.
 *
 * La nostra base dati è rappresentata da un'API raggiungibile a link:
 * `https://jsonplaceholder.typicode.com/todos` che tramite una chiamata GET
 * restituisce in formato JSON tutti i dati necessari.
 *
 * Servirà una visualizzazione in tabella con le seguenti caratteristiche:
 *
 *   1. Per ogni todo-list, visualizzare l'id, il titolo e se è stata completata o meno;
 *   2. Visualizzazione di tutte le todo-list presenti a gruppi di 10, con un sistema di impaginazione;
 *   3. Sistema di ricerca per titolo da input testo, che permette di filtrare le todo-list;
 *   4. Sistema di sorting per titolo e completamento (plus: permette di ordinare per parametri multipli contemporaneamente);
 *   5. Sistema che permette di filtrare le todo-list in base allo stato di completamento;
 *
 * Per ottenere una risposta dovremo utilizzare la libreria fetch che si occupa di gestire le chiamate ai server,
 * mantenendo un approccio che prevede l'utilizzo della sintassi `async/await` e in modo da non mandare in crash
 * la pagina all'errore, ma piuttosto un sistema che notifichi l'utente riguardo eventuali errori.
 *
 * Trovate tutte le informazioni riguardo l'API al link: `https://jsonplaceholder.typicode.com`.
 *
 * Importante ricordare che anche la grafica non deve essere trascurata, perciò fate buon uso di
 * HTML e di CSS (plus: potete usare bootstrap).
 */

// Dichiaro tutte le costanti in alto in modo che siano accessibili da ovunque
const API_URL = 'https://jsonplaceholder.typicode.com/todos';
const METHOD = 'GET';

const Utility = {
  // Mi permette di ottenere una copia dell'array secondo il range che ho passato
  getRangeElementsFromArray: (array, start, end) => {
    return array.slice(start, end);
  },
  // Get a deep copy of an object or an array
  getDeepCopy: (element) => {
    return JSON.parse(JSON.stringify(element));
  },
}

const CacheUtils = {
  // Mi permette di ottenere i dati in una cache
  getFormCache: (label) => {
    JSON.parse(localStorage.getItem(label))
  },
  // Mi permette di memorizzare i dati in una cache
  setToCache: (label, data) => {
    localStorage.setItem(label, JSON.stringify(data));
  },
}

// Mi permette di manipolare le select
// Questa volta do accesso allo state per poterla manipolare
// direttamente dalle funzioni
const SelectUtils = (state) => ({
  ID_ASC: () => {
    state._data.sort((a, b) => {
      return a.id - b.id;
    });
  },
  ID_DESC: () => {
    state._data.sort((a, b) => {
      return b.id - a.id;
    });
  },
  TITLE_ASC: () => {
    state._data.sort((a, b) => {
      return a.title.localeCompare(b.title);
    });
  },
  TITLE_DESC: () => {
    state._data.sort((a, b) => {
      return b.title.localeCompare(a.title);
    });
  }
})

// Mi permette di filtrare le todo-list
const FilterUtils = {
  COMPLETED_TRUE: (data) => {
    return data.filter(item => item.completed);
  },
  COMPLETED_FALSE: (data) => {
    return data.filter(item => !item.completed);
  }
}

// Ci assicuriamo di eseguire le funzioni solo quando la pagina è stata caricata
window.addEventListener('load', async () => {
  // Mettiamo in alto tutti i riferimenti ai tag html in modo che siano
  // accessibili ovunque
  const $todoList = document.getElementById('todo-list');
  const $todoListHead = $todoList.querySelector('thead');
  const $todoListBody = $todoList.querySelector('tbody');
  const $pagination = document.getElementById('pagination');
  const $searchInput = document.getElementById('todo-search');
  const $todoLimit = document.getElementById('todo-limit');
  const $todoLimiSelectSpanValue = document.getElementById('todo-limit-value');

  // Dichiariamo in alto la nostra `state` che contiene tutti i dati
  // da manipolare per il funzionamento delle funzioni. Rappresenta in qualche modo
  // lo stato delle funzioni
  const state = {
    page: 1,
    limit: 10,
    _data: [],
    _searchedData: [],
  };

  // Usiamo il localStorage come sistema di cache, se i dati sono già in memoria
  // non dovremo chiamare l'API
  const cache = CacheUtils.getFormCache('cache');

  // Recuperiamo i dati dall'API e convertiamo i dati dal formato
  // JSON ad un oggetto su cui possiamo lavorare. Occupiamoci di capire se
  // i dati sono in cache o no. Se sono in cache, usiamo i dati in cache,
  // altrimenti chiamiamo l'API e salviamo i dati in cache.
  const data = cache == null ? await (await fetch(API_URL, { method: METHOD })).json() : cache;

  if (cache == null) {
    // Se non ci sono dati in memoria, li salviamo in memoria
    CacheUtils.setToCache('cache', data);
  }

  // Copiamo i dati in un parametro dello state che ci servirà per la gestione
  // di tutte le funzionalità richieste.
  state._data = Utility.getDeepCopy(data);

  // Mi preparo tutte le chiavi per gestire il print iniziale della tabella
  // perchè so già in partenza che tutti gli obj all'interno hanno le stesse chiavi
  const keys = Object.keys(data[0]);

  // Creo una funzione che mi permette di settare i valori della selct di limit
  const setLimitSelectValues = () => {
    // Calcolo il numero di risultati ottenuti dalla richiesta all'API
    // aggiornato allo stato dello state
    const totalDataElement = state._data.length;
    // Setto i valori della select
    $todoLimit.value = state.limit == totalDataElement || state.limit == data.length ? 'ALL' : state.limit;
    $todoLimiSelectSpanValue.innerHTML = `${state.limit <= totalDataElement ? state.limit : totalDataElement}/${totalDataElement}`;
    // Disattivo i valori fuori dal range
    $todoLimit.querySelectorAll('option').forEach(option => {
      option.disabled = option.value != 'ALL' && option.value > totalDataElement;
    });
  }

  // Setto subito i valori corretti
  setLimitSelectValues();

  // Preparo un'utility per il print dell'elemento di impaginazione
  const printPaginationElement = () => {
    // Svuoltiamo il template dell'elemento di impaginazione
    $pagination.innerHTML = "";
    // Calcolo il totale delle pagine da renderizzare sulla pase del limit
    // e dell'attuale selezione in state._data
    const totalPages = Math.ceil(state._data.length / state.limit)
    // Creo una funzione che mi permette di renderizzare le pagine in gruppi
    const _renderPaginationLink = (groupedBy = 5) => {
      const _pagesRef = {
        start: parseInt(state.page),
        printStartDots: false,
        ranged: {
          start: parseInt(state.page) - Math.floor(groupedBy / 2) < 1 ? 1 : parseInt(state.page) - Math.floor(groupedBy / 2),
          end: parseInt(state.page) + Math.floor(groupedBy / 2) < 5 ? 5 : parseInt(state.page) + Math.floor(groupedBy / 2)
        },
        printEndDots: false,
        end: totalPages
      }
      // Controllo se la pagina iniziale è inferiore a quella di inizio
      if (state.page - Math.ceil((groupedBy / 2)) >= 1) _pagesRef.printStartDots = true;
      else _pagesRef.printStartDots = false;

      // Controllo se la pagina finale è superiore a quella di fine
      if (_pagesRef.ranged.end >= totalPages) _pagesRef.printEndDots = false;
      else _pagesRef.printEndDots = true;

      const html = `
        ${_pagesRef.printStartDots ? `<li class="page-item"><a class="page-link" data-page="1" href="#">1</a></li>` : ''}
        ${_pagesRef.printStartDots ? `<li class="page-item"><a class="page-link disabled" href="#">...</a></li>` : ''}
        ${Array.from({ length: 5 }, (_, i) => {
        const _page = i + _pagesRef.ranged.start;
        if (_page < _pagesRef.end) {
          return `<li class="page-item${_page == state.page ? ' active' : ''}" data-page="${_page}"><a class="page-link" data-page="${_page}" href="#">${_page}</a></li>`;
        }
      }).join('')}
        ${_pagesRef.printEndDots ? `<li class="page-item"><a class="page-link disabled" href="#">...</a></li>` : ''}
        <li class="page-item${state.page == totalPages ? ' active' : ''}" data-page="${totalPages}"> <a class="page-link" data-page="${totalPages}" href="#">${totalPages}</a></li>
      `;

      return html
    }

    // Preparo il template html
    const html = `
      <li class="page-item${state.page <= 1 ? ' disabled' : ''}"><a class="page-link" id="prev-page" href="#">Previous</a></li>
      ${_renderPaginationLink()}
      <li class="page-item${state.page >= totalPages ? ' disabled' : ''}"><a class="page-link" id="next-page" href="#">Next</a></li>
    `;
    $pagination.innerHTML = html;
  }

  // Eseguo la funzione per renderizzare il widget di impaginazione
  printPaginationElement();

  // Creo un'utility per gestile le pagine attive nel widget di impaginazione
  setWidgetPaginationActive = (page) => {
    // Calcolo il totale delle pagine da renderizzare sulla pase del limit
    // e dell'attuale selezione in state._data
    const totalPages = Math.ceil(state._data.length / state.limit)
    // Seleziono tutte le pagine ogni volta perché il widget di impaginazione
    // subisce modifiche dinamiche
    const $pages = $pagination.querySelectorAll('.page-item');
    // Setto tutte le pagine come non attive
    $pages.forEach(($page) => {
      $page.classList.remove('active');
    });
    // Seleziono la pagina attuale
    $pages[page]?.classList?.add('active');

    // Se siamo a pagina 1 voglio disattivare il Prev e viceversa
    if (page == 1) {
      $pagination.querySelector('#prev-page').parentElement.classList.add('disabled');
    } else if (page > 1 && page < totalPages) {
      $pagination.querySelector('#prev-page').parentElement.classList.remove('disabled');
    }

    // Se siamo all'ultima pagina voglio disattivare il Next e viceversa
    if (page == totalPages) {
      $pagination.querySelector('#next-page').parentElement.classList.add('disabled');
    } else {
      $pagination.querySelector('#next-page').parentElement.classList.remove('disabled');
    }
  }

  // Preparo un'utility per il print della head della tabella
  const printTableHead = () => {
    // Creo l'elemento tr
    const $tr = document.createElement('tr');
    // Appendo i vari th in base alle chiavi
    keys.forEach(key => {
      const $th = document.createElement('th');
      $th.scope = "col";
      $th.innerHTML = key;
      $tr.appendChild($th);
    });
    // Appendo l'elemento tr completo alla thead
    $todoListHead.appendChild($tr);
  }

  // Eseguo la funzion per renderizzare la head della tabella
  printTableHead();

  // Preparo un'utility per il print della body della tabella
  const printTableBody = (page = 1, limit = 10) => {
    // Svuoto la tabella
    $todoListBody.innerHTML = "";
    // Recupero l'array seguendo l'impaginazione
    const dataToPrint = Utility.getRangeElementsFromArray(state._data, (page - 1) * limit, page * limit);
    // Appendo i vari td in base alle chiavi
    dataToPrint.forEach(obj => {
      // Creo l'elemento tr
      const $tr = document.createElement('tr');
      keys.forEach(key => {
        const $td = document.createElement('td');
        $td.innerHTML = obj[key];
        $tr.appendChild($td);
      });
      // Appendo l'elemento tr completo alla tbody
      $todoListBody.appendChild($tr);
    });
  }

  // Eseguo la funzion per renderizzare il body della tabella
  // Nella prima esecuzione i valori di default sono quelli
  // di page = 1 e di limit = 10 quindi non serve passare
  // alcun valore per il momento
  printTableBody();

  // Occupiamoci della gestione dell'impaginazione
  const setPage = (page = 1) => {
    // Cancello tutti i nodi della tbody
    $todoListBody.innerHTML = '';
    // Imposto la pagina corrente
    state.page = page;
    // Stampo la tabella con i nuovi dati
    printTableBody(page, state.limit);
    // Aggiorno il widget di impaginazione
    printPaginationElement();
  }

  // Creo una funzione che mi permette di resetare i dati allo stato originale
  const resetOriginalData = (isSearchReset = false) => {
    // Resetto lo state ai dati originali
    state._data = state._searchedData.length > 0 ? state._searchedData : Utility.getDeepCopy(data);
    // Resetto il backup della ricerca
    state._searchedData = isSearchReset ? [] : state._searchedData;

    // Resetto la pagina corrente e il limite di elementi per pagina
    state.page = 1;
    state.limit = 10;

    // Setto subito i valori corretti
    setLimitSelectValues();
    // Renderizzo il tbody con i nuovi dati
    // non mi serve impostare l'array perché si trova gia nella variabile state
    // devo solo resettare la pagina e il widget di impaginazione
    printTableBody(state.page, state.limit);
    // Il widget di impaginazione viene resettato in automatico
    // perché tutto fa riferimento allo state
    printPaginationElement();
  }

  // In fondo gestisto un event listener per la gestione di tutti gli eventi
  // utilizzando la tecnica del delegate
  document.body.addEventListener("click", (e) => {
    const id = e.target.id;
    const classList = e.target.classList;

    /**
     * Click per il widget di impaginazione
     */
    if (id === 'prev-page') {
      state.page--;
      setWidgetPaginationActive(state.page);
      setPage(state.page);
    } else if (id === 'next-page') {
      state.page++;
      setWidgetPaginationActive(state.page);
      setPage(state.page);
    } else if (classList.value.indexOf('page-link') !== -1) {
      state.page = e.target.dataset.page;
      setWidgetPaginationActive(state.page);
      setPage(state.page);
    }
  });

  // Gestisco l'event listner input sulla ricerca
  $searchInput.addEventListener('input', (e) => {
    const text = e.target.value;

    // Voglio che la ricerca si attivi dalla 3 lettera in poi
    if (text.length >= 3) {
      const matchedData = [];
      state._data.forEach(obj => {
        const keys = Object.keys(obj);
        keys.forEach(key => {
          if (obj[key].toString().toLowerCase().indexOf(text.toLowerCase()) !== -1) {
            matchedData.push(obj);
          }
        });
      });

      // Sostituisco i dati con quelli corrispondenti alla ricerca
      state._data = Utility.getDeepCopy(matchedData);
      // Copia di backup per mantenere la ricerca attiva
      state._searchedData = Utility.getDeepCopy(matchedData);

      // Resetto lo state per l'impaginazione
      state.page = 1;
      state.limit = 10;

      // Setto subito i valori corretti
      setLimitSelectValues();
      // Renderizzo il tbody con i nuovi dati
      // non mi serve impostare l'array perché si trova gia nella variabile state
      // devo solo resettare la pagina e il widget di impaginazione
      printTableBody(state.page, state.limit);
      // Il widget di impaginazione viene resettato in automatico
      // perché tutto fa riferimento allo state
      printPaginationElement();
    } else {
      // Se la ricerca si azzera, ripristino i dati originali
      resetOriginalData(true);
    }
  });

  // Resetto i dati se l'utente clicca sull'icona di reset
  $searchInput.addEventListener('search', (e) => resetOriginalData(true));

  // Gestisco gli eventi di change per le selct in delegate
  document.body.addEventListener("change", (e) => {
    const id = e.target.id;

    /**
     * Change per la select di sorting
     */
    if (id === 'todo-sort') {
      const value = e.target.value;
      if (value == "") {
        // Resetto i dati originali
        resetOriginalData();
      } else {
        // Ordino i dati in base alla scelta dell'utente
        // Il mio value sarà ID_ASC o ID_DESC o TITTLE_ASC o TITLE_DESC ho
        // preparato in anticipo una funzione per gestire la scelta dell'utente.
        // In questo caso la funzione manipola direttamente l'array _data nello state.
        SelectUtils(state)[value]();

        // Renderizzo il tbody con i nuovi dati
        // non mi serve impostare l'array perché si trova gia nella variabile state
        // devo solo resettare la pagina e il widget di impaginazione
        printTableBody(state.page, state.limit);
      }
    }

    /**
     * Change per la select di filter
     */
    if (id === 'todo-filter') {
      const value = e.target.value;
      if (value == "") {
        // Resetto i dati originali
        resetOriginalData();
      } else {
        // Prima ripristino i dati all'originale per poi poterli filtrare
        // Se presente una ricerca attiva allora ne tengo conto altrimenti
        // resetto ai dati di partenza
        state._data = state._searchedData.length > 0 ? state._searchedData : Utility.getDeepCopy(data);
        // Filtro i dati in base alla scelta dell'utente
        // Il mio value sarà COMPLETED_TRUE o COMPLETED_FALSE ho
        // preparato in anticipo una funzione per gestire la scelta dell'utente.
        // In questo caso la funzione non manipola direttamente l'array _data nello state.
        state._data = FilterUtils[value](state._data);

        // Renderizzo il tbody con i nuovi dati
        // non mi serve impostare l'array perché si trova gia nella variabile state
        // devo solo resettare la pagina e il widget di impaginazione
        printTableBody(state.page, state.limit);

        // Setto i valori corretti per la select di limit
        setLimitSelectValues();

        // Il widget di impaginazione viene resettato in automatico
        // perché tutto fa riferimento allo state
        printPaginationElement();
      }
    }

    /**
     * Change per la select di limit
     */
    if (id === 'todo-limit') {
      const value = e.target.value;
      if (value == "") {
        // Resetto i dati originali
        resetOriginalData();
        // Setto i valori corretti per la select di limit
        setLimitSelectValues();
      } else {
        // Imposto il limite di elementi per pagina
        state.limit = value == "ALL" ? data.length : parseInt(value);

        // Setto i valori corretti per la select di limit
        setLimitSelectValues();

        // Renderizzo il tbody con i nuovi dati
        // non mi serve impostare l'array perché si trova gia nella variabile state
        // devo solo resettare la pagina e il widget di impaginazione
        printTableBody(state.page, state.limit);

        // Il widget di impaginazione viene resettato in automatico
        // perché tutto fa riferimento allo state
        printPaginationElement();
      }
    }
  })

});
