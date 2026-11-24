(function () {
  "use strict";

  var COLS = 10;
  var ROWS = 20;
  var CELL = 12;
  var LINE_SCORE = [0, 100, 300, 500, 800];

  var COLORS = {
    I: "#3db7c9",
    O: "#e2b15a",
    T: "#9a6bb5",
    S: "#6aa86a",
    Z: "#d4655a",
    J: "#4f7ec4",
    L: "#e08a3c"
  };

  var SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  };

  var root = document.getElementById("tetris");
  var boardCanvas = document.getElementById("tetris-board");
  var nextCanvas = document.getElementById("tetris-next");
  var scoreEl = document.getElementById("tetris-score");
  var linesEl = document.getElementById("tetris-lines");
  var statusEl = document.getElementById("tetris-status");
  var toggleBtn = document.getElementById("tetris-toggle");
  var foldBtn = document.getElementById("tetris-fold");
  var controls = document.getElementById("tetris-controls");

  if (!root || !boardCanvas || !nextCanvas) return;

  var boardCtx = setupCanvas(boardCanvas, COLS * CELL, ROWS * CELL);
  var nextCtx = setupCanvas(nextCanvas, 48, 48);

  var grid = emptyGrid();
  var bag = [];
  var current = null;
  var nextType = null;
  var score = 0;
  var lines = 0;
  var running = false;
  var paused = false;
  var over = false;
  var dropMs = 800;
  var acc = 0;
  var lastTime = 0;
  var rafId = 0;

  function setupCanvas(canvas, cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function emptyGrid() {
    var rows = [];
    for (var y = 0; y < ROWS; y++) {
      var row = [];
      for (var x = 0; x < COLS; x++) row.push(null);
      rows.push(row);
    }
    return rows;
  }

  function cloneMatrix(matrix) {
    return matrix.map(function (row) {
      return row.slice();
    });
  }

  function rotateMatrix(matrix) {
    var size = matrix.length;
    var turned = [];
    for (var y = 0; y < size; y++) {
      turned[y] = [];
      for (var x = 0; x < size; x++) {
        turned[y][x] = matrix[size - 1 - x][y];
      }
    }
    return turned;
  }

  function pullType() {
    if (bag.length === 0) {
      bag = ["I", "O", "T", "S", "Z", "J", "L"];
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var swap = bag[i];
        bag[i] = bag[j];
        bag[j] = swap;
      }
    }
    return bag.pop();
  }

  function spawn(type) {
    var matrix = cloneMatrix(SHAPES[type]);
    return {
      type: type,
      matrix: matrix,
      x: Math.floor((COLS - matrix.length) / 2),
      y: 0
    };
  }

  function hits(piece, ox, oy, matrix) {
    var shape = matrix || piece.matrix;
    var px = piece.x + ox;
    var py = piece.y + oy;
    for (var y = 0; y < shape.length; y++) {
      for (var x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        var bx = px + x;
        var by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && grid[by][bx]) return true;
      }
    }
    return false;
  }

  function merge(piece) {
    var above = false;
    for (var y = 0; y < piece.matrix.length; y++) {
      for (var x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        var by = piece.y + y;
        var bx = piece.x + x;
        if (by < 0) {
          above = true;
          continue;
        }
        if (by < ROWS && bx >= 0 && bx < COLS) grid[by][bx] = piece.type;
      }
    }
    return above;
  }

  function clearLines() {
    var cleared = 0;
    for (var y = ROWS - 1; y >= 0; y--) {
      var full = grid[y].every(function (cell) {
        return cell !== null;
      });
      if (!full) continue;
      var blank = [];
      for (var x = 0; x < COLS; x++) blank.push(null);
      grid.splice(y, 1);
      grid.unshift(blank);
      cleared += 1;
      y += 1;
    }
    if (!cleared) return;
    score += LINE_SCORE[cleared] * (1 + Math.floor(lines / 10));
    lines += cleared;
    dropMs = Math.max(90, Math.round(800 * Math.pow(0.82, Math.floor(lines / 10))));
  }

  function endGame() {
    running = false;
    paused = false;
    over = true;
    statusEl.textContent = "游戏结束";
    toggleBtn.textContent = "再来";
  }

  function lockPiece() {
    var above = merge(current);
    clearLines();
    current = spawn(nextType);
    nextType = pullType();
    updateHud();
    if (above || hits(current, 0, 0)) endGame();
  }

  function tryMove(dx, dy) {
    if (!current || !running || paused) return false;
    if (hits(current, dx, dy)) {
      if (dy > 0 && dx === 0) lockPiece();
      return false;
    }
    current.x += dx;
    current.y += dy;
    return true;
  }

  function rotate() {
    if (!current || !running || paused) return;
    var turned = rotateMatrix(current.matrix);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!hits(current, kicks[i], 0, turned)) {
        current.matrix = turned;
        current.x += kicks[i];
        return;
      }
    }
  }

  function softDrop() {
    if (tryMove(0, 1)) {
      score += 1;
      updateHud();
    }
  }

  function hardDrop() {
    if (!current || !running || paused) return;
    var distance = 0;
    while (!hits(current, 0, 1)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    updateHud();
    lockPiece();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
  }

  function resetGame() {
    grid = emptyGrid();
    bag = [];
    score = 0;
    lines = 0;
    dropMs = 800;
    acc = 0;
    over = false;
    paused = false;
    nextType = pullType();
    current = spawn(pullType());
    updateHud();
  }

  function ensureLoop() {
    if (rafId) return;
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    running = true;
    paused = false;
    over = false;
    lastTime = 0;
    statusEl.textContent = "方向键移动，↑ 旋转";
    toggleBtn.textContent = "暂停";
    root.focus();
    ensureLoop();
    draw();
  }

  function togglePlay() {
    if (over || !running) {
      startGame();
      return;
    }
    paused = !paused;
    toggleBtn.textContent = paused ? "继续" : "暂停";
    statusEl.textContent = paused ? "已暂停" : "方向键移动，↑ 旋转";
    if (!paused) lastTime = 0;
    draw();
  }

  function loop(time) {
    rafId = requestAnimationFrame(loop);
    if (!running || paused) return;
    if (!lastTime) lastTime = time;
    acc += time - lastTime;
    lastTime = time;
    if (acc < dropMs) return;
    acc %= dropMs;
    tryMove(0, 1);
    draw();
  }

  function paintCell(ctx, x, y, size, color, ghost) {
    ctx.save();
    ctx.globalAlpha = ghost ? 0.28 : 1;
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.restore();
  }

  function drawPiece(ctx, piece, originX, originY, cell, ghost) {
    for (var y = 0; y < piece.matrix.length; y++) {
      for (var x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        var py = originY + y;
        if (py < 0) continue;
        paintCell(ctx, originX + x, py, cell, COLORS[piece.type], ghost);
      }
    }
  }

  function draw() {
    boardCtx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    boardCtx.fillStyle = "#26221c";
    boardCtx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x]) paintCell(boardCtx, x, y, CELL, COLORS[grid[y][x]], false);
      }
    }

    if (current && (running || over)) {
      if (running && !paused) {
        var dropY = current.y;
        while (!hits(current, 0, dropY - current.y + 1)) dropY += 1;
        if (dropY !== current.y) {
          drawPiece(boardCtx, current, current.x, dropY, CELL, true);
        }
      }
      drawPiece(boardCtx, current, current.x, current.y, CELL, false);
    }

    nextCtx.clearRect(0, 0, 48, 48);
    nextCtx.fillStyle = "#26221c";
    nextCtx.fillRect(0, 0, 48, 48);
    if (!nextType) return;
    var shape = SHAPES[nextType];
    var size = shape.length > 3 ? 10 : 12;
    var offset = Math.floor((48 - shape.length * size) / 2);
    for (var ny = 0; ny < shape.length; ny++) {
      for (var nx = 0; nx < shape[ny].length; nx++) {
        if (!shape[ny][nx]) continue;
        nextCtx.fillStyle = COLORS[nextType];
        nextCtx.fillRect(offset + nx * size + 1, offset + ny * size + 1, size - 2, size - 2);
      }
    }
  }

  function onKey(event) {
    var key = event.key;
    var playingKey = key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowDown" || key === "ArrowUp" || key === " ";
    if (!playingKey && key !== "p" && key !== "P") return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "p" || key === "P") {
      togglePlay();
      return;
    }
    if (!running || paused) return;
    if (event.repeat && (key === "ArrowUp" || key === " ")) return;
    if (key === "ArrowLeft") tryMove(-1, 0);
    else if (key === "ArrowRight") tryMove(1, 0);
    else if (key === "ArrowDown") softDrop();
    else if (key === "ArrowUp") rotate();
    else hardDrop();
    draw();
  }

  function applyMove(move) {
    if (!running || paused) return;
    if (move === "left") tryMove(-1, 0);
    else if (move === "right") tryMove(1, 0);
    else if (move === "down") softDrop();
    else if (move === "rotate") rotate();
    else if (move === "drop") hardDrop();
    draw();
  }

  root.addEventListener("keydown", onKey);

  toggleBtn.addEventListener("click", function () {
    togglePlay();
    root.focus();
  });

  foldBtn.addEventListener("click", function () {
    var folded = root.classList.toggle("is-folded");
    foldBtn.textContent = folded ? "+" : "–";
    foldBtn.setAttribute("aria-label", folded ? "展开" : "收起");
    if (folded && running && !paused && !over) togglePlay();
  });

  controls.addEventListener("mousedown", function (event) {
    event.preventDefault();
  });

  controls.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    root.focus();
    applyMove(button.getAttribute("data-move"));
  });

  nextType = pullType();
  updateHud();
  draw();

  if (window.matchMedia("(max-width: 480px)").matches) {
    root.classList.add("is-folded");
    foldBtn.textContent = "+";
    foldBtn.setAttribute("aria-label", "展开");
  }
})();
