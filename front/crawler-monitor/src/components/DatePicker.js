/**
 * DatePicker Component
 *
 * Custom DatePicker with Korean locale and range selection support.
 */

import React from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePicker.css';

// Register Korean locale
registerLocale('ko', ko);

const DatePicker = ({
  selected,
  onChange,
  startDate,
  endDate,
  selectsRange = false,
  placeholder = '날짜 선택',
  dateFormat = 'yyyy-MM-dd',
  isClearable = false,
  disabled = false,
  minDate = null,
  maxDate = null,
  ...props
}) => {
  if (selectsRange) {
    return (
      <ReactDatePicker
        selectsRange
        startDate={startDate}
        endDate={endDate}
        onChange={onChange}
        dateFormat={dateFormat}
        placeholderText={placeholder}
        isClearable={isClearable}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        locale="ko"
        className="custom-datepicker"
        {...props}
      />
    );
  }

  return (
    <ReactDatePicker
      selected={selected}
      onChange={onChange}
      dateFormat={dateFormat}
      placeholderText={placeholder}
      isClearable={isClearable}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      locale="ko"
      className="custom-datepicker"
      {...props}
    />
  );
};

export default DatePicker;
