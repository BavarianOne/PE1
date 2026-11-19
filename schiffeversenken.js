/**
 * Schiffe Versenken — PE1
 * 2-Spieler (Pass & Play) oder gegen KI
 * Touch-first, Offline-fähig, Framer Design System
 */

(function() {
  'use strict';

  // ===== CONFIG =====
  const BOARD_SIZES = {
    small:  { size: 6, ships: [3, 2, 2], name: '6×6' },
    medium: { size: 8, ships: [4, 3, 3, 2, 2], name: '8×8' },
    large:  { size: 10, ships: [5, 4, 3, 3, 2], name: '10×10' }
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
    mode: null,           // 'pvp' | 'ai'
    boardSize: null,      // 'small' | 'medium' | 'large'
    size: 6,
    ships: [],
    phase: 'mode',        // 'mode' | 'size' | 'placement' | 'game' | 'ended'
    currentPlayer: 1,     // 1 or 2
    players: [
      { board: [], ships: [], hits: 0, misses: 0, sunk: 0 },
      { board: [], ships: [], hits: 0, misses: 0, sunk: 0 }
    ],
    placement: {
      shipIndex: 0,
      cells: [],
      orientation: 'horizontal', // 'horizontal' | 'vertical'
      confirmed: []
    },
    aiDifficulty: 'medium', // 'easy' | 'medium' | 'hard'
    aiLastHits: [],
    aiHuntMode: false,
    gameOver: false,
    winner: null
  };

  // ===== DOM ELEMENTS =====
  const els = {
    // Sections
    modeSelection: document.getElementById('modeSelection'),
    sizeSelection: document.getElementById('sizeSelection'),
    placementPhase: document.getElementById('placementPhase'),
    gamePhase: document.getElementById('gamePhase'),

    // Mode
    modePvP: document.getElementById('modePvP'),
    modeAI: document.getElementById('modeAI'),
    modeBadge: document.getElementById('modeBadge'),

    // Size
    sizeOptions: document.querySelectorAll('.size-option'),
    sizeStatus: document.getElementById('sizeStatus'),

    // Placement
    myBoard: document.getElementById('myBoard'),
    myBoardLabel: document.getElementById('myBoardLabel'),
    fleetList: document.getElementById('fleetList'),
    placementIndicator: document.getElementById('placementIndicator'),
    placementDot: document.getElementById('placementDot'),
    placementText: document.getElementById('placementText'),
    placementStatus: document.getElementById('placementStatus'),
    rotateBtn: document.getElementById('rotateBtn'),
    confirmPlacementBtn: document.getElementById('confirmPlacementBtn'),

    // Game
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

    // Modals
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

    // Global
    gameStatus: document.getElementById('gameStatus')
  };

  // ===== UTILITIES =====
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function toggle(el, force) { el.classList.toggle('hidden', force); }

  function haptic() {
    if (navigator.vibrate) navigator.vibrate(10);
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

  function canPlaceShip(board, shipLen, r, c, orientation) {
    const size = board.length;
    const dr = orientation === 'horizontal' ? 0 : 1;
    const dc = orientation === 'horizontal' ? 1 : 0;

    // Check bounds
    const endR = r + dr * (shipLen - 1);
    const endC = c + dc * (shipLen - 1);
    if (endR >= size || endC >= size) return false;

    // Check overlap and adjacency (no touching ships)
    for (let i = 0; i < shipLen; i++) {
      const cr = r + dr * i;
      const cc = c + dc * i;
      if (board[cr][cc] !== CELL_STATES.EMPTY) return false;
      // Check all 8 neighbors
      for (let nr = cr - 1; nr <= cr + 1; nr++) {
        for (let nc = cc - 1; nc <= cc + 1; nc++) {
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (board[nr][nc] === CELL_STATES.SHIP) return false;
          }
        }
      }
    }
    return true;
  }

  function placeShip(board, shipLen, r, c, orientation, shipId) {
    const dr = orientation === 'horizontal' ? 0 : 1;
    const dc = orientation === 'horizontal' ? 1 : 0;
    const cells = [];
    for (let i = 0; i < shipLen; i++) {
      const cr = r + dr * i;
      const cc = c + dc * i;
      board[cr][cc] = CELL_STATES.SHIP;
      cells.push({ r: cr, c: cc });
    }
    return { id: shipId, cells, length: shipLen, hits: 0, sunk: false };
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
    const { ships, confirmed } = state.placement;
    const currentShipLen = ships[state.placement.shipIndex];
    els.fleetList.innerHTML = '';

    ships.forEach((len, i) => {
      const shipEl = document.createElement('div');
      shipEl.className = 'fleet-ship';
      if (i < confirmed.length) {
        shipEl.classList.add('placed');
      } else if (i === state.placement.shipIndex) {
        shipEl.classList.add('current');
      }

      const cellsHtml = Array.from({ length: len }, (_, idx) =>
        `<span class="ship-cell${idx < len ? ' filled' : ''}"></span>`
      ).join('');

      shipEl.innerHTML = `
        <span class="ship-cells">${cellsHtml}</span>
        <span>${len}</span>
      `;
      els.fleetList.appendChild(shipEl);
    });
  }

  function updatePlacementPreview() {
    const { cells, orientation, shipIndex, confirmed } = state.placement;
    const shipLen = state.ships[shipIndex];
    const board = state.players[state.currentPlayer - 1].board;

    // Clear previous preview
    $$('.cell.preview', els.myBoard).forEach(c => c.classList.remove('preview', 'invalid'));

    if (cells.length === 0) return;

    const valid = canPlaceShip(board, shipLen, cells[0].r, cells[0].c, orientation);
    cells.forEach(({ r, c }) => {
      const cell = getCell(els.myBoard, r, c);
      if (cell) {
        cell.classList.add('preview');
        if (!valid) cell.classList.add('invalid');
      }
    });

    els.confirmPlacementBtn.disabled = !valid || cells.length !== shipLen;
  }

  function renderGameBoards() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    // My board - always show ships
    renderBoard(els.myBoardGame, p1.board, true, p1.ships);

    // Opponent board - hide ships unless hit/sunk
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

  // ===== PLACEMENT LOGIC =====
  function handlePlacementCellClick(cell) {
    if (state.phase !== 'placement') return;
    const { r, c } = coordsFromCell(cell);
    const { shipIndex, cells, orientation, confirmed } = state.placement;
    const shipLen = state.ships[shipIndex];

    // If we already have cells, check if clicking same cell to cancel
    if (cells.length > 0) {
      const first = cells[0];
      if (first.r === r && first.c === c) {
        // Cancel placement
        state.placement.cells = [];
        state.placement.orientation = 'horizontal';
        updatePlacementPreview();
        els.placementStatus.textContent = 'Tippe ein Feld, dann drehen & bestätigen';
        return;
      }
    }

    // Try to place starting from this cell
    if (canPlaceShip(state.players[state.currentPlayer - 1].board, shipLen, r, c, orientation)) {
      state.placement.cells = [];
      for (let i = 0; i < shipLen; i++) {
        const dr = orientation === 'horizontal' ? 0 : 1;
        const dc = orientation === 'horizontal' ? 1 : 0;
        state.placement.cells.push({ r: r + dr * i, c: c + dc * i });
      }
      updatePlacementPreview();
      els.placementStatus.textContent = `Schiff (${shipLen}) platziert — Drehen oder Bestätigen`;
    } else {
      els.placementStatus.textContent = 'Hier passt das Schiff nicht';
      haptic();
    }
  }

  function rotateShip() {
    if (state.phase !== 'placement' || state.placement.cells.length === 0) return;
    const { cells, orientation } = state.placement;
    const shipLen = state.ships[state.placement.shipIndex];
    const newOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const start = cells[0];

    if (canPlaceShip(state.players[state.currentPlayer - 1].board, shipLen, start.r, start.c, newOrientation)) {
      state.placement.orientation = newOrientation;
      state.placement.cells = [];
      for (let i = 0; i < shipLen; i++) {
        const dr = newOrientation === 'horizontal' ? 0 : 1;
        const dc = newOrientation === 'horizontal' ? 1 : 0;
        state.placement.cells.push({ r: start.r + dr * i, c: start.c + dc * i });
      }
      updatePlacementPreview();
      haptic();
    } else {
      haptic();
    }
  }

  function confirmPlacement() {
    if (state.phase !== 'placement') return;
    const { shipIndex, cells, confirmed } = state.placement;
    const shipLen = state.ships[shipIndex];

    if (cells.length !== shipLen) return;

    const player = state.players[state.currentPlayer - 1];
    const ship = placeShip(player.board, shipLen, cells[0].r, cells[0].c, state.placement.orientation, shipIndex);
    player.ships.push(ship);
    state.placement.confirmed.push(shipIndex);
    state.placement.cells = [];
    state.placement.orientation = 'horizontal';

    // Check if all ships placed
    if (state.placement.confirmed.length === state.ships.length) {
      finishPlacement();
    } else {
      state.placement.shipIndex++;
      renderFleet();
      updatePlacementPreview();
      els.placementStatus.textContent = `Schiff ${state.placement.shipIndex + 1}/${state.ships.length} platzieren`;
    }
  }

  function finishPlacement() {
    const player = state.players[state.currentPlayer - 1];
    renderBoard(els.myBoard, player.board, true, player.ships);
    renderFleet();

    if (state.mode === 'pvp' && state.currentPlayer === 1) {
      // Switch to player 2 placement
      showSwitchModal(2);
    } else {
      // Both placed (or AI) -> start game
      startGame();
    }
  }

  function showSwitchModal(nextPlayer) {
    els.switchTitle.textContent = `Spieler ${nextPlayer} ist dran`;
    els.switchMessage.textContent = `Gerät an Spieler ${nextPlayer} übergeben — Schiffe platzieren.`;
    els.continueBtn.onclick = () => {
      hide(els.switchModal);
      state.currentPlayer = nextPlayer;
      state.placement.shipIndex = 0;
      state.placement.confirmed = [];
      state.placement.cells = [];
      state.placement.orientation = 'horizontal';
      els.placementText.textContent = `Spieler ${nextPlayer}: Schiffe platzieren`;
      els.placementDot.classList.toggle('active', nextPlayer === 1);
      els.placementText.classList.toggle('active', nextPlayer === 1);
      els.myBoardLabel.textContent = `Spieler ${nextPlayer}`;
      renderBoard(els.myBoard, state.players[nextPlayer - 1].board, true, state.players[nextPlayer - 1].ships);
      renderFleet();
      updatePlacementPreview();
      els.placementStatus.textContent = 'Tippe ein Feld, dann drehen & bestätigen';
    };
    show(els.switchModal);
  }

  // ===== GAME LOGIC =====
  function startGame() {
    state.phase = 'game';
    state.currentPlayer = 1;
    state.gameOver = false;
    state.winner = null;

    // AI places ships randomly
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
          const ship = placeShip(ai.board, len, r, c, orientation, idx);
          ai.ships.push(ship);
          placed = true;
        }
        attempts++;
      }
    });
  }

  function handleGameCellClick(cell) {
    if (state.phase !== 'game' || state.gameOver) return;
    if (state.mode === 'ai' && state.currentPlayer === 2) return; // AI's turn

    const boardType = cell.dataset.board;
    if (boardType !== 'opponentBoard') return; // Can only attack opponent

    const { r, c } = coordsFromCell(cell);
    const targetPlayer = state.currentPlayer === 1 ? 1 : 0; // 1 attacks player 2 (index 1), 2 attacks player 1 (index 0)
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
    let ship = null;

    if (val === CELL_STATES.SHIP) {
      // Hit
      target.board[r][c] = CELL_STATES.HIT;
      attacker.hits++;
      hit = true;

      ship = getShipAt(target.board, target.ships, r, c);
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
      // Miss
      target.board[r][c] = CELL_STATES.MISS;
      attacker.misses++;
    }

    renderGameBoards();
    updateStats();

    // Check win
    if (allShipsSunk(target.ships)) {
      endGame(state.currentPlayer);
      return;
    }

    if (hit) {
      els.turnStatus.textContent = sunk ? 'Treffer & Versenkt! Nochmal!' : 'Treffer! Nochmal!';
      els.turnStatus.classList.add('active');
      // Same player goes again
      setTimeout(() => updateTurnUI(), 500);
    } else {
      els.turnStatus.textContent = 'Wasser! Gegner ist dran.';
      els.turnStatus.classList.remove('active');
      // Switch turn
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
      updateTurnUI();

      // AI turn
      if (state.mode === 'ai' && state.currentPlayer === 2) {
        setTimeout(aiTurn, 800 + Math.random() * 600);
      }
    }
  }

  // ===== AI LOGIC =====
  function aiTurn() {
    if (state.gameOver || state.currentPlayer !== 2) return;

    const target = state.players[0]; // Human is player 0
    let r, c;

    if (state.aiHuntMode && state.aiLastHits.length > 0) {
      // Target mode: shoot around last hit
      const candidates = getTargetCandidates(target.board);
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        r = pick.r; c = pick.c;
      } else {
        // Fallback to hunt
        state.aiHuntMode = false;
        state.aiLastHits = [];
        const hunt = getHuntCandidates(target.board);
        const pick = hunt[Math.floor(Math.random() * hunt.length)];
        r = pick.r; c = pick.c;
      }
    } else {
      // Hunt mode: parity-based search
      const hunt = getHuntCandidates(target.board);
      if (hunt.length === 0) {
        // No valid moves (shouldn't happen)
        endGame(1);
        return;
      }
      const pick = hunt[Math.floor(Math.random() * hunt.length)];
      r = pick.r; c = pick.c;
    }

    processAttack(0, r, c);
  }

  function getHuntCandidates(board) {
    const size = board.length;
    const candidates = [];
    // Use parity strategy (checkerboard) for efficiency
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === CELL_STATES.EMPTY && (r + c) % 2 === 0) {
          candidates.push({ r, c });
        }
      }
    }
    // If parity exhausted, add remaining
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

    state.aiLastHits.forEach(hit => {
      directions.forEach(([dr, dc]) => {
        let nr = hit.r + dr;
        let nc = hit.c + dc;
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (board[nr][nc] === CELL_STATES.EMPTY) {
            candidates.push({ r: nr, c: nc });
            break; // Only adjacent empty cells
          }
          if (board[nr][nc] === CELL_STATES.HIT) {
            nr += dr; nc += dc;
            continue;
          }
          break;
        }
      });
    });

    // Deduplicate
    const seen = new Set();
    return candidates.filter(({r,c}) => {
      const key = `${r},${c}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

    // Placement
    els.myBoard.addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (cell) handlePlacementCellClick(cell);
    });
    els.rotateBtn.addEventListener('click', rotateShip);
    els.confirmPlacementBtn.addEventListener('click', confirmPlacement);

    // Game
    els.opponentBoard.addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (cell) handleGameCellClick(cell);
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

    // Keyboard support for rotation
    document.addEventListener('keydown', e => {
      if (e.key === 'r' || e.key === 'R') rotateShip();
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

    hide(els.sizeSelection);
    show(els.placementPhase);

    // Init boards
    state.players[0].board = createEmptyBoard(state.size);
    state.players[1].board = createEmptyBoard(state.size);
    state.players[0].ships = [];
    state.players[1].ships = [];
    state.players[0].hits = state.players[0].misses = state.players[0].sunk = 0;
    state.players[1].hits = state.players[1].misses = state.players[1].sunk = 0;

    state.placement.shipIndex = 0;
    state.placement.confirmed = [];
    state.placement.cells = [];
    state.placement.orientation = 'horizontal';

    renderBoard(els.myBoard, state.players[0].board, true, []);
    renderFleet();
    updatePlacementPreview();
    els.placementStatus.textContent = 'Tippe ein Feld, dann drehen & bestätigen';
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
      // Re-init boards
      state.players[0].board = createEmptyBoard(state.size);
      state.players[1].board = createEmptyBoard(state.size);
      state.players[0].ships = [];
      state.players[1].ships = [];
      state.players[0].hits = state.players[0].misses = state.players[0].sunk = 0;
      state.players[1].hits = state.players[1].misses = state.players[1].sunk = 0;

      state.placement.shipIndex = 0;
      state.placement.confirmed = [];
      state.placement.cells = [];
      state.placement.orientation = 'horizontal';

      hide(els.gamePhase);
      show(els.placementPhase);
      renderBoard(els.myBoard, state.players[0].board, true, []);
      renderFleet();
      updatePlacementPreview();
      els.placementText.textContent = 'Spieler 1: Schiffe platzieren';
      els.placementStatus.textContent = 'Tippe ein Feld, dann drehen & bestätigen';
    }
    haptic();
  }

  // ===== INIT =====
  function init() {
    initEvents();
    // Ensure theme is applied
    const savedTheme = localStorage.getItem('pe1-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();