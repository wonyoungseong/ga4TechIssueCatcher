/**
 * Unit Tests for Pagination Component - Story 9.4 Task 1.3
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Pagination from '../Pagination';

describe('Pagination Component', () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render pagination info correctly', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    expect(screen.getByText('100 항목 중 1-20 표시')).toBeInTheDocument();
  });

  it('should calculate item range correctly for middle page', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    expect(screen.getByText('100 항목 중 41-60 표시')).toBeInTheDocument();
  });

  it('should calculate item range correctly for last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={95}
        itemsPerPage={20}
      />
    );

    expect(screen.getByText('95 항목 중 81-95 표시')).toBeInTheDocument();
  });

  it('should disable first and previous buttons on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const firstButton = screen.getByLabelText('첫 페이지');
    const previousButton = screen.getByLabelText('이전 페이지');

    expect(firstButton).toBeDisabled();
    expect(previousButton).toBeDisabled();
  });

  it('should disable next and last buttons on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const nextButton = screen.getByLabelText('다음 페이지');
    const lastButton = screen.getByLabelText('마지막 페이지');

    expect(nextButton).toBeDisabled();
    expect(lastButton).toBeDisabled();
  });

  it('should call onPageChange with next page when next button is clicked', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const nextButton = screen.getByLabelText('다음 페이지');
    fireEvent.click(nextButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('should call onPageChange with previous page when previous button is clicked', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const previousButton = screen.getByLabelText('이전 페이지');
    fireEvent.click(previousButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange with 1 when first button is clicked', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const firstButton = screen.getByLabelText('첫 페이지');
    fireEvent.click(firstButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });

  it('should call onPageChange with totalPages when last button is clicked', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const lastButton = screen.getByLabelText('마지막 페이지');
    fireEvent.click(lastButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(5);
  });

  it('should render all page numbers when totalPages <= 7', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`페이지 ${i}`)).toBeInTheDocument();
    }
  });

  it('should call onPageChange when page number is clicked', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const page3Button = screen.getByLabelText('페이지 3');
    fireEvent.click(page3Button);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('should highlight current page', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const page3Button = screen.getByLabelText('페이지 3');
    expect(page3Button).toHaveClass('active');
  });

  it('should show ellipsis for large page counts', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={20}
        onPageChange={mockOnPageChange}
        totalItems={400}
        itemsPerPage={20}
      />
    );

    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('should not call onPageChange when ellipsis is clicked', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={20}
        onPageChange={mockOnPageChange}
        totalItems={400}
        itemsPerPage={20}
      />
    );

    const ellipsis = screen.getAllByText('...')[0];
    fireEvent.click(ellipsis);

    expect(mockOnPageChange).not.toHaveBeenCalled();
  });
});
