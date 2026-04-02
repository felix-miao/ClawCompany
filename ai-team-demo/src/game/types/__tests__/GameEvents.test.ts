import { parseSSEMessage, parseGameEvent, AGENT_ROLE_MAP, ROLE_TO_ROOM } from '../../types/GameEvents';

describe('parseSSEMessage', () => {
  it('should parse basic SSE message', () => {
    const result = parseSSEMessage('data: hello world\n\n');
    expect(result).toEqual({
      event: 'message',
      data: 'hello world',
      id: undefined,
    });
  });

  it('should parse SSE message with event type', () => {
    const result = parseSSEMessage('event: agent:status-change\ndata: {"status":"busy"}\n\n');
    expect(result).toEqual({
      event: 'agent:status-change',
      data: '{"status":"busy"}',
      id: undefined,
    });
  });

  it('should parse SSE message with id', () => {
    const result = parseSSEMessage('id: 123\ndata: test\n\n');
    expect(result).toEqual({
      event: 'message',
      data: 'test',
      id: '123',
    });
  });

  it('should parse multiline data', () => {
    const result = parseSSEMessage('data: line1\ndata: line2\n\n');
    expect(result).toEqual({
      event: 'message',
      data: 'line1\nline2',
      id: undefined,
    });
  });

  it('should return null for empty data', () => {
    const result = parseSSEMessage('event: test\n\n');
    expect(result).toBeNull();
  });

  it('should return null for empty input', () => {
    const result = parseSSEMessage('');
    expect(result).toBeNull();
  });
});

describe('parseGameEvent', () => {
  it('should parse valid agent status event', () => {
    const data = JSON.stringify({
      type: 'agent:status-change',
      agentId: 'dev1',
      status: 'busy',
      timestamp: 1000,
    });

    const result = parseGameEvent(data);
    expect(result).toEqual({
      type: 'agent:status-change',
      agentId: 'dev1',
      status: 'busy',
      timestamp: 1000,
    });
  });

  it('should add timestamp if missing', () => {
    const data = JSON.stringify({
      type: 'agent:status-change',
      agentId: 'dev1',
      status: 'busy',
    });

    const result = parseGameEvent(data);
    expect(result).not.toBeNull();
    expect(result!.timestamp).toBeGreaterThan(0);
  });

  it('should return null for invalid JSON', () => {
    expect(parseGameEvent('not json')).toBeNull();
  });

  it('should return null for missing type', () => {
    expect(parseGameEvent('{"agentId":"dev1"}')).toBeNull();
  });

  it('should return null for non-object', () => {
    expect(parseGameEvent('"hello"')).toBeNull();
  });

  it('should return null for null', () => {
    expect(parseGameEvent('null')).toBeNull();
  });
});

describe('AGENT_ROLE_MAP', () => {
  it('should map developer to dev1', () => {
    expect(AGENT_ROLE_MAP.developer).toBe('dev1');
  });

  it('should map pm to pm', () => {
    expect(AGENT_ROLE_MAP.pm).toBe('pm');
  });

  it('should map tester to dev2', () => {
    expect(AGENT_ROLE_MAP.tester).toBe('dev2');
  });

  it('should map reviewer to reviewer', () => {
    expect(AGENT_ROLE_MAP.reviewer).toBe('reviewer');
  });
});

describe('ROLE_TO_ROOM', () => {
  it('should map pm to pm-office', () => {
    expect(ROLE_TO_ROOM.pm).toBe('pm-office');
  });

  it('should map dev1 to dev-studio', () => {
    expect(ROLE_TO_ROOM.dev1).toBe('dev-studio');
  });

  it('should map reviewer to review-center', () => {
    expect(ROLE_TO_ROOM.reviewer).toBe('review-center');
  });
});
