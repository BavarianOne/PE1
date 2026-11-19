/**
 * Schiffe Versenken — PE1
 * 2-Spieler (Pass & Play) oder gegen KI
 * Touch-first, Offline-fähig, Framer Design System
 * Drag & Drop Ship Placement
 */

(function() {
  'use strict';

  // ===== CONFIG =====
  const BOARD_SIZES = {
    small:  { size: 6, ships: [3, 2, 2], names: ['Kreuzer', 'Zerstörer', 'U-Boot'] },
    medium: { size: 8, ships: [4, 3, 3, 2, 2], names: ['Schlachtschiff', 'Kreuzer', 'Zerstörer', 'U-Boot', 'Patrouillenboot'] },
    large:  { size: 10, ships: [5, 4, 3, 3, 2], names: ['Träger', 'Schlachtschiff', 'Kreuzer', 'Zerstörer', 'U-Boot'] }
  };

  const CELL_STATES = {
    EMPTY: 0,
    SHIP: 1,
    HIT: 2,
    MISS: 3,
    SUNK: 4
  };

  // ===== STATE =====
  let state = {
    mode: null,
    boardSize: null,
    size: 6,
    ships: [],
    shipNames: [],
    phase: 'mode',
    currentPlayer: 1,
    players: [
      { board: [], ships: [], hits: 0, misses: 0, sunk: 0 },
      { board: [], ships: [], hits: 0, misses: 0, sunk: 0 }
    ],
    placement: {
      draggedShipIndex: null,
      draggedShipLen: null,
      draggedShipName: null,
      orientation: 'horizontal',
      validDropTarget: null,
      previewCells: [],
      placedShips: []
    },
    aiDifficulty: 'medium',
    aiLastHits: [],
    aiHuntMode: false,
    gameOver: false,
    winner: null
  };

  // ===== DOM ELEMENTS =====
  const els = {
    modeSelection: document.getElementById('modeSelection'),
    sizeSelection: document.getElementById('sizeSelection'),
    placementPhase: document.getElementById('placementPhase'),
    gamePhase: document.getElementById('gamePhase'),

    modePvP: document.getElementById('modePvP'),
    modeAI: document.getElementById('modeAI'),
    modeBadge: document.getElementById('modeBadge'),

    sizeOptions: document.querySelectorAll('.size-option'),
    sizeStatus: document.getElementById('sizeStatus'),

    myBoard: document.getElementById('myBoard'),
    myBoardLabel: document.getElementById('myBoardLabel'),
    fleetList: document.getElementById('fleetList'),
    fleetPanel: document.getElementById('fleetPanel'),
    placementIndicator: document.getElementById('placementIndicator'),
    placementDot: document.getElementById('placementDot'),
    placementText: document.getElementById('placementText'),
    placementStatus: document.getElementById('placementStatus'),
    rotateBtn: document.getElementById('rotateBtn'),
    confirmPlacementBtn: document.getElementById('confirmPlacementBtn'),

    myBoardGame: document.getElementById('myBoardGame'),
    opponentBoard: document.getElementById('opponentBoard'),
    myBoardLabel2: document.getElementById('myBoardLabel2'),
    opponentBoardLabel: document.getElementById('opponentBoardLabel'),
    turnIndicator: document.getElementById('turnIndicator'),
    myTurnDot: document.getElementById('myTurnDot'),
    myTurnText: document.getElementById('myTurnText'),
    opponentTurnDot: document.getElementById('opponentTurnDot'),
    opponentTurnText: document.getElementById('opponentTurnText'),
    aiThinking: document.getElementById('aiThinking'),
    turnStatus: document.getElementById('turnStatus'),
    hitsStat: document.getElementById('hitsStat'),
    missesStat: document.getElementById('missesStat'),
    sunkStat: document.getElementById('sunkStat'),

    resultModal: document.getElementById('resultModal'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    newGameBtn: document.getElementById('newGameBtn'),
    switchModal: document.getElementById('switchModal'),
    switchTitle: document.getElementById('switchTitle'),
    switchMessage: document.getElementById('switchMessage'),
    continueBtn: document.getElementById('continueBtn'),

    gameStatus: document.getElementById('gameStatus')
  };

  // ===== UTILITIES =====
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function toggle(el, force) { el.classList.toggle('hidden', force); }

  function haptic(type = 'light') {
    if (navigator.vibrate) {
      navigator.vibrate(type === 'heavy' ? [10, 30, 10] : 10);
    }
  }

  function createCell(r, c, boardType) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.r = r;
    cell.dataset.c = c;
    cell.dataset.board = boardType;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Zeile ${r+1}, Spalte ${c+1}`);
    return cell;
  }

  function getCell(boardEl, r, c) {
    return boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  function coordsFromCell(cell) {
    return { r: +cell.dataset.r, c: +cell.dataset.c };
  }

  // ===== BOARD LOGIC =====
  function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(CELL_STATES.EMPTY));
  }

  function canPlaceShip(board, shipLen, r, c, orientation, ignoreShipIndex = -1) {
    const size = board.length;
    const dr = orientation === 'horizontal' ? 0 : 1;
    const dc = orientation === 'horizontal' ? 1 : 0;

    const endR = r + dr * (shipLen - 1);
    const endC = c + dc * (shipLen - 1);
    if (endR >= size || endC >= size || r < 0 || c < 0) return false;

    for (let i = 0; i < shipLen; i++) {
      const cr = r + dr * i;
      const cc = c + dc * i;
      if (board[cr][cc] !== CELL_STATES.EMPTY) return false;
      for (let nr = cr - 1; nr <= cr + 1; nr++) {
        for (let nc = cc - 1; nc <= cc + 1; nc++) {
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (board[nr][nc] === CELL_STATES.SHIP) {
              let belongsToIgnored = false;
              if (ignoreShipIndex >= 0) {
                const ignoredShip = state.placement.placedShips[ignoreShipIndex];
                if (ignoredShip) {
                  for (const cell of ignoredShip.cells) {
                    if (cell.r === nr && cell.c === nc) {
                      belongsToIgnored = true;
                      break;
                    }
                  }
                }
              }
              if (!belongsToIgnored) return false;
            }
          }
        }
      }
    }
    return true;
  }

  function placeShip(board, shipLen, r, c, orientation) {
    const dr = orientation === 'horizontal' ? 0 : 1;
    const dc = orientation === 'horizontal' ? 1 : 0;
    const cells = [];
    for (let i = 0; i < shipLen; i++) {
      const cr = r + dr * i;
      const cc = c + dc * i;
      board[cr][cc] = CELL_STATES.SHIP;
      cells.push({ r: cr, c: cc });
    }
    return cells;
  }

  function removeShip(board, cells) {
    cells.forEach(({ r, c }) => {
      board[r][c] = CELL_STATES.EMPTY;
    });
  }

  function getShipAt(board, ships, r, c) {
    return ships.find(s => s.cells.some(cell => cell.r === r && cell.c === c));
  }

  function checkSunk(board, ship) {
    return ship.cells.every(cell => board[cell.r][cell.c] === CELL_STATES.HIT);
  }

  function markSunk(board, ship) {
    ship.sunk = true;
    ship.cells.forEach(cell => {
      board[cell.r][cell.c] = CELL_STATES.SUNK;
    });
  }

  function allShipsSunk(ships) {
    return ships.every(s => s.sunk);
  }

  // ===== RENDER =====
  function renderBoard(boardEl, board, showShips, playerShips = []) {
    const size = board.length;
    boardEl.innerHTML = '';
    boardEl.className = 'board ' + (size <= 6 ? 'small' : size <= 8 ? 'medium' : 'large');

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = createCell(r, c, boardEl.id);
        const val = board[r][c];

        if (val === CELL_STATES.SHIP && showShips) {
          cell.classList.add('ship');
        } else if (val === CELL_STATES.HIT) {
          cell.classList.add('hit');
        } else if (val === CELL_STATES.MISS) {
          cell.classList.add('miss');
        } else if (val === CELL_STATES.SUNK) {
          cell.classList.add('sunk');
        }

        boardEl.appendChild(cell);
      }
    }
  }

  function renderFleet() {
    const { placedShips, draggedShipIndex } = state.placement;
    els.fleetList.innerHTML = '';

    state.ships.forEach((len, i) => {
      const name = state.shipNames[i] || `Schiff ${i + 1}`;
      const placed = placedShips.findIndex(s => s.index === i);
      const isPlaced = placed >= 0;
      const isDragged = draggedShipIndex === i;

      const shipEl = document.createElement('div');
      shipEl.className = `fleet-ship ${isPlaced ? 'placed' : ''} ${isDragged ? 'dragging' : ''}`;
      shipEl.draggable = !isPlaced;
      shipEl.dataset.shipIndex = i;

      if (!isPlaced) {
        shipEl.addEventListener('dragstart', handleDragStart);
        shipEl.addEventListener('dragend', handleDragEnd);
      }

      const segmentsHtml = Array.from({ length: len }, (_, idx) =>
        `<span class="ship-segment${idx < len ? ' filled' : ''}">${idx + 1}</span>`
      ).join('');

      shipEl.innerHTML = `
        <div class="ship-visual">${segmentsHtml}</div>
        <div class="ship-info">
          <span class="ship-name">${name}</span>
          <span class="ship-length">Länge: ${len}</span>
          <span class="ship-status">${isPlaced ? 'PLATZIERT' : (isDragged ? 'ZIEHEN…' : 'ZUM BRETT ZIEHEN')}</span>
        </div>
      `;
      els.fleetList.appendChild(shipEl);
    });

    const placedCount = placedShips.length;
    const totalCount = state.ships.length;
    els.fleetPanel.querySelector('.fleet-title').innerHTML = `Flotte <span class="ship-count">${placedCount}/${totalCount} platziert</span>`;
  }

  // ===== DRAG & DROP =====
  function handleDragStart(e) {
    const shipIndex = +e.target.closest('.fleet-ship').dataset.shipIndex;
    const len = state.ships[shipIndex];
    const name = state.shipNames[shipIndex];

    state.placement.draggedShipIndex = shipIndex;
    state.placement.draggedShipLen = len;
    state.placement.draggedShipName = name;
    state.placement.orientation = 'horizontal';
    state.placement.previewCells = [];
    state.placement.validDropTarget = null;

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', shipIndex.toString());

    const ghost = createDragGhost(len, name);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(ghost), 0);

    haptic('heavy');
    updatePlacementStatus(`Ziehe ${name} (Länge ${len}) aufs Brett — <kbd>R</kbd> zum Drehen`);
    renderFleet();
  }

  function createDragGhost(len, name) {
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:absolute;pointer-events:none;z-index:9999;opacity:0.9;';
    ghost.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;padding:8px 12px;background:var(--color-accent);border-radius:var(--radius-lg);box-shadow:var(--shadow-float);">
        <div style="font-weight:700;font-size:12px;color:white;">${name}</div>
        <div style="display:flex;gap:2px;">${Array.from({length:len},()=>'<div style="width:24px;height:24px;background:white;border-radius:4px;"></div>').join('')}</div>
      </div>
    `;
    return ghost;
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    state.placement.draggedShipIndex = null;
    state.placement.draggedShipLen = null;
    state.placement.draggedShipName = null;
    state.placement.previewCells = [];
    state.placement.validDropTarget = null;
    clearPreview();
    renderFleet();
    updatePlacementStatus();
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const cell = e.target.closest('.cell');
    if (!cell || cell.dataset.board !== 'myBoard') {
      clearPreview();
      state.placement.validDropTarget = null;
      return;
    }

    if (!state.placement.draggedShipLen) return;

    const { r, c } = coordsFromCell(cell);
    const board = state.players[state.currentPlayer - 1].board;
    const ignoreIndex = state.placement.placedShips.findIndex(s => s.index === state.placement.draggedShipIndex);

    const valid = canPlaceShip(board, state.placement.draggedShipLen, r, c, state.placement.orientation, ignoreIndex);

    state.placement.previewCells = [];
    for (let i = 0; i < state.placement.draggedShipLen; i++) {
      const dr = state.placement.orientation === 'horizontal' ? 0 : 1;
      const dc = state.placement.orientation === 'horizontal' ? 1 : 0;
      state.placement.previewCells.push({ r: r + dr * i, c: c + dc * i });
    }

    showPreview(valid);
    state.placement.validDropTarget = valid ? { r, c } : null;
  }

  function handleDrop(e) {
    e.preventDefault();

    if (!state.placement.validDropTarget || !state.placement.draggedShipLen) {
      clearPreview();
      return;
    }

    const { r, c } = state.placement.validDropTarget;
    const shipIndex = state.placement.draggedShipIndex;
    const len = state.placement.draggedShipLen;
    const name = state.placement.draggedShipName;
    const orientation = state.placement.orientation;
    const board = state.players[state.currentPlayer - 1].board;

    const cells = placeShip(board, len, r, c, orientation);
    state.placement.placedShips.push({ index: shipIndex, len, name, r, c, orientation, cells });

    const player = state.players[state.currentPlayer - 1];
    player.ships.push({ id: shipIndex, cells: [...cells], length: len, hits: 0, sunk: false });

    clearPreview();
    renderBoard(els.myBoard, board, true, player.ships);
    renderFleet();
    updatePlacementStatus(`${name} platziert!`);
    haptic();

    if (state.placement.placedShips.length === state.ships.length) {
      setTimeout(finishPlacement, 500);
    }
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      clearPreview();
      state.placement.validDropTarget = null;
    }
  }

  function showPreview(valid) {
    clearPreview();
    const boardEl = els.myBoard;
    state.placement.previewCells.forEach(({ r, c }) => {
      const cell = getCell(boardEl, r, c);
      if (cell) {
        cell.classList.add('preview');
        if (!valid) cell.classList.add('invalid');
      }
    });
  }

  function clearPreview() {
    $$('.cell.preview', els.myBoard).forEach(c => c.classList.remove('preview', 'invalid'));
    state.placement.previewCells = [];
  }

  function rotateDraggedShip() {
    if (!state.placement.draggedShipLen) return;
    const newOrientation = state.placement.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    state.placement.orientation = newOrientation;

    const preview = state.placement.previewCells;
    if (preview.length > 0) {
      const start = preview[0];
      const board = state.players[state.currentPlayer - 1].board;
      const ignoreIndex = state.placement.placedShips.findIndex(s => s.index === state.placement.draggedShipIndex);
      const valid = canPlaceShip(board, state.placement.draggedShipLen, start.r, start.c, newOrientation, ignoreIndex);

      state.placement.previewCells = [];
      for (let i = 0; i < state.placement.draggedShipLen; i++) {
        const dr = newOrientation === 'horizontal' ? 0 : 1;
        const dc = newOrientation === 'horizontal' ? 1 : 0;
        state.placement.previewCells.push({ r: start.r + dr * i, c: start.c + dc * i });
      }
      showPreview(valid);
      state.placement.validDropTarget = valid ? start : null;
    }

    updatePlacementStatus(`Ausrichtung: ${newOrientation === 'horizontal' ? 'waagerecht' : 'senkrecht'} — Ziehe aufs Brett`);
    haptic();
  }

  // Touch support for drag & drop on mobile
  let touchShipIndex = null;
  let touchGhost = null;

  function handleTouchStart(e) {
    const shipEl = e.target.closest('.fleet-ship[draggable="true"]');
    if (!shipEl) return;

    touchShipIndex = +shipEl.dataset.shipIndex;
    const touch = e.touches[0];

    touchGhost = createDragGhost(state.ships[touchShipIndex], state.shipNames[touchShipIndex]);
    touchGhost.style.left = (touch.clientX - touchGhost.offsetWidth/2) + 'px';
    touchGhost.style.top = (touch.clientY - touchGhost.offsetHeight/2) + 'px';
    document.body.appendChild(touchGhost);

    state.placement.draggedShipIndex = touchShipIndex;
    state.placement.draggedShipLen = state.ships[touchShipIndex];
    state.placement.draggedShipName = state.shipNames[touchShipIndex];
    state.placement.orientation = 'horizontal';

    shipEl.classList.add('dragging');
    haptic('heavy');
    updatePlacementStatus(`Ziehe ${state.placement.draggedShipName} aufs Brett — Tippe „Drehen“ für Ausrichtung`);
    renderFleet();
  }

  function handleTouchMove(e) {
    if (touchShipIndex === null || !touchGhost) return;
    e.preventDefault();

    const touch = e.touches[0];
    touchGhost.style.left = (touch.clientX - touchGhost.offsetWidth/2) + 'px';
    touchGhost.style.top = (touch.clientY - touchGhost.offsetHeight/2) + 'px';

    const boardRect = els.myBoard.getBoundingClientRect();
    if (touch.clientX >= boardRect.left && touch.clientX <= boardRect.right &&
        touch.clientY >= boardRect.top && touch.clientY <= boardRect.bottom) {
      const cellSize = boardRect.width / state.size;
      const relX = touch.clientX - boardRect.left;
      const relY = touch.clientY - boardRect.top;
      const c = Math.floor(relX / cellSize);
      const r = Math.floor(relY / cellSize);

      if (r >= 0 && r < state.size && c >= 0 && c < state.size) {
        const board = state.players[state.currentPlayer - 1].board;
        const ignoreIndex = state.placement.placedShips.findIndex(s => s.index === touchShipIndex);
        const valid = canPlaceShip(board, state.placement.draggedShipLen, r, c, state.placement.orientation, ignoreIndex);

        state.placement.previewCells = [];
        for (let i = 0; i < state.placement.draggedShipLen; i++) {
          const dr = state.placement.orientation === 'horizontal' ? 0 : 1;
          const dc = state.placement.orientation === 'horizontal' ? 1 : 0;
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < state.size && nc < state.size) {
            state.placement.previewCells.push({ r: nr, c: nc });
          }
        }
        showPreview(valid);
        state.placement.validDropTarget = valid ? { r, c } : null;
      } else {
        clearPreview();
        state.placement.validDropTarget = null;
      }
    } else {
      clearPreview();
      state.placement.validDropTarget = null;
    }
  }

  function handleTouchEnd(e) {
    if (touchShipIndex === null) return;

    if (state.placement.validDropTarget) {
      const { r, c } = state.placement.validDropTarget;
      const shipIndex = touchShipIndex;
      const len = state.placement.draggedShipLen;
      const name = state.placement.draggedShipName;
      const orientation = state.placement.orientation;
      const board = state.players[state.currentPlayer - 1].board;

      const cells = placeShip(board, len, r, c, orientation);
      state.placement.placedShips.push({ index: shipIndex, len, name, r, c, orientation, cells });

      const player = state.players[state.currentPlayer - 1];
      player.ships.push({ id: shipIndex, cells: [...cells], length: len, hits: 0, sunk: false });

      renderBoard(els.myBoard, board, true, player.ships);
      updatePlacementStatus(`${name} platziert!`);
      haptic();

      if (state.placement.placedShips.length === state.ships.length) {
        setTimeout(finishPlacement, 500);
      }
    } else {
      updatePlacementStatus('Ungültige Position — versuch\'s nochmal');
      haptic('heavy');
    }

    clearPreview();
    if (touchGhost) {
      document.body.removeChild(touchGhost);
      touchGhost = null;
    }

    const shipEl = els.fleetList.querySelector(`[data-ship-index="${touchShipIndex}"]`);
    if (shipEl) shipEl.classList.remove('dragging');

    touchShipIndex = null;
    state.placement.draggedShipIndex = null;
    state.placement.draggedShipLen = null;
    state.placement.draggedShipName = null;
    state.placement.validDropTarget = null;
    renderFleet();
  }

  function removePlacedShip(shipIndex) {
    const placedIndex = state.placement.placedShips.findIndex(s => s.index === shipIndex);
    if (placedIndex === -1) return;

    const placed = state.placement.placedShips[placedIndex];
    const board = state.players[state.currentPlayer - 1].board;
    removeShip(board, placed.cells);

    const player = state.players[state.currentPlayer - 1];
    const shipIdx = player.ships.findIndex(s => s.id === shipIndex);
    if (shipIdx >= 0) player.ships.splice(shipIdx, 1);

    state.placement.placedShips.splice(placedIndex, 1);

    renderBoard(els.myBoard, board, true, player.ships);
    renderFleet();
    updatePlacementStatus(`${placed.name} entfernt — wieder zur Flotte`);
    haptic();
  }

  // ===== PLACEMENT STATUS =====
  function updatePlacementStatus(msg) {
    if (msg) {
      els.placementStatus.textContent = msg;
      return;
    }

    const placed = state.placement.placedShips.length;
    const total = state.ships.length;
    const remaining = total - placed;

    if (remaining === 0) {
      els.placementStatus.textContent = 'Alle Schiffe platziert! Spiel startet…';
    } else {
      els.placementStatus.innerHTML = `${remaining} von ${total} Schiffe übrig — Ziehe ein Schiff aus der Flotte aufs Brett`;
    }
  }

  // ===== GAME PHASE =====
  function finishPlacement() {
    const player = state.players[state.currentPlayer - 1];
    renderBoard(els.myBoard, player.board, true, player.ships);
    renderFleet();

    if (state.mode === 'pvp' && state.currentPlayer === 1) {
      showSwitchModal(2);
    } else {
      startGame();
    }
  }

  function showSwitchModal(nextPlayer) {
    els.switchTitle.textContent = `Spieler ${nextPlayer} ist dran`;
    els.switchMessage.textContent = `Gerät an Spieler ${nextPlayer} übergeben — Schiffe platzieren.`;
    els.continueBtn.onclick = () => {
      hide(els.switchModal);
      state.currentPlayer = nextPlayer;
      state.placement.placedShips = [];
      state.placement.draggedShipIndex = null;
      state.placement.draggedShipLen = null;
      state.placement.draggedShipName = null;
      state.placement.orientation = 'horizontal';
      state.placement.previewCells = [];
      state.placement.validDropTarget = null;

      els.placementText.textContent = `Spieler ${nextPlayer}: Schiffe platzieren`;
      els.placementDot.classList.toggle('active', nextPlayer === 1);
      els.placementText.classList.toggle('active', nextPlayer === 1);
      els.myBoardLabel.textContent = `Spieler ${nextPlayer}`;

      state.players[1].board = createEmptyBoard(state.size);
      state.players[1].ships = [];
      renderBoard(els.myBoard, state.players[1].board, true, []);
      renderFleet();
      updatePlacementStatus();
    };
    show(els.switchModal);
  }

  function startGame() {
    state.phase = 'game';
    state.currentPlayer = 1;
    state.gameOver = false;
    state.winner = null;

    if (state.mode === 'ai') {
      placeAIShips();
    }

    hide(els.placementPhase);
    show(els.gamePhase);
    renderGameBoards();
    updateTurnUI();
    updateStats();
  }

  function placeAIShips() {
    const ai = state.players[1];
    const size = state.size;
    state.ships.forEach((len, idx) => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        if (canPlaceShip(ai.board, len, r, c, orientation)) {
          const cells = placeShip(ai.board, len, r, c, orientation);
          ai.ships.push({ id: idx, cells, length: len, hits: 0, sunk: false });
          placed = true;
        }
        attempts++;
      }
    });
  }

  function renderGameBoards() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    renderBoard(els.myBoardGame, p1.board, true, p1.ships);

    const opponentView = p2.board.map(row => row.map(v =>
      v === CELL_STATES.SHIP ? CELL_STATES.EMPTY : v
    ));
    renderBoard(els.opponentBoard, opponentView, false);
  }

  function updateTurnUI() {
    const isMyTurn = state.currentPlayer === 1;
    const isAI = state.mode === 'ai' && state.currentPlayer === 2;

    els.myTurnDot.classList.toggle('active', isMyTurn);
    els.myTurnText.classList.toggle('active', isMyTurn);
    els.opponentTurnDot.classList.toggle('active', !isMyTurn && !isAI);
    els.opponentTurnText.classList.toggle('active', !isMyTurn && !isAI);
    els.opponentTurnText.textContent = isAI ? 'KI' : 'Spieler 2';

    if (isAI) {
      els.aiThinking.classList.add('visible');
      els.turnStatus.textContent = 'KI denkt...';
      els.turnStatus.classList.remove('active');
    } else {
      els.aiThinking.classList.remove('visible');
      els.turnStatus.textContent = isMyTurn ? 'Dein Zug — tippe ein Feld' : 'Gegner ist dran';
      els.turnStatus.classList.toggle('active', isMyTurn);
    }
  }

  function updateStats() {
    const p1 = state.players[0];
    els.hitsStat.textContent = p1.hits;
    els.missesStat.textContent = p1.misses;
    els.sunkStat.textContent = p1.sunk;
  }

  function handleGameCellClick(cell) {
    if (state.phase !== 'game' || state.gameOver) return;
    if (state.mode === 'ai' && state.currentPlayer === 2) return;

    const boardType = cell.dataset.board;
    if (boardType !== 'opponentBoard') return;

    const { r, c } = coordsFromCell(cell);
    const targetPlayer = state.currentPlayer === 1 ? 1 : 0;
    const target = state.players[targetPlayer];
    const val = target.board[r][c];

    if (val === CELL_STATES.HIT || val === CELL_STATES.MISS || val === CELL_STATES.SUNK) return;

    haptic();
    processAttack(targetPlayer, r, c);
  }

  function processAttack(targetIndex, r, c) {
    const attacker = state.players[state.currentPlayer - 1];
    const target = state.players[targetIndex];
    const val = target.board[r][c];

    let hit = false;
    let sunk = false;

    if (val === CELL_STATES.SHIP) {
      target.board[r][c] = CELL_STATES.HIT;
      attacker.hits++;
      hit = true;

      const ship = getShipAt(target.board, target.ships, r, c);
      if (ship) {
        ship.hits++;
        if (checkSunk(target.board, ship)) {
          markSunk(target.board, ship);
          target.sunk++;
          attacker.sunk++;
          sunk = true;
        }
      }
    } else {
      target.board[r][c] = CELL_STATES.MISS;
      attacker.misses++;
    }

    renderGameBoards();
    updateStats();

    if (allShipsSunk(target.ships)) {
      endGame(state.currentPlayer);
      return;
    }

    if (hit) {
      els.turnStatus.textContent = sunk ? 'Treffer & Versenkt! Nochmal!' : 'Treffer! Nochmal!';
      els.turnStatus.classList.add('active');
      setTimeout(() => updateTurnUI(), 500);
    } else {
      els.turnStatus.textContent = 'Wasser! Gegner ist dran.';
      els.turnStatus.classList.remove('active');
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
      updateTurnUI();

      if (state.mode === 'ai' && state.currentPlayer === 2) {
        setTimeout(aiTurn, 800 + Math.random() * 600);
      }
    }
  }

  // ===== AI =====
  function aiTurn() {
    if (state.gameOver || state.currentPlayer !== 2) return;

    const target = state.players[0];
    let r, c;

    if (state.aiHuntMode && state.aiLastHits.length > 0) {
      const candidates = getTargetCandidates(target.board);
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        r = pick.r; c = pick.c;
      } else {
        state.aiHuntMode = false;
        state.aiLastHits = [];
        const hunt = getHuntCandidates(target.board);
        const pick = hunt[Math.floor(Math.random() * hunt.length)];
        r = pick.r; c = pick.c;
      }
    } else {
      const hunt = getHuntCandidates(target.board);
      if (hunt.length === 0) { endGame(1); return; }
      const pick = hunt[Math.floor(Math.random() * hunt.length)];
      r = pick.r; c = pick.c;
    }

    processAttack(0, r, c);
  }

  function getHuntCandidates(board) {
    const size = board.length;
    const candidates = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === CELL_STATES.EMPTY && (r + c) % 2 === 0) {
          candidates.push({ r, c });
        }
      }
    }
    if (candidates.length === 0) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === CELL_STATES.EMPTY) candidates.push({ r, c });
        }
      }
    }
    return candidates;
  }

  function getTargetCandidates(board) {
    const size = board.length;
    const candidates = [];
    const directions = [[-1,0],[1,0],[0,-1],[0,1]];
    const seen = new Set();

    state.aiLastHits.forEach(hit => {
      directions.forEach(([dr, dc]) => {
        let nr = hit.r + dr;
        let nc = hit.c + dc;
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (board[nr][nc] === CELL_STATES.EMPTY) {
            const key = `${nr},${nc}`;
            if (!seen.has(key)) { seen.add(key); candidates.push({ r: nr, c: nc }); }
            break;
          }
          if (board[nr][nc] === CELL_STATES.HIT) { nr += dr; nc += dc; continue; }
          break;
        }
      });
    });
    return candidates;
  }

  function endGame(winner) {
    state.gameOver = true;
    state.winner = winner;
    state.phase = 'ended';

    const isHumanWin = winner === 1;
    els.resultIcon.className = 'modal-icon ' + (isHumanWin ? 'win' : 'lose');
    els.resultIcon.innerHTML = isHumanWin
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    els.resultTitle.textContent = isHumanWin ? 'Gewonnen!' : 'Verloren!';
    els.resultMessage.textContent = isHumanWin
      ? `Du hast alle gegnerischen Schiffe in ${state.players[0].hits + state.players[0].misses} Schüssen versenkt.`
      : 'Die KI hat deine Flotte vernichtet.';

    show(els.resultModal);
  }

  // ===== EVENT LISTENERS =====
  function initEvents() {
    // Mode selection
    els.modePvP.addEventListener('click', () => selectMode('pvp'));
    els.modeAI.addEventListener('click', () => selectMode('ai'));

    // Size selection
    els.sizeOptions.forEach(btn => {
      btn.addEventListener('click', () => selectSize(btn.dataset.size));
    });

    // Placement board drag & drop
    els.myBoard.addEventListener('dragover', handleDragOver);
    els.myBoard.addEventListener('drop', handleDrop);
    els.myBoard.addEventListener('dragleave', handleDragLeave);

    // Touch drag & drop
    els.fleetList.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Click on placed ship to remove (return to fleet)
    els.myBoard.addEventListener('click', e => {
      if (state.phase !== 'placement') return;
      const cell = e.target.closest('.cell.ship');
      if (!cell) return;

      const { r, c } = coordsFromCell(cell);
      for (let i = 0; i < state.placement.placedShips.length; i++) {
        const placed = state.placement.placedShips[i];
        if (placed.cells.some(c => c.r === r && c.c === c)) {
          removePlacedShip(placed.index);
          break;
        }
      }
    });

    // Rotate button
    els.rotateBtn.addEventListener('click', rotateDraggedShip);
    document.addEventListener('keydown', e => {
      if ((e.key === 'r' || e.key === 'R') && state.phase === 'placement') {
        rotateDraggedShip();
      }
    });

    // Modals
    els.playAgainBtn.addEventListener('click', () => {
      hide(els.resultModal);
      resetGame(true);
    });
    els.newGameBtn.addEventListener('click', () => {
      hide(els.resultModal);
      resetGame(false);
    });
  }

  function selectMode(mode) {
    state.mode = mode;
    state.phase = 'size';
    els.modeBadge.textContent = mode === 'pvp' ? 'PvP' : 'KI';
    els.modeBadge.className = 'mode-badge ' + (mode === 'ai' ? 'ai' : 'pvp');
    hide(els.modeSelection);
    show(els.sizeSelection);
    els.gameStatus.textContent = 'Brettgröße wählen';
    haptic();
  }

  function selectSize(sizeKey) {
    const config = BOARD_SIZES[sizeKey];
    state.boardSize = sizeKey;
    state.size = config.size;
    state.ships = [...config.ships];
    state.shipNames = [...config.names];

    hide(els.sizeSelection);
    show(els.placementPhase);

    state.players[0].board = createEmptyBoard(state.size);
    state.players[1].board = createEmptyBoard(state.size);
    state.players[0].ships = [];
    state.players[1].ships = [];
    state.players[0].hits = state.players[0].misses = state.players[0].sunk = 0;
    state.players[1].hits = state.players[1].misses = state.players[1].sunk = 0;

    state.placement.placedShips = [];
    state.placement.draggedShipIndex = null;
    state.placement.draggedShipLen = null;
    state.placement.draggedShipName = null;
    state.placement.orientation = 'horizontal';
    state.placement.previewCells = [];
    state.placement.validDropTarget = null;

    renderBoard(els.myBoard, state.players[0].board, true, []);
    renderFleet();
    updatePlacementStatus();
    haptic();
  }

  function resetGame(keepModeAndSize) {
    state.phase = keepModeAndSize ? 'placement' : 'mode';
    state.currentPlayer = 1;
    state.gameOver = false;
    state.winner = null;
    state.aiHuntMode = false;
    state.aiLastHits = [];

    if (!keepModeAndSize) {
      state.mode = null;
      state.boardSize = null;
      show(els.modeSelection);
      hide(els.sizeSelection);
      hide(els.placementPhase);
      hide(els.gamePhase);
      els.gameStatus.textContent = 'Spielmodus wählen';
    } else {
      state.players[0].board = createEmptyBoard(state.size);
      state.players[1].board = createEmptyBoard(state.size);
      state.players[0].ships = [];
      state.players[1].ships = [];
      state.players[0].hits = state.players[0].misses = state.players[0].sunk = 0;
      state.players[1].hits = state.players[1].misses = state.players[1].sunk = 0;

      state.placement.placedShips = [];
      state.placement.draggedShipIndex = null;
      state.placement.draggedShipLen = null;
      state.placement.draggedShipName = null;
      state.placement.orientation = 'horizontal';
      state.placement.previewCells = [];
      state.placement.validDropTarget = null;

      hide(els.gamePhase);
      show(els.placementPhase);
      renderBoard(els.myBoard, state.players[0].board, true, []);
      renderFleet();
      els.placementText.textContent = 'Spieler 1: Schiffe platzieren';
      updatePlacementStatus();
    }
    haptic();
  }

  // ===== INIT =====
  function init() {
    initEvents();
    const savedTheme = localStorage.getItem('pe1-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();