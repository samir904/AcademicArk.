import { captureConsoleLog } from '../services/logCapture.service.js';

/**
 * Safely convert args to string
 * Handles objects, arrays, primitives, etc.
 */
const argsToString = (args) => {
  return args.map(arg => {
    try {
      // If it's a string, return as is
      if (typeof arg === 'string') {
        return arg;
      }
      // If it's an object, stringify it
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg);
      }
      // For primitives (numbers, booleans, etc.)
      return String(arg);
    } catch (error) {
      return '[Unable to convert]';
    }
  }).join(' ');
};

/**
 * Override console methods to capture logs
 */
export const initConsoleLogger = () => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  console.log = function (...args) {
    originalLog.apply(console, args);
    captureConsoleLog('log', argsToString(args), args).catch(error => {
      originalError('[CONSOLE_LOGGER] Error:', error);
    });
  };

  console.info = function (...args) {
    originalInfo.apply(console, args);
    captureConsoleLog('info', argsToString(args), args).catch(error => {
      originalError('[CONSOLE_LOGGER] Error:', error);
    });
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);
    captureConsoleLog('warn', argsToString(args), args).catch(error => {
      originalError('[CONSOLE_LOGGER] Error:', error);
    });
  };

  console.error = function (...args) {
    originalError.apply(console, args);
    captureConsoleLog('error', argsToString(args), args).catch(error => {
      originalError('[CONSOLE_LOGGER] Error:', error);
    });
  };

  console.debug = function (...args) {
    originalDebug.apply(console, args);
    captureConsoleLog('debug', argsToString(args), args).catch(error => {
      originalError('[CONSOLE_LOGGER] Error:', error);
    });
  };
};

export default initConsoleLogger;
