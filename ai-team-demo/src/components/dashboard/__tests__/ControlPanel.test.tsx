import { render, screen, fireEvent } from '@testing-library/react';
import { ControlPanel } from '../ControlPanel';

describe('ControlPanel', () => {
  const mockOnSendEvent = jest.fn();

  beforeEach(() => {
    mockOnSendEvent.mockClear();
  });

  it('should render control panel title', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render agent selector', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    const select = screen.getByLabelText('Agent');
    expect(select).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    expect(screen.getByText('Set Status')).toBeInTheDocument();
    expect(screen.getByText('Assign Task')).toBeInTheDocument();
    expect(screen.getByText('Change Emotion')).toBeInTheDocument();
  });

  it('should send status change event', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    fireEvent.click(screen.getByText('Set Status'));

    expect(mockOnSendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:status-change',
      })
    );
  });

  it('should send task assigned event', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    const descInput = screen.getByPlaceholderText('Task description');
    fireEvent.change(descInput, { target: { value: 'Write tests' } });
    fireEvent.click(screen.getByText('Assign Task'));

    expect(mockOnSendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:task-assigned',
        description: 'Write tests',
      })
    );
  });

  it('should send emotion change event', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    fireEvent.click(screen.getByText('Change Emotion'));

    expect(mockOnSendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:emotion-change',
      })
    );
  });

  it('should use selected agent', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    const select = screen.getByLabelText('Agent');
    fireEvent.change(select, { target: { value: 'bob' } });
    fireEvent.click(screen.getByText('Set Status'));

    expect(mockOnSendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'bob',
      })
    );
  });

  it('should render status selector', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    const statusSelect = screen.getByLabelText('Status');
    expect(statusSelect).toBeInTheDocument();
  });

  it('should render emotion selector', () => {
    render(<ControlPanel onSendEvent={mockOnSendEvent} />);

    const emotionSelect = screen.getByLabelText('Emotion');
    expect(emotionSelect).toBeInTheDocument();
  });
});
