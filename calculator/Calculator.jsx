import React, { useState } from 'react';

const Calculator = () => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operator);
      setPreviousValue(newValue);
      setDisplay(String(newValue));
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (left, right, op) => {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return right !== 0 ? left / right : 0;
      default: return right;
    }
  };

  const handleEquals = () => {
    if (!operator || previousValue === null) return;
    
    const inputValue = parseFloat(display);
    const result = calculate(previousValue, inputValue, operator);
    
    setDisplay(String(result));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handlePercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const handleToggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(value * -1));
  };

  const Button = ({ children, onClick, className = '', variant = 'default' }) => {
    const baseStyles = 'flex items-center justify-center text-2xl font-semibold rounded-2xl transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl';
    
    const variants = {
      default: 'bg-gray-700 hover:bg-gray-600 text-white',
      operator: 'bg-orange-500 hover:bg-orange-400 text-white',
      function: 'bg-gray-400 hover:bg-gray-300 text-gray-900',
      equals: 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white',
    };

    return (
      <button
        onClick={onClick}
        className={`${baseStyles} ${variants[variant]} ${className}`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Calculator Container */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-gray-700/50">
          
          {/* Display */}
          <div className="mb-6">
            <div className="bg-gray-900/80 rounded-2xl p-6 shadow-inner border border-gray-700/30">
              {/* Previous operation */}
              <div className="text-gray-400 text-sm h-6 text-right font-medium truncate">
                {previousValue !== null && operator ? `${previousValue} ${operator}` : ''}
              </div>
              {/* Current display */}
              <div className="text-white text-5xl font-bold text-right truncate tracking-tight">
                {display.length > 12 ? parseFloat(display).toExponential(6) : display}
              </div>
            </div>
          </div>

          {/* Button Grid */}
          <div className="grid grid-cols-4 gap-3">
            {/* Row 1 */}
            <Button onClick={clear} variant="function">C</Button>
            <Button onClick={handleToggleSign} variant="function">±</Button>
            <Button onClick={handlePercent} variant="function">%</Button>
            <Button onClick={() => performOperation('/')} variant="operator">÷</Button>

            {/* Row 2 */}
            <Button onClick={() => inputDigit('7')}>7</Button>
            <Button onClick={() => inputDigit('8')}>8</Button>
            <Button onClick={() => inputDigit('9')}>9</Button>
            <Button onClick={() => performOperation('*')} variant="operator">×</Button>

            {/* Row 3 */}
            <Button onClick={() => inputDigit('4')}>4</Button>
            <Button onClick={() => inputDigit('5')}>5</Button>
            <Button onClick={() => inputDigit('6')}>6</Button>
            <Button onClick={() => performOperation('-')} variant="operator">−</Button>

            {/* Row 4 */}
            <Button onClick={() => inputDigit('1')}>1</Button>
            <Button onClick={() => inputDigit('2')}>2</Button>
            <Button onClick={() => inputDigit('3')}>3</Button>
            <Button onClick={() => performOperation('+')} variant="operator">+</Button>

            {/* Row 5 */}
            <Button onClick={() => inputDigit('0')} className="col-span-2">0</Button>
            <Button onClick={inputDecimal}>.</Button>
            <Button onClick={handleEquals} variant="equals">=</Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>React Calculator ✨</p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
