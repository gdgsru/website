/* GDG SRU - tiny QR code generator (byte mode, error correction M, versions 1-10 => up to 213 bytes).
   No dependencies, no network. Usage:
     GDGQR.svg("https://gdgsru.pages.dev/verify?u=alex", { dark: "#202124", light: "#fff" })  -> "<svg ...>"
     GDGQR.matrix(text) -> boolean[][]  (true = dark module, no quiet zone)
*/
(function () {
  "use strict";

  // ECC level M tables, index = version (1..10).
  var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var MAX_VERSION = 10;

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  function utf8Bytes(str) {
    return Array.prototype.slice.call(new TextEncoder().encode(str));
  }

  // ---- Reed-Solomon over GF(256), polynomial 0x11D --------------------------------------
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var k = 0; k < degree; k++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function encodeData(bytes, ver) {
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(0x4, 4);                         // byte mode
    push(bytes.length, ver >= 10 ? 16 : 8);
    bytes.forEach(function (b) { push(b, 8); });
    var cap = dataCodewords(ver) * 8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
    var out = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      out.push(v);
    }
    return out;
  }

  function addEccAndInterleave(data, ver) {
    var nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    var rawCw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - (rawCw % nb);
    var shortLen = Math.floor(rawCw / nb);
    var blocks = [], divisor = rsDivisor(eccLen);
    for (var i = 0, k = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0); // placeholder so all blocks line up for interleaving
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var col = 0; col < blocks[0].length; col++) {
      blocks.forEach(function (blk, idx) {
        if (col !== shortLen - eccLen || idx >= numShort) result.push(blk[col]);
      });
    }
    return result;
  }

  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var size = ver * 4 + 17;
    var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var res = [6];
    for (var pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function build(bytes) {
    var ver = 1;
    for (; ver <= MAX_VERSION; ver++) {
      var capBits = dataCodewords(ver) * 8;
      if (4 + (ver >= 10 ? 16 : 8) + bytes.length * 8 <= capBits) break;
    }
    if (ver > MAX_VERSION) throw new Error("QR payload too long");

    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (var y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setFn(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
    function align(cx, cy) {
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function drawFormat(mask) {
      var data = (0 << 3) | mask;                // ECC level M has format bits 00
      var rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      var i2;
      for (i2 = 0; i2 <= 5; i2++) setFn(8, i2, getBit(bits, i2));
      setFn(8, 7, getBit(bits, 6)); setFn(8, 8, getBit(bits, 7)); setFn(7, 8, getBit(bits, 8));
      for (i2 = 9; i2 < 15; i2++) setFn(14 - i2, 8, getBit(bits, i2));
      for (i2 = 0; i2 < 8; i2++) setFn(size - 1 - i2, 8, getBit(bits, i2));
      for (i2 = 8; i2 < 15; i2++) setFn(8, size - 15 + i2, getBit(bits, i2));
      setFn(8, size - 8, true);
    }
    function drawVersion() {
      if (ver < 7) return;
      var rem = ver;
      for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      var bits = (ver << 12) | rem;
      for (var j = 0; j < 18; j++) {
        var c = getBit(bits, j), a = size - 11 + (j % 3), b = Math.floor(j / 3);
        setFn(a, b, c); setFn(b, a, c);
      }
    }

    for (var i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPositions(ver), n = ap.length;
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === n - 1) || (a === n - 1 && b === 0)) continue;
      align(ap[a], ap[b]);
    }
    drawFormat(0); drawVersion();

    var cw = addEccAndInterleave(encodeData(bytes, ver), ver);
    var k = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, yy = upward ? size - 1 - vert : vert;
          if (!fn[yy][x] && k < cw.length * 8) { mod[yy][x] = getBit(cw[k >>> 3], 7 - (k & 7)); k++; }
        }
      }
    }

    function maskFn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
        case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
        default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
      }
    }
    function applyMask(m) {
      for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++)
        if (!fn[y2][x2] && maskFn(m, x2, y2)) mod[y2][x2] = !mod[y2][x2];
    }
    function penalty() {
      var score = 0, dark = 0, lines = [];
      var rows = [], cols = [];
      for (var y3 = 0; y3 < size; y3++) {
        var r = "", c = "";
        for (var x3 = 0; x3 < size; x3++) { r += mod[y3][x3] ? "1" : "0"; c += mod[x3][y3] ? "1" : "0"; if (mod[y3][x3]) dark++; }
        rows.push(r); cols.push(c);
      }
      lines = rows.concat(cols);
      lines.forEach(function (s) {
        var m1 = s.match(/0{5,}|1{5,}/g) || [];
        m1.forEach(function (run) { score += 3 + run.length - 5; });
        var m3 = s.match(/(?=(10111010000|00001011101))/g) || [];
        score += m3.length * 40;
      });
      for (var y4 = 0; y4 < size - 1; y4++) for (var x4 = 0; x4 < size - 1; x4++) {
        var v = mod[y4][x4];
        if (v === mod[y4][x4 + 1] && v === mod[y4 + 1][x4] && v === mod[y4 + 1][x4 + 1]) score += 3;
      }
      var total = size * size;
      score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return score;
    }

    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var p = penalty();
      if (p < bestScore) { bestScore = p; best = m; }
      applyMask(m); // undo (XOR is its own inverse)
    }
    applyMask(best); drawFormat(best);
    return mod;
  }

  function matrix(text) { return build(utf8Bytes(String(text))); }

  function svg(text, opts) {
    opts = opts || {};
    var dark = opts.dark || "#000", light = opts.light || "#fff", border = opts.border == null ? 4 : opts.border;
    var m = matrix(text), n = m.length, total = n + border * 2, d = "";
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (!m[y][x]) { x++; continue; }
        var start = x;
        while (x < n && m[y][x]) x++;
        d += "M" + (start + border) + " " + (y + border) + "h" + (x - start) + "v1h-" + (x - start) + "z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="' + light +
      '"/><path d="' + d + '" fill="' + dark + '"/></svg>';
  }

  window.GDGQR = { matrix: matrix, svg: svg };
})();
