/**
 * Unit tests for logger buffering behavior
 * Verifies messages are buffered until setVerbosity() configures the logger
 */

/**
 * Create a fresh Logger instance for testing by resetting the singleton's state
 */
function createLogger() {
  const logger = window.VSC.logger;
  // Reset to pre-configured state
  logger.verbosity = 3;
  logger.defaultLevel = 4;
  logger.contextStack = [];
  logger._buffer = [];
  logger._ready = false;
  return logger;
}

/** Capture console.log calls */
function captureConsole() {
  const calls = [];
  const originalLog = console.log;
  const originalTrace = console.trace;
  console.log = (...args) => calls.push(args.join(' '));
  console.trace = () => {}; // suppress trace noise in tests
  return {
    calls,
    restore: () => {
      console.log = originalLog;
      console.trace = originalTrace;
    },
  };
}

describe('Logger', () => {
  // Lazy — window.VSC is populated by vitest-setup.js beforeAll
  const LOG_LEVELS = () => window.VSC.Constants.LOG_LEVELS;

  let capture;

  afterEach(() => {
    if (capture) {
      capture.restore();
      capture = null;
    }
  });

  it('logger buffers messages before setVerbosity is called', () => {
    const logger = createLogger();
    logger.log('early message', LOG_LEVELS().INFO);
    logger.log('another early', LOG_LEVELS().ERROR);

    expect(logger._buffer.length).toBe(2);
    expect(logger._ready).toBe(false);
  });

  it('setVerbosity flushes buffered messages that pass the filter', () => {
    const logger = createLogger();
    capture = captureConsole();

    // Buffer: one INFO (level 4) and one ERROR (level 2)
    logger.log('info msg', LOG_LEVELS().INFO);
    logger.log('error msg', LOG_LEVELS().ERROR);

    expect(capture.calls.length).toBe(0);

    // Set verbosity to WARNING (3) — should emit ERROR but not INFO
    logger.setVerbosity(LOG_LEVELS().WARNING);

    expect(logger._ready).toBe(true);
    expect(logger._buffer.length).toBe(0);
    expect(capture.calls.length).toBe(1);
    expect(capture.calls[0]).toContain('error msg');
  });

  it('setVerbosity flushes all messages when verbosity is high', () => {
    const logger = createLogger();
    capture = captureConsole();

    logger.log('debug msg', LOG_LEVELS().DEBUG);
    logger.log('info msg', LOG_LEVELS().INFO);
    logger.log('error msg', LOG_LEVELS().ERROR);

    logger.setVerbosity(LOG_LEVELS().DEBUG);

    expect(capture.calls.length).toBe(3);
  });

  it('after setVerbosity, messages emit immediately (no buffering)', () => {
    const logger = createLogger();
    capture = captureConsole();

    logger.setVerbosity(LOG_LEVELS().INFO);

    logger.log('direct message', LOG_LEVELS().INFO);
    expect(capture.calls.length).toBe(1);
    expect(logger._buffer.length).toBe(0);
  });

  it('subsequent setVerbosity calls do not re-flush', () => {
    const logger = createLogger();
    capture = captureConsole();

    logger.log('buffered', LOG_LEVELS().ERROR);
    logger.setVerbosity(LOG_LEVELS().WARNING); // first call — flushes

    const countAfterFirst = capture.calls.length;
    logger.setVerbosity(LOG_LEVELS().DEBUG); // second call — should NOT re-flush

    expect(capture.calls.length).toBe(countAfterFirst);
  });

  it('convenience methods (error, warn, info, debug) buffer correctly', () => {
    const logger = createLogger();

    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');

    expect(logger._buffer.length).toBe(4);
    expect(logger._buffer[0].level).toBe(LOG_LEVELS().ERROR);
    expect(logger._buffer[1].level).toBe(LOG_LEVELS().WARNING);
    expect(logger._buffer[2].level).toBe(LOG_LEVELS().INFO);
    expect(logger._buffer[3].level).toBe(LOG_LEVELS().DEBUG);
  });
});
