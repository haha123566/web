(function () {
  "use strict";

  var displayEl = document.getElementById("display");
  var expressionEl = document.getElementById("expression");
  var keysEl = document.getElementById("keys");

  var current = "0";
  var previous = null;
  var operator = null;
  var overwrite = true;

  var symbols = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷"
  };

  function formatNumber(value) {
    if (!isFinite(value)) return "错误";
    var text = String(parseFloat(value.toPrecision(12)));
    if (text.replace("-", "").replace(".", "").length > 12) {
      return value.toExponential(6);
    }
    return text;
  }

  function render(expressionText) {
    displayEl.textContent = current;
    if (expressionText !== undefined) {
      expressionEl.textContent = expressionText;
      return;
    }
    if (operator !== null && previous !== null) {
      expressionEl.textContent = formatNumber(previous) + " " + symbols[operator];
    } else {
      expressionEl.textContent = "";
    }
  }

  function calculate(left, op, right) {
    if (op === "+") return left + right;
    if (op === "-") return left - right;
    if (op === "*") return left * right;
    if (op === "/") return right === 0 ? NaN : left / right;
    return right;
  }

  function inputDigit(digit) {
    if (current === "错误") clearAll();
    if (overwrite) {
      current = digit;
      overwrite = false;
    } else if (current === "0") {
      current = digit;
    } else if (current.replace("-", "").replace(".", "").length >= 12) {
      return;
    } else {
      current += digit;
    }
    render();
  }

  function inputDot() {
    if (current === "错误") clearAll();
    if (overwrite) {
      current = "0.";
      overwrite = false;
    } else if (current.indexOf(".") === -1) {
      current += ".";
    }
    render();
  }

  function setOperator(nextOperator) {
    if (current === "错误") return;
    var value = parseFloat(current);

    if (operator !== null && previous !== null && !overwrite) {
      var result = calculate(previous, operator, value);
      if (!isFinite(result)) {
        showError();
        return;
      }
      previous = result;
      current = formatNumber(result);
    } else {
      previous = value;
    }

    operator = nextOperator;
    overwrite = true;
    render();
  }

  function equals() {
    if (operator === null || previous === null || current === "错误") return;
    var value = parseFloat(current);
    var result = calculate(previous, operator, value);
    var expressionText =
      formatNumber(previous) + " " + symbols[operator] + " " + formatNumber(value) + " =";

    if (!isFinite(result)) {
      current = "错误";
    } else {
      current = formatNumber(result);
    }
    previous = null;
    operator = null;
    overwrite = true;
    render(expressionText);
  }

  function showError() {
    current = "错误";
    previous = null;
    operator = null;
    overwrite = true;
    render("不能除以 0");
  }

  function clearAll() {
    current = "0";
    previous = null;
    operator = null;
    overwrite = true;
    render();
  }

  function backspace() {
    if (overwrite || current === "错误") {
      current = "0";
      overwrite = true;
    } else if (current.length <= 1 || (current.length === 2 && current.charAt(0) === "-")) {
      current = "0";
      overwrite = true;
    } else {
      current = current.slice(0, -1);
    }
    render();
  }

  function toggleSign() {
    if (current === "错误" || current === "0" || current === "0.") return;
    current = current.charAt(0) === "-" ? current.slice(1) : "-" + current;
    overwrite = false;
    render();
  }

  function handleAction(action, value) {
    if (action === "digit") inputDigit(value);
    else if (action === "dot") inputDot();
    else if (action === "op") setOperator(value);
    else if (action === "eq") equals();
    else if (action === "clear") clearAll();
    else if (action === "back") backspace();
    else if (action === "sign") toggleSign();
  }

  keysEl.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    handleAction(button.getAttribute("data-action"), button.getAttribute("data-value"));
  });

  document.addEventListener("keydown", function (event) {
    var key = event.key;
    if (key >= "0" && key <= "9") {
      inputDigit(key);
    } else if (key === ".") {
      inputDot();
    } else if (key === "+" || key === "-" || key === "*" || key === "/") {
      setOperator(key);
    } else if (key === "Enter" || key === "=") {
      event.preventDefault();
      equals();
    } else if (key === "Escape") {
      clearAll();
    } else if (key === "Backspace") {
      backspace();
    }
  });

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  render();
})();
