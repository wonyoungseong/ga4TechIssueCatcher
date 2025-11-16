/**
 * Unit Tests for RunsList and RunCard Components - Story 9.4 Task 1.2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RunsList from '../RunsList';
import RunCard from '../RunCard';

// Mock utilities
jest.mock('../../utils/formatters', () => ({
  formatDate: jest.fn((date) => date),
  formatDuration: jest.fn((seconds) => `${Math.floor(seconds / 60)}m`),
}));

jest.mock('../../utils/statusUtils', () => ({
  getStatusLabel: jest.fn((status) => {
    const labels = { completed: '완료', running: '실행 중', failed: '실패' };
    return labels[status] || status;
  }),
  getStatusColor: jest.fn((status) => {
    const colors = { completed: 'green', running: 'blue', failed: 'red' };
    return colors[status] || 'gray';
  }),
}));

describe('RunsList Component', () => {
  const mockRuns = [
    {
      id: 'run-1',
      run_date: '2025-10-31',
      status: 'completed',
      total_properties: 85,
      completed_properties: 82,
      failed_properties: 3,
      properties_with_issues: 5,
      duration_seconds: 5400,
    },
    {
      id: 'run-2',
      run_date: '2025-10-30',
      status: 'running',
      total_properties: 85,
      completed_properties: 50,
      failed_properties: 0,
      properties_with_issues: 2,
      duration_seconds: 2700,
    },
  ];

  const mockOnSelectRun = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render list of run cards', () => {
    render(
      <RunsList runs={mockRuns} selectedRun={null} onSelectRun={mockOnSelectRun} />
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('should show empty state when no runs', () => {
    render(<RunsList runs={[]} selectedRun={null} onSelectRun={mockOnSelectRun} />);

    expect(screen.getByText('크롤링 실행 기록이 없습니다')).toBeInTheDocument();
  });

  it('should call onSelectRun when run card is clicked', () => {
    render(
      <RunsList runs={mockRuns} selectedRun={null} onSelectRun={mockOnSelectRun} />
    );

    const firstCard = screen.getAllByRole('button')[0];
    fireEvent.click(firstCard);

    expect(mockOnSelectRun).toHaveBeenCalledWith(mockRuns[0]);
  });
});

describe('RunCard Component', () => {
  const mockRun = {
    id: 'run-1',
    run_date: '2025-10-31',
    status: 'completed',
    total_properties: 85,
    completed_properties: 82,
    failed_properties: 3,
    properties_with_issues: 5,
    duration_seconds: 5400,
  };

  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render run card with date and status', () => {
    render(<RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />);

    expect(screen.getByText('2025-10-31')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });

  it('should display all stats', () => {
    render(<RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />);

    expect(screen.getByText('총 프로퍼티')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('실패')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('이슈')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display duration', () => {
    render(<RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />);

    expect(screen.getByText('90m')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(<RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should call onClick when Enter key is pressed', () => {
    render(<RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />);

    const card = screen.getByRole('button');
    fireEvent.keyPress(card, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should apply selected class when isSelected is true', () => {
    const { container } = render(
      <RunCard run={mockRun} isSelected={true} onClick={mockOnClick} />
    );

    const card = container.querySelector('.run-card-selected');
    expect(card).toBeInTheDocument();
  });

  it('should not apply selected class when isSelected is false', () => {
    const { container } = render(
      <RunCard run={mockRun} isSelected={false} onClick={mockOnClick} />
    );

    const card = container.querySelector('.run-card-selected');
    expect(card).not.toBeInTheDocument();
  });
});
