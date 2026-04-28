import { render, screen, fireEvent } from '@testing-library/react';

import { ControlPanel } from '../ControlPanel';

describe('ControlPanel', () => {
  const mockOnTaskSubmitted = jest.fn();

  beforeEach(() => {
    mockOnTaskSubmitted.mockClear();
  });

  it('should render control panel title', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render agent selector', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    const select = screen.getByLabelText('Agent');
    expect(select).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    expect(screen.getByText('Set Status')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Emotion')).toBeInTheDocument();
  });

  it('should disable manual status changes because they are not snapshot-backed', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    expect(screen.getByText('Set Status')).toBeDisabled();
    expect(screen.getByText(/不会写入 unified snapshot/)).toBeInTheDocument();
  });

  it('should disable manual task assignment because it is not snapshot-backed', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    const descInput = screen.getByPlaceholderText('Task description...');
    fireEvent.change(descInput, { target: { value: 'Write tests' } });

    expect(descInput).toBeDisabled();
    expect(screen.getByText('Assign')).toBeDisabled();
  });

  it('should disable manual emotion changes because they are not snapshot-backed', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    expect(screen.getByLabelText('Emotion')).toBeDisabled();
    expect(screen.getByText('Emotion')).toBeDisabled();
  });

  it('should render status selector', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    const statusSelect = screen.getByLabelText('Status');
    expect(statusSelect).toBeInTheDocument();
  });

  it('should render emotion selector', () => {
    render(<ControlPanel onTaskSubmitted={mockOnTaskSubmitted} />);

    const emotionSelect = screen.getByLabelText('Emotion');
    expect(emotionSelect).toBeInTheDocument();
  });
});
