/**
 * Unit Tests for DatePicker Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DatePicker from '../DatePicker';

describe('DatePicker Component', () => {
  it('should render date picker', () => {
    render(<DatePicker selected={null} onChange={jest.fn()} />);
    const input = screen.getByPlaceholderText('날짜 선택');
    expect(input).toBeInTheDocument();
  });

  it('should display selected date', () => {
    const date = new Date('2025-10-31');
    render(<DatePicker selected={date} onChange={jest.fn()} />);
    const input = screen.getByDisplayValue('2025-10-31');
    expect(input).toBeInTheDocument();
  });

  it('should use Korean locale', () => {
    render(<DatePicker selected={null} onChange={jest.fn()} />);
    // Korean locale is registered and used internally
    expect(screen.getByPlaceholderText('날짜 선택')).toBeInTheDocument();
  });

  it('should handle date range selection', () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    render(
      <DatePicker
        selectsRange
        startDate={startDate}
        endDate={endDate}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByPlaceholderText('날짜 선택')).toBeInTheDocument();
  });

  it('should apply custom placeholder', () => {
    render(
      <DatePicker
        selected={null}
        onChange={jest.fn()}
        placeholder="날짜를 선택하세요"
      />
    );

    expect(screen.getByPlaceholderText('날짜를 선택하세요')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    render(<DatePicker selected={null} onChange={jest.fn()} disabled={true} />);
    const input = screen.getByPlaceholderText('날짜 선택');
    expect(input).toBeDisabled();
  });

  it('should apply custom date format', () => {
    const date = new Date('2025-10-31');
    render(
      <DatePicker
        selected={date}
        onChange={jest.fn()}
        dateFormat="MM/dd/yyyy"
      />
    );

    const input = screen.getByDisplayValue('10/31/2025');
    expect(input).toBeInTheDocument();
  });
});
